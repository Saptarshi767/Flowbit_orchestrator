import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { KeyManager } from '../src/encryption/keyManager';
import { DataEncryption } from '../src/encryption/dataEncryption';
import { RateLimiter } from '../src/rateLimit/rateLimiter';
import { AuditLogger } from '../src/audit/auditLogger';
import { ZeroTrustEngine } from '../src/zeroTrust/zeroTrustEngine';
import { VulnerabilityScanner } from '../src/scanning/vulnerabilityScanner';
import { SecurityMiddleware } from '../src/middleware/securityMiddleware';

// Mock Redis for testing
const mockRedis = {
  pipeline: jest.fn(() => ({
    zremrangebyscore: jest.fn(),
    zcard: jest.fn(),
    expire: jest.fn(),
    exec: jest.fn().mockResolvedValue([[null, 0], [null, 0]])
  })),
  zadd: jest.fn(),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  flushall: jest.fn()
} as any;

describe('Security Features', () => {
  describe('KeyManager', () => {
    let keyManager: KeyManager;

    beforeEach(() => {
      keyManager = new KeyManager();
    });

    it('should encrypt and decrypt data correctly', async () => {
      const testData = 'sensitive information';
      const encrypted = await keyManager.encrypt(testData);
      const decrypted = await keyManager.decrypt(encrypted);
      
      expect(decrypted.toString('utf8')).toBe(testData);
      expect(encrypted.encryptedData).not.toEqual(Buffer.from(testData));
    });

    it('should generate unique encryption keys', async () => {
      const key1 = await keyManager.generateNewKey();
      const key2 = await keyManager.generateNewKey();
      
      expect(key1).not.toBe(key2);
      expect(keyManager.getKeyInfo(key1)).toBeDefined();
      expect(keyManager.getKeyInfo(key2)).toBeDefined();
    });

    it('should rotate keys properly', async () => {
      const originalKeys = keyManager.listKeys();
      const newKeyId = await keyManager.rotateKey();
      const updatedKeys = keyManager.listKeys();
      
      expect(updatedKeys.length).toBe(originalKeys.length + 1);
      expect(keyManager.getKeyInfo(newKeyId)?.status).toBe('active');
    });

    it('should handle invalid decryption attempts', async () => {
      const testData = 'test data';
      const encrypted = await keyManager.encrypt(testData);
      
      // Tamper with encrypted data
      encrypted.encryptedData = Buffer.from('tampered data');
      
      await expect(keyManager.decrypt(encrypted)).rejects.toThrow();
    });
  });

  describe('DataEncryption', () => {
    let dataEncryption: DataEncryption;

    beforeEach(() => {
      dataEncryption = new DataEncryption();
    });

    it('should encrypt sensitive fields in objects', async () => {
      const testObject = {
        username: 'testuser',
        password: 'secretpassword',
        apiKey: 'secret-api-key',
        normalField: 'normal data'
      };

      const encrypted = await dataEncryption.encryptSensitiveData(testObject);
      
      expect(encrypted.username).toBe('testuser'); // Not sensitive
      expect(encrypted.normalField).toBe('normal data'); // Not sensitive
      expect(encrypted.password).toHaveProperty('value');
      expect(encrypted.password).toHaveProperty('keyId');
      expect(encrypted.apiKey).toHaveProperty('value');
      expect(encrypted.apiKey).toHaveProperty('keyId');
    });

    it('should decrypt sensitive fields correctly', async () => {
      const testObject = {
        username: 'testuser',
        password: 'secretpassword',
        apiKey: 'secret-api-key'
      };

      const encrypted = await dataEncryption.encryptSensitiveData(testObject);
      const decrypted = await dataEncryption.decryptSensitiveData(encrypted);
      
      expect(decrypted).toEqual(testObject);
    });

    it('should handle nested objects', async () => {
      const testObject = {
        user: {
          name: 'test',
          credentials: {
            password: 'secret',
            token: 'secret-token'
          }
        }
      };

      const encrypted = await dataEncryption.encryptSensitiveData(testObject);
      const decrypted = await dataEncryption.decryptSensitiveData(encrypted);
      
      expect(decrypted).toEqual(testObject);
    });
  });

  describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter(mockRedis, {
        windowMs: 60000, // 1 minute
        maxRequests: 10
      });
    });

    afterEach(async () => {
      jest.clearAllMocks();
    });

    it('should allow requests within limit', async () => {
      const mockReq = { ip: '127.0.0.1' } as any;
      const mockRes = { set: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
      const mockNext = jest.fn();

      const middleware = rateLimiter.middleware();
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });

    it('should block requests exceeding limit', async () => {
      const mockReq = { ip: '127.0.0.1' } as any;
      const mockRes = { 
        set: jest.fn(), 
        status: jest.fn().mockReturnThis(), 
        json: jest.fn().mockReturnThis() 
      } as any;
      const mockNext = jest.fn();

      const middleware = rateLimiter.middleware();
      
      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        await middleware(mockReq, mockRes, mockNext);
      }
      
      // This request should be blocked
      mockNext.mockClear();
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('AuditLogger', () => {
    let auditLogger: AuditLogger;

    beforeEach(() => {
      auditLogger = new AuditLogger();
    });

    it('should log audit events with proper hash chain', async () => {
      await auditLogger.logEvent({
        userId: 'user1',
        action: 'login',
        resource: 'auth',
        details: { method: 'password' },
        outcome: 'success',
        severity: 'low'
      });

      await auditLogger.logEvent({
        userId: 'user1',
        action: 'access',
        resource: 'workflow',
        details: { workflowId: 'wf1' },
        outcome: 'success',
        severity: 'low'
      });

      const chainVerification = await auditLogger.verifyChainIntegrity();
      expect(chainVerification.isValid).toBe(true);
      expect(chainVerification.events).toHaveLength(2);
    });

    it('should detect chain tampering', async () => {
      await auditLogger.logEvent({
        userId: 'user1',
        action: 'login',
        resource: 'auth',
        details: {},
        outcome: 'success',
        severity: 'low'
      });

      // Simulate tampering by modifying the event
      const events = (auditLogger as any).eventStore;
      if (events.length > 0) {
        events[0].action = 'tampered';
      }

      const chainVerification = await auditLogger.verifyChainIntegrity();
      expect(chainVerification.isValid).toBe(false);
      expect(chainVerification.brokenAt).toBe(0);
    });

    it('should provide convenience methods for common events', async () => {
      await auditLogger.logAuthentication('user1', 'success');
      await auditLogger.logAuthorization('user1', 'workflow', 'read', 'success');
      await auditLogger.logDataAccess('user1', 'workflow', 'wf1', 'read');

      const chainVerification = await auditLogger.verifyChainIntegrity();
      expect(chainVerification.isValid).toBe(true);
      expect(chainVerification.events).toHaveLength(3);
    });
  });

  describe('ZeroTrustEngine', () => {
    let zeroTrustEngine: ZeroTrustEngine;

    beforeEach(() => {
      zeroTrustEngine = new ZeroTrustEngine();
    });

    it('should calculate trust scores correctly', async () => {
      const context = {
        userId: 'user1',
        sessionId: 'session1',
        deviceFingerprint: 'device1',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date()
      };

      const decision = await zeroTrustEngine.evaluateAccess('/api/workflows', 'read', context);
      
      expect(decision.trustScore).toBeDefined();
      expect(decision.trustScore.overall).toBeGreaterThanOrEqual(0);
      expect(decision.trustScore.overall).toBeLessThanOrEqual(1);
      expect(decision.trustScore.factors).toHaveProperty('identity');
      expect(decision.trustScore.factors).toHaveProperty('device');
      expect(decision.trustScore.factors).toHaveProperty('location');
      expect(decision.trustScore.factors).toHaveProperty('behavior');
      expect(decision.trustScore.factors).toHaveProperty('network');
    });

    it('should deny access for low trust scores', async () => {
      const context = {
        sessionId: 'session1',
        deviceFingerprint: 'unknown-device',
        ipAddress: '192.168.1.1',
        userAgent: 'suspicious-agent',
        timestamp: new Date()
      };

      const decision = await zeroTrustEngine.evaluateAccess('/admin/users', 'delete', context);
      
      // Admin operations should require high trust
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('policy');
    });

    it('should provide required actions for access improvement', async () => {
      const context = {
        userId: 'user1',
        sessionId: 'session1',
        deviceFingerprint: 'new-device',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date()
      };

      const decision = await zeroTrustEngine.evaluateAccess('/admin/settings', 'write', context);
      
      if (!decision.allowed) {
        expect(decision.requiredActions).toBeDefined();
        expect(Array.isArray(decision.requiredActions)).toBe(true);
      }
    });
  });

  describe('VulnerabilityScanner', () => {
    let vulnerabilityScanner: VulnerabilityScanner;

    beforeEach(() => {
      vulnerabilityScanner = new VulnerabilityScanner();
    });

    it('should generate compliance reports', async () => {
      const report = await vulnerabilityScanner.generateComplianceReport();
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('totalScans');
      expect(report).toHaveProperty('criticalVulnerabilities');
      expect(report).toHaveProperty('complianceStatus');
      expect(report).toHaveProperty('recommendations');
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should store and retrieve scan reports', async () => {
      // Mock a scan result
      const mockReport = {
        id: 'test-scan-1',
        timestamp: new Date(),
        scanType: 'dependency' as const,
        status: 'completed' as const,
        vulnerabilities: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
        metadata: {
          scanner: 'test',
          version: '1.0.0',
          duration: 1000
        }
      };

      (vulnerabilityScanner as any).scanResults.set(mockReport.id, mockReport);
      
      const retrievedReport = await vulnerabilityScanner.getReport(mockReport.id);
      expect(retrievedReport).toEqual(mockReport);
      
      const allReports = await vulnerabilityScanner.getAllReports();
      expect(allReports).toContain(mockReport);
    });

    it('should generate SBOM correctly', async () => {
      // Mock package.json content
      const mockPackageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'lodash': '^4.17.20',
          'express': '^4.18.0'
        },
        devDependencies: {
          'jest': '^29.0.0'
        }
      };

      // Mock fs.readFile
      const originalReadFile = require('fs/promises').readFile;
      require('fs/promises').readFile = jest.fn().mockResolvedValue(JSON.stringify(mockPackageJson));

      const sbom = await vulnerabilityScanner.generateSBOM('/mock/path');
      
      expect(sbom.bomFormat).toBe('CycloneDX');
      expect(sbom.components).toHaveLength(3);
      expect(sbom.components.some(c => c.name === 'lodash')).toBe(true);
      expect(sbom.components.some(c => c.name === 'express')).toBe(true);
      expect(sbom.components.some(c => c.name === 'jest')).toBe(true);

      // Restore original function
      require('fs/promises').readFile = originalReadFile;
    });

    it('should provide continuous monitoring status', async () => {
      const status = await vulnerabilityScanner.getContinuousMonitoringStatus();
      
      expect(status).toHaveProperty('isActive');
      expect(status).toHaveProperty('activeScans');
      expect(status).toHaveProperty('queuedScans');
      expect(status).toHaveProperty('scansLast24h');
      expect(status).toHaveProperty('vulnerabilitiesFound');
      expect(status).toHaveProperty('criticalVulnerabilitiesFound');
      expect(typeof status.isActive).toBe('boolean');
      expect(typeof status.activeScans).toBe('number');
    });
  });

  describe('Enhanced KeyManager', () => {
    let keyManager: KeyManager;

    beforeEach(() => {
      keyManager = new KeyManager();
    });

    afterEach(() => {
      keyManager.cleanup();
    });

    it('should derive keys from passwords', async () => {
      const password = 'test-password-123';
      const derivedKey1 = await keyManager.deriveKeyFromPassword(password);
      const derivedKey2 = await keyManager.deriveKeyFromPassword(password);
      
      expect(derivedKey1).toEqual(derivedKey2);
      expect(derivedKey1).toHaveLength(32); // 256 bits
    });

    it('should export and import keys', async () => {
      const password = 'export-password-123';
      const keyId = await keyManager.generateNewKey();
      
      const exportedKey = await keyManager.exportKey(keyId, password);
      expect(typeof exportedKey).toBe('string');
      
      const importedKeyId = await keyManager.importKey(exportedKey, password);
      expect(importedKeyId).toBe(keyId);
    });

    it('should provide key metrics', () => {
      const metrics = keyManager.getKeyMetrics();
      
      expect(metrics).toHaveProperty('totalKeys');
      expect(metrics).toHaveProperty('activeKeys');
      expect(metrics).toHaveProperty('rotatingKeys');
      expect(metrics).toHaveProperty('deprecatedKeys');
      expect(metrics).toHaveProperty('oldestKeyAge');
      expect(typeof metrics.totalKeys).toBe('number');
      expect(typeof metrics.activeKeys).toBe('number');
    });

    it('should securely delete keys', async () => {
      const keyId = await keyManager.generateNewKey();
      expect(keyManager.getKeyInfo(keyId)).toBeDefined();
      
      await keyManager.secureDelete(keyId);
      expect(keyManager.getKeyInfo(keyId)).toBeUndefined();
    });
  });

  describe('Enhanced AuditLogger', () => {
    let auditLogger: AuditLogger;

    beforeEach(() => {
      auditLogger = new AuditLogger();
    });

    it('should create and verify audit proofs', async () => {
      await auditLogger.logEvent({
        userId: 'user1',
        action: 'test',
        resource: 'test',
        details: {},
        outcome: 'success',
        severity: 'low'
      });

      const events = (auditLogger as any).eventStore;
      const eventId = events[0].id;
      
      const proof = await auditLogger.createAuditProof(eventId);
      expect(proof).toBeDefined();
      expect(proof!.eventId).toBe(eventId);
      expect(proof!.merkleRoot).toBeDefined();
      
      const isValid = await auditLogger.verifyAuditProof(proof!);
      expect(isValid).toBe(true);
    });

    it('should export audit logs', async () => {
      await auditLogger.logEvent({
        userId: 'user1',
        action: 'test1',
        resource: 'test',
        details: {},
        outcome: 'success',
        severity: 'low'
      });

      await auditLogger.logEvent({
        userId: 'user2',
        action: 'test2',
        resource: 'test',
        details: {},
        outcome: 'success',
        severity: 'low'
      });

      const exportData = await auditLogger.exportAuditLog();
      
      expect(exportData.events).toHaveLength(2);
      expect(exportData.merkleRoot).toBeDefined();
      expect(exportData.signature).toBeDefined();
      expect(exportData.exportTimestamp).toBeInstanceOf(Date);
    });

    it('should provide audit statistics', async () => {
      await auditLogger.logEvent({
        userId: 'user1',
        action: 'login',
        resource: 'auth',
        details: {},
        outcome: 'success',
        severity: 'low'
      });

      const stats = await auditLogger.getAuditStatistics();
      
      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('eventsLast24h');
      expect(stats).toHaveProperty('eventsByAction');
      expect(stats).toHaveProperty('uniqueUsers');
      expect(stats).toHaveProperty('chainIntegrity');
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.chainIntegrity).toBe(true);
    });
  });

  describe('Enhanced ZeroTrustEngine', () => {
    let zeroTrustEngine: ZeroTrustEngine;

    beforeEach(() => {
      zeroTrustEngine = new ZeroTrustEngine();
    });

    it('should perform risk assessment', async () => {
      const context = {
        userId: 'user1',
        sessionId: 'session1',
        deviceFingerprint: 'device1',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date()
      };

      const riskAssessment = await zeroTrustEngine.performRiskAssessment(context);
      
      expect(riskAssessment).toHaveProperty('id');
      expect(riskAssessment).toHaveProperty('riskFactors');
      expect(riskAssessment).toHaveProperty('overallRisk');
      expect(riskAssessment).toHaveProperty('recommendations');
      expect(Array.isArray(riskAssessment.riskFactors)).toBe(true);
      expect(['low', 'medium', 'high', 'critical']).toContain(riskAssessment.overallRisk);
    });

    it('should provide continuous assessment status', async () => {
      const status = await zeroTrustEngine.getContinuousAssessmentStatus();
      
      expect(status).toHaveProperty('activeAssessments');
      expect(status).toHaveProperty('averageTrustScore');
      expect(status).toHaveProperty('riskTrend');
      expect(status).toHaveProperty('policyViolations');
      expect(status).toHaveProperty('adaptivePolicyChanges');
      expect(typeof status.activeAssessments).toBe('number');
      expect(typeof status.averageTrustScore).toBe('number');
      expect(['increasing', 'stable', 'decreasing']).toContain(status.riskTrend);
    });

    it('should update threat intelligence', async () => {
      // Should not throw
      await expect(zeroTrustEngine.updateThreatIntelligence()).resolves.not.toThrow();
    });
  });

  describe('SecurityMiddleware', () => {
    let securityMiddleware: SecurityMiddleware;

    beforeEach(() => {
      securityMiddleware = new SecurityMiddleware(mockRedis, {
        cors: {
          origin: 'https://example.com',
          credentials: true
        },
        rateLimit: {
          windowMs: 60000,
          maxRequests: 100
        },
        helmet: {
          contentSecurityPolicy: true,
          hsts: true
        }
      });
    });

    afterEach(async () => {
      jest.clearAllMocks();
    });

    it('should validate request size', () => {
      const middleware = securityMiddleware.requestValidation();
      const mockReq = {
        method: 'POST',
        get: jest.fn().mockReturnValue('20971520') // 20MB
      } as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should validate content type for POST requests', () => {
      const middleware = securityMiddleware.requestValidation();
      const mockReq = {
        method: 'POST',
        get: jest.fn().mockImplementation((header) => {
          if (header === 'content-length') return '1000';
          if (header === 'content-type') return 'text/plain';
          return null;
        })
      } as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(415);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should sanitize input data', () => {
      const middleware = securityMiddleware.inputSanitization();
      const mockReq = {
        body: {
          name: '<script>alert("xss")</script>',
          description: 'Normal text',
          __proto__: 'malicious'
        },
        query: {
          search: 'javascript:alert("xss")'
        }
      } as any;
      const mockRes = {} as any;
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);
      
      expect(mockReq.body.name).not.toContain('<script>');
      expect(mockReq.body.description).toBe('Normal text');
      expect(mockReq.body.__proto__).toBeUndefined();
      expect(mockReq.query.search).not.toContain('javascript:');
      expect(mockNext).toHaveBeenCalled();
    });
  });
});