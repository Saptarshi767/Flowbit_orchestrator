"use strict";
/**
 * Type definitions for the Robust AI Orchestrator SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.ApiError = void 0;
// Error types
class ApiError extends Error {
    constructor(message, code, details, statusCode) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.details = details;
        this.statusCode = statusCode;
    }
}
exports.ApiError = ApiError;
class ValidationError extends ApiError {
    constructor(message, field, details) {
        super(message, 'VALIDATION_ERROR', { field, ...details }, 422);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends ApiError {
    constructor(message = 'Authentication required') {
        super(message, 'AUTHENTICATION_ERROR', undefined, 401);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends ApiError {
    constructor(message = 'Insufficient permissions') {
        super(message, 'AUTHORIZATION_ERROR', undefined, 403);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends ApiError {
    constructor(message = 'Resource not found') {
        super(message, 'NOT_FOUND', undefined, 404);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class RateLimitError extends ApiError {
    constructor(message, resetTime) {
        super(message, 'RATE_LIMIT_EXCEEDED', { resetTime }, 429);
        this.name = 'RateLimitError';
        this.resetTime = resetTime;
    }
}
exports.RateLimitError = RateLimitError;
//# sourceMappingURL=types.js.map