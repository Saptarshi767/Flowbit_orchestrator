"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizePermission = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        const response = {
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Access token is required'
            },
            meta: {
                correlationId: req.correlationId || '',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        };
        res.status(401).json(response);
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        req.user = decoded;
        next();
    }
    catch (error) {
        const response = {
            success: false,
            error: {
                code: 'INVALID_TOKEN',
                message: 'Invalid or expired token'
            },
            meta: {
                correlationId: req.correlationId || '',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        };
        res.status(403).json(response);
    }
};
exports.authenticateToken = authenticateToken;
const authorizePermission = (resource, action) => {
    return (req, res, next) => {
        if (!req.user) {
            const response = {
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                },
                meta: {
                    correlationId: req.correlationId || '',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                }
            };
            res.status(401).json(response);
            return;
        }
        const hasPermission = req.user.permissions.some(permission => permission.resource === resource && permission.actions.includes(action));
        if (!hasPermission) {
            const response = {
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: `Insufficient permissions for ${action} on ${resource}`
                },
                meta: {
                    correlationId: req.correlationId || '',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                }
            };
            res.status(403).json(response);
            return;
        }
        next();
    };
};
exports.authorizePermission = authorizePermission;
//# sourceMappingURL=auth.js.map