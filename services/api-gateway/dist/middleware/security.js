"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateApiKey = exports.additionalSecurityMiddleware = exports.securityMiddleware = exports.corsMiddleware = void 0;
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("../config");
// CORS configuration
exports.corsMiddleware = (0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        if (config_1.config.corsOrigins.includes(origin) || config_1.config.corsOrigins.includes('*')) {
            return callback(null, true);
        }
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Correlation-ID',
        'X-API-Key'
    ],
    exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
});
// Security headers middleware using Helmet
exports.securityMiddleware = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false, // Disable for API compatibility
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' }
});
// Custom security middleware for additional checks
const additionalSecurityMiddleware = (req, res, next) => {
    // Remove server information
    res.removeHeader('X-Powered-By');
    // Add custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    // Prevent caching of sensitive endpoints
    if (req.url.includes('/auth') || req.url.includes('/admin')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
    }
    next();
};
exports.additionalSecurityMiddleware = additionalSecurityMiddleware;
// API Key validation middleware (for service-to-service communication)
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'API_KEY_REQUIRED',
                message: 'API key is required for this endpoint'
            },
            meta: {
                correlationId: req.correlationId || '',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        });
    }
    // In a real implementation, validate against a database or service
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    if (!validApiKeys.includes(apiKey)) {
        return res.status(403).json({
            success: false,
            error: {
                code: 'INVALID_API_KEY',
                message: 'Invalid API key provided'
            },
            meta: {
                correlationId: req.correlationId || '',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        });
    }
    next();
};
exports.validateApiKey = validateApiKey;
//# sourceMappingURL=security.js.map