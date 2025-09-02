"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
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
//# sourceMappingURL=index.js.map