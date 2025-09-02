"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DDoSProtection = exports.RateLimiter = void 0;
class RateLimiter {
    constructor(redis, config) {
        this.redis = redis;
        this.config = config;
    }
    middleware() {
        return async (req, res, next) => {
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
            }
            catch (error) {
                console.error('Rate limiting error:', error);
                next(); // Allow request to proceed on rate limiter failure
            }
        };
    }
    generateKey(req) {
        if (this.config.keyGenerator) {
            return this.config.keyGenerator(req);
        }
        // Default key generation based on IP and user ID
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const userId = req.user?.id || 'anonymous';
        return `rate_limit:${ip}:${userId}`;
    }
    async checkRateLimit(key) {
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
        const totalHitsPerWindow = results?.[1]?.[1] || 0;
        const resetTime = new Date(now + this.config.windowMs);
        const remaining = Math.max(0, this.config.maxRequests - totalHitsPerWindow);
        return {
            totalHits: totalHitsPerWindow,
            totalHitsPerWindow,
            resetTime,
            remaining
        };
    }
    async incrementCounter(key) {
        const now = Date.now();
        const score = now;
        const member = `${now}-${Math.random()}`;
        await this.redis.zadd(key, score, member);
    }
}
exports.RateLimiter = RateLimiter;
// DDoS Protection middleware
class DDoSProtection {
    constructor(redis) {
        this.suspiciousIPs = new Set();
        this.redis = redis;
    }
    middleware() {
        return async (req, res, next) => {
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
    async unblockIP(ip) {
        this.suspiciousIPs.delete(ip);
        await this.redis.del(`blocked:${ip}`);
    }
}
exports.DDoSProtection = DDoSProtection;
//# sourceMappingURL=rateLimiter.js.map