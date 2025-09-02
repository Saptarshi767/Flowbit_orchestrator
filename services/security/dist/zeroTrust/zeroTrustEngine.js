"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zeroTrustEngine = exports.ZeroTrustEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
class ZeroTrustEngine {
    constructor() {
        this.policies = new Map();
        this.userBehaviorProfiles = new Map();
        this.deviceProfiles = new Map();
        this.threatIntelligence = new ThreatIntelligenceService();
        this.riskAssessment = new RiskAssessmentEngine();
        this.adaptivePolicies = new AdaptivePolicyEngine();
        this.initializeDefaultPolicies();
    }
    async evaluateAccess(resource, action, context) {
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
    async calculateTrustScore(context) {
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
        const overall = Object.entries(factors).reduce((sum, [factor, score]) => sum + score * weights[factor], 0);
        const riskLevel = this.determineRiskLevel(overall);
        return {
            overall: Math.round(overall * 100) / 100,
            factors,
            riskLevel
        };
    }
    async calculateIdentityScore(context) {
        if (!context.userId)
            return 0.1; // Anonymous users get low score
        // Check if user has MFA enabled
        const hasMFA = await this.checkMFAStatus(context.userId);
        let score = hasMFA ? 0.8 : 0.4;
        // Check account age and activity
        const accountInfo = await this.getUserAccountInfo(context.userId);
        if (accountInfo.ageInDays > 30)
            score += 0.1;
        if (accountInfo.lastActivity < 24)
            score += 0.1; // Active in last 24 hours
        return Math.min(score, 1.0);
    }
    async calculateDeviceScore(context) {
        const deviceProfile = this.deviceProfiles.get(context.deviceFingerprint);
        if (!deviceProfile) {
            // New device - lower trust
            return 0.3;
        }
        let score = 0.6; // Base score for known device
        // Check device consistency
        if (deviceProfile.userAgent === context.userAgent)
            score += 0.2;
        if (deviceProfile.lastSeen && (Date.now() - deviceProfile.lastSeen) < 7 * 24 * 60 * 60 * 1000) {
            score += 0.2; // Used within last week
        }
        return Math.min(score, 1.0);
    }
    async calculateLocationScore(context) {
        if (!context.location)
            return 0.5; // Unknown location
        const userProfile = this.userBehaviorProfiles.get(context.userId || 'anonymous');
        if (!userProfile || !userProfile.commonLocations)
            return 0.4;
        // Check if location is in user's common locations
        const isCommonLocation = userProfile.commonLocations.some((loc) => loc.country === context.location.country &&
            loc.region === context.location.region);
        return isCommonLocation ? 0.9 : 0.2;
    }
    async calculateBehaviorScore(context) {
        const userProfile = this.userBehaviorProfiles.get(context.userId || 'anonymous');
        if (!userProfile)
            return 0.5; // No behavior history
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
    async calculateNetworkScore(context) {
        // Check if IP is from known malicious sources
        const isMalicious = await this.checkMaliciousIP(context.ipAddress);
        if (isMalicious)
            return 0.0;
        // Check if IP is from VPN/Proxy
        const isVPN = await this.checkVPNUsage(context.ipAddress);
        if (isVPN)
            return 0.3;
        // Check IP reputation
        const reputation = await this.getIPReputation(context.ipAddress);
        return reputation;
    }
    findApplicablePolicies(resource, action) {
        return Array.from(this.policies.values())
            .filter(policy => this.matchesResource(policy.resource, resource) &&
            this.matchesAction(policy.action, action))
            .sort((a, b) => b.priority - a.priority);
    }
    async evaluatePolicies(policies, context, trustScore) {
        const requiredActions = [];
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
            }
            else {
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
    async evaluateConditions(conditions, context, trustScore) {
        for (const condition of conditions) {
            if (!await this.evaluateCondition(condition, context, trustScore)) {
                return false;
            }
        }
        return true;
    }
    async evaluateCondition(condition, context, trustScore) {
        switch (condition.type) {
            case 'trust_score':
                return this.compareValues(trustScore.overall, condition.operator, condition.value);
            case 'location':
                if (!context.location)
                    return false;
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
    compareValues(actual, operator, expected) {
        switch (operator) {
            case 'gt': return actual > expected;
            case 'lt': return actual < expected;
            case 'eq': return actual === expected;
            case 'in': return Array.isArray(expected) && expected.includes(actual);
            case 'not_in': return Array.isArray(expected) && !expected.includes(actual);
            default: return false;
        }
    }
    getRequiredActions(conditions, context, trustScore) {
        const actions = [];
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
    determineRiskLevel(score) {
        if (score >= 0.8)
            return 'low';
        if (score >= 0.6)
            return 'medium';
        if (score >= 0.3)
            return 'high';
        return 'critical';
    }
    async updateBehaviorProfile(context, decision) {
        if (!context.userId)
            return;
        const profile = this.userBehaviorProfiles.get(context.userId) || {
            commonLocations: [],
            activeHours: [],
            averageSessionDuration: 0,
            accessAttempts: []
        };
        // Update location data
        if (context.location) {
            const existingLocation = profile.commonLocations.find((loc) => loc.country === context.location.country && loc.region === context.location.region);
            if (existingLocation) {
                existingLocation.count++;
            }
            else {
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
    initializeDefaultPolicies() {
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
    matchesResource(policyResource, requestResource) {
        if (policyResource === '*')
            return true;
        if (policyResource.endsWith('/*')) {
            const prefix = policyResource.slice(0, -2);
            return requestResource.startsWith(prefix);
        }
        return policyResource === requestResource;
    }
    matchesAction(policyAction, requestAction) {
        return policyAction === '*' || policyAction === requestAction;
    }
    // Enhanced zero-trust capabilities
    async updateThreatIntelligence() {
        await this.threatIntelligence.updateFeeds();
    }
    async performRiskAssessment(context) {
        return await this.riskAssessment.assess(context);
    }
    async adaptPolicies(riskLevel, context) {
        await this.adaptivePolicies.adjustPolicies(riskLevel, context, this.policies);
    }
    async getContinuousAssessmentStatus() {
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
    calculateAverageTrustScore() {
        // Mock implementation - would calculate from recent assessments
        return 0.75;
    }
    calculateRiskTrend() {
        // Mock implementation - would analyze trend from historical data
        return 'stable';
    }
    getRecentAccessDecisions() {
        // Mock implementation - would return recent decisions from cache/storage
        return [];
    }
    // Mock implementations for external services
    async checkMFAStatus(userId) {
        // Mock implementation - replace with actual MFA check
        return Math.random() > 0.5;
    }
    async getUserAccountInfo(userId) {
        // Mock implementation - replace with actual user service
        return {
            ageInDays: Math.floor(Math.random() * 365),
            lastActivity: Math.floor(Math.random() * 48)
        };
    }
    async checkMaliciousIP(ip) {
        return await this.threatIntelligence.checkMaliciousIP(ip);
    }
    async checkVPNUsage(ip) {
        return await this.threatIntelligence.checkVPNUsage(ip);
    }
    async getIPReputation(ip) {
        return await this.threatIntelligence.getIPReputation(ip);
    }
}
exports.ZeroTrustEngine = ZeroTrustEngine;
// Enhanced zero-trust supporting classes
class ThreatIntelligenceService {
    constructor() {
        this.maliciousIPs = new Set();
        this.vpnRanges = new Set();
        this.ipReputationCache = new Map();
    }
    async updateFeeds() {
        // Mock implementation - would fetch from threat intelligence feeds
        console.log('Updating threat intelligence feeds...');
    }
    async checkMaliciousIP(ip) {
        return this.maliciousIPs.has(ip);
    }
    async checkVPNUsage(ip) {
        // Mock VPN detection logic
        return Math.random() > 0.8;
    }
    async getIPReputation(ip) {
        if (this.ipReputationCache.has(ip)) {
            return this.ipReputationCache.get(ip);
        }
        // Mock reputation scoring
        const reputation = Math.random();
        this.ipReputationCache.set(ip, reputation);
        return reputation;
    }
}
class RiskAssessmentEngine {
    constructor() {
        this.activeAssessments = new Map();
    }
    async assess(context) {
        const assessment = {
            id: crypto_1.default.randomUUID(),
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
    async identifyRiskFactors(context) {
        const factors = [];
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
    calculateOverallRisk(factors) {
        const criticalCount = factors.filter(f => f.severity === 'critical').length;
        const highCount = factors.filter(f => f.severity === 'high').length;
        const mediumCount = factors.filter(f => f.severity === 'medium').length;
        if (criticalCount > 0)
            return 'critical';
        if (highCount > 1)
            return 'high';
        if (highCount > 0 || mediumCount > 2)
            return 'medium';
        return 'low';
    }
    generateRecommendations(factors) {
        const recommendations = [];
        if (factors.some(f => f.type === 'anonymous_access')) {
            recommendations.push('Require user authentication');
        }
        if (factors.some(f => f.type === 'unusual_time')) {
            recommendations.push('Consider additional verification for off-hours access');
        }
        return recommendations;
    }
    getActiveAssessments() {
        return Array.from(this.activeAssessments.values());
    }
}
class AdaptivePolicyEngine {
    constructor() {
        this.policyChanges = [];
    }
    async adjustPolicies(riskLevel, context, policies) {
        if (riskLevel === 'high' || riskLevel === 'critical') {
            // Temporarily tighten security policies
            const change = {
                id: crypto_1.default.randomUUID(),
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
    getRecentChanges() {
        const oneHourAgo = new Date(Date.now() - 3600000);
        return this.policyChanges.filter(change => change.timestamp > oneHourAgo);
    }
}
exports.zeroTrustEngine = new ZeroTrustEngine();
//# sourceMappingURL=zeroTrustEngine.js.map