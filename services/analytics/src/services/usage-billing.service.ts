import { Logger } from 'winston';
import { 
  UsageQuery, 
  UsageAnalytics, 
  BillingMetrics,
  WorkflowUsage,
  UserUsage,
  TimeRange,
  TimeSeriesPoint,
  TrendData
} from '../interfaces/analytics.interface';
import { ElasticsearchPipelineService } from './elasticsearch-pipeline.service';

export class UsageBillingService {
  private elasticsearchService: ElasticsearchPipelineService;
  private logger: Logger;
  private billingRates: Record<string, number>;

  constructor(elasticsearchService: ElasticsearchPipelineService, logger: Logger) {
    this.elasticsearchService = elasticsearchService;
    this.logger = logger;
    
    // Initialize billing rates (would typically come from configuration)
    this.billingRates = {
      execution: 0.001, // $0.001 per execution
      storage: 0.0001, // $0.0001 per MB per hour
      compute: 0.01, // $0.01 per CPU hour
      network: 0.0001, // $0.0001 per MB transferred
      langflow: 0.002, // Premium rate for Langflow
      n8n: 0.0015, // Premium rate for N8N
      langsmith: 0.0025 // Premium rate for LangSmith
    };
  }

  async getUsageAnalytics(query: UsageQuery): Promise<UsageAnalytics> {
    try {
      this.logger.info(`Calculating usage analytics for organization: ${query.organizationId}`);

      // Build base query
      const baseQuery = {
        bool: {
          filter: [
            { term: { organizationId: query.organizationId } },
            { range: { timestamp: { gte: query.timeRange.start, lte: query.timeRange.end } } }
          ]
        }
      };

      // Query execution data
      const executionQuery = {
        index: 'orchestrator-executions',
        query: baseQuery,
        aggregations: {
          total_executions: { value_count: { field: 'executionId' } },
          unique_users: { cardinality: { field: 'userId' } },
          unique_workflows: { cardinality: { field: 'workflowId' } },
          
          // Top workflows
          top_workflows: {
            terms: { field: 'workflowId', size: 10 },
            aggs: {
              workflow_name: { terms: { field: 'workflowName.keyword', size: 1 } },
              success_count: {
                filter: { term: { status: 'completed' } }
              },
              avg_duration: { avg: { field: 'duration' } }
            }
          },
          
          // Top users
          top_users: {
            terms: { field: 'userId', size: 10 },
            aggs: {
              user_name: { terms: { field: 'userName.keyword', size: 1 } },
              unique_workflows: { cardinality: { field: 'workflowId' } },
              last_activity: { max: { field: 'timestamp' } }
            }
          },
          
          // Executions by engine
          executions_by_engine: {
            terms: { field: 'engineType' }
          },
          
          // Executions by status
          executions_by_status: {
            terms: { field: 'status' }
          },
          
          // Time series data
          executions_over_time: {
            date_histogram: {
              field: 'timestamp',
              interval: this.getTimeInterval(query.timeRange)
            }
          }
        }
      };

      const result = await this.elasticsearchService.queryData(executionQuery);
      const aggs = result.aggregations;

      // Process top workflows
      const topWorkflows: WorkflowUsage[] = aggs?.top_workflows?.buckets?.map((bucket: any) => {
        const workflowName = bucket.workflow_name.buckets[0]?.key || `Workflow ${bucket.key}`;
        const successRate = bucket.doc_count > 0 ? (bucket.success_count.doc_count / bucket.doc_count) * 100 : 0;
        
        return {
          workflowId: bucket.key,
          workflowName,
          executions: bucket.doc_count,
          successRate,
          avgDuration: bucket.avg_duration.value || 0
        };
      }) || [];

      // Process top users
      const topUsers: UserUsage[] = aggs?.top_users?.buckets?.map((bucket: any) => {
        const userName = bucket.user_name.buckets[0]?.key || `User ${bucket.key}`;
        
        return {
          userId: bucket.key,
          userName,
          executions: bucket.doc_count,
          workflows: bucket.unique_workflows.value,
          lastActivity: new Date(bucket.last_activity.value)
        };
      }) || [];

      // Process executions by engine
      const executionsByEngine: Record<string, number> = {};
      aggs?.executions_by_engine?.buckets?.forEach((bucket: any) => {
        executionsByEngine[bucket.key] = bucket.doc_count;
      });

      // Process executions by status
      const executionsByStatus: Record<string, number> = {};
      aggs?.executions_by_status?.buckets?.forEach((bucket: any) => {
        executionsByStatus[bucket.key] = bucket.doc_count;
      });

      // Process time series
      const timeSeries: TimeSeriesPoint[] = aggs?.executions_over_time?.buckets?.map((bucket: any) => ({
        timestamp: new Date(bucket.key),
        value: bucket.doc_count
      })) || [];

      return {
        timeRange: query.timeRange,
        totalExecutions: aggs?.total_executions?.value || 0,
        uniqueUsers: aggs?.unique_users?.value || 0,
        activeWorkflows: aggs?.unique_workflows?.value || 0,
        topWorkflows,
        topUsers,
        executionsByEngine,
        executionsByStatus,
        timeSeries
      };

    } catch (error) {
      this.logger.error('Failed to calculate usage analytics:', error);
      throw error;
    }
  }

  async getBillingMetrics(organizationId: string, timeRange: TimeRange): Promise<BillingMetrics> {
    try {
      this.logger.info(`Calculating billing metrics for organization: ${organizationId}`);

      // Get usage data first
      const usageQuery: UsageQuery = {
        organizationId,
        timeRange,
        includeUsers: true,
        includeWorkflows: true
      };
      
      const usageData = await this.getUsageAnalytics(usageQuery);

      // Calculate execution costs
      const executionCosts = this.calculateExecutionCosts(usageData);
      
      // Get resource usage data
      const resourceCosts = await this.calculateResourceCosts(organizationId, timeRange);
      
      // Calculate costs by user
      const costByUser = await this.calculateCostsByUser(organizationId, timeRange, usageData);
      
      // Calculate total cost
      const totalCost = executionCosts.total + resourceCosts.compute + resourceCosts.storage + resourceCosts.network;
      
      // Calculate cost trends
      const costTrends = await this.calculateCostTrends(organizationId, timeRange, totalCost);
      
      // Project future costs
      const projectedCost = this.calculateProjectedCost(totalCost, costTrends);

      return {
        organizationId,
        timeRange,
        totalCost,
        costByService: {
          executions: executionCosts.total,
          compute: resourceCosts.compute,
          storage: resourceCosts.storage,
          network: resourceCosts.network,
          analytics: totalCost * 0.05 // 5% for analytics service
        },
        costByUser,
        executionCosts,
        resourceCosts,
        projectedCost,
        costTrends
      };

    } catch (error) {
      this.logger.error('Failed to calculate billing metrics:', error);
      throw error;
    }
  }

  private calculateExecutionCosts(usageData: UsageAnalytics): any {
    let totalCost = 0;
    const byEngine: Record<string, number> = {};

    // Calculate cost by engine
    Object.entries(usageData.executionsByEngine).forEach(([engine, count]) => {
      const rate = this.billingRates[engine] || this.billingRates.execution;
      const cost = count * rate;
      byEngine[engine] = cost;
      totalCost += cost;
    });

    // Generate cost over time (simplified)
    const byDuration: TimeSeriesPoint[] = usageData.timeSeries.map(point => ({
      timestamp: point.timestamp,
      value: point.value * this.billingRates.execution
    }));

    return {
      total: totalCost,
      byEngine,
      byDuration
    };
  }

  private async calculateResourceCosts(organizationId: string, timeRange: TimeRange): Promise<any> {
    try {
      // Query system metrics for resource usage
      const resourceQuery = {
        index: 'orchestrator-system-metrics',
        query: {
          bool: {
            filter: [
              { term: { organizationId } },
              { range: { timestamp: { gte: timeRange.start, lte: timeRange.end } } },
              { terms: { metricName: ['cpu_usage', 'memory_usage', 'disk_usage', 'network_io'] } }
            ]
          }
        },
        aggregations: {
          cpu_hours: {
            filter: { term: { metricName: 'cpu_usage' } },
            aggs: {
              total_cpu_time: { sum: { field: 'metricValue' } }
            }
          },
          storage_mb_hours: {
            filter: { term: { metricName: 'disk_usage' } },
            aggs: {
              avg_storage: { avg: { field: 'metricValue' } }
            }
          },
          network_mb: {
            filter: { term: { metricName: 'network_io' } },
            aggs: {
              total_network: { sum: { field: 'metricValue' } }
            }
          }
        }
      };

      const result = await this.elasticsearchService.queryData(resourceQuery);
      const aggs = result.aggregations;

      const timeRangeHours = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60);
      
      const cpuHours = (aggs?.cpu_hours?.total_cpu_time?.value || 0) / 100; // Convert percentage to hours
      const storageMBHours = (aggs?.storage_mb_hours?.avg_storage?.value || 0) * timeRangeHours;
      const networkMB = aggs?.network_mb?.total_network?.value || 0;

      return {
        compute: cpuHours * this.billingRates.compute,
        storage: storageMBHours * this.billingRates.storage,
        network: networkMB * this.billingRates.network
      };

    } catch (error) {
      this.logger.warn('Failed to calculate resource costs, using defaults:', error);
      return {
        compute: 10.0, // Default compute cost
        storage: 5.0,  // Default storage cost
        network: 2.0   // Default network cost
      };
    }
  }

  private async calculateCostsByUser(organizationId: string, timeRange: TimeRange, usageData: UsageAnalytics): Promise<Record<string, number>> {
    const costByUser: Record<string, number> = {};

    // Calculate based on user execution counts
    for (const user of usageData.topUsers) {
      const userExecutions = user.executions;
      const baseCost = userExecutions * this.billingRates.execution;
      
      // Add resource allocation based on usage
      const resourceMultiplier = Math.min(2.0, 1.0 + (user.workflows / 10)); // Scale with workflow count
      costByUser[user.userId] = baseCost * resourceMultiplier;
    }

    return costByUser;
  }

  private async calculateCostTrends(organizationId: string, timeRange: TimeRange, currentCost: number): Promise<TrendData> {
    try {
      // Get previous period cost for comparison
      const previousTimeRange = this.getPreviousTimeRange(timeRange);
      const previousBilling = await this.getBillingMetrics(organizationId, previousTimeRange);
      const previousCost = previousBilling.totalCost;

      if (previousCost === 0) {
        return { direction: 'stable', strength: 'weak', confidence: 0.1 };
      }

      const change = currentCost - previousCost;
      const changePercent = Math.abs(change / previousCost) * 100;

      let direction: 'up' | 'down' | 'stable';
      if (Math.abs(changePercent) < 5) {
        direction = 'stable';
      } else if (change > 0) {
        direction = 'up';
      } else {
        direction = 'down';
      }

      let strength: 'weak' | 'moderate' | 'strong';
      if (changePercent < 10) {
        strength = 'weak';
      } else if (changePercent < 25) {
        strength = 'moderate';
      } else {
        strength = 'strong';
      }

      const confidence = Math.min(0.9, 0.5 + (changePercent / 100));

      return { direction, strength, confidence };

    } catch (error) {
      this.logger.warn('Failed to calculate cost trends:', error);
      return { direction: 'stable', strength: 'weak', confidence: 0.1 };
    }
  }

  private calculateProjectedCost(currentCost: number, trends: TrendData): number {
    let projectionMultiplier = 1.0;

    if (trends.direction === 'up') {
      projectionMultiplier = 1.1 + (trends.strength === 'strong' ? 0.2 : trends.strength === 'moderate' ? 0.1 : 0.05);
    } else if (trends.direction === 'down') {
      projectionMultiplier = 0.9 - (trends.strength === 'strong' ? 0.2 : trends.strength === 'moderate' ? 0.1 : 0.05);
    }

    return currentCost * projectionMultiplier * trends.confidence;
  }

  async getUsageSummary(organizationId: string, timeRange: TimeRange): Promise<any> {
    try {
      const usageQuery: UsageQuery = {
        organizationId,
        timeRange
      };

      const usage = await this.getUsageAnalytics(usageQuery);
      const billing = await this.getBillingMetrics(organizationId, timeRange);

      return {
        period: timeRange,
        usage: {
          totalExecutions: usage.totalExecutions,
          uniqueUsers: usage.uniqueUsers,
          activeWorkflows: usage.activeWorkflows,
          mostUsedEngine: this.getMostUsedEngine(usage.executionsByEngine),
          successRate: this.calculateOverallSuccessRate(usage.executionsByStatus)
        },
        billing: {
          totalCost: billing.totalCost,
          projectedCost: billing.projectedCost,
          costTrend: billing.costTrends.direction,
          topCostDriver: this.getTopCostDriver(billing.costByService)
        }
      };

    } catch (error) {
      this.logger.error('Failed to get usage summary:', error);
      throw error;
    }
  }

  async getUsageAlerts(organizationId: string): Promise<any[]> {
    const alerts = [];

    try {
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: new Date()
      };

      const billing = await this.getBillingMetrics(organizationId, timeRange);
      const usage = await this.getUsageAnalytics({ organizationId, timeRange });

      // Check for cost alerts
      if (billing.totalCost > 100) { // $100 threshold
        alerts.push({
          type: 'high_cost',
          severity: 'high',
          message: `Daily cost of $${billing.totalCost.toFixed(2)} exceeds $100 threshold`,
          value: billing.totalCost,
          threshold: 100
        });
      }

      // Check for usage spikes
      const avgExecutionsPerHour = usage.totalExecutions / 24;
      if (avgExecutionsPerHour > 1000) {
        alerts.push({
          type: 'high_usage',
          severity: 'medium',
          message: `Average execution rate of ${avgExecutionsPerHour.toFixed(0)}/hour exceeds 1000/hour threshold`,
          value: avgExecutionsPerHour,
          threshold: 1000
        });
      }

      // Check for error rate
      const errorRate = this.calculateOverallErrorRate(usage.executionsByStatus);
      if (errorRate > 10) {
        alerts.push({
          type: 'high_error_rate',
          severity: 'high',
          message: `Error rate of ${errorRate.toFixed(2)}% exceeds 10% threshold`,
          value: errorRate,
          threshold: 10
        });
      }

    } catch (error) {
      this.logger.error('Failed to get usage alerts:', error);
    }

    return alerts;
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

  private getPreviousTimeRange(timeRange: TimeRange): TimeRange {
    const duration = timeRange.end.getTime() - timeRange.start.getTime();
    const start = new Date(timeRange.start.getTime() - duration);
    const end = new Date(timeRange.end.getTime() - duration);
    return { start, end };
  }

  private getMostUsedEngine(executionsByEngine: Record<string, number>): string {
    let maxEngine = '';
    let maxCount = 0;

    Object.entries(executionsByEngine).forEach(([engine, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxEngine = engine;
      }
    });

    return maxEngine;
  }

  private calculateOverallSuccessRate(executionsByStatus: Record<string, number>): number {
    const successful = executionsByStatus.completed || 0;
    const total = Object.values(executionsByStatus).reduce((sum, count) => sum + count, 0);
    return total > 0 ? (successful / total) * 100 : 0;
  }

  private calculateOverallErrorRate(executionsByStatus: Record<string, number>): number {
    const failed = executionsByStatus.failed || 0;
    const total = Object.values(executionsByStatus).reduce((sum, count) => sum + count, 0);
    return total > 0 ? (failed / total) * 100 : 0;
  }

  private getTopCostDriver(costByService: Record<string, number>): string {
    let maxService = '';
    let maxCost = 0;

    Object.entries(costByService).forEach(([service, cost]) => {
      if (cost > maxCost) {
        maxCost = cost;
        maxService = service;
      }
    });

    return maxService;
  }

  async updateBillingRates(rates: Partial<Record<string, number>>): Promise<void> {
    Object.entries(rates).forEach(([key, value]) => {
      if (value !== undefined) {
        this.billingRates[key] = value;
      }
    });

    this.logger.info('Updated billing rates:', rates);
  }

  getBillingRates(): Record<string, number> {
    return { ...this.billingRates };
  }
}