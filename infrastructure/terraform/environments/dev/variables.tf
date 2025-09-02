# Development Environment Variables

# AWS Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "aws_availability_zones" {
  description = "AWS availability zones"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

variable "aws_vpc_cidr" {
  description = "AWS VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "aws_public_subnet_cidrs" {
  description = "AWS public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "aws_private_subnet_cidrs" {
  description = "AWS private subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]
}

variable "aws_node_instance_types" {
  description = "AWS EKS node instance types"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
}

variable "aws_node_desired_size" {
  description = "AWS EKS desired number of nodes"
  type        = number
  default     = 2
}

variable "aws_node_max_size" {
  description = "AWS EKS maximum number of nodes"
  type        = number
  default     = 5
}

variable "aws_node_min_size" {
  description = "AWS EKS minimum number of nodes"
  type        = number
  default     = 1
}

variable "aws_db_instance_class" {
  description = "AWS RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "aws_redis_node_type" {
  description = "AWS ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "aws_monthly_budget_limit" {
  description = "AWS monthly budget limit"
  type        = string
  default     = "500"
}

# Azure Variables
variable "azure_location" {
  description = "Azure location"
  type        = string
  default     = "East US"
}

variable "azure_vnet_cidr" {
  description = "Azure VNet CIDR block"
  type        = string
  default     = "10.1.0.0/16"
}

variable "azure_aks_subnet_cidr" {
  description = "Azure AKS subnet CIDR block"
  type        = string
  default     = "10.1.1.0/24"
}

variable "azure_database_subnet_cidr" {
  description = "Azure database subnet CIDR block"
  type        = string
  default     = "10.1.2.0/24"
}

variable "azure_private_endpoints_subnet_cidr" {
  description = "Azure private endpoints subnet CIDR block"
  type        = string
  default     = "10.1.3.0/24"
}

variable "azure_node_count" {
  description = "Azure AKS node count"
  type        = number
  default     = 2
}

variable "azure_node_vm_size" {
  description = "Azure AKS node VM size"
  type        = string
  default     = "Standard_D2s_v3"
}

variable "azure_system_node_vm_size" {
  description = "Azure AKS system node VM size"
  type        = string
  default     = "Standard_D2s_v3"
}

variable "azure_system_node_count" {
  description = "Azure AKS system node count"
  type        = number
  default     = 1
}

variable "azure_min_node_count" {
  description = "Azure AKS minimum node count"
  type        = number
  default     = 1
}

variable "azure_max_node_count" {
  description = "Azure AKS maximum node count"
  type        = number
  default     = 5
}

variable "azure_database_storage_mb" {
  description = "Azure PostgreSQL storage in MB"
  type        = number
  default     = 32768
}

variable "azure_database_sku_name" {
  description = "Azure PostgreSQL SKU name"
  type        = string
  default     = "GP_Standard_D2s_v3"
}

variable "azure_redis_capacity" {
  description = "Azure Redis cache capacity"
  type        = number
  default     = 1
}

variable "azure_redis_family" {
  description = "Azure Redis cache family"
  type        = string
  default     = "C"
}

variable "azure_redis_sku_name" {
  description = "Azure Redis cache SKU name"
  type        = string
  default     = "Standard"
}

variable "azure_storage_replication_type" {
  description = "Azure storage replication type"
  type        = string
  default     = "LRS"
}

variable "azure_app_gateway_sku_name" {
  description = "Azure Application Gateway SKU name"
  type        = string
  default     = "Standard_v2"
}

variable "azure_app_gateway_sku_tier" {
  description = "Azure Application Gateway SKU tier"
  type        = string
  default     = "Standard_v2"
}

variable "azure_app_gateway_capacity" {
  description = "Azure Application Gateway capacity"
  type        = number
  default     = 2
}

variable "azure_monthly_budget_limit" {
  description = "Azure monthly budget limit"
  type        = number
  default     = 500
}

# GCP Variables
variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "gcp_gke_subnet_cidr" {
  description = "GCP GKE subnet CIDR block"
  type        = string
  default     = "10.2.0.0/24"
}

variable "gcp_gke_pods_cidr" {
  description = "GCP GKE pods CIDR block"
  type        = string
  default     = "10.2.1.0/24"
}

variable "gcp_gke_services_cidr" {
  description = "GCP GKE services CIDR block"
  type        = string
  default     = "10.2.2.0/24"
}

variable "gcp_gke_master_cidr" {
  description = "GCP GKE master CIDR block"
  type        = string
  default     = "172.16.0.0/28"
}

variable "gcp_database_subnet_cidr" {
  description = "GCP database subnet CIDR block"
  type        = string
  default     = "10.2.3.0/24"
}

variable "gcp_node_count" {
  description = "GCP GKE node count"
  type        = number
  default     = 2
}

variable "gcp_node_machine_type" {
  description = "GCP GKE node machine type"
  type        = string
  default     = "e2-standard-2"
}

variable "gcp_system_node_count" {
  description = "GCP GKE system node count"
  type        = number
  default     = 1
}

variable "gcp_system_node_machine_type" {
  description = "GCP GKE system node machine type"
  type        = string
  default     = "e2-standard-2"
}

variable "gcp_min_node_count" {
  description = "GCP GKE minimum node count"
  type        = number
  default     = 1
}

variable "gcp_max_node_count" {
  description = "GCP GKE maximum node count"
  type        = number
  default     = 5
}

variable "gcp_database_tier" {
  description = "GCP Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "gcp_database_disk_size" {
  description = "GCP Cloud SQL disk size in GB"
  type        = number
  default     = 20
}

variable "gcp_redis_tier" {
  description = "GCP Redis instance tier"
  type        = string
  default     = "STANDARD_HA"
}

variable "gcp_redis_memory_size_gb" {
  description = "GCP Redis memory size in GB"
  type        = number
  default     = 1
}

variable "gcp_redis_version" {
  description = "GCP Redis version"
  type        = string
  default     = "REDIS_7_0"
}

variable "gcp_redis_reserved_ip_range" {
  description = "GCP Redis reserved IP range"
  type        = string
  default     = "10.2.4.0/29"
}

variable "gcp_monthly_budget_limit" {
  description = "GCP monthly budget limit"
  type        = number
  default     = 500
}

variable "gcp_billing_account_id" {
  description = "GCP billing account ID"
  type        = string
  default     = ""
}

variable "gcp_notification_channels" {
  description = "GCP notification channels"
  type        = list(string)
  default     = []
}

# Common Variables
variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "node_disk_size" {
  description = "Node disk size in GB"
  type        = number
  default     = 50
}

variable "postgresql_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"
}

variable "database_name" {
  description = "Database name"
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

variable "redis_num_cache_nodes" {
  description = "Number of Redis cache nodes"
  type        = number
  default     = 1
}

variable "redis_auth_token" {
  description = "Redis authentication token"
  type        = string
  sensitive   = true
}

variable "db_allocated_storage" {
  description = "Database allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Database maximum allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_backup_retention_period" {
  description = "Database backup retention period in days"
  type        = number
  default     = 7
}

variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 30
}

variable "log_retention_days" {
  description = "Log retention period in days"
  type        = number
  default     = 30
}

# Feature Flags
variable "enable_cross_cloud_networking" {
  description = "Enable cross-cloud networking"
  type        = bool
  default     = false
}

variable "enable_data_replication" {
  description = "Enable data replication"
  type        = bool
  default     = false
}

variable "enable_disaster_recovery" {
  description = "Enable disaster recovery"
  type        = bool
  default     = true
}

variable "enable_cross_cloud_monitoring" {
  description = "Enable cross-cloud monitoring"
  type        = bool
  default     = true
}

variable "enable_cost_optimization" {
  description = "Enable cost optimization"
  type        = bool
  default     = true
}

variable "enable_spot_instances" {
  description = "Enable spot instances"
  type        = bool
  default     = false
}

variable "auto_scaling_enabled" {
  description = "Enable auto scaling"
  type        = bool
  default     = true
}

variable "enable_auto_scaling" {
  description = "Enable auto scaling for AKS"
  type        = bool
  default     = true
}

variable "enable_s3_cross_region_replication" {
  description = "Enable S3 cross-region replication"
  type        = bool
  default     = false
}

variable "cross_region_replication_enabled" {
  description = "Enable cross-region replication"
  type        = bool
  default     = false
}

# Cost Optimization Variables
variable "monthly_budget_limit" {
  description = "Monthly budget limit"
  type        = string
  default     = "1500"
}

variable "budget_notification_emails" {
  description = "Budget notification emails"
  type        = list(string)
  default     = []
}

variable "cost_anomaly_notification_email" {
  description = "Cost anomaly notification email"
  type        = string
  default     = ""
}

variable "cost_anomaly_threshold" {
  description = "Cost anomaly threshold"
  type        = number
  default     = 100
}

variable "cpu_scale_up_threshold" {
  description = "CPU scale up threshold"
  type        = number
  default     = 70
}

variable "cpu_scale_down_threshold" {
  description = "CPU scale down threshold"
  type        = number
  default     = 30
}

variable "enable_azure_advisor" {
  description = "Enable Azure Advisor"
  type        = bool
  default     = true
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

variable "slack_webhook_url" {
  description = "Slack webhook URL"
  type        = string
  default     = ""
}

variable "enable_trusted_advisor_notifications" {
  description = "Enable Trusted Advisor notifications"
  type        = bool
  default     = false
}

variable "enable_cost_allocation_tags" {
  description = "Enable cost allocation tags"
  type        = bool
  default     = true
}

variable "cost_centers" {
  description = "Cost centers"
  type        = list(string)
  default     = ["engineering", "operations"]
}

variable "spot_fleet_target_capacity" {
  description = "Spot fleet target capacity"
  type        = number
  default     = 2
}

variable "spot_instance_ami_id" {
  description = "Spot instance AMI ID"
  type        = string
  default     = ""
}

variable "spot_instance_types" {
  description = "Spot instance types"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
}

variable "key_pair_name" {
  description = "Key pair name"
  type        = string
  default     = ""
}

variable "enable_resource_optimization" {
  description = "Enable resource optimization"
  type        = bool
  default     = true
}

variable "optimization_schedule" {
  description = "Optimization schedule"
  type        = string
  default     = "0 2 * * *"
}

variable "idle_resource_threshold_days" {
  description = "Idle resource threshold in days"
  type        = number
  default     = 7
}

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

variable "enable_reserved_instance_recommendations" {
  description = "Enable reserved instance recommendations"
  type        = bool
  default     = true
}

variable "reserved_instance_payment_option" {
  description = "Reserved instance payment option"
  type        = string
  default     = "Partial Upfront"
}

variable "reserved_instance_term" {
  description = "Reserved instance term in years"
  type        = number
  default     = 1
}

# Monitoring Variables
variable "monitoring_notification_endpoints" {
  description = "Monitoring notification endpoints"
  type        = list(string)
  default     = []
}

variable "alert_thresholds" {
  description = "Alert thresholds"
  type        = map(number)
  default = {
    cpu_utilization    = 80
    memory_utilization = 85
    disk_utilization   = 90
    network_latency    = 100
  }
}