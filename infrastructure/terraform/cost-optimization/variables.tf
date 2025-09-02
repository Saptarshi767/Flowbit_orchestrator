# Cost Optimization Variables

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Budget Variables
variable "aws_monthly_budget_limit" {
  description = "AWS monthly budget limit in USD"
  type        = string
  default     = "1000"
}

variable "azure_monthly_budget_limit" {
  description = "Azure monthly budget limit in USD"
  type        = number
  default     = 1000
}

variable "gcp_monthly_budget_limit" {
  description = "GCP monthly budget limit in USD"
  type        = number
  default     = 1000
}

variable "notification_emails" {
  description = "Email addresses for budget notifications"
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

# Auto Scaling Variables
variable "aws_autoscaling_group_name" {
  description = "AWS Auto Scaling Group name"
  type        = string
  default     = ""
}

variable "cpu_scale_up_threshold" {
  description = "CPU utilization threshold for scaling up"
  type        = number
  default     = 70
}

variable "cpu_scale_down_threshold" {
  description = "CPU utilization threshold for scaling down"
  type        = number
  default     = 30
}

# Azure Variables
variable "azure_resource_group_id" {
  description = "Azure resource group ID"
  type        = string
  default     = ""
}

variable "azure_resource_group_name" {
  description = "Azure resource group name"
  type        = string
  default     = ""
}

variable "azure_aks_cluster_id" {
  description = "Azure AKS cluster ID"
  type        = string
  default     = ""
}

variable "enable_azure_advisor" {
  description = "Enable Azure Advisor recommendations"
  type        = bool
  default     = true
}

# GCP Variables
variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = ""
}

variable "gcp_billing_account_id" {
  description = "GCP billing account ID"
  type        = string
  default     = ""
}

variable "gcp_cluster_name" {
  description = "GCP GKE cluster name"
  type        = string
  default     = ""
}

variable "gcp_notification_channels" {
  description = "GCP notification channels for alerts"
  type        = list(string)
  default     = []
}

# Notification Variables
variable "slack_channel_id" {
  description = "Slack channel ID for notifications"
  type        = string
  default     = ""
}

variable "slack_channel_name" {
  description = "Slack channel name for notifications"
  type        = string
  default     = ""
}

variable "slack_team_id" {
  description = "Slack team ID"
  type        = string
  default     = ""
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
}

variable "enable_trusted_advisor_notifications" {
  description = "Enable AWS Trusted Advisor notifications"
  type        = bool
  default     = false
}

# Cost Allocation Variables
variable "enable_cost_allocation_tags" {
  description = "Enable cost allocation tags"
  type        = bool
  default     = true
}

variable "cost_centers" {
  description = "List of cost centers for tagging"
  type        = list(string)
  default     = ["engineering", "operations", "marketing"]
}

variable "project_name" {
  description = "Project name for cost allocation"
  type        = string
  default     = "ai-orchestrator"
}

# Spot Instance Variables
variable "enable_spot_instances" {
  description = "Enable spot instances for cost optimization"
  type        = bool
  default     = false
}

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
  description = "Key pair name for EC2 instances"
  type        = string
  default     = ""
}

variable "security_group_ids" {
  description = "Security group IDs for instances"
  type        = list(string)
  default     = []
}

variable "private_subnet_ids" {
  description = "Private subnet IDs"
  type        = list(string)
  default     = []
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = []
}

# Resource Optimization Variables
variable "enable_resource_optimization" {
  description = "Enable automated resource optimization"
  type        = bool
  default     = true
}

variable "optimization_schedule" {
  description = "Cron schedule for resource optimization"
  type        = string
  default     = "0 2 * * *"  # Daily at 2 AM
}

variable "idle_resource_threshold_days" {
  description = "Number of days to consider a resource idle"
  type        = number
  default     = 7
}

# Monitoring Variables
variable "enable_cost_monitoring_dashboard" {
  description = "Enable cost monitoring dashboard"
  type        = bool
  default     = true
}

variable "dashboard_refresh_interval" {
  description = "Dashboard refresh interval in minutes"
  type        = number
  default     = 15
}

# Reserved Instance Variables
variable "enable_reserved_instance_recommendations" {
  description = "Enable reserved instance recommendations"
  type        = bool
  default     = true
}

variable "reserved_instance_payment_option" {
  description = "Payment option for reserved instances"
  type        = string
  default     = "Partial Upfront"
  validation {
    condition = contains(["No Upfront", "Partial Upfront", "All Upfront"], var.reserved_instance_payment_option)
    error_message = "Payment option must be one of: No Upfront, Partial Upfront, All Upfront."
  }
}

variable "reserved_instance_term" {
  description = "Term for reserved instances in years"
  type        = number
  default     = 1
  validation {
    condition = contains([1, 3], var.reserved_instance_term)
    error_message = "Reserved instance term must be 1 or 3 years."
  }
}