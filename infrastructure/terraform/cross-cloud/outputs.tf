# Cross-Cloud Outputs

# VPN Connection Outputs
output "aws_vpn_connection_ids" {
  description = "AWS VPN connection IDs"
  value       = var.enable_cross_cloud_networking ? [aws_vpn_connection.aws_to_azure[0].id, aws_vpn_connection.aws_to_gcp[0].id] : []
}

output "aws_vpn_gateway_id" {
  description = "AWS VPN gateway ID"
  value       = var.enable_cross_cloud_networking ? aws_vpn_gateway.aws_to_azure[0].id : null
}

output "azure_vpn_gateway_id" {
  description = "Azure VPN gateway ID"
  value       = var.enable_cross_cloud_networking ? azurerm_virtual_network_gateway.main[0].id : null
}

output "azure_vpn_gateway_ip" {
  description = "Azure VPN gateway public IP"
  value       = var.enable_cross_cloud_networking ? azurerm_public_ip.vpn_gateway[0].ip_address : null
}

output "gcp_vpn_gateway_id" {
  description = "GCP VPN gateway ID"
  value       = var.enable_cross_cloud_networking ? google_compute_vpn_gateway.main[0].id : null
}

output "gcp_vpn_gateway_ip" {
  description = "GCP VPN gateway IP"
  value       = var.enable_cross_cloud_networking ? google_compute_address.vpn_static_ip[0].address : null
}

# Data Replication Outputs
output "dms_replication_instance_arn" {
  description = "DMS replication instance ARN"
  value       = var.enable_data_replication ? aws_dms_replication_instance.main[0].replication_instance_arn : null
}

output "dms_replication_task_arn" {
  description = "DMS replication task ARN"
  value       = var.enable_data_replication ? aws_dms_replication_task.main[0].replication_task_arn : null
}

output "s3_replication_enabled" {
  description = "Whether S3 cross-region replication is enabled"
  value       = var.enable_data_replication && var.enable_s3_cross_region_replication
}

# Disaster Recovery Outputs
output "aws_backup_vault_arn" {
  description = "AWS Backup vault ARN"
  value       = var.enable_disaster_recovery ? aws_backup_vault.main[0].arn : null
}

output "aws_backup_plan_arn" {
  description = "AWS Backup plan ARN"
  value       = var.enable_disaster_recovery ? aws_backup_plan.main[0].arn : null
}

output "azure_recovery_vault_id" {
  description = "Azure Recovery Services vault ID"
  value       = var.enable_disaster_recovery ? azurerm_recovery_services_vault.main[0].id : null
}

output "gcp_backup_policy_id" {
  description = "GCP backup policy ID"
  value       = var.enable_disaster_recovery ? google_compute_resource_policy.backup[0].id : null
}

output "dr_orchestrator_function_arn" {
  description = "Disaster recovery orchestrator Lambda function ARN"
  value       = var.enable_disaster_recovery ? aws_lambda_function.disaster_recovery_orchestrator[0].arn : null
}

# Monitoring and Alerting Outputs
output "backup_failure_alarm_arn" {
  description = "Backup failure CloudWatch alarm ARN"
  value       = var.enable_disaster_recovery ? aws_cloudwatch_metric_alarm.backup_failure[0].arn : null
}

output "rpo_violation_alarm_arn" {
  description = "RPO violation CloudWatch alarm ARN"
  value       = var.enable_disaster_recovery ? aws_cloudwatch_metric_alarm.rpo_violation[0].arn : null
}

output "cross_cloud_connectivity_alarm_arn" {
  description = "Cross-cloud connectivity alarm ARN"
  value       = var.enable_cross_cloud_monitoring ? aws_cloudwatch_metric_alarm.cross_cloud_connectivity[0].arn : null
}

# Cost Optimization Outputs
output "cross_cloud_budget_name" {
  description = "Cross-cloud budget name"
  value       = var.enable_cost_optimization ? aws_budgets_budget.cross_cloud[0].name : null
}

# Network Configuration
output "cross_cloud_cidr_blocks" {
  description = "CIDR blocks for cross-cloud communication"
  value       = var.cross_cloud_cidr_blocks
}

# Automation Outputs
output "dr_testing_schedule" {
  description = "Disaster recovery testing schedule"
  value       = var.enable_disaster_recovery ? aws_cloudwatch_event_rule.dr_testing[0].schedule_expression : null
}

# Connectivity Status
output "vpn_connections_status" {
  description = "Status of VPN connections"
  value = {
    aws_to_azure_enabled = var.enable_cross_cloud_networking
    aws_to_gcp_enabled   = var.enable_cross_cloud_networking
    total_connections    = var.enable_cross_cloud_networking ? 2 : 0
  }
}

# Replication Configuration
output "replication_configuration" {
  description = "Data replication configuration summary"
  value = {
    database_replication_enabled = var.enable_data_replication
    s3_replication_enabled       = var.enable_data_replication && var.enable_s3_cross_region_replication
    cross_region_backup_enabled  = var.cross_region_replication_enabled
  }
}

# Disaster Recovery Metrics
output "disaster_recovery_metrics" {
  description = "Disaster recovery configuration metrics"
  value = {
    backup_retention_days         = var.backup_retention_days
    cross_region_replication     = var.cross_region_replication_enabled
    automation_enabled           = var.enable_disaster_recovery
    monitoring_enabled           = var.enable_cross_cloud_monitoring
  }
}