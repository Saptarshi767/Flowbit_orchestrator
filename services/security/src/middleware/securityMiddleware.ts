import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { RateLimiter, DDoSProtection } from '../rateLimit/rateLimiter';
import Redis from 'ioredis';

export interface SecurityConfig {
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  helmet: {
    contentSecurityPolicy: boolean;
    hsts: boolean;
  };
}

export class SecurityMiddleware {
  private redis: Redis;
  private rateLimiter: RateLimiter;
  private ddosProtection: DDoSProtection;

  constructor(redis: Redis, config: SecurityConfig) {
    this.redis = redis;
    this.rateLimiter = new RateLimiter(redis, {
      windowMs: config.rateLimit.windowMs,
      maxRequests: config.rateLimit.maxRequests
    });
    this.ddosProtection = new DDoSProtection(redis);
  }

  // Security headers middleware
  securityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }

  // CORS middleware
  corsMiddleware(config: SecurityConfig['cors']) {
    return cors({
      origin: config.origin,
      credentials: config.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    });
  }

  // Rate limiting middleware
  rateLimitMiddleware() {
    return this.rateLimiter.middleware();
  }

  // DDoS protection middleware
  ddosProtectionMiddleware() {
    return this.ddosProtection.middleware();
  }

  // Request validation middleware
  requestValidation() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Validate request size
      const contentLength = parseInt(req.get('content-length') || '0');
      if (contentLength > 10 * 1024 * 1024) { // 10MB limit
        return res.status(413).json({
          error: 'Payload Too Large',
          message: 'Request body exceeds maximum size limit'
        });
      }

      // Validate content type for POST/PUT requests
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return res.status(415).json({
            error: 'Unsupported Media Type',
            message: 'Content-Type must be application/json'
          });
        }
      }

      next();
    };
  }

  // API key validation middleware
  apiKeyValidation() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.get('X-API-Key');
      
      if (!apiKey) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'API key required'
        });
      }

      try {
        // Check if API key is valid and not revoked
        const keyInfo = await this.redis.get(`api_key:${apiKey}`);
        
        if (!keyInfo) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid API key'
          });
        }

        const keyData = JSON.parse(keyInfo);
        
        // Check if key is expired
        if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'API key expired'
          });
        }

        // Add key info to request
        (req as any).apiKey = keyData;
        next();
      } catch (error) {
        console.error('API key validation error:', error);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'API key validation failed'
        });
      }
    };
  }

  // Input sanitization middleware
  inputSanitization() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }
      
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }
      
      next();
    };
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      // Remove potentially dangerous keys
      if (key.startsWith('__') || key.includes('prototype')) {
        continue;
      }

      if (typeof value === 'string') {
        // Basic XSS prevention
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}