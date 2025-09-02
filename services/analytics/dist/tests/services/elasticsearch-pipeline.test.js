"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const elasticsearch_1 = require("@elastic/elasticsearch");
const winston_1 = __importDefault(require("winston"));
const elasticsearch_pipeline_service_1 = require("../../services/elasticsearch-pipeline.service");
const analytics_interface_1 = require("../../interfaces/analytics.interface");
// Mock Elasticsearch client
vitest_1.vi.mock('@elastic/elasticsearch');
(0, vitest_1.describe)('ElasticsearchPipelineService', () => {
    let service;
    let mockClient;
    let logger;
    (0, vitest_1.beforeEach)(() => {
        // Create mock client
        mockClient = {
            indices: {
                exists: vitest_1.vi.fn(),
                create: vitest_1.vi.fn(),
                stats: vitest_1.vi.fn()
            },
            index: vitest_1.vi.fn(),
            bulk: vitest_1.vi.fn(),
            search: vitest_1.vi.fn(),
            deleteByQuery: vitest_1.vi.fn(),
            cluster: {
                health: vitest_1.vi.fn()
            },
            close: vitest_1.vi.fn()
        };
        // Mock the Client constructor
        elasticsearch_1.Client.mockImplementation(() => mockClient);
        // Create test logger
        logger = winston_1.default.createLogger({
            level: 'error',
            transports: [new winston_1.default.transports.Console({ silent: true })]
        });
        const config = {
            node: 'http://localhost:9200',
            requestTimeout: 30000,
            maxRetries: 3
        };
        service = new elasticsearch_pipeline_service_1.ElasticsearchPipelineService(config, logger);
    });
    (0, vitest_1.describe)('initialization', () => {
        (0, vitest_1.it)('should initialize with correct configuration', () => {
            (0, vitest_1.expect)(elasticsearch_1.Client).toHaveBeenCalledWith({
                node: 'http://localhost:9200',
                auth: undefined,
                ssl: undefined,
                requestTimeout: 30000,
                maxRetries: 3
            });
        });
        (0, vitest_1.it)('should create indices on initialization', async () => {
            mockClient.indices.exists.mockResolvedValue(false);
            mockClient.indices.create.mockResolvedValue({});
            // Re-initialize to trigger index creation
            const newService = new elasticsearch_pipeline_service_1.ElasticsearchPipelineService({
                node: 'http://localhost:9200'
            }, logger);
            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 100));
            (0, vitest_1.expect)(mockClient.indices.exists).toHaveBeenCalled();
            (0, vitest_1.expect)(mockClient.indices.create).toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)('ingestData', () => {
        (0, vitest_1.it)('should ingest execution data successfully', async () => {
            mockClient.index.mockResolvedValue({ _id: 'test-id' });
            const data = {
                timestamp: new Date(),
                source: 'test',
                type: analytics_interface_1.AnalyticsDataType.EXECUTION,
                organizationId: 'org-1',
                userId: 'user-1',
                data: {
                    executionId: 'exec-1',
                    workflowId: 'workflow-1',
                    status: 'completed'
                }
            };
            await service.ingestData(data);
            (0, vitest_1.expect)(mockClient.index).toHaveBeenCalledWith({
                index: 'orchestrator-executions',
                body: vitest_1.expect.objectContaining({
                    timestamp: data.timestamp,
                    source: data.source,
                    type: data.type,
                    organizationId: data.organizationId,
                    userId: data.userId,
                    executionId: 'exec-1',
                    workflowId: 'workflow-1',
                    status: 'completed'
                })
            });
        });
        (0, vitest_1.it)('should handle ingestion errors', async () => {
            mockClient.index.mockRejectedValue(new Error('Elasticsearch error'));
            const data = {
                timestamp: new Date(),
                source: 'test',
                type: analytics_interface_1.AnalyticsDataType.EXECUTION,
                organizationId: 'org-1',
                data: {}
            };
            await (0, vitest_1.expect)(service.ingestData(data)).rejects.toThrow('Elasticsearch error');
        });
    });
    (0, vitest_1.describe)('ingestBulkData', () => {
        (0, vitest_1.it)('should ingest multiple items successfully', async () => {
            mockClient.bulk.mockResolvedValue({ errors: false, items: [] });
            const dataItems = [
                {
                    timestamp: new Date(),
                    source: 'test',
                    type: analytics_interface_1.AnalyticsDataType.EXECUTION,
                    organizationId: 'org-1',
                    data: { executionId: 'exec-1' }
                },
                {
                    timestamp: new Date(),
                    source: 'test',
                    type: analytics_interface_1.AnalyticsDataType.WORKFLOW,
                    organizationId: 'org-1',
                    data: { workflowId: 'workflow-1' }
                }
            ];
            await service.ingestBulkData(dataItems);
            (0, vitest_1.expect)(mockClient.bulk).toHaveBeenCalledWith({
                body: vitest_1.expect.arrayContaining([
                    { index: { _index: 'orchestrator-executions' } },
                    vitest_1.expect.objectContaining({ executionId: 'exec-1' }),
                    { index: { _index: 'orchestrator-workflows' } },
                    vitest_1.expect.objectContaining({ workflowId: 'workflow-1' })
                ])
            });
        });
        (0, vitest_1.it)('should handle bulk ingestion with some errors', async () => {
            mockClient.bulk.mockResolvedValue({
                errors: true,
                items: [
                    { index: { error: { reason: 'Document already exists' } } },
                    { index: { _id: 'success-id' } }
                ]
            });
            const dataItems = [
                {
                    timestamp: new Date(),
                    source: 'test',
                    type: analytics_interface_1.AnalyticsDataType.EXECUTION,
                    organizationId: 'org-1',
                    data: { executionId: 'exec-1' }
                }
            ];
            // Should not throw, but should log warnings
            await (0, vitest_1.expect)(service.ingestBulkData(dataItems)).resolves.not.toThrow();
        });
    });
    (0, vitest_1.describe)('queryData', () => {
        (0, vitest_1.it)('should execute query successfully', async () => {
            const mockResponse = {
                hits: {
                    total: { value: 10 },
                    hits: [
                        { _source: { executionId: 'exec-1' }, _score: 1.0 },
                        { _source: { executionId: 'exec-2' }, _score: 0.8 }
                    ]
                },
                aggregations: {
                    status_breakdown: {
                        buckets: [
                            { key: 'completed', doc_count: 8 },
                            { key: 'failed', doc_count: 2 }
                        ]
                    }
                },
                took: 15
            };
            mockClient.search.mockResolvedValue(mockResponse);
            const query = {
                index: 'orchestrator-executions',
                query: { match_all: {} },
                size: 10
            };
            const result = await service.queryData(query);
            (0, vitest_1.expect)(result).toEqual({
                hits: {
                    total: { value: 10 },
                    hits: [
                        { _source: { executionId: 'exec-1' }, _score: 1.0 },
                        { _source: { executionId: 'exec-2' }, _score: 0.8 }
                    ]
                },
                aggregations: mockResponse.aggregations,
                took: 15
            });
            (0, vitest_1.expect)(mockClient.search).toHaveBeenCalledWith({
                index: 'orchestrator-executions',
                body: {
                    query: { match_all: {} },
                    size: 10,
                    from: 0
                }
            });
        });
        (0, vitest_1.it)('should add time range filter when provided', async () => {
            mockClient.search.mockResolvedValue({
                hits: { total: { value: 0 }, hits: [] },
                took: 5
            });
            const timeRange = {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-02')
            };
            const query = {
                index: 'orchestrator-executions',
                query: { match_all: {} },
                timeRange
            };
            await service.queryData(query);
            (0, vitest_1.expect)(mockClient.search).toHaveBeenCalledWith({
                index: 'orchestrator-executions',
                body: {
                    query: {
                        bool: {
                            must: [
                                { match_all: {} },
                                {
                                    range: {
                                        timestamp: {
                                            gte: timeRange.start,
                                            lte: timeRange.end
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    size: 100,
                    from: 0
                }
            });
        });
        (0, vitest_1.it)('should handle query errors', async () => {
            mockClient.search.mockRejectedValue(new Error('Query failed'));
            const query = {
                index: 'orchestrator-executions',
                query: { match_all: {} }
            };
            await (0, vitest_1.expect)(service.queryData(query)).rejects.toThrow('Query failed');
        });
    });
    (0, vitest_1.describe)('deleteOldData', () => {
        (0, vitest_1.it)('should delete old data successfully', async () => {
            mockClient.deleteByQuery.mockResolvedValue({ deleted: 100 });
            await service.deleteOldData('orchestrator-*', 30);
            (0, vitest_1.expect)(mockClient.deleteByQuery).toHaveBeenCalledWith({
                index: 'orchestrator-*',
                body: {
                    query: {
                        range: {
                            timestamp: {
                                lt: vitest_1.expect.any(Date)
                            }
                        }
                    }
                }
            });
        });
    });
    (0, vitest_1.describe)('healthCheck', () => {
        (0, vitest_1.it)('should return healthy status', async () => {
            const mockHealth = {
                cluster_name: 'test-cluster',
                status: 'green',
                number_of_nodes: 1
            };
            mockClient.cluster.health.mockResolvedValue(mockHealth);
            const result = await service.healthCheck();
            (0, vitest_1.expect)(result).toEqual({
                status: 'healthy',
                cluster: mockHealth
            });
        });
        (0, vitest_1.it)('should return unhealthy status on error', async () => {
            mockClient.cluster.health.mockRejectedValue(new Error('Connection failed'));
            const result = await service.healthCheck();
            (0, vitest_1.expect)(result).toEqual({
                status: 'unhealthy',
                cluster: null
            });
        });
    });
    (0, vitest_1.describe)('cleanup', () => {
        (0, vitest_1.it)('should close client connection', async () => {
            mockClient.close.mockResolvedValue({});
            await service.cleanup();
            (0, vitest_1.expect)(mockClient.close).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should handle cleanup errors gracefully', async () => {
            mockClient.close.mockRejectedValue(new Error('Close failed'));
            // Should not throw
            await (0, vitest_1.expect)(service.cleanup()).resolves.not.toThrow();
        });
    });
    (0, vitest_1.describe)('getIndexStats', () => {
        (0, vitest_1.it)('should return index statistics', async () => {
            const mockStats = {
                indices: {
                    'orchestrator-executions': {
                        total: {
                            docs: { count: 1000 },
                            store: { size_in_bytes: 1024000 }
                        }
                    }
                }
            };
            mockClient.indices.stats.mockResolvedValue(mockStats);
            const result = await service.getIndexStats('orchestrator-*');
            (0, vitest_1.expect)(result).toEqual(mockStats);
            (0, vitest_1.expect)(mockClient.indices.stats).toHaveBeenCalledWith({
                index: 'orchestrator-*'
            });
        });
    });
});
//# sourceMappingURL=elasticsearch-pipeline.test.js.map