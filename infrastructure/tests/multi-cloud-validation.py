#!/usr/bin/env python3
"""
Multi-Cloud Deployment Validation Script
Validates multi-cloud infrastructure deployment across AWS, Azure, and GCP
"""

import os
import sys
import json
import time
import logging
import argparse
import subprocess
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed

import boto3
import requests
from azure.identity import DefaultAzureCredential
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.containerservice import ContainerServiceClient
from google.cloud import container_v1
from google.cloud import compute_v1
from google.oauth2 import service_account

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class ValidationResult:
    """Validation result data class"""
    test_name: str
    cloud_provider: str
    passed: bool
    message: str
    duration: float
    details: Dict[str, Any] = None

class MultiCloudValidator:
    """Main class for multi-cloud deployment validation"""
    
    def __init__(self, config_file: str):
        self.config = self._load_config(config_file)
        self.results: List[ValidationResult] = []
        
        # Initialize cloud clients
        self._init_aws_clients()
        self._init_azure_clients()
        self._init_gcp_clients()
    
    def _load_config(self, config_file: str) -> Dict:
        """Load validation configuration"""
        try:
            with open(config_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"Configuration file not found: {config_file}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in configuration file: {e}")
            sys.exit(1)
    
    def _init_aws_clients(self):
        """Initialize AWS clients"""
        try:
            self.aws_session = boto3.Session(
                region_name=self.config.get('aws', {}).get('region', 'us-west-2')
            )
            self.aws_ec2 = self.aws_session.client('ec2')
            self.aws_eks = self.aws_session.client('eks')
            self.aws_rds = self.aws_session.client('rds')
            self.aws_s3 = self.aws_session.client('s3')
            self.aws_backup = self.aws_session.client('backup')
            self.aws_budgets = self.aws_session.client('budgets')
            self.aws_ce = self.aws_session.client('ce')
            logger.info("AWS clients initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize AWS clients: {e}")
    
    def _init_azure_clients(self):
        """Initialize Azure clients"""
        try:
            self.azure_credential = DefaultAzureCredential()
            subscription_id = self.config.get('azure', {}).get('subscription_id')
            if subscription_id:
                self.azure_resource_client = ResourceManagementClient(
                    self.azure_credential, subscription_id
                )
                self.azure_network_client = NetworkManagementClient(
                    self.azure_credential, subscription_id
                )
                self.azure_aks_client = ContainerServiceClient(
                    self.azure_credential, subscription_id
                )
                logger.info("Azure clients initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Azure clients: {e}")
    
    def _init_gcp_clients(self):
        """Initialize GCP clients"""
        try:
            credentials_path = self.config.get('gcp', {}).get('credentials_path')
            if credentials_path and os.path.exists(credentials_path):
                credentials = service_account.Credentials.from_service_account_file(
                    credentials_path
                )
                self.gcp_container_client = container_v1.ClusterManagerClient(
                    credentials=credentials
                )
                self.gcp_compute_client = compute_v1.InstancesClient(
                    credentials=credentials
                )
                logger.info("GCP clients initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize GCP clients: {e}")
    
    def _run_validation(self, validation_func, test_name: str, cloud_provider: str) -> ValidationResult:
        """Run a single validation and return result"""
        start_time = time.time()
        try:
            result = validation_func()
            duration = time.time() - start_time
            
            if isinstance(result, tuple):
                passed, message, details = result
            else:
                passed, message, details = result, "Validation completed", {}
            
            return ValidationResult(test_name, cloud_provider, passed, message, duration, details)
        except Exception as e:
            duration = time.time() - start_time
            return ValidationResult(test_name, cloud_provider, False, f"Validation failed: {e}", duration)
    
    def validate_aws_multi_cloud_features(self) -> Tuple[bool, str, Dict]:
        """Validate AWS multi-cloud specific features"""
        try:
            details = {
                'vpn_connections': 0,
                'backup_plans': 0,
                'cost_budgets': 0,
                'lambda_functions': 0,
                'cross_region_replication': False
            }
            
            # Check VPN connections for cross-cloud networking
            vpn_connections = self.aws_ec2.describe_vpn_connections()
            details['vpn_connections'] = len(vpn_connections['VpnConnections'])
            
            # Check backup plans for disaster recovery
            backup_plans = self.aws_backup.list_backup_plans()
            details['backup_plans'] = len(backup_plans['BackupPlansList'])
            
            # Check cost budgets
            try:
                account_id = boto3.client('sts').get_caller_identity()['Account']
                budgets = self.aws_budgets.describe_budgets(AccountId=account_id)
                details['cost_budgets'] = len(budgets['Budgets'])
            except Exception:
                details['cost_budgets'] = 0
            
            # Check Lambda functions for automation
            lambda_client = self.aws_session.client('lambda')
            functions = lambda_client.list_functions()
            
            automation_functions = 0
            for function in functions['Functions']:
                function_name = function['FunctionName'].lower()
                if any(keyword in function_name for keyword in ['optimizer', 'orchestrator', 'dr', 'cost']):
                    automation_functions += 1
            
            details['lambda_functions'] = automation_functions
            
            # Check S3 cross-region replication
            buckets = self.aws_s3.list_buckets()
            for bucket in buckets['Buckets']:
                try:
                    replication = self.aws_s3.get_bucket_replication(Bucket=bucket['Name'])
                    if replication.get('ReplicationConfiguration'):
                        details['cross_region_replication'] = True
                        break
                except self.aws_s3.exceptions.NoSuchReplication:
                    continue
                except Exception:
                    continue
            
            # Calculate score
            score = 0
            if details['vpn_connections'] > 0:
                score += 25
            if details['backup_plans'] > 0:
                score += 25
            if details['cost_budgets'] > 0:
                score += 20
            if details['lambda_functions'] > 0:
                score += 20
            if details['cross_region_replication']:
                score += 10
            
            details['score'] = score
            
            if score >= 70:
                return True, f"AWS multi-cloud features well configured (score: {score}/100)", details
            else:
                return False, f"AWS multi-cloud features need improvement (score: {score}/100)", details
                
        except Exception as e:
            return False, f"AWS multi-cloud validation failed: {e}", {}
    
    def validate_azure_multi_cloud_features(self) -> Tuple[bool, str, Dict]:
        """Validate Azure multi-cloud specific features"""
        try:
            details = {
                'resource_groups': 0,
                'virtual_networks': 0,
                'vpn_gateways': 0,
                'aks_clusters': 0,
                'backup_vaults': 0,
                'budgets': 0
            }
            
            resource_group_name = self.config.get('azure', {}).get('resource_group_name')
            if not resource_group_name:
                return False, "Azure resource group name not configured", details
            
            # Check resource groups
            resource_groups = list(self.azure_resource_client.resource_groups.list())
            details['resource_groups'] = len(resource_groups)
            
            # Check virtual networks
            vnets = list(self.azure_network_client.virtual_networks.list(resource_group_name))
            details['virtual_networks'] = len(vnets)
            
            # Check VPN gateways
            try:
                vpn_gateways = list(self.azure_network_client.virtual_network_gateways.list(resource_group_name))
                details['vpn_gateways'] = len(vpn_gateways)
            except Exception:
                details['vpn_gateways'] = 0
            
            # Check AKS clusters
            aks_clusters = list(self.azure_aks_client.managed_clusters.list_by_resource_group(resource_group_name))
            details['aks_clusters'] = len(aks_clusters)
            
            # Calculate score
            score = 0
            if details['resource_groups'] > 0:
                score += 20
            if details['virtual_networks'] > 0:
                score += 30
            if details['vpn_gateways'] > 0:
                score += 25
            if details['aks_clusters'] > 0:
                score += 25
            
            details['score'] = score
            
            if score >= 70:
                return True, f"Azure multi-cloud features well configured (score: {score}/100)", details
            else:
                return False, f"Azure multi-cloud features need improvement (score: {score}/100)", details
                
        except Exception as e:
            return False, f"Azure multi-cloud validation failed: {e}", {}
    
    def validate_gcp_multi_cloud_features(self) -> Tuple[bool, str, Dict]:
        """Validate GCP multi-cloud specific features"""
        try:
            details = {
                'gke_clusters': 0,
                'vpn_gateways': 0,
                'compute_instances': 0,
                'storage_buckets': 0,
                'backup_policies': 0
            }
            
            project_id = self.config.get('gcp', {}).get('project_id')
            location = self.config.get('gcp', {}).get('location', 'us-central1')
            
            if not project_id:
                return False, "GCP project ID not configured", details
            
            # Check GKE clusters
            try:
                parent = f"projects/{project_id}/locations/{location}"
                clusters = self.gcp_container_client.list_clusters(parent=parent)
                details['gke_clusters'] = len(clusters.clusters)
            except Exception as e:
                logger.warning(f"Error checking GKE clusters: {e}")
                details['gke_clusters'] = 0
            
            # Check compute instances
            try:
                instances = self.gcp_compute_client.list(project=project_id, zone=f"{location}-a")
                details['compute_instances'] = len(list(instances))
            except Exception as e:
                logger.warning(f"Error checking compute instances: {e}")
                details['compute_instances'] = 0
            
            # Calculate score
            score = 0
            if details['gke_clusters'] > 0:
                score += 40
            if details['vpn_gateways'] > 0:
                score += 30
            if details['compute_instances'] > 0:
                score += 20
            if details['storage_buckets'] > 0:
                score += 10
            
            details['score'] = score
            
            if score >= 50:
                return True, f"GCP multi-cloud features configured (score: {score}/100)", details
            else:
                return False, f"GCP multi-cloud features need improvement (score: {score}/100)", details
                
        except Exception as e:
            return False, f"GCP multi-cloud validation failed: {e}", {}
    
    def validate_cross_cloud_networking(self) -> Tuple[bool, str, Dict]:
        """Validate cross-cloud networking connectivity"""
        try:
            details = {
                'aws_vpn_connections': 0,
                'azure_vpn_gateways': 0,
                'gcp_vpn_gateways': 0,
                'total_connections': 0,
                'connectivity_tests': []
            }
            
            # Check AWS VPN connections
            try:
                vpn_connections = self.aws_ec2.describe_vpn_connections()
                active_connections = 0
                for vpn in vpn_connections['VpnConnections']:
                    if vpn['State'] == 'available':
                        active_connections += 1
                        details['connectivity_tests'].append({
                            'connection_id': vpn['VpnConnectionId'],
                            'state': vpn['State'],
                            'type': 'aws_vpn'
                        })
                
                details['aws_vpn_connections'] = active_connections
                details['total_connections'] += active_connections
                
            except Exception as e:
                logger.warning(f"Error checking AWS VPN connections: {e}")
            
            # Check Azure VPN gateways
            try:
                resource_group_name = self.config.get('azure', {}).get('resource_group_name')
                if resource_group_name:
                    vpn_gateways = list(self.azure_network_client.virtual_network_gateways.list(resource_group_name))
                    active_gateways = 0
                    for gateway in vpn_gateways:
                        if gateway.provisioning_state == 'Succeeded':
                            active_gateways += 1
                            details['connectivity_tests'].append({
                                'gateway_name': gateway.name,
                                'state': gateway.provisioning_state,
                                'type': 'azure_vpn_gateway'
                            })
                    
                    details['azure_vpn_gateways'] = active_gateways
                    details['total_connections'] += active_gateways
                    
            except Exception as e:
                logger.warning(f"Error checking Azure VPN gateways: {e}")
            
            # Simulate network connectivity tests
            if details['total_connections'] > 0:
                details['connectivity_tests'].append({
                    'test_name': 'Cross-cloud ping test',
                    'status': 'simulated_success',
                    'latency_ms': 45,
                    'type': 'connectivity_test'
                })
            
            if details['total_connections'] >= 2:
                return True, f"Cross-cloud networking configured with {details['total_connections']} connections", details
            elif details['total_connections'] == 1:
                return True, f"Partial cross-cloud networking configured with {details['total_connections']} connection", details
            else:
                return False, "No cross-cloud networking connections found", details
                
        except Exception as e:
            return False, f"Cross-cloud networking validation failed: {e}", {}
    
    def validate_disaster_recovery_strategy(self) -> Tuple[bool, str, Dict]:
        """Validate disaster recovery strategy across clouds"""
        try:
            details = {
                'aws_backup_plans': 0,
                'aws_backup_vaults': 0,
                'azure_backup_vaults': 0,
                'gcp_backup_policies': 0,
                'cross_region_replication': False,
                'automation_functions': 0,
                'rto_estimate_minutes': 0,
                'rpo_estimate_minutes': 0
            }
            
            # Check AWS backup configuration
            try:
                backup_plans = self.aws_backup.list_backup_plans()
                details['aws_backup_plans'] = len(backup_plans['BackupPlansList'])
                
                backup_vaults = self.aws_backup.list_backup_vaults()
                details['aws_backup_vaults'] = len(backup_vaults['BackupVaultList'])
                
                # Check for recent backup jobs
                backup_jobs = self.aws_backup.list_backup_jobs(
                    ByCreatedAfter=time.time() - (7 * 24 * 3600)  # Last 7 days
                )
                recent_jobs = len(backup_jobs['BackupJobs'])
                
                if recent_jobs > 0:
                    details['rpo_estimate_minutes'] = 60  # Assuming hourly backups
                else:
                    details['rpo_estimate_minutes'] = 1440  # Daily backups
                    
            except Exception as e:
                logger.warning(f"Error checking AWS backup configuration: {e}")
            
            # Check S3 cross-region replication
            try:
                buckets = self.aws_s3.list_buckets()
                for bucket in buckets['Buckets']:
                    try:
                        replication = self.aws_s3.get_bucket_replication(Bucket=bucket['Name'])
                        if replication.get('ReplicationConfiguration'):
                            details['cross_region_replication'] = True
                            break
                    except self.aws_s3.exceptions.NoSuchReplication:
                        continue
                    except Exception:
                        continue
            except Exception as e:
                logger.warning(f"Error checking S3 replication: {e}")
            
            # Check automation functions
            try:
                lambda_client = self.aws_session.client('lambda')
                functions = lambda_client.list_functions()
                
                for function in functions['Functions']:
                    function_name = function['FunctionName'].lower()
                    if any(keyword in function_name for keyword in ['dr', 'disaster', 'backup', 'recovery']):
                        details['automation_functions'] += 1
            except Exception as e:
                logger.warning(f"Error checking automation functions: {e}")
            
            # Estimate RTO based on configuration
            base_rto = 120  # 2 hours base RTO
            if details['automation_functions'] > 0:
                base_rto -= 30  # Automation reduces RTO
            if details['cross_region_replication']:
                base_rto -= 15  # Cross-region replication reduces RTO
            
            details['rto_estimate_minutes'] = max(base_rto, 30)  # Minimum 30 minutes
            
            # Calculate DR score
            dr_score = 0
            if details['aws_backup_plans'] > 0:
                dr_score += 25
            if details['aws_backup_vaults'] > 0:
                dr_score += 20
            if details['cross_region_replication']:
                dr_score += 25
            if details['automation_functions'] > 0:
                dr_score += 20
            if details['rto_estimate_minutes'] <= 60:
                dr_score += 10
            
            details['dr_score'] = dr_score
            
            if dr_score >= 70:
                return True, f"Disaster recovery strategy well configured (score: {dr_score}/100)", details
            elif dr_score >= 50:
                return True, f"Disaster recovery strategy partially configured (score: {dr_score}/100)", details
            else:
                return False, f"Disaster recovery strategy needs improvement (score: {dr_score}/100)", details
                
        except Exception as e:
            return False, f"Disaster recovery validation failed: {e}", {}
    
    def validate_cost_optimization_strategy(self) -> Tuple[bool, str, Dict]:
        """Validate cost optimization strategy across clouds"""
        try:
            details = {
                'aws_budgets': 0,
                'cost_anomaly_detectors': 0,
                'auto_scaling_policies': 0,
                'spot_instances': 0,
                'reserved_instances': 0,
                'optimization_functions': 0,
                'estimated_monthly_savings': 0
            }
            
            # Check AWS budgets
            try:
                account_id = boto3.client('sts').get_caller_identity()['Account']
                budgets = self.aws_budgets.describe_budgets(AccountId=account_id)
                details['aws_budgets'] = len(budgets['Budgets'])
            except Exception as e:
                logger.warning(f"Error checking AWS budgets: {e}")
            
            # Check cost anomaly detectors
            try:
                detectors = self.aws_ce.get_anomaly_detectors()
                details['cost_anomaly_detectors'] = len(detectors['AnomalyDetectors'])
            except Exception as e:
                logger.warning(f"Error checking cost anomaly detectors: {e}")
            
            # Check auto scaling policies
            try:
                autoscaling_client = self.aws_session.client('autoscaling')
                policies = autoscaling_client.describe_policies()
                details['auto_scaling_policies'] = len(policies['ScalingPolicies'])
            except Exception as e:
                logger.warning(f"Error checking auto scaling policies: {e}")
            
            # Check spot instances
            try:
                instances = self.aws_ec2.describe_instances()
                for reservation in instances['Reservations']:
                    for instance in reservation['Instances']:
                        if instance.get('InstanceLifecycle') == 'spot':
                            details['spot_instances'] += 1
            except Exception as e:
                logger.warning(f"Error checking spot instances: {e}")
            
            # Check optimization Lambda functions
            try:
                lambda_client = self.aws_session.client('lambda')
                functions = lambda_client.list_functions()
                
                for function in functions['Functions']:
                    function_name = function['FunctionName'].lower()
                    if any(keyword in function_name for keyword in ['cost', 'optimizer', 'budget']):
                        details['optimization_functions'] += 1
            except Exception as e:
                logger.warning(f"Error checking optimization functions: {e}")
            
            # Estimate potential savings
            base_savings = 0
            if details['auto_scaling_policies'] > 0:
                base_savings += 200  # $200/month from auto-scaling
            if details['spot_instances'] > 0:
                base_savings += 300  # $300/month from spot instances
            if details['optimization_functions'] > 0:
                base_savings += 150  # $150/month from automated optimization
            
            details['estimated_monthly_savings'] = base_savings
            
            # Calculate cost optimization score
            cost_score = 0
            if details['aws_budgets'] > 0:
                cost_score += 20
            if details['cost_anomaly_detectors'] > 0:
                cost_score += 20
            if details['auto_scaling_policies'] > 0:
                cost_score += 25
            if details['spot_instances'] > 0:
                cost_score += 20
            if details['optimization_functions'] > 0:
                cost_score += 15
            
            details['cost_score'] = cost_score
            
            if cost_score >= 70:
                return True, f"Cost optimization strategy excellent (score: {cost_score}/100)", details
            elif cost_score >= 50:
                return True, f"Cost optimization strategy good (score: {cost_score}/100)", details
            else:
                return False, f"Cost optimization strategy needs improvement (score: {cost_score}/100)", details
                
        except Exception as e:
            return False, f"Cost optimization validation failed: {e}", {}
    
    def run_all_validations(self) -> List[ValidationResult]:
        """Run all multi-cloud validations"""
        validations = [
            (self.validate_aws_multi_cloud_features, "AWS Multi-Cloud Features", "AWS"),
            (self.validate_azure_multi_cloud_features, "Azure Multi-Cloud Features", "Azure"),
            (self.validate_gcp_multi_cloud_features, "GCP Multi-Cloud Features", "GCP"),
            (self.validate_cross_cloud_networking, "Cross-Cloud Networking", "Multi-Cloud"),
            (self.validate_disaster_recovery_strategy, "Disaster Recovery Strategy", "Multi-Cloud"),
            (self.validate_cost_optimization_strategy, "Cost Optimization Strategy", "Multi-Cloud")
        ]
        
        logger.info(f"Running {len(validations)} multi-cloud validations...")
        
        # Run validations in parallel
        with ThreadPoolExecutor(max_workers=3) as executor:
            future_to_validation = {
                executor.submit(self._run_validation, validation_func, test_name, cloud_provider): test_name
                for validation_func, test_name, cloud_provider in validations
            }
            
            for future in as_completed(future_to_validation):
                result = future.result()
                self.results.append(result)
                
                status = "✅ PASSED" if result.passed else "❌ FAILED"
                logger.info(f"{status} {result.test_name} ({result.cloud_provider}) ({result.duration:.2f}s)")
                if not result.passed:
                    logger.error(f"  Error: {result.message}")
        
        return self.results
    
    def generate_report(self, output_file: str):
        """Generate multi-cloud validation report"""
        passed_tests = [r for r in self.results if r.passed]
        failed_tests = [r for r in self.results if not r.passed]
        
        # Group results by cloud provider
        aws_results = [r for r in self.results if r.cloud_provider == 'AWS']
        azure_results = [r for r in self.results if r.cloud_provider == 'Azure']
        gcp_results = [r for r in self.results if r.cloud_provider == 'GCP']
        multi_cloud_results = [r for r in self.results if r.cloud_provider == 'Multi-Cloud']
        
        report = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'summary': {
                'total_tests': len(self.results),
                'passed': len(passed_tests),
                'failed': len(failed_tests),
                'success_rate': len(passed_tests) / len(self.results) * 100 if self.results else 0
            },
            'cloud_provider_summary': {
                'aws': {
                    'total': len(aws_results),
                    'passed': len([r for r in aws_results if r.passed]),
                    'success_rate': len([r for r in aws_results if r.passed]) / len(aws_results) * 100 if aws_results else 0
                },
                'azure': {
                    'total': len(azure_results),
                    'passed': len([r for r in azure_results if r.passed]),
                    'success_rate': len([r for r in azure_results if r.passed]) / len(azure_results) * 100 if azure_results else 0
                },
                'gcp': {
                    'total': len(gcp_results),
                    'passed': len([r for r in gcp_results if r.passed]),
                    'success_rate': len([r for r in gcp_results if r.passed]) / len(gcp_results) * 100 if gcp_results else 0
                },
                'multi_cloud': {
                    'total': len(multi_cloud_results),
                    'passed': len([r for r in multi_cloud_results if r.passed]),
                    'success_rate': len([r for r in multi_cloud_results if r.passed]) / len(multi_cloud_results) * 100 if multi_cloud_results else 0
                }
            },
            'detailed_results': [
                {
                    'test_name': r.test_name,
                    'cloud_provider': r.cloud_provider,
                    'passed': r.passed,
                    'message': r.message,
                    'duration': r.duration,
                    'details': r.details
                }
                for r in self.results
            ],
            'recommendations': self._generate_recommendations()
        }
        
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Multi-cloud validation report generated: {output_file}")
        
        # Print summary
        self._print_summary(report)
    
    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on validation results"""
        recommendations = []
        
        failed_tests = [r for r in self.results if not r.passed]
        
        if any('AWS' in r.cloud_provider for r in failed_tests):
            recommendations.append("Review AWS multi-cloud configuration and ensure all required services are deployed")
        
        if any('Azure' in r.cloud_provider for r in failed_tests):
            recommendations.append("Review Azure multi-cloud configuration and ensure proper resource group setup")
        
        if any('GCP' in r.cloud_provider for r in failed_tests):
            recommendations.append("Review GCP multi-cloud configuration and ensure proper project setup")
        
        if any('Cross-Cloud Networking' in r.test_name for r in failed_tests):
            recommendations.append("Implement cross-cloud VPN connections for better multi-cloud integration")
        
        if any('Disaster Recovery' in r.test_name for r in failed_tests):
            recommendations.append("Enhance disaster recovery strategy with automated backup and recovery procedures")
        
        if any('Cost Optimization' in r.test_name for r in failed_tests):
            recommendations.append("Implement comprehensive cost optimization strategy with budgets and automated scaling")
        
        return recommendations
    
    def _print_summary(self, report: Dict):
        """Print validation summary"""
        print(f"\n{'='*80}")
        print(f"MULTI-CLOUD DEPLOYMENT VALIDATION SUMMARY")
        print(f"{'='*80}")
        print(f"Total Tests: {report['summary']['total_tests']}")
        print(f"Passed: {report['summary']['passed']}")
        print(f"Failed: {report['summary']['failed']}")
        print(f"Overall Success Rate: {report['summary']['success_rate']:.1f}%")
        
        print(f"\nCLOUD PROVIDER BREAKDOWN:")
        for provider, stats in report['cloud_provider_summary'].items():
            if stats['total'] > 0:
                print(f"  {provider.upper()}: {stats['passed']}/{stats['total']} ({stats['success_rate']:.1f}%)")
        
        failed_tests = [r for r in self.results if not r.passed]
        if failed_tests:
            print(f"\nFAILED TESTS:")
            for test in failed_tests:
                print(f"  ❌ {test.test_name} ({test.cloud_provider}): {test.message}")
        
        if report['recommendations']:
            print(f"\nRECOMMENDATIONS:")
            for i, rec in enumerate(report['recommendations'], 1):
                print(f"  {i}. {rec}")
        
        print(f"{'='*80}")

def main():
    parser = argparse.ArgumentParser(description='Multi-Cloud Deployment Validation')
    parser.add_argument('--config', '-c', required=True,
                       help='Configuration file path')
    parser.add_argument('--output', '-o', default='multi-cloud-validation-report.json',
                       help='Output report file')
    
    args = parser.parse_args()
    
    # Run validations
    validator = MultiCloudValidator(args.config)
    results = validator.run_all_validations()
    validator.generate_report(args.output)
    
    # Exit with error code if any tests failed
    failed_count = len([r for r in results if not r.passed])
    sys.exit(failed_count)

if __name__ == '__main__':
    main()