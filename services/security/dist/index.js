"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityService = exports.securityConfig = exports.securityConfigManager = exports.SecurityConfigManager = exports.securityMonitor = exports.SecurityMonitor = exports.vulnerabilityScanner = exports.VulnerabilityScanner = exports.zeroTrustMiddleware = exports.ZeroTrustMiddleware = exports.zeroTrustEngine = exports.ZeroTrustEngine = exports.auditMiddleware = exports.AuditMiddleware = exports.auditLogger = exports.AuditLogger = exports.SecurityMiddleware = exports.DDoSProtection = exports.RateLimiter = exports.dataEncryption = exports.DataEncryption = exports.keyManager = exports.KeyManager = void 0;
exports.createSecurityService = createSecurityService;
// Main security service exports
var keyManager_1 = require("./encryption/keyManager");
Object.defineProperty(exports, "KeyManager", { enumerable: true, get: function () { return keyManager_1.KeyManager; } });
Object.defineProperty(exports, "keyManager", { enumerable: true, get: function () { return keyManager_1.keyManager; } });
var dataEncryption_1 = require("./encryption/dataEncryption");
Object.defineProperty(exports, "DataEncryption", { enumerable: true, get: function () { return dataEncryption_1.DataEncryption; } });
Object.defineProperty(exports, "dataEncryption", { enumerable: true, get: function () { return dataEncryption_1.dataEncryption; } });
var rateLimiter_1 = require("./rateLimit/rateLimiter");
Object.defineProperty(exports, "RateLimiter", { enumerable: true, get: function () { return rateLimiter_1.RateLimiter; } });
Object.defineProperty(exports, "DDoSProtection", { enumerable: true, get: function () { return rateLimiter_1.DDoSProtection; } });
var securityMiddleware_1 = require("./middleware/securityMiddleware");
Object.defineProperty(exports, "SecurityMiddleware", { enumerable: true, get: function () { return securityMiddleware_1.SecurityMiddleware; } });
var auditLogger_1 = require("./audit/auditLogger");
Object.defineProperty(exports, "AuditLogger", { enumerable: true, get: function () { return auditLogger_1.AuditLogger; } });
Object.defineProperty(exports, "auditLogger", { enumerable: true, get: function () { return auditLogger_1.auditLogger; } });
var auditMiddleware_1 = require("./audit/auditMiddleware");
Object.defineProperty(exports, "AuditMiddleware", { enumerable: true, get: function () { return auditMiddleware_1.AuditMiddleware; } });
Object.defineProperty(exports, "auditMiddleware", { enumerable: true, get: function () { return auditMiddleware_1.auditMiddleware; } });
var zeroTrustEngine_1 = require("./zeroTrust/zeroTrustEngine");
Object.defineProperty(exports, "ZeroTrustEngine", { enumerable: true, get: function () { return zeroTrustEngine_1.ZeroTrustEngine; } });
Object.defineProperty(exports, "zeroTrustEngine", { enumerable: true, get: function () { return zeroTrustEngine_1.zeroTrustEngine; } });
var zeroTrustMiddleware_1 = require("./zeroTrust/zeroTrustMiddleware");
Object.defineProperty(exports, "ZeroTrustMiddleware", { enumerable: true, get: function () { return zeroTrustMiddleware_1.ZeroTrustMiddleware; } });
Object.defineProperty(exports, "zeroTrustMiddleware", { enumerable: true, get: function () { return zeroTrustMiddleware_1.zeroTrustMiddleware; } });
var vulnerabilityScanner_1 = require("./scanning/vulnerabilityScanner");
Object.defineProperty(exports, "VulnerabilityScanner", { enumerable: true, get: function () { return vulnerabilityScanner_1.VulnerabilityScanner; } });
Object.defineProperty(exports, "vulnerabilityScanner", { enumerable: true, get: function () { return vulnerabilityScanner_1.vulnerabilityScanner; } });
var securityMonitor_1 = require("./monitoring/securityMonitor");
Object.defineProperty(exports, "SecurityMonitor", { enumerable: true, get: function () { return securityMonitor_1.SecurityMonitor; } });
Object.defineProperty(exports, "securityMonitor", { enumerable: true, get: function () { return securityMonitor_1.securityMonitor; } });
var securityConfig_1 = require("./config/securityConfig");
Object.defineProperty(exports, "SecurityConfigManager", { enumerable: true, get: function () { return securityConfig_1.SecurityConfigManager; } });
Object.defineProperty(exports, "securityConfigManager", { enumerable: true, get: function () { return securityConfig_1.securityConfigManager; } });
Object.defineProperty(exports, "securityConfig", { enumerable: true, get: function () { return securityConfig_1.securityConfig; } });
// Security service factory
const ioredis_1 = __importDefault(require("ioredis"));
const securityMiddleware_2 = require("./middleware/securityMiddleware");
class SecurityService {
    constructor(config) {
        this.redis = new ioredis_1.default({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3
        });
        this.securityMiddleware = new securityMiddleware_2.SecurityMiddleware(this.redis, {
            cors: config.cors,
            rateLimit: config.rateLimit,
            helmet: config.helmet
        });
    }
    getMiddleware() {
        return {
            securityHeaders: this.securityMiddleware.securityHeaders(),
            cors: this.securityMiddleware.corsMiddleware.bind(this.securityMiddleware),
            rateLimit: this.securityMiddleware.rateLimitMiddleware(),
            ddosProtection: this.securityMiddleware.ddosProtectionMiddleware(),
            requestValidation: this.securityMiddleware.requestValidation(),
            apiKeyValidation: this.securityMiddleware.apiKeyValidation(),
            inputSanitization: this.securityMiddleware.inputSanitization()
        };
    }
    getRedisClient() {
        return this.redis;
    }
    async close() {
        await this.redis.quit();
    }
}
exports.SecurityService = SecurityService;
function createSecurityService(config) {
    return new SecurityService(config);
}
//# sourceMappingURL=index.js.map