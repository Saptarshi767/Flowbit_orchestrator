/**
 * Database Configuration
 * Centralized configuration for all database connections
 */

export interface DatabaseConfig {
  postgresql: {
    url: string
    maxConnections: number
    connectionTimeout: number
    idleTimeout: number
    ssl: boolean
  }
  redis: {
    url: string
    maxRetries: number
    retryDelayOnFailover: number
    connectTimeout: number
    lazyConnect: boolean
    maxMemoryPolicy: string
  }
  elasticsearch: {
    url: string
    username?: string
    password?: string
    maxRetries: number
    requestTimeout: number
    sniffOnStart: boolean
    apiVersion: string
  }
}

export const getDatabaseConfig = (): DatabaseConfig => {
  return {
    postgresql: {
      url: process.env.DATABASE_URL || 'postgresql://localhost:5432/orchestrator',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '60000'),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '600000'),
      ssl: process.env.DB_SSL === 'true'
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '60000'),
      lazyConnect: process.env.REDIS_LAZY_CONNECT !== 'false',
      maxMemoryPolicy: process.env.REDIS_MAX_MEMORY_POLICY || 'allkeys-lru'
    },
    elasticsearch: {
      url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD,
      maxRetries: parseInt(process.env.ES_MAX_RETRIES || '5'),
      requestTimeout: parseInt(process.env.ES_REQUEST_TIMEOUT || '60000'),
      sniffOnStart: process.env.ES_SNIFF_ON_START === 'true',
      apiVersion: process.env.ES_API_VERSION || '8.11'
    }
  }
}

export const validateDatabaseConfig = (config: DatabaseConfig): string[] => {
  const errors: string[] = []
  
  // Validate PostgreSQL config
  if (!config.postgresql.url) {
    errors.push('PostgreSQL URL is required')
  }
  
  if (config.postgresql.maxConnections < 1) {
    errors.push('PostgreSQL max connections must be at least 1')
  }
  
  // Validate Redis config
  if (!config.redis.url) {
    errors.push('Redis URL is required')
  }
  
  if (config.redis.maxRetries < 0) {
    errors.push('Redis max retries must be non-negative')
  }
  
  // Validate Elasticsearch config
  if (!config.elasticsearch.url) {
    errors.push('Elasticsearch URL is required')
  }
  
  if (config.elasticsearch.maxRetries < 0) {
    errors.push('Elasticsearch max retries must be non-negative')
  }
  
  return errors
}

// Environment-specific configurations
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development'
  
  const baseConfig = getDatabaseConfig()
  
  switch (env) {
    case 'production':
      return {
        ...baseConfig,
        postgresql: {
          ...baseConfig.postgresql,
          ssl: true,
          maxConnections: 50
        },
        redis: {
          ...baseConfig.redis,
          maxRetries: 5
        },
        elasticsearch: {
          ...baseConfig.elasticsearch,
          maxRetries: 10,
          sniffOnStart: true
        }
      }
    
    case 'testing':
      return {
        ...baseConfig,
        postgresql: {
          ...baseConfig.postgresql,
          url: process.env.TEST_DATABASE_URL || baseConfig.postgresql.url,
          maxConnections: 5
        },
        redis: {
          ...baseConfig.redis,
          url: process.env.TEST_REDIS_URL || baseConfig.redis.url
        },
        elasticsearch: {
          ...baseConfig.elasticsearch,
          url: process.env.TEST_ELASTICSEARCH_URL || baseConfig.elasticsearch.url
        }
      }
    
    case 'development':
    default:
      return baseConfig
  }
}

// Connection pool settings
export const CONNECTION_POOL_CONFIG = {
  postgresql: {
    min: 2,
    max: 20,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 600000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200
  },
  redis: {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
    lazyConnect: true
  }
}

// Health check intervals (in milliseconds)
export const HEALTH_CHECK_CONFIG = {
  interval: 30000, // 30 seconds
  timeout: 5000,   // 5 seconds
  retries: 3
}

// Migration settings
export const MIGRATION_CONFIG = {
  tableName: '_migration_history',
  directory: 'prisma/migrations',
  timeout: 300000, // 5 minutes
  lockTimeout: 60000 // 1 minute
}

// Cache settings
export const CACHE_CONFIG = {
  defaultTTL: 3600, // 1 hour
  maxSize: 1000,
  checkPeriod: 600, // 10 minutes
  useClones: false
}

// Elasticsearch index settings
export const ELASTICSEARCH_CONFIG = {
  indices: {
    workflows: {
      numberOfShards: 2,
      numberOfReplicas: 1,
      refreshInterval: '5s'
    },
    executions: {
      numberOfShards: 3,
      numberOfReplicas: 1,
      refreshInterval: '1s'
    },
    auditLogs: {
      numberOfShards: 2,
      numberOfReplicas: 1,
      refreshInterval: '30s'
    },
    systemMetrics: {
      numberOfShards: 1,
      numberOfReplicas: 1,
      refreshInterval: '10s'
    },
    marketplace: {
      numberOfShards: 1,
      numberOfReplicas: 1,
      refreshInterval: '60s'
    }
  },
  ilm: {
    executionLogs: {
      hotPhase: { maxSize: '10GB', maxAge: '7d' },
      warmPhase: { minAge: '7d' },
      coldPhase: { minAge: '30d' },
      deletePhase: { minAge: '90d' }
    },
    auditLogs: {
      hotPhase: { maxSize: '5GB', maxAge: '30d' },
      warmPhase: { minAge: '30d' },
      deletePhase: { minAge: '2555d' } // 7 years
    },
    metrics: {
      hotPhase: { maxSize: '2GB', maxAge: '1d' },
      warmPhase: { minAge: '1d' },
      coldPhase: { minAge: '7d' },
      deletePhase: { minAge: '30d' }
    }
  }
}