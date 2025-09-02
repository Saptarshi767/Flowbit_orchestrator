"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.notFoundHandler = exports.errorHandler = void 0;
const logging_1 = require("./logging");
// Global error handler middleware
const errorHandler = (error, req, res, next) => {
    // Log the error
    (0, logging_1.logError)(error, {
        correlationId: req.correlationId,
        userId: req.user?.userId,
        organizationId: req.user?.organizationId,
        method: req.method,
        url: req.url,
        ip: req.ip
    });
    // Default error response
    let statusCode = error.statusCode || 500;
    let errorCode = error.code || 'INTERNAL_SERVER_ERROR';
    let message = error.message || 'An unexpected error occurred';
    // Handle specific error types
    if (error.name === 'ValidationError') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
    }
    else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
    }
    else if (error.name === 'ForbiddenError') {
        statusCode = 403;
        errorCode = 'FORBIDDEN';
    }
    else if (error.name === 'NotFoundError') {
        statusCode = 404;
        errorCode = 'NOT_FOUND';
    }
    else if (error.name === 'ConflictError') {
        statusCode = 409;
        errorCode = 'CONFLICT';
    }
    else if (error.name === 'TooManyRequestsError') {
        statusCode = 429;
        errorCode = 'TOO_MANY_REQUESTS';
    }
    // Don't expose internal error details in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'Internal server error';
    }
    const response = {
        success: false,
        error: {
            code: errorCode,
            message: message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        meta: {
            correlationId: req.correlationId || '',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        }
    };
    res.status(statusCode).json(response);
};
exports.errorHandler = errorHandler;
// 404 handler for unmatched routes
const notFoundHandler = (req, res) => {
    const response = {
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.url} not found`
        },
        meta: {
            correlationId: req.correlationId || '',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        }
    };
    res.status(404).json(response);
};
exports.notFoundHandler = notFoundHandler;
// Async error wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errorHandler.js.map