#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PenetrationTester = void 0;
const axios_1 = __importDefault(require("axios"));
class PenetrationTester {
    constructor(config) {
        this.results = [];
        this.config = config;
    }
    async runAllTests() {
        console.log('🔍 Starting penetration testing suite...\n');
        // Authentication & Authorization Tests
        await this.testAuthenticationBypass();
        await this.testWeakPasswords();
        await this.testSessionManagement();
        await this.testPrivilegeEscalation();
        // Input Validation Tests
        await this.testSQLInjection();
        await this.testXSSVulnerabilities();
        await this.testCommandInjection();
        await this.testPathTraversal();
        // API Security Tests
        await this.testRateLimiting();
        await this.testAPIKeyValidation();
        await this.testCORSMisconfiguration();
        await this.testHTTPMethodOverride();
        // Infrastructure Tests
        await this.testSSLConfiguration();
        await this.testSecurityHeaders();
        await this.testInformationDisclosure();
        await this.testDDoSResilience();
        // Business Logic Tests
        await this.testWorkflowAccessControl();
        await this.testDataExfiltration();
        await this.testAuditLogTampering();
        this.printResults();
        return this.results;
    }
    // Authentication & Authorization Tests
    async testAuthenticationBypass() {
        const testName = 'Authentication Bypass';
        try {
            // Test 1: Direct API access without authentication
            const response = await this.makeRequest('GET', '/api/workflows', {}, false);
            if (response.status === 200) {
                this.addResult({
                    testName,
                    status: 'fail',
                    description: 'API endpoints accessible without authentication',
                    severity: 'critical'
                });
            }
            else if (response.status === 401 || response.status === 403) {
                this.addResult({
                    testName,
                    status: 'pass',
                    description: 'Authentication properly enforced',
                    severity: 'low'
                });
            }
            // Test 2: JWT token manipulation
            const malformedToken = 'Bearer invalid.token.here';
            const tokenResponse = await this.makeRequest('GET', '/api/user/profile', {
                'Authorization': malformedToken
            });
            if (tokenResponse.status === 200) {
                this.addResult({
                    testName: `${testName} - JWT Validation`,
                    status: 'fail',
                    description: 'Invalid JWT tokens accepted',
                    severity: 'critical'
                });
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testWeakPasswords() {
        const testName = 'Weak Password Policy';
        const weakPasswords = ['123456', 'password', 'admin', 'test', ''];
        try {
            for (const password of weakPasswords) {
                const response = await this.makeRequest('POST', '/api/auth/register', {}, true, {
                    email: `test${Date.now()}@example.com`,
                    password: password,
                    name: 'Test User'
                });
                if (response.status === 200 || response.status === 201) {
                    this.addResult({
                        testName,
                        status: 'fail',
                        description: `Weak password "${password}" accepted during registration`,
                        severity: 'high'
                    });
                    return;
                }
            }
            this.addResult({
                testName,
                status: 'pass',
                description: 'Strong password policy enforced',
                severity: 'low'
            });
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testSessionManagement() {
        const testName = 'Session Management';
        try {
            // Test session fixation
            const loginResponse = await this.makeRequest('POST', '/api/auth/login', {}, true, {
                email: 'test@example.com',
                password: 'TestPassword123!'
            });
            if (loginResponse.status === 200) {
                const sessionCookie = this.extractSessionCookie(loginResponse);
                if (!sessionCookie) {
                    this.addResult({
                        testName,
                        status: 'fail',
                        description: 'No session cookie set after login',
                        severity: 'high'
                    });
                    return;
                }
                // Test session timeout
                await new Promise(resolve => setTimeout(resolve, 2000));
                const protectedResponse = await this.makeRequest('GET', '/api/user/profile', {
                    'Cookie': sessionCookie
                });
                if (protectedResponse.status === 200) {
                    this.addResult({
                        testName,
                        status: 'pass',
                        description: 'Session management working correctly',
                        severity: 'low'
                    });
                }
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testPrivilegeEscalation() {
        const testName = 'Privilege Escalation';
        try {
            // Test horizontal privilege escalation
            const userResponse = await this.makeRequest('GET', '/api/user/123', {}, true);
            if (userResponse.status === 200) {
                // Try to access another user's data
                const otherUserResponse = await this.makeRequest('GET', '/api/user/456', {}, true);
                if (otherUserResponse.status === 200) {
                    this.addResult({
                        testName,
                        status: 'fail',
                        description: 'Horizontal privilege escalation possible',
                        severity: 'critical'
                    });
                }
                else {
                    this.addResult({
                        testName,
                        status: 'pass',
                        description: 'User isolation properly enforced',
                        severity: 'low'
                    });
                }
            }
            // Test vertical privilege escalation
            const adminResponse = await this.makeRequest('GET', '/api/admin/users', {}, true);
            if (adminResponse.status === 200) {
                this.addResult({
                    testName: `${testName} - Vertical`,
                    status: 'fail',
                    description: 'Regular user can access admin endpoints',
                    severity: 'critical'
                });
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    // Input Validation Tests
    async testSQLInjection() {
        const testName = 'SQL Injection';
        const sqlPayloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --",
            "1' OR 1=1#"
        ];
        try {
            for (const payload of sqlPayloads) {
                const response = await this.makeRequest('GET', `/api/workflows?search=${encodeURIComponent(payload)}`, {}, true);
                if (response.status === 500 || (response.data && response.data.toString().includes('SQL'))) {
                    this.addResult({
                        testName,
                        status: 'fail',
                        description: `SQL injection vulnerability detected with payload: ${payload}`,
                        severity: 'critical'
                    });
                    return;
                }
            }
            this.addResult({
                testName,
                status: 'pass',
                description: 'No SQL injection vulnerabilities detected',
                severity: 'low'
            });
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testXSSVulnerabilities() {
        const testName = 'Cross-Site Scripting (XSS)';
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            '"><script>alert("XSS")</script>',
            'javascript:alert("XSS")',
            '<img src=x onerror=alert("XSS")>'
        ];
        try {
            for (const payload of xssPayloads) {
                const response = await this.makeRequest('POST', '/api/workflows', {}, true, {
                    name: payload,
                    description: 'Test workflow'
                });
                if (response.status === 200 || response.status === 201) {
                    // Check if payload is reflected in response
                    if (response.data && response.data.toString().includes(payload)) {
                        this.addResult({
                            testName,
                            status: 'fail',
                            description: `XSS vulnerability detected with payload: ${payload}`,
                            severity: 'high'
                        });
                        return;
                    }
                }
            }
            this.addResult({
                testName,
                status: 'pass',
                description: 'No XSS vulnerabilities detected',
                severity: 'low'
            });
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testCommandInjection() {
        const testName = 'Command Injection';
        const commandPayloads = [
            '; ls -la',
            '| whoami',
            '&& cat /etc/passwd',
            '`id`'
        ];
        try {
            for (const payload of commandPayloads) {
                const response = await this.makeRequest('POST', '/api/workflows/execute', {}, true, {
                    workflowId: 'test',
                    parameters: { command: payload }
                });
                if (response.status === 200 && response.data) {
                    const responseText = response.data.toString();
                    if (responseText.includes('root:') || responseText.includes('uid=') || responseText.includes('total ')) {
                        this.addResult({
                            testName,
                            status: 'fail',
                            description: `Command injection vulnerability detected with payload: ${payload}`,
                            severity: 'critical'
                        });
                        return;
                    }
                }
            }
            this.addResult({
                testName,
                status: 'pass',
                description: 'No command injection vulnerabilities detected',
                severity: 'low'
            });
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testPathTraversal() {
        const testName = 'Path Traversal';
        const pathPayloads = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
            '....//....//....//etc/passwd',
            '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
        ];
        try {
            for (const payload of pathPayloads) {
                const response = await this.makeRequest('GET', `/api/files/${encodeURIComponent(payload)}`, {}, true);
                if (response.status === 200 && response.data) {
                    const responseText = response.data.toString();
                    if (responseText.includes('root:') || responseText.includes('localhost')) {
                        this.addResult({
                            testName,
                            status: 'fail',
                            description: `Path traversal vulnerability detected with payload: ${payload}`,
                            severity: 'critical'
                        });
                        return;
                    }
                }
            }
            this.addResult({
                testName,
                status: 'pass',
                description: 'No path traversal vulnerabilities detected',
                severity: 'low'
            });
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    // API Security Tests
    async testRateLimiting() {
        const testName = 'Rate Limiting';
        try {
            const requests = [];
            const startTime = Date.now();
            // Send 100 requests rapidly
            for (let i = 0; i < 100; i++) {
                requests.push(this.makeRequest('GET', '/api/workflows', {}, false));
            }
            const responses = await Promise.allSettled(requests);
            const rateLimitedResponses = responses.filter(result => result.status === 'fulfilled' &&
                result.value.status === 429);
            if (rateLimitedResponses.length === 0) {
                this.addResult({
                    testName,
                    status: 'fail',
                    description: 'No rate limiting detected - potential DoS vulnerability',
                    severity: 'high'
                });
            }
            else {
                this.addResult({
                    testName,
                    status: 'pass',
                    description: `Rate limiting working - ${rateLimitedResponses.length} requests blocked`,
                    severity: 'low'
                });
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testAPIKeyValidation() {
        const testName = 'API Key Validation';
        try {
            // Test with invalid API key
            const invalidResponse = await this.makeRequest('GET', '/api/workflows', {
                'X-API-Key': 'invalid-key-12345'
            });
            if (invalidResponse.status === 200) {
                this.addResult({
                    testName,
                    status: 'fail',
                    description: 'Invalid API key accepted',
                    severity: 'critical'
                });
                return;
            }
            // Test with no API key
            const noKeyResponse = await this.makeRequest('GET', '/api/workflows', {}, false);
            if (noKeyResponse.status === 200) {
                this.addResult({
                    testName,
                    status: 'fail',
                    description: 'API accessible without API key',
                    severity: 'high'
                });
                return;
            }
            this.addResult({
                testName,
                status: 'pass',
                description: 'API key validation working correctly',
                severity: 'low'
            });
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testCORSMisconfiguration() {
        const testName = 'CORS Misconfiguration';
        try {
            const response = await this.makeRequest('OPTIONS', '/api/workflows', {
                'Origin': 'https://malicious-site.com',
                'Access-Control-Request-Method': 'GET'
            });
            const corsHeader = response.headers['access-control-allow-origin'];
            if (corsHeader === '*' || corsHeader === 'https://malicious-site.com') {
                this.addResult({
                    testName,
                    status: 'fail',
                    description: 'Overly permissive CORS configuration detected',
                    severity: 'medium'
                });
            }
            else {
                this.addResult({
                    testName,
                    status: 'pass',
                    description: 'CORS configuration appears secure',
                    severity: 'low'
                });
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testHTTPMethodOverride() {
        const testName = 'HTTP Method Override';
        try {
            // Test X-HTTP-Method-Override header
            const response = await this.makeRequest('POST', '/api/workflows/123', {
                'X-HTTP-Method-Override': 'DELETE'
            }, true);
            if (response.status === 200 || response.status === 204) {
                this.addResult({
                    testName,
                    status: 'fail',
                    description: 'HTTP method override vulnerability detected',
                    severity: 'medium'
                });
            }
            else {
                this.addResult({
                    testName,
                    status: 'pass',
                    description: 'HTTP method override properly handled',
                    severity: 'low'
                });
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    // Infrastructure Tests
    async testSSLConfiguration() {
        const testName = 'SSL/TLS Configuration';
        try {
            // Test if HTTP is redirected to HTTPS
            const httpUrl = this.config.baseUrl.replace('https://', 'http://');
            const response = await this.makeRequest('GET', '/', {}, false, undefined, httpUrl);
            if (response.status !== 301 && response.status !== 302) {
                this.addResult({
                    testName,
                    status: 'fail',
                    description: 'HTTP not redirected to HTTPS',
                    severity: 'medium'
                });
            }
            else {
                this.addResult({
                    testName,
                    status: 'pass',
                    description: 'HTTPS properly enforced',
                    severity: 'low'
                });
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testSecurityHeaders() {
        const testName = 'Security Headers';
        try {
            const response = await this.makeRequest('GET', '/', {}, false);
            const headers = response.headers;
            const requiredHeaders = [
                'x-frame-options',
                'x-content-type-options',
                'x-xss-protection',
                'strict-transport-security',
                'content-security-policy'
            ];
            const missingHeaders = requiredHeaders.filter(header => !headers[header]);
            if (missingHeaders.length > 0) {
                this.addResult({
                    testName,
                    status: 'fail',
                    description: `Missing security headers: ${missingHeaders.join(', ')}`,
                    severity: 'medium'
                });
            }
            else {
                this.addResult({
                    testName,
                    status: 'pass',
                    description: 'All required security headers present',
                    severity: 'low'
                });
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testInformationDisclosure() {
        const testName = 'Information Disclosure';
        try {
            // Test for exposed debug information
            const debugResponse = await this.makeRequest('GET', '/debug', {}, false);
            if (debugResponse.status === 200) {
                this.addResult({
                    testName,
                    status: 'fail',
                    description: 'Debug endpoint exposed in production',
                    severity: 'medium'
                });
                return;
            }
            // Test for server information in headers
            const response = await this.makeRequest('GET', '/', {}, false);
            const serverHeader = response.headers['server'];
            if (serverHeader && (serverHeader.includes('Apache') || serverHeader.includes('nginx'))) {
                this.addResult({
                    testName,
                    status: 'warning',
                    description: 'Server information disclosed in headers',
                    severity: 'low'
                });
            }
            else {
                this.addResult({
                    testName,
                    status: 'pass',
                    description: 'No obvious information disclosure detected',
                    severity: 'low'
                });
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testDDoSResilience() {
        const testName = 'DDoS Resilience';
        try {
            const startTime = Date.now();
            const requests = [];
            // Send 50 concurrent requests
            for (let i = 0; i < 50; i++) {
                requests.push(this.makeRequest('GET', '/api/health', {}, false));
            }
            const responses = await Promise.allSettled(requests);
            const endTime = Date.now();
            const duration = endTime - startTime;
            const successfulResponses = responses.filter(result => result.status === 'fulfilled' &&
                result.value.status === 200).length;
            if (successfulResponses === 50 && duration < 5000) {
                this.addResult({
                    testName,
                    status: 'warning',
                    description: 'System may be vulnerable to DDoS attacks - no throttling detected',
                    severity: 'medium'
                });
            }
            else {
                this.addResult({
                    testName,
                    status: 'pass',
                    description: `DDoS protection appears active - ${successfulResponses}/50 requests succeeded`,
                    severity: 'low'
                });
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    // Business Logic Tests
    async testWorkflowAccessControl() {
        const testName = 'Workflow Access Control';
        try {
            // Test accessing workflows without proper authorization
            const response = await this.makeRequest('GET', '/api/workflows/private-workflow-123', {}, true);
            if (response.status === 200) {
                this.addResult({
                    testName,
                    status: 'fail',
                    description: 'Private workflow accessible without proper authorization',
                    severity: 'high'
                });
            }
            else if (response.status === 403 || response.status === 404) {
                this.addResult({
                    testName,
                    status: 'pass',
                    description: 'Workflow access control working correctly',
                    severity: 'low'
                });
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testDataExfiltration() {
        const testName = 'Data Exfiltration';
        try {
            // Test bulk data export
            const response = await this.makeRequest('GET', '/api/workflows/export?limit=10000', {}, true);
            if (response.status === 200 && response.data) {
                const dataSize = JSON.stringify(response.data).length;
                if (dataSize > 1000000) { // 1MB
                    this.addResult({
                        testName,
                        status: 'warning',
                        description: 'Large data export allowed - potential data exfiltration risk',
                        severity: 'medium'
                    });
                }
                else {
                    this.addResult({
                        testName,
                        status: 'pass',
                        description: 'Data export limits appear reasonable',
                        severity: 'low'
                    });
                }
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    async testAuditLogTampering() {
        const testName = 'Audit Log Tampering';
        try {
            // Test if audit logs can be modified
            const response = await this.makeRequest('DELETE', '/api/audit/logs/123', {}, true);
            if (response.status === 200 || response.status === 204) {
                this.addResult({
                    testName,
                    status: 'fail',
                    description: 'Audit logs can be deleted - tampering possible',
                    severity: 'critical'
                });
            }
            else {
                this.addResult({
                    testName,
                    status: 'pass',
                    description: 'Audit logs protected from tampering',
                    severity: 'low'
                });
            }
        }
        catch (error) {
            this.addResult({
                testName,
                status: 'warning',
                description: `Test failed to execute: ${error}`,
                severity: 'medium'
            });
        }
    }
    // Helper methods
    async makeRequest(method, path, headers = {}, useAuth = false, data, baseUrl) {
        const url = `${baseUrl || this.config.baseUrl}${path}`;
        if (useAuth) {
            headers['Authorization'] = 'Bearer mock-token-for-testing';
        }
        try {
            const response = await (0, axios_1.default)({
                method: method.toLowerCase(),
                url,
                headers,
                data,
                timeout: this.config.timeout,
                validateStatus: () => true // Don't throw on HTTP error status
            });
            return response;
        }
        catch (error) {
            // Return error response for analysis
            return {
                status: error.response?.status || 500,
                data: error.response?.data || error.message,
                headers: error.response?.headers || {}
            };
        }
    }
    extractSessionCookie(response) {
        const setCookieHeader = response.headers['set-cookie'];
        if (!setCookieHeader)
            return null;
        const sessionCookie = setCookieHeader.find((cookie) => cookie.includes('session') || cookie.includes('connect.sid'));
        return sessionCookie || null;
    }
    addResult(result) {
        this.results.push(result);
    }
    printResults() {
        console.log('\n📊 Penetration Testing Results\n');
        console.log('='.repeat(80));
        const summary = {
            total: this.results.length,
            pass: this.results.filter(r => r.status === 'pass').length,
            fail: this.results.filter(r => r.status === 'fail').length,
            warning: this.results.filter(r => r.status === 'warning').length
        };
        console.log(`\nSummary: ${summary.total} tests run`);
        console.log(`✅ Passed: ${summary.pass}`);
        console.log(`❌ Failed: ${summary.fail}`);
        console.log(`⚠️  Warnings: ${summary.warning}\n`);
        // Group by severity
        const critical = this.results.filter(r => r.severity === 'critical');
        const high = this.results.filter(r => r.severity === 'high');
        const medium = this.results.filter(r => r.severity === 'medium');
        const low = this.results.filter(r => r.severity === 'low');
        if (critical.length > 0) {
            console.log('🚨 CRITICAL ISSUES:');
            critical.forEach(result => {
                console.log(`  ${result.status === 'fail' ? '❌' : '⚠️'} ${result.testName}: ${result.description}`);
            });
            console.log();
        }
        if (high.length > 0) {
            console.log('🔴 HIGH SEVERITY ISSUES:');
            high.forEach(result => {
                console.log(`  ${result.status === 'fail' ? '❌' : '⚠️'} ${result.testName}: ${result.description}`);
            });
            console.log();
        }
        if (medium.length > 0) {
            console.log('🟡 MEDIUM SEVERITY ISSUES:');
            medium.forEach(result => {
                console.log(`  ${result.status === 'fail' ? '❌' : '⚠️'} ${result.testName}: ${result.description}`);
            });
            console.log();
        }
        console.log('='.repeat(80));
        const riskScore = this.calculateRiskScore();
        console.log(`\n🎯 Overall Risk Score: ${riskScore}/100`);
        if (riskScore > 70) {
            console.log('🚨 HIGH RISK - Immediate action required!');
        }
        else if (riskScore > 40) {
            console.log('⚠️  MEDIUM RISK - Address issues promptly');
        }
        else {
            console.log('✅ LOW RISK - Good security posture');
        }
    }
    calculateRiskScore() {
        let score = 0;
        this.results.forEach(result => {
            if (result.status === 'fail') {
                switch (result.severity) {
                    case 'critical':
                        score += 25;
                        break;
                    case 'high':
                        score += 15;
                        break;
                    case 'medium':
                        score += 8;
                        break;
                    case 'low':
                        score += 3;
                        break;
                }
            }
            else if (result.status === 'warning') {
                switch (result.severity) {
                    case 'critical':
                        score += 10;
                        break;
                    case 'high':
                        score += 6;
                        break;
                    case 'medium':
                        score += 3;
                        break;
                    case 'low':
                        score += 1;
                        break;
                }
            }
        });
        return Math.min(score, 100);
    }
}
exports.PenetrationTester = PenetrationTester;
// CLI execution
if (require.main === module) {
    const config = {
        baseUrl: process.env.TARGET_URL || 'https://localhost:3000',
        timeout: 10000,
        maxRetries: 3
    };
    const tester = new PenetrationTester(config);
    tester.runAllTests()
        .then(results => {
        const failedTests = results.filter(r => r.status === 'fail');
        process.exit(failedTests.length > 0 ? 1 : 0);
    })
        .catch(error => {
        console.error('Penetration testing failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=penetration-test.js.map