#!/usr/bin/env python3
"""
Generate comprehensive test report from all test artifacts
"""

import json
import os
import sys
import argparse
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET

class TestReportGenerator:
    def __init__(self):
        self.test_results = {
            'unit': {'total': 0, 'passed': 0, 'failed': 0, 'coverage': 0},
            'integration': {'total': 0, 'passed': 0, 'failed': 0},
            'e2e': {'total': 0, 'passed': 0, 'failed': 0},
            'security': {'total': 0, 'passed': 0, 'failed': 0, 'vulnerabilities': []},
            'load': {'scenarios': 0, 'success_rate': 0, 'avg_response_time': 0},
            'chaos': {'experiments': 0, 'successful': 0, 'failed': 0},
            'performance': {'scenarios': 0, 'p95_response_time': 0, 'throughput': 0}
        }
        self.artifacts_dir = Path('.')
        
    def parse_unit_test_results(self):
        """Parse unit test results from coverage reports"""
        coverage_files = list(self.artifacts_dir.glob('**/coverage/coverage-summary.json'))
        
        total_coverage = 0
        coverage_count = 0
        
        for coverage_file in coverage_files:
            try:
                with open(coverage_file) as f:
                    coverage_data = json.load(f)
                    
                total = coverage_data.get('total', {})
                if 'lines' in total:
                    self.test_results['unit']['coverage'] += total['lines'].get('pct', 0)
                    coverage_count += 1
                    
            except Exception as e:
                print(f"Error parsing coverage file {coverage_file}: {e}")
        
        if coverage_count > 0:
            self.test_results['unit']['coverage'] /= coverage_count
        
        # Parse test results from JUnit XML files
        junit_files = list(self.artifacts_dir.glob('**/junit.xml'))
        
        for junit_file in junit_files:
            try:
                tree = ET.parse(junit_file)
                root = tree.getroot()
                
                if root.tag == 'testsuites':
                    for testsuite in root.findall('testsuite'):
                        self._parse_testsuite(testsuite, 'unit')
                elif root.tag == 'testsuite':
                    self._parse_testsuite(root, 'unit')
                    
            except Exception as e:
                print(f"Error parsing JUnit file {junit_file}: {e}")
    
    def parse_integration_test_results(self):
        """Parse integration test results"""
        integration_files = list(self.artifacts_dir.glob('**/integration-test-results.json'))
        
        for result_file in integration_files:
            try:
                with open(result_file) as f:
                    data = json.load(f)
                    
                self.test_results['integration']['total'] += data.get('total', 0)
                self.test_results['integration']['passed'] += data.get('passed', 0)
                self.test_results['integration']['failed'] += data.get('failed', 0)
                
            except Exception as e:
                print(f"Error parsing integration results {result_file}: {e}")
    
    def parse_e2e_test_results(self):
        """Parse E2E test results from Playwright"""
        playwright_files = list(self.artifacts_dir.glob('**/test-results.json'))
        
        for result_file in playwright_files:
            try:
                with open(result_file) as f:
                    data = json.load(f)
                    
                for suite in data.get('suites', []):
                    for spec in suite.get('specs', []):
                        self.test_results['e2e']['total'] += 1
                        
                        if spec.get('ok'):
                            self.test_results['e2e']['passed'] += 1
                        else:
                            self.test_results['e2e']['failed'] += 1
                            
            except Exception as e:
                print(f"Error parsing E2E results {result_file}: {e}")
    
    def parse_security_test_results(self):
        """Parse security test results"""
        security_files = list(self.artifacts_dir.glob('**/security-test-report.json'))
        
        for result_file in security_files:
            try:
                with open(result_file) as f:
                    data = json.load(f)
                    
                summary = data.get('summary', {})
                self.test_results['security']['total'] += summary.get('total', 0)
                self.test_results['security']['passed'] += summary.get('passed', 0)
                self.test_results['security']['failed'] += summary.get('failed', 0)
                
                # Extract vulnerability details
                for result in data.get('results', []):
                    if not result.get('passed'):
                        self.test_results['security']['vulnerabilities'].append({
                            'test': result.get('test'),
                            'details': result.get('details')
                        })
                        
            except Exception as e:
                print(f"Error parsing security results {result_file}: {e}")
        
        # Parse OWASP ZAP results
        zap_files = list(self.artifacts_dir.glob('**/zap-report.json'))
        
        for zap_file in zap_files:
            try:
                with open(zap_file) as f:
                    data = json.load(f)
                    
                for site in data.get('site', []):
                    for alert in site.get('alerts', []):
                        if alert.get('riskcode') in ['3', '2']:  # High or Medium risk
                            self.test_results['security']['vulnerabilities'].append({
                                'test': f"OWASP ZAP - {alert.get('name')}",
                                'details': alert.get('desc', ''),
                                'risk': alert.get('risk'),
                                'confidence': alert.get('confidence')
                            })
                            
            except Exception as e:
                print(f"Error parsing ZAP results {zap_file}: {e}")
    
    def parse_load_test_results(self):
        """Parse load test results from k6"""
        k6_files = list(self.artifacts_dir.glob('**/load-test-results.json'))
        
        for result_file in k6_files:
            try:
                with open(result_file) as f:
                    data = json.load(f)
                    
                metrics = data.get('metrics', {})
                
                # Extract key metrics
                if 'http_req_duration' in metrics:
                    self.test_results['load']['avg_response_time'] = \
                        metrics['http_req_duration']['values'].get('avg', 0)
                
                if 'http_req_failed' in metrics:
                    error_rate = metrics['http_req_failed']['values'].get('rate', 0)
                    self.test_results['load']['success_rate'] = (1 - error_rate) * 100
                
                # Count scenarios
                self.test_results['load']['scenarios'] = len(data.get('scenarios', {}))
                
            except Exception as e:
                print(f"Error parsing load test results {result_file}: {e}")
    
    def parse_chaos_test_results(self):
        """Parse chaos engineering test results"""
        chaos_files = list(self.artifacts_dir.glob('**/chaos-journal.json'))
        
        for result_file in chaos_files:
            try:
                with open(result_file) as f:
                    data = json.load(f)
                    
                for run in data.get('run', []):
                    self.test_results['chaos']['experiments'] += 1
                    
                    if run.get('status') == 'completed':
                        self.test_results['chaos']['successful'] += 1
                    else:
                        self.test_results['chaos']['failed'] += 1
                        
            except Exception as e:
                print(f"Error parsing chaos results {result_file}: {e}")
    
    def parse_performance_test_results(self):
        """Parse performance test results from Artillery"""
        artillery_files = list(self.artifacts_dir.glob('**/performance-results.json'))
        
        for result_file in artillery_files:
            try:
                with open(result_file) as f:
                    data = json.load(f)
                    
                aggregate = data.get('aggregate', {})
                
                if 'latency' in aggregate:
                    self.test_results['performance']['p95_response_time'] = \
                        aggregate['latency'].get('p95', 0)
                
                if 'rps' in aggregate:
                    self.test_results['performance']['throughput'] = \
                        aggregate['rps'].get('mean', 0)
                
                # Count scenarios
                self.test_results['performance']['scenarios'] = \
                    len(data.get('scenarios', []))
                    
            except Exception as e:
                print(f"Error parsing performance results {result_file}: {e}")
    
    def _parse_testsuite(self, testsuite, test_type):
        """Parse a JUnit testsuite element"""
        tests = int(testsuite.get('tests', 0))
        failures = int(testsuite.get('failures', 0))
        errors = int(testsuite.get('errors', 0))
        
        self.test_results[test_type]['total'] += tests
        self.test_results[test_type]['failed'] += failures + errors
        self.test_results[test_type]['passed'] += tests - failures - errors
    
    def calculate_overall_score(self):
        """Calculate overall test health score"""
        scores = []
        
        # Unit test score (40% weight)
        if self.test_results['unit']['total'] > 0:
            unit_pass_rate = self.test_results['unit']['passed'] / self.test_results['unit']['total']
            coverage_score = self.test_results['unit']['coverage'] / 100
            unit_score = (unit_pass_rate * 0.7 + coverage_score * 0.3) * 100
            scores.append(('unit', unit_score, 0.4))
        
        # Integration test score (20% weight)
        if self.test_results['integration']['total'] > 0:
            integration_score = (self.test_results['integration']['passed'] / 
                               self.test_results['integration']['total']) * 100
            scores.append(('integration', integration_score, 0.2))
        
        # E2E test score (20% weight)
        if self.test_results['e2e']['total'] > 0:
            e2e_score = (self.test_results['e2e']['passed'] / 
                        self.test_results['e2e']['total']) * 100
            scores.append(('e2e', e2e_score, 0.2))
        
        # Security test score (10% weight)
        if self.test_results['security']['total'] > 0:
            security_score = (self.test_results['security']['passed'] / 
                            self.test_results['security']['total']) * 100
            scores.append(('security', security_score, 0.1))
        
        # Performance score (10% weight)
        perf_score = min(100, self.test_results['load']['success_rate'])
        if perf_score > 0:
            scores.append(('performance', perf_score, 0.1))
        
        # Calculate weighted average
        if scores:
            total_weight = sum(weight for _, _, weight in scores)
            weighted_sum = sum(score * weight for _, score, weight in scores)
            return weighted_sum / total_weight
        
        return 0
    
    def generate_html_report(self, output_file):
        """Generate comprehensive HTML test report"""
        overall_score = self.calculate_overall_score()
        
        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Orchestrator - Comprehensive Test Report</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }}
        .header h1 {{ margin: 0; font-size: 2.5em; }}
        .header .subtitle {{ opacity: 0.9; margin-top: 10px; }}
        .score-card {{ background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin-top: 20px; }}
        .score-number {{ font-size: 3em; font-weight: bold; }}
        .content {{ padding: 30px; }}
        .test-section {{ margin-bottom: 40px; }}
        .test-section h2 {{ color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }}
        .metrics-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }}
        .metric-card {{ background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }}
        .metric-value {{ font-size: 2em; font-weight: bold; color: #667eea; }}
        .metric-label {{ color: #666; margin-top: 5px; }}
        .status-badge {{ padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; }}
        .status-pass {{ background: #d4edda; color: #155724; }}
        .status-fail {{ background: #f8d7da; color: #721c24; }}
        .status-warning {{ background: #fff3cd; color: #856404; }}
        .vulnerability-list {{ background: #fff3cd; padding: 15px; border-radius: 8px; margin: 10px 0; }}
        .vulnerability-item {{ margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }}
        .chart-container {{ height: 300px; margin: 20px 0; }}
        .footer {{ text-align: center; padding: 20px; color: #666; border-top: 1px solid #eee; }}
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Comprehensive Test Report</h1>
            <div class="subtitle">AI Orchestrator Platform - Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
            <div class="score-card">
                <div>Overall Test Health Score</div>
                <div class="score-number">{overall_score:.1f}%</div>
            </div>
        </div>
        
        <div class="content">
            <!-- Unit Tests Section -->
            <div class="test-section">
                <h2>🔬 Unit Tests</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['unit']['total']}</div>
                        <div class="metric-label">Total Tests</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['unit']['passed']}</div>
                        <div class="metric-label">Passed</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['unit']['failed']}</div>
                        <div class="metric-label">Failed</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['unit']['coverage']:.1f}%</div>
                        <div class="metric-label">Code Coverage</div>
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="unitTestChart"></canvas>
                </div>
            </div>
            
            <!-- Integration Tests Section -->
            <div class="test-section">
                <h2>🔗 Integration Tests</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['integration']['total']}</div>
                        <div class="metric-label">Total Tests</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['integration']['passed']}</div>
                        <div class="metric-label">Passed</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['integration']['failed']}</div>
                        <div class="metric-label">Failed</div>
                    </div>
                </div>
            </div>
            
            <!-- E2E Tests Section -->
            <div class="test-section">
                <h2>🎭 End-to-End Tests</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['e2e']['total']}</div>
                        <div class="metric-label">Total Tests</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['e2e']['passed']}</div>
                        <div class="metric-label">Passed</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['e2e']['failed']}</div>
                        <div class="metric-label">Failed</div>
                    </div>
                </div>
            </div>
            
            <!-- Security Tests Section -->
            <div class="test-section">
                <h2>🔒 Security Tests</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['security']['total']}</div>
                        <div class="metric-label">Total Tests</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['security']['passed']}</div>
                        <div class="metric-label">Passed</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{len(self.test_results['security']['vulnerabilities'])}</div>
                        <div class="metric-label">Vulnerabilities</div>
                    </div>
                </div>
                
                {self._generate_vulnerability_section()}
            </div>
            
            <!-- Load Tests Section -->
            <div class="test-section">
                <h2>⚡ Load Tests</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['load']['scenarios']}</div>
                        <div class="metric-label">Scenarios</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['load']['success_rate']:.1f}%</div>
                        <div class="metric-label">Success Rate</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['load']['avg_response_time']:.0f}ms</div>
                        <div class="metric-label">Avg Response Time</div>
                    </div>
                </div>
            </div>
            
            <!-- Chaos Tests Section -->
            <div class="test-section">
                <h2>🌪️ Chaos Engineering</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['chaos']['experiments']}</div>
                        <div class="metric-label">Experiments</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['chaos']['successful']}</div>
                        <div class="metric-label">Successful</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['chaos']['failed']}</div>
                        <div class="metric-label">Failed</div>
                    </div>
                </div>
            </div>
            
            <!-- Performance Tests Section -->
            <div class="test-section">
                <h2>📊 Performance Tests</h2>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['performance']['scenarios']}</div>
                        <div class="metric-label">Scenarios</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['performance']['p95_response_time']:.0f}ms</div>
                        <div class="metric-label">P95 Response Time</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">{self.test_results['performance']['throughput']:.1f}</div>
                        <div class="metric-label">RPS</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Generated by AI Orchestrator Test Suite | <a href="https://github.com/ai-orchestrator/platform">View on GitHub</a></p>
        </div>
    </div>
    
    <script>
        // Unit test chart
        const unitCtx = document.getElementById('unitTestChart').getContext('2d');
        new Chart(unitCtx, {{
            type: 'doughnut',
            data: {{
                labels: ['Passed', 'Failed'],
                datasets: [{{
                    data: [{self.test_results['unit']['passed']}, {self.test_results['unit']['failed']}],
                    backgroundColor: ['#28a745', '#dc3545']
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    title: {{
                        display: true,
                        text: 'Unit Test Results'
                    }}
                }}
            }}
        }});
    </script>
</body>
</html>
"""
        
        with open(output_file, 'w') as f:
            f.write(html_content)
        
        print(f"Comprehensive test report generated: {output_file}")
    
    def _generate_vulnerability_section(self):
        """Generate HTML for vulnerability section"""
        if not self.test_results['security']['vulnerabilities']:
            return '<div class="status-badge status-pass">No vulnerabilities found</div>'
        
        html = '<div class="vulnerability-list">'
        html += '<h3>⚠️ Security Vulnerabilities Found</h3>'
        
        for vuln in self.test_results['security']['vulnerabilities']:
            html += f'''
            <div class="vulnerability-item">
                <strong>{vuln['test']}</strong><br>
                <span style="color: #666;">{vuln['details']}</span>
            </div>
            '''
        
        html += '</div>'
        return html
    
    def run(self, output_file):
        """Run the complete report generation"""
        print("Parsing test results...")
        
        self.parse_unit_test_results()
        self.parse_integration_test_results()
        self.parse_e2e_test_results()
        self.parse_security_test_results()
        self.parse_load_test_results()
        self.parse_chaos_test_results()
        self.parse_performance_test_results()
        
        print("Generating HTML report...")
        self.generate_html_report(output_file)
        
        # Print summary to console
        overall_score = self.calculate_overall_score()
        print(f"\n=== Test Summary ===")
        print(f"Overall Score: {overall_score:.1f}%")
        print(f"Unit Tests: {self.test_results['unit']['passed']}/{self.test_results['unit']['total']} passed")
        print(f"Integration Tests: {self.test_results['integration']['passed']}/{self.test_results['integration']['total']} passed")
        print(f"E2E Tests: {self.test_results['e2e']['passed']}/{self.test_results['e2e']['total']} passed")
        print(f"Security Tests: {self.test_results['security']['passed']}/{self.test_results['security']['total']} passed")
        print(f"Vulnerabilities: {len(self.test_results['security']['vulnerabilities'])}")

def main():
    parser = argparse.ArgumentParser(description='Generate comprehensive test report')
    parser.add_argument('--output', '-o', default='comprehensive-test-report.html',
                       help='Output HTML file path')
    parser.add_argument('--artifacts-dir', default='.',
                       help='Directory containing test artifacts')
    
    args = parser.parse_args()
    
    generator = TestReportGenerator()
    generator.artifacts_dir = Path(args.artifacts_dir)
    generator.run(args.output)

if __name__ == '__main__':
    main()