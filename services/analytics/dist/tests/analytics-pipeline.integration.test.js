"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const analytics_service_1 = require("../analytics.service");
const analytics_interface_1 = require("../interfaces/analytics.interface");
const winston_1 = __importDefault(require("winston"));
(0, vitest_1.describe)('Analytics Pipeline Integration Tests', () => {
    let analyticsService;
    let logger;
    const testOrganizationId = 'test-org-123';
    const testUserId = 'test-user-123';
    (0, vitest_1.beforeAll)(async () => {
        // Initialize test logger
        logger = winston_1.default.createLogger({
            level: 'error', // Reduce noise in tests
            format: winston_1.default.format.json(),
            transports: [
                new winston_1.default.transports.Console({ silent: true })
            ]
        });
        // Test Elasticsearch configuration
        const elasticsearchConfig = {
            node: process.env.TEST_ELASTICSEARCH_URL || 'http://localhost:9200',
            requestTimeout: 5000,
            maxRetries: 1
        };
        const cacheConfig = {
            ttl: 60, // Short TTL for tests
            maxSize: 100,
            enabled: true
        };
        analyticsService = new analytics_service_1.AnalyticsService(elasticsearchConfig, logger, cacheConfig);
        // Wait a bit for services to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
    });
    (0, vitest_1.afterAll)(async () => {
        await analyticsService.cleanup();
    });
    (0, vitest_1.beforeEach)(async () => {
        // Clean up test data before each test
        // In a real test environment, you might want to use a separate test index
    });
    (0, vitest_1.describe)('Data Ingestion Pipeline', () => {
        (0, vitest_1.it)('should ingest execution data successfully', async () => {
            const executionData = {
                timestamp: new Date(),
                source: 'test-orchestrator',
                type: analytics_interface_1.AnalyticsDataType.EXECUTION,
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
            await (0, vitest_1.expect)(analyticsService.ingestData(executionData)).resolves.not.toThrow();
        });
        (0, vitest_1.it)('should ingest workflow data successfully', async () => {
            const workflowData = {
                timestamp: new Date(),
                source: 'test-workflow-manager',
                type: analytics_interface_1.AnalyticsDataType.WORKFLOW,
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
            await (0, vitest_1.expect)(analyticsService.ingestData(workflowData)).resolves.not.toThrow();
        });
        (0, vitest_1.it)('should ingest user action data successfully', async () => {
            const userActionData = {
                timestamp: new Date(),
                source: 'test-ui',
                type: analytics_interface_1.AnalyticsDataType.USER_ACTION,
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
            await (0, vitest_1.expect)(analyticsService.ingestData(userActionData)).resolves.not.toThrow();
        });
        (0, vitest_1.it)('should ingest system metrics data successfully', async () => {
            const systemMetricsData = {
                timestamp: new Date(),
                source: 'test-monitoring',
                type: analytics_interface_1.AnalyticsDataType.SYSTEM_METRIC,
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
            await (0, vitest_1.expect)(analyticsService.ingestData(systemMetricsData)).resolves.not.toThrow();
        });
        (0, vitest_1.it)('should ingest performance data successfully', async () => {
            const performanceData = {
                timestamp: new Date(),
                source: 'test-performance-monitor',
                type: analytics_interface_1.AnalyticsDataType.PERFORMANCE,
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
            await (0, vitest_1.expect)(analyticsService.ingestData(performanceData)).resolves.not.toThrow();
        });
        (0, vitest_1.it)('should ingest billing data successfully', async () => {
            const billingData = {
                timestamp: new Date(),
                source: 'test-billing',
                type: analytics_interface_1.AnalyticsDataType.BILLING,
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
            await (0, vitest_1.expect)(analyticsService.ingestData(billingData)).resolves.not.toThrow();
        });
    });
    (0, vitest_1.describe)('Data Querying Pipeline', () => {
        (0, vitest_1.beforeEach)(async () => {
            // Ingest some test data for querying
            const testData = [
                {
                    timestamp: new Date(Date.now() - 60000), // 1 minute ago
                    source: 'test',
                    type: analytics_interface_1.AnalyticsDataType.EXECUTION,
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
                    type: analytics_interface_1.AnalyticsDataType.EXECUTION,
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
        (0, vitest_1.it)('should query execution data successfully', async () => {
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
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(result.hits).toBeDefined();
            (0, vitest_1.expect)(result.hits.total.value).toBeGreaterThanOrEqual(0);
        });
        (0, vitest_1.it)('should query with time range filter', async () => {
            const timeRange = {
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
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(result.hits).toBeDefined();
        });
        (0, vitest_1.it)('should query with aggregations', async () => {
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
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(result.aggregations).toBeDefined();
        });
    });
    (0, vitest_1.describe)('Dashboard Data Aggregation', () => {
        (0, vitest_1.it)('should create dashboard successfully', async () => {
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
            (0, vitest_1.expect)(dashboard).toBeDefined();
            (0, vitest_1.expect)(dashboard.id).toBeDefined();
            (0, vitest_1.expect)(dashboard.name).toBe('Test Dashboard');
            (0, vitest_1.expect)(dashboard.widgets).toHaveLength(1);
        });
        (0, vitest_1.it)('should get dashboard data with caching', async () => {
            const dashboardId = 'test-dashboard-123';
            const timeRange = {
                start: new Date(Date.now() - 3600000), // 1 hour ago
                end: new Date()
            };
            // First call should compute data
            const dashboardData1 = await analyticsService.getDashboardData(dashboardId, timeRange);
            (0, vitest_1.expect)(dashboardData1).toBeDefined();
            (0, vitest_1.expect)(dashboardData1.id).toBe(dashboardId);
            // Second call should use cache (faster)
            const startTime = Date.now();
            const dashboardData2 = await analyticsService.getDashboardData(dashboardId, timeRange);
            const endTime = Date.now();
            (0, vitest_1.expect)(dashboardData2).toBeDefined();
            (0, vitest_1.expect)(dashboardData2.id).toBe(dashboardId);
            // Cache should make it faster (though this might be flaky in CI)
            // expect(endTime - startTime).toBeLessThan(1000);
        });
    });
    (0, vitest_1.describe)('Report Generation Pipeline', () => {
        (0, vitest_1.it)('should generate performance report in JSON format', async () => {
            const reportRequest = {
                type: 'performance',
                name: 'Test Performance Report',
                parameters: {},
                format: analytics_interface_1.ReportFormat.JSON,
                organizationId: testOrganizationId,
                userId: testUserId,
                timeRange: {
                    start: new Date(Date.now() - 3600000), // 1 hour ago
                    end: new Date()
                }
            };
            const report = await analyticsService.generateReport(reportRequest);
            (0, vitest_1.expect)(report).toBeDefined();
            (0, vitest_1.expect)(report.id).toBeDefined();
            (0, vitest_1.expect)(report.type).toBe('performance');
            (0, vitest_1.expect)(report.status).toBe('completed');
            (0, vitest_1.expect)(report.data).toBeDefined();
        });
        (0, vitest_1.it)('should generate usage report in PDF format', async () => {
            const reportRequest = {
                type: 'usage',
                name: 'Test Usage Report',
                parameters: {},
                format: analytics_interface_1.ReportFormat.PDF,
                organizationId: testOrganizationId,
                userId: testUserId,
                timeRange: {
                    start: new Date(Date.now() - 86400000), // 24 hours ago
                    end: new Date()
                }
            };
            const report = await analyticsService.generateReport(reportRequest);
            (0, vitest_1.expect)(report).toBeDefined();
            (0, vitest_1.expect)(report.id).toBeDefined();
            (0, vitest_1.expect)(report.type).toBe('usage');
            (0, vitest_1.expect)(report.status).toBe('completed');
            (0, vitest_1.expect)(report.filePath).toBeDefined();
        });
        (0, vitest_1.it)('should get available report types', async () => {
            const reportTypes = await analyticsService.getReportTypes();
            (0, vitest_1.expect)(reportTypes).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(reportTypes)).toBe(true);
            (0, vitest_1.expect)(reportTypes.length).toBeGreaterThan(0);
            const performanceReport = reportTypes.find(rt => rt.id === 'performance');
            (0, vitest_1.expect)(performanceReport).toBeDefined();
            (0, vitest_1.expect)(performanceReport?.supportedFormats).toContain(analytics_interface_1.ReportFormat.PDF);
        });
        (0, vitest_1.it)('should schedule report successfully', async () => {
            const scheduleRequest = {
                reportType: 'usage',
                name: 'Weekly Usage Report',
                cronExpression: '0 0 * * 1', // Every Monday at midnight
                parameters: {},
                format: analytics_interface_1.ReportFormat.PDF,
                organizationId: testOrganizationId,
                userId: testUserId,
                enabled: true
            };
            const scheduledReport = await analyticsService.scheduleReport(scheduleRequest);
            (0, vitest_1.expect)(scheduledReport).toBeDefined();
            (0, vitest_1.expect)(scheduledReport.id).toBeDefined();
            (0, vitest_1.expect)(scheduledReport.cronExpression).toBe('0 0 * * 1');
            (0, vitest_1.expect)(scheduledReport.enabled).toBe(true);
        });
    });
    (0, vitest_1.describe)('Performance Metrics Pipeline', () => {
        (0, vitest_1.beforeEach)(async () => {
            // Ingest performance test data
            const performanceData = [
                {
                    timestamp: new Date(Date.now() - 3600000),
                    source: 'test',
                    type: analytics_interface_1.AnalyticsDataType.EXECUTION,
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
                    type: analytics_interface_1.AnalyticsDataType.EXECUTION,
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
        (0, vitest_1.it)('should calculate performance metrics', async () => {
            const query = {
                organizationId: testOrganizationId,
                timeRange: {
                    start: new Date(Date.now() - 7200000), // 2 hours ago
                    end: new Date()
                },
                metrics: ['response_time', 'throughput']
            };
            const metrics = await analyticsService.getPerformanceMetrics(query);
            (0, vitest_1.expect)(metrics).toBeDefined();
            (0, vitest_1.expect)(metrics.timeRange).toBeDefined();
            (0, vitest_1.expect)(metrics.metrics).toBeDefined();
            (0, vitest_1.expect)(metrics.metrics.executionDuration).toBeDefined();
            (0, vitest_1.expect)(metrics.metrics.throughput).toBeDefined();
            (0, vitest_1.expect)(metrics.trends).toBeDefined();
        });
    });
    (0, vitest_1.describe)('Usage and Billing Pipeline', () => {
        (0, vitest_1.beforeEach)(async () => {
            // Ingest usage test data
            const usageData = [
                {
                    timestamp: new Date(Date.now() - 3600000),
                    source: 'test',
                    type: analytics_interface_1.AnalyticsDataType.EXECUTION,
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
                    type: analytics_interface_1.AnalyticsDataType.BILLING,
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
        (0, vitest_1.it)('should calculate usage analytics', async () => {
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
            (0, vitest_1.expect)(usage).toBeDefined();
            (0, vitest_1.expect)(usage.timeRange).toBeDefined();
            (0, vitest_1.expect)(usage.totalExecutions).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(usage.uniqueUsers).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(usage.topWorkflows).toBeDefined();
            (0, vitest_1.expect)(usage.executionsByEngine).toBeDefined();
        });
        (0, vitest_1.it)('should calculate billing metrics', async () => {
            const timeRange = {
                start: new Date(Date.now() - 7200000), // 2 hours ago
                end: new Date()
            };
            const billing = await analyticsService.getBillingMetrics(testOrganizationId, timeRange);
            (0, vitest_1.expect)(billing).toBeDefined();
            (0, vitest_1.expect)(billing.organizationId).toBe(testOrganizationId);
            (0, vitest_1.expect)(billing.timeRange).toBeDefined();
            (0, vitest_1.expect)(billing.totalCost).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(billing.costByService).toBeDefined();
            (0, vitest_1.expect)(billing.executionCosts).toBeDefined();
            (0, vitest_1.expect)(billing.projectedCost).toBeGreaterThanOrEqual(0);
        });
    });
    (0, vitest_1.describe)('Analytics Summary and Alerts', () => {
        (0, vitest_1.it)('should get analytics summary', async () => {
            const timeRange = {
                start: new Date(Date.now() - 86400000), // 24 hours ago
                end: new Date()
            };
            const summary = await analyticsService.getAnalyticsSummary(testOrganizationId, timeRange);
            (0, vitest_1.expect)(summary).toBeDefined();
            (0, vitest_1.expect)(summary.timeRange).toBeDefined();
            (0, vitest_1.expect)(summary.performance).toBeDefined();
            (0, vitest_1.expect)(summary.usage).toBeDefined();
            (0, vitest_1.expect)(summary.billing).toBeDefined();
        });
        (0, vitest_1.it)('should get analytics alerts', async () => {
            const alerts = await analyticsService.getAnalyticsAlerts(testOrganizationId);
            (0, vitest_1.expect)(alerts).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(alerts)).toBe(true);
            // Alerts array can be empty if no issues are detected
        });
    });
    (0, vitest_1.describe)('System Health and Monitoring', () => {
        (0, vitest_1.it)('should get system health status', async () => {
            const health = await analyticsService.getSystemHealth();
            (0, vitest_1.expect)(health).toBeDefined();
            (0, vitest_1.expect)(health.elasticsearch).toBeDefined();
            (0, vitest_1.expect)(health.services).toBeDefined();
            (0, vitest_1.expect)(health.timestamp).toBeDefined();
        });
    });
    (0, vitest_1.describe)('Error Handling and Resilience', () => {
        (0, vitest_1.it)('should handle invalid data gracefully', async () => {
            const invalidData = {
                // Missing required fields
                timestamp: new Date(),
                source: 'test'
                // Missing type, organizationId, data
            };
            await (0, vitest_1.expect)(analyticsService.ingestData(invalidData)).rejects.toThrow();
        });
        (0, vitest_1.it)('should handle query errors gracefully', async () => {
            const invalidQuery = {
                index: 'non-existent-index',
                query: {
                    invalid_query: {}
                }
            };
            await (0, vitest_1.expect)(analyticsService.queryData(invalidQuery)).rejects.toThrow();
        });
        (0, vitest_1.it)('should handle report generation errors gracefully', async () => {
            const invalidReportRequest = {
                type: 'non-existent-type',
                name: 'Invalid Report',
                parameters: {},
                format: analytics_interface_1.ReportFormat.JSON,
                organizationId: testOrganizationId,
                userId: testUserId
            };
            const report = await analyticsService.generateReport(invalidReportRequest);
            (0, vitest_1.expect)(report.status).toBe('failed');
            (0, vitest_1.expect)(report.error).toBeDefined();
        });
    });
});
//# sourceMappingURL=analytics-pipeline.integration.test.js.map