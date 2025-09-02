// Main security service exports
export { KeyManager, keyManager } from './encryption/keyManager';
export { DataEncryption, dataEncryption } from './encryption/dataEncryption';
export { RateLimiter, DDoSProtection } from './rateLimit/rateLimiter';
export { SecurityMiddleware } from './middleware/securityMiddleware';
export { AuditLogger, auditLogger } from './audit/auditLogger';
export { AuditMiddleware, auditMiddleware } from './audit/auditMiddleware';
export { ZeroTrustEngine, zeroTrustEngine } from './zeroTrust/zeroTrustEngine';
export { ZeroTrustMiddleware, zeroTrustMiddleware } from './zeroTrust/zeroTrustMiddleware';
export { VulnerabilityScanner, vulnerabilityScanner } from './scanning/vulnerabilityScanner';
export { SecurityMonitor, securityMonitor } from './monitoring/securityMonitor';
export { SecurityConfigManager, securityConfigManager, securityConfig } from './config/securityConfig';

// Compliance service exports
export { 
  ComplianceService,
  GDPRComplianceService,
  SOC2ComplianceService,
  DataResidencyService,
  ComplianceReportingService,
  DataClassificationService,
  ComplianceValidatorService
} from './compliance';

// Types
export type { EncryptionKey, EncryptionResult } from './encryption/keyManager';
export type { EncryptedField } from './encryption/dataEncryption';
export type { RateLimitConfig, RateLimitInfo } from './rateLimit/rateLimiter';
export type { SecurityConfig as MiddlewareSecurityConfig } from './middleware/securityMiddleware';
export type { AuditEvent, AuditChain, AuditProof, AuditExport, AuditStatistics } from './audit/auditLogger';
export type { AuditableRequest } from './audit/auditMiddleware';
export type { TrustScore, SecurityContext, AccessPolicy, AccessDecision } from './zeroTrust/zeroTrustEngine';
export type { ZeroTrustRequest } from './zeroTrust/zeroTrustMiddleware';
export type { VulnerabilityReport, Vulnerability } from './scanning/vulnerabilityScanner';
export type { SecurityMetrics, SecurityAlert, SecurityDashboard } from './monitoring/securityMonitor';
export type { SecurityConfig } from './config/securityConfig';

// Compliance types
export type {
  GDPRDataSubject,
  DataExportRequest,
  DataDeletionRequest,
  PersonalDataCategory,
  SOC2Control,
  AuditEvent as SOC2AuditEvent,
  ComplianceReport,
  ComplianceFinding,
  DataResidencyRule,
  DataRestriction,
  DataClassification,
  RegionInfo,
  DataLocation,
  DataMovement,
  ComplianceFramework,
  ComplianceRequirement,
  Evidence,
  TestResult,
  CertificationStatus,
  DataClassificationLevel,
  HandlingRequirement,
  RetentionPolicy,
  AccessControl,
  EncryptionRequirement,
  DataAsset,
  ClassificationRule,
  PolicyViolation,
  ComplianceTest,
  ComplianceTestResult,
  ComplianceTestSuite,
  ValidationReport,
  ComplianceDashboard
} from './compliance';

// Security service factory
import Redis from 'ioredis';
import { SecurityMiddleware } from './middleware/securityMiddleware';

export interface SecurityServiceConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  helmet: {
    contentSecurityPolicy: boolean;
    hsts: boolean;
  };
}

export class SecurityService {
  private redis: Redis;
  private securityMiddleware: SecurityMiddleware;

  constructor(config: SecurityServiceConfig) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    this.securityMiddleware = new SecurityMiddleware(this.redis, {
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

  getRedisClient(): Redis {
    return this.redis;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export function createSecurityService(config: SecurityServiceConfig): SecurityService {
  return new SecurityService(config);
}