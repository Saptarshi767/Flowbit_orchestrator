/**
 * Performance Monitoring System
 * Comprehensive performance tracking and alerting
 */

import { EventEmitter } from 'events'
import { cacheManager } from './cache-manager'
import { queryOptimizer } from './query-optimizer'
import { connectionPoolManager } from './connection-pool'

export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: Date
  tags?: Record<string, string>
}

export interface PerformanceAlert {
  id: string
  metric: string
  threshold: number
  currentValue: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: Date
  resolved: boolean
}

export interface PerformanceReport {
  period: string
  metrics: PerformanceMetric[]
  alerts: PerformanceAlert[]
  recommendations: string[]
  summary: {
    avgResponseTime: number
    errorRate: number
    throughput: number
    cacheHitRate: number
    dbConnectionUtilization: number
  }
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, PerformanceMetric[]> = new Map()
  private alerts: PerformanceAlert[] = []
  private thresholds: Map<string, { warning: number; critical: number }> = new Map()
  private monitoringInterval?: NodeJS.Timeout
  private isMonitoring: boolean = false

  constructor() {
    super()
    this.setupDefaultThresholds()
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    console.log('Starting performance monitoring...')

    // Collect metrics every 10 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, 10000)

    // Generate reports every 5 minutes
    setInterval(() => {
      this.generateReport('5m')
    }, 300000)
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isMonitoring) return

    this.isMonitoring = false
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    console.log('Performance monitoring stopped')
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const metricHistory = this.metrics.get(name)!
    metricHistory.push(metric)

    // Keep only last 1000 metrics per type
    if (metricHistory.length > 1000) {
      metricHistory.shift()
    }

    // Check thresholds and create alerts
    this.checkThresholds(name, value)

    this.emit('metric', metric)
  }

  /**
   * Set performance thresholds
   */
  setThreshold(metric: string, warning: number, critical: number): void {
    this.thresholds.set(metric, { warning, critical })
  }

  /**
   * Get metrics for a specific time period
   */
  getMetrics(name: string, period?: string): PerformanceMetric[] {
    const metrics = this.metrics.get(name) || []
    
    if (!period) return metrics

    const now = new Date()
    const periodMs = this.parsePeriod(period)
    const cutoff = new Date(now.getTime() - periodMs)

    return metrics.filter(metric => metric.timestamp >= cutoff)
  }

  /**
   * Get all active alerts
   */
  getAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved)
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      this.emit('alertResolved', alert)
    }
  }

  /**
   * Generate performance report
   */
  async generateReport(period: string = '1h'): Promise<PerformanceReport> {
    const now = new Date()
    const periodMs = this.parsePeriod(period)
    const cutoff = new Date(now.getTime() - periodMs)

    // Collect metrics for the period
    const allMetrics: PerformanceMetric[] = []
    this.metrics.forEach((metrics, name) => {
      const periodMetrics = metrics.filter(m => m.timestamp >= cutoff)
      allMetrics.push(...periodMetrics)
    })

    // Get alerts for the period
    const periodAlerts = this.alerts.filter(a => a.timestamp >= cutoff)

    // Calculate summary statistics
    const responseTimeMetrics = this.getMetrics('response_time', period)
    const errorMetrics = this.getMetrics('error_rate', period)
    const throughputMetrics = this.getMetrics('throughput', period)

    const avgResponseTime = this.calculateAverage(responseTimeMetrics)
    const errorRate = this.calculateAverage(errorMetrics)
    const throughput = this.calculateAverage(throughputMetrics)

    // Get cache and database stats
    const cacheStats = cacheManager.getStats()
    const poolStats = connectionPoolManager.getPoolStats()
    const pgStats = poolStats.get('postgresql')

    const summary = {
      avgResponseTime,
      errorRate,
      throughput,
      cacheHitRate: cacheStats.hitRate,
      dbConnectionUtilization: pgStats ? pgStats.activeConnections / pgStats.maxConnections : 0
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, periodAlerts)

    const report: PerformanceReport = {
      period,
      metrics: allMetrics,
      alerts: periodAlerts,
      recommendations,
      summary
    }

    this.emit('report', report)
    return report
  }

  /**
   * Get system resource usage
   */
  async getSystemMetrics(): Promise<{
    cpu: number
    memory: number
    disk: number
    network: { in: number; out: number }
  }> {
    // In a real implementation, you would use system monitoring libraries
    // For now, we'll return mock data
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: {
        in: Math.random() * 1000,
        out: Math.random() * 1000
      }
    }
  }

  /**
   * Track API endpoint performance
   */
  trackEndpoint(endpoint: string, method: string, responseTime: number, statusCode: number): void {
    const tags = { endpoint, method, status: statusCode.toString() }

    this.recordMetric('response_time', responseTime, 'ms', tags)
    this.recordMetric('throughput', 1, 'requests', tags)

    if (statusCode >= 400) {
      this.recordMetric('error_rate', 1, 'errors', tags)
    }
  }

  /**
   * Track database query performance
   */
  trackDatabaseQuery(query: string, duration: number, success: boolean): void {
    const tags = { 
      query_type: this.extractQueryType(query),
      success: success.toString()
    }

    this.recordMetric('db_query_time', duration, 'ms', tags)
    
    if (!success) {
      this.recordMetric('db_error_rate', 1, 'errors', tags)
    }
  }

  /**
   * Track cache performance
   */
  trackCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, duration?: number): void {
    const tags = { operation, key_type: this.extractKeyType(key) }

    this.recordMetric('cache_operations', 1, 'operations', tags)
    
    if (duration) {
      this.recordMetric('cache_operation_time', duration, 'ms', tags)
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Collect system metrics
      const systemMetrics = await this.getSystemMetrics()
      this.recordMetric('cpu_usage', systemMetrics.cpu, '%')
      this.recordMetric('memory_usage', systemMetrics.memory, '%')
      this.recordMetric('disk_usage', systemMetrics.disk, '%')
      this.recordMetric('network_in', systemMetrics.network.in, 'bytes/s')
      this.recordMetric('network_out', systemMetrics.network.out, 'bytes/s')

      // Collect cache metrics
      const cacheStats = cacheManager.getStats()
      this.recordMetric('cache_hit_rate', cacheStats.hitRate * 100, '%')
      this.recordMetric('cache_hits', cacheStats.hits, 'count')
      this.recordMetric('cache_misses', cacheStats.misses, 'count')

      // Collect database metrics
      const poolStats = connectionPoolManager.getPoolStats()
      poolStats.forEach((stats, service) => {
        this.recordMetric(`${service}_active_connections`, stats.activeConnections, 'count')
        this.recordMetric(`${service}_idle_connections`, stats.idleConnections, 'count')
        this.recordMetric(`${service}_avg_query_time`, stats.avgQueryTime, 'ms')
      })

      // Collect health status
      const healthStatus = connectionPoolManager.getHealthStatus()
      healthStatus.forEach((status, service) => {
        this.recordMetric(`${service}_latency`, status.latency, 'ms')
        this.recordMetric(`${service}_health`, status.status === 'healthy' ? 1 : 0, 'boolean')
      })

    } catch (error) {
      console.error('Error collecting metrics:', error)
    }
  }

  private setupDefaultThresholds(): void {
    // Response time thresholds
    this.setThreshold('response_time', 1000, 5000) // 1s warning, 5s critical
    
    // Error rate thresholds
    this.setThreshold('error_rate', 5, 10) // 5% warning, 10% critical
    
    // System resource thresholds
    this.setThreshold('cpu_usage', 70, 90) // 70% warning, 90% critical
    this.setThreshold('memory_usage', 80, 95) // 80% warning, 95% critical
    this.setThreshold('disk_usage', 85, 95) // 85% warning, 95% critical
    
    // Database thresholds
    this.setThreshold('db_query_time', 500, 2000) // 500ms warning, 2s critical
    this.setThreshold('postgresql_active_connections', 15, 18) // Connection pool limits
    
    // Cache thresholds
    this.setThreshold('cache_hit_rate', 80, 60) // 80% warning (low hit rate), 60% critical
  }

  private checkThresholds(metricName: string, value: number): void {
    const threshold = this.thresholds.get(metricName)
    if (!threshold) return

    let severity: 'low' | 'medium' | 'high' | 'critical' | null = null
    let message = ''

    if (value >= threshold.critical) {
      severity = 'critical'
      message = `${metricName} is critically high: ${value}`
    } else if (value >= threshold.warning) {
      severity = 'high'
      message = `${metricName} is above warning threshold: ${value}`
    }

    // Special case for cache hit rate (lower is worse)
    if (metricName === 'cache_hit_rate') {
      if (value <= threshold.critical) {
        severity = 'critical'
        message = `Cache hit rate is critically low: ${value}%`
      } else if (value <= threshold.warning) {
        severity = 'high'
        message = `Cache hit rate is below warning threshold: ${value}%`
      }
    }

    if (severity) {
      const alert: PerformanceAlert = {
        id: `${metricName}_${Date.now()}`,
        metric: metricName,
        threshold: severity === 'critical' ? threshold.critical : threshold.warning,
        currentValue: value,
        severity,
        message,
        timestamp: new Date(),
        resolved: false
      }

      this.alerts.push(alert)
      this.emit('alert', alert)

      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts.shift()
      }
    }
  }

  private calculateAverage(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0
    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0)
    return sum / metrics.length
  }

  private parsePeriod(period: string): number {
    const match = period.match(/^(\d+)([smhd])$/)
    if (!match) return 3600000 // Default 1 hour

    const value = parseInt(match[1])
    const unit = match[2]

    switch (unit) {
      case 's': return value * 1000
      case 'm': return value * 60 * 1000
      case 'h': return value * 60 * 60 * 1000
      case 'd': return value * 24 * 60 * 60 * 1000
      default: return 3600000
    }
  }

  private extractQueryType(query: string): string {
    const normalized = query.trim().toLowerCase()
    if (normalized.startsWith('select')) return 'select'
    if (normalized.startsWith('insert')) return 'insert'
    if (normalized.startsWith('update')) return 'update'
    if (normalized.startsWith('delete')) return 'delete'
    return 'other'
  }

  private extractKeyType(key: string): string {
    const parts = key.split(':')
    return parts[0] || 'unknown'
  }

  private generateRecommendations(summary: any, alerts: PerformanceAlert[]): string[] {
    const recommendations: string[] = []

    // Response time recommendations
    if (summary.avgResponseTime > 1000) {
      recommendations.push('Consider implementing response caching for frequently accessed endpoints')
      recommendations.push('Review database query performance and add missing indexes')
    }

    // Error rate recommendations
    if (summary.errorRate > 5) {
      recommendations.push('Investigate error patterns and implement better error handling')
      recommendations.push('Consider implementing circuit breakers for external service calls')
    }

    // Cache hit rate recommendations
    if (summary.cacheHitRate < 0.8) {
      recommendations.push('Review cache TTL settings and cache key strategies')
      recommendations.push('Consider implementing cache warming for critical data')
    }

    // Database connection recommendations
    if (summary.dbConnectionUtilization > 0.8) {
      recommendations.push('Consider increasing database connection pool size')
      recommendations.push('Review long-running queries and implement connection timeouts')
    }

    // Alert-based recommendations
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.resolved)
    if (criticalAlerts.length > 0) {
      recommendations.push('Address critical performance alerts immediately')
    }

    return recommendations
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Performance tracking decorators
export function TrackPerformance(metricName?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const name = metricName || `${target.constructor.name}.${propertyName}`

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now()
      
      try {
        const result = await method.apply(this, args)
        const duration = Date.now() - startTime
        
        performanceMonitor.recordMetric(`${name}_duration`, duration, 'ms')
        performanceMonitor.recordMetric(`${name}_success`, 1, 'count')
        
        return result
      } catch (error) {
        const duration = Date.now() - startTime
        
        performanceMonitor.recordMetric(`${name}_duration`, duration, 'ms')
        performanceMonitor.recordMetric(`${name}_error`, 1, 'count')
        
        throw error
      }
    }

    return descriptor
  }
}

// Express middleware for automatic endpoint tracking
export function performanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now()

    res.on('finish', () => {
      const duration = Date.now() - startTime
      const endpoint = `${req.method} ${req.route?.path || req.path}`
      
      performanceMonitor.trackEndpoint(
        endpoint,
        req.method,
        duration,
        res.statusCode
      )
    })

    next()
  }
}