export { KeyManager, keyManager } from './encryption/keyManager';
export { DataEncryption, dataEncryption } from './encryption/dataEncryption';
export { RateLimiter, DDoSProtection } from './rateLimit/rateLimiter';
export { SecurityMiddleware } from './middleware/securityMiddleware';
export { AuditLogger, auditLogger } from './audit/auditLogger';
export { AuditMiddleware, auditMiddleware } from './audit/auditMiddleware';
export { ZeroTrustEngine, zeroTrustEngine } from './zeroTrust/zeroTrustEngine';
export { ZeroTrustMiddleware, zeroTrustMiddleware } from './zeroTrust/zeroTrustMiddleware';
export { VulnerabilityScanner, vulnerabilityScanner } from './scanning/vulnerabilityScanner';
export { SecurityMonitor, securityMonitor } from './monitoring/securityMonitor';
export { SecurityConfigManager, securityConfigManager, securityConfig } from './config/securityConfig';
export type { EncryptionKey, EncryptionResult } from './encryption/keyManager';
export type { EncryptedField } from './encryption/dataEncryption';
export type { RateLimitConfig, RateLimitInfo } from './rateLimit/rateLimiter';
export type { SecurityConfig as MiddlewareSecurityConfig } from './middleware/securityMiddleware';
export type { AuditEvent, AuditChain, AuditProof, AuditExport, AuditStatistics } from './audit/auditLogger';
export type { AuditableRequest } from './audit/auditMiddleware';
export type { TrustScore, SecurityContext, AccessPolicy, AccessDecision } from './zeroTrust/zeroTrustEngine';
export type { ZeroTrustRequest } from './zeroTrust/zeroTrustMiddleware';
export type { VulnerabilityReport, Vulnerability } from './scanning/vulnerabilityScanner';
export type { SecurityMetrics, SecurityAlert, SecurityDashboard } from './monitoring/securityMonitor';
export type { SecurityConfig } from './config/securityConfig';
import Redis from 'ioredis';
export interface SecurityServiceConfig {
    redis: {
        host: string;
        port: number;
        password?: string;
    };
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
export declare class SecurityService {
    private redis;
    private securityMiddleware;
    constructor(config: SecurityServiceConfig);
    getMiddleware(): {
        securityHeaders: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
        cors: (config: import("./middleware/securityMiddleware").SecurityConfig["cors"]) => (req: import("cors").CorsRequest, res: {
            statusCode?: number | undefined;
            setHeader(key: string, value: string): any;
            end(): any;
        }, next: (err?: any) => any) => void;
        rateLimit: (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => Promise<import("express").Response<any, Record<string, any>> | undefined>;
        ddosProtection: (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => Promise<import("express").Response<any, Record<string, any>> | undefined>;
        requestValidation: (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => import("express").Response<any, Record<string, any>> | undefined;
        apiKeyValidation: (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => Promise<import("express").Response<any, Record<string, any>> | undefined>;
        inputSanitization: (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => void;
    };
    getRedisClient(): Redis;
    close(): Promise<void>;
}
export declare function createSecurityService(config: SecurityServiceConfig): SecurityService;
//# sourceMappingURL=index.d.ts.map