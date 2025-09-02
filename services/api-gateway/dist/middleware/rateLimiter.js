"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRateLimit = exports.authRateLimit = exports.generalRateLimit = exports.createRateLimiter = exports.initializeRedis = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const redis_1 = require("redis");
const config_1 = require("../config");
// Redis client for rate limiting
let redisClient = null;
const initializeRedis = async () => {
    try {
        redisClient = (0, redis_1.createClient)({ url: config_1.config.redisUrl });
        await redisClient.connect();
        console.log('Redis connected for rate limiting');
    }
    catch (error) {
        console.error('Failed to connect to Redis:', error);
        // Fallback to memory store if Redis is not available
        redisClient = null;
    }
};
exports.initializeRedis = initializeRedis;
// Custom Redis store for rate limiting
class RedisStore {
    constructor(prefix = 'rl:') {
        this.prefix = prefix;
    }
    async increment(key) {
        if (!redisClient) {
            // Fallback to simple in-memory tracking (not recommended for production)
            return { totalHits: 1 };
        }
        const redisKey = `${this.prefix}${key}`;
        const pipeline = redisClient.multi();
        pipeline.incr(redisKey);
        pipeline.expire(redisKey, Math.ceil(config_1.config.rateLimiting.windowMs / 1000));
        pipeline.ttl(redisKey);
        const results = await pipeline.exec();
        if (!results) {
            return { totalHits: 1 };
        }
        const totalHits = results[0];
        const ttl = results[2];
        const timeToExpire = ttl > 0 ? ttl * 1000 : undefined;
        return { totalHits, timeToExpire };
    }
    async decrement(key) {
        if (!redisClient)
            return;
        const redisKey = `${this.prefix}${key}`;
        await redisClient.decr(redisKey);
    }
    async resetKey(key) {
        if (!redisClient)
            return;
        const redisKey = `${this.prefix}${key}`;
        await redisClient.del(redisKey);
    }
}
// Create rate limiter with Redis store
const createRateLimiter = (options) => {
    const store = new RedisStore();
    return (0, express_rate_limit_1.default)({
        windowMs: options?.windowMs || config_1.config.rateLimiting.windowMs,
        max: options?.max || config_1.config.rateLimiting.max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Use user ID if authenticated, otherwise use IP
            return req.user?.userId || req.ip;
        },
        store: {
            incr: async (key) => {
                const result = await store.increment(key);
                return result;
            },
            decrement: async (key) => {
                await store.decrement(key);
            },
            resetKey: async (key) => {
                await store.resetKey(key);
            }
        },
        handler: (req, res) => {
            const response = {
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
exports.createRateLimiter = createRateLimiter;
// Different rate limiters for different endpoints
exports.generalRateLimit = (0, exports.createRateLimiter)();
exports.authRateLimit = (0, exports.createRateLimiter)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // 5 login attempts per 15 minutes
});
exports.apiRateLimit = (0, exports.createRateLimiter)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // 1000 API calls per 15 minutes
});
//# sourceMappingURL=rateLimiter.js.map