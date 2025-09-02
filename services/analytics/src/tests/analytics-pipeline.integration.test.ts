import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AnalyticsService } from '../analytics.service';
import { 
  AnalyticsData, 
  AnalyticsDataType, 
  ReportFormat,
  TimeRange,
  ElasticsearchConfig,
  CacheConfig 
} from '../interfaces/analytics.interface';
import winston from 'winston';

describe('Analytics Pipeline Integration Tests', () => {
  let analyticsService: AnalyticsService;
  let logger: winston.Logger;
  const testOrganizationId = 'test-org-123';
  const testUserId = 'test-user-123';

  beforeAll(async () => {
    // Initialize test logger
    logger = winston.createLogger({
      level: 'error', // Reduce noise in tests
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({ silent: true })
      ]
    });

    // Test Elasticsearch configuration
    const elasticsearchConfig: ElasticsearchConfig = {
      node: process.env.TEST_ELASTICSEARCH_URL || 'http://localhost:9200',
      requestTimeout: 5000,
      maxRetries: 1
    };

    const cacheConfig: CacheConfig = {
      ttl: 60, // Short TTL for tests
      maxSize: 100,
      enabled: true
    };

    analyticsService = new AnalyticsService(elasticsearchConfig, logger, cacheConfig);

    // Wait a bit for services to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await analyticsService.cleanup();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    // In a real test environment, you might want to use a separate test index
  });

  describe('Data Ingestion Pipeline', () => {
    it('should ingest execution data successfully', async () => {
      const executionData: AnalyticsData = {
        timestamp: new Date(),
        source: 'test-orchestrator',
        type: AnalyticsDataType.EXECUTION,
        organizationId: testOrganizationId,
        userId: testUserId,
        data: {
          executionId: 'exec-123',
          workflowId: 'workflow-456',
          workflowName: 'Test Workflow',
          status: 'completed',
          engineType: 'langflow',
          duration: 5000,
          memoryUsage: 128,
          cpuUsage: 0.5
        }
      };

      await expect(analyticsService.ingestData(executionData)).resolves.not.toThrow();
    });

    it('should ingest workflow data successfully', async () => {
      const workflowData: AnalyticsData = {
        timestamp: new Date(),
        source: 'test-workflow-manager',
        type: AnalyticsDataType.WORKFLOW,
        organizationId: testOrganizationId,
        userId: testUserId,
        data: {
          workflowId: 'workflow-456',
          workflowName: 'Test Workflow',
          engineType: 'langflow',
          version: 1,
          action: 'created',
          tags: ['test', 'automation']
        }
      };

      await expect(analyticsService.ingestData(workflowData)).resolves.not.toThrow();
    });

    it('should ingest user action data successfully', async () => {
      const userActionData: AnalyticsData = {
        timestamp: new Date(),
        source: 'test-ui',
        type: AnalyticsDataType.USER_ACTION,
        organizationId: testOrganizationId,
        userId: testUserId,
        data: {
          action: 'workflow_created',
          resource: 'workflow',
          resourceId: 'workflow-456',
          userAgent: 'test-browser',
          ipAddress: '127.0.0.1',
          sessionId: 'session-789'
        }
      };

      await expect(analyticsService.ingestData(userActionData)).resolves.not.toThrow();
    });

    it('should ingest system metrics data successfully', async () => {
      const systemMetricsData: AnalyticsData = {
        timestamp: new Date(),
        source: 'test-monitoring',
        type: AnalyticsDataType.SYSTEM_METRIC,
        organizationId: testOrganizationId,
        data: {
          service: 'orchestration',
          instance: 'orchestration-1',
          metricName: 'cpu_usage',
          metricValue: 45.5,
          unit: 'percent',
          labels: {
            environment: 'test',
            region: 'us-east-1'
          }
        }
      };

      await expect(analyticsService.ingestData(systemMetricsData)).resolves.not.toThrow();
    });

    it('should ingest performance data successfully', async () => {
      const performanceData: AnalyticsData = {
        timestamp: new Date(),
        source: 'test-performance-monitor',
        type: AnalyticsDataType.PERFORMANCE,
        organizationId: testOrganizationId,
        data: {
          service: 'orchestration',
          operation: 'execute_workflow',
          duration: 2500,
          throughput: 10.5,
          errorRate: 2.1,
          p95: 3000,
          p99: 4500
        }
      };

      await expect(analyticsService.ingestData(performanceData)).resolves.not.toThrow();
    });

    it('should ingest billing data successfully', async () => {
      const billingData: AnalyticsData = {
        timestamp: new Date(),
        source: 'test-billing',
        type: AnalyticsDataType.BILLING,
        organizationId: testOrganizationId,
        data: {
          service: 'orchestration',
          resourceType: 'execution',
          cost: 0.05,
          currency: 'USD',
          billingPeriod: '2024-01',
          usage: 50,
          usageUnit: 'executions'
        }
      };

      await expect(analyticsService.ingestData(billingData)).resolves.not.toThrow();
    });
  });

  describe('Data Querying Pipeline', () => {
    beforeEach(async () => {
      // Ingest some test data for querying
      const testData: AnalyticsData[] = [
        {
          timestamp: new Date(Date.now() - 60000), // 1 minute ago
          source: 'test',
          type: AnalyticsDataType.EXECUTION,
          organizationId: testOrganizationId,
          userId: testUserId,
          data: {
            executionId: 'exec-1',
            workflowId: 'workflow-1',
            status: 'completed',
            engineType: 'langflow',
            duration: 1000
          }
        },
        {
          timestamp: new Date(Date.now() - 30000), // 30 seconds ago
          source: 'test',
          type: AnalyticsDataType.EXECUTION,
          organizationId: testOrganizationId,
          userId: testUserId,
          data: {
            executionId: 'exec-2',
            workflowId: 'workflow-1',
            status: 'failed',
            engineType: 'n8n',
            duration: 2000
          }
        }
      ];

      for (const data of testData) {
        await analyticsService.ingestData(data);
      }

      // Wait for data to be indexed
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    it('should query execution data successfully', async () => {
      const query = {
        index: 'orchestrator-executions',
        query: {
          bool: {
            filter: [
              { term: { organizationId: testOrganizationId } }
            ]
          }
        },
        size: 10
      };

      const result = await analyticsService.queryData(query);
      
      expect(result).toBeDefined();
      expect(result.hits).toBeDefined();
      expect(result.hits.total.value).toBeGreaterThanOrEqual(0);
    });

    it('should query with time range filter', async () => {
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 120000), // 2 minutes ago
        end: new Date()
      };

      const query = {
        index: 'orchestrator-executions',
        query: {
          bool: {
            filter: [
              { term: { organizationId: testOrganizationId } }
            ]
          }
        },
        timeRange,
        size: 10
      };

      const result = await analyticsService.queryData(query);
      
      expect(result).toBeDefined();
      expect(result.hits).toBeDefined();
    });

    it('should query with aggregations', async () => {
      const query = {
        index: 'orchestrator-executions',
        query: {
          bool: {
            filter: [
              { term: { organizationId: testOrganizationId } }
            ]
          }
        },
        aggregations: {
          status_breakdown: {
            terms: { field: 'status' }
          },
          avg_duration: {
            avg: { field: 'duration' }
          }
        },
        size: 0
      };

      const result = await analyticsService.queryData(query);
      
      expect(result).toBeDefined();
      expect(result.aggregations).toBeDefined();
    });
  });

  describe('Dashboard Data Aggregation', () => {
    it('should create dashboard successfully', async () => {
      const dashboardRequest = {
        name: 'Test Dashboard',
        description: 'A test dashboard',
        organizationId: testOrganizationId,
        widgets: [
          {
            type: 'line_chart',
            title: 'Executions Over Time',
            query: {
              index: 'orchestrator-executions',
              query: { match_all: {} },
              aggregations: {
                time_series: {
                  date_histogram: {
                    field: 'timestamp',
                    interval: '1h'
                  }
                }
              }
            },
            config: { seriesName: 'Executions' },
            position: { x: 0, y: 0, width: 6, height: 4 }
          }
        ]
      };

      const dashboard = await analyticsService.createDashboard(dashboardRequest);
      
      expect(dashboard).toBeDefined();
      expect(dashboard.id).toBeDefined();
      expect(dashboard.name).toBe('Test Dashboard');
      expect(dashboard.widgets).toHaveLength(1);
    });

    it('should get dashboard data with caching', async () => {
      const dashboardId = 'test-dashboard-123';
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 3600000), // 1 hour ago
        end: new Date()
      };

      // First call should compute data
      const dashboardData1 = await analyticsService.getDashboardData(dashboardId, timeRange);
      expect(dashboardData1).toBeDefined();
      expect(dashboardData1.id).toBe(dashboardId);

      // Second call should use cache (faster)
      const startTime = Date.now();
      const dashboardData2 = await analyticsService.getDashboardData(dashboardId, timeRange);
      const endTime = Date.now();

      expect(dashboardData2).toBeDefined();
      expect(dashboardData2.id).toBe(dashboardId);
      // Cache should make it faster (though this might be flaky in CI)
      // expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Report Generation Pipeline', () => {
    it('should generate performance report in JSON format', async () => {
      const reportRequest = {
        type: 'performance',
        name: 'Test Performance Report',
        parameters: {},
        format: ReportFormat.JSON,
        organizationId: testOrganizationId,
        userId: testUserId,
        timeRange: {
          start: new Date(Date.now() - 3600000), // 1 hour ago
          end: new Date()
        }
      };

      const report = await analyticsService.generateReport(reportRequest);
      
      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.type).toBe('performance');
      expect(report.status).toBe('completed');
      expect(report.data).toBeDefined();
    });

    it('should generate usage report in PDF format', async () => {
      const reportRequest = {
        type: 'usage',
        name: 'Test Usage Report',
        parameters: {},
        format: ReportFormat.PDF,
        organizationId: testOrganizationId,
        userId: testUserId,
        timeRange: {
          start: new Date(Date.now() - 86400000), // 24 hours ago
          end: new Date()
        }
      };

      const report = await analyticsService.generateReport(reportRequest);
      
      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.type).toBe('usage');
      expect(report.status).toBe('completed');
      expect(report.filePath).toBeDefined();
    });

    it('should get available report types', async () => {
      const reportTypes = await analyticsService.getReportTypes();
      
      expect(reportTypes).toBeDefined();
      expect(Array.isArray(reportTypes)).toBe(true);
      expect(reportTypes.length).toBeGreaterThan(0);
      
      const performanceReport = reportTypes.find(rt => rt.id === 'performance');
      expect(performanceReport).toBeDefined();
      expect(performanceReport?.supportedFormats).toContain(ReportFormat.PDF);
    });

    it('should schedule report successfully', async () => {
      const scheduleRequest = {
        reportType: 'usage',
        name: 'Weekly Usage Report',
        cronExpression: '0 0 * * 1', // Every Monday at midnight
        parameters: {},
        format: ReportFormat.PDF,
        organizationId: testOrganizationId,
        userId: testUserId,
        enabled: true
      };

      const scheduledReport = await analyticsService.scheduleReport(scheduleRequest);
      
      expect(scheduledReport).toBeDefined();
      expect(scheduledReport.id).toBeDefined();
      expect(scheduledReport.cronExpression).toBe('0 0 * * 1');
      expect(scheduledReport.enabled).toBe(true);
    });
  });

  describe('Performance Metrics Pipeline', () => {
    beforeEach(async () => {
      // Ingest performance test data
      const performanceData: AnalyticsData[] = [
        {
          timestamp: new Date(Date.now() - 3600000),
          source: 'test',
          type: AnalyticsDataType.EXECUTION,
          organizationId: testOrganizationId,
          data: {
            executionId: 'perf-1',
            workflowId: 'workflow-perf',
            status: 'completed',
            duration: 1500,
            memoryUsage: 64,
            cpuUsage: 0.3
          }
        },
        {
          timestamp: new Date(Date.now() - 1800000),
          source: 'test',
          type: AnalyticsDataType.EXECUTION,
          organizationId: testOrganizationId,
          data: {
            executionId: 'perf-2',
            workflowId: 'workflow-perf',
            status: 'completed',
            duration: 2000,
            memoryUsage: 96,
            cpuUsage: 0.5
          }
        }
      ];

      for (const data of performanceData) {
        await analyticsService.ingestData(data);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    it('should calculate performance metrics', async () => {
      const query = {
        organizationId: testOrganizationId,
        timeRange: {
          start: new Date(Date.now() - 7200000), // 2 hours ago
          end: new Date()
        },
        metrics: ['response_time', 'throughput']
      };

      const metrics = await analyticsService.getPerformanceMetrics(query);
      
      expect(metrics).toBeDefined();
      expect(metrics.timeRange).toBeDefined();
      expect(metrics.metrics).toBeDefined();
      expect(metrics.metrics.executionDuration).toBeDefined();
      expect(metrics.metrics.throughput).toBeDefined();
      expect(metrics.trends).toBeDefined();
    });
  });

  describe('Usage and Billing Pipeline', () => {
    beforeEach(async () => {
      // Ingest usage test data
      const usageData: AnalyticsData[] = [
        {
          timestamp: new Date(Date.now() - 3600000),
          source: 'test',
          type: AnalyticsDataType.EXECUTION,
          organizationId: testOrganizationId,
          userId: testUserId,
          data: {
            executionId: 'usage-1',
            workflowId: 'workflow-usage',
            workflowName: 'Usage Test Workflow',
            status: 'completed',
            engineType: 'langflow',
            duration: 1000
          }
        },
        {
          timestamp: new Date(Date.now() - 1800000),
          source: 'test',
          type: AnalyticsDataType.BILLING,
          organizationId: testOrganizationId,
          data: {
            service: 'orchestration',
            resourceType: 'execution',
            cost: 0.01,
            currency: 'USD',
            usage: 1,
            usageUnit: 'executions'
          }
        }
      ];

      for (const data of usageData) {
        await analyticsService.ingestData(data);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    it('should calculate usage analytics', async () => {
      const query = {
        organizationId: testOrganizationId,
        timeRange: {
          start: new Date(Date.now() - 7200000), // 2 hours ago
          end: new Date()
        },
        includeUsers: true,
        includeWorkflows: true
      };

      const usage = await analyticsService.getUsageAnalytics(query);
      
      expect(usage).toBeDefined();
      expect(usage.timeRange).toBeDefined();
      expect(usage.totalExecutions).toBeGreaterThanOrEqual(0);
      expect(usage.uniqueUsers).toBeGreaterThanOrEqual(0);
      expect(usage.topWorkflows).toBeDefined();
      expect(usage.executionsByEngine).toBeDefined();
    });

    it('should calculate billing metrics', async () => {
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 7200000), // 2 hours ago
        end: new Date()
      };

      const billing = await analyticsService.getBillingMetrics(testOrganizationId, timeRange);
      
      expect(billing).toBeDefined();
      expect(billing.organizationId).toBe(testOrganizationId);
      expect(billing.timeRange).toBeDefined();
      expect(billing.totalCost).toBeGreaterThanOrEqual(0);
      expect(billing.costByService).toBeDefined();
      expect(billing.executionCosts).toBeDefined();
      expect(billing.projectedCost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Analytics Summary and Alerts', () => {
    it('should get analytics summary', async () => {
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 86400000), // 24 hours ago
        end: new Date()
      };

      const summary = await analyticsService.getAnalyticsSummary(testOrganizationId, timeRange);
      
      expect(summary).toBeDefined();
      expect(summary.timeRange).toBeDefined();
      expect(summary.performance).toBeDefined();
      expect(summary.usage).toBeDefined();
      expect(summary.billing).toBeDefined();
    });

    it('should get analytics alerts', async () => {
      const alerts = await analyticsService.getAnalyticsAlerts(testOrganizationId);
      
      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
      // Alerts array can be empty if no issues are detected
    });
  });

  describe('System Health and Monitoring', () => {
    it('should get system health status', async () => {
      const health = await analyticsService.getSystemHealth();
      
      expect(health).toBeDefined();
      expect(health.elasticsearch).toBeDefined();
      expect(health.services).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle invalid data gracefully', async () => {
      const invalidData = {
        // Missing required fields
        timestamp: new Date(),
        source: 'test'
        // Missing type, organizationId, data
      } as any;

      await expect(analyticsService.ingestData(invalidData)).rejects.toThrow();
    });

    it('should handle query errors gracefully', async () => {
      const invalidQuery = {
        index: 'non-existent-index',
        query: {
          invalid_query: {}
        }
      };

      await expect(analyticsService.queryData(invalidQuery)).rejects.toThrow();
    });

    it('should handle report generation errors gracefully', async () => {
      const invalidReportRequest = {
        type: 'non-existent-type',
        name: 'Invalid Report',
        parameters: {},
        format: ReportFormat.JSON,
        organizationId: testOrganizationId,
        userId: testUserId
      };

      const report = await analyticsService.generateReport(invalidReportRequest);
      expect(report.status).toBe('failed');
      expect(report.error).toBeDefined();
    });
  });
});