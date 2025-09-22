#!/usr/bin/env python3
"""
Penetration Testing Suite for Robust AI Orchestrator
Automated security testing using OWASP testing methodology
"""

import requests
import json
import time
import subprocess
import sys
from urllib.parse import urljoin
from typing import Dict, List, Any

class PenetrationTestSuite:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.results = []
        
    def log_result(self, test_name: str, status: str, details: str = ""):
        """Log test results"""
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": time.time()
        }
        self.results.append(result)
        print(f"[{status}] {test_name}: {details}")
    
    def test_authentication_bypass(self):
        """Test for authentication bypass vulnerabilities"""
        print("\n=== Testing Authentication Bypass ===")
        
        # Test direct access to protected endpoints
        protected_endpoints = [
            "/api/workflows",
            "/api/executions",
            "/api/users/profile",
            "/api/admin/users"
        ]
        
        for endpoint in protected_endpoints:
            try:
                response = self.session.get(urljoin(self.base_url, endpoint))
                if response.status_code == 200:
                    self.log_result(
                        f"Auth Bypass - {endpoint}",
                        "FAIL",
                        f"Endpoint accessible without authentication (Status: {response.status_code})"
                    )
                else:
                    self.log_result(
                        f"Auth Bypass - {endpoint}",
                        "PASS",
                        f"Properly protected (Status: {response.status_code})"
                    )
            except Exception as e:
                self.log_result(
                    f"Auth Bypass - {endpoint}",
                    "ERROR",
                    str(e)
                )
    
    def test_sql_injection(self):
        """Test for SQL injection vulnerabilities"""
        print("\n=== Testing SQL Injection ===")
        
        sql_payloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --",
            "admin'--",
            "' OR 1=1#"
        ]
        
        # Test login endpoint
        for payload in sql_payloads:
            try:
                response = self.session.post(
                    urljoin(self.base_url, "/api/auth/login"),
                    json={
                        "email": payload,
                        "password": "test"
                    }
                )
                
                if response.status_code == 200 or "token" in response.text:
                    self.log_result(
                        "SQL Injection - Login",
                        "FAIL",
                        f"Possible SQL injection with payload: {payload}"
                    )
                else:
                    self.log_result(
                        "SQL Injection - Login",
                        "PASS",
                        f"Payload rejected: {payload}"
                    )
            except Exception as e:
                self.log_result(
                    "SQL Injection - Login",
                    "ERROR",
                    str(e)
                )
    
    def test_xss_vulnerabilities(self):
        """Test for Cross-Site Scripting vulnerabilities"""
        print("\n=== Testing XSS Vulnerabilities ===")
        
        xss_payloads = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert('xss')>",
            "javascript:alert('xss')",
            "<svg onload=alert('xss')>",
            "';alert('xss');//"
        ]
        
        # Test workflow creation endpoint
        auth_token = self.get_test_token()
        if not auth_token:
            self.log_result("XSS Test", "SKIP", "No auth token available")
            return
            
        for payload in xss_payloads:
            try:
                response = self.session.post(
                    urljoin(self.base_url, "/api/workflows"),
                    json={
                        "name": payload,
                        "engineType": "langflow",
                        "definition": {}
                    },
                    headers={"Authorization": f"Bearer {auth_token}"}
                )
                
                if payload in response.text and response.status_code == 201:
                    self.log_result(
                        "XSS - Workflow Name",
                        "FAIL",
                        f"XSS payload not sanitized: {payload}"
                    )
                else:
                    self.log_result(
                        "XSS - Workflow Name",
                        "PASS",
                        f"Payload sanitized: {payload}"
                    )
            except Exception as e:
                self.log_result(
                    "XSS - Workflow Name",
                    "ERROR",
                    str(e)
                )
    
    def test_csrf_protection(self):
        """Test for CSRF protection"""
        print("\n=== Testing CSRF Protection ===")
        
        # Test state-changing operations without CSRF token
        auth_token = self.get_test_token()
        if not auth_token:
            self.log_result("CSRF Test", "SKIP", "No auth token available")
            return
        
        try:
            # Attempt to create workflow without CSRF token
            response = self.session.post(
                urljoin(self.base_url, "/api/workflows"),
                json={
                    "name": "CSRF Test Workflow",
                    "engineType": "langflow",
                    "definition": {}
                },
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            
            if response.status_code == 201:
                self.log_result(
                    "CSRF Protection",
                    "WARN",
                    "State-changing operation succeeded without CSRF token"
                )
            else:
                self.log_result(
                    "CSRF Protection",
                    "PASS",
                    "CSRF protection appears to be in place"
                )
        except Exception as e:
            self.log_result(
                "CSRF Protection",
                "ERROR",
                str(e)
            )
    
    def test_rate_limiting(self):
        """Test rate limiting implementation"""
        print("\n=== Testing Rate Limiting ===")
        
        # Test login rate limiting
        rapid_requests = []
        for i in range(20):
            try:
                response = self.session.post(
                    urljoin(self.base_url, "/api/auth/login"),
                    json={
                        "email": "test@example.com",
                        "password": "wrongpassword"
                    }
                )
                rapid_requests.append(response.status_code)
            except Exception as e:
                rapid_requests.append(0)
        
        rate_limited = any(status == 429 for status in rapid_requests)
        
        if rate_limited:
            self.log_result(
                "Rate Limiting",
                "PASS",
                "Rate limiting is active"
            )
        else:
            self.log_result(
                "Rate Limiting",
                "FAIL",
                "No rate limiting detected"
            )
    
    def test_file_upload_security(self):
        """Test file upload security"""
        print("\n=== Testing File Upload Security ===")
        
        malicious_files = [
            ("malicious.php", b"<?php system($_GET['cmd']); ?>", "application/x-php"),
            ("malicious.jsp", b"<% Runtime.getRuntime().exec(request.getParameter(\"cmd\")); %>", "application/x-jsp"),
            ("malicious.exe", b"MZ\x90\x00", "application/x-executable"),
            ("large_file.txt", b"A" * (10 * 1024 * 1024), "text/plain")  # 10MB file
        ]
        
        auth_token = self.get_test_token()
        if not auth_token:
            self.log_result("File Upload Test", "SKIP", "No auth token available")
            return
        
        for filename, content, content_type in malicious_files:
            try:
                files = {'file': (filename, content, content_type)}
                response = self.session.post(
                    urljoin(self.base_url, "/api/workflows/import"),
                    files=files,
                    headers={"Authorization": f"Bearer {auth_token}"}
                )
                
                if response.status_code == 200:
                    self.log_result(
                        f"File Upload - {filename}",
                        "FAIL",
                        "Malicious file upload accepted"
                    )
                else:
                    self.log_result(
                        f"File Upload - {filename}",
                        "PASS",
                        f"File upload rejected (Status: {response.status_code})"
                    )
            except Exception as e:
                self.log_result(
                    f"File Upload - {filename}",
                    "ERROR",
                    str(e)
                )
    
    def test_information_disclosure(self):
        """Test for information disclosure vulnerabilities"""
        print("\n=== Testing Information Disclosure ===")
        
        # Test error message information leakage
        try:
            response = self.session.get(urljoin(self.base_url, "/api/workflows/invalid-id"))
            
            sensitive_info = ["stack", "query", "database", "password", "secret"]
            leaked_info = [info for info in sensitive_info if info.lower() in response.text.lower()]
            
            if leaked_info:
                self.log_result(
                    "Information Disclosure",
                    "FAIL",
                    f"Sensitive information leaked: {leaked_info}"
                )
            else:
                self.log_result(
                    "Information Disclosure",
                    "PASS",
                    "No sensitive information in error messages"
                )
        except Exception as e:
            self.log_result(
                "Information Disclosure",
                "ERROR",
                str(e)
            )
    
    def get_test_token(self) -> str:
        """Get authentication token for testing"""
        try:
            response = self.session.post(
                urljoin(self.base_url, "/api/auth/login"),
                json={
                    "email": "test@example.com",
                    "password": "testpassword123"
                }
            )
            
            if response.status_code == 200:
                return response.json().get("token", "")
        except:
            pass
        
        return ""
    
    def run_all_tests(self):
        """Run all penetration tests"""
        print("Starting Penetration Testing Suite...")
        print(f"Target: {self.base_url}")
        
        self.test_authentication_bypass()
        self.test_sql_injection()
        self.test_xss_vulnerabilities()
        self.test_csrf_protection()
        self.test_rate_limiting()
        self.test_file_upload_security()
        self.test_information_disclosure()
        
        self.generate_report()
    
    def generate_report(self):
        """Generate test report"""
        print("\n" + "="*50)
        print("PENETRATION TEST REPORT")
        print("="*50)
        
        total_tests = len(self.results)
        passed = len([r for r in self.results if r["status"] == "PASS"])
        failed = len([r for r in self.results if r["status"] == "FAIL"])
        errors = len([r for r in self.results if r["status"] == "ERROR"])
        warnings = len([r for r in self.results if r["status"] == "WARN"])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Errors: {errors}")
        print(f"Warnings: {warnings}")
        
        if failed > 0:
            print("\nFAILED TESTS:")
            for result in self.results:
                if result["status"] == "FAIL":
                    print(f"- {result['test']}: {result['details']}")
        
        # Save detailed report
        with open("penetration_test_report.json", "w") as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\nDetailed report saved to: penetration_test_report.json")

if __name__ == "__main__":
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
    
    suite = PenetrationTestSuite(base_url)
    suite.run_all_tests()