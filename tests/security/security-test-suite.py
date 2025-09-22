#!/usr/bin/env python3
"""
Comprehensive security testing suite for AI Orchestrator
"""

import asyncio
import aiohttp
import json
import ssl
import subprocess
import sys
import time
import uuid
from typing import Dict, List, Optional
import jwt
import hashlib
import base64

class SecurityTestSuite:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test_result(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        result = {
            'test': test_name,
            'passed': passed,
            'details': details,
            'timestamp': time.time()
        }
        self.test_results.append(result)
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {test_name}: {details}")
    
    async def test_authentication_security(self):
        """Test authentication security measures"""
        print("\n=== Authentication Security Tests ===")
        
        # Test 1: SQL Injection in login
        await self._test_sql_injection_login()
        
        # Test 2: Brute force protection
        await self._test_brute_force_protection()
        
        # Test 3: JWT token security
        await self._test_jwt_security()
        
        # Test 4: Session management
        await self._test_session_security()
    
    async def _test_sql_injection_login(self):
        """Test SQL injection vulnerabilities in login"""
        sql_payloads = [
            "admin'; DROP TABLE users; --",
            "' OR '1'='1",
            "' UNION SELECT * FROM users --",
            "admin'/**/OR/**/1=1#",
            "'; EXEC xp_cmdshell('dir'); --"
        ]
        
        for payload in sql_payloads:
            try:
                async with self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json={"email": payload, "password": "password"}
                ) as response:
                    if response.status == 200:
                        self.log_test_result(
                            "SQL Injection Login", 
                            False, 
                            f"SQL injection succeeded with payload: {payload}"
                        )
                        return
            except Exception:
                pass
        
        self.log_test_result("SQL Injection Login", True, "No SQL injection vulnerabilities found")
    
    async def _test_brute_force_protection(self):
        """Test brute force protection mechanisms"""
        # Attempt multiple failed logins
        failed_attempts = 0
        for i in range(10):
            try:
                async with self.session.post(
                    f"{self.base_url}/api/auth/login",
                    json={"email": "test@example.com", "password": f"wrong_password_{i}"}
                ) as response:
                    if response.status == 401:
                        failed_attempts += 1
                    elif response.status == 429:  # Rate limited
                        self.log_test_result(
                            "Brute Force Protection", 
                            True, 
                            f"Rate limiting activated after {failed_attempts} attempts"
                        )
                        return
            except Exception:
                pass
        
        self.log_test_result(
            "Brute Force Protection", 
            False, 
            f"No rate limiting detected after {failed_attempts} failed attempts"
        )
    
    async def _test_jwt_security(self):
        """Test JWT token security"""
        # Get a valid token first
        async with self.session.post(
            f"{self.base_url}/api/auth/login",
            json={"email": "test@example.com", "password": "password123"}
        ) as response:
            if response.status != 200:
                self.log_test_result("JWT Security", False, "Could not obtain valid token")
                return
            
            data = await response.json()
            token = data.get('token')
            
            if not token:
                self.log_test_result("JWT Security", False, "No token in response")
                return
        
        # Test token manipulation
        try:
            # Decode without verification to inspect structure
            decoded = jwt.decode(token, options={"verify_signature": False})
            
            # Test 1: Modify token payload
            modified_payload = decoded.copy()
            modified_payload['role'] = 'admin'
            modified_token = jwt.encode(modified_payload, 'fake_secret', algorithm='HS256')
            
            async with self.session.get(
                f"{self.base_url}/api/user/profile",
                headers={"Authorization": f"Bearer {modified_token}"}
            ) as response:
                if response.status == 200:
                    self.log_test_result("JWT Security", False, "Modified JWT token accepted")
                    return
            
            # Test 2: None algorithm attack
            none_token = jwt.encode(decoded, '', algorithm='none')
            async with self.session.get(
                f"{self.base_url}/api/user/profile",
                headers={"Authorization": f"Bearer {none_token}"}
            ) as response:
                if response.status == 200:
                    self.log_test_result("JWT Security", False, "None algorithm JWT accepted")
                    return
            
            self.log_test_result("JWT Security", True, "JWT tokens properly validated")
            
        except Exception as e:
            self.log_test_result("JWT Security", False, f"Error testing JWT: {e}")
    
    async def _test_session_security(self):
        """Test session management security"""
        # Test session fixation
        async with self.session.get(f"{self.base_url}/api/auth/session") as response:
            initial_session = response.cookies.get('session_id')
        
        # Login
        async with self.session.post(
            f"{self.base_url}/api/auth/login",
            json={"email": "test@example.com", "password": "password123"}
        ) as response:
            if response.status == 200:
                post_login_session = response.cookies.get('session_id')
                
                if initial_session and initial_session.value == post_login_session.value:
                    self.log_test_result(
                        "Session Security", 
                        False, 
                        "Session ID not regenerated after login"
                    )
                else:
                    self.log_test_result(
                        "Session Security", 
                        True, 
                        "Session ID properly regenerated"
                    )
    
    async def test_api_security(self):
        """Test API security measures"""
        print("\n=== API Security Tests ===")
        
        # Test CORS configuration
        await self._test_cors_configuration()
        
        # Test rate limiting
        await self._test_rate_limiting()
        
        # Test input validation
        await self._test_input_validation()
        
        # Test authorization
        await self._test_authorization()
    
    async def _test_cors_configuration(self):
        """Test CORS configuration"""
        headers = {
            'Origin': 'https://malicious-site.com',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type'
        }
        
        async with self.session.options(
            f"{self.base_url}/api/workflows",
            headers=headers
        ) as response:
            cors_origin = response.headers.get('Access-Control-Allow-Origin')
            
            if cors_origin == '*':
                self.log_test_result(
                    "CORS Configuration", 
                    False, 
                    "Wildcard CORS origin allows any domain"
                )
            elif cors_origin == 'https://malicious-site.com':
                self.log_test_result(
                    "CORS Configuration", 
                    False, 
                    "CORS allows unauthorized origin"
                )
            else:
                self.log_test_result(
                    "CORS Configuration", 
                    True, 
                    "CORS properly configured"
                )
    
    async def _test_rate_limiting(self):
        """Test API rate limiting"""
        # Make rapid requests
        rate_limited = False
        for i in range(100):
            try:
                async with self.session.get(f"{self.base_url}/api/workflows") as response:
                    if response.status == 429:
                        rate_limited = True
                        break
            except Exception:
                pass
        
        self.log_test_result(
            "Rate Limiting", 
            rate_limited, 
            "Rate limiting activated" if rate_limited else "No rate limiting detected"
        )
    
    async def _test_input_validation(self):
        """Test input validation and sanitization"""
        # Test XSS payloads
        xss_payloads = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>",
            "';alert('xss');//"
        ]
        
        for payload in xss_payloads:
            try:
                async with self.session.post(
                    f"{self.base_url}/api/workflows",
                    json={
                        "name": payload,
                        "description": payload,
                        "engine": "langflow"
                    },
                    headers={"Authorization": "Bearer valid_token"}
                ) as response:
                    if response.status == 201:
                        # Check if payload is reflected in response
                        data = await response.json()
                        if payload in str(data):
                            self.log_test_result(
                                "Input Validation", 
                                False, 
                                f"XSS payload reflected: {payload}"
                            )
                            return
            except Exception:
                pass
        
        self.log_test_result("Input Validation", True, "Input properly validated and sanitized")
    
    async def _test_authorization(self):
        """Test authorization controls"""
        # Test accessing admin endpoints without proper role
        admin_endpoints = [
            "/api/admin/users",
            "/api/admin/system/metrics",
            "/api/admin/organizations"
        ]
        
        # Get regular user token
        async with self.session.post(
            f"{self.base_url}/api/auth/login",
            json={"email": "user@example.com", "password": "password123"}
        ) as response:
            if response.status != 200:
                self.log_test_result("Authorization", False, "Could not obtain user token")
                return
            
            data = await response.json()
            user_token = data.get('token')
        
        unauthorized_access = False
        for endpoint in admin_endpoints:
            try:
                async with self.session.get(
                    f"{self.base_url}{endpoint}",
                    headers={"Authorization": f"Bearer {user_token}"}
                ) as response:
                    if response.status == 200:
                        unauthorized_access = True
                        self.log_test_result(
                            "Authorization", 
                            False, 
                            f"Unauthorized access to {endpoint}"
                        )
                        return
            except Exception:
                pass
        
        self.log_test_result("Authorization", True, "Authorization properly enforced")
    
    async def test_data_security(self):
        """Test data security measures"""
        print("\n=== Data Security Tests ===")
        
        # Test data encryption
        await self._test_data_encryption()
        
        # Test data leakage
        await self._test_data_leakage()
        
        # Test file upload security
        await self._test_file_upload_security()
    
    async def _test_data_encryption(self):
        """Test data encryption in transit and at rest"""
        # Test HTTPS enforcement
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.base_url.replace('https://', 'http://'),
                    allow_redirects=False
                ) as response:
                    if response.status in [301, 302, 307, 308]:
                        location = response.headers.get('Location', '')
                        if location.startswith('https://'):
                            self.log_test_result(
                                "HTTPS Enforcement", 
                                True, 
                                "HTTP redirects to HTTPS"
                            )
                        else:
                            self.log_test_result(
                                "HTTPS Enforcement", 
                                False, 
                                "HTTP does not redirect to HTTPS"
                            )
                    else:
                        self.log_test_result(
                            "HTTPS Enforcement", 
                            False, 
                            "HTTP connections allowed"
                        )
        except Exception as e:
            self.log_test_result("HTTPS Enforcement", False, f"Error testing HTTPS: {e}")
    
    async def _test_data_leakage(self):
        """Test for sensitive data leakage"""
        # Test error messages for information disclosure
        async with self.session.get(f"{self.base_url}/api/nonexistent") as response:
            if response.status == 404:
                text = await response.text()
                sensitive_patterns = [
                    'stack trace',
                    'database error',
                    'internal server error',
                    'exception',
                    'debug'
                ]
                
                for pattern in sensitive_patterns:
                    if pattern.lower() in text.lower():
                        self.log_test_result(
                            "Data Leakage", 
                            False, 
                            f"Sensitive information in error: {pattern}"
                        )
                        return
        
        self.log_test_result("Data Leakage", True, "No sensitive data leakage detected")
    
    async def _test_file_upload_security(self):
        """Test file upload security"""
        # Test malicious file upload
        malicious_files = [
            ('test.php', b'<?php system($_GET["cmd"]); ?>'),
            ('test.jsp', b'<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>'),
            ('test.exe', b'MZ\x90\x00'),  # PE header
        ]
        
        for filename, content in malicious_files:
            try:
                data = aiohttp.FormData()
                data.add_field('file', content, filename=filename)
                
                async with self.session.post(
                    f"{self.base_url}/api/workflows/import",
                    data=data
                ) as response:
                    if response.status == 200:
                        self.log_test_result(
                            "File Upload Security", 
                            False, 
                            f"Malicious file accepted: {filename}"
                        )
                        return
            except Exception:
                pass
        
        self.log_test_result("File Upload Security", True, "Malicious files properly rejected")
    
    def run_vulnerability_scan(self):
        """Run automated vulnerability scanning"""
        print("\n=== Vulnerability Scanning ===")
        
        # Run OWASP ZAP scan if available
        try:
            result = subprocess.run([
                'docker', 'run', '--rm',
                'owasp/zap2docker-stable',
                'zap-baseline.py',
                '-t', self.base_url,
                '-J', '/tmp/zap-report.json'
            ], capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0:
                self.log_test_result("OWASP ZAP Scan", True, "Vulnerability scan completed")
            else:
                self.log_test_result("OWASP ZAP Scan", False, f"Scan failed: {result.stderr}")
        except subprocess.TimeoutExpired:
            self.log_test_result("OWASP ZAP Scan", False, "Scan timed out")
        except FileNotFoundError:
            self.log_test_result("OWASP ZAP Scan", False, "Docker or ZAP not available")
    
    def generate_report(self):
        """Generate security test report"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['passed'])
        failed_tests = total_tests - passed_tests
        
        print(f"\n=== Security Test Report ===")
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\nFailed Tests:")
            for result in self.test_results:
                if not result['passed']:
                    print(f"  - {result['test']}: {result['details']}")
        
        # Save detailed report
        report = {
            'summary': {
                'total': total_tests,
                'passed': passed_tests,
                'failed': failed_tests,
                'success_rate': (passed_tests/total_tests)*100
            },
            'results': self.test_results
        }
        
        with open('security-test-report.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\nDetailed report saved to: security-test-report.json")
        return failed_tests == 0

async def main():
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
    
    async with SecurityTestSuite(base_url) as security_tests:
        print(f"Starting security tests against: {base_url}")
        
        # Run all security tests
        await security_tests.test_authentication_security()
        await security_tests.test_api_security()
        await security_tests.test_data_security()
        
        # Run vulnerability scan
        security_tests.run_vulnerability_scan()
        
        # Generate report
        success = security_tests.generate_report()
        
        if not success:
            sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())