import { Logger } from 'winston';
import { IAnalyticsService, AnalyticsData, AnalyticsQuery, AnalyticsResult, DashboardAnalytics, Dashboard, CreateDashboardRequest, UpdateDashboardRequest, ReportRequest, Report, ReportType, ReportSchedule, ScheduledReport, PerformanceQuery, PerformanceMetrics, UsageQuery, UsageAnalytics, BillingMetrics, TimeRange, ElasticsearchConfig, CacheConfig } from './interfaces/analytics.interface';
export declare class AnalyticsService implements IAnalyticsService {
    private elasticsearchService;
    private dashboardService;
    private reportService;
    private performanceService;
    private usageBillingService;
    private logger;
    constructor(elasticsearchConfig: ElasticsearchConfig, logger: Logger, cacheConfig?: CacheConfig);
    ingestData(data: AnalyticsData): Promise<void>;
    queryData(query: AnalyticsQuery): Promise<AnalyticsResult>;
    getDashboardData(dashboardId: string, timeRange: TimeRange): Promise<DashboardAnalytics>;
    createDashboard(dashboard: CreateDashboardRequest): Promise<Dashboard>;
    updateDashboard(dashboardId: string, updates: UpdateDashboardRequest): Promise<Dashboard>;
    deleteDashboard(dashboardId: string): Promise<void>;
    generateReport(reportRequest: ReportRequest): Promise<Report>;
    getReportTypes(): Promise<ReportType[]>;
    scheduleReport(schedule: ReportSchedule): Promise<ScheduledReport>;
    getPerformanceMetrics(query: PerformanceQuery): Promise<PerformanceMetrics>;
    getUsageAnalytics(query: UsageQuery): Promise<UsageAnalytics>;
    getBillingMetrics(organizationId: string, timeRange: TimeRange): Promise<BillingMetrics>;
    getAnalyticsSummary(organizationId: string, timeRange: TimeRange): Promise<any>;
    getAnalyticsAlerts(organizationId: string): Promise<any[]>;
    precomputeDashboards(organizationId: string, dashboardIds: string[]): Promise<void>;
    getSystemHealth(): Promise<any>;
    cleanup(): Promise<void>;
    private generateId;
    private getTimeRange;
}
//# sourceMappingURL=analytics.service.d.ts.map