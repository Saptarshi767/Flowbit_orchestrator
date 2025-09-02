import { ConnectionManager } from './connection'
import { SchemaInitializationManager } from './migrations'
import { redisSchema } from './redis-schema'
import { elasticsearchSchema } from './elasticsearch-mappings'

/**
 * Database Initialization Script
 * Initializes all database schemas and connections for the AI Orchestrator
 */

export interface InitializationOptions {
  skipRedis?: boolean
  skipElasticsearch?: boolean
  force?: boolean
  verbose?: boolean
}

export interface InitializationResult {
  success: boolean
  postgresql: boolean
  redis: boolean
  elasticsearch: boolean
  errors: string[]
  warnings: string[]
}

export class DatabaseInitializer {
  private options: InitializationOptions
  private result: InitializationResult

  constructor(options: InitializationOptions = {}) {
    this.options = options
    this.result = {
      success: false,
      postgresql: false,
      redis: false,
      elasticsearch: false,
      errors: [],
      warnings: []
    }
  }

  async initialize(): Promise<InitializationResult> {
    this.log('Starting database initialization...')

    try {
      // Initialize connection manager first
      await this.initializeConnections()

      // Initialize PostgreSQL schema
      await this.initializePostgreSQL()

      // Initialize Redis schema
      if (!this.options.skipRedis) {
        await this.initializeRedis()
      } else {
        this.result.warnings.push('Redis initialization skipped')
      }

      // Initialize Elasticsearch schema
      if (!this.options.skipElasticsearch) {
        await this.initializeElasticsearch()
      } else {
        this.result.warnings.push('Elasticsearch initialization skipped')
      }

      // Verify all connections
      await this.verifyConnections()

      this.result.success = this.result.postgresql && 
                           (this.options.skipRedis || this.result.redis) &&
                           (this.options.skipElasticsearch || this.result.elasticsearch)

      this.log(`Database initialization ${this.result.success ? 'completed successfully' : 'completed with errors'}`)
      
      return this.result
    } catch (error) {
      this.result.errors.push(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`)
      this.log(`Database initialization failed: ${error}`)
      return this.result
    }
  }

  private async initializeConnections(): Promise<void> {
    try {
      await ConnectionManager.initialize()
      this.log('Connection manager initialized')
    } catch (error) {
      throw new Error(`Failed to initialize connection manager: ${error}`)
    }
  }

  private async initializePostgreSQL(): Promise<void> {
    try {
      this.log('Initializing PostgreSQL schema...')
      
      const schemaManager = new SchemaInitializationManager()
      await schemaManager.initializeAllSchemas()
      
      this.result.postgresql = true
      this.log('PostgreSQL schema initialized successfully')
    } catch (error) {
      this.result.errors.push(`PostgreSQL initialization failed: ${error instanceof Error ? error.message : String(error)}`)
      this.log(`PostgreSQL initialization failed: ${error}`)
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.log('Initializing Redis schema...')
      
      // Test Redis connection
      const redis = ConnectionManager.getRedis()
      await redis.ping()
      
      // Set up Redis configurations
      await redis.config('SET', 'maxmemory-policy', 'allkeys-lru')
      
      // Clean up any expired sessions
      await redisSchema.cleanupExpiredSessions()
      
      // Initialize any required Redis structures
      await this.setupRedisStructures()
      
      this.result.redis = true
      this.log('Redis schema initialized successfully')
    } catch (error) {
      this.result.errors.push(`Redis initialization failed: ${error instanceof Error ? error.message : String(error)}`)
      this.log(`Redis initialization failed: ${error}`)
    }
  }

  private async initializeElasticsearch(): Promise<void> {
    try {
      this.log('Initializing Elasticsearch schema...')
      
      await elasticsearchSchema.initializeSchema()
      
      this.result.elasticsearch = true
      this.log('Elasticsearch schema initialized successfully')
    } catch (error) {
      this.result.errors.push(`Elasticsearch initialization failed: ${error instanceof Error ? error.message : String(error)}`)
      this.log(`Elasticsearch initialization failed: ${error}`)
    }
  }

  private async setupRedisStructures(): Promise<void> {
    const redis = ConnectionManager.getRedis()
    
    // Initialize execution queue if it doesn't exist
    const queueExists = await redis.exists('queue:executions')
    if (!queueExists) {
      await redis.zAdd('queue:executions', { score: 0, value: 'init' })
      await redis.zRem('queue:executions', 'init')
    }
    
    // Set up any default configurations
    await redis.hSet('config:system', {
      'max_concurrent_executions': '10',
      'default_execution_timeout': '3600',
      'session_timeout': '86400'
    })
  }

  private async verifyConnections(): Promise<void> {
    this.log('Verifying database connections...')
    
    const health = await ConnectionManager.healthCheck()
    
    if (!health.database) {
      this.result.errors.push('PostgreSQL health check failed')
    }
    
    if (!this.options.skipRedis && !health.redis) {
      this.result.errors.push('Redis health check failed')
    }
    
    if (!this.options.skipElasticsearch && !health.elasticsearch) {
      this.result.errors.push('Elasticsearch health check failed')
    }
    
    this.log(`Health check results: DB=${health.database}, Redis=${health.redis}, ES=${health.elasticsearch}`)
  }

  private log(message: string): void {
    if (this.options.verbose !== false) {
      console.log(`[DB Init] ${message}`)
    }
  }
}

// CLI interface for database initialization
export async function initializeDatabase(options: InitializationOptions = {}): Promise<InitializationResult> {
  const initializer = new DatabaseInitializer(options)
  return await initializer.initialize()
}

// Health check utility
export async function checkDatabaseHealth(): Promise<{
  overall: boolean
  details: {
    postgresql: boolean
    redis: boolean
    elasticsearch: boolean
  }
  timestamp: Date
}> {
  try {
    await ConnectionManager.initialize()
    const health = await ConnectionManager.healthCheck()
    
    return {
      overall: health.database && health.redis && health.elasticsearch,
      details: {
        postgresql: health.database,
        redis: health.redis,
        elasticsearch: health.elasticsearch
      },
      timestamp: new Date()
    }
  } catch (error) {
    return {
      overall: false,
      details: {
        postgresql: false,
        redis: false,
        elasticsearch: false
      },
      timestamp: new Date()
    }
  }
}

// Graceful shutdown utility
export async function shutdownDatabases(): Promise<void> {
  console.log('Shutting down database connections...')
  await ConnectionManager.shutdown()
  console.log('Database connections closed')
}

// Process signal handlers for graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...')
    await shutdownDatabases()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...')
    await shutdownDatabases()
    process.exit(0)
  })
}