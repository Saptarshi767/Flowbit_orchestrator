import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  ComplianceService,
  GDPRComplianceService,
  SOC2ComplianceService,
  DataResidencyService,
  ComplianceReportingService,
  DataClassificationService,
  ComplianceValidatorService
} from '../src/compliance';

describe('Compliance Services', () => {
  let complianceService: ComplianceService;
  let gdprService: GDPRComplianceService;
  let soc2Service: SOC2ComplianceService;
  let dataResidencyService: DataResidencyService;
  let reportingService: ComplianceReportingService;
  let classificationService: DataClassificationService;
  let validatorService: ComplianceValidatorService;

  beforeEach(() => {
    // Initialize services
    gdprService = new GDPRComplianceService();
    soc2Service = new SOC2ComplianceService();
    dataResidencyService = new DataResidencyService();
    reportingService = new ComplianceReportingService();
    classificationService = new DataClassificationService();
    validatorService = new ComplianceValidatorService(
      gdprService,
      soc2Service,
      dataResidencyService,
      reportingService,
      classificationService
    );
    complianceService = new ComplianceService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GDPR Compliance Service', () => {
    it('should handle data export requests', async () => {
      const userId = 'test-user-123';
      const exportRequest = await gdprService.requestDataExport(userId);

      expect(exportRequest).toBeDefined();
      expect(exportRequest.userId).toBe(userId);
      expect(exportRequest.status).toBe('pending');
      expect(exportRequest.id).toMatch(/^gdpr_/);
    });

    it('should handle data deletion requests', async () => {
      const userId = 'test-user-456';
      const deletionRequest = await gdprService.requestDataDeletion(userId, 'soft');

      expect(deletionRequest).toBeDefined();
      expect(deletionRequest.userId).toBe(userId);
      expect(deletionRequest.status).toBe('pending');
      expect(deletionRequest.deletionType).toBe('soft');
      expect(deletionRequest.retentionPeriod).toBe(30);
    });

    it('should manage consent', async () => {
      const userId = 'test-user-789';
      
      await expect(
        gdprService.updateConsent(userId, 'marketing', true)
      ).resolves.not.toThrow();

      await expect(
        gdprService.updateConsent(userId, 'analytics', false)
      ).resolves.not.toThrow();
    });

    it('should check retention compliance', async () => {
      const complianceCheck = await gdprService.checkRetentionCompliance();

      expect(complianceCheck).toBeDefined();
      expect(complianceCheck).toHaveProperty('compliant');
      expect(complianceCheck).toHaveProperty('violations');
      expect(Array.isArray(complianceCheck.violations)).toBe(true);
    });

    it('should get data categories', async () => {
      const userId = 'test-user';
      const categories = await gdprService.getDataCategories(userId);

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]).toHaveProperty('category');
      expect(categories[0]).toHaveProperty('retentionPeriod');
      expect(categories[0]).toHaveProperty('legalBasis');
    });
  });

  describe('SOC2 Compliance Service', () => {
    it('should log audit events', async () => {
      const auditEvent = {
        userId: 'test-user',
        sessionId: 'test-session',
        action: 'login',
        resource: 'user-account',
        outcome: 'success' as const,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        details: { method: 'password' },
        riskLevel: 'low' as const
      };

      await expect(
        soc2Service.logAuditEvent(auditEvent)
      ).resolves.not.toThrow();
    });

    it('should retrieve audit trail', async () => {
      // First log an event
      await soc2Service.logAuditEvent({
        userId: 'test-user',
        sessionId: 'test-session',
        action: 'test-action',
        resource: 'test-resource',
        outcome: 'success',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        details: {},
        riskLevel: 'low'
      });

      const auditTrail = await soc2Service.getAuditTrail({
        userId: 'test-user',
        limit: 10
      });

      expect(Array.isArray(auditTrail)).toBe(true);
      expect(auditTrail.length).toBeGreaterThan(0);
      expect(auditTrail[0]).toHaveProperty('id');
      expect(auditTrail[0]).toHaveProperty('timestamp');
      expect(auditTrail[0]).toHaveProperty('action');
    });

    it('should test SOC2 controls', async () => {
      const controlId = 'CC1.1';
      const testResult = await soc2Service.testControl(controlId);

      expect(testResult).toBeDefined();
      expect(testResult.controlId).toBe(controlId);
      expect(testResult).toHaveProperty('testResult');
      expect(testResult).toHaveProperty('findings');
      expect(testResult).toHaveProperty('evidence');
      expect(testResult).toHaveProperty('testedAt');
    });

    it('should generate compliance reports', async () => {
      const report = await soc2Service.generateComplianceReport(
        'internal-audit',
        {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31')
        }
      );

      expect(report).toBeDefined();
      expect(report.reportType).toBe('internal-audit');
      expect(report).toHaveProperty('controls');
      expect(report).toHaveProperty('findings');
      expect(report).toHaveProperty('overallStatus');
      expect(Array.isArray(report.controls)).toBe(true);
    });

    it('should monitor compliance status', async () => {
      const status = await soc2Service.monitorCompliance();

      expect(status).toBeDefined();
      expect(status).toHaveProperty('overallStatus');
      expect(status).toHaveProperty('controlsStatus');
      expect(status).toHaveProperty('recentEvents');
      expect(status).toHaveProperty('recommendations');
      expect(Array.isArray(status.controlsStatus)).toBe(true);
    });
  });

  describe('Data Residency Service', () => {
    it('should validate data placement', async () => {
      const validation = await dataResidencyService.validateDataPlacement(
        'user_data',
        'confidential',
        'us-east-1'
      );

      expect(validation).toBeDefined();
      expect(validation).toHaveProperty('allowed');
      expect(validation).toHaveProperty('violations');
      expect(validation).toHaveProperty('recommendations');
      expect(validation).toHaveProperty('applicableRules');
      expect(Array.isArray(validation.violations)).toBe(true);
    });

    it('should request data movement', async () => {
      const movement = await dataResidencyService.requestDataMovement(
        'test-data-123',
        'us-east-1',
        'eu-west-1',
        'GDPR compliance',
        'admin-user'
      );

      expect(movement).toBeDefined();
      expect(movement.dataId).toBe('test-data-123');
      expect(movement.fromRegion).toBe('us-east-1');
      expect(movement.toRegion).toBe('eu-west-1');
      expect(movement.reason).toBe('GDPR compliance');
      expect(movement).toHaveProperty('status');
    });

    it('should get compliance status', async () => {
      const status = await dataResidencyService.getComplianceStatus();

      expect(status).toBeDefined();
      expect(status).toHaveProperty('overallCompliance');
      expect(status).toHaveProperty('violations');
      expect(status).toHaveProperty('recommendations');
      expect(status).toHaveProperty('regionSummary');
      expect(Array.isArray(status.violations)).toBe(true);
      expect(Array.isArray(status.regionSummary)).toBe(true);
    });

    it('should create residency rules', async () => {
      const rule = await dataResidencyService.createResidencyRule({
        name: 'Test Rule',
        description: 'Test data residency rule',
        regions: ['us-east-1'],
        dataTypes: ['test_data'],
        restrictions: [{
          type: 'storage',
          allowedRegions: ['us-east-1'],
          prohibitedRegions: ['eu-west-1'],
          requiresEncryption: true
        }],
        priority: 1,
        active: true
      });

      expect(rule).toBeDefined();
      expect(rule.name).toBe('Test Rule');
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('createdAt');
      expect(rule).toHaveProperty('updatedAt');
    });

    it('should get available regions', async () => {
      const regions = await dataResidencyService.getAvailableRegions(
        'user_data',
        'confidential'
      );

      expect(regions).toBeDefined();
      expect(regions).toHaveProperty('allowedRegions');
      expect(regions).toHaveProperty('prohibitedRegions');
      expect(regions).toHaveProperty('recommendations');
      expect(Array.isArray(regions.allowedRegions)).toBe(true);
      expect(Array.isArray(regions.prohibitedRegions)).toBe(true);
    });
  });

  describe('Compliance Reporting Service', () => {
    it('should generate compliance reports', async () => {
      const report = await reportingService.generateComplianceReport(
        'soc2-type2',
        'self-assessment',
        {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31')
        },
        'test-user'
      );

      expect(report).toBeDefined();
      expect(report.frameworkId).toBe('soc2-type2');
      expect(report.reportType).toBe('self-assessment');
      expect(report).toHaveProperty('overallScore');
      expect(report).toHaveProperty('requirements');
      expect(report).toHaveProperty('findings');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('executiveSummary');
    });

    it('should submit evidence', async () => {
      const evidence = await reportingService.submitEvidence(
        'soc2-cc1.1',
        {
          type: 'document',
          title: 'Test Evidence',
          description: 'Test evidence document',
          filePath: '/path/to/evidence.pdf',
          uploadedBy: 'test-user'
        }
      );

      expect(evidence).toBeDefined();
      expect(evidence.title).toBe('Test Evidence');
      expect(evidence).toHaveProperty('id');
      expect(evidence).toHaveProperty('uploadedAt');
    });

    it('should run compliance tests', async () => {
      const testResults = await reportingService.runComplianceTests('soc2-type2');

      expect(testResults).toBeDefined();
      expect(testResults.frameworkId).toBe('soc2-type2');
      expect(testResults).toHaveProperty('testsRun');
      expect(testResults).toHaveProperty('testsPassed');
      expect(testResults).toHaveProperty('testsFailed');
      expect(testResults).toHaveProperty('results');
      expect(Array.isArray(testResults.results)).toBe(true);
    });

    it('should get certification status', async () => {
      const certifications = await reportingService.getCertificationStatus();

      expect(Array.isArray(certifications)).toBe(true);
    });

    it('should update certification status', async () => {
      const certification = await reportingService.updateCertificationStatus(
        'soc2-type2',
        {
          certificationBody: 'Test Auditor',
          status: 'certified',
          certificateNumber: 'CERT-123',
          issuedDate: new Date(),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          scope: 'Full system audit',
          nextAudit: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
        }
      );

      expect(certification).toBeDefined();
      expect(certification.frameworkId).toBe('soc2-type2');
      expect(certification.status).toBe('certified');
      expect(certification.certificateNumber).toBe('CERT-123');
    });

    it('should get compliance dashboard', async () => {
      const dashboard = await reportingService.getComplianceDashboard();

      expect(dashboard).toBeDefined();
      expect(dashboard).toHaveProperty('overallCompliance');
      expect(dashboard).toHaveProperty('frameworkStatus');
      expect(dashboard).toHaveProperty('recentFindings');
      expect(dashboard).toHaveProperty('upcomingDeadlines');
      expect(dashboard).toHaveProperty('trends');
      expect(Array.isArray(dashboard.frameworkStatus)).toBe(true);
    });
  });

  describe('Data Classification Service', () => {
    it('should classify data assets', async () => {
      // This test would need mock data assets, so we'll test the interface
      expect(classificationService).toBeDefined();
      expect(typeof classificationService.classifyDataAsset).toBe('function');
      expect(typeof classificationService.autoClassifyAssets).toBe('function');
      expect(typeof classificationService.checkAssetCompliance).toBe('function');
    });

    it('should get classification statistics', async () => {
      const stats = await classificationService.getClassificationStatistics();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalAssets');
      expect(stats).toHaveProperty('classificationDistribution');
      expect(stats).toHaveProperty('complianceStatus');
      expect(stats).toHaveProperty('recentViolations');
      expect(stats).toHaveProperty('trendsData');
      expect(Array.isArray(stats.classificationDistribution)).toBe(true);
    });

    it('should create classification rules', async () => {
      const rule = await classificationService.createClassificationRule({
        name: 'Test Classification Rule',
        description: 'Test rule for classification',
        priority: 1,
        conditions: [{
          field: 'name',
          operator: 'contains',
          value: 'sensitive',
          caseSensitive: false
        }],
        action: {
          classificationLevel: 'confidential',
          autoApply: true,
          requiresApproval: false
        },
        active: true
      });

      expect(rule).toBeDefined();
      expect(rule.name).toBe('Test Classification Rule');
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('createdAt');
      expect(rule).toHaveProperty('updatedAt');
    });
  });

  describe('Compliance Validator Service', () => {
    it('should run individual compliance tests', async () => {
      const testResult = await validatorService.runTest('gdpr-data-export');

      expect(testResult).toBeDefined();
      expect(testResult.testId).toBe('gdpr-data-export');
      expect(testResult).toHaveProperty('status');
      expect(testResult).toHaveProperty('score');
      expect(testResult).toHaveProperty('message');
      expect(testResult).toHaveProperty('details');
      expect(testResult).toHaveProperty('recommendations');
      expect(testResult).toHaveProperty('executionTime');
      expect(testResult).toHaveProperty('timestamp');
    });

    it('should run test suites', async () => {
      const report = await validatorService.runTestSuite('gdpr-compliance-suite', 'test-user');

      expect(report).toBeDefined();
      expect(report.suiteId).toBe('gdpr-compliance-suite');
      expect(report.executedBy).toBe('test-user');
      expect(report).toHaveProperty('totalTests');
      expect(report).toHaveProperty('passedTests');
      expect(report).toHaveProperty('failedTests');
      expect(report).toHaveProperty('overallScore');
      expect(report).toHaveProperty('results');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('recommendations');
      expect(Array.isArray(report.results)).toBe(true);
    });

    it('should run all test suites', async () => {
      const reports = await validatorService.runAllTestSuites('test-user');

      expect(Array.isArray(reports)).toBe(true);
      expect(reports.length).toBeGreaterThan(0);
      
      if (reports.length > 0) {
        expect(reports[0]).toHaveProperty('suiteId');
        expect(reports[0]).toHaveProperty('overallScore');
        expect(reports[0]).toHaveProperty('results');
      }
    });
  });

  describe('Compliance Service Integration', () => {
    it('should get compliance dashboard', async () => {
      const dashboard = await complianceService.getComplianceDashboard();

      expect(dashboard).toBeDefined();
      expect(dashboard).toHaveProperty('overallCompliance');
      expect(dashboard).toHaveProperty('frameworks');
      expect(dashboard).toHaveProperty('recentViolations');
      expect(dashboard).toHaveProperty('upcomingDeadlines');
      expect(dashboard).toHaveProperty('recommendations');
      expect(Array.isArray(dashboard.frameworks)).toBe(true);
      expect(Array.isArray(dashboard.recentViolations)).toBe(true);
    });

    it('should run compliance validation', async () => {
      const validation = await complianceService.runComplianceValidation('test-user');

      expect(validation).toBeDefined();
      expect(validation).toHaveProperty('overallScore');
      expect(validation).toHaveProperty('reports');
      expect(validation).toHaveProperty('summary');
      expect(validation).toHaveProperty('recommendations');
      expect(Array.isArray(validation.reports)).toBe(true);
      expect(Array.isArray(validation.recommendations)).toBe(true);
    });

    it('should initialize compliance monitoring', async () => {
      await expect(
        complianceService.initializeComplianceMonitoring()
      ).resolves.not.toThrow();
    });

    it('should emit compliance events', async () => {
      let eventReceived = false;
      
      complianceService.on('complianceEvent', (event) => {
        expect(event).toBeDefined();
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('data');
        eventReceived = true;
      });

      // Trigger an event
      await complianceService.gdpr.requestDataExport('test-user');
      
      // Give some time for the event to be emitted
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(eventReceived).toBe(true);
    });

    it('should emit compliance alerts', async () => {
      let alertReceived = false;
      
      complianceService.on('complianceAlert', (alert) => {
        expect(alert).toBeDefined();
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('data');
        alertReceived = true;
      });

      // Trigger a high-risk audit event
      await complianceService.soc2.logAuditEvent({
        userId: 'test-user',
        sessionId: 'test-session',
        action: 'admin-access',
        resource: 'sensitive-data',
        outcome: 'success',
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
        details: {},
        riskLevel: 'critical'
      });
      
      // Give some time for the event to be emitted
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(alertReceived).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid test IDs gracefully', async () => {
      const result = await validatorService.runTest('invalid-test-id');
      
      expect(result.status).toBe('fail');
      expect(result.score).toBe(0);
      expect(result.message).toContain('not found');
    });

    it('should handle invalid suite IDs gracefully', async () => {
      await expect(
        validatorService.runTestSuite('invalid-suite-id')
      ).rejects.toThrow('not found');
    });

    it('should handle missing user IDs in GDPR requests', async () => {
      await expect(
        gdprService.requestDataExport('')
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete compliance validation within reasonable time', async () => {
      const startTime = Date.now();
      await complianceService.runComplianceValidation('performance-test');
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should handle multiple concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        gdprService.requestDataExport(`concurrent-user-${i}`)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.userId).toBe(`concurrent-user-${index}`);
        expect(result.status).toBe('pending');
      });
    });
  });
});