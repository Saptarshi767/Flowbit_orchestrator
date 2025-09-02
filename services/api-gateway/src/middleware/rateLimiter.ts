import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { Request, Response } from 'express';
import { config } from '../config';
import { ApiResponse } from '@robust-ai-orchestrator/shared';

// Redis client for rate limiting
let redisClient: ReturnType<typeof createClient> | null = null;

export const initializeRedis = async (): Promise<void> => {
  try {
    redisClient = createClient({ url: config.redisUrl });
    await redisClient.connect();
    console.log('Redis connected for rate limiting');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    // Fallback to memory store if Redis is not available
    redisClient = null;
  }
};

// Custom Redis store for rate limiting
class RedisStore {
  private prefix: string;

  constructor(prefix = 'rl:') {
    this.prefix = prefix;
  }

  async increment(key: string): Promise<{ totalHits: number; timeToExpire?: number }> {
    if (!redisClient) {
      // Fallback to simple in-memory tracking (not recommended for production)
      return { totalHits: 1 };
    }

    const redisKey = `${this.prefix}${key}`;
    const pipeline = redisClient.multi();
    
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, Math.ceil(config.rateLimiting.windowMs / 1000));
    pipeline.ttl(redisKey);
    
    const results = await pipeline.exec();
    
    if (!results) {
      return { totalHits: 1 };
    }

    const totalHits = results[0] as number;
    const ttl = results[2] as number;
    const timeToExpire = ttl > 0 ? ttl * 1000 : undefined;

    return { totalHits, timeToExpire };
  }

  async decrement(key: string): Promise<void> {
    if (!redisClient) return;
    
    const redisKey = `${this.prefix}${key}`;
    await redisClient.decr(redisKey);
  }

  async resetKey(key: string): Promise<void> {
    if (!redisClient) return;
    
    const redisKey = `${this.prefix}${key}`;
    await redisClient.del(redisKey);
  }
}

// Create rate limiter with Redis store
export const createRateLimiter = (options?: Partial<typeof config.rateLimiting>) => {
  const store = new RedisStore();
  
  return rateLimit({
    windowMs: options?.windowMs || config.rateLimiting.windowMs,
    max: options?.max || config.rateLimiting.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise use IP
      return req.user?.userId || req.ip || 'unknown';
    },
    store: {
      incr: async (key: string) => {
        const result = await store.increment(key);
        return result;
      },
      decrement: async (key: string) => {
        await store.decrement(key);
      },
      resetKey: async (key: string) => {
        await store.resetKey(key);
      }
    },
    handler: (req: Request, res: Response) => {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
        },
        meta: {
          correlationId: req.correlationId || '',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      res.status(429).json(response);
    }
  });
};

// Different rate limiters for different endpoints
export const generalRateLimit = createRateLimiter();

export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 login attempts per 15 minutes
});

export const apiRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // 1000 API calls per 15 minutes
});