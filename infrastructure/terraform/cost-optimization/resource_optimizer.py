#!/usr/bin/env python3
"""
AWS Resource Optimizer Lambda Function
Automatically optimizes AWS resources for cost efficiency
"""

import js
import json
import boto3
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

class ResourceOptimizer:
    """Main class for resource optimization"""
    
    def __init__(self):
        self.ec2 = boto3.client('ec2')
        self.rds = boto3.client('rds')
        self.cloudwatch = boto3.client('cloudwatch')
        self.ce = boto3.client('ce')
        self.sns = boto3.client('sns')
        
        self.environment = os.environ.get('ENVIRONMENT', 'dev')
        self.idle_threshold_days = int(os.environ.get('IDLE_THRESHOLD_DAYS', '7'))
        
    def get_idle_ec2_instances(self) -> List[Dict[str, Any]]:
        """Identify idle EC2 instances"""
        idle_instances = []
        
        try:
            # Get all running instances
            response = self.ec2.describe_instances(
                Filters=[
                    {'Name': 'instance-state-name', 'Values': ['running']},
                    {'Name': 'tag:Environment', 'Values': [self.environment]}
                ]
            )
            
            for reservation in response['Reservations']:
                for instance in reservation['Instances']:
                    instance_id = instance['InstanceId']
                    
                    # Check CPU utilization over the past week
                    end_time = datetime.utcnow()
                    start_time = end_time - timedelta(days=self.idle_threshold_days)
                    
                    cpu_metrics = self.cloudwatch.get_metric_statistics(
                        Namespace='AWS/EC2',
                        MetricName='CPUUtilization',
                        Dimensions=[
                            {'Name': 'InstanceId', 'Value': instance_id}
                        ],
                        StartTime=start_time,
                        EndTime=end_time,
                        Period=3600,  # 1 hour
                        Statistics=['Average']
                    )
                    
                    if cpu_metrics['Datapoints']:
                        avg_cpu = sum(dp['Average'] for dp in cpu_metrics['Datapoints']) / len(cpu_metrics['Datapoints'])
                        
                        if avg_cpu < 5.0:  # Less than 5% CPU utilization
                            idle_instances.append({
                                'InstanceId': instance_id,
                                'InstanceType': instance['InstanceType'],
                                'LaunchTime': instance['LaunchTime'].isoformat(),
                                'AvgCPU': avg_cpu,
                                'Tags': instance.get('Tags', [])
                            })
            
            logger.info(f"Found {len(idle_instances)} idle EC2 instances")
            return idle_instances
            
        except Exception as e:
            logger.error(f"Error identifying idle EC2 instances: {e}")
            return []
    
    def get_idle_rds_instances(self) -> List[Dict[str, Any]]:
        """Identify idle RDS instances"""
        idle_instances = []
        
        try:
            response = self.rds.describe_db_instances()
            
            for db_instance in response['DBInstances']:
                if db_instance['DBInstanceStatus'] != 'available':
                    continue
                
                db_instance_id = db_instance['DBInstanceIdentifier']
                
                # Check database connections over the past week
                end_time = datetime.utcnow()
                start_time = end_time - timedelta(days=self.idle_threshold_days)
                
                connection_metrics = self.cloudwatch.get_metric_statistics(
                    Namespace='AWS/RDS',
                    MetricName='DatabaseConnections',
                    Dimensions=[
                        {'Name': 'DBInstanceIdentifier', 'Value': db_instance_id}
                    ],
                    StartTime=start_time,
                    EndTime=end_time,
                    Period=3600,  # 1 hour
                    Statistics=['Average']
                )
                
                if connection_metrics['Datapoints']:
                    avg_connections = sum(dp['Average'] for dp in connection_metrics['Datapoints']) / len(connection_metrics['Datapoints'])
                    
                    if avg_connections < 1.0:  # Less than 1 average connection
                        idle_instances.append({
                            'DBInstanceIdentifier': db_instance_id,
                            'DBInstanceClass': db_instance['DBInstanceClass'],
                            'Engine': db_instance['Engine'],
                            'AvgConnections': avg_connections,
                            'InstanceCreateTime': db_instance['InstanceCreateTime'].isoformat()
                        })
            
            logger.info(f"Found {len(idle_instances)} idle RDS instances")
            return idle_instances
            
        except Exception as e:
            logger.error(f"Error identifying idle RDS instances: {e}")
            return []
    
    def get_cost_recommendations(self) -> Dict[str, Any]:
        """Get cost optimization recommendations"""
        try:
            # Get Reserved Instance recommendations
            ri_recommendations = self.ce.get_reservation_purchase_recommendation(
                Service='Amazon Elastic Compute Cloud - Compute',
                PaymentOption='PARTIAL_UPFRONT',
                TermInYears='ONE_YEAR'
            )
            
            # Get Savings Plans recommendations
            sp_recommendations = self.ce.get_savings_plans_purchase_recommendation(
                SavingsPlansType='COMPUTE_SP',
                TermInYears='ONE_YEAR',
                PaymentOption='PARTIAL_UPFRONT'
            )
            
            return {
                'reserved_instances': ri_recommendations.get('Recommendations', []),
                'savings_plans': sp_recommendations.get('Recommendations', [])
            }
            
        except Exception as e:
            logger.error(f"Error getting cost recommendations: {e}")
            return {}
    
    def generate_optimization_report(self, idle_ec2: List[Dict], idle_rds: List[Dict], 
                                   cost_recommendations: Dict) -> Dict[str, Any]:
        """Generate optimization report"""
        
        # Calculate potential savings
        ec2_savings = 0
        for instance in idle_ec2:
            # Rough estimate: $0.10 per hour for t3.medium
            instance_type = instance['InstanceType']
            if 'micro' in instance_type:
                hourly_cost = 0.0116
            elif 'small' in instance_type:
                hourly_cost = 0.0232
            elif 'medium' in instance_type:
                hourly_cost = 0.0464
            elif 'large' in instance_type:
                hourly_cost = 0.0928
            else:
                hourly_cost = 0.10  # Default estimate
            
            ec2_savings += hourly_cost * 24 * 30  # Monthly savings
        
        rds_savings = 0
        for instance in idle_rds:
            # Rough estimate based on instance class
            instance_class = instance['DBInstanceClass']
            if 'micro' in instance_class:
                hourly_cost = 0.017
            elif 'small' in instance_class:
                hourly_cost = 0.034
            elif 'medium' in instance_class:
                hourly_cost = 0.068
            else:
                hourly_cost = 0.10  # Default estimate
            
            rds_savings += hourly_cost * 24 * 30  # Monthly savings
        
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'environment': self.environment,
            'idle_resources': {
                'ec2_instances': len(idle_ec2),
                'rds_instances': len(idle_rds)
            },
            'potential_monthly_savings': {
                'ec2': round(ec2_savings, 2),
                'rds': round(rds_savings, 2),
                'total': round(ec2_savings + rds_savings, 2)
            },
            'recommendations': {
                'idle_ec2_instances': idle_ec2,
                'idle_rds_instances': idle_rds,
                'cost_optimization': cost_recommendations
            }
        }
        
        return report
    
    def send_notification(self, report: Dict[str, Any]):
        """Send optimization report notification"""
        try:
            topic_arn = os.environ.get('SNS_TOPIC_ARN')
            if not topic_arn:
                logger.warning("SNS_TOPIC_ARN not configured, skipping notification")
                return
            
            message = f"""
AWS Resource Optimization Report - {self.environment.upper()}

Summary:
- Idle EC2 Instances: {report['idle_resources']['ec2_instances']}
- Idle RDS Instances: {report['idle_resources']['rds_instances']}
- Potential Monthly Savings: ${report['potential_monthly_savings']['total']}

Recommendations:
1. Review and potentially terminate idle EC2 instances
2. Consider stopping or downsizing idle RDS instances
3. Evaluate Reserved Instance and Savings Plans opportunities

Full report attached as JSON.
            """
            
            self.sns.publish(
                TopicArn=topic_arn,
                Subject=f"Cost Optimization Report - {self.environment}",
                Message=message
            )
            
            logger.info("Optimization report notification sent")
            
        except Exception as e:
            logger.error(f"Error sending notification: {e}")

def lambda_handler(event, context):
    """Lambda function entry point"""
    
    try:
        optimizer = ResourceOptimizer()
        
        # Identify idle resources
        idle_ec2 = optimizer.get_idle_ec2_instances()
        idle_rds = optimizer.get_idle_rds_instances()
        
        # Get cost recommendations
        cost_recommendations = optimizer.get_cost_recommendations()
        
        # Generate report
        report = optimizer.generate_optimization_report(
            idle_ec2, idle_rds, cost_recommendations
        )
        
        # Send notification
        optimizer.send_notification(report)
        
        logger.info(f"Resource optimization completed successfully")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Resource optimization completed',
                'report': report
            })
        }
        
    except Exception as e:
        logger.error(f"Resource optimization failed: {e}")
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'Resource optimization failed',
                'error': str(e)
            })
        }

if __name__ == '__main__':
    # For local testing
    lambda_handler({}, {})