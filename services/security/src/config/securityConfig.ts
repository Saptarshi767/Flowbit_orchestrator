import { z } from 'zod';

// Security configuration schema
const SecurityConfigSchema = z.object({
  encryption: z.object({
    algorithm: z.enum(['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305']).default('aes-256-gcm'),
    keyRotationInterval: z.number().min(86400000).default(2592000000), // 30 days in ms
    keyDerivationIterations: z.number().min(100000).default(100000),
    saltLength: z.number().min(16).default(32)
  }),
  
  rateLimit: z.object({
    windowMs: z.number().min(1000).default(60000), // 1 minute
    maxRequests: z.number().min(1).default(100),
    skipSuccessfulRequests: z.boolean().default(false),
    skipFailedRequests: z.boolean().default(false)
  }),
  
  ddosProtection: z.object({
    enabled: z.boolean().default(true),
    maxRequestsPerSecond: z.number().min(1).default(100),
    blockDuration: z.number().min(60000).default(3600000), // 1 hour
    suspiciousThreshold: z.number().min(10).default(50)
  }),
  
  audit: z.object({
    enabled: z.boolean().default(true),
    tamperProofStorage: z.boolean().default(true),
    retentionPeriod: z.number().min(86400000).default(31536000000), // 1 year
    compressionEnabled: z.boolean().default(true),
    encryptionEnabled: z.boolean().default(true)
  }),
  
  zeroTrust: z.object({
    enabled: z.boolean().default(true),
    trustScoreThreshold: z.number().min(0).max(1).default(0.6),
    riskAssessmentInterval: z.number().min(60000).default(300000), // 5 minutes
    adaptivePolicies: z.boolean().default(true),
    threatIntelligenceEnabled: z.boolean().default(true)
  }),
  
  vulnerabilityScanning: z.object({
    enabled: z.boolean().default(true),
    scheduledScans: z.boolean().default(true),
    scanInterval: z.number().min(3600000).default(86400000), // 24 hours
    continuousMonitoring: z.boolean().default(true),
    autoRemediation: z.boolean().default(false)
  }),
  
  compliance: z.object({
    gdpr: z.object({
      enabled: z.boolean().default(true),
      dataRetentionPeriod: z.number().min(86400000).default(94608000000), // 3 years
      anonymizationEnabled: z.boolean().default(true)
    }),
    soc2: z.object({
      enabled: z.boolean().default(true),
      auditLogRetention: z.number().min(31536000000).default(94608000000), // 3 years
      accessControlLogging: z.boolean().default(true)
    }),
    hipaa: z.object({
      enabled: z.boolean().default(false),
      encryptionRequired: z.boolean().default(true),
      accessLogging: z.boolean().default(true)
    })
  }),
  
  headers: z.object({
    hsts: z.object({
      enabled: z.boolean().default(true),
      maxAge: z.number().min(31536000).default(31536000), // 1 year
      includeSubDomains: z.boolean().default(true),
      preload: z.boolean().default(true)
    }),
    csp: z.object({
      enabled: z.boolean().default(true),
      directives: z.record(z.array(z.string())).default({
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
    frameOptions: z.enum(['DENY', 'SAMEORIGIN']).default('DENY'),
    contentTypeOptions: z.boolean().default(true),
    xssProtection: z.boolean().default(true)
  }),
  
  cors: z.object({
    enabled: z.boolean().default(true),
    origin: z.union([z.string(), z.array(z.string())]).default(['https://localhost:3000']),
    credentials: z.boolean().default(true),
    methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    allowedHeaders: z.array(z.string()).default(['Content-Type', 'Authorization', 'X-API-Key'])
  }),
  
  session: z.object({
    secure: z.boolean().default(true),
    httpOnly: z.boolean().default(true),
    sameSite: z.enum(['strict', 'lax', 'none']).default('strict'),
    maxAge: z.number().min(300000).default(3600000), // 1 hour
    rolling: z.boolean().default(true)
  }),
  
  apiSecurity: z.object({
    apiKeyRequired: z.boolean().default(true),
    apiKeyHeader: z.string().default('X-API-Key'),
    jwtSecret: z.string().min(32),
    jwtExpiration: z.string().default('1h'),
    refreshTokenExpiration: z.string().default('7d')
  }),
  
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsCollection: z.boolean().default(true),
    alerting: z.boolean().default(true),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    performanceMonitoring: z.boolean().default(true)
  })
});

export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

// Default security configuration
export const defaultSecurityConfig: SecurityConfig = {
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
export const developmentSecurityConfig: Partial<SecurityConfig> = {
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

export const productionSecurityConfig: Partial<SecurityConfig> = {
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
export class SecurityConfigManager {
  private config: SecurityConfig;

  constructor(environment: 'development' | 'production' | 'test' = 'development') {
    this.config = this.loadConfig(environment);
  }

  private loadConfig(environment: string): SecurityConfig {
    let config = { ...defaultSecurityConfig };

    // Apply environment-specific overrides
    switch (environment) {
      case 'development':
        config = { ...config, ...developmentSecurityConfig };
        break;
      case 'production':
        config = { ...config, ...productionSecurityConfig };
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

  getConfig(): SecurityConfig {
    return this.config;
  }

  updateConfig(updates: Partial<SecurityConfig>): void {
    const newConfig = { ...this.config, ...updates };
    const result = SecurityConfigSchema.safeParse(newConfig);
    
    if (!result.success) {
      throw new Error(`Invalid security configuration update: ${result.error.message}`);
    }
    
    this.config = result.data;
  }

  validateConfig(config: unknown): SecurityConfig {
    const result = SecurityConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid security configuration: ${result.error.message}`);
    }
    return result.data;
  }

  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importConfig(configJson: string): void {
    try {
      const config = JSON.parse(configJson);
      this.config = this.validateConfig(config);
    } catch (error) {
      throw new Error(`Failed to import security configuration: ${error}`);
    }
  }
}

// Singleton instance
export const securityConfigManager = new SecurityConfigManager(
  process.env.NODE_ENV as 'development' | 'production' | 'test' || 'development'
);

export const securityConfig = securityConfigManager.getConfig();