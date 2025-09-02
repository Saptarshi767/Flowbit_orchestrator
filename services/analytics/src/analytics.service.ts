import { Logger } from 'winston';
import { 
  IAnalyticsService,
  AnalyticsData,
  AnalyticsQuery,
  AnalyticsResult,
  DashboardAnalytics,
  Dashboard,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  ReportRequest,
  Report,
  ReportType,
  ReportSchedule,
  ScheduledReport,
  PerformanceQuery,
  PerformanceMetrics,
  UsageQuery,
  UsageAnalytics,
  BillingMetrics,
  TimeRange,
  ElasticsearchConfig,
  CacheConfig
} from './interfaces/analytics.interface';
import { ElasticsearchPipelineService } from './services/elasticsearch-pipeline.service';
import { DashboardAggregationService } from './services/dashboard-aggregation.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { PerformanceMetricsService } from './services/performance-metrics.service';
import { UsageBillingService } from './services/usage-billing.service';

export class AnalyticsService implements IAnalyticsService {
  private elasticsearchService: ElasticsearchPipelineService;
  private dashboardService: DashboardAggregationService;
  private reportService: ReportGeneratorService;
  private performanceService: PerformanceMetricsService;
  private usageBillingService: UsageBillingService;
  private logger: Logger;

  constructor(
    elasticsearchConfig: ElasticsearchConfig,
    logger: Logger,
    cacheConfig?: CacheConfig
  ) {
    this.logger = logger;

    // Initialize services
    this.elasticsearchService = new ElasticsearchPipelineService(elasticsearchConfig, logger);
    this.dashboardService = new DashboardAggregationService(this.elasticsearchService, logger, cacheConfig);
    this.reportService = new ReportGeneratorService(this.elasticsearchService, logger);
    this.performanceService = new PerformanceMetricsService(this.elasticsearchService, logger);
    this.usageBillingService = new UsageBillingService(this.elasticsearchService, logger);

    this.logger.info('Analytics service initialized');
  }

  // Data pipeline operations
  async ingestData(data: AnalyticsData): Promise<void> {
    return this.elasticsearchService.ingestData(data);
  }

  async queryData(query: AnalyticsQuery): Promise<AnalyticsResult> {
    return this.elasticsearchService.queryData(query);
  }

  // Dashboard operations
  async getDashboardData(dashboardId: string, timeRange: TimeRange): Promise<DashboardAnalytics> {
    return this.dashboardService.getDashboardData(dashboardId, timeRange);
  }

  async createDashboard(dashboard: CreateDashboardRequest): Promise<Dashboard> {
    // This would typically involve database operations
    // For now, returning a mock implementation
    const newDashboard: Dashboard = {
      id: this.generateId(),
      name: dashboard.name,
      description: dashboard.description,
      widgets: dashboard.widgets.map(widget => ({
        id: this.generateId(),
        dashboardId: '',
        type: widget.type,
        title: widget.title,
        query: widget.query,
        config: widget.config,
        position: widget.position,
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      organizationId: dashboard.organizationId,
      createdBy: 'system', // Would come from auth context
      isPublic: dashboard.isPublic || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Update widget dashboard IDs
    newDashboard.widgets.forEach(widget => {
      widget.dashboardId = newDashboard.id;
    });

    this.logger.info(`Created dashboard: ${newDashboard.id}`);
    return newDashboard;
  }

  async updateDashboard(dashboardId: string, updates: UpdateDashboardRequest): Promise<Dashboard> {
    // This would typically involve database operations
    // For now, returning a mock implementation
    const updatedDashboard: Dashboard = {
      id: dashboardId,
      name: updates.name || `Dashboard ${dashboardId}`,
      description: updates.description,
      widgets: updates.widgets?.map(widget => ({
        id: this.generateId(),
        dashboardId,
        type: widget.type,
        title: widget.title,
        query: widget.query,
        config: widget.config,
        position: widget.position,
        createdAt: new Date(),
        updatedAt: new Date()
      })) || [],
      organizationId: 'org-1', // Would come from database
      createdBy: 'system',
      isPublic: updates.isPublic || false,
      createdAt: new Date(), // Would come from database
      updatedAt: new Date()
    };

    // Invalidate dashboard cache
    await this.dashboardService.invalidateDashboardCache(dashboardId);

    this.logger.info(`Updated dashboard: ${dashboardId}`);
    return updatedDashboard;
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    // This would typically involve database operations
    await this.dashboardService.invalidateDashboardCache(dashboardId);
    this.logger.info(`Deleted dashboard: ${dashboardId}`);
  }

  // Report operations
  async generateReport(reportRequest: ReportRequest): Promise<Report> {
    return this.reportService.generateReport(reportRequest);
  }

  async getReportTypes(): Promise<ReportType[]> {
    return this.reportService.getReportTypes();
  }

  async scheduleReport(schedule: ReportSchedule): Promise<ScheduledReport> {
    // This would typically involve database operations and cron job scheduling
    const scheduledReport: ScheduledReport = {
      id: schedule.id || this.generateId(),
      reportType: schedule.reportType,
      name: schedule.name,
      cronExpression: schedule.cronExpression,
      parameters: schedule.parameters,
      format: schedule.format,
      organizationId: schedule.organizationId,
      userId: schedule.userId,
      enabled: schedule.enabled,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastRun: schedule.lastRun,
      nextRun: schedule.nextRun
    };

    this.logger.info(`Scheduled report: ${scheduledReport.id}`);
    return scheduledReport;
  }

  // Performance metrics
  async getPerformanceMetrics(query: PerformanceQuery): Promise<PerformanceMetrics> {
    return this.performanceService.getPerformanceMetrics(query);
  }

  async getUsageAnalytics(query: UsageQuery): Promise<UsageAnalytics> {
    return this.usageBillingService.getUsageAnalytics(query);
  }

  async getBillingMetrics(organizationId: string, timeRange: TimeRange): Promise<BillingMetrics> {
    return this.usageBillingService.getBillingMetrics(organizationId, timeRange);
  }

  // Additional utility methods
  async getAnalyticsSummary(organizationId: string, timeRange: TimeRange): Promise<any> {
    try {
      const [performance, usage, billing] = await Promise.all([
        this.performanceService.getPerformanceSummary(organizationId, timeRange),
        this.usageBillingService.getUsageSummary(organizationId, timeRange),
        this.usageBillingService.getBillingMetrics(organizationId, timeRange)
      ]);

      return {
        timeRange,
        performance: {
          avgExecutionTime: performance.summary.avgExecutionTime,
          totalExecutions: performance.summary.totalExecutions,
          errorRate: performance.summary.errorRate,
          trends: performance.trends
        },
        usage: {
          totalExecutions: usage.usage.totalExecutions,
          uniqueUsers: usage.usage.uniqueUsers,
          activeWorkflows: usage.usage.activeWorkflows,
          mostUsedEngine: usage.usage.mostUsedEngine
        },
        billing: {
          totalCost: billing.totalCost,
          projectedCost: billing.projectedCost,
          costTrend: billing.costTrends.direction
        }
      };
    } catch (error) {
      this.logger.error('Failed to get analytics summary:', error);
      throw error;
    }
  }

  async getAnalyticsAlerts(organizationId: string): Promise<any[]> {
    try {
      const [performanceAlerts, usageAlerts] = await Promise.all([
        this.performanceService.getPerformanceAlerts(organizationId),
        this.usageBillingService.getUsageAlerts(organizationId)
      ]);

      return [...performanceAlerts, ...usageAlerts];
    } catch (error) {
      this.logger.error('Failed to get analytics alerts:', error);
      return [];
    }
  }

  async precomputeDashboards(organizationId: string, dashboardIds: string[]): Promise<void> {
    const timeRanges: TimeRange[] = [
      this.getTimeRange('1h'),
      this.getTimeRange('24h'),
      this.getTimeRange('7d'),
      this.getTimeRange('30d')
    ];

    for (const dashboardId of dashboardIds) {
      try {
        await this.dashboardService.precomputeDashboard(dashboardId, timeRanges);
      } catch (error) {
        this.logger.error(`Failed to precompute dashboard ${dashboardId}:`, error);
      }
    }
  }

  async getSystemHealth(): Promise<any> {
    try {
      const [elasticsearchHealth, cacheStats] = await Promise.all([
        this.elasticsearchService.healthCheck(),
        this.dashboardService.getCacheStats()
      ]);

      return {
        elasticsearch: elasticsearchHealth,
        cache: cacheStats,
        services: {
          dashboard: 'healthy',
          reports: 'healthy',
          performance: 'healthy',
          billing: 'healthy'
        },
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to get system health:', error);
      return {
        elasticsearch: { status: 'unhealthy' },
        cache: null,
        services: {
          dashboard: 'unhealthy',
          reports: 'unhealthy',
          performance: 'unhealthy',
          billing: 'unhealthy'
        },
        timestamp: new Date()
      };
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      await Promise.all([
        this.elasticsearchService.cleanup(),
        this.dashboardService.cleanup(),
        this.reportService.cleanup()
      ]);
      this.logger.info('Analytics service cleaned up');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }

  // Private utility methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getTimeRange(duration: string): TimeRange {
    const end = new Date();
    const start = new Date();

    switch (duration) {
      case '1h':
        start.setHours(start.getHours() - 1);
        break;
      case '24h':
        start.setDate(start.getDate() - 1);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      default:
        start.setDate(start.getDate() - 1);
    }

    return { start, end };
  }
}