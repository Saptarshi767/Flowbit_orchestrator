# Multi-Cloud Deployment Configuration
# This configuration deploys the AI Orchestrator across AWS, Azure, and GCP

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

# Provider configurations
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
  common_tags = {
    Environment   = var.environment
    Project      = "robust-ai-orchestrator"
    ManagedBy    = "terraform"
    Owner        = var.owner
    CostCenter   = var.cost_center
    DeployedAt   = timestamp()
  }
  
  common_labels = {
    environment = var.environment
    project     = "robust-ai-orchestrator"
    managed-by  = "terraform"
    owner       = var.owner
  }
}

# AWS Infrastructure
module "aws_infrastructure" {
  source = "../../modules/aws"
  
  environment = var.environment
  region      = var.aws_region
  common_tags = local.common_tags
  
  # Multi-cloud specific configurations
  enable_cross_cloud_networking = var.enable_cross_cloud_networking
  enable_disaster_recovery      = var.enable_disaster_recovery
  enable_cost_optimization      = var.enable_cost_optimization
  
  # Cross-cloud connectivity
  azure_vpn_gateway_ip = var.enable_cross_cloud_networking ? module.azure_infrastructure.vpn_gateway_ip : ""
  gcp_vpn_gateway_ip   = var.enable_cross_cloud_networking ? module.gcp_infrastructure.vpn_gateway_ip : ""
  
  # Database configuration
  database_password = var.database_password
  redis_auth_token  = var.redis_auth_token
  
  # Budget configuration
  monthly_budget_limit        = var.aws_monthly_budget_limit
  budget_notification_emails  = var.budget_notification_emails
  cross_region_backup_enabled = var.enable_disaster_recovery
}

# Azure Infrastructure
module "azure_infrastructure" {
  source = "../../modules/azure"
  
  environment = var.environment
  location    = var.azure_location
  common_tags = local.common_tags
  
  # Multi-cloud specific configurations
  enable_cross_cloud_networking = var.enable_cross_cloud_networking
  enable_disaster_recovery      = var.enable_disaster_recovery
  enable_cost_optimization      = var.enable_cost_optimization
  
  # Cross-cloud connectivity
  aws_vpn_gateway_ip = var.enable_cross_cloud_networking ? module.aws_infrastructure.vpn_gateway_ip : ""
  gcp_vpn_gateway_ip = var.enable_cross_cloud_networking ? module.gcp_infrastructure.vpn_gateway_ip : ""
  
  # Database configuration
  database_password = var.database_password
  
  # Budget configuration
  monthly_budget_limit       = var.azure_monthly_budget_limit
  budget_notification_emails = var.budget_notification_emails
}

# GCP Infrastructure
module "gcp_infrastructure" {
  source = "../../modules/gcp"
  
  environment = var.environment
  project_id  = var.gcp_project_id
  region      = var.gcp_region
  common_labels = local.common_labels
  
  # Multi-cloud specific configurations
  enable_cross_cloud_networking = var.enable_cross_cloud_networking
  enable_disaster_recovery      = var.enable_disaster_recovery
  enable_cost_optimization      = var.enable_cost_optimization
  
  # Cross-cloud connectivity
  aws_vpn_gateway_ip   = var.enable_cross_cloud_networking ? module.aws_infrastructure.vpn_gateway_ip : ""
  azure_vpn_gateway_ip = var.enable_cross_cloud_networking ? module.azure_infrastructure.vpn_gateway_ip : ""
  
  # Database configuration
  database_password = var.database_password
  
  # Budget configuration
  billing_account_id         = var.gcp_billing_account_id
  monthly_budget_limit       = var.gcp_monthly_budget_limit
  budget_notification_emails = var.budget_notification_emails
}

# Cross-Cloud Networking and Data Replication
module "cross_cloud_networking" {
  source = "../../cross-cloud"
  
  count = var.enable_cross_cloud_networking ? 1 : 0
  
  environment   = var.environment
  common_tags   = local.common_tags
  common_labels = local.common_labels
  
  # AWS configuration
  aws_vpc_id                = module.aws_infrastructure.vpc_id
  aws_private_subnet_ids    = module.aws_infrastructure.private_subnet_ids
  aws_availability_zones    = module.aws_infrastructure.availability_zones
  aws_dms_security_group_id = module.aws_infrastructure.dms_security_group_id
  
  # Azure configuration
  azure_location            = var.azure_location
  azure_resource_group_name = module.azure_infrastructure.resource_group_name
  azure_gateway_subnet_id   = module.azure_infrastructure.gateway_subnet_id
  azure_vpn_gateway_ip      = module.azure_infrastructure.vpn_gateway_ip
  
  # GCP configuration
  gcp_project_id      = var.gcp_project_id
  gcp_region          = var.gcp_region
  gcp_network_id      = module.gcp_infrastructure.network_id
  gcp_vpn_gateway_ip  = module.gcp_infrastructure.vpn_gateway_ip
  
  # Cross-cloud networking settings
  enable_cross_cloud_networking = var.enable_cross_cloud_networking
  enable_data_replication      = var.enable_data_replication
  enable_disaster_recovery     = var.enable_disaster_recovery
  
  # Database replication settings
  source_database_endpoint = module.aws_infrastructure.database_endpoint
  source_database_port     = 5432
  source_database_name     = "orchestrator"
  source_database_username = "orchestrator"
  source_database_password = var.database_password
  
  target_database_endpoint = module.azure_infrastructure.database_endpoint
  target_database_port     = 5432
  target_database_name     = "orchestrator"
  target_database_username = "orchestrator"
  target_database_password = var.database_password
  
  # S3 cross-region replication
  enable_s3_cross_region_replication = var.enable_s3_cross_region_replication
  source_s3_bucket_id               = module.aws_infrastructure.s3_bucket_id
  source_s3_bucket_arn              = module.aws_infrastructure.s3_bucket_arn
  source_s3_kms_key_arn             = module.aws_infrastructure.s3_kms_key_arn
  target_s3_bucket_arn              = module.aws_infrastructure.s3_backup_bucket_arn
  target_s3_kms_key_arn             = module.aws_infrastructure.s3_backup_kms_key_arn
  
  # Backup and DR settings
  backup_retention_days             = var.backup_retention_days
  cross_region_replication_enabled  = var.enable_disaster_recovery
  cross_region_backup_vault_arn     = module.aws_infrastructure.backup_vault_arn
  aws_backup_kms_key_arn           = module.aws_infrastructure.backup_kms_key_arn
  aws_sns_topic_arn                = module.aws_infrastructure.sns_topic_arn
  
  # Monitoring settings
  enable_cross_cloud_monitoring = var.enable_cross_cloud_monitoring
}

# Cost Optimization
module "cost_optimization" {
  source = "../../cost-optimization"
  
  count = var.enable_cost_optimization ? 1 : 0
  
  environment   = var.environment
  common_tags   = local.common_tags
  common_labels = local.common_labels
  
  # AWS cost optimization
  aws_monthly_budget_limit     = var.aws_monthly_budget_limit
  aws_autoscaling_group_name   = module.aws_infrastructure.autoscaling_group_name
  
  # Azure cost optimization
  azure_resource_group_id      = module.azure_infrastructure.resource_group_id
  azure_resource_group_name    = module.azure_infrastructure.resource_group_name
  azure_monthly_budget_limit   = var.azure_monthly_budget_limit
  azure_aks_cluster_id         = module.azure_infrastructure.aks_cluster_id
  
  # GCP cost optimization
  gcp_project_id               = var.gcp_project_id
  gcp_billing_account_id       = var.gcp_billing_account_id
  gcp_monthly_budget_limit     = var.gcp_monthly_budget_limit
  gcp_cluster_name             = module.gcp_infrastructure.cluster_name
  gcp_notification_channels    = var.gcp_notification_channels
  
  # Common settings
  notification_emails          = var.budget_notification_emails
  cost_anomaly_notification_email = var.cost_anomaly_notification_email
  cost_anomaly_threshold       = var.cost_anomaly_threshold
  
  # Optimization settings
  enable_resource_optimization = var.enable_resource_optimization
  enable_spot_instances        = var.enable_spot_instances
  enable_trusted_advisor_notifications = var.enable_trusted_advisor_notifications
  enable_azure_advisor         = var.enable_azure_advisor
  enable_cost_allocation_tags  = var.enable_cost_allocation_tags
  
  # Auto-scaling thresholds
  cpu_scale_up_threshold       = var.cpu_scale_up_threshold
  cpu_scale_down_threshold     = var.cpu_scale_down_threshold
  
  # Resource optimization
  idle_resource_threshold_days = var.idle_resource_threshold_days
  optimization_schedule        = var.optimization_schedule
  
  # Spot instance configuration
  spot_fleet_target_capacity   = var.spot_fleet_target_capacity
  spot_instance_ami_id         = var.spot_instance_ami_id
  spot_instance_types          = var.spot_instance_types
  key_pair_name                = var.key_pair_name
  security_group_ids           = module.aws_infrastructure.security_group_ids
  private_subnet_ids           = module.aws_infrastructure.private_subnet_ids
  availability_zones           = module.aws_infrastructure.availability_zones
  
  # Slack integration
  slack_webhook_url            = var.slack_webhook_url
  slack_channel_id             = var.slack_channel_id
  slack_channel_name           = var.slack_channel_name
  slack_team_id                = var.slack_team_id
  
  # Cost allocation
  cost_centers                 = var.cost_centers
  project_name                 = "robust-ai-orchestrator"
}

# Data sources for cross-cloud information sharing
data "aws_caller_identity" "current" {}
data "azurerm_client_config" "current" {}