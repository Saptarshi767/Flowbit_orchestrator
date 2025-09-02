import { config } from '../config';
export declare const initializeRedis: () => Promise<void>;
export declare const createRateLimiter: (options?: Partial<typeof config.rateLimiting>) => import("express-rate-limit").RateLimitRequestHandler;
export declare const generalRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const authRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const apiRateLimit: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=rateLimiter.d.ts.map