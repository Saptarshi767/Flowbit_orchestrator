#!/usr/bin/env node
interface PenTestResult {
    testName: string;
    status: 'pass' | 'fail' | 'warning';
    description: string;
    details?: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
}
interface PenTestConfig {
    baseUrl: string;
    timeout: number;
    maxRetries: number;
}
declare class PenetrationTester {
    private config;
    private results;
    constructor(config: PenTestConfig);
    runAllTests(): Promise<PenTestResult[]>;
    private testAuthenticationBypass;
    private testWeakPasswords;
    private testSessionManagement;
    private testPrivilegeEscalation;
    private testSQLInjection;
    private testXSSVulnerabilities;
    private testCommandInjection;
    private testPathTraversal;
    private testRateLimiting;
    private testAPIKeyValidation;
    private testCORSMisconfiguration;
    private testHTTPMethodOverride;
    private testSSLConfiguration;
    private testSecurityHeaders;
    private testInformationDisclosure;
    private testDDoSResilience;
    private testWorkflowAccessControl;
    private testDataExfiltration;
    private testAuditLogTampering;
    private makeRequest;
    private extractSessionCookie;
    private addResult;
    private printResults;
    private calculateRiskScore;
}
export { PenetrationTester, PenTestResult, PenTestConfig };
//# sourceMappingURL=penetration-test.d.ts.map