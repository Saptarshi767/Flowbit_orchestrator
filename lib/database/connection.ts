import { PrismaClient } from '@prisma/client'
import { createClient } from 'redis'
import { Client as ElasticsearchClient } from '@elastic/elasticsearch'

// PostgreSQL Connection with Prisma
class DatabaseConnection {
  private static instance: PrismaClient
  
  public static getInstance(): PrismaClient {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
        datasources: {
          db: {
            url: process.env.DATABASE_URL
          }
        }
      })
      
      // Handle graceful shutdown
      process.on('beforeExit', async () => {
        await DatabaseConnection.instance.$disconnect()
      })
    }
    
    return DatabaseConnection.instance
  }
  
  public static async healthCheck(): Promise<boolean> {
    try {
      await DatabaseConnection.getInstance().$queryRaw`SELECT 1`
      return true
    } catch (error) {
      console.error('Database health check failed:', error)
      return false
    }
  }
}

// Redis Connection with Connection Pooling
class RedisConnection {
  private static instance: ReturnType<typeof createClient>
  
  public static getInstance() {
    if (!RedisConnection.instance) {
      RedisConnection.instance = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 60000,
          lazyConnect: true,
          reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        }
      })
      
      RedisConnection.instance.on('error', (err) => {
        console.error('Redis Client Error:', err)
      })
      
      RedisConnection.instance.on('connect', () => {
        console.log('Redis Client Connected')
      })
      
      RedisConnection.instance.on('ready', () => {
        console.log('Redis Client Ready')
      })
      
      // Handle graceful shutdown
      process.on('beforeExit', async () => {
        await RedisConnection.instance?.quit()
      })
    }
    
    return RedisConnection.instance
  }
  
  public static async connect(): Promise<void> {
    const client = RedisConnection.getInstance()
    if (!client.isOpen) {
      await client.connect()
    }
  }
  
  public static async healthCheck(): Promise<boolean> {
    try {
      const client = RedisConnection.getInstance()
      await client.ping()
      return true
    } catch (error) {
      console.error('Redis health check failed:', error)
      return false
    }
  }
}

// Elasticsearch Connection
class ElasticsearchConnection {
  private static instance: ElasticsearchClient
  
  public static getInstance(): ElasticsearchClient {
    if (!ElasticsearchConnection.instance) {
      ElasticsearchConnection.instance = new ElasticsearchClient({
        node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        auth: process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD ? {
          username: process.env.ELASTICSEARCH_USERNAME,
          password: process.env.ELASTICSEARCH_PASSWORD
        } : undefined,
        maxRetries: 5,
        requestTimeout: 60000,
        sniffOnStart: true
      })
    }
    
    return ElasticsearchConnection.instance
  }
  
  public static async healthCheck(): Promise<boolean> {
    try {
      const client = ElasticsearchConnection.getInstance()
      const health = await client.cluster.health()
      return health.status === 'green' || health.status === 'yellow'
    } catch (error) {
      console.error('Elasticsearch health check failed:', error)
      return false
    }
  }
}

// Connection Pool Manager
export class ConnectionManager {
  private static initialized = false
  
  public static async initialize(): Promise<void> {
    if (ConnectionManager.initialized) {
      return
    }
    
    try {
      // Initialize Redis connection
      await RedisConnection.connect()
      
      // Test all connections
      const [dbHealth, redisHealth, esHealth] = await Promise.all([
        DatabaseConnection.healthCheck(),
        RedisConnection.healthCheck(),
        ElasticsearchConnection.healthCheck()
      ])
      
      if (!dbHealth) {
        throw new Error('Database connection failed')
      }
      
      if (!redisHealth) {
        console.warn('Redis connection failed - some features may be limited')
      }
      
      if (!esHealth) {
        console.warn('Elasticsearch connection failed - search features may be limited')
      }
      
      ConnectionManager.initialized = true
      console.log('Database connections initialized successfully')
    } catch (error) {
      console.error('Failed to initialize database connections:', error)
      throw error
    }
  }
  
  public static getDatabase(): PrismaClient {
    return DatabaseConnection.getInstance()
  }
  
  public static getRedis() {
    return RedisConnection.getInstance()
  }
  
  public static getElasticsearch(): ElasticsearchClient {
    return ElasticsearchConnection.getInstance()
  }
  
  public static async healthCheck(): Promise<{
    database: boolean
    redis: boolean
    elasticsearch: boolean
  }> {
    const [database, redis, elasticsearch] = await Promise.all([
      DatabaseConnection.healthCheck(),
      RedisConnection.healthCheck(),
      ElasticsearchConnection.healthCheck()
    ])
    
    return { database, redis, elasticsearch }
  }
  
  public static async shutdown(): Promise<void> {
    try {
      await Promise.all([
        DatabaseConnection.getInstance().$disconnect(),
        RedisConnection.getInstance()?.quit(),
        ElasticsearchConnection.getInstance()?.close()
      ])
      console.log('All database connections closed')
    } catch (error) {
      console.error('Error during connection shutdown:', error)
    }
  }
}

export { DatabaseConnection, RedisConnection, ElasticsearchConnection }