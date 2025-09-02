import { TimeRange, ReportFormat, ReportType as SharedReportType } from '@robust-ai-orchestrator/shared';
export interface IAnalyticsService {
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
    cleanup(): Promise<void>;
}
export interface AnalyticsData {
    timestamp: Date;
    source: string;
    type: AnalyticsDataType;
    data: Record<string, any>;
    metadata?: Record<string, any>;
    organizationId: string;
    userId?: string;
}
export declare enum AnalyticsDataType {
    EXECUTION = "execution",
    WORKFLOW = "workflow",
    USER_ACTION = "user_action",
    SYSTEM_METRIC = "system_metric",
    PERFORMANCE = "performance",
    BILLING = "billing"
}
export interface AnalyticsQuery {
    index: string;
    query: ElasticsearchQuery;
    timeRange?: TimeRange;
    aggregations?: Record<string, any>;
    size?: number;
    from?: number;
    sort?: Array<Record<string, any>>;
}
export interface ElasticsearchQuery {
    bool?: {
        must?: any[];
        should?: any[];
        must_not?: any[];
        filter?: any[];
    };
    match?: Record<string, any>;
    range?: Record<string, any>;
    term?: Record<string, any>;
    terms?: Record<string, any>;
    exists?: {
        field: string;
    };
    wildcard?: Record<string, any>;
}
export interface AnalyticsResult {
    hits: {
        total: {
            value: number;
        };
        hits: Array<{
            _source: any;
            _score: number;
        }>;
    };
    aggregations?: Record<string, any>;
    took: number;
}
export interface DashboardAnalytics {
    id: string;
    name: string;
    widgets: WidgetData[];
    lastUpdated: Date;
    cacheExpiry?: Date;
}
export interface WidgetData {
    id: string;
    type: string;
    title: string;
    data: any;
    config: Record<string, any>;
    lastUpdated: Date;
}
export interface CreateDashboardRequest {
    name: string;
    description?: string;
    widgets: CreateWidgetRequest[];
    organizationId: string;
    isPublic?: boolean;
}
export interface CreateWidgetRequest {
    type: string;
    title: string;
    query: AnalyticsQuery;
    config: Record<string, any>;
    position: WidgetPosition;
}
export interface WidgetPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface UpdateDashboardRequest {
    name?: string;
    description?: string;
    widgets?: CreateWidgetRequest[];
    isPublic?: boolean;
}
export interface Dashboard {
    id: string;
    name: string;
    description?: string;
    widgets: Widget[];
    organizationId: string;
    createdBy: string;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface Widget {
    id: string;
    dashboardId: string;
    type: string;
    title: string;
    query: AnalyticsQuery;
    config: Record<string, any>;
    position: WidgetPosition;
    createdAt: Date;
    updatedAt: Date;
}
export interface ReportRequest {
    type: string;
    name: string;
    parameters: Record<string, any>;
    format: ReportFormat;
    organizationId: string;
    userId: string;
    timeRange?: TimeRange;
}
export interface ReportType extends SharedReportType {
    supportedFormats: ReportFormat[];
}
export interface Report {
    id: string;
    type: string;
    name: string;
    generatedAt: Date;
    parameters: Record<string, any>;
    format: ReportFormat;
    data: any;
    filePath?: string;
    organizationId: string;
    userId: string;
    status: ReportStatus;
    error?: string;
}
export declare enum ReportStatus {
    PENDING = "pending",
    GENERATING = "generating",
    COMPLETED = "completed",
    FAILED = "failed"
}
export interface ReportSchedule {
    id?: string;
    reportType: string;
    name: string;
    cronExpression: string;
    parameters: Record<string, any>;
    format: ReportFormat;
    organizationId: string;
    userId: string;
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
}
export interface ScheduledReport {
    id: string;
    reportType: string;
    name: string;
    cronExpression: string;
    parameters: Record<string, any>;
    format: ReportFormat;
    organizationId: string;
    userId: string;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastRun?: Date;
    nextRun?: Date;
}
export interface PerformanceQuery {
    organizationId: string;
    timeRange: TimeRange;
    metrics: string[];
    groupBy?: string[];
    filters?: Record<string, any>;
}
export interface PerformanceMetrics {
    timeRange: TimeRange;
    metrics: {
        executionDuration: MetricData;
        throughput: MetricData;
        errorRate: MetricData;
        resourceUtilization: MetricData;
        customMetrics: Record<string, MetricData>;
    };
    trends: {
        [metric: string]: TrendData;
    };
}
export interface MetricData {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
    timeSeries: TimeSeriesPoint[];
}
export interface TimeSeriesPoint {
    timestamp: Date;
    value: number;
}
export interface TrendData {
    direction: 'up' | 'down' | 'stable';
    strength: 'weak' | 'moderate' | 'strong';
    confidence: number;
}
export interface UsageQuery {
    organizationId: string;
    timeRange: TimeRange;
    groupBy?: string[];
    includeUsers?: boolean;
    includeWorkflows?: boolean;
}
export interface UsageAnalytics {
    timeRange: TimeRange;
    totalExecutions: number;
    uniqueUsers: number;
    activeWorkflows: number;
    topWorkflows: WorkflowUsage[];
    topUsers: UserUsage[];
    executionsByEngine: Record<string, number>;
    executionsByStatus: Record<string, number>;
    timeSeries: TimeSeriesPoint[];
}
export interface WorkflowUsage {
    workflowId: string;
    workflowName: string;
    executions: number;
    successRate: number;
    avgDuration: number;
}
export interface UserUsage {
    userId: string;
    userName: string;
    executions: number;
    workflows: number;
    lastActivity: Date;
}
export interface BillingMetrics {
    organizationId: string;
    timeRange: TimeRange;
    totalCost: number;
    costByService: Record<string, number>;
    costByUser: Record<string, number>;
    executionCosts: {
        total: number;
        byEngine: Record<string, number>;
        byDuration: TimeSeriesPoint[];
    };
    resourceCosts: {
        compute: number;
        storage: number;
        network: number;
    };
    projectedCost: number;
    costTrends: TrendData;
}
export interface CacheConfig {
    ttl: number;
    maxSize: number;
    enabled: boolean;
}
export interface ElasticsearchConfig {
    node: string;
    auth?: {
        username: string;
        password: string;
    };
    ssl?: {
        ca?: string;
        rejectUnauthorized?: boolean;
    };
    requestTimeout?: number;
    maxRetries?: number;
}
//# sourceMappingURL=analytics.interface.d.ts.map