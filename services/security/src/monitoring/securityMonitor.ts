import { EventEmitter } from 'events';
import { auditLogger } from '../audit/auditLogger';
import { vulnerabilityScanner } from '../scanning/vulnerabilityScanner';
import { zeroTrustEngine } from '../zeroTrust/zeroTrustEngine';

export interface SecurityMetrics {
  timestamp: Date;
  authentication: {
    successfulLogins: number;
    failedLogins: number;
    activeUsers: number;
    suspiciousActivities: number;
  };
  authorization: {
    accessGranted: number;
    accessDenied: number;
    privilegeEscalationAttempts: number;
  };
  network: {
    totalRequests: number;
    blockedRequests: number;
    rateLimitedRequests: number;
    ddosAttempts: number;
  };
  vulnerabilities: {
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    highVulnerabilities: number;
    mediumVulnerabilities: number;
    lowVulnerabilities: number;
  };
  zeroTrust: {
    averageTrustScore: number;
    lowTrustSessions: number;
    adaptivePolicyChanges: number;
    riskAssessments: number;
  };
  audit: {
    totalEvents: number;
    criticalEvents: number;
    chainIntegrityStatus: boolean;
    tamperingAttempts: number;
  };
}

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'authorization' | 'network' | 'vulnerability' | 'audit' | 'zero-trust';
  title: string;
  description: string;
  source: string;
  metadata: Record<string, any>;
  acknowledged: boolean;
  resolvedAt?: Date;
}

export interface SecurityDashboard {
  overview: {
    securityScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    activeThreats: number;
    resolvedThreats: number;
  };
  metrics: SecurityMetrics;
  alerts: SecurityAlert[];
  trends: {
    securityScoreTrend: Array<{ timestamp: Date; score: number }>;
    threatTrend: Array<{ timestamp: Date; threats: number }>;
    vulnerabilityTrend: Array<{ timestamp: Date; vulnerabilities: number }>;
  };
  compliance: {
    gdprCompliance: number;
    soc2Compliance: number;
    overallCompliance: number;
  };
}

export class SecurityMonitor extends EventEmitter {
  private metrics: SecurityMetrics[] = [];
  private alerts: SecurityAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor() {
    super();
    this.initializeMonitoring();
  }

  private initializeMonitoring(): void {
    // Listen to audit events
    auditLogger.on('auditEvent', (event) => {
      this.processAuditEvent(event);
    });

    // Start periodic monitoring
    this.startMonitoring();
  }

  startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      await this.assessThreats();
      this.emit('metricsUpdated', this.getLatestMetrics());
    }, intervalMs);

    console.log('Security monitoring started');
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Security monitoring stopped');
  }

  private async collectMetrics(): Promise<void> {
    const timestamp = new Date();
    
    // Collect authentication metrics
    const authMetrics = await this.collectAuthenticationMetrics();
    
    // Collect authorization metrics
    const authzMetrics = await this.collectAuthorizationMetrics();
    
    // Collect network metrics
    const networkMetrics = await this.collectNetworkMetrics();
    
    // Collect vulnerability metrics
    const vulnMetrics = await this.collectVulnerabilityMetrics();
    
    // Collect zero-trust metrics
    const ztMetrics = await this.collectZeroTrustMetrics();
    
    // Collect audit metrics
    const auditMetrics = await this.collectAuditMetrics();

    const metrics: SecurityMetrics = {
      timestamp,
      authentication: authMetrics,
      authorization: authzMetrics,
      network: networkMetrics,
      vulnerabilities: vulnMetrics,
      zeroTrust: ztMetrics,
      audit: auditMetrics
    };

    this.metrics.push(metrics);
    
    // Keep only last 24 hours of metrics
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > oneDayAgo);
  }

  private async collectAuthenticationMetrics(): Promise<SecurityMetrics['authentication']> {
    // Mock implementation - would integrate with actual auth service
    return {
      successfulLogins: Math.floor(Math.random() * 100),
      failedLogins: Math.floor(Math.random() * 10),
      activeUsers: Math.floor(Math.random() * 50),
      suspiciousActivities: Math.floor(Math.random() * 5)
    };
  }

  private async collectAuthorizationMetrics(): Promise<SecurityMetrics['authorization']> {
    // Mock implementation - would integrate with actual authz service
    return {
      accessGranted: Math.floor(Math.random() * 200),
      accessDenied: Math.floor(Math.random() * 20),
      privilegeEscalationAttempts: Math.floor(Math.random() * 3)
    };
  }

  private async collectNetworkMetrics(): Promise<SecurityMetrics['network']> {
    // Mock implementation - would integrate with actual network monitoring
    return {
      totalRequests: Math.floor(Math.random() * 1000),
      blockedRequests: Math.floor(Math.random() * 50),
      rateLimitedRequests: Math.floor(Math.random() * 30),
      ddosAttempts: Math.floor(Math.random() * 5)
    };
  }

  private async collectVulnerabilityMetrics(): Promise<SecurityMetrics['vulnerabilities']> {
    const reports = await vulnerabilityScanner.getAllReports();
    const latestReport = reports[reports.length - 1];
    
    if (!latestReport) {
      return {
        totalVulnerabilities: 0,
        criticalVulnerabilities: 0,
        highVulnerabilities: 0,
        mediumVulnerabilities: 0,
        lowVulnerabilities: 0
      };
    }

    return {
      totalVulnerabilities: latestReport.summary.total,
      criticalVulnerabilities: latestReport.summary.critical,
      highVulnerabilities: latestReport.summary.high,
      mediumVulnerabilities: latestReport.summary.medium,
      lowVulnerabilities: latestReport.summary.low
    };
  }

  private async collectZeroTrustMetrics(): Promise<SecurityMetrics['zeroTrust']> {
    const status = await zeroTrustEngine.getContinuousAssessmentStatus();
    
    return {
      averageTrustScore: status.averageTrustScore,
      lowTrustSessions: Math.floor(Math.random() * 10),
      adaptivePolicyChanges: status.adaptivePolicyChanges,
      riskAssessments: status.activeAssessments
    };
  }

  private async collectAuditMetrics(): Promise<SecurityMetrics['audit']> {
    const stats = await auditLogger.getAuditStatistics();
    
    return {
      totalEvents: stats.totalEvents,
      criticalEvents: stats.eventsBySeverity.critical || 0,
      chainIntegrityStatus: stats.chainIntegrity,
      tamperingAttempts: 0 // Would be calculated from integrity violations
    };
  }

  private async assessThreats(): Promise<void> {
    const latestMetrics = this.getLatestMetrics();
    if (!latestMetrics) return;

    // Check for authentication threats
    if (latestMetrics.authentication.failedLogins > 20) {
      this.createAlert({
        severity: 'high',
        category: 'authentication',
        title: 'High Number of Failed Login Attempts',
        description: `${latestMetrics.authentication.failedLogins} failed login attempts detected`,
        source: 'authentication-monitor',
        metadata: { failedLogins: latestMetrics.authentication.failedLogins }
      });
    }

    // Check for network threats
    if (latestMetrics.network.ddosAttempts > 0) {
      this.createAlert({
        severity: 'critical',
        category: 'network',
        title: 'DDoS Attack Detected',
        description: `${latestMetrics.network.ddosAttempts} DDoS attempts detected`,
        source: 'network-monitor',
        metadata: { ddosAttempts: latestMetrics.network.ddosAttempts }
      });
    }

    // Check for vulnerability threats
    if (latestMetrics.vulnerabilities.criticalVulnerabilities > 0) {
      this.createAlert({
        severity: 'critical',
        category: 'vulnerability',
        title: 'Critical Vulnerabilities Detected',
        description: `${latestMetrics.vulnerabilities.criticalVulnerabilities} critical vulnerabilities found`,
        source: 'vulnerability-scanner',
        metadata: { criticalVulns: latestMetrics.vulnerabilities.criticalVulnerabilities }
      });
    }

    // Check for audit integrity
    if (!latestMetrics.audit.chainIntegrityStatus) {
      this.createAlert({
        severity: 'critical',
        category: 'audit',
        title: 'Audit Chain Integrity Violation',
        description: 'Audit log chain integrity has been compromised',
        source: 'audit-monitor',
        metadata: { integrityStatus: false }
      });
    }

    // Check for zero-trust issues
    if (latestMetrics.zeroTrust.averageTrustScore < 0.5) {
      this.createAlert({
        severity: 'medium',
        category: 'zero-trust',
        title: 'Low Average Trust Score',
        description: `Average trust score is ${latestMetrics.zeroTrust.averageTrustScore}`,
        source: 'zero-trust-engine',
        metadata: { trustScore: latestMetrics.zeroTrust.averageTrustScore }
      });
    }
  }

  private createAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const alert: SecurityAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
      ...alertData
    };

    this.alerts.push(alert);
    this.emit('securityAlert', alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  private processAuditEvent(event: any): void {
    // Process audit events for real-time threat detection
    if (event.severity === 'critical') {
      this.createAlert({
        severity: 'high',
        category: 'audit',
        title: 'Critical Security Event',
        description: `Critical event: ${event.action} on ${event.resource}`,
        source: 'audit-logger',
        metadata: { event }
      });
    }
  }

  getDashboard(): SecurityDashboard {
    const latestMetrics = this.getLatestMetrics();
    const activeAlerts = this.getActiveAlerts();
    
    return {
      overview: {
        securityScore: this.calculateSecurityScore(),
        riskLevel: this.calculateRiskLevel(),
        activeThreats: activeAlerts.length,
        resolvedThreats: this.alerts.filter(a => a.resolvedAt).length
      },
      metrics: latestMetrics || this.getEmptyMetrics(),
      alerts: activeAlerts.slice(0, 10), // Latest 10 alerts
      trends: {
        securityScoreTrend: this.getSecurityScoreTrend(),
        threatTrend: this.getThreatTrend(),
        vulnerabilityTrend: this.getVulnerabilityTrend()
      },
      compliance: {
        gdprCompliance: this.calculateGDPRCompliance(),
        soc2Compliance: this.calculateSOC2Compliance(),
        overallCompliance: this.calculateOverallCompliance()
      }
    };
  }

  private calculateSecurityScore(): number {
    const latestMetrics = this.getLatestMetrics();
    if (!latestMetrics) return 50;

    let score = 100;

    // Deduct points for security issues
    score -= latestMetrics.vulnerabilities.criticalVulnerabilities * 20;
    score -= latestMetrics.vulnerabilities.highVulnerabilities * 10;
    score -= latestMetrics.vulnerabilities.mediumVulnerabilities * 5;
    score -= latestMetrics.authentication.suspiciousActivities * 5;
    score -= latestMetrics.network.ddosAttempts * 15;
    score -= latestMetrics.authorization.privilegeEscalationAttempts * 10;

    // Bonus points for good security practices
    if (latestMetrics.audit.chainIntegrityStatus) score += 5;
    if (latestMetrics.zeroTrust.averageTrustScore > 0.8) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private calculateRiskLevel(): 'low' | 'medium' | 'high' | 'critical' {
    const score = this.calculateSecurityScore();
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;

    if (criticalAlerts > 0 || score < 30) return 'critical';
    if (score < 50) return 'high';
    if (score < 70) return 'medium';
    return 'low';
  }

  private getSecurityScoreTrend(): Array<{ timestamp: Date; score: number }> {
    return this.metrics.slice(-24).map(m => ({
      timestamp: m.timestamp,
      score: this.calculateSecurityScoreFromMetrics(m)
    }));
  }

  private getThreatTrend(): Array<{ timestamp: Date; threats: number }> {
    return this.metrics.slice(-24).map(m => ({
      timestamp: m.timestamp,
      threats: m.authentication.suspiciousActivities + 
               m.network.ddosAttempts + 
               m.authorization.privilegeEscalationAttempts
    }));
  }

  private getVulnerabilityTrend(): Array<{ timestamp: Date; vulnerabilities: number }> {
    return this.metrics.slice(-24).map(m => ({
      timestamp: m.timestamp,
      vulnerabilities: m.vulnerabilities.totalVulnerabilities
    }));
  }

  private calculateSecurityScoreFromMetrics(metrics: SecurityMetrics): number {
    let score = 100;
    score -= metrics.vulnerabilities.criticalVulnerabilities * 20;
    score -= metrics.vulnerabilities.highVulnerabilities * 10;
    score -= metrics.authentication.suspiciousActivities * 5;
    score -= metrics.network.ddosAttempts * 15;
    return Math.max(0, Math.min(100, score));
  }

  private calculateGDPRCompliance(): number {
    // Mock GDPR compliance calculation
    return 85;
  }

  private calculateSOC2Compliance(): number {
    // Mock SOC2 compliance calculation
    return 90;
  }

  private calculateOverallCompliance(): number {
    const gdpr = this.calculateGDPRCompliance();
    const soc2 = this.calculateSOC2Compliance();
    return Math.round((gdpr + soc2) / 2);
  }

  getLatestMetrics(): SecurityMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getActiveAlerts(): SecurityAlert[] {
    return this.alerts.filter(a => !a.acknowledged && !a.resolvedAt);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alertAcknowledged', alert);
      return true;
    }
    return false;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  private getEmptyMetrics(): SecurityMetrics {
    return {
      timestamp: new Date(),
      authentication: {
        successfulLogins: 0,
        failedLogins: 0,
        activeUsers: 0,
        suspiciousActivities: 0
      },
      authorization: {
        accessGranted: 0,
        accessDenied: 0,
        privilegeEscalationAttempts: 0
      },
      network: {
        totalRequests: 0,
        blockedRequests: 0,
        rateLimitedRequests: 0,
        ddosAttempts: 0
      },
      vulnerabilities: {
        totalVulnerabilities: 0,
        criticalVulnerabilities: 0,
        highVulnerabilities: 0,
        mediumVulnerabilities: 0,
        lowVulnerabilities: 0
      },
      zeroTrust: {
        averageTrustScore: 0,
        lowTrustSessions: 0,
        adaptivePolicyChanges: 0,
        riskAssessments: 0
      },
      audit: {
        totalEvents: 0,
        criticalEvents: 0,
        chainIntegrityStatus: true,
        tamperingAttempts: 0
      }
    };
  }

  getMetricsHistory(hours: number = 24): SecurityMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  exportSecurityReport(): string {
    const dashboard = this.getDashboard();
    const report = {
      generatedAt: new Date(),
      securityScore: dashboard.overview.securityScore,
      riskLevel: dashboard.overview.riskLevel,
      activeThreats: dashboard.overview.activeThreats,
      metrics: dashboard.metrics,
      alerts: dashboard.alerts,
      compliance: dashboard.compliance,
      recommendations: this.generateRecommendations()
    };

    return JSON.stringify(report, null, 2);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const latestMetrics = this.getLatestMetrics();
    const activeAlerts = this.getActiveAlerts();

    if (latestMetrics?.vulnerabilities.criticalVulnerabilities > 0) {
      recommendations.push('Address critical vulnerabilities immediately');
    }

    if (latestMetrics?.authentication.failedLogins > 10) {
      recommendations.push('Review failed login attempts and consider implementing account lockout');
    }

    if (activeAlerts.some(a => a.category === 'network')) {
      recommendations.push('Review network security configurations and firewall rules');
    }

    if (latestMetrics?.zeroTrust.averageTrustScore < 0.6) {
      recommendations.push('Implement additional zero-trust security measures');
    }

    if (!latestMetrics?.audit.chainIntegrityStatus) {
      recommendations.push('Investigate audit log integrity issues immediately');
    }

    return recommendations;
  }
}

export const securityMonitor = new SecurityMonitor();