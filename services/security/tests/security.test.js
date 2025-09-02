"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const keyManager_1 = require("../src/encryption/keyManager");
const dataEncryption_1 = require("../src/encryption/dataEncryption");
const rateLimiter_1 = require("../src/rateLimit/rateLimiter");
const auditLogger_1 = require("../src/audit/auditLogger");
const zeroTrustEngine_1 = require("../src/zeroTrust/zeroTrustEngine");
const vulnerabilityScanner_1 = require("../src/scanning/vulnerabilityScanner");
const securityMiddleware_1 = require("../src/middleware/securityMiddleware");
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
};
(0, globals_1.describe)('Security Features', () => {
    (0, globals_1.describe)('KeyManager', () => {
        let keyManager;
        (0, globals_1.beforeEach)(() => {
            keyManager = new keyManager_1.KeyManager();
        });
        (0, globals_1.it)('should encrypt and decrypt data correctly', async () => {
            const testData = 'sensitive information';
            const encrypted = await keyManager.encrypt(testData);
            const decrypted = await keyManager.decrypt(encrypted);
            (0, globals_1.expect)(decrypted.toString('utf8')).toBe(testData);
            (0, globals_1.expect)(encrypted.encryptedData).not.toEqual(Buffer.from(testData));
        });
        (0, globals_1.it)('should generate unique encryption keys', async () => {
            const key1 = await keyManager.generateNewKey();
            const key2 = await keyManager.generateNewKey();
            (0, globals_1.expect)(key1).not.toBe(key2);
            (0, globals_1.expect)(keyManager.getKeyInfo(key1)).toBeDefined();
            (0, globals_1.expect)(keyManager.getKeyInfo(key2)).toBeDefined();
        });
        (0, globals_1.it)('should rotate keys properly', async () => {
            const originalKeys = keyManager.listKeys();
            const newKeyId = await keyManager.rotateKey();
            const updatedKeys = keyManager.listKeys();
            (0, globals_1.expect)(updatedKeys.length).toBe(originalKeys.length + 1);
            (0, globals_1.expect)(keyManager.getKeyInfo(newKeyId)?.status).toBe('active');
        });
        (0, globals_1.it)('should handle invalid decryption attempts', async () => {
            const testData = 'test data';
            const encrypted = await keyManager.encrypt(testData);
            // Tamper with encrypted data
            encrypted.encryptedData = Buffer.from('tampered data');
            await (0, globals_1.expect)(keyManager.decrypt(encrypted)).rejects.toThrow();
        });
    });
    (0, globals_1.describe)('DataEncryption', () => {
        let dataEncryption;
        (0, globals_1.beforeEach)(() => {
            dataEncryption = new dataEncryption_1.DataEncryption();
        });
        (0, globals_1.it)('should encrypt sensitive fields in objects', async () => {
            const testObject = {
                username: 'testuser',
                password: 'secretpassword',
                apiKey: 'secret-api-key',
                normalField: 'normal data'
            };
            const encrypted = await dataEncryption.encryptSensitiveData(testObject);
            (0, globals_1.expect)(encrypted.username).toBe('testuser'); // Not sensitive
            (0, globals_1.expect)(encrypted.normalField).toBe('normal data'); // Not sensitive
            (0, globals_1.expect)(encrypted.password).toHaveProperty('value');
            (0, globals_1.expect)(encrypted.password).toHaveProperty('keyId');
            (0, globals_1.expect)(encrypted.apiKey).toHaveProperty('value');
            (0, globals_1.expect)(encrypted.apiKey).toHaveProperty('keyId');
        });
        (0, globals_1.it)('should decrypt sensitive fields correctly', async () => {
            const testObject = {
                username: 'testuser',
                password: 'secretpassword',
                apiKey: 'secret-api-key'
            };
            const encrypted = await dataEncryption.encryptSensitiveData(testObject);
            const decrypted = await dataEncryption.decryptSensitiveData(encrypted);
            (0, globals_1.expect)(decrypted).toEqual(testObject);
        });
        (0, globals_1.it)('should handle nested objects', async () => {
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
            (0, globals_1.expect)(decrypted).toEqual(testObject);
        });
    });
    (0, globals_1.describe)('RateLimiter', () => {
        let rateLimiter;
        (0, globals_1.beforeEach)(() => {
            rateLimiter = new rateLimiter_1.RateLimiter(mockRedis, {
                windowMs: 60000, // 1 minute
                maxRequests: 10
            });
        });
        (0, globals_1.afterEach)(async () => {
            jest.clearAllMocks();
        });
        (0, globals_1.it)('should allow requests within limit', async () => {
            const mockReq = { ip: '127.0.0.1' };
            const mockRes = { set: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
            const mockNext = jest.fn();
            const middleware = rateLimiter.middleware();
            await middleware(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockNext).toHaveBeenCalled();
            (0, globals_1.expect)(mockRes.status).not.toHaveBeenCalledWith(429);
        });
        (0, globals_1.it)('should block requests exceeding limit', async () => {
            const mockReq = { ip: '127.0.0.1' };
            const mockRes = {
                set: jest.fn(),
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };
            const mockNext = jest.fn();
            const middleware = rateLimiter.middleware();
            // Make requests up to the limit
            for (let i = 0; i < 10; i++) {
                await middleware(mockReq, mockRes, mockNext);
            }
            // This request should be blocked
            mockNext.mockClear();
            await middleware(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockRes.status).toHaveBeenCalledWith(429);
            (0, globals_1.expect)(mockNext).not.toHaveBeenCalled();
        });
    });
    (0, globals_1.describe)('AuditLogger', () => {
        let auditLogger;
        (0, globals_1.beforeEach)(() => {
            auditLogger = new auditLogger_1.AuditLogger();
        });
        (0, globals_1.it)('should log audit events with proper hash chain', async () => {
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
            (0, globals_1.expect)(chainVerification.isValid).toBe(true);
            (0, globals_1.expect)(chainVerification.events).toHaveLength(2);
        });
        (0, globals_1.it)('should detect chain tampering', async () => {
            await auditLogger.logEvent({
                userId: 'user1',
                action: 'login',
                resource: 'auth',
                details: {},
                outcome: 'success',
                severity: 'low'
            });
            // Simulate tampering by modifying the event
            const events = auditLogger.eventStore;
            if (events.length > 0) {
                events[0].action = 'tampered';
            }
            const chainVerification = await auditLogger.verifyChainIntegrity();
            (0, globals_1.expect)(chainVerification.isValid).toBe(false);
            (0, globals_1.expect)(chainVerification.brokenAt).toBe(0);
        });
        (0, globals_1.it)('should provide convenience methods for common events', async () => {
            await auditLogger.logAuthentication('user1', 'success');
            await auditLogger.logAuthorization('user1', 'workflow', 'read', 'success');
            await auditLogger.logDataAccess('user1', 'workflow', 'wf1', 'read');
            const chainVerification = await auditLogger.verifyChainIntegrity();
            (0, globals_1.expect)(chainVerification.isValid).toBe(true);
            (0, globals_1.expect)(chainVerification.events).toHaveLength(3);
        });
    });
    (0, globals_1.describe)('ZeroTrustEngine', () => {
        let zeroTrustEngine;
        (0, globals_1.beforeEach)(() => {
            zeroTrustEngine = new zeroTrustEngine_1.ZeroTrustEngine();
        });
        (0, globals_1.it)('should calculate trust scores correctly', async () => {
            const context = {
                userId: 'user1',
                sessionId: 'session1',
                deviceFingerprint: 'device1',
                ipAddress: '127.0.0.1',
                userAgent: 'Mozilla/5.0',
                timestamp: new Date()
            };
            const decision = await zeroTrustEngine.evaluateAccess('/api/workflows', 'read', context);
            (0, globals_1.expect)(decision.trustScore).toBeDefined();
            (0, globals_1.expect)(decision.trustScore.overall).toBeGreaterThanOrEqual(0);
            (0, globals_1.expect)(decision.trustScore.overall).toBeLessThanOrEqual(1);
            (0, globals_1.expect)(decision.trustScore.factors).toHaveProperty('identity');
            (0, globals_1.expect)(decision.trustScore.factors).toHaveProperty('device');
            (0, globals_1.expect)(decision.trustScore.factors).toHaveProperty('location');
            (0, globals_1.expect)(decision.trustScore.factors).toHaveProperty('behavior');
            (0, globals_1.expect)(decision.trustScore.factors).toHaveProperty('network');
        });
        (0, globals_1.it)('should deny access for low trust scores', async () => {
            const context = {
                sessionId: 'session1',
                deviceFingerprint: 'unknown-device',
                ipAddress: '192.168.1.1',
                userAgent: 'suspicious-agent',
                timestamp: new Date()
            };
            const decision = await zeroTrustEngine.evaluateAccess('/admin/users', 'delete', context);
            // Admin operations should require high trust
            (0, globals_1.expect)(decision.allowed).toBe(false);
            (0, globals_1.expect)(decision.reason).toContain('policy');
        });
        (0, globals_1.it)('should provide required actions for access improvement', async () => {
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
                (0, globals_1.expect)(decision.requiredActions).toBeDefined();
                (0, globals_1.expect)(Array.isArray(decision.requiredActions)).toBe(true);
            }
        });
    });
    (0, globals_1.describe)('VulnerabilityScanner', () => {
        let vulnerabilityScanner;
        (0, globals_1.beforeEach)(() => {
            vulnerabilityScanner = new vulnerabilityScanner_1.VulnerabilityScanner();
        });
        (0, globals_1.it)('should generate compliance reports', async () => {
            const report = await vulnerabilityScanner.generateComplianceReport();
            (0, globals_1.expect)(report).toHaveProperty('timestamp');
            (0, globals_1.expect)(report).toHaveProperty('totalScans');
            (0, globals_1.expect)(report).toHaveProperty('criticalVulnerabilities');
            (0, globals_1.expect)(report).toHaveProperty('complianceStatus');
            (0, globals_1.expect)(report).toHaveProperty('recommendations');
            (0, globals_1.expect)(Array.isArray(report.recommendations)).toBe(true);
        });
        (0, globals_1.it)('should store and retrieve scan reports', async () => {
            // Mock a scan result
            const mockReport = {
                id: 'test-scan-1',
                timestamp: new Date(),
                scanType: 'dependency',
                status: 'completed',
                vulnerabilities: [],
                summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
                metadata: {
                    scanner: 'test',
                    version: '1.0.0',
                    duration: 1000
                }
            };
            vulnerabilityScanner.scanResults.set(mockReport.id, mockReport);
            const retrievedReport = await vulnerabilityScanner.getReport(mockReport.id);
            (0, globals_1.expect)(retrievedReport).toEqual(mockReport);
            const allReports = await vulnerabilityScanner.getAllReports();
            (0, globals_1.expect)(allReports).toContain(mockReport);
        });
        (0, globals_1.it)('should generate SBOM correctly', async () => {
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
            (0, globals_1.expect)(sbom.bomFormat).toBe('CycloneDX');
            (0, globals_1.expect)(sbom.components).toHaveLength(3);
            (0, globals_1.expect)(sbom.components.some(c => c.name === 'lodash')).toBe(true);
            (0, globals_1.expect)(sbom.components.some(c => c.name === 'express')).toBe(true);
            (0, globals_1.expect)(sbom.components.some(c => c.name === 'jest')).toBe(true);
            // Restore original function
            require('fs/promises').readFile = originalReadFile;
        });
        (0, globals_1.it)('should provide continuous monitoring status', async () => {
            const status = await vulnerabilityScanner.getContinuousMonitoringStatus();
            (0, globals_1.expect)(status).toHaveProperty('isActive');
            (0, globals_1.expect)(status).toHaveProperty('activeScans');
            (0, globals_1.expect)(status).toHaveProperty('queuedScans');
            (0, globals_1.expect)(status).toHaveProperty('scansLast24h');
            (0, globals_1.expect)(status).toHaveProperty('vulnerabilitiesFound');
            (0, globals_1.expect)(status).toHaveProperty('criticalVulnerabilitiesFound');
            (0, globals_1.expect)(typeof status.isActive).toBe('boolean');
            (0, globals_1.expect)(typeof status.activeScans).toBe('number');
        });
    });
    (0, globals_1.describe)('Enhanced KeyManager', () => {
        let keyManager;
        (0, globals_1.beforeEach)(() => {
            keyManager = new keyManager_1.KeyManager();
        });
        (0, globals_1.afterEach)(() => {
            keyManager.cleanup();
        });
        (0, globals_1.it)('should derive keys from passwords', async () => {
            const password = 'test-password-123';
            const derivedKey1 = await keyManager.deriveKeyFromPassword(password);
            const derivedKey2 = await keyManager.deriveKeyFromPassword(password);
            (0, globals_1.expect)(derivedKey1).toEqual(derivedKey2);
            (0, globals_1.expect)(derivedKey1).toHaveLength(32); // 256 bits
        });
        (0, globals_1.it)('should export and import keys', async () => {
            const password = 'export-password-123';
            const keyId = await keyManager.generateNewKey();
            const exportedKey = await keyManager.exportKey(keyId, password);
            (0, globals_1.expect)(typeof exportedKey).toBe('string');
            const importedKeyId = await keyManager.importKey(exportedKey, password);
            (0, globals_1.expect)(importedKeyId).toBe(keyId);
        });
        (0, globals_1.it)('should provide key metrics', () => {
            const metrics = keyManager.getKeyMetrics();
            (0, globals_1.expect)(metrics).toHaveProperty('totalKeys');
            (0, globals_1.expect)(metrics).toHaveProperty('activeKeys');
            (0, globals_1.expect)(metrics).toHaveProperty('rotatingKeys');
            (0, globals_1.expect)(metrics).toHaveProperty('deprecatedKeys');
            (0, globals_1.expect)(metrics).toHaveProperty('oldestKeyAge');
            (0, globals_1.expect)(typeof metrics.totalKeys).toBe('number');
            (0, globals_1.expect)(typeof metrics.activeKeys).toBe('number');
        });
        (0, globals_1.it)('should securely delete keys', async () => {
            const keyId = await keyManager.generateNewKey();
            (0, globals_1.expect)(keyManager.getKeyInfo(keyId)).toBeDefined();
            await keyManager.secureDelete(keyId);
            (0, globals_1.expect)(keyManager.getKeyInfo(keyId)).toBeUndefined();
        });
    });
    (0, globals_1.describe)('Enhanced AuditLogger', () => {
        let auditLogger;
        (0, globals_1.beforeEach)(() => {
            auditLogger = new auditLogger_1.AuditLogger();
        });
        (0, globals_1.it)('should create and verify audit proofs', async () => {
            await auditLogger.logEvent({
                userId: 'user1',
                action: 'test',
                resource: 'test',
                details: {},
                outcome: 'success',
                severity: 'low'
            });
            const events = auditLogger.eventStore;
            const eventId = events[0].id;
            const proof = await auditLogger.createAuditProof(eventId);
            (0, globals_1.expect)(proof).toBeDefined();
            (0, globals_1.expect)(proof.eventId).toBe(eventId);
            (0, globals_1.expect)(proof.merkleRoot).toBeDefined();
            const isValid = await auditLogger.verifyAuditProof(proof);
            (0, globals_1.expect)(isValid).toBe(true);
        });
        (0, globals_1.it)('should export audit logs', async () => {
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
            (0, globals_1.expect)(exportData.events).toHaveLength(2);
            (0, globals_1.expect)(exportData.merkleRoot).toBeDefined();
            (0, globals_1.expect)(exportData.signature).toBeDefined();
            (0, globals_1.expect)(exportData.exportTimestamp).toBeInstanceOf(Date);
        });
        (0, globals_1.it)('should provide audit statistics', async () => {
            await auditLogger.logEvent({
                userId: 'user1',
                action: 'login',
                resource: 'auth',
                details: {},
                outcome: 'success',
                severity: 'low'
            });
            const stats = await auditLogger.getAuditStatistics();
            (0, globals_1.expect)(stats).toHaveProperty('totalEvents');
            (0, globals_1.expect)(stats).toHaveProperty('eventsLast24h');
            (0, globals_1.expect)(stats).toHaveProperty('eventsByAction');
            (0, globals_1.expect)(stats).toHaveProperty('uniqueUsers');
            (0, globals_1.expect)(stats).toHaveProperty('chainIntegrity');
            (0, globals_1.expect)(stats.totalEvents).toBeGreaterThan(0);
            (0, globals_1.expect)(stats.chainIntegrity).toBe(true);
        });
    });
    (0, globals_1.describe)('Enhanced ZeroTrustEngine', () => {
        let zeroTrustEngine;
        (0, globals_1.beforeEach)(() => {
            zeroTrustEngine = new zeroTrustEngine_1.ZeroTrustEngine();
        });
        (0, globals_1.it)('should perform risk assessment', async () => {
            const context = {
                userId: 'user1',
                sessionId: 'session1',
                deviceFingerprint: 'device1',
                ipAddress: '127.0.0.1',
                userAgent: 'Mozilla/5.0',
                timestamp: new Date()
            };
            const riskAssessment = await zeroTrustEngine.performRiskAssessment(context);
            (0, globals_1.expect)(riskAssessment).toHaveProperty('id');
            (0, globals_1.expect)(riskAssessment).toHaveProperty('riskFactors');
            (0, globals_1.expect)(riskAssessment).toHaveProperty('overallRisk');
            (0, globals_1.expect)(riskAssessment).toHaveProperty('recommendations');
            (0, globals_1.expect)(Array.isArray(riskAssessment.riskFactors)).toBe(true);
            (0, globals_1.expect)(['low', 'medium', 'high', 'critical']).toContain(riskAssessment.overallRisk);
        });
        (0, globals_1.it)('should provide continuous assessment status', async () => {
            const status = await zeroTrustEngine.getContinuousAssessmentStatus();
            (0, globals_1.expect)(status).toHaveProperty('activeAssessments');
            (0, globals_1.expect)(status).toHaveProperty('averageTrustScore');
            (0, globals_1.expect)(status).toHaveProperty('riskTrend');
            (0, globals_1.expect)(status).toHaveProperty('policyViolations');
            (0, globals_1.expect)(status).toHaveProperty('adaptivePolicyChanges');
            (0, globals_1.expect)(typeof status.activeAssessments).toBe('number');
            (0, globals_1.expect)(typeof status.averageTrustScore).toBe('number');
            (0, globals_1.expect)(['increasing', 'stable', 'decreasing']).toContain(status.riskTrend);
        });
        (0, globals_1.it)('should update threat intelligence', async () => {
            // Should not throw
            await (0, globals_1.expect)(zeroTrustEngine.updateThreatIntelligence()).resolves.not.toThrow();
        });
    });
    (0, globals_1.describe)('SecurityMiddleware', () => {
        let securityMiddleware;
        (0, globals_1.beforeEach)(() => {
            securityMiddleware = new securityMiddleware_1.SecurityMiddleware(mockRedis, {
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
        (0, globals_1.afterEach)(async () => {
            jest.clearAllMocks();
        });
        (0, globals_1.it)('should validate request size', () => {
            const middleware = securityMiddleware.requestValidation();
            const mockReq = {
                method: 'POST',
                get: jest.fn().mockReturnValue('20971520') // 20MB
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const mockNext = jest.fn();
            middleware(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockRes.status).toHaveBeenCalledWith(413);
            (0, globals_1.expect)(mockNext).not.toHaveBeenCalled();
        });
        (0, globals_1.it)('should validate content type for POST requests', () => {
            const middleware = securityMiddleware.requestValidation();
            const mockReq = {
                method: 'POST',
                get: jest.fn().mockImplementation((header) => {
                    if (header === 'content-length')
                        return '1000';
                    if (header === 'content-type')
                        return 'text/plain';
                    return null;
                })
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const mockNext = jest.fn();
            middleware(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockRes.status).toHaveBeenCalledWith(415);
            (0, globals_1.expect)(mockNext).not.toHaveBeenCalled();
        });
        (0, globals_1.it)('should sanitize input data', () => {
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
            };
            const mockRes = {};
            const mockNext = jest.fn();
            middleware(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockReq.body.name).not.toContain('<script>');
            (0, globals_1.expect)(mockReq.body.description).toBe('Normal text');
            (0, globals_1.expect)(mockReq.body.__proto__).toBeUndefined();
            (0, globals_1.expect)(mockReq.query.search).not.toContain('javascript:');
            (0, globals_1.expect)(mockNext).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=security.test.js.map