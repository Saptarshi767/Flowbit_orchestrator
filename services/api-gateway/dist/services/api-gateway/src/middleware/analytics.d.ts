import { Request, Response, NextFunction } from 'express';
export interface AnalyticsRequest extends Request {
    startTime?: number;
    endTime?: number;
    responseSize?: number;
}
export interface ApiUsageMetrics {
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    responseSize: number;
    userId?: string;
    organizationId?: string;
    apiVersion: string;
    userAgent: string;
    ipAddress: string;
    timestamp: Date;
    correlationId: string;
}
export interface UsageStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    totalResponseSize: number;
    uniqueUsers: number;
    topEndpoints: Array<{
        endpoint: string;
        count: number;
    }>;
    errorRates: Record<string, number>;
}
declare class ApiAnalyticsService {
    redisClient: any;
    private metricsBuffer;
    private bufferSize;
    private flushInterval;
    constructor();
    private initializeRedis;
    private startPeriodicFlush;
    /**
     * Record API usage metrics
     */
    recordMetrics(metrics: ApiUsageMetrics): Promise<void>;
    /**
     * Flush metrics buffer to persistent storage
     */
    private flushMetrics;
    /**
     * Update real-time counters
     */
    private updateRealTimeCounters;
    /**
     * Get usage statistics for a time period
     */
    getUsageStats(period: 'hour' | 'day', date?: string): Promise<UsageStats | null>;
    /**
     * Get API version usage distribution
     */
    getVersionUsage(period: 'hour' | 'day', date?: string): Promise<Record<string, number>>;
}
declare const analyticsService: ApiAnalyticsService;
/**
 * Analytics middleware to track API usage
 */
export declare const analyticsMiddleware: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Rate limiting based on usage analytics
 */
export declare const usageBasedRateLimit: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Analytics endpoint handlers
 */
export declare const getAnalytics: (req: Request, res: Response) => Promise<void>;
export { analyticsService };
//# sourceMappingURL=analytics.d.ts.map