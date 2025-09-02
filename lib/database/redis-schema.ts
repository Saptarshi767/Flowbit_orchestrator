import { RedisConnection } from './connection'

// Redis Key Patterns
export const REDIS_KEYS = {
  // Session Management
  SESSION: (sessionId: string) => `session:${sessionId}`,
  USER_SESSIONS: (userId: string) => `user:${userId}:sessions`,
  
  // Authentication
  AUTH_TOKEN: (token: string) => `auth:token:${token}`,
  REFRESH_TOKEN: (token: string) => `auth:refresh:${token}`,
  PASSWORD_RESET: (token: string) => `auth:reset:${token}`,
  
  // Rate Limiting
  RATE_LIMIT: (identifier: string, window: string) => `rate_limit:${identifier}:${window}`,
  API_QUOTA: (userId: string, period: string) => `quota:${userId}:${period}`,
  
  // Caching
  WORKFLOW_CACHE: (workflowId: string) => `cache:workflow:${workflowId}`,
  USER_CACHE: (userId: string) => `cache:user:${userId}`,
  ORGANIZATION_CACHE: (orgId: string) => `cache:org:${orgId}`,
  EXECUTION_CACHE: (executionId: string) => `cache:execution:${executionId}`,
  
  // Real-time Execution State
  EXECUTION_STATUS: (executionId: string) => `execution:status:${executionId}`,
  EXECUTION_PROGRESS: (executionId: string) => `execution:progress:${executionId}`,
  EXECUTION_LOGS: (executionId: string) => `execution:logs:${executionId}`,
  
  // Queue Management
  EXECUTION_QUEUE: 'queue:executions',
  NOTIFICATION_QUEUE: 'queue:notifications',
  WEBHOOK_QUEUE: 'queue:webhooks',
  
  // Temporary Data
  WORKFLOW_PARAMS: (executionId: string) => `temp:params:${executionId}`,
  UPLOAD_SESSION: (sessionId: string) => `temp:upload:${sessionId}`,
  
  // Analytics
  METRICS_BUFFER: (metric: string) => `metrics:buffer:${metric}`,
  DAILY_STATS: (date: string) => `stats:daily:${date}`,
  
  // Locks
  WORKFLOW_LOCK: (workflowId: string) => `lock:workflow:${workflowId}`,
  EXECUTION_LOCK: (executionId: string) => `lock:execution:${executionId}`
} as const

// Redis Schema Interfaces
export interface SessionData {
  userId: string
  organizationId: string
  role: string
  permissions: string[]
  lastActivity: number
  ipAddress?: string
  userAgent?: string
}

export interface ExecutionState {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  currentStep?: string
  startTime: number
  endTime?: number
  error?: string
}

export interface RateLimitData {
  count: number
  resetTime: number
  limit: number
}

export interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
}

// Redis Schema Manager
export class RedisSchemaManager {
  private redis = RedisConnection.getInstance()
  
  // Session Management
  async setSession(sessionId: string, data: SessionData, ttl: number = 86400): Promise<void> {
    const key = REDIS_KEYS.SESSION(sessionId)
    await this.redis.setEx(key, ttl, JSON.stringify(data))
    
    // Add to user sessions set
    const userSessionsKey = REDIS_KEYS.USER_SESSIONS(data.userId)
    await this.redis.sAdd(userSessionsKey, sessionId)
    await this.redis.expire(userSessionsKey, ttl)
  }
  
  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = REDIS_KEYS.SESSION(sessionId)
    const data = await this.redis.get(key)
    return data ? JSON.parse(data) : null
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId)
    if (session) {
      await this.redis.sRem(REDIS_KEYS.USER_SESSIONS(session.userId), sessionId)
    }
    await this.redis.del(REDIS_KEYS.SESSION(sessionId))
  }
  
  async getUserSessions(userId: string): Promise<string[]> {
    const key = REDIS_KEYS.USER_SESSIONS(userId)
    return await this.redis.sMembers(key)
  }
  
  // Rate Limiting
  async checkRateLimit(identifier: string, window: string, limit: number): Promise<RateLimitData> {
    const key = REDIS_KEYS.RATE_LIMIT(identifier, window)
    const current = await this.redis.get(key)
    
    if (!current) {
      await this.redis.setEx(key, parseInt(window), '1')
      return {
        count: 1,
        resetTime: Date.now() + parseInt(window) * 1000,
        limit
      }
    }
    
    const count = parseInt(current) + 1
    await this.redis.incr(key)
    const ttl = await this.redis.ttl(key)
    
    return {
      count,
      resetTime: Date.now() + ttl * 1000,
      limit
    }
  }
  
  // Caching
  async setCache<T>(key: string, data: T, ttl: number = 3600): Promise<void> {
    const cacheEntry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    }
    await this.redis.setEx(key, ttl, JSON.stringify(cacheEntry))
  }
  
  async getCache<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key)
    if (!cached) return null
    
    try {
      const entry: CacheEntry<T> = JSON.parse(cached)
      return entry.data
    } catch {
      return null
    }
  }
  
  async deleteCache(key: string): Promise<void> {
    await this.redis.del(key)
  }
  
  async invalidateCachePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern)
    if (keys.length > 0) {
      await this.redis.del(keys)
    }
  }
  
  // Execution State Management
  async setExecutionState(executionId: string, state: ExecutionState): Promise<void> {
    const key = REDIS_KEYS.EXECUTION_STATUS(executionId)
    await this.redis.setEx(key, 86400, JSON.stringify(state)) // 24 hour TTL
  }
  
  async getExecutionState(executionId: string): Promise<ExecutionState | null> {
    const key = REDIS_KEYS.EXECUTION_STATUS(executionId)
    const data = await this.redis.get(key)
    return data ? JSON.parse(data) : null
  }
  
  async updateExecutionProgress(executionId: string, progress: number, currentStep?: string): Promise<void> {
    const state = await this.getExecutionState(executionId)
    if (state) {
      state.progress = progress
      if (currentStep) state.currentStep = currentStep
      await this.setExecutionState(executionId, state)
    }
  }
  
  // Queue Management
  async enqueueExecution(executionId: string, priority: number = 0): Promise<void> {
    await this.redis.zAdd(REDIS_KEYS.EXECUTION_QUEUE, {
      score: priority,
      value: executionId
    })
  }
  
  async dequeueExecution(): Promise<string | null> {
    const result = await this.redis.zPopMax(REDIS_KEYS.EXECUTION_QUEUE)
    return result?.value || null
  }
  
  async getQueueLength(): Promise<number> {
    return await this.redis.zCard(REDIS_KEYS.EXECUTION_QUEUE)
  }
  
  // Distributed Locking
  async acquireLock(lockKey: string, ttl: number = 30): Promise<boolean> {
    const result = await this.redis.set(lockKey, '1', {
      EX: ttl,
      NX: true
    })
    return result === 'OK'
  }
  
  async releaseLock(lockKey: string): Promise<void> {
    await this.redis.del(lockKey)
  }
  
  async extendLock(lockKey: string, ttl: number = 30): Promise<boolean> {
    const result = await this.redis.expire(lockKey, ttl)
    return result === 1
  }
  
  // Metrics and Analytics
  async incrementMetric(metric: string, value: number = 1): Promise<void> {
    const key = REDIS_KEYS.METRICS_BUFFER(metric)
    await this.redis.incrByFloat(key, value)
    await this.redis.expire(key, 3600) // 1 hour TTL
  }
  
  async getMetric(metric: string): Promise<number> {
    const key = REDIS_KEYS.METRICS_BUFFER(metric)
    const value = await this.redis.get(key)
    return value ? parseFloat(value) : 0
  }
  
  // Pub/Sub for Real-time Updates
  async publishExecutionUpdate(executionId: string, update: any): Promise<void> {
    await this.redis.publish(`execution:${executionId}`, JSON.stringify(update))
  }
  
  async publishSystemEvent(event: string, data: any): Promise<void> {
    await this.redis.publish('system:events', JSON.stringify({ event, data, timestamp: Date.now() }))
  }
  
  // Cleanup utilities
  async cleanupExpiredSessions(): Promise<number> {
    const pattern = 'session:*'
    const keys = await this.redis.keys(pattern)
    let cleaned = 0
    
    for (const key of keys) {
      const ttl = await this.redis.ttl(key)
      if (ttl === -1) { // No expiration set
        await this.redis.expire(key, 86400) // Set 24 hour default
      } else if (ttl === -2) { // Key doesn't exist
        cleaned++
      }
    }
    
    return cleaned
  }
  
  async getMemoryUsage(): Promise<{ used: string; peak: string }> {
    const info = await this.redis.info('memory')
    const lines = info.split('\r\n')
    const used = lines.find(line => line.startsWith('used_memory_human:'))?.split(':')[1] || '0'
    const peak = lines.find(line => line.startsWith('used_memory_peak_human:'))?.split(':')[1] || '0'
    
    return { used, peak }
  }
}

export const redisSchema = new RedisSchemaManager()