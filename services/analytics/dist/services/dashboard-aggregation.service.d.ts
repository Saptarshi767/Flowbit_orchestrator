import { Logger } from 'winston';
import { DashboardAnalytics, CacheConfig, TimeRange } from '../interfaces/analytics.interface';
import { ElasticsearchPipelineService } from './elasticsearch-pipeline.service';
export declare class DashboardAggregationService {
    private redisClient;
    private elasticsearchService;
    private logger;
    private cacheConfig;
    constructor(elasticsearchService: ElasticsearchPipelineService, logger: Logger, cacheConfig?: CacheConfig);
    private initializeRedis;
    getDashboardData(dashboardId: string, timeRange: TimeRange): Promise<DashboardAnalytics>;
    private aggregateWidgetData;
    private processWidgetResult;
    private processLineChartData;
    private processBarChartData;
    private processGaugeData;
    private processCounterData;
    private processTableData;
    private processHeatmapData;
    private getCachedDashboard;
    private cacheDashboard;
    private getDashboardCacheKey;
    invalidateDashboardCache(dashboardId: string): Promise<void>;
    precomputeDashboard(dashboardId: string, timeRanges: TimeRange[]): Promise<void>;
    getCacheStats(): Promise<any>;
    private getDashboardConfig;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=dashboard-aggregation.service.d.ts.map