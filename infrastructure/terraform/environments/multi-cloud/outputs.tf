# Multi-Cloud Environment Outputs

# AWS Outputs
output "aws_vpc_id" {
  description = "AWS VPC ID"
  value       = module.aws_infrastructure.vpc_id
}

output "aws_eks_cluster_endpoint" {
  description = "AWS EKS cluster endpoint"
  value       = module.aws_infrastructure.eks_cluster_endpoint
  sensitive   = true
}

output "aws_rds_endpoint" {
  description = "AWS RDS endpoint"
  value       = module.aws_infrastructure.rds_instance_endpoint
  sensitive   = true
}

output "aws_s3_bucket_name" {
  description = "AWS S3 bucket name"
  value       = module.aws_infrastructure.s3_bucket_id
}

output "aws_region" {
  description = "AWS region"
  value       = module.aws_infrastructure.region
}

# Azure Outputs
output "azure_resource_group_name" {
  description = "Azure resource group name"
  value       = module.azure_infrastructure.resource_group_name
}

output "azure_aks_cluster_name" {
  description = "Azure AKS cluster name"
  value       = module.azure_infrastructure.aks_cluster_name
}

output "azure_postgresql_fqdn" {
  description = "Azure PostgreSQL FQDN"
  value       = module.azure_infrastructure.postgresql_server_fqdn
  sensitive   = true
}

output "azure_storage_account_name" {
  description = "Azure storage account name"
  value       = module.azure_infrastructure.storage_account_name
}

output "azure_location" {
  description = "Azure location"
  value       = module.azure_infrastructure.location
}

# GCP Outputs
output "gcp_project_id" {
  description = "GCP project ID"
  value       = module.gcp_infrastructure.project_id
}

output "gcp_gke_cluster_name" {
  description = "GCP GKE cluster name"
  value       = module.gcp_infrastructure.gke_cluster_name
}

output "gcp_sql_instance_connection_name" {
  description = "GCP SQL instance connection name"
  value       = module.gcp_infrastructure.sql_instance_connection_name
  sensitive   = true
}

output "gcp_storage_bucket_name" {
  description = "GCP storage bucket name"
  value       = module.gcp_infrastructure.storage_bucket_name
}

output "gcp_region" {
  description = "GCP region"
  value       = module.gcp_infrastructure.region
}

# Cross-Cloud Networking Outputs
output "cross_cloud_vpn_connections" {
  description = "Cross-cloud VPN connection details"
  value = var.enable_cross_cloud_networking ? {
    aws_to_azure_vpn_id = module.cross_cloud_networking[0].aws_to_azure_vpn_id
    aws_to_gcp_vpn_id   = module.cross_cloud_networking[0].aws_to_gcp_vpn_id
    azure_vpn_gateway_ip = module.azure_infrastructure.vpn_gateway_public_ip
    gcp_vpn_gateway_ip   = module.gcp_infrastructure.vpn_gateway_ip
  } : null
}

# Disaster Recovery Outputs
output "disaster_recovery_configuration" {
  description = "Disaster recovery configuration details"
  value = var.enable_disaster_recovery ? {
    aws_backup_vault_arn    = module.aws_infrastructure.backup_vault_arn
    azure_recovery_vault_id = module.azure_infrastructure.recovery_vault_id
    gcp_backup_policy_id    = module.gcp_infrastructure.backup_policy_id
    cross_region_replication_enabled = var.enable_s3_cross_region_replication
  } : null
}

# Cost Optimization Outputs
output "cost_optimization_configuration" {
  description = "Cost optimization configuration details"
  value = var.enable_cost_optimization ? {
    aws_budget_name    = module.cost_optimization[0].aws_budget_name
    azure_budget_id    = module.cost_optimization[0].azure_budget_id
    gcp_budget_name    = module.cost_optimization[0].gcp_budget_name
    total_monthly_budget = var.aws_monthly_budget_limit + var.azure_monthly_budget_limit + var.gcp_monthly_budget_limit
    optimization_functions_deployed = module.cost_optimization[0].optimization_functions_count
  } : null
}

# Security and Compliance Outputs
output "security_configuration" {
  description = "Security configuration across clouds"
  value = {
    aws_kms_keys = {
      eks_key_id        = module.aws_infrastructure.eks_kms_key_id
      rds_key_id        = module.aws_infrastructure.rds_kms_key_id
      s3_key_id         = module.aws_infrastructure.s3_kms_key_id
      cloudwatch_key_id = module.aws_infrastructure.cloudwatch_kms_key_id
    }
    azure_key_vault = {
      id   = module.azure_infrastructure.key_vault_id
      name = module.azure_infrastructure.key_vault_name
      uri  = module.azure_infrastructure.key_vault_uri
    }
    gcp_kms = {
      key_ring_id     = module.gcp_infrastructure.kms_key_ring_id
      gke_key_id      = module.gcp_infrastructure.gke_kms_key_id
      storage_key_id  = module.gcp_infrastructure.storage_kms_key_id
    }
  }
}

# Monitoring and Observability Outputs
output "monitoring_configuration" {
  description = "Monitoring configuration across clouds"
  value = {
    aws_cloudwatch_log_group = module.aws_infrastructure.cloudwatch_log_group_name
    azure_log_analytics = {
      workspace_id   = module.azure_infrastructure.log_analytics_workspace_id
      workspace_name = module.azure_infrastructure.log_analytics_workspace_name
    }
    azure_application_insights = {
      id                 = module.azure_infrastructure.application_insights_id
      connection_string  = module.azure_infrastructure.application_insights_connection_string
    }
    cross_cloud_monitoring_enabled = var.enable_cross_cloud_monitoring
  }
  sensitive = true
}

# Network Configuration Summary
output "network_configuration" {
  description = "Network configuration summary across clouds"
  value = {
    aws = {
      vpc_id              = module.aws_infrastructure.vpc_id
      vpc_cidr            = module.aws_infrastructure.vpc_cidr_block
      public_subnet_ids   = module.aws_infrastructure.public_subnet_ids
      private_subnet_ids  = module.aws_infrastructure.private_subnet_ids
      availability_zones  = module.aws_infrastructure.availability_zones
    }
    azure = {
      vnet_id                      = module.azure_infrastructure.vnet_id
      vnet_name                    = module.azure_infrastructure.vnet_name
      aks_subnet_id               = module.azure_infrastructure.aks_subnet_id
      database_subnet_id          = module.azure_infrastructure.database_subnet_id
      private_endpoints_subnet_id = module.azure_infrastructure.private_endpoints_subnet_id
    }
    gcp = {
      network_id           = module.gcp_infrastructure.network_id
      network_name         = module.gcp_infrastructure.network_name
      gke_subnet_id        = module.gcp_infrastructure.gke_subnet_id
      database_subnet_id   = module.gcp_infrastructure.database_subnet_id
    }
  }
}

# Kubernetes Cluster Information
output "kubernetes_clusters" {
  description = "Kubernetes cluster information across clouds"
  value = {
    aws_eks = {
      cluster_id       = module.aws_infrastructure.eks_cluster_id
      cluster_arn      = module.aws_infrastructure.eks_cluster_arn
      cluster_endpoint = module.aws_infrastructure.eks_cluster_endpoint
      cluster_version  = module.aws_infrastructure.eks_cluster_version
    }
    azure_aks = {
      cluster_id   = module.azure_infrastructure.aks_cluster_id
      cluster_name = module.azure_infrastructure.aks_cluster_name
      cluster_fqdn = module.azure_infrastructure.aks_cluster_fqdn
    }
    gcp_gke = {
      cluster_id       = module.gcp_infrastructure.gke_cluster_id
      cluster_name     = module.gcp_infrastructure.gke_cluster_name
      cluster_endpoint = module.gcp_infrastructure.gke_cluster_endpoint
      cluster_location = module.gcp_infrastructure.gke_cluster_location
    }
  }
  sensitive = true
}

# Database Configuration Summary
output "database_configuration" {
  description = "Database configuration across clouds"
  value = {
    aws_rds = {
      instance_id       = module.aws_infrastructure.rds_instance_id
      instance_arn      = module.aws_infrastructure.rds_instance_arn
      instance_endpoint = module.aws_infrastructure.rds_instance_endpoint
      instance_port     = module.aws_infrastructure.rds_instance_port
      database_name     = module.aws_infrastructure.database_name
    }
    azure_postgresql = {
      server_id   = module.azure_infrastructure.postgresql_server_id
      server_name = module.azure_infrastructure.postgresql_server_name
      server_fqdn = module.azure_infrastructure.postgresql_server_fqdn
      database_name = module.azure_infrastructure.postgresql_database_name
    }
    gcp_sql = {
      instance_id          = module.gcp_infrastructure.sql_instance_id
      instance_name        = module.gcp_infrastructure.sql_instance_name
      connection_name      = module.gcp_infrastructure.sql_instance_connection_name
      private_ip          = module.gcp_infrastructure.sql_instance_private_ip
      database_name       = module.gcp_infrastructure.sql_database_name
    }
  }
  sensitive = true
}

# Cache Configuration Summary
output "cache_configuration" {
  description = "Cache configuration across clouds"
  value = {
    aws_redis = {
      cluster_id        = module.aws_infrastructure.redis_cluster_id
      primary_endpoint  = module.aws_infrastructure.redis_primary_endpoint
      port             = module.aws_infrastructure.redis_port
    }
    azure_redis = {
      cache_id         = module.azure_infrastructure.redis_cache_id
      cache_name       = module.azure_infrastructure.redis_cache_name
      cache_hostname   = module.azure_infrastructure.redis_cache_hostname
      cache_port       = module.azure_infrastructure.redis_cache_port
    }
    gcp_redis = {
      instance_id   = module.gcp_infrastructure.redis_instance_id
      instance_name = module.gcp_infrastructure.redis_instance_name
      instance_host = module.gcp_infrastructure.redis_instance_host
      instance_port = module.gcp_infrastructure.redis_instance_port
    }
  }
  sensitive = true
}

# Storage Configuration Summary
output "storage_configuration" {
  description = "Storage configuration across clouds"
  value = {
    aws_s3 = {
      bucket_id          = module.aws_infrastructure.s3_bucket_id
      bucket_arn         = module.aws_infrastructure.s3_bucket_arn
      bucket_domain_name = module.aws_infrastructure.s3_bucket_domain_name
    }
    azure_storage = {
      account_id                    = module.azure_infrastructure.storage_account_id
      account_name                  = module.azure_infrastructure.storage_account_name
      primary_blob_endpoint         = module.azure_infrastructure.storage_account_primary_blob_endpoint
      workflows_container_name      = module.azure_infrastructure.workflows_container_name
      executions_container_name     = module.azure_infrastructure.executions_container_name
    }
    gcp_storage = {
      bucket_id        = module.gcp_infrastructure.storage_bucket_id
      bucket_name      = module.gcp_infrastructure.storage_bucket_name
      bucket_url       = module.gcp_infrastructure.storage_bucket_url
      bucket_self_link = module.gcp_infrastructure.storage_bucket_self_link
    }
  }
}

# Deployment Summary
output "deployment_summary" {
  description = "Multi-cloud deployment summary"
  value = {
    environment                    = var.environment
    clouds_deployed               = ["aws", "azure", "gcp"]
    cross_cloud_networking_enabled = var.enable_cross_cloud_networking
    data_replication_enabled      = var.enable_data_replication
    disaster_recovery_enabled     = var.enable_disaster_recovery
    cost_optimization_enabled     = var.enable_cost_optimization
    total_monthly_budget          = var.aws_monthly_budget_limit + var.azure_monthly_budget_limit + var.gcp_monthly_budget_limit
    deployment_timestamp          = timestamp()
  }
}