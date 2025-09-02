# Security Groups and KMS Keys

# Security Group for EKS Cluster
resource "aws_security_group" "eks_cluster" {
  name        = "${var.environment}-eks-cluster-sg"
  description = "Security group for EKS cluster"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name = "${var.environment}-eks-cluster-sg"
  })
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name        = "${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name = "${var.environment}-rds-sg"
  })
}

# Security Group for Redis
resource "aws_security_group" "redis" {
  name        = "${var.environment}-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name = "${var.environment}-redis-sg"
  })
}

# KMS Key for EKS
resource "aws_kms_key" "eks" {
  description             = "KMS key for EKS cluster encryption"
  deletion_window_in_days = 7

  tags = merge(var.common_tags, {
    Name = "${var.environment}-eks-kms-key"
  })
}

resource "aws_kms_alias" "eks" {
  name          = "alias/${var.environment}-eks"
  target_key_id = aws_kms_key.eks.key_id
}

# KMS Key for RDS
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 7

  tags = merge(var.common_tags, {
    Name = "${var.environment}-rds-kms-key"
  })
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.environment}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# KMS Key for S3
resource "aws_kms_key" "s3" {
  description             = "KMS key for S3 bucket encryption"
  deletion_window_in_days = 7

  tags = merge(var.common_tags, {
    Name = "${var.environment}-s3-kms-key"
  })
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${var.environment}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# CloudWatch Log Group for EKS
resource "aws_cloudwatch_log_group" "eks_cluster" {
  name              = "/aws/eks/${var.environment}-eks-cluster/cluster"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.eks.arn

  tags = var.common_tags
}

# WAF for Application Load Balancer
resource "aws_wafv2_web_acl" "main" {
  name  = "${var.environment}-orchestrator-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "RateLimitRule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  tags = var.common_tags

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.environment}OrchestratorWAF"
    sampled_requests_enabled   = true
  }
}