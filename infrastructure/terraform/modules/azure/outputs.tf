# Azure Module Outputs

# Resource Group Outputs
output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "resource_group_id" {
  description = "ID of the resource group"
  value       = azurerm_resource_group.main.id
}

output "location" {
  description = "Azure region location"
  value       = azurerm_resource_group.main.location
}

# Network Outputs
output "vnet_id" {
  description = "ID of the virtual network"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "Name of the virtual network"
  value       = azurerm_virtual_network.main.name
}

output "aks_subnet_id" {
  description = "ID of the AKS subnet"
  value       = azurerm_subnet.aks.id
}

output "database_subnet_id" {
  description = "ID of the database subnet"
  value       = azurerm_subnet.database.id
}

output "private_endpoints_subnet_id" {
  description = "ID of the private endpoints subnet"
  value       = azurerm_subnet.private_endpoints.id
}

# AKS Outputs
output "aks_cluster_id" {
  description = "ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.id
}

output "aks_cluster_name" {
  description = "Name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.name
}

output "aks_cluster_fqdn" {
  description = "FQDN of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.fqdn
}

output "aks_cluster_kube_config" {
  description = "Kube config for the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}

output "aks_cluster_identity" {
  description = "Identity of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.identity
}

output "aks_node_resource_group" {
  description = "Auto-generated resource group for AKS nodes"
  value       = azurerm_kubernetes_cluster.main.node_resource_group
}

# Database Outputs
output "postgresql_server_id" {
  description = "ID of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.id
}

output "postgresql_server_name" {
  description = "Name of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.name
}

output "postgresql_server_fqdn" {
  description = "FQDN of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.fqdn
  sensitive   = true
}

output "postgresql_database_name" {
  description = "Name of the PostgreSQL database"
  value       = azurerm_postgresql_flexible_server_database.main.name
}

output "private_dns_zone_id" {
  description = "ID of the private DNS zone for PostgreSQL"
  value       = azurerm_private_dns_zone.postgresql.id
}

# Redis Outputs
output "redis_cache_id" {
  description = "ID of the Redis cache"
  value       = azurerm_redis_cache.main.id
}

output "redis_cache_name" {
  description = "Name of the Redis cache"
  value       = azurerm_redis_cache.main.name
}

output "redis_cache_hostname" {
  description = "Hostname of the Redis cache"
  value       = azurerm_redis_cache.main.hostname
  sensitive   = true
}

output "redis_cache_port" {
  description = "Port of the Redis cache"
  value       = azurerm_redis_cache.main.port
}

output "redis_cache_primary_access_key" {
  description = "Primary access key for Redis cache"
  value       = azurerm_redis_cache.main.primary_access_key
  sensitive   = true
}

# Storage Outputs
output "storage_account_id" {
  description = "ID of the storage account"
  value       = azurerm_storage_account.main.id
}

output "storage_account_name" {
  description = "Name of the storage account"
  value       = azurerm_storage_account.main.name
}

output "storage_account_primary_blob_endpoint" {
  description = "Primary blob endpoint of the storage account"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

output "workflows_container_name" {
  description = "Name of the workflows storage container"
  value       = azurerm_storage_container.workflows.name
}

output "executions_container_name" {
  description = "Name of the executions storage container"
  value       = azurerm_storage_container.executions.name
}

# Monitoring Outputs
output "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.main.id
}

output "log_analytics_workspace_name" {
  description = "Name of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.main.name
}

output "application_insights_id" {
  description = "ID of Application Insights"
  value       = azurerm_application_insights.main.id
}

output "application_insights_instrumentation_key" {
  description = "Instrumentation key for Application Insights"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "Connection string for Application Insights"
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}

# Key Vault Outputs
output "key_vault_id" {
  description = "ID of the Key Vault"
  value       = azurerm_key_vault.main.id
}

output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = azurerm_key_vault.main.name
}

output "key_vault_uri" {
  description = "URI of the Key Vault"
  value       = azurerm_key_vault.main.vault_uri
}

# Application Gateway Outputs
output "application_gateway_id" {
  description = "ID of the Application Gateway"
  value       = azurerm_application_gateway.main.id
}

output "application_gateway_public_ip" {
  description = "Public IP of the Application Gateway"
  value       = azurerm_public_ip.app_gateway.ip_address
}

# Multi-Cloud Specific Outputs
output "vpn_gateway_id" {
  description = "VPN Gateway ID for cross-cloud connectivity"
  value       = var.enable_cross_cloud_networking ? azurerm_virtual_network_gateway.main[0].id : null
}

output "vpn_gateway_public_ip" {
  description = "VPN Gateway public IP"
  value       = var.enable_cross_cloud_networking ? azurerm_public_ip.vpn_gateway[0].ip_address : null
}

output "recovery_vault_id" {
  description = "Recovery Services vault ID"
  value       = var.enable_disaster_recovery ? azurerm_recovery_services_vault.main[0].id : null
}

# Cost Optimization Outputs
output "budget_id" {
  description = "Budget ID for cost monitoring"
  value       = azurerm_consumption_budget_resource_group.main.id
}

# Network Security Outputs
output "aks_nsg_id" {
  description = "Network Security Group ID for AKS"
  value       = azurerm_network_security_group.aks.id
}

# Gateway Subnet (for VPN)
output "gateway_subnet_cidr" {
  description = "CIDR block for gateway subnet"
  value       = var.gateway_subnet_cidr
}