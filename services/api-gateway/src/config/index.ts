export interface Config {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  jwtSecret: string;
  redisUrl: string;
  rateLimiting: {
    windowMs: number;
    max: number;
  };
  logging: {
    level: string;
    format: string;
  };
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per window
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
};