"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logWarning = exports.logInfo = exports.logError = exports.responseLoggingMiddleware = exports.requestLoggingMiddleware = exports.correlationIdMiddleware = exports.logger = void 0;
const uuid_1 = require("uuid");
const winston_1 = __importDefault(require("winston"));
const express_winston_1 = __importDefault(require("express-winston"));
const config_1 = require("../config");
// Configure Winston logger
exports.logger = winston_1.default.createLogger({
    level: config_1.config.logging.level,
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, correlationId, userId, ...meta }) => {
        return JSON.stringify({
            timestamp,
            level,
            message,
            correlationId,
            userId,
            ...meta
        });
    })),
    defaultMeta: { service: 'api-gateway' },
    transports: [
        new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'logs/combined.log' }),
    ],
});
// Add console transport in development
if (config_1.config.nodeEnv !== 'production') {
    exports.logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
    }));
}
// Correlation ID middleware
const correlationIdMiddleware = (req, res, next) => {
    // Check if correlation ID is provided in headers, otherwise generate one
    const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
};
exports.correlationIdMiddleware = correlationIdMiddleware;
// Request logging middleware
exports.requestLoggingMiddleware = express_winston_1.default.logger({
    winstonInstance: exports.logger,
    meta: true,
    msg: 'HTTP {{req.method}} {{req.url}}',
    expressFormat: false,
    colorize: false,
    dynamicMeta: (req, res) => {
        const logContext = {
            correlationId: req.correlationId || '',
            userId: req.user?.userId,
            organizationId: req.user?.organizationId,
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip || 'unknown'
        };
        return logContext;
    },
    skip: (req, res) => {
        // Skip logging for health checks and static assets
        return req.url === '/health' || req.url.startsWith('/static');
    }
});
// Response logging middleware
exports.responseLoggingMiddleware = express_winston_1.default.errorLogger({
    winstonInstance: exports.logger,
    meta: true,
    msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms',
    dynamicMeta: (req, res, err) => {
        return {
            correlationId: req.correlationId,
            userId: req.user?.userId,
            organizationId: req.user?.organizationId,
            error: err ? {
                name: err.name,
                message: err.message,
                stack: err.stack
            } : undefined
        };
    }
});
// Custom error logging function
const logError = (error, context) => {
    exports.logger.error('Application error', {
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack
        },
        ...context
    });
};
exports.logError = logError;
// Custom info logging function
const logInfo = (message, context) => {
    exports.logger.info(message, context);
};
exports.logInfo = logInfo;
// Custom warning logging function
const logWarning = (message, context) => {
    exports.logger.warn(message, context);
};
exports.logWarning = logWarning;
//# sourceMappingURL=logging.js.map