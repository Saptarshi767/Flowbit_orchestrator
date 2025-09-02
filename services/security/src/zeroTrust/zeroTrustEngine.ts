import { Request } from 'express';
import crypto from 'crypto';

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

export class ZeroTrustEngine {
  private policies: Map<string, AccessPolicy> = new Map();
  private userBehaviorProfiles: Map<string, any> = new Map();
  private deviceProfiles: Map<string, any> = new Map();
  private threatIntelligence: ThreatIntelligenceService;
  private riskAssessment: RiskAssessmentEngine;
  private adaptivePolicies: AdaptivePolicyEngine;

  constructor() {
    this.threatIntelligence = new ThreatIntelligenceService();
    this.riskAssessment = new RiskAssessmentEngine();
    this.adaptivePolicies = new AdaptivePolicyEngine();
    this.initializeDefaultPolicies();
  }

  async evaluateAccess(
    resource: string,
    action: string,
    context: SecurityContext
  ): Promise<AccessDecision> {
    // Calculate trust score
    const trustScore = await this.calculateTrustScore(context);
    
    // Find applicable policies
    const applicablePolicies = this.findApplicablePolicies(resource, action);
    
    // Evaluate policies
    const decision = await this.evaluatePolicies(applicablePolicies, context, trustScore);
    
    // Update behavior profiles
    await this.updateBehaviorProfile(context, decision);
    
    return {
      ...decision,
      trustScore,
      policies: applicablePolicies
    };
  }

  private async calculateTrustScore(context: SecurityContext): Promise<TrustScore> {
    const factors = {
      identity: await this.calculateIdentityScore(context),
      device: await this.calculateDeviceScore(context),
      location: await this.calculateLocationScore(context),
      behavior: await this.calculateBehaviorScore(context),
      network: await this.calculateNetworkScore(context)
    };

    // Weighted average of trust factors
    const weights = {
      identity: 0.3,
      device: 0.2,
      location: 0.15,
      behavior: 0.25,
      network: 0.1
    };

    const overall = Object.entries(factors).reduce(
      (sum, [factor, score]) => sum + score * weights[factor as keyof typeof weights],
      0
    );

    const riskLevel = this.determineRiskLevel(overall);

    return {
      overall: Math.round(overall * 100) / 100,
      factors,
      riskLevel
    };
  }

  private async calculateIdentityScore(context: SecurityContext): Promise<number> {
    if (!context.userId) return 0.1; // Anonymous users get low score

    // Check if user has MFA enabled
    const hasMFA = await this.checkMFAStatus(context.userId);
    let score = hasMFA ? 0.8 : 0.4;

    // Check account age and activity
    const accountInfo = await this.getUserAccountInfo(context.userId);
    if (accountInfo.ageInDays > 30) score += 0.1;
    if (accountInfo.lastActivity < 24) score += 0.1; // Active in last 24 hours

    return Math.min(score, 1.0);
  }

  private async calculateDeviceScore(context: SecurityContext): Promise<number> {
    const deviceProfile = this.deviceProfiles.get(context.deviceFingerprint);
    
    if (!deviceProfile) {
      // New device - lower trust
      return 0.3;
    }

    let score = 0.6; // Base score for known device

    // Check device consistency
    if (deviceProfile.userAgent === context.userAgent) score += 0.2;
    if (deviceProfile.lastSeen && (Date.now() - deviceProfile.lastSeen) < 7 * 24 * 60 * 60 * 1000) {
      score += 0.2; // Used within last week
    }

    return Math.min(score, 1.0);
  }

  private async calculateLocationScore(context: SecurityContext): Promise<number> {
    if (!context.location) return 0.5; // Unknown location

    const userProfile = this.userBehaviorProfiles.get(context.userId || 'anonymous');
    if (!userProfile || !userProfile.commonLocations) return 0.4;

    // Check if location is in user's common locations
    const isCommonLocation = userProfile.commonLocations.some((loc: any) =>
      loc.country === context.location!.country &&
      loc.region === context.location!.region
    );

    return isCommonLocation ? 0.9 : 0.2;
  }

  private async calculateBehaviorScore(context: SecurityContext): Promise<number> {
    const userProfile = this.userBehaviorProfiles.get(context.userId || 'anonymous');
    if (!userProfile) return 0.5; // No behavior history

    let score = 0.5;

    // Check time-based patterns
    const currentHour = new Date().getHours();
    if (userProfile.activeHours && userProfile.activeHours.includes(currentHour)) {
      score += 0.3;
    }

    // Check access patterns
    if (userProfile.averageSessionDuration && userProfile.averageSessionDuration > 300) {
      score += 0.2; // Longer sessions indicate legitimate use
    }

    return Math.min(score, 1.0);
  }

  private async calculateNetworkScore(context: SecurityContext): Promise<number> {
    // Check if IP is from known malicious sources
    const isMalicious = await this.checkMaliciousIP(context.ipAddress);
    if (isMalicious) return 0.0;

    // Check if IP is from VPN/Proxy
    const isVPN = await this.checkVPNUsage(context.ipAddress);
    if (isVPN) return 0.3;

    // Check IP reputation
    const reputation = await this.getIPReputation(context.ipAddress);
    return reputation;
  }

  private findApplicablePolicies(resource: string, action: string): AccessPolicy[] {
    return Array.from(this.policies.values())
      .filter(policy => 
        this.matchesResource(policy.resource, resource) &&
        this.matchesAction(policy.action, action)
      )
      .sort((a, b) => b.priority - a.priority);
  }

  private async evaluatePolicies(
    policies: AccessPolicy[],
    context: SecurityContext,
    trustScore: TrustScore
  ): Promise<Omit<AccessDecision, 'trustScore' | 'policies'>> {
    const requiredActions: string[] = [];
    
    for (const policy of policies) {
      const conditionsMet = await this.evaluateConditions(policy.conditions, context, trustScore);
      
      if (conditionsMet) {
        if (policy.effect === 'deny') {
          return {
            allowed: false,
            reason: `Access denied by policy: ${policy.name}`,
            requiredActions
          };
        }
        // Allow policy matched
        return {
          allowed: true,
          reason: `Access granted by policy: ${policy.name}`,
          requiredActions
        };
      } else {
        // Check what actions are required to meet conditions
        const actions = this.getRequiredActions(policy.conditions, context, trustScore);
        requiredActions.push(...actions);
      }
    }

    // No explicit allow policy matched
    return {
      allowed: false,
      reason: 'No matching allow policy found',
      requiredActions
    };
  }

  private async evaluateConditions(
    conditions: PolicyCondition[],
    context: SecurityContext,
    trustScore: TrustScore
  ): Promise<boolean> {
    for (const condition of conditions) {
      if (!await this.evaluateCondition(condition, context, trustScore)) {
        return false;
      }
    }
    return true;
  }

  private async evaluateCondition(
    condition: PolicyCondition,
    context: SecurityContext,
    trustScore: TrustScore
  ): Promise<boolean> {
    switch (condition.type) {
      case 'trust_score':
        return this.compareValues(trustScore.overall, condition.operator, condition.value);
      
      case 'location':
        if (!context.location) return false;
        return this.compareValues(context.location.country, condition.operator, condition.value);
      
      case 'time':
        const currentHour = new Date().getHours();
        return this.compareValues(currentHour, condition.operator, condition.value);
      
      case 'device':
        const isKnownDevice = this.deviceProfiles.has(context.deviceFingerprint);
        return condition.operator === 'eq' ? isKnownDevice === condition.value : !isKnownDevice === condition.value;
      
      case 'mfa':
        const hasMFA = await this.checkMFAStatus(context.userId || '');
        return condition.operator === 'eq' ? hasMFA === condition.value : hasMFA !== condition.value;
      
      default:
        return false;
    }
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'gt': return actual > expected;
      case 'lt': return actual < expected;
      case 'eq': return actual === expected;
      case 'in': return Array.isArray(expected) && expected.includes(actual);
      case 'not_in': return Array.isArray(expected) && !expected.includes(actual);
      default: return false;
    }
  }

  private getRequiredActions(
    conditions: PolicyCondition[],
    context: SecurityContext,
    trustScore: TrustScore
  ): string[] {
    const actions: string[] = [];
    
    for (const condition of conditions) {
      if (condition.type === 'trust_score' && trustScore.overall < condition.value) {
        actions.push('Improve trust score through additional verification');
      }
      if (condition.type === 'mfa' && condition.value === true) {
        actions.push('Enable multi-factor authentication');
      }
      if (condition.type === 'device' && condition.value === true && !this.deviceProfiles.has(context.deviceFingerprint)) {
        actions.push('Register device for trusted access');
      }
    }
    
    return actions;
  }

  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.8) return 'low';
    if (score >= 0.6) return 'medium';
    if (score >= 0.3) return 'high';
    return 'critical';
  }

  private async updateBehaviorProfile(context: SecurityContext, decision: AccessDecision): Promise<void> {
    if (!context.userId) return;

    const profile = this.userBehaviorProfiles.get(context.userId) || {
      commonLocations: [],
      activeHours: [],
      averageSessionDuration: 0,
      accessAttempts: []
    };

    // Update location data
    if (context.location) {
      const existingLocation = profile.commonLocations.find((loc: any) =>
        loc.country === context.location!.country && loc.region === context.location!.region
      );
      
      if (existingLocation) {
        existingLocation.count++;
      } else {
        profile.commonLocations.push({
          ...context.location,
          count: 1
        });
      }
    }

    // Update access attempts
    profile.accessAttempts.push({
      timestamp: context.timestamp,
      allowed: decision.allowed,
      trustScore: decision.trustScore.overall
    });

    // Keep only last 100 attempts
    if (profile.accessAttempts.length > 100) {
      profile.accessAttempts = profile.accessAttempts.slice(-100);
    }

    this.userBehaviorProfiles.set(context.userId, profile);
  }

  private initializeDefaultPolicies(): void {
    // High-trust users policy
    this.policies.set('high-trust-allow', {
      id: 'high-trust-allow',
      name: 'High Trust Users',
      resource: '*',
      action: '*',
      conditions: [
        { type: 'trust_score', operator: 'gt', value: 0.8 }
      ],
      effect: 'allow',
      priority: 100
    });

    // Admin access policy
    this.policies.set('admin-strict', {
      id: 'admin-strict',
      name: 'Admin Strict Access',
      resource: '/admin/*',
      action: '*',
      conditions: [
        { type: 'trust_score', operator: 'gt', value: 0.9 },
        { type: 'mfa', operator: 'eq', value: true },
        { type: 'device', operator: 'eq', value: true }
      ],
      effect: 'allow',
      priority: 200
    });

    // Low trust deny policy
    this.policies.set('low-trust-deny', {
      id: 'low-trust-deny',
      name: 'Low Trust Deny',
      resource: '*',
      action: '*',
      conditions: [
        { type: 'trust_score', operator: 'lt', value: 0.3 }
      ],
      effect: 'deny',
      priority: 300
    });
  }

  private matchesResource(policyResource: string, requestResource: string): boolean {
    if (policyResource === '*') return true;
    if (policyResource.endsWith('/*')) {
      const prefix = policyResource.slice(0, -2);
      return requestResource.startsWith(prefix);
    }
    return policyResource === requestResource;
  }

  private matchesAction(policyAction: string, requestAction: string): boolean {
    return policyAction === '*' || policyAction === requestAction;
  }

  // Enhanced zero-trust capabilities
  async updateThreatIntelligence(): Promise<void> {
    await this.threatIntelligence.updateFeeds();
  }

  async performRiskAssessment(context: SecurityContext): Promise<RiskAssessment> {
    return await this.riskAssessment.assess(context);
  }

  async adaptPolicies(riskLevel: string, context: SecurityContext): Promise<void> {
    await this.adaptivePolicies.adjustPolicies(riskLevel, context, this.policies);
  }

  async getContinuousAssessmentStatus(): Promise<ContinuousAssessmentStatus> {
    const activeAssessments = this.riskAssessment.getActiveAssessments();
    const recentDecisions = this.getRecentAccessDecisions();
    
    return {
      activeAssessments: activeAssessments.length,
      averageTrustScore: this.calculateAverageTrustScore(),
      riskTrend: this.calculateRiskTrend(),
      policyViolations: recentDecisions.filter(d => !d.allowed).length,
      adaptivePolicyChanges: this.adaptivePolicies.getRecentChanges().length
    };
  }

  private calculateAverageTrustScore(): number {
    // Mock implementation - would calculate from recent assessments
    return 0.75;
  }

  private calculateRiskTrend(): 'increasing' | 'stable' | 'decreasing' {
    // Mock implementation - would analyze trend from historical data
    return 'stable';
  }

  private getRecentAccessDecisions(): AccessDecision[] {
    // Mock implementation - would return recent decisions from cache/storage
    return [];
  }

  // Mock implementations for external services
  private async checkMFAStatus(userId: string): Promise<boolean> {
    // Mock implementation - replace with actual MFA check
    return Math.random() > 0.5;
  }

  private async getUserAccountInfo(userId: string): Promise<any> {
    // Mock implementation - replace with actual user service
    return {
      ageInDays: Math.floor(Math.random() * 365),
      lastActivity: Math.floor(Math.random() * 48)
    };
  }

  private async checkMaliciousIP(ip: string): Promise<boolean> {
    return await this.threatIntelligence.checkMaliciousIP(ip);
  }

  private async checkVPNUsage(ip: string): Promise<boolean> {
    return await this.threatIntelligence.checkVPNUsage(ip);
  }

  private async getIPReputation(ip: string): Promise<number> {
    return await this.threatIntelligence.getIPReputation(ip);
  }
}

// Enhanced zero-trust supporting classes
class ThreatIntelligenceService {
  private maliciousIPs: Set<string> = new Set();
  private vpnRanges: Set<string> = new Set();
  private ipReputationCache: Map<string, number> = new Map();

  async updateFeeds(): Promise<void> {
    // Mock implementation - would fetch from threat intelligence feeds
    console.log('Updating threat intelligence feeds...');
  }

  async checkMaliciousIP(ip: string): Promise<boolean> {
    return this.maliciousIPs.has(ip);
  }

  async checkVPNUsage(ip: string): Promise<boolean> {
    // Mock VPN detection logic
    return Math.random() > 0.8;
  }

  async getIPReputation(ip: string): Promise<number> {
    if (this.ipReputationCache.has(ip)) {
      return this.ipReputationCache.get(ip)!;
    }
    
    // Mock reputation scoring
    const reputation = Math.random();
    this.ipReputationCache.set(ip, reputation);
    return reputation;
  }
}

class RiskAssessmentEngine {
  private activeAssessments: Map<string, RiskAssessment> = new Map();

  async assess(context: SecurityContext): Promise<RiskAssessment> {
    const assessment: RiskAssessment = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      context,
      riskFactors: await this.identifyRiskFactors(context),
      overallRisk: 'medium',
      recommendations: []
    };

    assessment.overallRisk = this.calculateOverallRisk(assessment.riskFactors);
    assessment.recommendations = this.generateRecommendations(assessment.riskFactors);

    this.activeAssessments.set(assessment.id, assessment);
    return assessment;
  }

  private async identifyRiskFactors(context: SecurityContext): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Check for anomalous behavior
    if (!context.userId) {
      factors.push({
        type: 'anonymous_access',
        severity: 'medium',
        description: 'Anonymous user access attempt'
      });
    }

    // Check for unusual time access
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      factors.push({
        type: 'unusual_time',
        severity: 'low',
        description: 'Access attempt outside normal business hours'
      });
    }

    return factors;
  }

  private calculateOverallRisk(factors: RiskFactor[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = factors.filter(f => f.severity === 'critical').length;
    const highCount = factors.filter(f => f.severity === 'high').length;
    const mediumCount = factors.filter(f => f.severity === 'medium').length;

    if (criticalCount > 0) return 'critical';
    if (highCount > 1) return 'high';
    if (highCount > 0 || mediumCount > 2) return 'medium';
    return 'low';
  }

  private generateRecommendations(factors: RiskFactor[]): string[] {
    const recommendations: string[] = [];

    if (factors.some(f => f.type === 'anonymous_access')) {
      recommendations.push('Require user authentication');
    }

    if (factors.some(f => f.type === 'unusual_time')) {
      recommendations.push('Consider additional verification for off-hours access');
    }

    return recommendations;
  }

  getActiveAssessments(): RiskAssessment[] {
    return Array.from(this.activeAssessments.values());
  }
}

class AdaptivePolicyEngine {
  private policyChanges: PolicyChange[] = [];

  async adjustPolicies(
    riskLevel: string,
    context: SecurityContext,
    policies: Map<string, AccessPolicy>
  ): Promise<void> {
    if (riskLevel === 'high' || riskLevel === 'critical') {
      // Temporarily tighten security policies
      const change: PolicyChange = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'tighten',
        reason: `High risk level detected: ${riskLevel}`,
        affectedPolicies: Array.from(policies.keys()),
        duration: 3600000 // 1 hour
      };

      this.policyChanges.push(change);
      console.log(`Adaptive policy change: ${change.reason}`);
    }
  }

  getRecentChanges(): PolicyChange[] {
    const oneHourAgo = new Date(Date.now() - 3600000);
    return this.policyChanges.filter(change => change.timestamp > oneHourAgo);
  }
}

// Additional interfaces for enhanced zero-trust
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

interface PolicyChange {
  id: string;
  timestamp: Date;
  type: 'tighten' | 'relax';
  reason: string;
  affectedPolicies: string[];
  duration: number;
}

interface ContinuousAssessmentStatus {
  activeAssessments: number;
  averageTrustScore: number;
  riskTrend: 'increasing' | 'stable' | 'decreasing';
  policyViolations: number;
  adaptivePolicyChanges: number;
}

export const zeroTrustEngine = new ZeroTrustEngine();