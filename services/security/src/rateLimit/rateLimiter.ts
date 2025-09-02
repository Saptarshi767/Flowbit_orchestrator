import Redis from 'ioredis';
import { Request, Response, NextFunction } from 'express';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

export interface RateLimitInfo {
  totalHits: number;
  totalHitsPerWindow: number;
  resetTime: Date;
  remaining: number;
}

export class RateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(redis: Redis, config: RateLimitConfig) {
    this.redis = redis;
    this.config = config;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.generateKey(req);
        const rateLimitInfo = await this.checkRateLimit(key);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': this.config.maxRequests.toString(),
          'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
          'X-RateLimit-Reset': rateLimitInfo.resetTime.toISOString(),
          'X-RateLimit-Window': this.config.windowMs.toString()
        });

        if (rateLimitInfo.totalHitsPerWindow >= this.config.maxRequests) {
          if (this.config.onLimitReached) {
            this.config.onLimitReached(req, res);
          }

          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: rateLimitInfo.resetTime
          });
        }

        // Increment counter after successful check
        await this.incrementCounter(key);
        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        next(); // Allow request to proceed on rate limiter failure
      }
    };
  }

  private generateKey(req: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    // Default key generation based on IP and user ID
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';
    return `rate_limit:${ip}:${userId}`;
  }

  private async checkRateLimit(key: string): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Use Redis sorted set to track requests in time window
    const pipeline = this.redis.pipeline();
    
    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests in window
    pipeline.zcard(key);
    
    // Set expiration
    pipeline.expire(key, Math.ceil(this.config.windowMs / 1000));
    
    const results = await pipeline.exec();
    const totalHitsPerWindow = results?.[1]?.[1] as number || 0;
    
    const resetTime = new Date(now + this.config.windowMs);
    const remaining = Math.max(0, this.config.maxRequests - totalHitsPerWindow);

    return {
      totalHits: totalHitsPerWindow,
      totalHitsPerWindow,
      resetTime,
      remaining
    };
  }

  private async incrementCounter(key: string): Promise<void> {
    const now = Date.now();
    const score = now;
    const member = `${now}-${Math.random()}`;
    
    await this.redis.zadd(key, score, member);
  }
}

// DDoS Protection middleware
export class DDoSProtection {
  private redis: Redis;
  private suspiciousIPs: Set<string> = new Set();

  constructor(redis: Redis) {
    this.redis = redis;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Check if IP is in suspicious list
      if (this.suspiciousIPs.has(ip)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'IP address blocked due to suspicious activity'
        });
      }

      // Check for rapid requests from same IP
      const rapidRequestKey = `ddos:rapid:${ip}`;
      const rapidCount = await this.redis.incr(rapidRequestKey);
      
      if (rapidCount === 1) {
        await this.redis.expire(rapidRequestKey, 10); // 10 second window
      }

      // Block if more than 100 requests in 10 seconds
      if (rapidCount > 100) {
        this.suspiciousIPs.add(ip);
        await this.redis.setex(`blocked:${ip}`, 3600, '1'); // Block for 1 hour
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'DDoS protection activated'
        });
      }

      next();
    };
  }

  async unblockIP(ip: string): Promise<void> {
    this.suspiciousIPs.delete(ip);
    await this.redis.del(`blocked:${ip}`);
  }
}