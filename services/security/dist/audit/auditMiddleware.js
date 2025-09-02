"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditMiddleware = exports.AuditMiddleware = void 0;
const auditLogger_1 = require("./auditLogger");
class AuditMiddleware {
    // Middleware to capture all API requests
    requestAudit() {
        return async (req, res, next) => {
            req.startTime = Date.now();
            // Capture original res.json to log responses
            const originalJson = res.json;
            let responseBody;
            res.json = function (body) {
                responseBody = body;
                return originalJson.call(this, body);
            };
            // Log request on response finish
            res.on('finish', async () => {
                const duration = Date.now() - (req.startTime || 0);
                const outcome = res.statusCode < 400 ? 'success' : 'failure';
                await auditLogger_1.auditLogger.logEvent({
                    userId: req.user?.id,
                    sessionId: req.sessionId,
                    action: `api:${req.method.toLowerCase()}`,
                    resource: req.path,
                    details: {
                        method: req.method,
                        path: req.path,
                        query: req.query,
                        statusCode: res.statusCode,
                        duration,
                        userAgent: req.get('User-Agent'),
                        contentLength: res.get('Content-Length')
                    },
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    outcome,
                    severity: this.determineSeverity(req.method, req.path, res.statusCode)
                });
            });
            next();
        };
    }
    // Middleware for sensitive operations
    sensitiveOperationAudit(operation) {
        return async (req, res, next) => {
            const startTime = Date.now();
            // Capture original res.json to determine outcome
            const originalJson = res.json;
            let outcome = 'success';
            res.json = function (body) {
                if (res.statusCode >= 400) {
                    outcome = res.statusCode >= 500 ? 'error' : 'failure';
                }
                return originalJson.call(this, body);
            };
            res.on('finish', async () => {
                const duration = Date.now() - startTime;
                await auditLogger_1.auditLogger.logEvent({
                    userId: req.user?.id,
                    sessionId: req.sessionId,
                    action: operation,
                    resource: req.path,
                    resourceId: req.params.id,
                    details: {
                        method: req.method,
                        path: req.path,
                        statusCode: res.statusCode,
                        duration,
                        requestBody: this.sanitizeRequestBody(req.body)
                    },
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    outcome,
                    severity: 'high'
                });
            });
            next();
        };
    }
    // Middleware for authentication events
    authenticationAudit() {
        return async (req, res, next) => {
            const originalJson = res.json;
            res.json = function (body) {
                const outcome = res.statusCode === 200 ? 'success' : 'failure';
                // Log authentication attempt
                auditLogger_1.auditLogger.logAuthentication(req.body?.email || req.body?.username || 'unknown', outcome, {
                    method: req.path.includes('login') ? 'password' : 'unknown',
                    statusCode: res.statusCode,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                });
                return originalJson.call(this, body);
            };
            next();
        };
    }
    // Middleware for authorization events
    authorizationAudit(requiredPermission) {
        return async (req, res, next) => {
            const hasPermission = await this.checkPermission(req.user, requiredPermission);
            const outcome = hasPermission ? 'success' : 'failure';
            await auditLogger_1.auditLogger.logAuthorization(req.user?.id || 'anonymous', req.path, requiredPermission, outcome, {
                method: req.method,
                resource: req.path,
                userRole: req.user?.role
            });
            if (!hasPermission) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Insufficient permissions'
                });
            }
            next();
        };
    }
    determineSeverity(method, path, statusCode) {
        // Critical operations
        if (path.includes('/admin') || path.includes('/system')) {
            return 'critical';
        }
        // High severity for failures on sensitive endpoints
        if (statusCode >= 400 && (path.includes('/auth') || path.includes('/user'))) {
            return 'high';
        }
        // Medium severity for write operations
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
            return 'medium';
        }
        return 'low';
    }
    sanitizeRequestBody(body) {
        if (!body || typeof body !== 'object') {
            return body;
        }
        const sanitized = { ...body };
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'privateKey'];
        for (const field of sensitiveFields) {
            if (field in sanitized) {
                sanitized[field] = '[REDACTED]';
            }
        }
        return sanitized;
    }
    async checkPermission(user, permission) {
        // Implement your permission checking logic here
        // This is a simplified example
        if (!user)
            return false;
        // Admin users have all permissions
        if (user.role === 'admin')
            return true;
        // Implement more granular permission checking
        return true; // Placeholder
    }
}
exports.AuditMiddleware = AuditMiddleware;
exports.auditMiddleware = new AuditMiddleware();
//# sourceMappingURL=auditMiddleware.js.map