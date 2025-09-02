/**
 * Advanced Cache Manager
 * Multi-layer caching with Redis, in-memory, and CDN integration
 */

import Redis from 'ioredis'
import NodeCache from 'node-cache'
import { getDatabaseConfig } from '../database/config'

export interface CacheOptions {
  ttl?: number
  tags?: string[]
  compress?: boolean
  serialize?: boolean
}

export interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  hitRate: number
}

export class CacheManager {
  private redis!: Redis
  private memoryCache!: NodeCache
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0
  }

  constructor() {
    this.initializeCache()
  }

  private initializeCache(): void {
    const config = getDatabaseConfig()
    
    // Redis cache for distributed caching
    this.redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: config.redis.maxRetries,
      connectTimeout: config.redis.connectTimeout,
      lazyConnect: config.redis.lazyConnect
    })

    // In-memory cache for frequently accessed data
    this.memoryCache = new NodeCache({
      stdTTL: 600, // 10 minutes default
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false, // Better performance
      maxKeys: 10000 // Limit memory usage
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    this.memoryCache.on('set', () => this.stats.sets++)
    this.memoryCache.on('del', () => this.stats.deletes++)
    this.memoryCache.on('expired', () => this.stats.deletes++)
  }

  /**
   * Get value from cache with fallback strategy
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try memory cache first (fastest)
      const memoryValue = this.memoryCache.get<T>(key)
      if (memoryValue !== undefined) {
        this.stats.hits++
        this.updateHitRate()
        return memoryValue
      }

      // Try Redis cache (distributed)
      const redisValue = await this.redis.get(key)
      if (redisValue) {
        const parsed = JSON.parse(redisValue) as T
        // Store in memory cache for faster future access
        this.memoryCache.set(key, parsed, 300) // 5 minutes in memory
        this.stats.hits++
        this.updateHitRate()
        return parsed
      }

      this.stats.misses++
      this.updateHitRate()
      return null
    } catch (error) {
      console.error('Cache get error:', error)
      this.stats.misses++
      this.updateHitRate()
      return null
    }
  }

  /**
   * Set value in cache with options
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || 3600 // 1 hour default
      const serialized = JSON.stringify(value)

      // Set in both caches
      await Promise.all([
        this.redis.setex(key, ttl, serialized),
        this.memoryCache.set(key, value, Math.min(ttl, 600)) // Max 10 minutes in memory
      ])

      // Handle cache tags for invalidation
      if (options.tags && options.tags.length > 0) {
        await this.addToTags(key, options.tags)
      }

      this.stats.sets++
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.del(key),
        this.memoryCache.del(key)
      ])
      this.stats.deletes++
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const keys = await this.redis.smembers(`tag:${tag}`)
        if (keys.length > 0) {
          await Promise.all([
            this.redis.del(...keys),
            ...keys.map(key => this.memoryCache.del(key))
          ])
          await this.redis.del(`tag:${tag}`)
        }
      }
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }

  /**
   * Get or set pattern with automatic caching
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const value = await factory()
    await this.set(key, value, options)
    return value
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>()
    
    try {
      // Try memory cache first
      const memoryResults = new Map<string, T>()
      const redisKeys: string[] = []

      for (const key of keys) {
        const memoryValue = this.memoryCache.get<T>(key)
        if (memoryValue !== undefined) {
          memoryResults.set(key, memoryValue)
          this.stats.hits++
        } else {
          redisKeys.push(key)
        }
      }

      // Get remaining keys from Redis
      if (redisKeys.length > 0) {
        const redisValues = await this.redis.mget(...redisKeys)
        for (let i = 0; i < redisKeys.length; i++) {
          const value = redisValues[i]
          if (value) {
            const parsed = JSON.parse(value) as T
            result.set(redisKeys[i], parsed)
            // Cache in memory for future access
            this.memoryCache.set(redisKeys[i], parsed, 300)
            this.stats.hits++
          } else {
            this.stats.misses++
          }
        }
      }

      // Combine results
      memoryResults.forEach((value, key) => {
        result.set(key, value)
      })

      this.updateHitRate()
      return result
    } catch (error) {
      console.error('Cache mget error:', error)
      this.stats.misses += keys.length
      this.updateHitRate()
      return result
    }
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    try {
      await Promise.all([
        this.redis.flushdb(),
        this.memoryCache.flushAll()
      ])
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Get cache size information
   */
  async getSize(): Promise<{ redis: number; memory: number }> {
    try {
      const redisSize = await this.redis.dbsize()
      const memorySize = this.memoryCache.keys().length
      return { redis: redisSize, memory: memorySize }
    } catch (error) {
      console.error('Cache size error:', error)
      return { redis: 0, memory: 0 }
    }
  }

  private async addToTags(key: string, tags: string[]): Promise<void> {
    try {
      const pipeline = this.redis.pipeline()
      for (const tag of tags) {
        pipeline.sadd(`tag:${tag}`, key)
        pipeline.expire(`tag:${tag}`, 86400) // 24 hours
      }
      await pipeline.exec()
    } catch (error) {
      console.error('Cache tag error:', error)
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.redis.quit()
    this.memoryCache.close()
  }
}

// Singleton instance
export const cacheManager = new CacheManager()

// Cache decorators for methods
export function Cacheable(options: CacheOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`
      
      return cacheManager.getOrSet(
        cacheKey,
        () => method.apply(this, args),
        options
      )
    }

    return descriptor
  }
}

// Cache key generators
export const CacheKeys = {
  workflow: (id: string) => `workflow:${id}`,
  workflowList: (userId: string, filters: any) => `workflows:${userId}:${JSON.stringify(filters)}`,
  execution: (id: string) => `execution:${id}`,
  executionList: (workflowId: string, limit: number) => `executions:${workflowId}:${limit}`,
  user: (id: string) => `user:${id}`,
  organization: (id: string) => `org:${id}`,
  analytics: (type: string, period: string) => `analytics:${type}:${period}`,
  marketplace: (category?: string) => `marketplace:${category || 'all'}`,
  systemMetrics: (metric: string) => `metrics:${metric}`,
  engineStatus: (engineType: string) => `engine:${engineType}:status`
}

// Cache tags for invalidation
export const CacheTags = {
  WORKFLOWS: 'workflows',
  EXECUTIONS: 'executions',
  USERS: 'users',
  ORGANIZATIONS: 'organizations',
  ANALYTICS: 'analytics',
  MARKETPLACE: 'marketplace',
  SYSTEM: 'system'
}