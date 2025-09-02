"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardAggregationService = void 0;
const redis_1 = require("redis");
class DashboardAggregationService {
    constructor(elasticsearchService, logger, cacheConfig = { ttl: 300, maxSize: 1000, enabled: true }) {
        this.elasticsearchService = elasticsearchService;
        this.logger = logger;
        this.cacheConfig = cacheConfig;
        // Initialize Redis client
        this.redisClient = (0, redis_1.createClient)({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            database: parseInt(process.env.REDIS_ANALYTICS_DB || '2')
        });
        this.initializeRedis();
    }
    async initializeRedis() {
        try {
            await this.redisClient.connect();
            this.logger.info('Connected to Redis for dashboard caching');
        }
        catch (error) {
            this.logger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }
    async getDashboardData(dashboardId, timeRange) {
        try {
            // Try to get from cache first
            if (this.cacheConfig.enabled) {
                const cached = await this.getCachedDashboard(dashboardId, timeRange);
                if (cached) {
                    this.logger.debug(`Dashboard data served from cache: ${dashboardId}`);
                    return cached;
                }
            }
            // Get dashboard configuration (this would typically come from a database)
            const dashboard = await this.getDashboardConfig(dashboardId);
            // Aggregate data for each widget
            const widgets = [];
            for (const widget of dashboard.widgets) {
                const widgetData = await this.aggregateWidgetData(widget, timeRange);
                widgets.push(widgetData);
            }
            const dashboardData = {
                id: dashboardId,
                name: dashboard.name,
                widgets,
                lastUpdated: new Date(),
                cacheExpiry: new Date(Date.now() + this.cacheConfig.ttl * 1000)
            };
            // Cache the result
            if (this.cacheConfig.enabled) {
                await this.cacheDashboard(dashboardId, timeRange, dashboardData);
            }
            return dashboardData;
        }
        catch (error) {
            this.logger.error(`Failed to get dashboard data for ${dashboardId}:`, error);
            throw error;
        }
    }
    async aggregateWidgetData(widget, timeRange) {
        try {
            // Modify the widget query to include the time range
            const query = {
                ...widget.query,
                timeRange
            };
            // Execute the query
            const result = await this.elasticsearchService.queryData(query);
            // Process the result based on widget type
            const processedData = this.processWidgetResult(widget.type, result, widget.config);
            return {
                id: widget.id,
                type: widget.type,
                title: widget.title,
                data: processedData,
                config: widget.config,
                lastUpdated: new Date()
            };
        }
        catch (error) {
            this.logger.error(`Failed to aggregate data for widget ${widget.id}:`, error);
            // Return error widget data
            return {
                id: widget.id,
                type: widget.type,
                title: widget.title,
                data: { error: 'Failed to load data' },
                config: widget.config,
                lastUpdated: new Date()
            };
        }
    }
    processWidgetResult(widgetType, result, config) {
        switch (widgetType) {
            case 'line_chart':
                return this.processLineChartData(result, config);
            case 'bar_chart':
                return this.processBarChartData(result, config);
            case 'gauge':
                return this.processGaugeData(result, config);
            case 'counter':
                return this.processCounterData(result, config);
            case 'table':
                return this.processTableData(result, config);
            case 'heatmap':
                return this.processHeatmapData(result, config);
            default:
                return result;
        }
    }
    processLineChartData(result, config) {
        if (!result.aggregations) {
            return { series: [], labels: [] };
        }
        const timeAgg = result.aggregations.time_series;
        if (!timeAgg || !timeAgg.buckets) {
            return { series: [], labels: [] };
        }
        const labels = timeAgg.buckets.map((bucket) => new Date(bucket.key).toISOString());
        const series = [{
                name: config.seriesName || 'Value',
                data: timeAgg.buckets.map((bucket) => bucket.value?.value || bucket.doc_count)
            }];
        return { series, labels };
    }
    processBarChartData(result, config) {
        if (!result.aggregations) {
            return { categories: [], series: [] };
        }
        const categoryAgg = result.aggregations.categories;
        if (!categoryAgg || !categoryAgg.buckets) {
            return { categories: [], series: [] };
        }
        const categories = categoryAgg.buckets.map((bucket) => bucket.key);
        const series = [{
                name: config.seriesName || 'Count',
                data: categoryAgg.buckets.map((bucket) => bucket.value?.value || bucket.doc_count)
            }];
        return { categories, series };
    }
    processGaugeData(result, config) {
        const value = result.aggregations?.value?.value || result.hits.total.value;
        const min = config.min || 0;
        const max = config.max || 100;
        return {
            value,
            min,
            max,
            percentage: ((value - min) / (max - min)) * 100
        };
    }
    processCounterData(result, config) {
        const current = result.aggregations?.current?.value || result.hits.total.value;
        const previous = result.aggregations?.previous?.value || 0;
        const change = current - previous;
        const changePercent = previous > 0 ? (change / previous) * 100 : 0;
        return {
            current,
            previous,
            change,
            changePercent,
            trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
        };
    }
    processTableData(result, config) {
        const columns = config.columns || [];
        const rows = result.hits.hits.map((hit) => {
            const row = {};
            columns.forEach((column) => {
                row[column] = hit._source[column];
            });
            return row;
        });
        return {
            columns,
            rows,
            total: result.hits.total.value
        };
    }
    processHeatmapData(result, config) {
        if (!result.aggregations) {
            return { data: [] };
        }
        const xAgg = result.aggregations.x_axis;
        const yAgg = result.aggregations.y_axis;
        if (!xAgg || !yAgg) {
            return { data: [] };
        }
        const data = [];
        xAgg.buckets.forEach((xBucket, xIndex) => {
            yAgg.buckets.forEach((yBucket, yIndex) => {
                data.push([
                    xIndex,
                    yIndex,
                    yBucket.value?.value || yBucket.doc_count
                ]);
            });
        });
        return {
            data,
            xLabels: xAgg.buckets.map((bucket) => bucket.key),
            yLabels: yAgg.buckets.map((bucket) => bucket.key)
        };
    }
    async getCachedDashboard(dashboardId, timeRange) {
        try {
            const cacheKey = this.getDashboardCacheKey(dashboardId, timeRange);
            const cached = await this.redisClient.get(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                // Check if cache is still valid
                if (new Date(data.cacheExpiry) > new Date()) {
                    return data;
                }
                else {
                    // Remove expired cache
                    await this.redisClient.del(cacheKey);
                }
            }
            return null;
        }
        catch (error) {
            this.logger.warn('Failed to get cached dashboard:', error);
            return null;
        }
    }
    async cacheDashboard(dashboardId, timeRange, data) {
        try {
            const cacheKey = this.getDashboardCacheKey(dashboardId, timeRange);
            await this.redisClient.setEx(cacheKey, this.cacheConfig.ttl, JSON.stringify(data));
        }
        catch (error) {
            this.logger.warn('Failed to cache dashboard:', error);
        }
    }
    getDashboardCacheKey(dashboardId, timeRange) {
        const timeKey = `${timeRange.start.getTime()}-${timeRange.end.getTime()}`;
        return `dashboard:${dashboardId}:${timeKey}`;
    }
    async invalidateDashboardCache(dashboardId) {
        try {
            const pattern = `dashboard:${dashboardId}:*`;
            const keys = await this.redisClient.keys(pattern);
            if (keys.length > 0) {
                await this.redisClient.del(keys);
                this.logger.info(`Invalidated ${keys.length} cache entries for dashboard ${dashboardId}`);
            }
        }
        catch (error) {
            this.logger.error('Failed to invalidate dashboard cache:', error);
        }
    }
    async precomputeDashboard(dashboardId, timeRanges) {
        try {
            this.logger.info(`Precomputing dashboard ${dashboardId} for ${timeRanges.length} time ranges`);
            for (const timeRange of timeRanges) {
                await this.getDashboardData(dashboardId, timeRange);
            }
            this.logger.info(`Completed precomputing dashboard ${dashboardId}`);
        }
        catch (error) {
            this.logger.error(`Failed to precompute dashboard ${dashboardId}:`, error);
        }
    }
    async getCacheStats() {
        try {
            const info = await this.redisClient.info('memory');
            const keyCount = await this.redisClient.dbSize();
            return {
                keyCount,
                memoryInfo: info,
                cacheConfig: this.cacheConfig
            };
        }
        catch (error) {
            this.logger.error('Failed to get cache stats:', error);
            return null;
        }
    }
    // Mock method - in real implementation, this would query a database
    async getDashboardConfig(dashboardId) {
        // This is a mock implementation
        // In a real system, this would query the dashboard configuration from a database
        return {
            id: dashboardId,
            name: `Dashboard ${dashboardId}`,
            description: 'Sample dashboard',
            widgets: [
                {
                    id: 'widget-1',
                    dashboardId,
                    type: 'line_chart',
                    title: 'Executions Over Time',
                    query: {
                        index: 'orchestrator-executions',
                        query: { match_all: {} },
                        aggregations: {
                            time_series: {
                                date_histogram: {
                                    field: 'timestamp',
                                    interval: '1h'
                                }
                            }
                        }
                    },
                    config: { seriesName: 'Executions' },
                    position: { x: 0, y: 0, width: 6, height: 4 },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ],
            organizationId: 'org-1',
            createdBy: 'user-1',
            isPublic: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
    async cleanup() {
        try {
            await this.redisClient.quit();
            this.logger.info('Redis client closed');
        }
        catch (error) {
            this.logger.error('Error closing Redis client:', error);
        }
    }
}
exports.DashboardAggregationService = DashboardAggregationService;
//# sourceMappingURL=dashboard-aggregation.service.js.map