/**
 * Performance Optimization Tests
 * Tests for caching, query optimization, and performance monitoring
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { cacheManager, CacheKeys } from '../../lib/performance/cache-manager'
import { queryOptimizer, QueryBuilder } from '../../lib/performance/query-optimizer'
import { performanceMonitor } from '../../lib/performance/performance-monitor'
import { performanceService } from '../../services/performance/src/performance.service'
import { LazyLoader, Paginator } from '../../lib/performance/lazy-loading'

describe('Performance Optimization', () => {
  beforeAll(async () => {
    // Initialize performance monitoring
    performanceMonitor.start()
  })

  afterAll(async () => {
    // Cleanup
    performanceMonitor.stop()
    await performanceService.cleanup()
  })

  describe('Cache Manager', () => {
    beforeEach(async () => {
      await cacheManager.clear()
    })

    it('should cache and retrieve values', async () => {
      const key = 'test-key'
      const value = { id: 1, name: 'Test' }

      await cacheManager.set(key, value)
      const retrieved = await cacheManager.get(key)

      expect(retrieved).toEqual(value)
    })

    it('should handle cache misses', async () => {
      const result = await cacheManager.get('non-existent-key')
      expect(result).toBeNull()
    })

    it('should support getOrSet pattern', async () => {
      const key = 'factory-key'
      const value = { computed: true }

      const result = await cacheManager.getOrSet(
        key,
        async () => value,
        { ttl: 60 }
      )

      expect(result).toEqual(value)

      // Second call should return cached value
      const cached = await cacheManager.get(key)
      expect(cached).toEqual(value)
    })

    it('should support batch operations', async () => {
      const keys = ['key1', 'key2', 'key3']
      const values = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ]

      // Set values
      for (let i = 0; i < keys.length; i++) {
        await cacheManager.set(keys[i], values[i])
      }

      // Batch get
      const results = await cacheManager.mget(keys)

      expect(results.size).toBe(3)
      expect(results.get('key1')).toEqual(values[0])
      expect(results.get('key2')).toEqual(values[1])
      expect(results.get('key3')).toEqual(values[2])
    })

    it('should invalidate by tags', async () => {
      const key1 = 'tagged-key-1'
      const key2 = 'tagged-key-2'
      const value = { tagged: true }

      await cacheManager.set(key1, value, { tags: ['test-tag'] })
      await cacheManager.set(key2, value, { tags: ['test-tag'] })

      // Verify cached
      expect(await cacheManager.get(key1)).toEqual(value)
      expect(await cacheManager.get(key2)).toEqual(value)

      // Invalidate by tag
      await cacheManager.invalidateByTags(['test-tag'])

      // Verify invalidated
      expect(await cacheManager.get(key1)).toBeNull()
      expect(await cacheManager.get(key2)).toBeNull()
    })

    it('should track cache statistics', async () => {
      await cacheManager.clear()

      // Generate some cache activity
      await cacheManager.set('stats-key', { test: true })
      await cacheManager.get('stats-key') // Hit
      await cacheManager.get('non-existent') // Miss

      const stats = cacheManager.getStats()
      expect(stats.hits).toBeGreaterThan(0)
      expect(stats.misses).toBeGreaterThan(0)
      expect(stats.sets).toBeGreaterThan(0)
    })
  })

  describe('Query Optimizer', () => {
    it('should build optimized queries', () => {
      const query = new QueryBuilder()
        .select(['id', 'name', 'email'])
        .from('users')
        .where('active = ?', true)
        .where('created_at > ?', new Date('2024-01-01'))
        .orderBy('created_at', 'DESC')
        .limit(10)
        .offset(20)

      const { query: sql, params } = query.build()

      expect(sql).toContain('SELECT id, name, email')
      expect(sql).toContain('FROM users')
      expect(sql).toContain('WHERE active = $1')
      expect(sql).toContain('AND created_at > $2')
      expect(sql).toContain('ORDER BY created_at DESC')
      expect(sql).toContain('LIMIT $3')
      expect(sql).toContain('OFFSET $4')
      expect(params).toEqual([true, new Date('2024-01-01'), 10, 20])
    })

    it('should handle complex where conditions', () => {
      const query = new QueryBuilder()
        .select('*')
        .from('workflows')
        .where('user_id = ?', 'user123')
        .where('status IN (?, ?)', 'active', 'pending')
        .where('name ILIKE ?', '%test%')

      const { query: sql, params } = query.build()

      expect(sql).toContain('WHERE user_id = $1')
      expect(sql).toContain('AND status IN ($2, $3)')
      expect(sql).toContain('AND name ILIKE $4')
      expect(params).toEqual(['user123', 'active', 'pending', '%test%'])
    })
  })

  describe('Performance Monitor', () => {
    it('should record metrics', () => {
      performanceMonitor.recordMetric('test_metric', 100, 'ms')
      
      const metrics = performanceMonitor.getMetrics('test_metric')
      expect(metrics.length).toBeGreaterThan(0)
      expect(metrics[metrics.length - 1].value).toBe(100)
      expect(metrics[metrics.length - 1].unit).toBe('ms')
    })

    it('should track endpoint performance', () => {
      performanceMonitor.trackEndpoint('/api/workflows', 'GET', 250, 200)
      
      const responseTimeMetrics = performanceMonitor.getMetrics('response_time')
      const throughputMetrics = performanceMonitor.getMetrics('throughput')

      expect(responseTimeMetrics.length).toBeGreaterThan(0)
      expect(throughputMetrics.length).toBeGreaterThan(0)
    })

    it('should generate performance reports', async () => {
      // Record some test metrics
      performanceMonitor.recordMetric('response_time', 150, 'ms')
      performanceMonitor.recordMetric('throughput', 10, 'requests')
      performanceMonitor.recordMetric('error_rate', 2, '%')

      const report = await performanceMonitor.generateReport('1m')

      expect(report.period).toBe('1m')
      expect(report.metrics.length).toBeGreaterThan(0)
      expect(report.summary).toBeDefined()
      expect(report.recommendations).toBeDefined()
    })

    it('should create alerts for threshold violations', () => {
      performanceMonitor.setThreshold('test_alert_metric', 50, 100)
      
      // Should not create alert
      performanceMonitor.recordMetric('test_alert_metric', 30, 'units')
      let alerts = performanceMonitor.getAlerts()
      const initialAlertCount = alerts.length

      // Should create warning alert
      performanceMonitor.recordMetric('test_alert_metric', 75, 'units')
      alerts = performanceMonitor.getAlerts()
      expect(alerts.length).toBe(initialAlertCount + 1)

      // Should create critical alert
      performanceMonitor.recordMetric('test_alert_metric', 150, 'units')
      alerts = performanceMonitor.getAlerts()
      expect(alerts.length).toBe(initialAlertCount + 2)
    })
  })

  describe('Performance Service', () => {
    it('should initialize performance optimizations', async () => {
      const result = await performanceService.initialize()

      expect(result.cacheOptimized).toBe(true)
      expect(result.queryOptimized).toBe(true)
      expect(result.indexesCreated).toBeGreaterThanOrEqual(0)
      expect(result.performanceImprovement).toBeDefined()
    })

    it('should generate performance reports', async () => {
      const report = await performanceService.getPerformanceReport('5m')

      expect(report.period).toBe('5m')
      expect(report.timestamp).toBeDefined()
      expect(report.performance).toBeDefined()
      expect(report.cache).toBeDefined()
      expect(report.database).toBeDefined()
      expect(report.recommendations).toBeDefined()
    })

    it('should perform auto-optimization', async () => {
      const result = await performanceService.autoOptimize()

      expect(result.optimizations).toBeDefined()
      expect(result.improvements).toBeDefined()
      expect(Array.isArray(result.optimizations)).toBe(true)
      expect(Array.isArray(result.improvements)).toBe(true)
    })
  })

  describe('Lazy Loading', () => {
    it('should implement lazy loading with pagination', async () => {
      const mockData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`
      }))

      const fetchFunction = async (page: number, limit: number) => {
        const offset = (page - 1) * limit
        const data = mockData.slice(offset, offset + limit)
        const total = mockData.length

        return {
          data,
          pagination: Paginator.createPagination(page, limit, total)
        }
      }

      const lazyLoader = new LazyLoader(fetchFunction, { batchSize: 10 })

      // Load initial batch
      const initialItems = await lazyLoader.initialize()
      expect(initialItems.length).toBe(10)
      expect(lazyLoader.getHasMore()).toBe(true)

      // Load more items
      const moreItems = await lazyLoader.loadMore()
      expect(moreItems.length).toBe(20)

      // Search within loaded items
      const searchResults = lazyLoader.search('Item 1', ['name'])
      expect(searchResults.length).toBeGreaterThan(0)
      expect(searchResults[0].name).toContain('Item 1')
    })

    it('should validate pagination parameters', () => {
      const result1 = Paginator.validatePagination(0, 10)
      expect(result1.page).toBe(1)
      expect(result1.errors.length).toBeGreaterThan(0)

      const result2 = Paginator.validatePagination(1, 0)
      expect(result2.limit).toBe(10)
      expect(result2.errors.length).toBeGreaterThan(0)

      const result3 = Paginator.validatePagination(1, 150)
      expect(result3.limit).toBe(100)
      expect(result3.errors.length).toBeGreaterThan(0)

      const result4 = Paginator.validatePagination(2, 20)
      expect(result4.page).toBe(2)
      expect(result4.limit).toBe(20)
      expect(result4.errors.length).toBe(0)
    })

    it('should create pagination metadata', () => {
      const pagination = Paginator.createPagination(2, 10, 45)

      expect(pagination.page).toBe(2)
      expect(pagination.limit).toBe(10)
      expect(pagination.total).toBe(45)
      expect(pagination.totalPages).toBe(5)
      expect(pagination.hasNext).toBe(true)
      expect(pagination.hasPrev).toBe(true)
    })

    it('should calculate correct offset', () => {
      expect(Paginator.getOffset(1, 10)).toBe(0)
      expect(Paginator.getOffset(2, 10)).toBe(10)
      expect(Paginator.getOffset(3, 20)).toBe(40)
    })
  })

  describe('Integration Tests', () => {
    it('should optimize workflow queries with caching', async () => {
      const userId = 'test-user-123'
      const filters = { status: 'active' }

      // First call should hit database and cache result
      const result1 = await performanceService.getOptimizedWorkflows(
        userId,
        filters,
        1,
        10
      )

      expect(result1).toBeDefined()

      // Second call should hit cache
      const result2 = await performanceService.getOptimizedWorkflows(
        userId,
        filters,
        1,
        10
      )

      expect(result2).toEqual(result1)
    })

    it('should handle cache invalidation', async () => {
      const userId = 'test-user-456'
      
      // Cache some data
      await performanceService.getOptimizedWorkflows(userId, {}, 1, 10)

      // Invalidate cache
      await performanceService.invalidateCache(['workflows'])

      // Should work without errors
      const result = await performanceService.getOptimizedWorkflows(userId, {}, 1, 10)
      expect(result).toBeDefined()
    })

    it('should track performance metrics during operations', async () => {
      const initialStats = performanceMonitor.getMetrics('performance_initialization')
      const initialCount = initialStats.length

      // Perform operation that should be tracked
      await performanceService.initialize()

      const finalStats = performanceMonitor.getMetrics('performance_initialization')
      expect(finalStats.length).toBeGreaterThan(initialCount)
    })
  })

  describe('Stress Tests', () => {
    it('should handle high cache load', async () => {
      const promises = []
      
      // Generate 100 concurrent cache operations
      for (let i = 0; i < 100; i++) {
        promises.push(
          cacheManager.set(`stress-key-${i}`, { id: i, data: `test-${i}` })
        )
      }

      await Promise.all(promises)

      // Verify all items were cached
      const getPromises = []
      for (let i = 0; i < 100; i++) {
        getPromises.push(cacheManager.get(`stress-key-${i}`))
      }

      const results = await Promise.all(getPromises)
      const successCount = results.filter(r => r !== null).length
      
      expect(successCount).toBeGreaterThan(90) // Allow for some failures under stress
    })

    it('should handle concurrent query building', () => {
      const queries = []

      for (let i = 0; i < 50; i++) {
        const query = new QueryBuilder()
          .select('*')
          .from('test_table')
          .where('id = ?', i)
          .limit(10)

        queries.push(query.build())
      }

      expect(queries.length).toBe(50)
      queries.forEach((query, index) => {
        expect(query.params[0]).toBe(index)
      })
    })
  })
})

// Performance benchmarks
describe('Performance Benchmarks', () => {
  it('should benchmark cache operations', async () => {
    const iterations = 1000
    const startTime = Date.now()

    for (let i = 0; i < iterations; i++) {
      await cacheManager.set(`bench-${i}`, { id: i })
      await cacheManager.get(`bench-${i}`)
    }

    const endTime = Date.now()
    const duration = endTime - startTime
    const opsPerSecond = (iterations * 2) / (duration / 1000) // 2 ops per iteration

    console.log(`Cache benchmark: ${opsPerSecond.toFixed(2)} ops/second`)
    expect(opsPerSecond).toBeGreaterThan(100) // Should handle at least 100 ops/second
  })

  it('should benchmark query building', () => {
    const iterations = 10000
    const startTime = Date.now()

    for (let i = 0; i < iterations; i++) {
      new QueryBuilder()
        .select(['id', 'name', 'email'])
        .from('users')
        .where('active = ?', true)
        .where('id > ?', i)
        .orderBy('created_at', 'DESC')
        .limit(10)
        .build()
    }

    const endTime = Date.now()
    const duration = endTime - startTime
    const opsPerSecond = iterations / (duration / 1000)

    console.log(`Query building benchmark: ${opsPerSecond.toFixed(2)} queries/second`)
    expect(opsPerSecond).toBeGreaterThan(1000) // Should build at least 1000 queries/second
  })
})