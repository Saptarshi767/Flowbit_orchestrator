# GCP Module Variables

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "common_labels" {
  description = "Common labels to apply to all resources"
  type        = map(string)
  default     = {}
}

# Network Variables
variable "gke_subnet_cidr" {
  description = "CIDR block for GKE subnet"
  type        = string
  default     = "10.2.0.0/24"
}

variable "gke_pods_cidr" {
  description = "CIDR block for GKE pods"
  type        = string
  default     = "10.2.1.0/24"
}

variable "gke_services_cidr" {
  description = "CIDR block for GKE services"
  type        = string
  default     = "10.2.2.0/24"
}

variable "gke_master_cidr" {
  description = "CIDR block for GKE master"
  type        = string
  default     = "172.16.0.0/28"
}

variable "database_subnet_cidr" {
  description = "CIDR block for database subnet"
  type        = string
  default     = "10.2.3.0/24"
}

# GKE Variables
variable "node_count" {
  description = "Number of nodes in the GKE node pool"
  type        = number
  default     = 3
}

variable "node_machine_type" {
  description = "Machine type for GKE nodes"
  type        = string
  default     = "e2-standard-2"
}

variable "system_node_count" {
  description = "Number of nodes in the system node pool"
  type        = number
  default     = 2
}

variable "system_node_machine_type" {
  description = "Machine type for system GKE nodes"
  type        = string
  default     = "e2-standard-2"
}

variable "node_disk_size" {
  description = "Disk size in GB for GKE nodes"
  type        = number
  default     = 50
}

variable "min_node_count" {
  description = "Minimum number of nodes in the node pool"
  type        = number
  default     = 1
}

variable "max_node_count" {
  description = "Maximum number of nodes in the node pool"
  type        = number
  default     = 10
}

variable "use_preemptible_nodes" {
  description = "Use preemptible nodes for cost optimization"
  type        = bool
  default     = false
}

# Database Variables
variable "postgresql_version" {
  description = "PostgreSQL version (without POSTGRES_ prefix)"
  type        = string
  default     = "15"
}

variable "database_name" {
  description = "Name of the database"
  type        = string
  default     = "orchestrator"
}

variable "database_username" {
  description = "Database username"
  type        = string
  default     = "orchestrator"
}

variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "database_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "database_disk_size" {
  description = "Database disk size in GB"
  type        = number
  default     = 20
}

variable "database_backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 7
}

# Redis Variables
variable "redis_tier" {
  description = "Redis instance tier"
  type        = string
  default     = "STANDARD_HA"
}

variable "redis_memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "REDIS_7_0"
}

variable "redis_reserved_ip_range" {
  description = "Reserved IP range for Redis"
  type        = string
  default     = "10.2.4.0/29"
}

# Storage Variables
variable "storage_lifecycle_age_days" {
  description = "Number of days after which objects are deleted"
  type        = number
  default     = 365
}

# Cost Optimization Variables
variable "enable_spot_instances" {
  description = "Enable spot instances for cost optimization"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

# Multi-Cloud Specific Variables
variable "enable_cross_cloud_networking" {
  description = "Enable cross-cloud networking features"
  type        = bool
  default     = false
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

variable "monthly_budget_limit" {
  description = "Monthly budget limit in USD"
  type        = number
  default     = 5000
}

variable "budget_notification_emails" {
  description = "List of email addresses for budget notifications"
  type        = list(string)
  default     = []
}

variable "billing_account_id" {
  description = "GCP billing account ID for budget management"
  type        = string
  default     = ""
}

variable "aws_vpn_gateway_ip" {
  description = "AWS VPN Gateway public IP for cross-cloud connectivity"
  type        = string
  default     = ""
}

variable "azure_vpn_gateway_ip" {
  description = "Azure VPN Gateway public IP for cross-cloud connectivity"
  type        = string
  default     = ""
}

variable "cross_cloud_cidr_blocks" {
  description = "CIDR blocks for cross-cloud communication"
  type        = list(string)
  default     = ["10.0.0.0/16", "10.1.0.0/16"]
}