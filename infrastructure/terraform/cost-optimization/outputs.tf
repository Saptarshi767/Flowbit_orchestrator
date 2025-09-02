# Cost Optimization Outputs

# AWS Budget Outputs
output "aws_budget_name" {
  description = "AWS budget name"
  value       = aws_budgets_budget.monthly.name
}

output "aws_budget_limit" {
  description = "AWS budget limit amount"
  value       = aws_budgets_budget.monthly.limit_amount
}

output "cost_anomaly_detector_arn" {
  description = "Cost anomaly detector ARN"
  value       = aws_ce_anomaly_detector.main.arn
}

output "cost_anomaly_subscription_arn" {
  description = "Cost anomaly subscription ARN"
  value       = aws_ce_anomaly_subscription.main.arn
}

# Auto Scaling Outputs
output "scale_up_policy_arn" {
  description = "Scale up policy ARN"
  value       = aws_autoscaling_policy.scale_up.arn
}

output "scale_down_policy_arn" {
  description = "Scale down policy ARN"
  value       = aws_autoscaling_policy.scale_down.arn
}

output "cpu_high_alarm_arn" {
  description = "High CPU utilization alarm ARN"
  value       = aws_cloudwatch_metric_alarm.cpu_high.arn
}

output "cpu_low_alarm_arn" {
  description = "Low CPU utilization alarm ARN"
  value       = aws_cloudwatch_metric_alarm.cpu_low.arn
}

# Azure Cost Management Outputs
output "azure_budget_id" {
  description = "Azure budget ID"
  value       = azurerm_consumption_budget_resource_group.main.id
}

output "azure_budget_amount" {
  description = "Azure budget amount"
  value       = azurerm_consumption_budget_resource_group.main.amount
}

output "azure_action_group_id" {
  description = "Azure monitor action group ID"
  value       = azurerm_monitor_action_group.cost_optimization.id
}

output "azure_cpu_alert_id" {
  description = "Azure high CPU alert ID"
  value       = azurerm_monitor_metric_alert.high_cpu.id
}

# GCP Cost Management Outputs
output "gcp_budget_name" {
  description = "GCP budget name"
  value       = google_billing_budget.main.display_name
}

output "gcp_budget_amount" {
  description = "GCP budget amount"
  value       = google_billing_budget.main.amount[0].specified_amount[0].units
}

output "gcp_alert_policy_name" {
  description = "GCP monitoring alert policy name"
  value       = google_monitoring_alert_policy.high_cpu.display_name
}

# Resource Optimization Outputs
output "resource_optimizer_function_arn" {
  description = "Resource optimizer Lambda function ARN"
  value       = var.enable_resource_optimization ? aws_lambda_function.resource_optimizer[0].arn : null
}

output "optimization_schedule" {
  description = "Resource optimization schedule"
  value       = var.enable_resource_optimization ? aws_cloudwatch_event_rule.resource_optimization[0].schedule_expression : null
}

# Spot Instance Outputs
output "spot_fleet_request_id" {
  description = "Spot fleet request ID"
  value       = var.enable_spot_instances ? aws_ec2_spot_fleet_request.cost_optimized[0].id : null
}

output "spot_fleet_target_capacity" {
  description = "Spot fleet target capacity"
  value       = var.enable_spot_instances ? aws_ec2_spot_fleet_request.cost_optimized[0].target_capacity : null
}

# Cost Category Outputs
output "cost_category_arn" {
  description = "Cost category ARN"
  value       = aws_ce_cost_category.environment.arn
}

# Compute Optimizer Outputs
output "compute_optimizer_status" {
  description = "Compute Optimizer enrollment status"
  value       = var.enable_resource_optimization ? aws_compute_optimizer_enrollment_status.main[0].status : null
}

# Trusted Advisor Outputs
output "trusted_advisor_slack_channel" {
  description = "Trusted Advisor Slack channel configuration"
  value       = var.enable_trusted_advisor_notifications ? aws_support_app_slack_channel_configuration.cost_optimization[0].channel_name : null
}

# Cost Allocation Outputs
output "cost_allocation_tags_enabled" {
  description = "Whether cost allocation tags are enabled"
  value       = var.enable_cost_allocation_tags
}

output "cost_centers" {
  description = "Configured cost centers"
  value       = var.cost_centers
}

# Monitoring and Alerting Summary
output "cost_monitoring_summary" {
  description = "Summary of cost monitoring configuration"
  value = {
    aws_budgets_configured           = true
    azure_budgets_configured         = true
    gcp_budgets_configured          = true
    cost_anomaly_detection_enabled  = true
    auto_scaling_enabled            = true
    spot_instances_enabled          = var.enable_spot_instances
    resource_optimization_enabled   = var.enable_resource_optimization
    trusted_advisor_enabled         = var.enable_trusted_advisor_notifications
  }
}

# Estimated Savings
output "estimated_monthly_savings" {
  description = "Estimated monthly cost savings"
  value = {
    auto_scaling_savings    = var.enable_resource_optimization ? 200 : 0
    spot_instance_savings   = var.enable_spot_instances ? 300 : 0
    optimization_savings    = var.enable_resource_optimization ? 150 : 0
    total_estimated_savings = (var.enable_resource_optimization ? 200 : 0) + (var.enable_spot_instances ? 300 : 0) + (var.enable_resource_optimization ? 150 : 0)
  }
}

# Budget Thresholds
output "budget_thresholds" {
  description = "Configured budget alert thresholds"
  value = {
    aws_thresholds   = [50, 80, 100]
    azure_thresholds = [50, 80, 100]
    gcp_thresholds   = [50, 80, 100]
  }
}

# Notification Configuration
output "notification_configuration" {
  description = "Cost optimization notification configuration"
  value = {
    email_notifications_enabled = length(var.notification_emails) > 0
    slack_notifications_enabled = var.slack_webhook_url != ""
    notification_email_count     = length(var.notification_emails)
    cost_anomaly_email          = var.cost_anomaly_notification_email != "" ? "configured" : "not_configured"
  }
}

# Resource Tagging Strategy
output "resource_tagging_strategy" {
  description = "Resource tagging strategy for cost allocation"
  value = {
    cost_allocation_enabled = var.enable_cost_allocation_tags
    project_name           = var.project_name
    cost_centers           = var.cost_centers
    environment_tagging    = true
  }
}