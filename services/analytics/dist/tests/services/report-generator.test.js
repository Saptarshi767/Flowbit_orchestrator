"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs_1 = require("fs");
const winston_1 = __importDefault(require("winston"));
const report_generator_service_1 = require("../../services/report-generator.service");
const analytics_interface_1 = require("../../interfaces/analytics.interface");
const shared_1 = require("@robust-ai-orchestrator/shared");
// Mock dependencies
vitest_1.vi.mock('fs', () => ({
    promises: {
        mkdir: vitest_1.vi.fn(),
        writeFile: vitest_1.vi.fn()
    }
}));
vitest_1.vi.mock('pdfkit', () => {
    const mockDoc = {
        fontSize: vitest_1.vi.fn().mockReturnThis(),
        text: vitest_1.vi.fn().mockReturnThis(),
        pipe: vitest_1.vi.fn(),
        end: vitest_1.vi.fn()
    };
    return {
        default: vitest_1.vi.fn(() => mockDoc)
    };
});
vitest_1.vi.mock('csv-writer', () => ({
    createObjectCsvWriter: vitest_1.vi.fn(() => ({
        writeRecords: vitest_1.vi.fn().mockResolvedValue(undefined)
    }))
}));
(0, vitest_1.describe)('ReportGeneratorService', () => {
    let service;
    let mockElasticsearchService;
    let logger;
    (0, vitest_1.beforeEach)(() => {
        // Create mock Elasticsearch service
        mockElasticsearchService = {
            queryData: vitest_1.vi.fn()
        };
        // Create test logger
        logger = winston_1.default.createLogger({
            level: 'error',
            transports: [new winston_1.default.transports.Console({ silent: true })]
        });
        service = new report_generator_service_1.ReportGeneratorService(mockElasticsearchService, logger);
        // Mock fs.mkdir
        fs_1.promises.mkdir.mockResolvedValue(undefined);
    });
    (0, vitest_1.describe)('generateReport', () => {
        (0, vitest_1.it)('should generate performance report successfully', async () => {
            const mockQueryResult = {
                aggregations: {
                    avg_duration: { value: 2500 },
                    max_duration: { value: 5000 },
                    min_duration: { value: 1000 },
                    total_executions: { value: 100 },
                    success_rate: {
                        buckets: {
                            successful: { doc_count: 90 },
                            failed: { doc_count: 10 }
                        }
                    },
                    duration_histogram: {
                        buckets: [
                            { key: 1640995200000, avg_duration: { value: 2000 } },
                            { key: 1640998800000, avg_duration: { value: 3000 } }
                        ]
                    }
                }
            };
            mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);
            const reportRequest = {
                type: 'performance',
                name: 'Test Performance Report',
                parameters: {},
                format: shared_1.ReportFormat.JSON,
                organizationId: 'org-1',
                userId: 'user-1',
                timeRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-01-02')
                }
            };
            const report = await service.generateReport(reportRequest);
            (0, vitest_1.expect)(report).toBeDefined();
            (0, vitest_1.expect)(report.id).toBeDefined();
            (0, vitest_1.expect)(report.type).toBe('performance');
            (0, vitest_1.expect)(report.status).toBe(analytics_interface_1.ReportStatus.COMPLETED);
            (0, vitest_1.expect)(report.data).toBeDefined();
            (0, vitest_1.expect)(report.data.metrics).toBeDefined();
            (0, vitest_1.expect)(report.data.metrics.executionDuration).toBeDefined();
        });
        (0, vitest_1.it)('should generate usage report successfully', async () => {
            const mockQueryResult = {
                aggregations: {
                    total_executions: { value: 150 },
                    unique_users: { value: 25 },
                    unique_workflows: { value: 10 },
                    top_workflows: {
                        buckets: [
                            {
                                key: 'workflow-1',
                                doc_count: 50,
                                workflow_name: { buckets: [{ key: 'Test Workflow 1' }] },
                                success_count: { doc_count: 45 },
                                avg_duration: { value: 2000 }
                            }
                        ]
                    },
                    top_users: {
                        buckets: [
                            {
                                key: 'user-1',
                                doc_count: 30,
                                user_name: { buckets: [{ key: 'Test User 1' }] },
                                unique_workflows: { value: 5 },
                                last_activity: { value: Date.now() }
                            }
                        ]
                    },
                    executions_by_engine: {
                        buckets: [
                            { key: 'langflow', doc_count: 80 },
                            { key: 'n8n', doc_count: 70 }
                        ]
                    },
                    executions_by_status: {
                        buckets: [
                            { key: 'completed', doc_count: 130 },
                            { key: 'failed', doc_count: 20 }
                        ]
                    },
                    executions_over_time: {
                        buckets: [
                            { key: 1640995200000, doc_count: 75 },
                            { key: 1640998800000, doc_count: 75 }
                        ]
                    }
                }
            };
            mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);
            const reportRequest = {
                type: 'usage',
                name: 'Test Usage Report',
                parameters: {},
                format: shared_1.ReportFormat.JSON,
                organizationId: 'org-1',
                userId: 'user-1',
                timeRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-01-02')
                }
            };
            const report = await service.generateReport(reportRequest);
            (0, vitest_1.expect)(report).toBeDefined();
            (0, vitest_1.expect)(report.type).toBe('usage');
            (0, vitest_1.expect)(report.status).toBe(analytics_interface_1.ReportStatus.COMPLETED);
            (0, vitest_1.expect)(report.data).toBeDefined();
            (0, vitest_1.expect)(report.data.totalExecutions).toBe(150);
            (0, vitest_1.expect)(report.data.uniqueUsers).toBe(25);
            (0, vitest_1.expect)(report.data.topWorkflows).toHaveLength(1);
            (0, vitest_1.expect)(report.data.topUsers).toHaveLength(1);
        });
        (0, vitest_1.it)('should generate billing report successfully', async () => {
            const reportRequest = {
                type: 'billing',
                name: 'Test Billing Report',
                parameters: {},
                format: shared_1.ReportFormat.JSON,
                organizationId: 'org-1',
                userId: 'user-1',
                timeRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-01-02')
                }
            };
            const report = await service.generateReport(reportRequest);
            (0, vitest_1.expect)(report).toBeDefined();
            (0, vitest_1.expect)(report.type).toBe('billing');
            (0, vitest_1.expect)(report.status).toBe(analytics_interface_1.ReportStatus.COMPLETED);
            (0, vitest_1.expect)(report.data).toBeDefined();
            (0, vitest_1.expect)(report.data.totalCost).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(report.data.costByService).toBeDefined();
            (0, vitest_1.expect)(report.data.executionCosts).toBeDefined();
        });
        (0, vitest_1.it)('should generate execution summary report successfully', async () => {
            const mockQueryResult = {
                hits: {
                    total: { value: 50 },
                    hits: [
                        {
                            _source: {
                                executionId: 'exec-1',
                                workflowId: 'workflow-1',
                                status: 'completed',
                                engineType: 'langflow',
                                duration: 2000,
                                timestamp: new Date().toISOString()
                            }
                        },
                        {
                            _source: {
                                executionId: 'exec-2',
                                workflowId: 'workflow-2',
                                status: 'failed',
                                engineType: 'n8n',
                                duration: 1500,
                                timestamp: new Date().toISOString()
                            }
                        }
                    ]
                }
            };
            mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);
            const reportRequest = {
                type: 'execution-summary',
                name: 'Test Execution Summary',
                parameters: {},
                format: shared_1.ReportFormat.JSON,
                organizationId: 'org-1',
                userId: 'user-1',
                timeRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-01-02')
                }
            };
            const report = await service.generateReport(reportRequest);
            (0, vitest_1.expect)(report).toBeDefined();
            (0, vitest_1.expect)(report.type).toBe('execution-summary');
            (0, vitest_1.expect)(report.status).toBe(analytics_interface_1.ReportStatus.COMPLETED);
            (0, vitest_1.expect)(report.data).toBeDefined();
            (0, vitest_1.expect)(report.data.totalExecutions).toBe(50);
            (0, vitest_1.expect)(report.data.executions).toHaveLength(2);
            (0, vitest_1.expect)(report.data.summary).toBeDefined();
            (0, vitest_1.expect)(report.data.summary.successful).toBe(1);
            (0, vitest_1.expect)(report.data.summary.failed).toBe(1);
        });
        (0, vitest_1.it)('should handle unknown report type', async () => {
            const reportRequest = {
                type: 'unknown-type',
                name: 'Unknown Report',
                parameters: {},
                format: shared_1.ReportFormat.JSON,
                organizationId: 'org-1',
                userId: 'user-1'
            };
            const report = await service.generateReport(reportRequest);
            (0, vitest_1.expect)(report.status).toBe(analytics_interface_1.ReportStatus.FAILED);
            (0, vitest_1.expect)(report.error).toContain('Unknown report type');
        });
        (0, vitest_1.it)('should handle Elasticsearch query errors', async () => {
            mockElasticsearchService.queryData.mockRejectedValue(new Error('Query failed'));
            const reportRequest = {
                type: 'performance',
                name: 'Test Report',
                parameters: {},
                format: shared_1.ReportFormat.JSON,
                organizationId: 'org-1',
                userId: 'user-1'
            };
            const report = await service.generateReport(reportRequest);
            (0, vitest_1.expect)(report.status).toBe(analytics_interface_1.ReportStatus.FAILED);
            (0, vitest_1.expect)(report.error).toContain('Query failed');
        });
    });
    (0, vitest_1.describe)('PDF report generation', () => {
        (0, vitest_1.it)('should generate PDF file for performance report', async () => {
            const mockQueryResult = {
                aggregations: {
                    avg_duration: { value: 2500 },
                    total_executions: { value: 100 },
                    success_rate: {
                        buckets: {
                            successful: { doc_count: 90 },
                            failed: { doc_count: 10 }
                        }
                    },
                    duration_histogram: { buckets: [] }
                }
            };
            mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);
            // Mock PDF generation
            const mockStream = {
                on: vitest_1.vi.fn((event, callback) => {
                    if (event === 'finish') {
                        setTimeout(callback, 10);
                    }
                })
            };
            // Mock fs.createWriteStream
            const mockCreateWriteStream = vitest_1.vi.fn(() => mockStream);
            vitest_1.vi.doMock('fs', () => ({
                createWriteStream: mockCreateWriteStream,
                promises: { mkdir: vitest_1.vi.fn() }
            }));
            const reportRequest = {
                type: 'performance',
                name: 'Test PDF Report',
                parameters: {},
                format: shared_1.ReportFormat.PDF,
                organizationId: 'org-1',
                userId: 'user-1'
            };
            const report = await service.generateReport(reportRequest);
            (0, vitest_1.expect)(report.status).toBe(analytics_interface_1.ReportStatus.COMPLETED);
            (0, vitest_1.expect)(report.filePath).toBeDefined();
            (0, vitest_1.expect)(report.filePath).toContain('.pdf');
        });
    });
    (0, vitest_1.describe)('CSV report generation', () => {
        (0, vitest_1.it)('should generate CSV file for execution summary', async () => {
            const mockQueryResult = {
                hits: {
                    total: { value: 2 },
                    hits: [
                        {
                            _source: {
                                executionId: 'exec-1',
                                workflowId: 'workflow-1',
                                status: 'completed',
                                engineType: 'langflow',
                                duration: 2000,
                                timestamp: new Date().toISOString()
                            }
                        }
                    ]
                }
            };
            mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);
            const reportRequest = {
                type: 'execution-summary',
                name: 'Test CSV Report',
                parameters: {},
                format: shared_1.ReportFormat.CSV,
                organizationId: 'org-1',
                userId: 'user-1'
            };
            const report = await service.generateReport(reportRequest);
            (0, vitest_1.expect)(report.status).toBe(analytics_interface_1.ReportStatus.COMPLETED);
            (0, vitest_1.expect)(report.filePath).toBeDefined();
            (0, vitest_1.expect)(report.filePath).toContain('.csv');
        });
    });
    (0, vitest_1.describe)('HTML report generation', () => {
        (0, vitest_1.it)('should generate HTML file for usage report', async () => {
            const mockQueryResult = {
                aggregations: {
                    total_executions: { value: 100 },
                    unique_users: { value: 10 },
                    unique_workflows: { value: 5 },
                    top_workflows: { buckets: [] },
                    top_users: { buckets: [] },
                    executions_by_engine: { buckets: [] },
                    executions_by_status: { buckets: [] },
                    executions_over_time: { buckets: [] }
                }
            };
            mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);
            fs_1.promises.writeFile.mockResolvedValue(undefined);
            const reportRequest = {
                type: 'usage',
                name: 'Test HTML Report',
                parameters: {},
                format: shared_1.ReportFormat.HTML,
                organizationId: 'org-1',
                userId: 'user-1'
            };
            const report = await service.generateReport(reportRequest);
            (0, vitest_1.expect)(report.status).toBe(analytics_interface_1.ReportStatus.COMPLETED);
            (0, vitest_1.expect)(report.filePath).toBeDefined();
            (0, vitest_1.expect)(report.filePath).toContain('.html');
            (0, vitest_1.expect)(fs_1.promises.writeFile).toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)('getReportTypes', () => {
        (0, vitest_1.it)('should return available report types', () => {
            const reportTypes = service.getReportTypes();
            (0, vitest_1.expect)(reportTypes).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(reportTypes)).toBe(true);
            (0, vitest_1.expect)(reportTypes.length).toBeGreaterThan(0);
            const performanceReport = reportTypes.find(rt => rt.id === 'performance');
            (0, vitest_1.expect)(performanceReport).toBeDefined();
            (0, vitest_1.expect)(performanceReport?.name).toBe('Performance Report');
            (0, vitest_1.expect)(performanceReport?.supportedFormats).toContain(shared_1.ReportFormat.PDF);
            (0, vitest_1.expect)(performanceReport?.supportedFormats).toContain(shared_1.ReportFormat.JSON);
            const usageReport = reportTypes.find(rt => rt.id === 'usage');
            (0, vitest_1.expect)(usageReport).toBeDefined();
            (0, vitest_1.expect)(usageReport?.supportedFormats).toContain(shared_1.ReportFormat.CSV);
            const billingReport = reportTypes.find(rt => rt.id === 'billing');
            (0, vitest_1.expect)(billingReport).toBeDefined();
            const executionReport = reportTypes.find(rt => rt.id === 'execution-summary');
            (0, vitest_1.expect)(executionReport).toBeDefined();
        });
    });
    (0, vitest_1.describe)('error handling', () => {
        (0, vitest_1.it)('should handle file system errors during PDF generation', async () => {
            const mockQueryResult = {
                aggregations: {
                    avg_duration: { value: 2500 },
                    total_executions: { value: 100 },
                    success_rate: { buckets: { successful: { doc_count: 90 }, failed: { doc_count: 10 } } },
                    duration_histogram: { buckets: [] }
                }
            };
            mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);
            // Mock stream error
            const mockStream = {
                on: vitest_1.vi.fn((event, callback) => {
                    if (event === 'error') {
                        setTimeout(() => callback(new Error('File write error')), 10);
                    }
                })
            };
            const mockCreateWriteStream = vitest_1.vi.fn(() => mockStream);
            vitest_1.vi.doMock('fs', () => ({
                createWriteStream: mockCreateWriteStream,
                promises: { mkdir: vitest_1.vi.fn() }
            }));
            const reportRequest = {
                type: 'performance',
                name: 'Test Error Report',
                parameters: {},
                format: shared_1.ReportFormat.PDF,
                organizationId: 'org-1',
                userId: 'user-1'
            };
            const report = await service.generateReport(reportRequest);
            (0, vitest_1.expect)(report.status).toBe(analytics_interface_1.ReportStatus.FAILED);
            (0, vitest_1.expect)(report.error).toBeDefined();
        });
        (0, vitest_1.it)('should handle unsupported report format', async () => {
            const mockQueryResult = {
                aggregations: {
                    avg_duration: { value: 2500 },
                    total_executions: { value: 100 },
                    success_rate: { buckets: { successful: { doc_count: 90 }, failed: { doc_count: 10 } } },
                    duration_histogram: { buckets: [] }
                }
            };
            mockElasticsearchService.queryData.mockResolvedValue(mockQueryResult);
            const reportRequest = {
                type: 'performance',
                name: 'Test Unsupported Format',
                parameters: {},
                format: 'UNSUPPORTED',
                organizationId: 'org-1',
                userId: 'user-1'
            };
            const report = await service.generateReport(reportRequest);
            (0, vitest_1.expect)(report.status).toBe(analytics_interface_1.ReportStatus.FAILED);
            (0, vitest_1.expect)(report.error).toContain('Unsupported report format');
        });
    });
    (0, vitest_1.describe)('cleanup', () => {
        (0, vitest_1.it)('should cleanup successfully', async () => {
            await (0, vitest_1.expect)(service.cleanup()).resolves.not.toThrow();
        });
    });
});
//# sourceMappingURL=report-generator.test.js.map