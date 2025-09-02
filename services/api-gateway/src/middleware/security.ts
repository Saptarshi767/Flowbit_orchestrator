import cors from 'cors';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// CORS configuration
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In test environment, allow all origins
    if (process.env.NODE_ENV === 'test') {
      return callback(null, true);
    }
    
    if (config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) {
      return callback(null, true);
    }
    
    // Return false instead of throwing error
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Correlation-ID',
    'X-API-Key'
  ],
  exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
});

// Security headers middleware using Helmet
export const securityMiddleware = helmet({
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
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'same-origin' }
});

// Custom security middleware for additional checks
export const additionalSecurityMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Prevent caching of sensitive endpoints
  if (req.url.includes('/auth') || req.url.includes('/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
};

// API Key validation middleware (for service-to-service communication)
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: {
        code: 'API_KEY_REQUIRED',
        message: 'API key is required for this endpoint'
      },
      meta: {
        correlationId: req.correlationId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });
    return;
  }
  
  // In a real implementation, validate against a database or service
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key provided'
      },
      meta: {
        correlationId: req.correlationId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });
    return;
  }
  
  next();
};