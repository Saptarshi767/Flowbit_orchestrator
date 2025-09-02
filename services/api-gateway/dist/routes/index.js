"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const security_1 = require("../middleware/security");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
// Health check endpoint (no authentication required)
router.get('/health', (req, res) => {
    const response = {
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            uptime: process.uptime()
        },
        meta: {
            correlationId: req.correlationId || '',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        }
    };
    res.json(response);
});
// API version endpoint
router.get('/version', (req, res) => {
    const response = {
        success: true,
        data: {
            version: '1.0.0',
            apiVersion: 'v1',
            buildDate: new Date().toISOString()
        },
        meta: {
            correlationId: req.correlationId || '',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        }
    };
    res.json(response);
});
// Protected route example
router.get('/protected', rateLimiter_1.apiRateLimit, auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const response = {
        success: true,
        data: {
            message: 'This is a protected route',
            user: {
                id: req.user?.userId,
                email: req.user?.email,
                role: req.user?.role
            }
        },
        meta: {
            correlationId: req.correlationId || '',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        }
    };
    res.json(response);
}));
// Admin only route example
router.get('/admin', rateLimiter_1.apiRateLimit, auth_1.authenticateToken, (0, auth_1.authorizePermission)('admin', 'read'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const response = {
        success: true,
        data: {
            message: 'This is an admin-only route',
            adminData: 'Sensitive admin information'
        },
        meta: {
            correlationId: req.correlationId || '',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        }
    };
    res.json(response);
}));
// Service-to-service route example
router.get('/internal/status', security_1.validateApiKey, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const response = {
        success: true,
        data: {
            message: 'Internal service status',
            services: {
                database: 'healthy',
                redis: 'healthy',
                elasticsearch: 'healthy'
            }
        },
        meta: {
            correlationId: req.correlationId || '',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        }
    };
    res.json(response);
}));
exports.default = router;
//# sourceMappingURL=index.js.map