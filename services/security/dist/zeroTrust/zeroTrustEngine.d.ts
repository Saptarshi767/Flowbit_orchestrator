export interface TrustScore {
    overall: number;
    factors: {
        identity: number;
        device: number;
        location: number;
        behavior: number;
        network: number;
    };
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
export interface SecurityContext {
    userId?: string;
    sessionId: string;
    deviceFingerprint: string;
    ipAddress: string;
    location?: {
        country: string;
        region: string;
        city: string;
    };
    userAgent: string;
    timestamp: Date;
}
export interface AccessPolicy {
    id: string;
    name: string;
    resource: string;
    action: string;
    conditions: PolicyCondition[];
    effect: 'allow' | 'deny';
    priority: number;
}
export interface PolicyCondition {
    type: 'trust_score' | 'location' | 'time' | 'device' | 'mfa';
    operator: 'gt' | 'lt' | 'eq' | 'in' | 'not_in';
    value: any;
}
export interface AccessDecision {
    allowed: boolean;
    reason: string;
    trustScore: TrustScore;
    requiredActions: string[];
    policies: AccessPolicy[];
}
export declare class ZeroTrustEngine {
    private policies;
    private userBehaviorProfiles;
    private deviceProfiles;
    private threatIntelligence;
    private riskAssessment;
    private adaptivePolicies;
    constructor();
    evaluateAccess(resource: string, action: string, context: SecurityContext): Promise<AccessDecision>;
    private calculateTrustScore;
    private calculateIdentityScore;
    private calculateDeviceScore;
    private calculateLocationScore;
    private calculateBehaviorScore;
    private calculateNetworkScore;
    private findApplicablePolicies;
    private evaluatePolicies;
    private evaluateConditions;
    private evaluateCondition;
    private compareValues;
    private getRequiredActions;
    private determineRiskLevel;
    private updateBehaviorProfile;
    private initializeDefaultPolicies;
    private matchesResource;
    private matchesAction;
    updateThreatIntelligence(): Promise<void>;
    performRiskAssessment(context: SecurityContext): Promise<RiskAssessment>;
    adaptPolicies(riskLevel: string, context: SecurityContext): Promise<void>;
    getContinuousAssessmentStatus(): Promise<ContinuousAssessmentStatus>;
    private calculateAverageTrustScore;
    private calculateRiskTrend;
    private getRecentAccessDecisions;
    private checkMFAStatus;
    private getUserAccountInfo;
    private checkMaliciousIP;
    private checkVPNUsage;
    private getIPReputation;
}
interface RiskAssessment {
    id: string;
    timestamp: Date;
    context: SecurityContext;
    riskFactors: RiskFactor[];
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
}
interface RiskFactor {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
}
interface ContinuousAssessmentStatus {
    activeAssessments: number;
    averageTrustScore: number;
    riskTrend: 'increasing' | 'stable' | 'decreasing';
    policyViolations: number;
    adaptivePolicyChanges: number;
}
export declare const zeroTrustEngine: ZeroTrustEngine;
export {};
//# sourceMappingURL=zeroTrustEngine.d.ts.map