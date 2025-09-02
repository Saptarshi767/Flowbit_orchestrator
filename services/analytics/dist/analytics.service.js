"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const elasticsearch_pipeline_service_1 = require("./services/elasticsearch-pipeline.service");
const dashboard_aggregation_service_1 = require("./services/dashboard-aggregation.service");
const report_generator_service_1 = require("./services/report-generator.service");
const performance_metrics_service_1 = require("./services/performance-metrics.service");
const usage_billing_service_1 = require("./services/usage-billing.service");
class AnalyticsService {
    constructor(elasticsearchConfig, logger, cacheConfig) {
        this.logger = logger;
        // Initialize services
        this.elasticsearchService = new elasticsearch_pipeline_service_1.ElasticsearchPipelineService(elasticsearchConfig, logger);
        this.dashboardService = new dashboard_aggregation_service_1.DashboardAggregationService(this.elasticsearchService, logger, cacheConfig);
        this.reportService = new report_generator_service_1.ReportGeneratorService(this.elasticsearchService, logger);
        this.performanceService = new performance_metrics_service_1.PerformanceMetricsService(this.elasticsearchService, logger);
        this.usageBillingService = new usage_billing_service_1.UsageBillingService(this.elasticsearchService, logger);
        this.logger.info('Analytics service initialized');
    }
    // Data pipeline operations
    async ingestData(data) {
        return this.elasticsearchService.ingestData(data);
    }
    async queryData(query) {
        return this.elasticsearchService.queryData(query);
    }
    // Dashboard operations
    async getDashboardData(dashboardId, timeRange) {
        return this.dashboardService.getDashboardData(dashboardId, timeRange);
    }
    async createDashboard(dashboard) {
        // This would typically involve database operations
        // For now, returning a mock implementation
        const newDashboard = {
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
    async updateDashboard(dashboardId, updates) {
        // This would typically involve database operations
        // For now, returning a mock implementation
        const updatedDashboard = {
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
    async deleteDashboard(dashboardId) {
        // This would typically involve database operations
        await this.dashboardService.invalidateDashboardCache(dashboardId);
        this.logger.info(`Deleted dashboard: ${dashboardId}`);
    }
    // Report operations
    async generateReport(reportRequest) {
        return this.reportService.generateReport(reportRequest);
    }
    async getReportTypes() {
        return this.reportService.getReportTypes();
    }
    async scheduleReport(schedule) {
        // This would typically involve database operations and cron job scheduling
        const scheduledReport = {
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
    async getPerformanceMetrics(query) {
        return this.performanceService.getPerformanceMetrics(query);
    }
    async getUsageAnalytics(query) {
        return this.usageBillingService.getUsageAnalytics(query);
    }
    async getBillingMetrics(organizationId, timeRange) {
        return this.usageBillingService.getBillingMetrics(organizationId, timeRange);
    }
    // Additional utility methods
    async getAnalyticsSummary(organizationId, timeRange) {
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
        }
        catch (error) {
            this.logger.error('Failed to get analytics summary:', error);
            throw error;
        }
    }
    async getAnalyticsAlerts(organizationId) {
        try {
            const [performanceAlerts, usageAlerts] = await Promise.all([
                this.performanceService.getPerformanceAlerts(organizationId),
                this.usageBillingService.getUsageAlerts(organizationId)
            ]);
            return [...performanceAlerts, ...usageAlerts];
        }
        catch (error) {
            this.logger.error('Failed to get analytics alerts:', error);
            return [];
        }
    }
    async precomputeDashboards(organizationId, dashboardIds) {
        const timeRanges = [
            this.getTimeRange('1h'),
            this.getTimeRange('24h'),
            this.getTimeRange('7d'),
            this.getTimeRange('30d')
        ];
        for (const dashboardId of dashboardIds) {
            try {
                await this.dashboardService.precomputeDashboard(dashboardId, timeRanges);
            }
            catch (error) {
                this.logger.error(`Failed to precompute dashboard ${dashboardId}:`, error);
            }
        }
    }
    async getSystemHealth() {
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
        }
        catch (error) {
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
    async cleanup() {
        try {
            await Promise.all([
                this.elasticsearchService.cleanup(),
                this.dashboardService.cleanup(),
                this.reportService.cleanup()
            ]);
            this.logger.info('Analytics service cleaned up');
        }
        catch (error) {
            this.logger.error('Error during cleanup:', error);
        }
    }
    // Private utility methods
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    getTimeRange(duration) {
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
exports.AnalyticsService = AnalyticsService;
//# sourceMappingURL=analytics.service.js.map