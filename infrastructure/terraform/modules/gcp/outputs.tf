# GCP Module Outputs

# Network Outputs
output "network_id" {
  description = "ID of the VPC network"
  value       = google_compute_network.main.id
}

output "network_name" {
  description = "Name of the VPC network"
  value       = google_compute_network.main.name
}

output "network_self_link" {
  description = "Self link of the VPC network"
  value       = google_compute_network.main.self_link
}

output "gke_subnet_id" {
  description = "ID of the GKE subnet"
  value       = google_compute_subnetwork.gke.id
}

output "gke_subnet_name" {
  description = "Name of the GKE subnet"
  value       = google_compute_subnetwork.gke.name
}

output "database_subnet_id" {
  description = "ID of the database subnet"
  value       = google_compute_subnetwork.database.id
}

output "database_subnet_name" {
  description = "Name of the database subnet"
  value       = google_compute_subnetwork.database.name
}

# GKE Outputs
output "gke_cluster_id" {
  description = "ID of the GKE cluster"
  value       = google_container_cluster.main.id
}

output "gke_cluster_name" {
  description = "Name of the GKE cluster"
  value       = google_container_cluster.main.name
}

output "gke_cluster_endpoint" {
  description = "Endpoint of the GKE cluster"
  value       = google_container_cluster.main.endpoint
  sensitive   = true
}

output "gke_cluster_master_version" {
  description = "Master version of the GKE cluster"
  value       = google_container_cluster.main.master_version
}

output "gke_cluster_location" {
  description = "Location of the GKE cluster"
  value       = google_container_cluster.main.location
}

output "gke_cluster_ca_certificate" {
  description = "CA certificate of the GKE cluster"
  value       = google_container_cluster.main.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "gke_node_pool_name" {
  description = "Name of the main GKE node pool"
  value       = google_container_node_pool.main.name
}

output "gke_system_node_pool_name" {
  description = "Name of the system GKE node pool"
  value       = google_container_node_pool.system.name
}

# Database Outputs
output "sql_instance_id" {
  description = "ID of the Cloud SQL instance"
  value       = google_sql_database_instance.main.id
}

output "sql_instance_name" {
  description = "Name of the Cloud SQL instance"
  value       = google_sql_database_instance.main.name
}

output "sql_instance_connection_name" {
  description = "Connection name of the Cloud SQL instance"
  value       = google_sql_database_instance.main.connection_name
  sensitive   = true
}

output "sql_instance_private_ip" {
  description = "Private IP of the Cloud SQL instance"
  value       = google_sql_database_instance.main.private_ip_address
  sensitive   = true
}

output "sql_database_name" {
  description = "Name of the SQL database"
  value       = google_sql_database.main.name
}

output "sql_user_name" {
  description = "Name of the SQL user"
  value       = google_sql_user.main.name
}

# Redis Outputs
output "redis_instance_id" {
  description = "ID of the Redis instance"
  value       = google_redis_instance.main.id
}

output "redis_instance_name" {
  description = "Name of the Redis instance"
  value       = google_redis_instance.main.name
}

output "redis_instance_host" {
  description = "Host of the Redis instance"
  value       = google_redis_instance.main.host
  sensitive   = true
}

output "redis_instance_port" {
  description = "Port of the Redis instance"
  value       = google_redis_instance.main.port
}

output "redis_auth_string" {
  description = "Auth string for Redis instance"
  value       = google_redis_instance.main.auth_string
  sensitive   = true
}

# Storage Outputs
output "storage_bucket_id" {
  description = "ID of the storage bucket"
  value       = google_storage_bucket.main.id
}

output "storage_bucket_name" {
  description = "Name of the storage bucket"
  value       = google_storage_bucket.main.name
}

output "storage_bucket_url" {
  description = "URL of the storage bucket"
  value       = google_storage_bucket.main.url
}

output "storage_bucket_self_link" {
  description = "Self link of the storage bucket"
  value       = google_storage_bucket.main.self_link
}

# Service Account Outputs
output "gke_service_account_email" {
  description = "Email of the GKE service account"
  value       = google_service_account.gke_nodes.email
}

output "gke_service_account_id" {
  description = "ID of the GKE service account"
  value       = google_service_account.gke_nodes.id
}

# KMS Outputs
output "kms_key_ring_id" {
  description = "ID of the KMS key ring"
  value       = google_kms_key_ring.main.id
}

output "gke_kms_key_id" {
  description = "ID of the GKE KMS key"
  value       = google_kms_crypto_key.gke.id
}

output "storage_kms_key_id" {
  description = "ID of the storage KMS key"
  value       = google_kms_crypto_key.storage.id
}

# Load Balancer Outputs
output "global_ip_address" {
  description = "Global IP address for load balancer"
  value       = google_compute_global_address.main.address
}

output "global_ip_name" {
  description = "Name of the global IP address"
  value       = google_compute_global_address.main.name
}

# Security Policy Outputs
output "security_policy_id" {
  description = "ID of the Cloud Armor security policy"
  value       = google_compute_security_policy.main.id
}

output "security_policy_name" {
  description = "Name of the Cloud Armor security policy"
  value       = google_compute_security_policy.main.name
}

# Multi-Cloud Specific Outputs
output "vpn_gateway_id" {
  description = "VPN Gateway ID for cross-cloud connectivity"
  value       = var.enable_cross_cloud_networking ? google_compute_vpn_gateway.main[0].id : null
}

output "vpn_gateway_ip" {
  description = "VPN Gateway IP address"
  value       = var.enable_cross_cloud_networking ? google_compute_address.vpn_static_ip[0].address : null
}

# Cost Optimization Outputs
output "budget_name" {
  description = "Budget name for cost monitoring"
  value       = google_billing_budget.main.display_name
}

# Backup Outputs
output "backup_policy_id" {
  description = "Backup policy ID"
  value       = var.enable_disaster_recovery ? google_compute_resource_policy.backup[0].id : null
}

output "cross_region_backup_policy_id" {
  description = "Cross-region backup policy ID"
  value       = var.enable_disaster_recovery && var.cross_region_replication_enabled ? google_compute_resource_policy.cross_region_backup[0].id : null
}

# Project and Region Info
output "project_id" {
  description = "GCP project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP region"
  value       = var.region
}

# Network Router Outputs
output "router_id" {
  description = "ID of the Cloud Router"
  value       = google_compute_router.main.id
}

output "nat_id" {
  description = "ID of the Cloud NAT"
  value       = google_compute_router_nat.main.id
}