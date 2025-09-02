# Development Environment Multi-Cloud Deployment
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Configure providers
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = local.common_tags
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# Local values
locals {
  environment = "dev"
  
  common_tags = {
    Environment = local.environment
    Project     = "ai-orchestrator"
    Owner       = "platform-team"
    CostCenter  = "engineering"
    ManagedBy   = "terraform"
  }
  
  common_labels = {
    environment = local.environment
    project     = "ai-orchestrator"
    owner       = "platform-team"
    cost-center = "engineering"
    managed-by  = "terraform"
  }
}

# AWS Infrastructure
module "aws" {
  source = "../../modules/aws"
  
  environment         = local.environment
  region             = var.aws_region
  availability_zones = var.aws_availability_zones
  
  vpc_cidr              = var.aws_vpc_cidr
  public_subnet_cidrs   = var.aws_public_subnet_cidrs
  private_subnet_cidrs  = var.aws_private_subnet_cidrs
  
  # EKS Configuration
  kubernetes_version    = var.kubernetes_version
  node_instance_types   = var.aws_node_instance_types
  node_desired_size     = var.aws_node_desired_size
  node_max_size        = var.aws_node_max_size
  node_min_size        = var.aws_node_min_size
  node_disk_size       = var.node_disk_size
  
  # Database Configuration
  postgresql_version           = var.postgresql_version
  db_instance_class           = var.aws_db_instance_class
  db_allocated_storage        = var.db_allocated_storage
  db_max_allocated_storage    = var.db_max_allocated_storage
  database_name               = var.database_name
  database_username           = var.database_username
  database_password           = var.database_password
  db_backup_retention_period  = var.db_backup_retention_period
  
  # Redis Configuration
  redis_node_type        = var.aws_redis_node_type
  redis_num_cache_nodes  = var.redis_num_cache_nodes
  redis_auth_token       = var.redis_auth_token
  
  # Cost Optimization
  enable_spot_instances  = var.enable_spot_instances
  auto_scaling_enabled   = var.auto_scaling_enabled
  backup_retention_days  = var.backup_retention_days
  log_retention_days     = var.log_retention_days
  
  common_tags = local.common_tags
}

# Azure Infrastructure
module "azure" {
  source = "../../modules/azure"
  
  environment = local.environment
  location    = var.azure_location
  
  # Network Configuration
  vnet_cidr                      = var.azure_vnet_cidr
  aks_subnet_cidr               = var.azure_aks_subnet_cidr
  database_subnet_cidr          = var.azure_database_subnet_cidr
  private_endpoints_subnet_cidr = var.azure_private_endpoints_subnet_cidr
  
  # AKS Configuration
  kubernetes_version    = var.kubernetes_version
  node_count           = var.azure_node_count
  node_vm_size         = var.azure_node_vm_size
  system_node_vm_size  = var.azure_system_node_vm_size
  system_node_count    = var.azure_system_node_count
  enable_auto_scaling  = var.enable_auto_scaling
  min_node_count       = var.azure_min_node_count
  max_node_count       = var.azure_max_node_count
  node_os_disk_size    = var.node_disk_size
  
  # Database Configuration
  postgresql_version              = var.postgresql_version
  database_name                   = var.database_name
  database_username               = var.database_username
  database_password               = var.database_password
  database_storage_mb             = var.azure_database_storage_mb
  database_sku_name              = var.azure_database_sku_name
  database_backup_retention_days = var.db_backup_retention_period
  
  # Redis Configuration
  redis_capacity = var.azure_redis_capacity
  redis_family   = var.azure_redis_family
  redis_sku_name = var.azure_redis_sku_name
  
  # Storage Configuration
  storage_replication_type = var.azure_storage_replication_type
  blob_retention_days      = var.backup_retention_days
  
  # Monitoring Configuration
  log_retention_days = var.log_retention_days
  
  # Application Gateway Configuration
  app_gateway_sku_name  = var.azure_app_gateway_sku_name
  app_gateway_sku_tier  = var.azure_app_gateway_sku_tier
  app_gateway_capacity  = var.azure_app_gateway_capacity
  
  # Cost Optimization
  enable_spot_instances = var.enable_spot_instances
  backup_retention_days = var.backup_retention_days
  
  common_tags = local.common_tags
}

# GCP Infrastructure
module "gcp" {
  source = "../../modules/gcp"
  
  environment = local.environment
  project_id  = var.gcp_project_id
  region      = var.gcp_region
  
  # Network Configuration
  gke_subnet_cidr     = var.gcp_gke_subnet_cidr
  gke_pods_cidr       = var.gcp_gke_pods_cidr
  gke_services_cidr   = var.gcp_gke_services_cidr
  gke_master_cidr     = var.gcp_gke_master_cidr
  database_subnet_cidr = var.gcp_database_subnet_cidr
  
  # GKE Configuration
  node_count              = var.gcp_node_count
  node_machine_type       = var.gcp_node_machine_type
  system_node_count       = var.gcp_system_node_count
  system_node_machine_type = var.gcp_system_node_machine_type
  node_disk_size          = var.node_disk_size
  min_node_count          = var.gcp_min_node_count
  max_node_count          = var.gcp_max_node_count
  use_preemptible_nodes   = var.enable_spot_instances
  
  # Database Configuration
  postgresql_version              = var.postgresql_version
  database_name                   = var.database_name
  database_username               = var.database_username
  database_password               = var.database_password
  database_tier                   = var.gcp_database_tier
  database_disk_size              = var.gcp_database_disk_size
  database_backup_retention_days  = var.db_backup_retention_period
  
  # Redis Configuration
  redis_tier           = var.gcp_redis_tier
  redis_memory_size_gb = var.gcp_redis_memory_size_gb
  redis_version        = var.gcp_redis_version
  redis_reserved_ip_range = var.gcp_redis_reserved_ip_range
  
  # Storage Configuration
  storage_lifecycle_age_days = var.backup_retention_days
  
  # Cost Optimization
  enable_spot_instances = var.enable_spot_instances
  backup_retention_days = var.backup_retention_days
  
  common_labels = local.common_labels
}

# Cross-Cloud Networking and Data Replication
module "cross_cloud" {
  source = "../../cross-cloud"
  
  environment = local.environment
  
  # Feature flags
  enable_cross_cloud_networking = var.enable_cross_cloud_networking
  enable_data_replication      = var.enable_data_replication
  enable_disaster_recovery     = var.enable_disaster_recovery
  enable_cross_cloud_monitoring = var.enable_cross_cloud_monitoring
  enable_cost_optimization     = var.enable_cost_optimization
  
  # AWS Configuration
  aws_vpc_id                = module.aws.vpc_id
  aws_private_subnet_ids    = module.aws.private_subnet_ids
  aws_availability_zones    = var.aws_availability_zones
  aws_dms_security_group_id = "" # Will be created by AWS module
  aws_backup_kms_key_arn    = module.aws.kms_key_rds_arn
  aws_sns_topic_arn         = "" # Will be created separately
  
  # Azure Configuration
  azure_location            = var.azure_location
  azure_resource_group_name = module.azure.resource_group_name
  azure_gateway_subnet_id   = "" # Will be created by Azure module
  azure_vpn_gateway_ip      = "" # Will be output by Azure module
  
  # GCP Configuration
  gcp_project_id       = var.gcp_project_id
  gcp_region          = var.gcp_region
  gcp_network_id      = module.gcp.network_id
  gcp_vpn_gateway_ip  = "" # Will be output by GCP module
  
  # Data Replication Configuration
  source_database_endpoint  = module.aws.rds_endpoint
  source_database_port     = module.aws.rds_port
  source_database_name     = var.database_name
  source_database_username = var.database_username
  source_database_password = var.database_password
  
  target_database_endpoint  = module.azure.postgresql_server_fqdn
  target_database_port     = 5432
  target_database_name     = var.database_name
  target_database_username = var.database_username
  target_database_password = var.database_password
  
  # S3 Cross-Region Replication
  enable_s3_cross_region_replication = var.enable_s3_cross_region_replication
  source_s3_bucket_id               = module.aws.s3_bucket_id
  source_s3_bucket_arn              = module.aws.s3_bucket_arn
  target_s3_bucket_arn              = "" # Secondary region bucket
  source_s3_kms_key_arn             = module.aws.kms_key_s3_arn
  target_s3_kms_key_arn             = "" # Secondary region KMS key
  
  # Cost Optimization
  monthly_budget_limit         = var.monthly_budget_limit
  budget_notification_emails   = var.budget_notification_emails
  backup_retention_days        = var.backup_retention_days
  cross_region_replication_enabled = var.cross_region_replication_enabled
  
  # Monitoring
  monitoring_notification_endpoints = var.monitoring_notification_endpoints
  alert_thresholds                 = var.alert_thresholds
  
  common_tags   = local.common_tags
  common_labels = local.common_labels
}

# Cost Optimization
module "cost_optimization" {
  source = "../../cost-optimization"
  
  environment = local.environment
  
  # Budget Configuration
  aws_monthly_budget_limit   = var.aws_monthly_budget_limit
  azure_monthly_budget_limit = var.azure_monthly_budget_limit
  gcp_monthly_budget_limit   = var.gcp_monthly_budget_limit
  
  notification_emails              = var.budget_notification_emails
  cost_anomaly_notification_email  = var.cost_anomaly_notification_email
  cost_anomaly_threshold          = var.cost_anomaly_threshold
  
  # Auto Scaling Configuration
  aws_autoscaling_group_name = "" # Will be created by AWS module
  cpu_scale_up_threshold     = var.cpu_scale_up_threshold
  cpu_scale_down_threshold   = var.cpu_scale_down_threshold
  
  # Azure Configuration
  azure_resource_group_id   = module.azure.resource_group_name
  azure_resource_group_name = module.azure.resource_group_name
  azure_aks_cluster_id     = module.azure.aks_cluster_id
  enable_azure_advisor     = var.enable_azure_advisor
  
  # GCP Configuration
  gcp_project_id           = var.gcp_project_id
  gcp_billing_account_id   = var.gcp_billing_account_id
  gcp_cluster_name         = module.gcp.gke_cluster_name
  gcp_notification_channels = var.gcp_notification_channels
  
  # Notification Configuration
  slack_channel_id   = var.slack_channel_id
  slack_channel_name = var.slack_channel_name
  slack_team_id      = var.slack_team_id
  slack_webhook_url  = var.slack_webhook_url
  enable_trusted_advisor_notifications = var.enable_trusted_advisor_notifications
  
  # Cost Allocation
  enable_cost_allocation_tags = var.enable_cost_allocation_tags
  cost_centers               = var.cost_centers
  project_name               = "ai-orchestrator"
  
  # Spot Instances
  enable_spot_instances        = var.enable_spot_instances
  spot_fleet_target_capacity   = var.spot_fleet_target_capacity
  spot_instance_ami_id         = var.spot_instance_ami_id
  spot_instance_types          = var.spot_instance_types
  key_pair_name               = var.key_pair_name
  security_group_ids          = [] # Will be populated from AWS module
  private_subnet_ids          = module.aws.private_subnet_ids
  availability_zones          = var.aws_availability_zones
  
  # Resource Optimization
  enable_resource_optimization     = var.enable_resource_optimization
  optimization_schedule           = var.optimization_schedule
  idle_resource_threshold_days    = var.idle_resource_threshold_days
  
  # Monitoring
  enable_cost_monitoring_dashboard = var.enable_cost_monitoring_dashboard
  dashboard_refresh_interval      = var.dashboard_refresh_interval
  
  # Reserved Instances
  enable_reserved_instance_recommendations = var.enable_reserved_instance_recommendations
  reserved_instance_payment_option        = var.reserved_instance_payment_option
  reserved_instance_term                  = var.reserved_instance_term
  
  common_tags = local.common_tags
}