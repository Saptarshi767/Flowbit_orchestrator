"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityConfig = exports.securityConfigManager = exports.SecurityConfigManager = exports.productionSecurityConfig = exports.developmentSecurityConfig = exports.defaultSecurityConfig = void 0;
const zod_1 = require("zod");
// Security configuration schema
const SecurityConfigSchema = zod_1.z.object({
    encryption: zod_1.z.object({
        algorithm: zod_1.z.enum(['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305']).default('aes-256-gcm'),
        keyRotationInterval: zod_1.z.number().min(86400000).default(2592000000), // 30 days in ms
        keyDerivationIterations: zod_1.z.number().min(100000).default(100000),
        saltLength: zod_1.z.number().min(16).default(32)
    }),
    rateLimit: zod_1.z.object({
        windowMs: zod_1.z.number().min(1000).default(60000), // 1 minute
        maxRequests: zod_1.z.number().min(1).default(100),
        skipSuccessfulRequests: zod_1.z.boolean().default(false),
        skipFailedRequests: zod_1.z.boolean().default(false)
    }),
    ddosProtection: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        maxRequestsPerSecond: zod_1.z.number().min(1).default(100),
        blockDuration: zod_1.z.number().min(60000).default(3600000), // 1 hour
        suspiciousThreshold: zod_1.z.number().min(10).default(50)
    }),
    audit: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        tamperProofStorage: zod_1.z.boolean().default(true),
        retentionPeriod: zod_1.z.number().min(86400000).default(31536000000), // 1 year
        compressionEnabled: zod_1.z.boolean().default(true),
        encryptionEnabled: zod_1.z.boolean().default(true)
    }),
    zeroTrust: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        trustScoreThreshold: zod_1.z.number().min(0).max(1).default(0.6),
        riskAssessmentInterval: zod_1.z.number().min(60000).default(300000), // 5 minutes
        adaptivePolicies: zod_1.z.boolean().default(true),
        threatIntelligenceEnabled: zod_1.z.boolean().default(true)
    }),
    vulnerabilityScanning: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        scheduledScans: zod_1.z.boolean().default(true),
        scanInterval: zod_1.z.number().min(3600000).default(86400000), // 24 hours
        continuousMonitoring: zod_1.z.boolean().default(true),
        autoRemediation: zod_1.z.boolean().default(false)
    }),
    compliance: zod_1.z.object({
        gdpr: zod_1.z.object({
            enabled: zod_1.z.boolean().default(true),
            dataRetentionPeriod: zod_1.z.number().min(86400000).default(94608000000), // 3 years
            anonymizationEnabled: zod_1.z.boolean().default(true)
        }),
        soc2: zod_1.z.object({
            enabled: zod_1.z.boolean().default(true),
            auditLogRetention: zod_1.z.number().min(31536000000).default(94608000000), // 3 years
            accessControlLogging: zod_1.z.boolean().default(true)
        }),
        hipaa: zod_1.z.object({
            enabled: zod_1.z.boolean().default(false),
            encryptionRequired: zod_1.z.boolean().default(true),
            accessLogging: zod_1.z.boolean().default(true)
        })
    }),
    headers: zod_1.z.object({
        hsts: zod_1.z.object({
            enabled: zod_1.z.boolean().default(true),
            maxAge: zod_1.z.number().min(31536000).default(31536000), // 1 year
            includeSubDomains: zod_1.z.boolean().default(true),
            preload: zod_1.z.boolean().default(true)
        }),
        csp: zod_1.z.object({
            enabled: zod_1.z.boolean().default(true),
            directives: zod_1.z.record(zod_1.z.array(zod_1.z.string())).default({
                'default-src': ["'self'"],
                'script-src': ["'self'"],
                'style-src': ["'self'", "'unsafe-inline'"],
                'img-src': ["'self'", 'data:', 'https:'],
                'connect-src': ["'self'"],
                'font-src': ["'self'"],
                'object-src': ["'none'"],
                'media-src': ["'self'"],
                'frame-src': ["'none'"]
            })
        }),
        frameOptions: zod_1.z.enum(['DENY', 'SAMEORIGIN']).default('DENY'),
        contentTypeOptions: zod_1.z.boolean().default(true),
        xssProtection: zod_1.z.boolean().default(true)
    }),
    cors: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        origin: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).default(['https://localhost:3000']),
        credentials: zod_1.z.boolean().default(true),
        methods: zod_1.z.array(zod_1.z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
        allowedHeaders: zod_1.z.array(zod_1.z.string()).default(['Content-Type', 'Authorization', 'X-API-Key'])
    }),
    session: zod_1.z.object({
        secure: zod_1.z.boolean().default(true),
        httpOnly: zod_1.z.boolean().default(true),
        sameSite: zod_1.z.enum(['strict', 'lax', 'none']).default('strict'),
        maxAge: zod_1.z.number().min(300000).default(3600000), // 1 hour
        rolling: zod_1.z.boolean().default(true)
    }),
    apiSecurity: zod_1.z.object({
        apiKeyRequired: zod_1.z.boolean().default(true),
        apiKeyHeader: zod_1.z.string().default('X-API-Key'),
        jwtSecret: zod_1.z.string().min(32),
        jwtExpiration: zod_1.z.string().default('1h'),
        refreshTokenExpiration: zod_1.z.string().default('7d')
    }),
    monitoring: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        metricsCollection: zod_1.z.boolean().default(true),
        alerting: zod_1.z.boolean().default(true),
        logLevel: zod_1.z.enum(['error', 'warn', 'info', 'debug']).default('info'),
        performanceMonitoring: zod_1.z.boolean().default(true)
    })
});
// Default security configuration
exports.defaultSecurityConfig = {
    encryption: {
        algorithm: 'aes-256-gcm',
        keyRotationInterval: 2592000000, // 30 days
        keyDerivationIterations: 100000,
        saltLength: 32
    },
    rateLimit: {
        windowMs: 60000, // 1 minute
        maxRequests: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
    },
    ddosProtection: {
        enabled: true,
        maxRequestsPerSecond: 100,
        blockDuration: 3600000, // 1 hour
        suspiciousThreshold: 50
    },
    audit: {
        enabled: true,
        tamperProofStorage: true,
        retentionPeriod: 31536000000, // 1 year
        compressionEnabled: true,
        encryptionEnabled: true
    },
    zeroTrust: {
        enabled: true,
        trustScoreThreshold: 0.6,
        riskAssessmentInterval: 300000, // 5 minutes
        adaptivePolicies: true,
        threatIntelligenceEnabled: true
    },
    vulnerabilityScanning: {
        enabled: true,
        scheduledScans: true,
        scanInterval: 86400000, // 24 hours
        continuousMonitoring: true,
        autoRemediation: false
    },
    compliance: {
        gdpr: {
            enabled: true,
            dataRetentionPeriod: 94608000000, // 3 years
            anonymizationEnabled: true
        },
        soc2: {
            enabled: true,
            auditLogRetention: 94608000000, // 3 years
            accessControlLogging: true
        },
        hipaa: {
            enabled: false,
            encryptionRequired: true,
            accessLogging: true
        }
    },
    headers: {
        hsts: {
            enabled: true,
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true
        },
        csp: {
            enabled: true,
            directives: {
                'default-src': ["'self'"],
                'script-src': ["'self'"],
                'style-src': ["'self'", "'unsafe-inline'"],
                'img-src': ["'self'", 'data:', 'https:'],
                'connect-src': ["'self'"],
                'font-src': ["'self'"],
                'object-src': ["'none'"],
                'media-src': ["'self'"],
                'frame-src': ["'none'"]
            }
        },
        frameOptions: 'DENY',
        contentTypeOptions: true,
        xssProtection: true
    },
    cors: {
        enabled: true,
        origin: ['https://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    },
    session: {
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 3600000, // 1 hour
        rolling: true
    },
    apiSecurity: {
        apiKeyRequired: true,
        apiKeyHeader: 'X-API-Key',
        jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
        jwtExpiration: '1h',
        refreshTokenExpiration: '7d'
    },
    monitoring: {
        enabled: true,
        metricsCollection: true,
        alerting: true,
        logLevel: 'info',
        performanceMonitoring: true
    }
};
// Environment-specific configurations
exports.developmentSecurityConfig = {
    session: {
        secure: false, // Allow HTTP in development
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 3600000,
        rolling: true
    },
    cors: {
        enabled: true,
        origin: ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    },
    monitoring: {
        enabled: true,
        metricsCollection: true,
        alerting: false, // Disable alerting in development
        logLevel: 'debug',
        performanceMonitoring: true
    }
};
exports.productionSecurityConfig = {
    rateLimit: {
        windowMs: 60000,
        maxRequests: 50, // Stricter rate limiting in production
        skipSuccessfulRequests: false,
        skipFailedRequests: false
    },
    ddosProtection: {
        enabled: true,
        maxRequestsPerSecond: 50, // Stricter DDoS protection
        blockDuration: 7200000, // 2 hours
        suspiciousThreshold: 25
    },
    zeroTrust: {
        enabled: true,
        trustScoreThreshold: 0.7, // Higher trust threshold
        riskAssessmentInterval: 180000, // 3 minutes
        adaptivePolicies: true,
        threatIntelligenceEnabled: true
    },
    monitoring: {
        enabled: true,
        metricsCollection: true,
        alerting: true,
        logLevel: 'warn', // Less verbose logging in production
        performanceMonitoring: true
    }
};
// Configuration validation and loading
class SecurityConfigManager {
    constructor(environment = 'development') {
        this.config = this.loadConfig(environment);
    }
    loadConfig(environment) {
        let config = { ...exports.defaultSecurityConfig };
        // Apply environment-specific overrides
        switch (environment) {
            case 'development':
                config = { ...config, ...exports.developmentSecurityConfig };
                break;
            case 'production':
                config = { ...config, ...exports.productionSecurityConfig };
                break;
            case 'test':
                // Test environment uses default config with some modifications
                config.monitoring.alerting = false;
                config.audit.retentionPeriod = 86400000; // 1 day for tests
                break;
        }
        // Load from environment variables
        if (process.env.JWT_SECRET) {
            config.apiSecurity.jwtSecret = process.env.JWT_SECRET;
        }
        if (process.env.CORS_ORIGIN) {
            config.cors.origin = process.env.CORS_ORIGIN.split(',');
        }
        if (process.env.RATE_LIMIT_MAX) {
            config.rateLimit.maxRequests = parseInt(process.env.RATE_LIMIT_MAX, 10);
        }
        // Validate configuration
        const result = SecurityConfigSchema.safeParse(config);
        if (!result.success) {
            throw new Error(`Invalid security configuration: ${result.error.message}`);
        }
        return result.data;
    }
    getConfig() {
        return this.config;
    }
    updateConfig(updates) {
        const newConfig = { ...this.config, ...updates };
        const result = SecurityConfigSchema.safeParse(newConfig);
        if (!result.success) {
            throw new Error(`Invalid security configuration update: ${result.error.message}`);
        }
        this.config = result.data;
    }
    validateConfig(config) {
        const result = SecurityConfigSchema.safeParse(config);
        if (!result.success) {
            throw new Error(`Invalid security configuration: ${result.error.message}`);
        }
        return result.data;
    }
    exportConfig() {
        return JSON.stringify(this.config, null, 2);
    }
    importConfig(configJson) {
        try {
            const config = JSON.parse(configJson);
            this.config = this.validateConfig(config);
        }
        catch (error) {
            throw new Error(`Failed to import security configuration: ${error}`);
        }
    }
}
exports.SecurityConfigManager = SecurityConfigManager;
// Singleton instance
exports.securityConfigManager = new SecurityConfigManager(process.env.NODE_ENV || 'development');
exports.securityConfig = exports.securityConfigManager.getConfig();
//# sourceMappingURL=securityConfig.js.map