# Azure Module Variables

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "East US"
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Network Variables
variable "vnet_cidr" {
  description = "CIDR block for VNet"
  type        = string
  default     = "10.1.0.0/16"
}

variable "aks_subnet_cidr" {
  description = "CIDR block for AKS subnet"
  type        = string
  default     = "10.1.1.0/24"
}

variable "database_subnet_cidr" {
  description = "CIDR block for database subnet"
  type        = string
  default     = "10.1.2.0/24"
}

variable "private_endpoints_subnet_cidr" {
  description = "CIDR block for private endpoints subnet"
  type        = string
  default     = "10.1.3.0/24"
}

# AKS Variables
variable "kubernetes_version" {
  description = "Kubernetes version for AKS cluster"
  type        = string
  default     = "1.28.3"
}

variable "node_count" {
  description = "Number of nodes in the default node pool"
  type        = number
  default     = 3
}

variable "node_vm_size" {
  description = "VM size for AKS nodes"
  type        = string
  default     = "Standard_D2s_v3"
}

variable "system_node_vm_size" {
  description = "VM size for system node pool"
  type        = string
  default     = "Standard_D2s_v3"
}

variable "system_node_count" {
  description = "Number of nodes in the system node pool"
  type        = number
  default     = 2
}

variable "enable_auto_scaling" {
  description = "Enable auto scaling for the default node pool"
  type        = bool
  default     = true
}

variable "min_node_count" {
  description = "Minimum number of nodes when auto scaling is enabled"
  type        = number
  default     = 1
}

variable "max_node_count" {
  description = "Maximum number of nodes when auto scaling is enabled"
  type        = number
  default     = 10
}

variable "node_os_disk_size" {
  description = "OS disk size in GB for AKS nodes"
  type        = number
  default     = 50
}

# Database Variables
variable "postgresql_version" {
  description = "PostgreSQL version"
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

variable "database_storage_mb" {
  description = "Storage size in MB for PostgreSQL"
  type        = number
  default     = 32768
}

variable "database_sku_name" {
  description = "SKU name for PostgreSQL"
  type        = string
  default     = "GP_Standard_D2s_v3"
}

variable "database_backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

# Redis Variables
variable "redis_capacity" {
  description = "Redis cache capacity"
  type        = number
  default     = 1
}

variable "redis_family" {
  description = "Redis cache family"
  type        = string
  default     = "C"
}

variable "redis_sku_name" {
  description = "Redis cache SKU name"
  type        = string
  default     = "Standard"
}

# Storage Variables
variable "storage_replication_type" {
  description = "Storage account replication type"
  type        = string
  default     = "LRS"
}

variable "blob_retention_days" {
  description = "Blob retention period in days"
  type        = number
  default     = 30
}

# Monitoring Variables
variable "log_retention_days" {
  description = "Log Analytics workspace retention in days"
  type        = number
  default     = 30
}

# Application Gateway Variables
variable "app_gateway_sku_name" {
  description = "Application Gateway SKU name"
  type        = string
  default     = "Standard_v2"
}

variable "app_gateway_sku_tier" {
  description = "Application Gateway SKU tier"
  type        = string
  default     = "Standard_v2"
}

variable "app_gateway_capacity" {
  description = "Application Gateway capacity"
  type        = number
  default     = 2
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

variable "aws_vpn_gateway_ip" {
  description = "AWS VPN Gateway public IP for cross-cloud connectivity"
  type        = string
  default     = ""
}

variable "gcp_vpn_gateway_ip" {
  description = "GCP VPN Gateway public IP for cross-cloud connectivity"
  type        = string
  default     = ""
}

variable "cross_cloud_cidr_blocks" {
  description = "CIDR blocks for cross-cloud communication"
  type        = list(string)
  default     = ["10.0.0.0/16", "10.2.0.0/16"]
}

variable "gateway_subnet_cidr" {
  description = "CIDR block for VPN gateway subnet"
  type        = string
  default     = "10.1.255.0/27"
}