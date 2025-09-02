import { Logger } from 'winston';
import { 
  PerformanceQuery, 
  PerformanceMetrics, 
  MetricData, 
  TrendData, 
  TimeSeriesPoint,
  TimeRange 
} from '../interfaces/analytics.interface';
import { ElasticsearchPipelineService } from './elasticsearch-pipeline.service';

export class PerformanceMetricsService {
  private elasticsearchService: ElasticsearchPipelineService;
  private logger: Logger;

  constructor(elasticsearchService: ElasticsearchPipelineService, logger: Logger) {
    this.elasticsearchService = elasticsearchService;
    this.logger = logger;
  }

  async getPerformanceMetrics(query: PerformanceQuery): Promise<PerformanceMetrics> {
    try {
      this.logger.info(`Calculating performance metrics for organization: ${query.organizationId}`);

      // Get current period metrics
      const currentMetrics = await this.calculatePeriodMetrics(query.organizationId, query.timeRange, query.filters);
      
      // Get previous period metrics for comparison
      const previousTimeRange = this.getPreviousTimeRange(query.timeRange);
      const previousMetrics = await this.calculatePeriodMetrics(query.organizationId, previousTimeRange, query.filters);

      // Calculate trends
      const trends = this.calculateTrends(currentMetrics, previousMetrics);

      return {
        timeRange: query.timeRange,
        metrics: {
          executionDuration: this.createMetricData(
            currentMetrics.avgDuration,
            previousMetrics.avgDuration,
            currentMetrics.durationTimeSeries
          ),
          throughput: this.createMetricData(
            currentMetrics.throughput,
            previousMetrics.throughput,
            currentMetrics.throughputTimeSeries
          ),
          errorRate: this.createMetricData(
            currentMetrics.errorRate,
            previousMetrics.errorRate,
            currentMetrics.errorRateTimeSeries
          ),
          resourceUtilization: this.createMetricData(
            currentMetrics.resourceUtilization,
            previousMetrics.resourceUtilization,
            currentMetrics.resourceTimeSeries
          ),
          customMetrics: await this.getCustomMetrics(query)
        },
        trends
      };
    } catch (error) {
      this.logger.error('Failed to calculate performance metrics:', error);
      throw error;
    }
  }

  private async calculatePeriodMetrics(organizationId: string, timeRange: TimeRange, filters?: Record<string, any>) {
    // Build base query
    const baseQuery = {
      bool: {
        filter: [
          { term: { organizationId } },
          { range: { timestamp: { gte: timeRange.start, lte: timeRange.end } } }
        ] as any[]
      }
    };

    // Add additional filters
    if (filters) {
      Object.entries(filters).forEach(([field, value]) => {
        baseQuery.bool.filter.push({ term: { [field]: value } });
      });
    }

    // Query for execution metrics
    const executionQuery = {
      index: 'orchestrator-executions',
      query: baseQuery,
      aggregations: {
        // Duration metrics
        avg_duration: { avg: { field: 'duration' } },
        max_duration: { max: { field: 'duration' } },
        min_duration: { min: { field: 'duration' } },
        duration_percentiles: {
          percentiles: { field: 'duration', percents: [50, 90, 95, 99] }
        },
        
        // Throughput metrics
        total_executions: { value_count: { field: 'executionId' } },
        executions_per_hour: {
          date_histogram: {
            field: 'timestamp',
            interval: '1h'
          }
        },
        
        // Error rate metrics
        status_breakdown: {
          terms: { field: 'status' }
        },
        
        // Time series data
        duration_over_time: {
          date_histogram: {
            field: 'timestamp',
            interval: this.getTimeInterval(timeRange)
          },
          aggs: {
            avg_duration: { avg: { field: 'duration' } },
            execution_count: { value_count: { field: 'executionId' } }
          }
        },
        
        // Engine performance
        engine_performance: {
          terms: { field: 'engineType' },
          aggs: {
            avg_duration: { avg: { field: 'duration' } },
            success_rate: {
              filters: {
                filters: {
                  successful: { term: { status: 'completed' } },
                  total: { match_all: {} }
                }
              }
            }
          }
        }
      }
    };

    const result = await this.elasticsearchService.queryData(executionQuery);
    const aggs = result.aggregations;

    if (!aggs) {
      throw new Error('No aggregations returned from Elasticsearch query');
    }

    // Calculate derived metrics
    const totalExecutions = aggs.total_executions.value || 0;
    const timeRangeHours = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60);
    const throughput = timeRangeHours > 0 ? totalExecutions / timeRangeHours : 0;

    const statusCounts = this.aggregationToMap(aggs.status_breakdown.buckets);
    const successfulExecutions = statusCounts.completed || 0;
    const failedExecutions = statusCounts.failed || 0;
    const errorRate = totalExecutions > 0 ? (failedExecutions / totalExecutions) * 100 : 0;

    // Get resource utilization metrics
    const resourceMetrics = await this.getResourceUtilizationMetrics(organizationId, timeRange);

    return {
      avgDuration: aggs.avg_duration.value || 0,
      maxDuration: aggs.max_duration.value || 0,
      minDuration: aggs.min_duration.value || 0,
      durationPercentiles: aggs.duration_percentiles.values,
      throughput,
      totalExecutions,
      errorRate,
      successfulExecutions,
      failedExecutions,
      resourceUtilization: resourceMetrics.avgUtilization,
      
      // Time series data
      durationTimeSeries: aggs.duration_over_time.buckets.map((bucket: any) => ({
        timestamp: new Date(bucket.key),
        value: bucket.avg_duration.value || 0
      })),
      throughputTimeSeries: aggs.duration_over_time.buckets.map((bucket: any) => ({
        timestamp: new Date(bucket.key),
        value: bucket.execution_count.value || 0
      })),
      errorRateTimeSeries: aggs.duration_over_time.buckets.map((bucket: any) => {
        const total = bucket.doc_count;
        // Would need to calculate error rate per bucket
        return {
          timestamp: new Date(bucket.key),
          value: 0 // Simplified for now
        };
      }),
      resourceTimeSeries: resourceMetrics.timeSeries,
      
      // Engine breakdown
      enginePerformance: aggs.engine_performance.buckets.map((bucket: any) => ({
        engine: bucket.key,
        avgDuration: bucket.avg_duration.value || 0,
        successRate: this.calculateSuccessRate(bucket.success_rate),
        executions: bucket.doc_count
      }))
    };
  }

  private async getResourceUtilizationMetrics(organizationId: string, timeRange: TimeRange) {
    try {
      const resourceQuery = {
        index: 'orchestrator-system-metrics',
        query: {
          bool: {
            filter: [
              { term: { organizationId } },
              { range: { timestamp: { gte: timeRange.start, lte: timeRange.end } } },
              { terms: { metricName: ['cpu_usage', 'memory_usage', 'disk_usage'] } }
            ]
          }
        },
        aggregations: {
          avg_cpu: {
            filter: { term: { metricName: 'cpu_usage' } },
            aggs: { avg_value: { avg: { field: 'metricValue' } } }
          },
          avg_memory: {
            filter: { term: { metricName: 'memory_usage' } },
            aggs: { avg_value: { avg: { field: 'metricValue' } } }
          },
          avg_disk: {
            filter: { term: { metricName: 'disk_usage' } },
            aggs: { avg_value: { avg: { field: 'metricValue' } } }
          },
          resource_over_time: {
            date_histogram: {
              field: 'timestamp',
              interval: this.getTimeInterval(timeRange)
            },
            aggs: {
              avg_cpu: {
                filter: { term: { metricName: 'cpu_usage' } },
                aggs: { avg_value: { avg: { field: 'metricValue' } } }
              },
              avg_memory: {
                filter: { term: { metricName: 'memory_usage' } },
                aggs: { avg_value: { avg: { field: 'metricValue' } } }
              }
            }
          }
        }
      };

      const result = await this.elasticsearchService.queryData(resourceQuery);
      const aggs = result.aggregations;

      if (!aggs) {
        throw new Error('No aggregations returned from resource utilization query');
      }

      const avgCpu = aggs.avg_cpu.avg_value.value || 0;
      const avgMemory = aggs.avg_memory.avg_value.value || 0;
      const avgDisk = aggs.avg_disk.avg_value.value || 0;
      const avgUtilization = (avgCpu + avgMemory + avgDisk) / 3;

      const timeSeries = aggs.resource_over_time.buckets.map((bucket: any) => ({
        timestamp: new Date(bucket.key),
        value: (
          (bucket.avg_cpu.avg_value.value || 0) +
          (bucket.avg_memory.avg_value.value || 0)
        ) / 2
      }));

      return { avgUtilization, timeSeries };
    } catch (error) {
      this.logger.warn('Failed to get resource utilization metrics:', error);
      return { avgUtilization: 0, timeSeries: [] };
    }
  }

  private async getCustomMetrics(query: PerformanceQuery): Promise<Record<string, MetricData>> {
    const customMetrics: Record<string, MetricData> = {};

    if (query.metrics && query.metrics.length > 0) {
      for (const metricName of query.metrics) {
        try {
          const metricData = await this.getCustomMetricData(
            query.organizationId,
            metricName,
            query.timeRange,
            query.filters
          );
          customMetrics[metricName] = metricData;
        } catch (error) {
          this.logger.warn(`Failed to get custom metric ${metricName}:`, error);
        }
      }
    }

    return customMetrics;
  }

  private async getCustomMetricData(
    organizationId: string,
    metricName: string,
    timeRange: TimeRange,
    filters?: Record<string, any>
  ): Promise<MetricData> {
    const baseQuery = {
      bool: {
        filter: [
          { term: { organizationId } },
          { term: { metricName } },
          { range: { timestamp: { gte: timeRange.start, lte: timeRange.end } } }
        ] as any[]
      }
    };

    if (filters) {
      Object.entries(filters).forEach(([field, value]) => {
        baseQuery.bool.filter.push({ term: { [field]: value } });
      });
    }

    const query = {
      index: 'orchestrator-system-metrics',
      query: baseQuery,
      aggregations: {
        current_avg: { avg: { field: 'metricValue' } },
        time_series: {
          date_histogram: {
            field: 'timestamp',
            interval: this.getTimeInterval(timeRange)
          },
          aggs: {
            avg_value: { avg: { field: 'metricValue' } }
          }
        }
      }
    };

    const result = await this.elasticsearchService.queryData(query);
    const aggs = result.aggregations;

    if (!aggs) {
      throw new Error('No aggregations returned from custom metric query');
    }

    const current = aggs.current_avg.value || 0;
    const timeSeries = aggs.time_series.buckets.map((bucket: any) => ({
      timestamp: new Date(bucket.key),
      value: bucket.avg_value.value || 0
    }));

    // Get previous period for comparison
    const previousTimeRange = this.getPreviousTimeRange(timeRange);
    const previousQuery = { ...query, query: { ...baseQuery } };
    previousQuery.query.bool.filter = previousQuery.query.bool.filter.map(filter => {
      if (filter.range && filter.range.timestamp) {
        return {
          range: {
            timestamp: {
              gte: previousTimeRange.start,
              lte: previousTimeRange.end
            }
          }
        };
      }
      return filter;
    });

    const previousResult = await this.elasticsearchService.queryData(previousQuery);
    const previous = previousResult.aggregations?.current_avg?.value || 0;

    return this.createMetricData(current, previous, timeSeries);
  }

  private createMetricData(current: number, previous: number, timeSeries: TimeSeriesPoint[]): MetricData {
    const change = current - previous;
    const changePercent = previous > 0 ? (change / previous) * 100 : 0;

    return {
      current,
      previous,
      change,
      changePercent,
      timeSeries
    };
  }

  private calculateTrends(currentMetrics: any, previousMetrics: any): Record<string, TrendData> {
    return {
      duration: this.calculateTrendData(currentMetrics.avgDuration, previousMetrics.avgDuration),
      throughput: this.calculateTrendData(currentMetrics.throughput, previousMetrics.throughput),
      errorRate: this.calculateTrendData(currentMetrics.errorRate, previousMetrics.errorRate, true), // Lower is better
      resourceUtilization: this.calculateTrendData(currentMetrics.resourceUtilization, previousMetrics.resourceUtilization, true)
    };
  }

  private calculateTrendData(current: number, previous: number, lowerIsBetter: boolean = false): TrendData {
    if (previous === 0) {
      return { direction: 'stable', strength: 'weak', confidence: 0.1 };
    }

    const change = current - previous;
    const changePercent = Math.abs(change / previous) * 100;

    let direction: 'up' | 'down' | 'stable';
    if (Math.abs(changePercent) < 5) {
      direction = 'stable';
    } else if (change > 0) {
      direction = lowerIsBetter ? 'down' : 'up'; // Invert for metrics where lower is better
    } else {
      direction = lowerIsBetter ? 'up' : 'down';
    }

    let strength: 'weak' | 'moderate' | 'strong';
    if (changePercent < 10) {
      strength = 'weak';
    } else if (changePercent < 25) {
      strength = 'moderate';
    } else {
      strength = 'strong';
    }

    // Confidence based on data availability and consistency
    const confidence = Math.min(0.9, 0.5 + (changePercent / 100));

    return { direction, strength, confidence };
  }

  private getPreviousTimeRange(timeRange: TimeRange): TimeRange {
    const duration = timeRange.end.getTime() - timeRange.start.getTime();
    const start = new Date(timeRange.start.getTime() - duration);
    const end = new Date(timeRange.end.getTime() - duration);
    return { start, end };
  }

  private getTimeInterval(timeRange: TimeRange): string {
    const duration = timeRange.end.getTime() - timeRange.start.getTime();
    const hours = duration / (1000 * 60 * 60);

    if (hours <= 24) {
      return '1h';
    } else if (hours <= 168) { // 1 week
      return '6h';
    } else if (hours <= 720) { // 1 month
      return '1d';
    } else {
      return '1w';
    }
  }

  private aggregationToMap(buckets: any[]): Record<string, number> {
    const map: Record<string, number> = {};
    buckets.forEach(bucket => {
      map[bucket.key] = bucket.doc_count;
    });
    return map;
  }

  private calculateSuccessRate(successRateAgg: any): number {
    const successful = successRateAgg.buckets.successful?.doc_count || 0;
    const total = successRateAgg.buckets.total?.doc_count || 0;
    return total > 0 ? (successful / total) * 100 : 0;
  }

  async getPerformanceSummary(organizationId: string, timeRange: TimeRange): Promise<any> {
    try {
      const query: PerformanceQuery = {
        organizationId,
        timeRange,
        metrics: ['response_time', 'error_count', 'throughput']
      };

      const metrics = await this.getPerformanceMetrics(query);

      return {
        summary: {
          avgExecutionTime: metrics.metrics.executionDuration.current,
          totalExecutions: metrics.metrics.throughput.current,
          errorRate: metrics.metrics.errorRate.current,
          resourceUtilization: metrics.metrics.resourceUtilization.current
        },
        trends: metrics.trends,
        timeRange: metrics.timeRange
      };
    } catch (error) {
      this.logger.error('Failed to get performance summary:', error);
      throw error;
    }
  }

  async getPerformanceAlerts(organizationId: string): Promise<any[]> {
    // This would typically check against predefined thresholds
    // and return any performance-related alerts
    const alerts = [];

    try {
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        end: new Date()
      };

      const query: PerformanceQuery = {
        organizationId,
        timeRange,
        metrics: []
      };

      const metrics = await this.getPerformanceMetrics(query);

      // Check for performance issues
      if (metrics.metrics.errorRate.current > 10) {
        alerts.push({
          type: 'high_error_rate',
          severity: 'high',
          message: `Error rate is ${metrics.metrics.errorRate.current.toFixed(2)}%, exceeding 10% threshold`,
          value: metrics.metrics.errorRate.current,
          threshold: 10
        });
      }

      if (metrics.metrics.executionDuration.current > 30000) { // 30 seconds
        alerts.push({
          type: 'slow_execution',
          severity: 'medium',
          message: `Average execution time is ${(metrics.metrics.executionDuration.current / 1000).toFixed(2)}s, exceeding 30s threshold`,
          value: metrics.metrics.executionDuration.current,
          threshold: 30000
        });
      }

      if (metrics.metrics.resourceUtilization.current > 80) {
        alerts.push({
          type: 'high_resource_usage',
          severity: 'medium',
          message: `Resource utilization is ${metrics.metrics.resourceUtilization.current.toFixed(2)}%, exceeding 80% threshold`,
          value: metrics.metrics.resourceUtilization.current,
          threshold: 80
        });
      }

    } catch (error) {
      this.logger.error('Failed to get performance alerts:', error);
    }

    return alerts;
  }
}