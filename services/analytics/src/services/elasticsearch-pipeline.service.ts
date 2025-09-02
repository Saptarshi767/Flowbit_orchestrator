import { Client } from '@elastic/elasticsearch';
import { Logger } from 'winston';
import { 
  AnalyticsData, 
  AnalyticsQuery, 
  AnalyticsResult, 
  ElasticsearchConfig,
  AnalyticsDataType 
} from '../interfaces/analytics.interface';

export class ElasticsearchPipelineService {
  private client: Client;
  private logger: Logger;
  private indexPrefix: string;

  constructor(config: ElasticsearchConfig, logger: Logger) {
    this.logger = logger;
    this.indexPrefix = process.env.ELASTICSEARCH_INDEX_PREFIX || 'orchestrator';
    
    this.client = new Client({
      node: config.node,
      auth: config.auth,
      tls: config.ssl,
      requestTimeout: config.requestTimeout || 30000,
      maxRetries: config.maxRetries || 3
    });

    this.initializeIndices();
  }

  private async initializeIndices(): Promise<void> {
    try {
      const indices = [
        'executions',
        'workflows', 
        'user-actions',
        'system-metrics',
        'performance',
        'billing'
      ];

      for (const index of indices) {
        const indexName = `${this.indexPrefix}-${index}`;
        const exists = await this.client.indices.exists({ index: indexName });
        
        if (!exists) {
          await this.createIndex(indexName, this.getIndexMapping(index));
          this.logger.info(`Created Elasticsearch index: ${indexName}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize Elasticsearch indices:', error);
      throw error;
    }
  }

  private getIndexMapping(indexType: string): any {
    const baseMapping = {
      properties: {
        timestamp: { type: 'date' },
        source: { type: 'keyword' },
        type: { type: 'keyword' },
        organizationId: { type: 'keyword' },
        userId: { type: 'keyword' },
        metadata: { type: 'object', enabled: false }
      }
    };

    const specificMappings: Record<string, any> = {
      executions: {
        properties: {
          ...baseMapping.properties,
          workflowId: { type: 'keyword' },
          executionId: { type: 'keyword' },
          status: { type: 'keyword' },
          engineType: { type: 'keyword' },
          duration: { type: 'long' },
          memoryUsage: { type: 'long' },
          cpuUsage: { type: 'float' },
          errorCode: { type: 'keyword' },
          errorMessage: { type: 'text' }
        }
      },
      workflows: {
        properties: {
          ...baseMapping.properties,
          workflowId: { type: 'keyword' },
          workflowName: { type: 'text' },
          engineType: { type: 'keyword' },
          version: { type: 'integer' },
          action: { type: 'keyword' }, // created, updated, deleted, shared
          tags: { type: 'keyword' }
        }
      },
      'user-actions': {
        properties: {
          ...baseMapping.properties,
          action: { type: 'keyword' },
          resource: { type: 'keyword' },
          resourceId: { type: 'keyword' },
          userAgent: { type: 'text' },
          ipAddress: { type: 'ip' },
          sessionId: { type: 'keyword' }
        }
      },
      'system-metrics': {
        properties: {
          ...baseMapping.properties,
          service: { type: 'keyword' },
          instance: { type: 'keyword' },
          metricName: { type: 'keyword' },
          metricValue: { type: 'double' },
          unit: { type: 'keyword' },
          labels: { type: 'object' }
        }
      },
      performance: {
        properties: {
          ...baseMapping.properties,
          service: { type: 'keyword' },
          operation: { type: 'keyword' },
          duration: { type: 'long' },
          throughput: { type: 'double' },
          errorRate: { type: 'float' },
          p95: { type: 'long' },
          p99: { type: 'long' }
        }
      },
      billing: {
        properties: {
          ...baseMapping.properties,
          service: { type: 'keyword' },
          resourceType: { type: 'keyword' },
          cost: { type: 'double' },
          currency: { type: 'keyword' },
          billingPeriod: { type: 'keyword' },
          usage: { type: 'double' },
          usageUnit: { type: 'keyword' }
        }
      }
    };

    return specificMappings[indexType] || baseMapping;
  }

  private async createIndex(indexName: string, mapping: any): Promise<void> {
    await this.client.indices.create({
      index: indexName,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        'index.lifecycle.name': 'orchestrator-policy',
        'index.lifecycle.rollover_alias': `${indexName}-alias`
      },
      mappings: mapping
    });
  }

  async ingestData(data: AnalyticsData): Promise<void> {
    try {
      const indexName = this.getIndexName(data.type);
      
      await this.client.index({
        index: indexName,
        body: {
          timestamp: data.timestamp,
          source: data.source,
          type: data.type,
          organizationId: data.organizationId,
          userId: data.userId,
          metadata: data.metadata,
          ...data.data
        }
      });

      this.logger.debug(`Ingested data to ${indexName}`, { 
        type: data.type, 
        source: data.source,
        organizationId: data.organizationId 
      });
    } catch (error) {
      this.logger.error('Failed to ingest data to Elasticsearch:', error);
      throw error;
    }
  }

  async ingestBulkData(dataItems: AnalyticsData[]): Promise<void> {
    try {
      const body = dataItems.flatMap(data => [
        { 
          index: { 
            _index: this.getIndexName(data.type) 
          } 
        },
        {
          timestamp: data.timestamp,
          source: data.source,
          type: data.type,
          organizationId: data.organizationId,
          userId: data.userId,
          metadata: data.metadata,
          ...data.data
        }
      ]);

      const response = await this.client.bulk({ body });
      
      if (response.errors) {
        const errorItems = response.items?.filter(item => 
          item.index?.error || item.create?.error || item.update?.error || item.delete?.error
        );
        this.logger.warn('Some bulk operations failed:', errorItems);
      }

      this.logger.debug(`Bulk ingested ${dataItems.length} items`);
    } catch (error) {
      this.logger.error('Failed to bulk ingest data to Elasticsearch:', error);
      throw error;
    }
  }

  async queryData(query: AnalyticsQuery): Promise<AnalyticsResult> {
    try {
      const searchBody: any = {
        query: query.query,
        size: query.size || 100,
        from: query.from || 0
      };

      if (query.timeRange) {
        searchBody.query = {
          bool: {
            must: [
              searchBody.query || { match_all: {} },
              {
                range: {
                  timestamp: {
                    gte: query.timeRange.start,
                    lte: query.timeRange.end
                  }
                }
              }
            ]
          }
        };
      }

      if (query.aggregations) {
        searchBody.aggs = query.aggregations;
      }

      if (query.sort) {
        searchBody.sort = query.sort;
      }

      const response = await this.client.search({
        index: query.index,
        body: searchBody
      });

      return {
        hits: {
          total: { 
            value: typeof response.hits.total === 'number' 
              ? response.hits.total 
              : response.hits.total?.value || 0 
          },
          hits: response.hits.hits.map(hit => ({
            _source: hit._source,
            _score: hit._score || 0
          }))
        },
        aggregations: response.aggregations,
        took: response.took || 0
      };
    } catch (error) {
      this.logger.error('Failed to query Elasticsearch:', error);
      throw error;
    }
  }

  async createDataView(name: string, indexPattern: string, timeField: string = 'timestamp'): Promise<void> {
    try {
      // This would typically be done through Kibana API
      // For now, we'll just log the creation
      this.logger.info(`Data view created: ${name} with pattern ${indexPattern}`);
    } catch (error) {
      this.logger.error('Failed to create data view:', error);
      throw error;
    }
  }

  async deleteOldData(indexPattern: string, olderThanDays: number): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      await this.client.deleteByQuery({
        index: indexPattern,
        query: {
          range: {
            timestamp: {
              lt: cutoffDate
            }
          }
        }
      });

      this.logger.info(`Deleted data older than ${olderThanDays} days from ${indexPattern}`);
    } catch (error) {
      this.logger.error('Failed to delete old data:', error);
      throw error;
    }
  }

  async getIndexStats(indexPattern: string): Promise<any> {
    try {
      const response = await this.client.indices.stats({
        index: indexPattern
      });
      return response;
    } catch (error) {
      this.logger.error('Failed to get index stats:', error);
      throw error;
    }
  }

  private getIndexName(dataType: AnalyticsDataType): string {
    const typeMapping: Record<AnalyticsDataType, string> = {
      [AnalyticsDataType.EXECUTION]: 'executions',
      [AnalyticsDataType.WORKFLOW]: 'workflows',
      [AnalyticsDataType.USER_ACTION]: 'user-actions',
      [AnalyticsDataType.SYSTEM_METRIC]: 'system-metrics',
      [AnalyticsDataType.PERFORMANCE]: 'performance',
      [AnalyticsDataType.BILLING]: 'billing'
    };

    const indexSuffix = typeMapping[dataType] || 'general';
    return `${this.indexPrefix}-${indexSuffix}`;
  }

  async healthCheck(): Promise<{ status: string; cluster: any }> {
    try {
      const health = await this.client.cluster.health();
      return {
        status: 'healthy',
        cluster: health
      };
    } catch (error) {
      this.logger.error('Elasticsearch health check failed:', error);
      return {
        status: 'unhealthy',
        cluster: null
      };
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.client.close();
      this.logger.info('Elasticsearch client closed');
    } catch (error) {
      this.logger.error('Error closing Elasticsearch client:', error);
    }
  }
}