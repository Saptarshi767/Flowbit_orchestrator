"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
// Middleware imports
const security_1 = require("./middleware/security");
const logging_1 = require("./middleware/logging");
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
// Routes
const routes_1 = __importDefault(require("./routes"));
const createApp = () => {
    const app = (0, express_1.default)();
    // Trust proxy for accurate IP addresses (important for rate limiting)
    app.set('trust proxy', 1);
    // Basic middleware
    app.use((0, compression_1.default)()); // Compress responses
    app.use(express_1.default.json({ limit: '10mb' })); // Parse JSON bodies
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies
    // Security middleware
    app.use(security_1.corsMiddleware);
    app.use(security_1.securityMiddleware);
    app.use(security_1.additionalSecurityMiddleware);
    // Logging and correlation
    app.use(logging_1.correlationIdMiddleware);
    app.use(logging_1.requestLoggingMiddleware);
    // Rate limiting
    app.use(rateLimiter_1.generalRateLimit);
    // API routes
    app.use('/api/v1', routes_1.default);
    // Root endpoint
    app.get('/', (req, res) => {
        res.json({
            success: true,
            data: {
                message: 'Robust AI Orchestrator API Gateway',
                version: '1.0.0',
                documentation: '/api/v1/docs',
                health: '/api/v1/health'
            },
            meta: {
                correlationId: req.correlationId || '',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        });
    });
    // Error handling middleware (must be last)
    app.use(errorHandler_1.notFoundHandler);
    app.use(logging_1.responseLoggingMiddleware);
    app.use(errorHandler_1.errorHandler);
    return app;
};
exports.createApp = createApp;
//# sourceMappingURL=app.js.map