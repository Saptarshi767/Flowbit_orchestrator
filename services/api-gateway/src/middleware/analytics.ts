import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { config } from '../config';

export interface AnalyticsRequest extends Request {
  startTime?: number;
  endTime?: number;
  responseSize?: number;
}

export interface ApiUsageMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  responseSize: number;
  userId?: string;
  organizationId?: string;
  apiVersion: string;
  userAgent: string;
  ipAddress: string;
  timestamp: Date;
  correlationId: string;
}

export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalResponseSize: number;
  uniqueUsers: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  errorRates: Record<string, number>;
}

class ApiAnalyticsService {
  public redisClient: any;
  private metricsBuffer: ApiUsageMetrics[] = [];
  private bufferSize = 100;
  private flushInterval = 30000; // 30 seconds

  constructor() {
    this.initializeRedis();
    this.startPeriodicFlush();
  }

  private async initializeRedis() {
    try {
      this.redisClient = createClient({
        url: config.redisUrl
      });
      
      this.redisClient.on('error', (err: Error) => {
        console.error('Redis Analytics Client Error:', err);
      });

      await this.redisClient.connect();
      console.log('Analytics Redis client connected');
    } catch (error) {
      console.error('Failed to initialize analytics Redis client:', error);
    }
  }

  private startPeriodicFlush() {
    setInterval(() => {
      this.flushMetrics();
    }, this.flushInterval);
  }

  /**
   * Record API usage metrics
   */
  async recordMetrics(metrics: ApiUsageMetrics): Promise<void> {
    try {
      // Add to buffer
      this.metricsBuffer.push(metrics);

      // Flush if buffer is full
      if (this.metricsBuffer.length >= this.bufferSize) {
        await this.flushMetrics();
      }

      // Update real-time counters in Redis
      await this.updateRealTimeCounters(metrics);
    } catch (error) {
      console.error('Failed to record API metrics:', error);
    }
  }

  /**
   * Flush metrics buffer to persistent storage
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metricsToFlush = [...this.metricsBuffer];
      this.metricsBuffer = [];

      // Store in Redis with TTL for time-series data
      const pipeline = this.redisClient.multi();
      
      for (const metric of metricsToFlush) {
        const key = `api:metrics:${metric.timestamp.toISOString().split('T')[0]}`;
        pipeline.lPush(key, JSON.stringify(metric));
        pipeline.expire(key, 86400 * 30); // Keep for 30 days
      }

      await pipeline.exec();
      console.log(`Flushed ${metricsToFlush.length} API metrics to Redis`);
    } catch (error) {
      console.error('Failed to flush API metrics:', error);
    }
  }

  /**
   * Update real-time counters
   */
  private async updateRealTimeCounters(metrics: ApiUsageMetrics): Promise<void> {
    if (!this.redisClient) return;

    try {
      const pipeline = this.redisClient.multi();
      const timestamp = new Date();
      const hourKey = `api:stats:hour:${timestamp.getFullYear()}-${timestamp.getMonth() + 1}-${timestamp.getDate()}-${timestamp.getHours()}`;
      const dayKey = `api:stats:day:${timestamp.toISOString().split('T')[0]}`;

      // Increment counters
      pipeline.hIncrBy(hourKey, 'total_requests', 1);
      pipeline.hIncrBy(dayKey, 'total_requests', 1);

      if (metrics.statusCode >= 200 && metrics.statusCode < 400) {
        pipeline.hIncrBy(hourKey, 'successful_requests', 1);
        pipeline.hIncrBy(dayKey, 'successful_requests', 1);
      } else {
        pipeline.hIncrBy(hourKey, 'failed_requests', 1);
        pipeline.hIncrBy(dayKey, 'failed_requests', 1);
      }

      // Track response times
      pipeline.hIncrBy(hourKey, 'total_response_time', metrics.responseTime);
      pipeline.hIncrBy(dayKey, 'total_response_time', metrics.responseTime);

      // Track response sizes
      pipeline.hIncrBy(hourKey, 'total_response_size', metrics.responseSize);
      pipeline.hIncrBy(dayKey, 'total_response_size', metrics.responseSize);

      // Track unique users
      if (metrics.userId) {
        pipeline.sAdd(`${hourKey}:users`, metrics.userId);
        pipeline.sAdd(`${dayKey}:users`, metrics.userId);
      }

      // Track endpoints
      pipeline.zIncrBy(`${hourKey}:endpoints`, 1, `${metrics.method} ${metrics.endpoint}`);
      pipeline.zIncrBy(`${dayKey}:endpoints`, 1, `${metrics.method} ${metrics.endpoint}`);

      // Track API versions
      pipeline.hIncrBy(`${hourKey}:versions`, metrics.apiVersion, 1);
      pipeline.hIncrBy(`${dayKey}:versions`, metrics.apiVersion, 1);

      // Set expiration
      pipeline.expire(hourKey, 86400 * 7); // Keep hourly stats for 7 days
      pipeline.expire(dayKey, 86400 * 90); // Keep daily stats for 90 days
      pipeline.expire(`${hourKey}:users`, 86400 * 7);
      pipeline.expire(`${dayKey}:users`, 86400 * 90);
      pipeline.expire(`${hourKey}:endpoints`, 86400 * 7);
      pipeline.expire(`${dayKey}:endpoints`, 86400 * 90);

      await pipeline.exec();
    } catch (error) {
      console.error('Failed to update real-time counters:', error);
    }
  }

  /**
   * Get usage statistics for a time period
   */
  async getUsageStats(period: 'hour' | 'day', date?: string): Promise<UsageStats | null> {
    if (!this.redisClient) return null;

    try {
      const key = date 
        ? `api:stats:${period}:${date}`
        : `api:stats:${period}:${new Date().toISOString().split('T')[0]}`;

      const [stats, users, endpoints] = await Promise.all([
        this.redisClient.hGetAll(key),
        this.redisClient.sCard(`${key}:users`),
        this.redisClient.zRevRange(`${key}:endpoints`, 0, 9, { BY: 'SCORE', REV: true })
      ]);

      const totalRequests = parseInt(stats.total_requests || '0');
      const successfulRequests = parseInt(stats.successful_requests || '0');
      const failedRequests = parseInt(stats.failed_requests || '0');
      const totalResponseTime = parseInt(stats.total_response_time || '0');
      const totalResponseSize = parseInt(stats.total_response_size || '0');

      return {
        totalRequests,
        successfulRequests,
        failedRequests,
        averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
        totalResponseSize,
        uniqueUsers: users,
        topEndpoints: endpoints.map((endpoint: any) => ({
          endpoint: endpoint.value,
          count: endpoint.score
        })),
        errorRates: {
          '4xx': failedRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
          '5xx': 0 // Would need more detailed tracking
        }
      };
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return null;
    }
  }

  /**
   * Get API version usage distribution
   */
  async getVersionUsage(period: 'hour' | 'day', date?: string): Promise<Record<string, number>> {
    if (!this.redisClient) return {};

    try {
      const key = date 
        ? `api:stats:${period}:${date}:versions`
        : `api:stats:${period}:${new Date().toISOString().split('T')[0]}:versions`;

      return await this.redisClient.hGetAll(key) || {};
    } catch (error) {
      console.error('Failed to get version usage:', error);
      return {};
    }
  }
}

// Singleton instance
const analyticsService = new ApiAnalyticsService();

/**
 * Analytics middleware to track API usage
 */
export const analyticsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const analyticsReq = req as AnalyticsRequest;
  analyticsReq.startTime = Date.now();

  // Override res.json to capture response size
  const originalJson = res.json;
  res.json = function(body: any) {
    analyticsReq.endTime = Date.now();
    analyticsReq.responseSize = JSON.stringify(body).length;

    // Record metrics asynchronously
    setImmediate(async () => {
      try {
        const metrics: ApiUsageMetrics = {
          endpoint: analyticsReq.route?.path || analyticsReq.path,
          method: analyticsReq.method,
          statusCode: res.statusCode,
          responseTime: (analyticsReq.endTime || Date.now()) - (analyticsReq.startTime || Date.now()),
          responseSize: analyticsReq.responseSize || 0,
          userId: (analyticsReq as any).user?.userId,
          organizationId: (analyticsReq as any).user?.organizationId,
          apiVersion: (analyticsReq as any).apiVersion || '1.1',
          userAgent: analyticsReq.get('User-Agent') || '',
          ipAddress: analyticsReq.ip || (analyticsReq.connection as any)?.remoteAddress || '',
          timestamp: new Date(),
          correlationId: (analyticsReq as any).correlationId || ''
        };

        await analyticsService.recordMetrics(metrics);
      } catch (error) {
        console.error('Failed to record analytics:', error);
      }
    });

    return originalJson.call(this, body);
  };

  next();
};

/**
 * Rate limiting based on usage analytics
 */
export const usageBasedRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const organizationId = (req as any).user?.organizationId;

    if (!userId && !organizationId) {
      next();
      return;
    }

    // Get current hour usage
    const currentHour = new Date().toISOString().slice(0, 13);
    const usageKey = `api:usage:${organizationId || userId}:${currentHour}`;
    
    const currentUsage = await analyticsService.redisClient?.get(usageKey) || 0;
    const usageLimit = getUserUsageLimit((req as any).user?.plan || 'free');

    if (parseInt(currentUsage) >= usageLimit) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'API usage limit exceeded for this hour',
          details: {
            currentUsage: parseInt(currentUsage),
            limit: usageLimit,
            resetTime: new Date(Date.now() + (60 - new Date().getMinutes()) * 60 * 1000).toISOString()
          }
        },
        meta: {
          correlationId: (req as any).correlationId || '',
          timestamp: new Date().toISOString(),
          version: '1.1'
        }
      });
      return;
    }

    // Increment usage counter
    await analyticsService.redisClient?.multi()
      .incr(usageKey)
      .expire(usageKey, 3600) // Expire after 1 hour
      .exec();

    next();
  } catch (error) {
    console.error('Usage-based rate limiting error:', error);
    next(); // Continue on error
  }
};

/**
 * Get usage limit based on user plan
 */
const getUserUsageLimit = (plan: string): number => {
  const limits = {
    free: 100,
    pro: 1000,
    enterprise: 10000
  };
  return limits[plan as keyof typeof limits] || limits.free;
};

/**
 * Analytics endpoint handlers
 */
export const getAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'day', date } = req.query;
    
    const stats = await analyticsService.getUsageStats(period as 'hour' | 'day', date as string);
    const versionUsage = await analyticsService.getVersionUsage(period as 'hour' | 'day', date as string);

    res.json({
      success: true,
      data: {
        stats,
        versionUsage,
        period,
        date: date || new Date().toISOString().split('T')[0]
      },
      meta: {
        correlationId: (req as any).correlationId || '',
        timestamp: new Date().toISOString(),
        version: '1.1'
      }
    });
  } catch (error) {
    console.error('Failed to get analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to retrieve analytics data'
      },
      meta: {
        correlationId: (req as any).correlationId || '',
        timestamp: new Date().toISOString(),
        version: '1.1'
      }
    });
  }
};

export { analyticsService };