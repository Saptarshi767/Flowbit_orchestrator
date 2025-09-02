# Development Environment Outputs

# AWS Outputs
output "aws_vpc_id" {
  description = "AWS VPC ID"
  value       = module.aws.vpc_id
}

output "aws_eks_cluster_endpoint" {
  description = "AWS EKS cluster endpoint"
  value       = module.aws.eks_cluster_endpoint
}

output "aws_eks_cluster_name" {
  description = "AWS EKS cluster name"
  value       = module.aws.eks_cluster_id
}

output "aws_rds_endpoint" {
  description = "AWS RDS endpoint"
  value       = module.aws.rds_endpoint
}

output "aws_redis_endpoint" {
  description = "AWS Redis endpoint"
  value       = module.aws.redis_endpoint
}

output "aws_s3_bucket_name" {
  description = "AWS S3 bucket name"
  value       = module.aws.s3_bucket_id
}

# Azure Outputs
output "azure_resource_group_name" {
  description = "Azure resource group name"
  value       = module.azure.resource_group_name
}

output "azure_aks_cluster_name" {
  description = "Azure AKS cluster name"
  value       = module.azure.aks_cluster_name
}

output "azure_aks_cluster_fqdn" {
  description = "Azure AKS cluster FQDN"
  value       = module.azure.aks_cluster_fqdn
}

output "azure_postgresql_server_fqdn" {
  description = "Azure PostgreSQL server FQDN"
  value       = module.azure.postgresql_server_fqdn
}

output "azure_redis_hostname" {
  description = "Azure Redis hostname"
  value       = module.azure.redis_hostname
}

output "azure_storage_account_name" {
  description = "Azure storage account name"
  value       = module.azure.storage_account_name
}

output "azure_key_vault_uri" {
  description = "Azure Key Vault URI"
  value       = module.azure.key_vault_uri
}

# GCP Outputs
output "gcp_gke_cluster_name" {
  description = "GCP GKE cluster name"
  value       = module.gcp.gke_cluster_name
}

output "gcp_gke_cluster_endpoint" {
  description = "GCP GKE cluster endpoint"
  value       = module.gcp.gke_cluster_endpoint
}

output "gcp_sql_instance_connection_name" {
  description = "GCP SQL instance connection name"
  value       = module.gcp.sql_instance_connection_name
}

output "gcp_redis_host" {
  description = "GCP Redis host"
  value       = module.gcp.redis_host
}

output "gcp_storage_bucket_name" {
  description = "GCP storage bucket name"
  value       = module.gcp.storage_bucket_name
}

output "gcp_load_balancer_ip" {
  description = "GCP load balancer IP"
  value       = module.gcp.load_balancer_ip
}

# Cross-Cloud Outputs
output "cross_cloud_vpn_connections" {
  description = "Cross-cloud VPN connection details"
  value = {
    aws_to_azure = module.cross_cloud.aws_to_azure_vpn_connection_id
    aws_to_gcp   = module.cross_cloud.aws_to_gcp_vpn_connection_id
  }
}

output "disaster_recovery_configuration" {
  description = "Disaster recovery configuration"
  value       = module.cross_cloud.disaster_recovery_configuration
}

output "backup_configuration" {
  description = "Backup configuration details"
  value = {
    aws_backup_vault_arn    = module.cross_cloud.aws_backup_vault_arn
    azure_recovery_vault_id = module.cross_cloud.azure_recovery_vault_id
    gcp_backup_policy_id    = module.cross_cloud.gcp_backup_policy_id
  }
}

# Cost Optimization Outputs
output "cost_optimization_summary" {
  description = "Cost optimization configuration summary"
  value       = module.cost_optimization.cost_optimization_summary
}

output "budget_configuration" {
  description = "Budget configuration details"
  value = {
    aws_budget_name   = module.cost_optimization.aws_budget_name
    azure_budget_id   = module.cost_optimization.azure_budget_id
    gcp_budget_name   = module.cost_optimization.gcp_budget_name
    total_monthly_budget = var.aws_monthly_budget_limit + var.azure_monthly_budget_limit + var.gcp_monthly_budget_limit
  }
}

output "automation_functions" {
  description = "Automation function details"
  value = {
    resource_optimizer_arn = module.cost_optimization.resource_optimizer_lambda_arn
    dr_orchestrator_arn   = module.cross_cloud.disaster_recovery_configuration != null ? "configured" : "not_configured"
  }
}

# Network Configuration Summary
output "network_configuration" {
  description = "Multi-cloud network configuration summary"
  value = {
    aws = {
      vpc_cidr           = var.aws_vpc_cidr
      public_subnets     = var.aws_public_subnet_cidrs
      private_subnets    = var.aws_private_subnet_cidrs
      availability_zones = var.aws_availability_zones
    }
    azure = {
      vnet_cidr                      = var.azure_vnet_cidr
      aks_subnet_cidr               = var.azure_aks_subnet_cidr
      database_subnet_cidr          = var.azure_database_subnet_cidr
      private_endpoints_subnet_cidr = var.azure_private_endpoints_subnet_cidr
      location                      = var.azure_location
    }
    gcp = {
      gke_subnet_cidr     = var.gcp_gke_subnet_cidr
      gke_pods_cidr       = var.gcp_gke_pods_cidr
      gke_services_cidr   = var.gcp_gke_services_cidr
      database_subnet_cidr = var.gcp_database_subnet_cidr
      region              = var.gcp_region
    }
    cross_cloud_networking_enabled = var.enable_cross_cloud_networking
  }
}

# Security Configuration Summary
output "security_configuration" {
  description = "Security configuration summary"
  value = {
    encryption_at_rest = {
      aws_kms_keys_created   = true
      azure_key_vault_created = true
      gcp_kms_keys_created   = true
    }
    network_security = {
      aws_security_groups    = true
      azure_nsgs            = true
      gcp_firewall_rules    = true
    }
    identity_management = {
      aws_iam_roles         = true
      azure_managed_identity = true
      gcp_service_accounts  = true
    }
  }
}

# Monitoring Configuration Summary
output "monitoring_configuration" {
  description = "Monitoring configuration summary"
  value = {
    aws = {
      cloudwatch_enabled = true
      backup_monitoring  = var.enable_disaster_recovery
      cost_monitoring    = var.enable_cost_optimization
    }
    azure = {
      log_analytics_enabled     = true
      application_insights_enabled = true
      monitor_alerts_enabled    = true
    }
    gcp = {
      stackdriver_enabled = true
      monitoring_alerts   = true
    }
    cross_cloud_monitoring = var.enable_cross_cloud_monitoring
  }
}

# Deployment Summary
output "deployment_summary" {
  description = "Multi-cloud deployment summary"
  value = {
    environment = "dev"
    clouds_deployed = ["aws", "azure", "gcp"]
    features_enabled = {
      cross_cloud_networking = var.enable_cross_cloud_networking
      data_replication      = var.enable_data_replication
      disaster_recovery     = var.enable_disaster_recovery
      cost_optimization     = var.enable_cost_optimization
      auto_scaling         = var.auto_scaling_enabled
      spot_instances       = var.enable_spot_instances
    }
    estimated_monthly_cost = {
      aws   = var.aws_monthly_budget_limit
      azure = var.azure_monthly_budget_limit
      gcp   = var.gcp_monthly_budget_limit
      total = var.aws_monthly_budget_limit + var.azure_monthly_budget_limit + var.gcp_monthly_budget_limit
    }
  }
}

# Connection Strings (Sensitive)
output "database_connections" {
  description = "Database connection information"
  value = {
    aws_rds = {
      endpoint = module.aws.rds_endpoint
      port     = module.aws.rds_port
      database = var.database_name
    }
    azure_postgresql = {
      fqdn     = module.azure.postgresql_server_fqdn
      port     = 5432
      database = var.database_name
    }
    gcp_sql = {
      connection_name = module.gcp.sql_instance_connection_name
      private_ip      = module.gcp.sql_instance_private_ip
      database        = var.database_name
    }
  }
  sensitive = true
}

output "cache_connections" {
  description = "Cache connection information"
  value = {
    aws_redis = {
      endpoint = module.aws.redis_endpoint
      port     = module.aws.redis_port
    }
    azure_redis = {
      hostname = module.azure.redis_hostname
      port     = module.azure.redis_port
      ssl_port = module.azure.redis_ssl_port
    }
    gcp_redis = {
      host = module.gcp.redis_host
      port = module.gcp.redis_port
    }
  }
  sensitive = true
}

# Kubernetes Cluster Access
output "kubernetes_clusters" {
  description = "Kubernetes cluster access information"
  value = {
    aws_eks = {
      cluster_name = module.aws.eks_cluster_id
      endpoint     = module.aws.eks_cluster_endpoint
      region       = var.aws_region
    }
    azure_aks = {
      cluster_name = module.azure.aks_cluster_name
      fqdn         = module.azure.aks_cluster_fqdn
      location     = var.azure_location
    }
    gcp_gke = {
      cluster_name = module.gcp.gke_cluster_name
      endpoint     = module.gcp.gke_cluster_endpoint
      location     = module.gcp.gke_cluster_location
    }
  }
}