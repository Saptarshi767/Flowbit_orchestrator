"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAnalyticsRoutes = createAnalyticsRoutes;
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const analytics_interface_1 = require("../interfaces/analytics.interface");
function createAnalyticsRoutes(analyticsService, logger) {
    const router = (0, express_1.Router)();
    // Validation schemas
    const timeRangeSchema = joi_1.default.object({
        start: joi_1.default.date().required(),
        end: joi_1.default.date().min(joi_1.default.ref('start')).required()
    });
    const analyticsDataSchema = joi_1.default.object({
        timestamp: joi_1.default.date().default(() => new Date()),
        source: joi_1.default.string().required(),
        type: joi_1.default.string().valid(...Object.values(analytics_interface_1.AnalyticsDataType)).required(),
        data: joi_1.default.object().required(),
        metadata: joi_1.default.object().optional(),
        organizationId: joi_1.default.string().required(),
        userId: joi_1.default.string().optional()
    });
    const querySchema = joi_1.default.object({
        index: joi_1.default.string().required(),
        query: joi_1.default.object().required(),
        timeRange: timeRangeSchema.optional(),
        aggregations: joi_1.default.object().optional(),
        size: joi_1.default.number().min(1).max(10000).default(100),
        from: joi_1.default.number().min(0).default(0),
        sort: joi_1.default.array().items(joi_1.default.object()).optional()
    });
    const dashboardSchema = joi_1.default.object({
        name: joi_1.default.string().required(),
        description: joi_1.default.string().optional(),
        widgets: joi_1.default.array().items(joi_1.default.object({
            type: joi_1.default.string().required(),
            title: joi_1.default.string().required(),
            query: querySchema.required(),
            config: joi_1.default.object().default({}),
            position: joi_1.default.object({
                x: joi_1.default.number().required(),
                y: joi_1.default.number().required(),
                width: joi_1.default.number().required(),
                height: joi_1.default.number().required()
            }).required()
        })).required(),
        organizationId: joi_1.default.string().required(),
        isPublic: joi_1.default.boolean().default(false)
    });
    const reportRequestSchema = joi_1.default.object({
        type: joi_1.default.string().required(),
        name: joi_1.default.string().required(),
        parameters: joi_1.default.object().default({}),
        format: joi_1.default.string().valid(...Object.values(analytics_interface_1.ReportFormat)).required(),
        organizationId: joi_1.default.string().required(),
        userId: joi_1.default.string().required(),
        timeRange: timeRangeSchema.optional()
    });
    // Middleware for request validation
    const validateRequest = (schema) => {
        return (req, res, next) => {
            const { error, value } = schema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: {
                        message: 'Validation error',
                        details: error.details.map(d => d.message)
                    }
                });
            }
            req.body = value;
            next();
        };
    };
    // Middleware for query parameter validation
    const validateQuery = (schema) => {
        return (req, res, next) => {
            const { error, value } = schema.validate(req.query);
            if (error) {
                return res.status(400).json({
                    error: {
                        message: 'Query validation error',
                        details: error.details.map(d => d.message)
                    }
                });
            }
            req.query = value;
            next();
        };
    };
    // Data ingestion endpoints
    router.post('/ingest', validateRequest(analyticsDataSchema), async (req, res) => {
        try {
            const data = req.body;
            await analyticsService.ingestData(data);
            res.status(201).json({
                message: 'Data ingested successfully',
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Failed to ingest data:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to ingest data',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    router.post('/ingest/bulk', async (req, res) => {
        try {
            const { data } = req.body;
            if (!Array.isArray(data)) {
                return res.status(400).json({
                    error: { message: 'Data must be an array' }
                });
            }
            // Validate each item
            for (const item of data) {
                const { error } = analyticsDataSchema.validate(item);
                if (error) {
                    return res.status(400).json({
                        error: {
                            message: 'Validation error in bulk data',
                            details: error.details.map(d => d.message)
                        }
                    });
                }
            }
            // Ingest all items
            for (const item of data) {
                await analyticsService.ingestData(item);
            }
            res.status(201).json({
                message: `${data.length} items ingested successfully`,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Failed to bulk ingest data:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to bulk ingest data',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    // Query endpoints
    router.post('/query', validateRequest(querySchema), async (req, res) => {
        try {
            const result = await analyticsService.queryData(req.body);
            res.json(result);
        }
        catch (error) {
            logger.error('Failed to execute query:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to execute query',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    // Dashboard endpoints
    router.get('/dashboards/:dashboardId', async (req, res) => {
        try {
            const { dashboardId } = req.params;
            const timeRangeQuery = joi_1.default.object({
                start: joi_1.default.date().required(),
                end: joi_1.default.date().min(joi_1.default.ref('start')).required()
            });
            const { error, value } = timeRangeQuery.validate(req.query);
            if (error) {
                return res.status(400).json({
                    error: {
                        message: 'Invalid time range',
                        details: error.details.map(d => d.message)
                    }
                });
            }
            const timeRange = {
                start: new Date(value.start),
                end: new Date(value.end)
            };
            const dashboard = await analyticsService.getDashboardData(dashboardId, timeRange);
            res.json(dashboard);
        }
        catch (error) {
            logger.error('Failed to get dashboard data:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to get dashboard data',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    router.post('/dashboards', validateRequest(dashboardSchema), async (req, res) => {
        try {
            const dashboard = await analyticsService.createDashboard(req.body);
            res.status(201).json(dashboard);
        }
        catch (error) {
            logger.error('Failed to create dashboard:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to create dashboard',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    router.put('/dashboards/:dashboardId', async (req, res) => {
        try {
            const { dashboardId } = req.params;
            const dashboard = await analyticsService.updateDashboard(dashboardId, req.body);
            res.json(dashboard);
        }
        catch (error) {
            logger.error('Failed to update dashboard:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to update dashboard',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    router.delete('/dashboards/:dashboardId', async (req, res) => {
        try {
            const { dashboardId } = req.params;
            await analyticsService.deleteDashboard(dashboardId);
            res.status(204).send();
        }
        catch (error) {
            logger.error('Failed to delete dashboard:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to delete dashboard',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    // Report endpoints
    router.post('/reports', validateRequest(reportRequestSchema), async (req, res) => {
        try {
            const report = await analyticsService.generateReport(req.body);
            res.status(201).json(report);
        }
        catch (error) {
            logger.error('Failed to generate report:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to generate report',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    router.get('/reports/types', async (req, res) => {
        try {
            const reportTypes = await analyticsService.getReportTypes();
            res.json(reportTypes);
        }
        catch (error) {
            logger.error('Failed to get report types:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to get report types',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    router.post('/reports/schedule', async (req, res) => {
        try {
            const scheduledReport = await analyticsService.scheduleReport(req.body);
            res.status(201).json(scheduledReport);
        }
        catch (error) {
            logger.error('Failed to schedule report:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to schedule report',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    // Performance metrics endpoints
    router.get('/performance/:organizationId', async (req, res) => {
        try {
            const { organizationId } = req.params;
            const querySchema = joi_1.default.object({
                start: joi_1.default.date().required(),
                end: joi_1.default.date().min(joi_1.default.ref('start')).required(),
                metrics: joi_1.default.string().optional(),
                groupBy: joi_1.default.string().optional(),
                filters: joi_1.default.string().optional()
            });
            const { error, value } = querySchema.validate(req.query);
            if (error) {
                return res.status(400).json({
                    error: {
                        message: 'Invalid query parameters',
                        details: error.details.map(d => d.message)
                    }
                });
            }
            const query = {
                organizationId,
                timeRange: {
                    start: new Date(value.start),
                    end: new Date(value.end)
                },
                metrics: value.metrics ? value.metrics.split(',') : [],
                groupBy: value.groupBy ? value.groupBy.split(',') : undefined,
                filters: value.filters ? JSON.parse(value.filters) : undefined
            };
            const metrics = await analyticsService.getPerformanceMetrics(query);
            res.json(metrics);
        }
        catch (error) {
            logger.error('Failed to get performance metrics:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to get performance metrics',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    // Usage analytics endpoints
    router.get('/usage/:organizationId', async (req, res) => {
        try {
            const { organizationId } = req.params;
            const querySchema = joi_1.default.object({
                start: joi_1.default.date().required(),
                end: joi_1.default.date().min(joi_1.default.ref('start')).required(),
                groupBy: joi_1.default.string().optional(),
                includeUsers: joi_1.default.boolean().default(true),
                includeWorkflows: joi_1.default.boolean().default(true)
            });
            const { error, value } = querySchema.validate(req.query);
            if (error) {
                return res.status(400).json({
                    error: {
                        message: 'Invalid query parameters',
                        details: error.details.map(d => d.message)
                    }
                });
            }
            const query = {
                organizationId,
                timeRange: {
                    start: new Date(value.start),
                    end: new Date(value.end)
                },
                groupBy: value.groupBy ? value.groupBy.split(',') : undefined,
                includeUsers: value.includeUsers,
                includeWorkflows: value.includeWorkflows
            };
            const usage = await analyticsService.getUsageAnalytics(query);
            res.json(usage);
        }
        catch (error) {
            logger.error('Failed to get usage analytics:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to get usage analytics',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    // Billing metrics endpoints
    router.get('/billing/:organizationId', async (req, res) => {
        try {
            const { organizationId } = req.params;
            const querySchema = joi_1.default.object({
                start: joi_1.default.date().required(),
                end: joi_1.default.date().min(joi_1.default.ref('start')).required()
            });
            const { error, value } = querySchema.validate(req.query);
            if (error) {
                return res.status(400).json({
                    error: {
                        message: 'Invalid query parameters',
                        details: error.details.map(d => d.message)
                    }
                });
            }
            const timeRange = {
                start: new Date(value.start),
                end: new Date(value.end)
            };
            const billing = await analyticsService.getBillingMetrics(organizationId, timeRange);
            res.json(billing);
        }
        catch (error) {
            logger.error('Failed to get billing metrics:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to get billing metrics',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    // Summary endpoints
    router.get('/summary/:organizationId', async (req, res) => {
        try {
            const { organizationId } = req.params;
            const querySchema = joi_1.default.object({
                start: joi_1.default.date().required(),
                end: joi_1.default.date().min(joi_1.default.ref('start')).required()
            });
            const { error, value } = querySchema.validate(req.query);
            if (error) {
                return res.status(400).json({
                    error: {
                        message: 'Invalid query parameters',
                        details: error.details.map(d => d.message)
                    }
                });
            }
            const timeRange = {
                start: new Date(value.start),
                end: new Date(value.end)
            };
            const summary = await analyticsService.getAnalyticsSummary(organizationId, timeRange);
            res.json(summary);
        }
        catch (error) {
            logger.error('Failed to get analytics summary:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to get analytics summary',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    // Alerts endpoints
    router.get('/alerts/:organizationId', async (req, res) => {
        try {
            const { organizationId } = req.params;
            const alerts = await analyticsService.getAnalyticsAlerts(organizationId);
            res.json(alerts);
        }
        catch (error) {
            logger.error('Failed to get analytics alerts:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to get analytics alerts',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    // System health endpoint
    router.get('/health', async (req, res) => {
        try {
            const health = await analyticsService.getSystemHealth();
            res.json(health);
        }
        catch (error) {
            logger.error('Failed to get system health:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to get system health',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    });
    return router;
}
//# sourceMappingURL=analytics.routes.js.map