import { EventEmitter } from 'events';
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
        securityScoreTrend: Array<{
            timestamp: Date;
            score: number;
        }>;
        threatTrend: Array<{
            timestamp: Date;
            threats: number;
        }>;
        vulnerabilityTrend: Array<{
            timestamp: Date;
            vulnerabilities: number;
        }>;
    };
    compliance: {
        gdprCompliance: number;
        soc2Compliance: number;
        overallCompliance: number;
    };
}
export declare class SecurityMonitor extends EventEmitter {
    private metrics;
    private alerts;
    private monitoringInterval;
    private isMonitoring;
    constructor();
    private initializeMonitoring;
    startMonitoring(intervalMs?: number): void;
    stopMonitoring(): void;
    private collectMetrics;
    private collectAuthenticationMetrics;
    private collectAuthorizationMetrics;
    private collectNetworkMetrics;
    private collectVulnerabilityMetrics;
    private collectZeroTrustMetrics;
    private collectAuditMetrics;
    private assessThreats;
    private createAlert;
    private processAuditEvent;
    getDashboard(): SecurityDashboard;
    private calculateSecurityScore;
    private calculateRiskLevel;
    private getSecurityScoreTrend;
    private getThreatTrend;
    private getVulnerabilityTrend;
    private calculateSecurityScoreFromMetrics;
    private calculateGDPRCompliance;
    private calculateSOC2Compliance;
    private calculateOverallCompliance;
    getLatestMetrics(): SecurityMetrics | null;
    getActiveAlerts(): SecurityAlert[];
    acknowledgeAlert(alertId: string): boolean;
    resolveAlert(alertId: string): boolean;
    private getEmptyMetrics;
    getMetricsHistory(hours?: number): SecurityMetrics[];
    exportSecurityReport(): string;
    private generateRecommendations;
}
export declare const securityMonitor: SecurityMonitor;
//# sourceMappingURL=securityMonitor.d.ts.map