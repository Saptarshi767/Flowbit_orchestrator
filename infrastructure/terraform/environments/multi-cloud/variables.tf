# Multi-Cloud Environment Variables

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "owner" {
  description = "Owner of the infrastructure"
  type        = string
  default     = "platform-team"
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
  default     = "engineering"
}

# AWS Configuration
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "aws_monthly_budget_limit" {
  description = "AWS monthly budget limit in USD"
  type        = number
  default     = 5000
}

# Azure Configuration
variable "azure_location" {
  description = "Azure region"
  type        = string
  default     = "East US"
}

variable "azure_monthly_budget_limit" {
  description = "Azure monthly budget limit in USD"
  type        = number
  default     = 5000
}

# GCP Configuration
variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "gcp_billing_account_id" {
  description = "GCP billing account ID"
  type        = string
}

variable "gcp_monthly_budget_limit" {
  description = "GCP monthly budget limit in USD"
  type        = number
  default     = 5000
}

variable "gcp_notification_channels" {
  description = "GCP notification channels for alerts"
  type        = list(string)
  default     = []
}

# Database Configuration
variable "database_password" {
  description = "Database password for all cloud providers"
  type        = string
  sensitive   = true
}

variable "redis_auth_token" {
  description = "Redis authentication token"
  type        = string
  sensitive   = true
}

# Multi-Cloud Feature Flags
variable "enable_cross_cloud_networking" {
  description = "Enable cross-cloud networking features"
  type        = bool
  default     = true
}

variable "enable_data_replication" {
  description = "Enable cross-cloud data replication"
  type        = bool
  default     = true
}

variable "enable_disaster_recovery" {
  description = "Enable disaster recovery features"
  type        = bool
  default     = true
}

variable "enable_cost_optimization" {
  description = "Enable cost optimization features"
  type        = bool
  default     = true
}

variable "enable_cross_cloud_monitoring" {
  description = "Enable cross-cloud monitoring"
  type        = bool
  default     = true
}

variable "enable_s3_cross_region_replication" {
  description = "Enable S3 cross-region replication"
  type        = bool
  default     = true
}

# Budget and Cost Management
variable "budget_notification_emails" {
  description = "List of email addresses for budget notifications"
  type        = list(string)
  default     = []
}

variable "cost_anomaly_notification_email" {
  description = "Email address for cost anomaly notifications"
  type        = string
  default     = ""
}

variable "cost_anomaly_threshold" {
  description = "Cost anomaly threshold in USD"
  type        = number
  default     = 100
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

# Resource Optimization
variable "enable_resource_optimization" {
  description = "Enable automated resource optimization"
  type        = bool
  default     = true
}

variable "enable_spot_instances" {
  description = "Enable spot instances for cost optimization"
  type        = bool
  default     = true
}

variable "enable_trusted_advisor_notifications" {
  description = "Enable AWS Trusted Advisor notifications"
  type        = bool
  default     = true
}

variable "enable_azure_advisor" {
  description = "Enable Azure Advisor recommendations"
  type        = bool
  default     = true
}

variable "enable_cost_allocation_tags" {
  description = "Enable cost allocation tags"
  type        = bool
  default     = true
}

# Auto-scaling Configuration
variable "cpu_scale_up_threshold" {
  description = "CPU threshold for scaling up"
  type        = number
  default     = 70
}

variable "cpu_scale_down_threshold" {
  description = "CPU threshold for scaling down"
  type        = number
  default     = 30
}

# Resource Optimization Settings
variable "idle_resource_threshold_days" {
  description = "Number of days to consider a resource idle"
  type        = number
  default     = 7
}

variable "optimization_schedule" {
  description = "Cron schedule for resource optimization"
  type        = string
  default     = "0 2 * * *"  # Daily at 2 AM
}

# Spot Instance Configuration
variable "spot_fleet_target_capacity" {
  description = "Target capacity for spot fleet"
  type        = number
  default     = 2
}

variable "spot_instance_ami_id" {
  description = "AMI ID for spot instances"
  type        = string
  default     = ""
}

variable "spot_instance_types" {
  description = "Instance types for spot fleet"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
}

variable "key_pair_name" {
  description = "EC2 key pair name"
  type        = string
  default     = ""
}

# Slack Integration
variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "slack_channel_id" {
  description = "Slack channel ID"
  type        = string
  default     = ""
}

variable "slack_channel_name" {
  description = "Slack channel name"
  type        = string
  default     = ""
}

variable "slack_team_id" {
  description = "Slack team ID"
  type        = string
  default     = ""
}

# Cost Allocation
variable "cost_centers" {
  description = "List of cost centers for allocation"
  type        = list(string)
  default     = ["engineering", "operations", "development"]
}