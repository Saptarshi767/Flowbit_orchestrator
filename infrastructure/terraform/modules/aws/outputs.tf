# AWS Module Outputs

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways"
  value       = aws_nat_gateway.main[*].id
}

# EKS Outputs
output "eks_cluster_id" {
  description = "EKS cluster ID"
  value       = aws_eks_cluster.main.id
}

output "eks_cluster_arn" {
  description = "EKS cluster ARN"
  value       = aws_eks_cluster.main.arn
}

output "eks_cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = aws_eks_cluster.main.endpoint
}

output "eks_cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "eks_cluster_version" {
  description = "The Kubernetes version for the EKS cluster"
  value       = aws_eks_cluster.main.version
}

output "eks_node_group_arn" {
  description = "Amazon Resource Name (ARN) of the EKS Node Group"
  value       = aws_eks_node_group.main.arn
}

output "eks_node_group_status" {
  description = "Status of the EKS Node Group"
  value       = aws_eks_node_group.main.status
}

# Database Outputs
output "rds_instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.postgresql.id
}

output "rds_instance_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.postgresql.arn
}

output "rds_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.postgresql.endpoint
  sensitive   = true
}

output "rds_instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.postgresql.port
}

output "database_name" {
  description = "Database name"
  value       = aws_db_instance.postgresql.db_name
}

# Redis Outputs
output "redis_cluster_id" {
  description = "ElastiCache Redis cluster ID"
  value       = aws_elasticache_replication_group.redis.id
}

output "redis_primary_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

# S3 Outputs
output "s3_bucket_id" {
  description = "S3 bucket ID"
  value       = aws_s3_bucket.main.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.main.arn
}

output "s3_bucket_domain_name" {
  description = "S3 bucket domain name"
  value       = aws_s3_bucket.main.bucket_domain_name
}

# KMS Outputs
output "eks_kms_key_id" {
  description = "EKS KMS key ID"
  value       = aws_kms_key.eks.key_id
}

output "rds_kms_key_id" {
  description = "RDS KMS key ID"
  value       = aws_kms_key.rds.key_id
}

output "s3_kms_key_id" {
  description = "S3 KMS key ID"
  value       = aws_kms_key.s3.key_id
}

output "cloudwatch_kms_key_id" {
  description = "CloudWatch KMS key ID"
  value       = aws_kms_key.cloudwatch.key_id
}

# Security Group Outputs
output "rds_security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "redis_security_group_id" {
  description = "Redis security group ID"
  value       = aws_security_group.redis.id
}

# Multi-Cloud Specific Outputs
output "vpn_gateway_id" {
  description = "VPN Gateway ID for cross-cloud connectivity"
  value       = var.enable_cross_cloud_networking ? aws_vpn_gateway.aws_to_azure[0].id : null
}

output "backup_vault_arn" {
  description = "AWS Backup vault ARN"
  value       = var.enable_disaster_recovery ? aws_backup_vault.main[0].arn : null
}

output "backup_plan_arn" {
  description = "AWS Backup plan ARN"
  value       = var.enable_disaster_recovery ? aws_backup_plan.main[0].arn : null
}

# Cost Optimization Outputs
output "budget_name" {
  description = "Budget name for cost monitoring"
  value       = var.enable_cost_optimization ? aws_budgets_budget.cross_cloud[0].name : null
}

# Monitoring Outputs
output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name for EKS"
  value       = aws_cloudwatch_log_group.eks_cluster.name
}

output "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN for EKS"
  value       = aws_cloudwatch_log_group.eks_cluster.arn
}

# IAM Outputs
output "eks_cluster_role_arn" {
  description = "EKS cluster IAM role ARN"
  value       = aws_iam_role.eks_cluster.arn
}

output "eks_node_group_role_arn" {
  description = "EKS node group IAM role ARN"
  value       = aws_iam_role.eks_node_group.arn
}

# Network Configuration for Cross-Cloud
output "availability_zones" {
  description = "List of availability zones used"
  value       = var.availability_zones
}

output "region" {
  description = "AWS region"
  value       = var.region
}