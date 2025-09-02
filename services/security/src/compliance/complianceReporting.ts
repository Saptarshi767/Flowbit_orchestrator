import { EventEmitter } from 'events';
import { Logger } from '../../../shared/src/utils/logger';

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  requirements: ComplianceRequirement[];
  certificationBody?: string;
  validityPeriod: number; // months
  renewalRequired: boolean;
}

export interface ComplianceRequirement {
  id: string;
  frameworkId: string;
  category: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  implementationStatus: 'not-started' | 'in-progress' | 'implemented' | 'verified';
  evidence: Evidence[];
  testResults: TestResult[];
  lastAssessed?: Date;
  nextAssessment?: Date;
}

export interface Evidence {
  id: string;
  type: 'document' | 'screenshot' | 'log' | 'certificate' | 'test-result';
  title: string;
  description: string;
  filePath: string;
  uploadedBy: string;
  uploadedAt: Date;
  expiresAt?: Date;
}

export interface TestResult {
  id: string;
  requirementId: string;
  testName: string;
  result: 'pass' | 'fail' | 'not-applicable' | 'manual-review';
  score?: number;
  details: string;
  testedBy: string;
  testedAt: Date;
  evidence: string[];
}

export interface ComplianceReport {
  id: string;
  frameworkId: string;
  reportType: 'self-assessment' | 'internal-audit' | 'external-audit' | 'certification';
  period: {
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;
  generatedBy: string;
  status: 'draft' | 'review' | 'approved' | 'submitted';
  overallScore: number;
  requirements: ComplianceRequirement[];
  findings: ComplianceFinding[];
  recommendations: string[];
  executiveSummary: string;
  attachments: string[];
}

export interface ComplianceFinding {
  id: string;
  requirementId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'gap' | 'weakness' | 'non-compliance' | 'improvement';
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  remediation: RemediationPlan;
  status: 'open' | 'in-progress' | 'resolved' | 'accepted-risk';
}

export interface RemediationPlan {
  id: string;
  findingId: string;
  title: string;
  description: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedEffort: number; // hours
  targetDate: Date;
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
  progress: number; // percentage
  updates: RemediationUpdate[];
}

export interface RemediationUpdate {
  id: string;
  planId: string;
  update: string;
  updatedBy: string;
  updatedAt: Date;
  newProgress: number;
}

export interface CertificationStatus {
  frameworkId: string;
  certificationBody: string;
  status: 'not-certified' | 'in-progress' | 'certified' | 'expired' | 'suspended';
  certificateNumber?: string;
  issuedDate?: Date;
  expiryDate?: Date;
  scope: string;
  conditions?: string[];
  nextAudit?: Date;
}

export class ComplianceReportingService extends EventEmitter {
  private logger: Logger;
  private frameworks: Map<string, ComplianceFramework>;
  private reports: Map<string, ComplianceReport>;
  private certifications: Map<string, CertificationStatus>;

  constructor() {
    super();
    this.logger = new Logger('ComplianceReportingService');
    this.frameworks = new Map();
    this.reports = new Map();
    this.certifications = new Map();
    this.initializeFrameworks();
  }

  private initializeFrameworks(): void {
    const frameworks: ComplianceFramework[] = [
      {
        id: 'soc2-type2',
        name: 'SOC 2 Type II',
        version: '2017',
        description: 'Service Organization Control 2 Type II audit framework',
        requirements: this.createSOC2Requirements(),
        certificationBody: 'AICPA',
        validityPeriod: 12,
        renewalRequired: true
      },
      {
        id: 'iso27001',
        name: 'ISO 27001',
        version: '2013',
        description: 'Information Security Management System standard',
        requirements: this.createISO27001Requirements(),
        certificationBody: 'ISO',
        validityPeriod: 36,
        renewalRequired: true
      },
      {
        id: 'gdpr',
        name: 'GDPR Compliance',
        version: '2018',
        description: 'General Data Protection Regulation compliance framework',
        requirements: this.createGDPRRequirements(),
        validityPeriod: 12,
        renewalRequired: false
      },
      {
        id: 'hipaa',
        name: 'HIPAA',
        version: '2013',
        description: 'Health Insurance Portability and Accountability Act',
        requirements: this.createHIPAARequirements(),
        validityPeriod: 12,
        renewalRequired: false
      }
    ];

    frameworks.forEach(framework => {
      this.frameworks.set(framework.id, framework);
    });
  }

  /**
   * Generate compliance report for a specific framework
   */
  async generateComplianceReport(
    frameworkId: string,
    reportType: 'self-assessment' | 'internal-audit' | 'external-audit' | 'certification',
    period: { startDate: Date; endDate: Date },
    generatedBy: string
  ): Promise<ComplianceReport> {
    try {
      const framework = this.frameworks.get(frameworkId);
      if (!framework) {
        throw new Error(`Framework ${frameworkId} not found`);
      }

      this.logger.info(`Generating ${reportType} report for ${framework.name}`, period);

      // Assess all requirements
      const assessedRequirements = await this.assessRequirements(framework.requirements);
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore(assessedRequirements);
      
      // Generate findings
      const findings = await this.generateFindings(assessedRequirements);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(findings);
      
      // Create executive summary
      const executiveSummary = this.generateExecutiveSummary(
        framework,
        overallScore,
        findings,
        recommendations
      );

      const report: ComplianceReport = {
        id: this.generateReportId(),
        frameworkId,
        reportType,
        period,
        generatedAt: new Date(),
        generatedBy,
        status: 'draft',
        overallScore,
        requirements: assessedRequirements,
        findings,
        recommendations,
        executiveSummary,
        attachments: []
      };

      this.reports.set(report.id, report);
      this.emit('complianceReportGenerated', report);

      return report;
    } catch (error) {
      this.logger.error('Failed to generate compliance report', { frameworkId, reportType, error });
      throw error;
    }
  }

  /**
   * Submit evidence for a compliance requirement
   */
  async submitEvidence(
    requirementId: string,
    evidence: Omit<Evidence, 'id' | 'uploadedAt'>
  ): Promise<Evidence> {
    try {
      const newEvidence: Evidence = {
        id: this.generateEvidenceId(),
        uploadedAt: new Date(),
        ...evidence
      };

      // Find and update the requirement
      for (const framework of this.frameworks.values()) {
        const requirement = framework.requirements.find(r => r.id === requirementId);
        if (requirement) {
          requirement.evidence.push(newEvidence);
          this.emit('evidenceSubmitted', { requirementId, evidence: newEvidence });
          break;
        }
      }

      this.logger.info('Evidence submitted', { requirementId, evidenceId: newEvidence.id });
      return newEvidence;
    } catch (error) {
      this.logger.error('Failed to submit evidence', { requirementId, error });
      throw error;
    }
  }

  /**
   * Run automated compliance tests
   */
  async runComplianceTests(frameworkId: string): Promise<{
    frameworkId: string;
    testsRun: number;
    testsPassed: number;
    testsFailed: number;
    results: TestResult[];
  }> {
    try {
      const framework = this.frameworks.get(frameworkId);
      if (!framework) {
        throw new Error(`Framework ${frameworkId} not found`);
      }

      this.logger.info(`Running compliance tests for ${framework.name}`);

      const results: TestResult[] = [];
      let testsPassed = 0;
      let testsFailed = 0;

      for (const requirement of framework.requirements) {
        const testResult = await this.runRequirementTest(requirement);
        results.push(testResult);
        
        if (testResult.result === 'pass') {
          testsPassed++;
        } else if (testResult.result === 'fail') {
          testsFailed++;
        }

        // Update requirement with test result
        requirement.testResults.push(testResult);
        requirement.lastAssessed = new Date();
      }

      const summary = {
        frameworkId,
        testsRun: results.length,
        testsPassed,
        testsFailed,
        results
      };

      this.emit('complianceTestsCompleted', summary);
      return summary;
    } catch (error) {
      this.logger.error('Failed to run compliance tests', { frameworkId, error });
      throw error;
    }
  }

  /**
   * Get certification status for all frameworks
   */
  async getCertificationStatus(): Promise<CertificationStatus[]> {
    try {
      return Array.from(this.certifications.values());
    } catch (error) {
      this.logger.error('Failed to get certification status', { error });
      throw error;
    }
  }

  /**
   * Update certification status
   */
  async updateCertificationStatus(
    frameworkId: string,
    status: Omit<CertificationStatus, 'frameworkId'>
  ): Promise<CertificationStatus> {
    try {
      const certification: CertificationStatus = {
        frameworkId,
        ...status
      };

      this.certifications.set(frameworkId, certification);
      this.emit('certificationStatusUpdated', certification);

      this.logger.info('Certification status updated', { frameworkId, status: certification.status });
      return certification;
    } catch (error) {
      this.logger.error('Failed to update certification status', { frameworkId, error });
      throw error;
    }
  }

  /**
   * Create remediation plan for findings
   */
  async createRemediationPlan(
    findingId: string,
    plan: Omit<RemediationPlan, 'id' | 'findingId' | 'status' | 'progress' | 'updates'>
  ): Promise<RemediationPlan> {
    try {
      const remediationPlan: RemediationPlan = {
        id: this.generatePlanId(),
        findingId,
        status: 'planned',
        progress: 0,
        updates: [],
        ...plan
      };

      // Find and update the finding
      for (const report of this.reports.values()) {
        const finding = report.findings.find(f => f.id === findingId);
        if (finding) {
          finding.remediation = remediationPlan;
          finding.status = 'in-progress';
          break;
        }
      }

      this.emit('remediationPlanCreated', remediationPlan);
      this.logger.info('Remediation plan created', { findingId, planId: remediationPlan.id });

      return remediationPlan;
    } catch (error) {
      this.logger.error('Failed to create remediation plan', { findingId, error });
      throw error;
    }
  }

  /**
   * Get compliance dashboard data
   */
  async getComplianceDashboard(): Promise<{
    overallCompliance: number;
    frameworkStatus: Array<{
      frameworkId: string;
      name: string;
      compliance: number;
      status: string;
      lastAssessed?: Date;
    }>;
    recentFindings: ComplianceFinding[];
    upcomingDeadlines: Array<{
      type: 'certification' | 'assessment' | 'remediation';
      description: string;
      dueDate: Date;
      priority: string;
    }>;
    trends: Array<{
      period: string;
      compliance: number;
    }>;
  }> {
    try {
      const frameworkStatus = Array.from(this.frameworks.values()).map(framework => {
        const implementedRequirements = framework.requirements.filter(
          r => r.implementationStatus === 'implemented' || r.implementationStatus === 'verified'
        ).length;
        
        const compliance = framework.requirements.length > 0 
          ? (implementedRequirements / framework.requirements.length) * 100 
          : 0;

        const lastAssessed = framework.requirements
          .map(r => r.lastAssessed)
          .filter(date => date)
          .sort((a, b) => b!.getTime() - a!.getTime())[0];

        return {
          frameworkId: framework.id,
          name: framework.name,
          compliance,
          status: compliance >= 90 ? 'compliant' : compliance >= 70 ? 'partially-compliant' : 'non-compliant',
          lastAssessed
        };
      });

      const overallCompliance = frameworkStatus.length > 0
        ? frameworkStatus.reduce((sum, f) => sum + f.compliance, 0) / frameworkStatus.length
        : 0;

      // Get recent findings from all reports
      const recentFindings = Array.from(this.reports.values())
        .flatMap(report => report.findings)
        .filter(finding => finding.status === 'open' || finding.status === 'in-progress')
        .sort((a, b) => b.severity.localeCompare(a.severity))
        .slice(0, 10);

      // Get upcoming deadlines
      const upcomingDeadlines = this.getUpcomingDeadlines();

      // Generate compliance trends (mock data for now)
      const trends = this.generateComplianceTrends();

      return {
        overallCompliance,
        frameworkStatus,
        recentFindings,
        upcomingDeadlines,
        trends
      };
    } catch (error) {
      this.logger.error('Failed to get compliance dashboard', { error });
      throw error;
    }
  }

  private createSOC2Requirements(): ComplianceRequirement[] {
    return [
      {
        id: 'soc2-cc1.1',
        frameworkId: 'soc2-type2',
        category: 'Control Environment',
        title: 'Integrity and Ethical Values',
        description: 'The entity demonstrates a commitment to integrity and ethical values',
        priority: 'high',
        implementationStatus: 'implemented',
        evidence: [],
        testResults: []
      },
      {
        id: 'soc2-cc6.1',
        frameworkId: 'soc2-type2',
        category: 'Logical Access',
        title: 'Logical Access Security',
        description: 'The entity implements logical access security software',
        priority: 'critical',
        implementationStatus: 'implemented',
        evidence: [],
        testResults: []
      }
      // Add more SOC2 requirements as needed
    ];
  }

  private createISO27001Requirements(): ComplianceRequirement[] {
    return [
      {
        id: 'iso27001-a5.1',
        frameworkId: 'iso27001',
        category: 'Information Security Policies',
        title: 'Management Direction for Information Security',
        description: 'Management shall provide direction and support for information security',
        priority: 'high',
        implementationStatus: 'implemented',
        evidence: [],
        testResults: []
      }
      // Add more ISO27001 requirements as needed
    ];
  }

  private createGDPRRequirements(): ComplianceRequirement[] {
    return [
      {
        id: 'gdpr-art6',
        frameworkId: 'gdpr',
        category: 'Lawfulness of Processing',
        title: 'Lawful Basis for Processing',
        description: 'Processing shall be lawful only if and to the extent that at least one applies',
        priority: 'critical',
        implementationStatus: 'implemented',
        evidence: [],
        testResults: []
      }
      // Add more GDPR requirements as needed
    ];
  }

  private createHIPAARequirements(): ComplianceRequirement[] {
    return [
      {
        id: 'hipaa-164.308',
        frameworkId: 'hipaa',
        category: 'Administrative Safeguards',
        title: 'Administrative Safeguards',
        description: 'Implement administrative safeguards to protect PHI',
        priority: 'critical',
        implementationStatus: 'in-progress',
        evidence: [],
        testResults: []
      }
      // Add more HIPAA requirements as needed
    ];
  }

  private async assessRequirements(requirements: ComplianceRequirement[]): Promise<ComplianceRequirement[]> {
    // Simulate requirement assessment
    return requirements.map(req => ({
      ...req,
      lastAssessed: new Date()
    }));
  }

  private calculateOverallScore(requirements: ComplianceRequirement[]): number {
    const implementedCount = requirements.filter(
      r => r.implementationStatus === 'implemented' || r.implementationStatus === 'verified'
    ).length;
    
    return requirements.length > 0 ? (implementedCount / requirements.length) * 100 : 0;
  }

  private async generateFindings(requirements: ComplianceRequirement[]): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    requirements.forEach(req => {
      if (req.implementationStatus === 'not-started' || req.implementationStatus === 'in-progress') {
        findings.push({
          id: this.generateFindingId(),
          requirementId: req.id,
          severity: req.priority === 'critical' ? 'critical' : req.priority === 'high' ? 'high' : 'medium',
          category: 'gap',
          title: `Incomplete implementation of ${req.title}`,
          description: `Requirement ${req.id} is not fully implemented`,
          impact: 'May result in compliance violation',
          recommendation: 'Complete implementation and provide evidence',
          remediation: {} as RemediationPlan,
          status: 'open'
        });
      }
    });

    return findings;
  }

  private generateRecommendations(findings: ComplianceFinding[]): string[] {
    const recommendations: string[] = [];
    
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    if (criticalFindings.length > 0) {
      recommendations.push(`Address ${criticalFindings.length} critical compliance gaps immediately`);
    }

    const highFindings = findings.filter(f => f.severity === 'high');
    if (highFindings.length > 0) {
      recommendations.push(`Prioritize resolution of ${highFindings.length} high-severity findings`);
    }

    return recommendations;
  }

  private generateExecutiveSummary(
    framework: ComplianceFramework,
    overallScore: number,
    findings: ComplianceFinding[],
    recommendations: string[]
  ): string {
    return `
Executive Summary - ${framework.name} Compliance Assessment

Overall Compliance Score: ${overallScore.toFixed(1)}%

This assessment evaluated ${framework.requirements.length} requirements across the ${framework.name} framework.
${findings.length} findings were identified, including ${findings.filter(f => f.severity === 'critical').length} critical issues.

Key Recommendations:
${recommendations.map(r => `• ${r}`).join('\n')}

The organization demonstrates ${overallScore >= 90 ? 'strong' : overallScore >= 70 ? 'adequate' : 'insufficient'} compliance with ${framework.name} requirements.
    `.trim();
  }

  private async runRequirementTest(requirement: ComplianceRequirement): Promise<TestResult> {
    // Simulate automated testing
    const result = Math.random() > 0.2 ? 'pass' : 'fail'; // 80% pass rate

    return {
      id: this.generateTestId(),
      requirementId: requirement.id,
      testName: `Automated test for ${requirement.title}`,
      result: result as 'pass' | 'fail',
      score: result === 'pass' ? 100 : 0,
      details: result === 'pass' ? 'All checks passed' : 'Some checks failed',
      testedBy: 'system',
      testedAt: new Date(),
      evidence: []
    };
  }

  private getUpcomingDeadlines(): Array<{
    type: 'certification' | 'assessment' | 'remediation';
    description: string;
    dueDate: Date;
    priority: string;
  }> {
    const deadlines: Array<{
      type: 'certification' | 'assessment' | 'remediation';
      description: string;
      dueDate: Date;
      priority: string;
    }> = [];

    // Check certification renewals
    for (const cert of this.certifications.values()) {
      if (cert.expiryDate && cert.expiryDate > new Date()) {
        const daysUntilExpiry = Math.ceil((cert.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 90) {
          deadlines.push({
            type: 'certification',
            description: `${cert.frameworkId} certification renewal`,
            dueDate: cert.expiryDate,
            priority: daysUntilExpiry <= 30 ? 'high' : 'medium'
          });
        }
      }
    }

    return deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  private generateComplianceTrends(): Array<{ period: string; compliance: number }> {
    // Generate mock trend data for the last 6 months
    const trends: Array<{ period: string; compliance: number }> = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = date.toISOString().substring(0, 7); // YYYY-MM format
      const compliance = 75 + Math.random() * 20; // Random between 75-95%
      
      trends.push({ period, compliance });
    }

    return trends;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEvidenceId(): string {
    return `evidence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFindingId(): string {
    return `finding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}