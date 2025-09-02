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
export declare class RateLimiter {
    private redis;
    private config;
    constructor(redis: Redis, config: RateLimitConfig);
    middleware(): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    private generateKey;
    private checkRateLimit;
    private incrementCounter;
}
export declare class DDoSProtection {
    private redis;
    private suspiciousIPs;
    constructor(redis: Redis);
    middleware(): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    unblockIP(ip: string): Promise<void>;
}
//# sourceMappingURL=rateLimiter.d.ts.map