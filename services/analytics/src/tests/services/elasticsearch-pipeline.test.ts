import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Client } from '@elastic/elasticsearch';
import winston from 'winston';
import { ElasticsearchPipelineService } from '../../services/elasticsearch-pipeline.service';
import { AnalyticsData, AnalyticsDataType } from '../../interfaces/analytics.interface';

// Mock Elasticsearch client
vi.mock('@elastic/elasticsearch');

describe('ElasticsearchPipelineService', () => {
  let service: ElasticsearchPipelineService;
  let mockClient: any;
  let logger: winston.Logger;

  beforeEach(() => {
    // Create mock client
    mockClient = {
      indices: {
        exists: vi.fn(),
        create: vi.fn(),
        stats: vi.fn()
      },
      index: vi.fn(),
      bulk: vi.fn(),
      search: vi.fn(),
      deleteByQuery: vi.fn(),
      cluster: {
        health: vi.fn()
      },
      close: vi.fn()
    };

    // Mock the Client constructor
    (Client as any).mockImplementation(() => mockClient);

    // Create test logger
    logger = winston.createLogger({
      level: 'error',
      transports: [new winston.transports.Console({ silent: true })]
    });

    const config = {
      node: 'http://localhost:9200',
      requestTimeout: 30000,
      maxRetries: 3
    };

    service = new ElasticsearchPipelineService(config, logger);
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(Client).toHaveBeenCalledWith({
        node: 'http://localhost:9200',
        auth: undefined,
        ssl: undefined,
        requestTimeout: 30000,
        maxRetries: 3
      });
    });

    it('should create indices on initialization', async () => {
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({});

      // Re-initialize to trigger index creation
      const newService = new ElasticsearchPipelineService({
        node: 'http://localhost:9200'
      }, logger);

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockClient.indices.exists).toHaveBeenCalled();
      expect(mockClient.indices.create).toHaveBeenCalled();
    });
  });

  describe('ingestData', () => {
    it('should ingest execution data successfully', async () => {
      mockClient.index.mockResolvedValue({ _id: 'test-id' });

      const data: AnalyticsData = {
        timestamp: new Date(),
        source: 'test',
        type: AnalyticsDataType.EXECUTION,
        organizationId: 'org-1',
        userId: 'user-1',
        data: {
          executionId: 'exec-1',
          workflowId: 'workflow-1',
          status: 'completed'
        }
      };

      await service.ingestData(data);

      expect(mockClient.index).toHaveBeenCalledWith({
        index: 'orchestrator-executions',
        body: expect.objectContaining({
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

    it('should handle ingestion errors', async () => {
      mockClient.index.mockRejectedValue(new Error('Elasticsearch error'));

      const data: AnalyticsData = {
        timestamp: new Date(),
        source: 'test',
        type: AnalyticsDataType.EXECUTION,
        organizationId: 'org-1',
        data: {}
      };

      await expect(service.ingestData(data)).rejects.toThrow('Elasticsearch error');
    });
  });

  describe('ingestBulkData', () => {
    it('should ingest multiple items successfully', async () => {
      mockClient.bulk.mockResolvedValue({ errors: false, items: [] });

      const dataItems: AnalyticsData[] = [
        {
          timestamp: new Date(),
          source: 'test',
          type: AnalyticsDataType.EXECUTION,
          organizationId: 'org-1',
          data: { executionId: 'exec-1' }
        },
        {
          timestamp: new Date(),
          source: 'test',
          type: AnalyticsDataType.WORKFLOW,
          organizationId: 'org-1',
          data: { workflowId: 'workflow-1' }
        }
      ];

      await service.ingestBulkData(dataItems);

      expect(mockClient.bulk).toHaveBeenCalledWith({
        body: expect.arrayContaining([
          { index: { _index: 'orchestrator-executions' } },
          expect.objectContaining({ executionId: 'exec-1' }),
          { index: { _index: 'orchestrator-workflows' } },
          expect.objectContaining({ workflowId: 'workflow-1' })
        ])
      });
    });

    it('should handle bulk ingestion with some errors', async () => {
      mockClient.bulk.mockResolvedValue({
        errors: true,
        items: [
          { index: { error: { reason: 'Document already exists' } } },
          { index: { _id: 'success-id' } }
        ]
      });

      const dataItems: AnalyticsData[] = [
        {
          timestamp: new Date(),
          source: 'test',
          type: AnalyticsDataType.EXECUTION,
          organizationId: 'org-1',
          data: { executionId: 'exec-1' }
        }
      ];

      // Should not throw, but should log warnings
      await expect(service.ingestBulkData(dataItems)).resolves.not.toThrow();
    });
  });

  describe('queryData', () => {
    it('should execute query successfully', async () => {
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

      expect(result).toEqual({
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

      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'orchestrator-executions',
        body: {
          query: { match_all: {} },
          size: 10,
          from: 0
        }
      });
    });

    it('should add time range filter when provided', async () => {
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

      expect(mockClient.search).toHaveBeenCalledWith({
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

    it('should handle query errors', async () => {
      mockClient.search.mockRejectedValue(new Error('Query failed'));

      const query = {
        index: 'orchestrator-executions',
        query: { match_all: {} }
      };

      await expect(service.queryData(query)).rejects.toThrow('Query failed');
    });
  });

  describe('deleteOldData', () => {
    it('should delete old data successfully', async () => {
      mockClient.deleteByQuery.mockResolvedValue({ deleted: 100 });

      await service.deleteOldData('orchestrator-*', 30);

      expect(mockClient.deleteByQuery).toHaveBeenCalledWith({
        index: 'orchestrator-*',
        body: {
          query: {
            range: {
              timestamp: {
                lt: expect.any(Date)
              }
            }
          }
        }
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const mockHealth = {
        cluster_name: 'test-cluster',
        status: 'green',
        number_of_nodes: 1
      };

      mockClient.cluster.health.mockResolvedValue(mockHealth);

      const result = await service.healthCheck();

      expect(result).toEqual({
        status: 'healthy',
        cluster: mockHealth
      });
    });

    it('should return unhealthy status on error', async () => {
      mockClient.cluster.health.mockRejectedValue(new Error('Connection failed'));

      const result = await service.healthCheck();

      expect(result).toEqual({
        status: 'unhealthy',
        cluster: null
      });
    });
  });

  describe('cleanup', () => {
    it('should close client connection', async () => {
      mockClient.close.mockResolvedValue({});

      await service.cleanup();

      expect(mockClient.close).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockClient.close.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(service.cleanup()).resolves.not.toThrow();
    });
  });

  describe('getIndexStats', () => {
    it('should return index statistics', async () => {
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

      expect(result).toEqual(mockStats);
      expect(mockClient.indices.stats).toHaveBeenCalledWith({
        index: 'orchestrator-*'
      });
    });
  });
});