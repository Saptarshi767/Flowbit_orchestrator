"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.analyticsService = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const winston_1 = __importDefault(require("winston"));
const analytics_service_1 = require("./analytics.service");
const analytics_routes_1 = require("./routes/analytics.routes");
// Initialize logger
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        }),
        new winston_1.default.transports.File({ filename: 'logs/analytics-error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'logs/analytics-combined.log' })
    ]
});
exports.logger = logger;
// Configuration
const elasticsearchConfig = {
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    auth: process.env.ELASTICSEARCH_USERNAME ? {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD || ''
    } : undefined,
    ssl: process.env.ELASTICSEARCH_SSL === 'true' ? {
        rejectUnauthorized: process.env.ELASTICSEARCH_SSL_VERIFY !== 'false'
    } : undefined,
    requestTimeout: parseInt(process.env.ELASTICSEARCH_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.ELASTICSEARCH_MAX_RETRIES || '3')
};
const cacheConfig = {
    ttl: parseInt(process.env.CACHE_TTL || '300'), // 5 minutes
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
    enabled: process.env.CACHE_ENABLED !== 'false'
};
// Initialize services
const analyticsService = new analytics_service_1.AnalyticsService(elasticsearchConfig, logger, cacheConfig);
exports.analyticsService = analyticsService;
// Create Express app
const app = (0, express_1.default)();
const port = process.env.PORT || 3005;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });
    });
    next();
});
// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const health = await analyticsService.getSystemHealth();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'analytics',
            version: process.env.npm_package_version || '1.0.0',
            health
        });
    }
    catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            service: 'analytics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Analytics routes
app.use('/api/v1/analytics', (0, analytics_routes_1.createAnalyticsRoutes)(analyticsService, logger));
// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
    });
    res.status(error.status || 500).json({
        error: {
            message: error.message || 'Internal server error',
            status: error.status || 500,
            timestamp: new Date().toISOString()
        }
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: {
            message: 'Route not found',
            status: 404,
            timestamp: new Date().toISOString()
        }
    });
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    try {
        await analyticsService.cleanup();
        process.exit(0);
    }
    catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
});
process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    try {
        await analyticsService.cleanup();
        process.exit(0);
    }
    catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
});
// Start server
app.listen(port, () => {
    logger.info(`Analytics service listening on port ${port}`);
    logger.info('Configuration:', {
        elasticsearch: {
            node: elasticsearchConfig.node,
            hasAuth: !!elasticsearchConfig.auth,
            ssl: !!elasticsearchConfig.ssl
        },
        cache: cacheConfig
    });
});
exports.default = app;
//# sourceMappingURL=index.js.map