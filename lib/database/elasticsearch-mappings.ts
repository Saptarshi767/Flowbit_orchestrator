import { ElasticsearchConnection } from './connection'

// Elasticsearch Index Mappings
export const ELASTICSEARCH_INDICES = {
  WORKFLOWS: 'workflows',
  EXECUTIONS: 'executions',
  AUDIT_LOGS: 'audit_logs',
  SYSTEM_METRICS: 'system_metrics',
  MARKETPLACE: 'marketplace'
} as const

// Workflow Search Mapping
export const workflowMapping = {
  properties: {
    id: { type: 'keyword' },
    name: { 
      type: 'text',
      analyzer: 'standard',
      fields: {
        keyword: { type: 'keyword' },
        suggest: { type: 'completion' }
      }
    },
    description: { 
      type: 'text',
      analyzer: 'standard'
    },
    engineType: { type: 'keyword' },
    tags: { type: 'keyword' },
    visibility: { type: 'keyword' },
    organizationId: { type: 'keyword' },
    createdBy: { type: 'keyword' },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
    version: { type: 'integer' },
    definition: {
      type: 'object',
      enabled: false // Store but don't index the full definition
    },
    // Extracted searchable fields from definition
    nodeTypes: { type: 'keyword' },
    integrations: { type: 'keyword' },
    complexity: { type: 'integer' },
    // Marketplace specific fields
    rating: { type: 'float' },
    downloads: { type: 'integer' },
    category: { type: 'keyword' },
    price: { type: 'float' }
  }
} as const

// Execution Logs Mapping
export const executionMapping = {
  properties: {
    id: { type: 'keyword' },
    workflowId: { type: 'keyword' },
    workflowName: { type: 'text' },
    status: { type: 'keyword' },
    startTime: { type: 'date' },
    endTime: { type: 'date' },
    duration: { type: 'long' }, // milliseconds
    userId: { type: 'keyword' },
    organizationId: { type: 'keyword' },
    engineType: { type: 'keyword' },
    executorId: { type: 'keyword' },
    // Log entries
    logs: {
      type: 'nested',
      properties: {
        timestamp: { type: 'date' },
        level: { type: 'keyword' },
        message: { type: 'text' },
        component: { type: 'keyword' },
        nodeId: { type: 'keyword' },
        error: {
          type: 'object',
          properties: {
            type: { type: 'keyword' },
            message: { type: 'text' },
            stack: { type: 'text', index: false }
          }
        }
      }
    },
    // Metrics
    metrics: {
      type: 'object',
      properties: {
        cpuUsage: { type: 'float' },
        memoryUsage: { type: 'long' },
        networkIO: { type: 'long' },
        diskIO: { type: 'long' },
        nodeExecutionTimes: {
          type: 'object',
          dynamic: true
        }
      }
    },
    // Parameters and results (searchable)
    parameterKeys: { type: 'keyword' },
    resultKeys: { type: 'keyword' },
    success: { type: 'boolean' },
    errorType: { type: 'keyword' },
    errorMessage: { type: 'text' }
  }
} as const

// Audit Logs Mapping
export const auditLogMapping = {
  properties: {
    id: { type: 'keyword' },
    userId: { type: 'keyword' },
    userName: { type: 'keyword' },
    organizationId: { type: 'keyword' },
    action: { type: 'keyword' },
    resource: { type: 'keyword' },
    resourceId: { type: 'keyword' },
    timestamp: { type: 'date' },
    ipAddress: { 
      type: 'ip',
      fields: {
        keyword: { type: 'keyword' }
      }
    },
    userAgent: { type: 'text', index: false },
    details: {
      type: 'object',
      dynamic: true
    },
    // Derived fields for analytics
    country: { type: 'keyword' },
    city: { type: 'keyword' },
    deviceType: { type: 'keyword' },
    browser: { type: 'keyword' }
  }
} as const

// System Metrics Mapping
export const systemMetricsMapping = {
  properties: {
    id: { type: 'keyword' },
    name: { type: 'keyword' },
    value: { type: 'double' },
    timestamp: { type: 'date' },
    tags: {
      type: 'object',
      properties: {
        service: { type: 'keyword' },
        environment: { type: 'keyword' },
        region: { type: 'keyword' },
        instance: { type: 'keyword' },
        version: { type: 'keyword' }
      }
    },
    // Time-based aggregations
    '@timestamp': { type: 'date' },
    hour: { type: 'keyword' },
    day: { type: 'keyword' },
    week: { type: 'keyword' },
    month: { type: 'keyword' }
  }
} as const

// Marketplace Items Mapping
export const marketplaceMapping = {
  properties: {
    id: { type: 'keyword' },
    workflowId: { type: 'keyword' },
    title: { 
      type: 'text',
      analyzer: 'standard',
      fields: {
        keyword: { type: 'keyword' },
        suggest: { type: 'completion' }
      }
    },
    description: { 
      type: 'text',
      analyzer: 'standard'
    },
    category: { type: 'keyword' },
    tags: { type: 'keyword' },
    price: { type: 'float' },
    isPublic: { type: 'boolean' },
    downloads: { type: 'integer' },
    rating: { type: 'float' },
    reviewCount: { type: 'integer' },
    publishedBy: { type: 'keyword' },
    publisherName: { type: 'text' },
    publishedAt: { type: 'date' },
    updatedAt: { type: 'date' },
    engineType: { type: 'keyword' },
    complexity: { type: 'keyword' },
    // Content analysis
    nodeCount: { type: 'integer' },
    integrationCount: { type: 'integer' },
    estimatedRuntime: { type: 'integer' }, // minutes
    // Search boost fields
    featured: { type: 'boolean' },
    trending: { type: 'boolean' },
    verified: { type: 'boolean' }
  }
} as const

// Elasticsearch Schema Manager
export class ElasticsearchSchemaManager {
  private client = ElasticsearchConnection.getInstance()
  
  async createIndices(): Promise<void> {
    const workflowSettings = {
      number_of_shards: 2,
      number_of_replicas: 1,
      analysis: {
        analyzer: {
          workflow_analyzer: {
            type: 'custom' as const,
            tokenizer: 'standard',
            filter: ['lowercase', 'stop', 'snowball']
          }
        }
      }
    }

    const executionSettings = {
      number_of_shards: 3,
      number_of_replicas: 1,
      'index.lifecycle.name': 'execution_logs_policy',
      'index.lifecycle.rollover_alias': 'executions'
    }

    const auditLogSettings = {
      number_of_shards: 2,
      number_of_replicas: 1,
      'index.lifecycle.name': 'audit_logs_policy'
    }

    const systemMetricsSettings = {
      number_of_shards: 1,
      number_of_replicas: 1,
      'index.lifecycle.name': 'metrics_policy'
    }

    const marketplaceSettings = {
      number_of_shards: 1,
      number_of_replicas: 1,
      analysis: {
        analyzer: {
          marketplace_analyzer: {
            type: 'custom' as const,
            tokenizer: 'standard',
            filter: ['lowercase', 'stop', 'synonym']
          }
        },
        filter: {
          synonym: {
            type: 'synonym' as const,
            synonyms: [
              'ai,artificial intelligence,machine learning,ml',
              'automation,workflow,process',
              'integration,connector,api'
            ]
          }
        }
      }
    }

    const indices = [
      {
        index: ELASTICSEARCH_INDICES.WORKFLOWS,
        mapping: workflowMapping,
        settings: workflowSettings
      },
      {
        index: ELASTICSEARCH_INDICES.EXECUTIONS,
        mapping: executionMapping,
        settings: executionSettings
      },
      {
        index: ELASTICSEARCH_INDICES.AUDIT_LOGS,
        mapping: auditLogMapping,
        settings: auditLogSettings
      },
      {
        index: ELASTICSEARCH_INDICES.SYSTEM_METRICS,
        mapping: systemMetricsMapping,
        settings: systemMetricsSettings
      },
      {
        index: ELASTICSEARCH_INDICES.MARKETPLACE,
        mapping: marketplaceMapping,
        settings: marketplaceSettings
      }
    ]
    
    for (const { index, mapping, settings } of indices) {
      try {
        const exists = await this.client.indices.exists({ index })
        
        if (!exists) {
          await this.client.indices.create({
            index,
            settings,
            mappings: mapping
          })
          console.log(`Created Elasticsearch index: ${index}`)
        } else {
          // Update mapping if index exists
          await this.client.indices.putMapping({
            index,
            ...mapping
          })
          console.log(`Updated Elasticsearch mapping: ${index}`)
        }
      } catch (error) {
        console.error(`Failed to create/update index ${index}:`, error)
        throw error
      }
    }
  }
  
  async createIndexTemplates(): Promise<void> {
    // Template for time-based indices
    const timeBasedTemplate = {
      name: 'time_based_logs',
      index_patterns: ['executions-*', 'audit-logs-*', 'metrics-*'],
      template: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
          'index.lifecycle.name': 'time_based_policy',
          'index.refresh_interval': '5s'
        }
      }
    }
    
    try {
      await this.client.indices.putIndexTemplate(timeBasedTemplate)
      console.log('Created index template: time_based_logs')
    } catch (error) {
      console.error('Failed to create index template:', error)
      throw error
    }
  }
  
  async createILMPolicies(): Promise<void> {
    const policies = [
      {
        name: 'execution_logs_policy',
        policy: {
          phases: {
            hot: {
              actions: {
                rollover: {
                  max_size: '10GB',
                  max_age: '7d'
                }
              }
            },
            warm: {
              min_age: '7d',
              actions: {
                shrink: {
                  number_of_shards: 1
                }
              }
            },
            cold: {
              min_age: '30d',
              actions: {
                freeze: {}
              }
            },
            delete: {
              min_age: '90d'
            }
          }
        }
      },
      {
        name: 'audit_logs_policy',
        policy: {
          phases: {
            hot: {
              actions: {
                rollover: {
                  max_size: '5GB',
                  max_age: '30d'
                }
              }
            },
            warm: {
              min_age: '30d',
              actions: {
                shrink: {
                  number_of_shards: 1
                }
              }
            },
            delete: {
              min_age: '2555d' // 7 years for compliance
            }
          }
        }
      },
      {
        name: 'metrics_policy',
        policy: {
          phases: {
            hot: {
              actions: {
                rollover: {
                  max_size: '2GB',
                  max_age: '1d'
                }
              }
            },
            warm: {
              min_age: '1d',
              actions: {
                shrink: {
                  number_of_shards: 1
                }
              }
            },
            cold: {
              min_age: '7d'
            },
            delete: {
              min_age: '30d'
            }
          }
        }
      }
    ]
    
    for (const { name, policy } of policies) {
      try {
        await this.client.ilm.putLifecycle({
          name,
          policy
        })
        console.log(`Created ILM policy: ${name}`)
      } catch (error) {
        console.error(`Failed to create ILM policy ${name}:`, error)
        throw error
      }
    }
  }
  
  async setupPipelines(): Promise<void> {
    // Ingest pipeline for enriching audit logs
    const auditLogPipeline = {
      id: 'audit_log_enrichment',
      body: {
        description: 'Enrich audit logs with geo and user agent data',
        processors: [
          {
            geoip: {
              field: 'ipAddress',
              target_field: 'geo',
              ignore_missing: true
            }
          },
          {
            user_agent: {
              field: 'userAgent',
              target_field: 'ua',
              ignore_missing: true
            }
          },
          {
            script: {
              source: `
                if (ctx.geo != null && ctx.geo.country_name != null) {
                  ctx.country = ctx.geo.country_name;
                }
                if (ctx.geo != null && ctx.geo.city_name != null) {
                  ctx.city = ctx.geo.city_name;
                }
                if (ctx.ua != null && ctx.ua.device != null) {
                  ctx.deviceType = ctx.ua.device.name;
                }
                if (ctx.ua != null && ctx.ua.name != null) {
                  ctx.browser = ctx.ua.name;
                }
              `
            }
          }
        ]
      }
    }
    
    // Pipeline for processing execution metrics
    const executionMetricsPipeline = {
      id: 'execution_metrics_processing',
      body: {
        description: 'Process and enrich execution metrics',
        processors: [
          {
            script: {
              source: `
                if (ctx.startTime != null && ctx.endTime != null) {
                  ctx.duration = ZonedDateTime.parse(ctx.endTime).toInstant().toEpochMilli() - 
                                 ZonedDateTime.parse(ctx.startTime).toInstant().toEpochMilli();
                }
                if (ctx.logs != null && ctx.logs.size() > 0) {
                  ctx.success = ctx.logs.stream().noneMatch(log -> log.level == 'ERROR');
                }
              `
            }
          }
        ]
      }
    }
    
    const pipelines = [auditLogPipeline, executionMetricsPipeline]
    
    for (const pipeline of pipelines) {
      try {
        await this.client.ingest.putPipeline({
          id: pipeline.id,
          ...pipeline.body
        })
        console.log(`Created ingest pipeline: ${pipeline.id}`)
      } catch (error) {
        console.error(`Failed to create pipeline ${pipeline.id}:`, error)
        throw error
      }
    }
  }
  
  async initializeSchema(): Promise<void> {
    try {
      console.log('Initializing Elasticsearch schema...')
      
      await this.createILMPolicies()
      await this.createIndexTemplates()
      await this.setupPipelines()
      await this.createIndices()
      
      console.log('Elasticsearch schema initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Elasticsearch schema:', error)
      throw error
    }
  }
  
  async deleteAllIndices(): Promise<void> {
    const indices = Object.values(ELASTICSEARCH_INDICES)
    
    for (const index of indices) {
      try {
        const exists = await this.client.indices.exists({ index })
        if (exists) {
          await this.client.indices.delete({ index })
          console.log(`Deleted index: ${index}`)
        }
      } catch (error) {
        console.error(`Failed to delete index ${index}:`, error)
      }
    }
  }
  
  async getIndexStats(): Promise<any> {
    try {
      const stats = await this.client.indices.stats({
        index: Object.values(ELASTICSEARCH_INDICES).join(',')
      })
      return stats
    } catch (error) {
      console.error('Failed to get index stats:', error)
      return null
    }
  }
}

export const elasticsearchSchema = new ElasticsearchSchemaManager()