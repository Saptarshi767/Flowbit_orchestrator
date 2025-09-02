import { z } from 'zod';
declare const SecurityConfigSchema: z.ZodObject<{
    encryption: z.ZodObject<{
        algorithm: z.ZodDefault<z.ZodEnum<["aes-256-gcm", "aes-256-cbc", "chacha20-poly1305"]>>;
        keyRotationInterval: z.ZodDefault<z.ZodNumber>;
        keyDerivationIterations: z.ZodDefault<z.ZodNumber>;
        saltLength: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        algorithm: "aes-256-cbc" | "aes-256-gcm" | "chacha20-poly1305";
        keyRotationInterval: number;
        keyDerivationIterations: number;
        saltLength: number;
    }, {
        algorithm?: "aes-256-cbc" | "aes-256-gcm" | "chacha20-poly1305" | undefined;
        keyRotationInterval?: number | undefined;
        keyDerivationIterations?: number | undefined;
        saltLength?: number | undefined;
    }>;
    rateLimit: z.ZodObject<{
        windowMs: z.ZodDefault<z.ZodNumber>;
        maxRequests: z.ZodDefault<z.ZodNumber>;
        skipSuccessfulRequests: z.ZodDefault<z.ZodBoolean>;
        skipFailedRequests: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        windowMs: number;
        maxRequests: number;
        skipSuccessfulRequests: boolean;
        skipFailedRequests: boolean;
    }, {
        windowMs?: number | undefined;
        maxRequests?: number | undefined;
        skipSuccessfulRequests?: boolean | undefined;
        skipFailedRequests?: boolean | undefined;
    }>;
    ddosProtection: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        maxRequestsPerSecond: z.ZodDefault<z.ZodNumber>;
        blockDuration: z.ZodDefault<z.ZodNumber>;
        suspiciousThreshold: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        maxRequestsPerSecond: number;
        blockDuration: number;
        suspiciousThreshold: number;
    }, {
        enabled?: boolean | undefined;
        maxRequestsPerSecond?: number | undefined;
        blockDuration?: number | undefined;
        suspiciousThreshold?: number | undefined;
    }>;
    audit: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        tamperProofStorage: z.ZodDefault<z.ZodBoolean>;
        retentionPeriod: z.ZodDefault<z.ZodNumber>;
        compressionEnabled: z.ZodDefault<z.ZodBoolean>;
        encryptionEnabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        tamperProofStorage: boolean;
        retentionPeriod: number;
        compressionEnabled: boolean;
        encryptionEnabled: boolean;
    }, {
        enabled?: boolean | undefined;
        tamperProofStorage?: boolean | undefined;
        retentionPeriod?: number | undefined;
        compressionEnabled?: boolean | undefined;
        encryptionEnabled?: boolean | undefined;
    }>;
    zeroTrust: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        trustScoreThreshold: z.ZodDefault<z.ZodNumber>;
        riskAssessmentInterval: z.ZodDefault<z.ZodNumber>;
        adaptivePolicies: z.ZodDefault<z.ZodBoolean>;
        threatIntelligenceEnabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        trustScoreThreshold: number;
        riskAssessmentInterval: number;
        adaptivePolicies: boolean;
        threatIntelligenceEnabled: boolean;
    }, {
        enabled?: boolean | undefined;
        trustScoreThreshold?: number | undefined;
        riskAssessmentInterval?: number | undefined;
        adaptivePolicies?: boolean | undefined;
        threatIntelligenceEnabled?: boolean | undefined;
    }>;
    vulnerabilityScanning: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        scheduledScans: z.ZodDefault<z.ZodBoolean>;
        scanInterval: z.ZodDefault<z.ZodNumber>;
        continuousMonitoring: z.ZodDefault<z.ZodBoolean>;
        autoRemediation: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        scheduledScans: boolean;
        scanInterval: number;
        continuousMonitoring: boolean;
        autoRemediation: boolean;
    }, {
        enabled?: boolean | undefined;
        scheduledScans?: boolean | undefined;
        scanInterval?: number | undefined;
        continuousMonitoring?: boolean | undefined;
        autoRemediation?: boolean | undefined;
    }>;
    compliance: z.ZodObject<{
        gdpr: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            dataRetentionPeriod: z.ZodDefault<z.ZodNumber>;
            anonymizationEnabled: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            dataRetentionPeriod: number;
            anonymizationEnabled: boolean;
        }, {
            enabled?: boolean | undefined;
            dataRetentionPeriod?: number | undefined;
            anonymizationEnabled?: boolean | undefined;
        }>;
        soc2: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            auditLogRetention: z.ZodDefault<z.ZodNumber>;
            accessControlLogging: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            auditLogRetention: number;
            accessControlLogging: boolean;
        }, {
            enabled?: boolean | undefined;
            auditLogRetention?: number | undefined;
            accessControlLogging?: boolean | undefined;
        }>;
        hipaa: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            encryptionRequired: z.ZodDefault<z.ZodBoolean>;
            accessLogging: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            encryptionRequired: boolean;
            accessLogging: boolean;
        }, {
            enabled?: boolean | undefined;
            encryptionRequired?: boolean | undefined;
            accessLogging?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        gdpr: {
            enabled: boolean;
            dataRetentionPeriod: number;
            anonymizationEnabled: boolean;
        };
        soc2: {
            enabled: boolean;
            auditLogRetention: number;
            accessControlLogging: boolean;
        };
        hipaa: {
            enabled: boolean;
            encryptionRequired: boolean;
            accessLogging: boolean;
        };
    }, {
        gdpr: {
            enabled?: boolean | undefined;
            dataRetentionPeriod?: number | undefined;
            anonymizationEnabled?: boolean | undefined;
        };
        soc2: {
            enabled?: boolean | undefined;
            auditLogRetention?: number | undefined;
            accessControlLogging?: boolean | undefined;
        };
        hipaa: {
            enabled?: boolean | undefined;
            encryptionRequired?: boolean | undefined;
            accessLogging?: boolean | undefined;
        };
    }>;
    headers: z.ZodObject<{
        hsts: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            maxAge: z.ZodDefault<z.ZodNumber>;
            includeSubDomains: z.ZodDefault<z.ZodBoolean>;
            preload: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            maxAge: number;
            includeSubDomains: boolean;
            preload: boolean;
            enabled: boolean;
        }, {
            maxAge?: number | undefined;
            includeSubDomains?: boolean | undefined;
            preload?: boolean | undefined;
            enabled?: boolean | undefined;
        }>;
        csp: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            directives: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>>;
        }, "strip", z.ZodTypeAny, {
            directives: Record<string, string[]>;
            enabled: boolean;
        }, {
            directives?: Record<string, string[]> | undefined;
            enabled?: boolean | undefined;
        }>;
        frameOptions: z.ZodDefault<z.ZodEnum<["DENY", "SAMEORIGIN"]>>;
        contentTypeOptions: z.ZodDefault<z.ZodBoolean>;
        xssProtection: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        hsts: {
            maxAge: number;
            includeSubDomains: boolean;
            preload: boolean;
            enabled: boolean;
        };
        csp: {
            directives: Record<string, string[]>;
            enabled: boolean;
        };
        frameOptions: "DENY" | "SAMEORIGIN";
        contentTypeOptions: boolean;
        xssProtection: boolean;
    }, {
        hsts: {
            maxAge?: number | undefined;
            includeSubDomains?: boolean | undefined;
            preload?: boolean | undefined;
            enabled?: boolean | undefined;
        };
        csp: {
            directives?: Record<string, string[]> | undefined;
            enabled?: boolean | undefined;
        };
        frameOptions?: "DENY" | "SAMEORIGIN" | undefined;
        contentTypeOptions?: boolean | undefined;
        xssProtection?: boolean | undefined;
    }>;
    cors: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        origin: z.ZodDefault<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
        credentials: z.ZodDefault<z.ZodBoolean>;
        methods: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        allowedHeaders: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        origin: string | string[];
        credentials: boolean;
        methods: string[];
        allowedHeaders: string[];
        enabled: boolean;
    }, {
        origin?: string | string[] | undefined;
        credentials?: boolean | undefined;
        methods?: string[] | undefined;
        allowedHeaders?: string[] | undefined;
        enabled?: boolean | undefined;
    }>;
    session: z.ZodObject<{
        secure: z.ZodDefault<z.ZodBoolean>;
        httpOnly: z.ZodDefault<z.ZodBoolean>;
        sameSite: z.ZodDefault<z.ZodEnum<["strict", "lax", "none"]>>;
        maxAge: z.ZodDefault<z.ZodNumber>;
        rolling: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        maxAge: number;
        secure: boolean;
        httpOnly: boolean;
        sameSite: "strict" | "lax" | "none";
        rolling: boolean;
    }, {
        maxAge?: number | undefined;
        secure?: boolean | undefined;
        httpOnly?: boolean | undefined;
        sameSite?: "strict" | "lax" | "none" | undefined;
        rolling?: boolean | undefined;
    }>;
    apiSecurity: z.ZodObject<{
        apiKeyRequired: z.ZodDefault<z.ZodBoolean>;
        apiKeyHeader: z.ZodDefault<z.ZodString>;
        jwtSecret: z.ZodString;
        jwtExpiration: z.ZodDefault<z.ZodString>;
        refreshTokenExpiration: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        apiKeyRequired: boolean;
        apiKeyHeader: string;
        jwtSecret: string;
        jwtExpiration: string;
        refreshTokenExpiration: string;
    }, {
        jwtSecret: string;
        apiKeyRequired?: boolean | undefined;
        apiKeyHeader?: string | undefined;
        jwtExpiration?: string | undefined;
        refreshTokenExpiration?: string | undefined;
    }>;
    monitoring: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        metricsCollection: z.ZodDefault<z.ZodBoolean>;
        alerting: z.ZodDefault<z.ZodBoolean>;
        logLevel: z.ZodDefault<z.ZodEnum<["error", "warn", "info", "debug"]>>;
        performanceMonitoring: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        metricsCollection: boolean;
        alerting: boolean;
        logLevel: "error" | "info" | "warn" | "debug";
        performanceMonitoring: boolean;
    }, {
        enabled?: boolean | undefined;
        metricsCollection?: boolean | undefined;
        alerting?: boolean | undefined;
        logLevel?: "error" | "info" | "warn" | "debug" | undefined;
        performanceMonitoring?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    cors: {
        origin: string | string[];
        credentials: boolean;
        methods: string[];
        allowedHeaders: string[];
        enabled: boolean;
    };
    audit: {
        enabled: boolean;
        tamperProofStorage: boolean;
        retentionPeriod: number;
        compressionEnabled: boolean;
        encryptionEnabled: boolean;
    };
    zeroTrust: {
        enabled: boolean;
        trustScoreThreshold: number;
        riskAssessmentInterval: number;
        adaptivePolicies: boolean;
        threatIntelligenceEnabled: boolean;
    };
    encryption: {
        algorithm: "aes-256-cbc" | "aes-256-gcm" | "chacha20-poly1305";
        keyRotationInterval: number;
        keyDerivationIterations: number;
        saltLength: number;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
        skipSuccessfulRequests: boolean;
        skipFailedRequests: boolean;
    };
    ddosProtection: {
        enabled: boolean;
        maxRequestsPerSecond: number;
        blockDuration: number;
        suspiciousThreshold: number;
    };
    vulnerabilityScanning: {
        enabled: boolean;
        scheduledScans: boolean;
        scanInterval: number;
        continuousMonitoring: boolean;
        autoRemediation: boolean;
    };
    compliance: {
        gdpr: {
            enabled: boolean;
            dataRetentionPeriod: number;
            anonymizationEnabled: boolean;
        };
        soc2: {
            enabled: boolean;
            auditLogRetention: number;
            accessControlLogging: boolean;
        };
        hipaa: {
            enabled: boolean;
            encryptionRequired: boolean;
            accessLogging: boolean;
        };
    };
    headers: {
        hsts: {
            maxAge: number;
            includeSubDomains: boolean;
            preload: boolean;
            enabled: boolean;
        };
        csp: {
            directives: Record<string, string[]>;
            enabled: boolean;
        };
        frameOptions: "DENY" | "SAMEORIGIN";
        contentTypeOptions: boolean;
        xssProtection: boolean;
    };
    session: {
        maxAge: number;
        secure: boolean;
        httpOnly: boolean;
        sameSite: "strict" | "lax" | "none";
        rolling: boolean;
    };
    apiSecurity: {
        apiKeyRequired: boolean;
        apiKeyHeader: string;
        jwtSecret: string;
        jwtExpiration: string;
        refreshTokenExpiration: string;
    };
    monitoring: {
        enabled: boolean;
        metricsCollection: boolean;
        alerting: boolean;
        logLevel: "error" | "info" | "warn" | "debug";
        performanceMonitoring: boolean;
    };
}, {
    cors: {
        origin?: string | string[] | undefined;
        credentials?: boolean | undefined;
        methods?: string[] | undefined;
        allowedHeaders?: string[] | undefined;
        enabled?: boolean | undefined;
    };
    audit: {
        enabled?: boolean | undefined;
        tamperProofStorage?: boolean | undefined;
        retentionPeriod?: number | undefined;
        compressionEnabled?: boolean | undefined;
        encryptionEnabled?: boolean | undefined;
    };
    zeroTrust: {
        enabled?: boolean | undefined;
        trustScoreThreshold?: number | undefined;
        riskAssessmentInterval?: number | undefined;
        adaptivePolicies?: boolean | undefined;
        threatIntelligenceEnabled?: boolean | undefined;
    };
    encryption: {
        algorithm?: "aes-256-cbc" | "aes-256-gcm" | "chacha20-poly1305" | undefined;
        keyRotationInterval?: number | undefined;
        keyDerivationIterations?: number | undefined;
        saltLength?: number | undefined;
    };
    rateLimit: {
        windowMs?: number | undefined;
        maxRequests?: number | undefined;
        skipSuccessfulRequests?: boolean | undefined;
        skipFailedRequests?: boolean | undefined;
    };
    ddosProtection: {
        enabled?: boolean | undefined;
        maxRequestsPerSecond?: number | undefined;
        blockDuration?: number | undefined;
        suspiciousThreshold?: number | undefined;
    };
    vulnerabilityScanning: {
        enabled?: boolean | undefined;
        scheduledScans?: boolean | undefined;
        scanInterval?: number | undefined;
        continuousMonitoring?: boolean | undefined;
        autoRemediation?: boolean | undefined;
    };
    compliance: {
        gdpr: {
            enabled?: boolean | undefined;
            dataRetentionPeriod?: number | undefined;
            anonymizationEnabled?: boolean | undefined;
        };
        soc2: {
            enabled?: boolean | undefined;
            auditLogRetention?: number | undefined;
            accessControlLogging?: boolean | undefined;
        };
        hipaa: {
            enabled?: boolean | undefined;
            encryptionRequired?: boolean | undefined;
            accessLogging?: boolean | undefined;
        };
    };
    headers: {
        hsts: {
            maxAge?: number | undefined;
            includeSubDomains?: boolean | undefined;
            preload?: boolean | undefined;
            enabled?: boolean | undefined;
        };
        csp: {
            directives?: Record<string, string[]> | undefined;
            enabled?: boolean | undefined;
        };
        frameOptions?: "DENY" | "SAMEORIGIN" | undefined;
        contentTypeOptions?: boolean | undefined;
        xssProtection?: boolean | undefined;
    };
    session: {
        maxAge?: number | undefined;
        secure?: boolean | undefined;
        httpOnly?: boolean | undefined;
        sameSite?: "strict" | "lax" | "none" | undefined;
        rolling?: boolean | undefined;
    };
    apiSecurity: {
        jwtSecret: string;
        apiKeyRequired?: boolean | undefined;
        apiKeyHeader?: string | undefined;
        jwtExpiration?: string | undefined;
        refreshTokenExpiration?: string | undefined;
    };
    monitoring: {
        enabled?: boolean | undefined;
        metricsCollection?: boolean | undefined;
        alerting?: boolean | undefined;
        logLevel?: "error" | "info" | "warn" | "debug" | undefined;
        performanceMonitoring?: boolean | undefined;
    };
}>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export declare const defaultSecurityConfig: SecurityConfig;
export declare const developmentSecurityConfig: Partial<SecurityConfig>;
export declare const productionSecurityConfig: Partial<SecurityConfig>;
export declare class SecurityConfigManager {
    private config;
    constructor(environment?: 'development' | 'production' | 'test');
    private loadConfig;
    getConfig(): SecurityConfig;
    updateConfig(updates: Partial<SecurityConfig>): void;
    validateConfig(config: unknown): SecurityConfig;
    exportConfig(): string;
    importConfig(configJson: string): void;
}
export declare const securityConfigManager: SecurityConfigManager;
export declare const securityConfig: {
    cors: {
        origin: string | string[];
        credentials: boolean;
        methods: string[];
        allowedHeaders: string[];
        enabled: boolean;
    };
    audit: {
        enabled: boolean;
        tamperProofStorage: boolean;
        retentionPeriod: number;
        compressionEnabled: boolean;
        encryptionEnabled: boolean;
    };
    zeroTrust: {
        enabled: boolean;
        trustScoreThreshold: number;
        riskAssessmentInterval: number;
        adaptivePolicies: boolean;
        threatIntelligenceEnabled: boolean;
    };
    encryption: {
        algorithm: "aes-256-cbc" | "aes-256-gcm" | "chacha20-poly1305";
        keyRotationInterval: number;
        keyDerivationIterations: number;
        saltLength: number;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
        skipSuccessfulRequests: boolean;
        skipFailedRequests: boolean;
    };
    ddosProtection: {
        enabled: boolean;
        maxRequestsPerSecond: number;
        blockDuration: number;
        suspiciousThreshold: number;
    };
    vulnerabilityScanning: {
        enabled: boolean;
        scheduledScans: boolean;
        scanInterval: number;
        continuousMonitoring: boolean;
        autoRemediation: boolean;
    };
    compliance: {
        gdpr: {
            enabled: boolean;
            dataRetentionPeriod: number;
            anonymizationEnabled: boolean;
        };
        soc2: {
            enabled: boolean;
            auditLogRetention: number;
            accessControlLogging: boolean;
        };
        hipaa: {
            enabled: boolean;
            encryptionRequired: boolean;
            accessLogging: boolean;
        };
    };
    headers: {
        hsts: {
            maxAge: number;
            includeSubDomains: boolean;
            preload: boolean;
            enabled: boolean;
        };
        csp: {
            directives: Record<string, string[]>;
            enabled: boolean;
        };
        frameOptions: "DENY" | "SAMEORIGIN";
        contentTypeOptions: boolean;
        xssProtection: boolean;
    };
    session: {
        maxAge: number;
        secure: boolean;
        httpOnly: boolean;
        sameSite: "strict" | "lax" | "none";
        rolling: boolean;
    };
    apiSecurity: {
        apiKeyRequired: boolean;
        apiKeyHeader: string;
        jwtSecret: string;
        jwtExpiration: string;
        refreshTokenExpiration: string;
    };
    monitoring: {
        enabled: boolean;
        metricsCollection: boolean;
        alerting: boolean;
        logLevel: "error" | "info" | "warn" | "debug";
        performanceMonitoring: boolean;
    };
};
export {};
//# sourceMappingURL=securityConfig.d.ts.map