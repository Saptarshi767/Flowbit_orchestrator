# Cross-Cloud Variables

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Feature flags
variable "enable_cross_cloud_networking" {
  description = "Enable cross-cloud networking with VPN connections"
  type        = bool
  default     = false
}

variable "enable_data_replication" {
  description = "Enable cross-cloud data replication"
  type        = bool
  default     = false
}

variable "enable_disaster_recovery" {
  description = "Enable disaster recovery and backup strategies"
  type        = bool
  default     = true
}

variable "enable_cross_cloud_monitoring" {
  description = "Enable cross-cloud monitoring and alerting"
  type        = bool
  default     = true
}

variable "enable_cost_optimization" {
  description = "Enable cost optimization and monitoring"
  type        = bool
  default     = true
}

# AWS Variables
variable "aws_vpc_id" {
  description = "AWS VPC ID"
  type        = string
  default     = ""
}

variable "aws_private_subnet_ids" {
  description = "AWS private subnet IDs"
  type        = list(string)
  default     = []
}

variable "aws_availability_zones" {
  description = "AWS availability zones"
  type        = list(string)
  default     = []
}

variable "aws_dms_security_group_id" {
  description = "AWS DMS security group ID"
  type        = string
  default     = ""
}

variable "aws_backup_kms_key_arn" {
  description = "AWS KMS key ARN for backup encryption"
  type        = string
  default     = ""
}

variable "aws_sns_topic_arn" {
  description = "AWS SNS topic ARN for notifications"
  type        = string
  default     = ""
}

variable "cross_region_backup_vault_arn" {
  description = "Cross-region backup vault ARN"
  type        = string
  default     = ""
}

# Azure Variables
variable "azure_location" {
  description = "Azure location"
  type        = string
  default     = "East US"
}

variable "azure_resource_group_name" {
  description = "Azure resource group name"
  type        = string
  default     = ""
}

variable "azure_gateway_subnet_id" {
  description = "Azure gateway subnet ID"
  type        = string
  default     = ""
}

variable "azure_vpn_gateway_ip" {
  description = "Azure VPN gateway public IP"
  type        = string
  default     = ""
}

# GCP Variables
variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = ""
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "gcp_network_id" {
  description = "GCP network ID"
  type        = string
  default     = ""
}

variable "gcp_vpn_gateway_ip" {
  description = "GCP VPN gateway public IP"
  type        = string
  default     = ""
}

variable "common_labels" {
  description = "Common labels for GCP resources"
  type        = map(string)
  default     = {}
}

# Cost Optimization Variables
variable "monthly_budget_limit" {
  description = "Monthly budget limit in USD"
  type        = string
  default     = "1000"
}

variable "budget_notification_emails" {
  description = "Email addresses for budget notifications"
  type        = list(string)
  default     = []
}

# Networking Variables
variable "cross_cloud_cidr_blocks" {
  description = "CIDR blocks for cross-cloud communication"
  type        = map(string)
  default = {
    aws   = "10.0.0.0/16"
    azure = "10.1.0.0/16"
    gcp   = "10.2.0.0/16"
  }
}

# Backup and Recovery Variables
variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

variable "cross_region_replication_enabled" {
  description = "Enable cross-region replication for disaster recovery"
  type        = bool
  default     = true
}

# Monitoring Variables
variable "monitoring_notification_endpoints" {
  description = "Notification endpoints for monitoring alerts"
  type        = list(string)
  default     = []
}

variable "alert_thresholds" {
  description = "Alert thresholds for various metrics"
  type        = map(number)
  default = {
    cpu_utilization    = 80
    memory_utilization = 85
    disk_utilization   = 90
    network_latency    = 100
  }
}

# Data Replication Variables
variable "source_database_endpoint" {
  description = "Source database endpoint for replication"
  type        = string
  default     = ""
}

variable "source_database_port" {
  description = "Source database port"
  type        = number
  default     = 5432
}

variable "source_database_name" {
  description = "Source database name"
  type        = string
  default     = ""
}

variable "source_database_username" {
  description = "Source database username"
  type        = string
  default     = ""
}

variable "source_database_password" {
  description = "Source database password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "target_database_endpoint" {
  description = "Target database endpoint for replication"
  type        = string
  default     = ""
}

variable "target_database_port" {
  description = "Target database port"
  type        = number
  default     = 5432
}

variable "target_database_name" {
  description = "Target database name"
  type        = string
  default     = ""
}

variable "target_database_username" {
  description = "Target database username"
  type        = string
  default     = ""
}

variable "target_database_password" {
  description = "Target database password"
  type        = string
  sensitive   = true
  default     = ""
}

# S3 Cross-Region Replication Variables
variable "enable_s3_cross_region_replication" {
  description = "Enable S3 cross-region replication"
  type        = bool
  default     = false
}

variable "source_s3_bucket_id" {
  description = "Source S3 bucket ID"
  type        = string
  default     = ""
}

variable "source_s3_bucket_arn" {
  description = "Source S3 bucket ARN"
  type        = string
  default     = ""
}

variable "target_s3_bucket_arn" {
  description = "Target S3 bucket ARN"
  type        = string
  default     = ""
}

variable "source_s3_kms_key_arn" {
  description = "Source S3 KMS key ARN"
  type        = string
  default     = ""
}

variable "target_s3_kms_key_arn" {
  description = "Target S3 KMS key ARN"
  type        = string
  default     = ""
}