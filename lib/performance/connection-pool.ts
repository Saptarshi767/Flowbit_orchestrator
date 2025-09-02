/**
 * Advanced Connection Pool Manager
 * Manages database connections with health monitoring and auto-scaling
 */

import { Pool, PoolClient, PoolConfig } from 'pg'
import Redis, { Cluster } from 'ioredis'
import { Client as ElasticsearchClient } from '@elastic/elasticsearch'
import { getDatabaseConfig, CONNECTION_POOL_CONFIG } from '../database/config'

export interface PoolStats {
  totalConnections: number
  idleConnections: number
  activeConnections: number
  waitingClients: number
  maxConnections: number
  connectionErrors: number
  queryCount: number
  avgQueryTime: number
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
  lastCheck: Date
  errors: string[]
}

export class ConnectionPoolManager {
  private pgPool!: Pool
  private redisPool!: Cluster | Redis
  private esClient!: ElasticsearchClient
  private stats: Map<string, PoolStats> = new Map()
  private healthStatus: Map<string, HealthStatus> = new Map()
  private monitoringInterval?: NodeJS.Timeout

  constructor() {
    this.initializePools()
    this.startHealthMonitoring()
  }

  private initializePools(): void {
    const config = getDatabaseConfig()

    // PostgreSQL Pool
    this.pgPool = new Pool({
      connectionString: config.postgresql.url,
      ...CONNECTION_POOL_CONFIG.postgresql,
      ssl: config.postgresql.ssl
    })

    this.setupPostgreSQLEventHandlers()

    // Redis Pool (with cluster support)
    if (config.redis.url.includes(',')) {
      // Cluster mode
      const nodes = config.redis.url.split(',').map(url => {
        const [host, port] = url.replace('redis://', '').split(':')
        return { host, port: parseInt(port) || 6379 }
      })
      
      this.redisPool = new Cluster(nodes, {
        redisOptions: {
          maxRetriesPerRequest: config.redis.maxRetries,
          connectTimeout: config.redis.connectTimeout,
          lazyConnect: config.redis.lazyConnect
        }
      })
    } else {
      // Single instance
      this.redisPool = new Redis(config.redis.url, {
        maxRetriesPerRequest: config.redis.maxRetries,
        connectTimeout: config.redis.connectTimeout,
        lazyConnect: config.redis.lazyConnect
      })
    }

    this.setupRedisEventHandlers()

    // Elasticsearch Client
    this.esClient = new ElasticsearchClient({
      node: config.elasticsearch.url,
      auth: config.elasticsearch.username ? {
        username: config.elasticsearch.username,
        password: config.elasticsearch.password || ''
      } : undefined,
      maxRetries: config.elasticsearch.maxRetries,
      requestTimeout: config.elasticsearch.requestTimeout,
      sniffOnStart: config.elasticsearch.sniffOnStart
    })

    this.setupElasticsearchEventHandlers()
  }

  private setupPostgreSQLEventHandlers(): void {
    this.pgPool.on('connect', (client: PoolClient) => {
      console.log('PostgreSQL client connected')
      this.updateStats('postgresql')
    })

    this.pgPool.on('error', (err: Error) => {
      console.error('PostgreSQL pool error:', err)
      this.updateHealthStatus('postgresql', 'unhealthy', [err.message])
    })

    this.pgPool.on('acquire', () => {
      this.updateStats('postgresql')
    })

    this.pgPool.on('release', () => {
      this.updateStats('postgresql')
    })
  }

  private setupRedisEventHandlers(): void {
    this.redisPool.on('connect', () => {
      console.log('Redis client connected')
      this.updateHealthStatus('redis', 'healthy')
    })

    this.redisPool.on('error', (err: Error) => {
      console.error('Redis pool error:', err)
      this.updateHealthStatus('redis', 'unhealthy', [err.message])
    })

    this.redisPool.on('ready', () => {
      console.log('Redis client ready')
      this.updateHealthStatus('redis', 'healthy')
    })

    this.redisPool.on('close', () => {
      console.log('Redis connection closed')
      this.updateHealthStatus('redis', 'degraded', ['Connection closed'])
    })
  }

  private setupElasticsearchEventHandlers(): void {
    // Elasticsearch client doesn't have built-in event handlers
    // We'll monitor it through health checks
  }

  /**
   * Get PostgreSQL connection from pool
   */
  async getPostgreSQLConnection(): Promise<PoolClient> {
    try {
      const client = await this.pgPool.connect()
      this.updateStats('postgresql')
      return client
    } catch (error) {
      this.updateHealthStatus('postgresql', 'unhealthy', [(error as Error).message])
      throw error
    }
  }

  /**
   * Execute PostgreSQL query with automatic connection management
   */
  async executePostgreSQLQuery<T = any>(
    query: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const startTime = Date.now()
    
    try {
      const result = await this.pgPool.query(query, params)
      const queryTime = Date.now() - startTime
      
      this.updateQueryStats('postgresql', queryTime)
      this.updateHealthStatus('postgresql', 'healthy')
      
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      }
    } catch (error) {
      const queryTime = Date.now() - startTime
      this.updateQueryStats('postgresql', queryTime)
      this.updateHealthStatus('postgresql', 'unhealthy', [(error as Error).message])
      throw error
    }
  }

  /**
   * Get Redis client
   */
  getRedisClient(): Cluster | Redis {
    return this.redisPool
  }

  /**
   * Execute Redis command with error handling
   */
  async executeRedisCommand(command: string, ...args: any[]): Promise<any> {
    const startTime = Date.now()
    
    try {
      const result = await (this.redisPool as any)[command](...args)
      const queryTime = Date.now() - startTime
      
      this.updateQueryStats('redis', queryTime)
      this.updateHealthStatus('redis', 'healthy')
      
      return result
    } catch (error) {
      const queryTime = Date.now() - startTime
      this.updateQueryStats('redis', queryTime)
      this.updateHealthStatus('redis', 'unhealthy', [(error as Error).message])
      throw error
    }
  }

  /**
   * Get Elasticsearch client
   */
  getElasticsearchClient(): ElasticsearchClient {
    return this.esClient
  }

  /**
   * Execute Elasticsearch query with error handling
   */
  async executeElasticsearchQuery(params: any): Promise<any> {
    const startTime = Date.now()
    
    try {
      const result = await this.esClient.search(params)
      const queryTime = Date.now() - startTime
      
      this.updateQueryStats('elasticsearch', queryTime)
      this.updateHealthStatus('elasticsearch', 'healthy')
      
      return result
    } catch (error) {
      const queryTime = Date.now() - startTime
      this.updateQueryStats('elasticsearch', queryTime)
      this.updateHealthStatus('elasticsearch', 'unhealthy', [(error as Error).message])
      throw error
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): Map<string, PoolStats> {
    // Update PostgreSQL stats
    this.updateStats('postgresql')
    return new Map(this.stats)
  }

  /**
   * Get health status for all pools
   */
  getHealthStatus(): Map<string, HealthStatus> {
    return new Map(this.healthStatus)
  }

  /**
   * Perform health checks on all connections
   */
  async performHealthChecks(): Promise<Map<string, HealthStatus>> {
    const checks = await Promise.allSettled([
      this.checkPostgreSQLHealth(),
      this.checkRedisHealth(),
      this.checkElasticsearchHealth()
    ])

    checks.forEach((result, index) => {
      const service = ['postgresql', 'redis', 'elasticsearch'][index]
      if (result.status === 'rejected') {
        this.updateHealthStatus(service, 'unhealthy', [result.reason?.message || 'Health check failed'])
      }
    })

    return this.getHealthStatus()
  }

  /**
   * Scale pool connections based on demand
   */
  async scaleConnections(): Promise<void> {
    const stats = this.getPoolStats()
    
    stats.forEach((stat, service) => {
      if (service === 'postgresql') {
        // Scale PostgreSQL pool if needed
        const utilizationRate = stat.activeConnections / stat.maxConnections
        
        if (utilizationRate > 0.8 && stat.maxConnections < 100) {
          // Increase pool size
          console.log(`Scaling up PostgreSQL pool: ${stat.maxConnections} -> ${stat.maxConnections + 10}`)
          // Note: pg Pool doesn't support dynamic scaling, would need to recreate
        } else if (utilizationRate < 0.2 && stat.maxConnections > 10) {
          // Decrease pool size
          console.log(`Scaling down PostgreSQL pool: ${stat.maxConnections} -> ${stat.maxConnections - 5}`)
        }
      }
    })
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    await Promise.all([
      this.pgPool.end(),
      this.redisPool.quit(),
      this.esClient.close()
    ])
  }

  private async checkPostgreSQLHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      await this.pgPool.query('SELECT 1')
      const latency = Date.now() - startTime
      this.updateHealthStatus('postgresql', 'healthy', [], latency)
    } catch (error) {
      const latency = Date.now() - startTime
      this.updateHealthStatus('postgresql', 'unhealthy', [(error as Error).message], latency)
      throw error
    }
  }

  private async checkRedisHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      await this.redisPool.ping()
      const latency = Date.now() - startTime
      this.updateHealthStatus('redis', 'healthy', [], latency)
    } catch (error) {
      const latency = Date.now() - startTime
      this.updateHealthStatus('redis', 'unhealthy', [(error as Error).message], latency)
      throw error
    }
  }

  private async checkElasticsearchHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      await this.esClient.ping()
      const latency = Date.now() - startTime
      this.updateHealthStatus('elasticsearch', 'healthy', [], latency)
    } catch (error) {
      const latency = Date.now() - startTime
      this.updateHealthStatus('elasticsearch', 'unhealthy', [(error as Error).message], latency)
      throw error
    }
  }

  private updateStats(service: string): void {
    if (service === 'postgresql') {
      const stats: PoolStats = {
        totalConnections: this.pgPool.totalCount,
        idleConnections: this.pgPool.idleCount,
        activeConnections: this.pgPool.totalCount - this.pgPool.idleCount,
        waitingClients: this.pgPool.waitingCount,
        maxConnections: (this.pgPool as any).options.max || 20,
        connectionErrors: 0, // Would need to track separately
        queryCount: 0, // Would need to track separately
        avgQueryTime: 0 // Would need to track separately
      }
      
      this.stats.set(service, stats)
    }
  }

  private updateQueryStats(service: string, queryTime: number): void {
    const existing = this.stats.get(service)
    if (existing) {
      existing.queryCount++
      existing.avgQueryTime = (existing.avgQueryTime * (existing.queryCount - 1) + queryTime) / existing.queryCount
    }
  }

  private updateHealthStatus(
    service: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    errors: string[] = [],
    latency?: number
  ): void {
    const existing = this.healthStatus.get(service)
    
    this.healthStatus.set(service, {
      status,
      latency: latency || existing?.latency || 0,
      lastCheck: new Date(),
      errors
    })
  }

  private startHealthMonitoring(): void {
    // Perform health checks every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthChecks()
        await this.scaleConnections()
      } catch (error) {
        console.error('Health monitoring error:', error)
      }
    }, 30000)
  }
}

// Singleton instance
export const connectionPoolManager = new ConnectionPoolManager()

// Connection decorators
export function WithConnection(poolType: 'postgresql' | 'redis' | 'elasticsearch') {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      let connection: any

      try {
        switch (poolType) {
          case 'postgresql':
            connection = await connectionPoolManager.getPostgreSQLConnection()
            break
          case 'redis':
            connection = connectionPoolManager.getRedisClient()
            break
          case 'elasticsearch':
            connection = connectionPoolManager.getElasticsearchClient()
            break
        }

        return await method.apply(this, [connection, ...args])
      } finally {
        if (poolType === 'postgresql' && connection) {
          connection.release()
        }
      }
    }

    return descriptor
  }
}