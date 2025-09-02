import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
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
export declare class SecurityMiddleware {
    private redis;
    private rateLimiter;
    private ddosProtection;
    constructor(redis: Redis, config: SecurityConfig);
    securityHeaders(): (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
    corsMiddleware(config: SecurityConfig['cors']): (req: cors.CorsRequest, res: {
        statusCode?: number | undefined;
        setHeader(key: string, value: string): any;
        end(): any;
    }, next: (err?: any) => any) => void;
    rateLimitMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    ddosProtectionMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    requestValidation(): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
    apiKeyValidation(): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    inputSanitization(): (req: Request, res: Response, next: NextFunction) => void;
    private sanitizeObject;
}
//# sourceMappingURL=securityMiddleware.d.ts.map