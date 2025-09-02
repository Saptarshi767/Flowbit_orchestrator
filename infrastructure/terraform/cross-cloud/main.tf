# Cross-Cloud Networking and Data Replication
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

# VPN Gateway for AWS-Azure connection
resource "aws_vpn_gateway" "aws_to_azure" {
  count = var.enable_cross_cloud_networking ? 1 : 0
  
  vpc_id = var.aws_vpc_id
  
  tags = merge(var.common_tags, {
    Name = "${var.environment}-aws-to-azure-vpn-gw"
  })
}

resource "aws_customer_gateway" "azure" {
  count = var.enable_cross_cloud_networking ? 1 : 0
  
  bgp_asn    = 65000
  ip_address = var.azure_vpn_gateway_ip
  type       = "ipsec.1"

  tags = merge(var.common_tags, {
    Name = "${var.environment}-azure-customer-gw"
  })
}

resource "aws_vpn_connection" "aws_to_azure" {
  count = var.enable_cross_cloud_networking ? 1 : 0
  
  vpn_gateway_id      = aws_vpn_gateway.aws_to_azure[0].id
  customer_gateway_id = aws_customer_gateway.azure[0].id
  type                = "ipsec.1"
  static_routes_only  = true

  tags = merge(var.common_tags, {
    Name = "${var.environment}-aws-to-azure-vpn"
  })
}

# VPN Gateway for AWS-GCP connection
resource "aws_customer_gateway" "gcp" {
  count = var.enable_cross_cloud_networking ? 1 : 0
  
  bgp_asn    = 65001
  ip_address = var.gcp_vpn_gateway_ip
  type       = "ipsec.1"

  tags = merge(var.common_tags, {
    Name = "${var.environment}-gcp-customer-gw"
  })
}

resource "aws_vpn_connection" "aws_to_gcp" {
  count = var.enable_cross_cloud_networking ? 1 : 0
  
  vpn_gateway_id      = aws_vpn_gateway.aws_to_azure[0].id
  customer_gateway_id = aws_customer_gateway.gcp[0].id
  type                = "ipsec.1"
  static_routes_only  = true

  tags = merge(var.common_tags, {
    Name = "${var.environment}-aws-to-gcp-vpn"
  })
}

# Azure VPN Gateway
resource "azurerm_public_ip" "vpn_gateway" {
  count = var.enable_cross_cloud_networking ? 1 : 0
  
  name                = "${var.environment}-vpn-gateway-pip"
  location            = var.azure_location
  resource_group_name = var.azure_resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = var.common_tags
}

resource "azurerm_virtual_network_gateway" "main" {
  count = var.enable_cross_cloud_networking ? 1 : 0
  
  name                = "${var.environment}-vpn-gateway"
  location            = var.azure_location
  resource_group_name = var.azure_resource_group_name

  type     = "Vpn"
  vpn_type = "RouteBased"

  active_active = false
  enable_bgp    = false
  sku           = "VpnGw1"

  ip_configuration {
    name                          = "vnetGatewayConfig"
    public_ip_address_id          = azurerm_public_ip.vpn_gateway[0].id
    private_ip_address_allocation = "Dynamic"
    subnet_id                     = var.azure_gateway_subnet_id
  }

  tags = var.common_tags
}

# GCP VPN Gateway
resource "google_compute_vpn_gateway" "main" {
  count = var.enable_cross_cloud_networking ? 1 : 0
  
  name    = "${var.environment}-vpn-gateway"
  network = var.gcp_network_id
  region  = var.gcp_region
}

resource "google_compute_address" "vpn_static_ip" {
  count = var.enable_cross_cloud_networking ? 1 : 0
  
  name   = "${var.environment}-vpn-ip"
  region = var.gcp_region
}

# Cross-cloud data replication using AWS DMS
resource "aws_dms_replication_subnet_group" "main" {
  count = var.enable_data_replication ? 1 : 0
  
  replication_subnet_group_description = "DMS replication subnet group"
  replication_subnet_group_id          = "${var.environment}-dms-subnet-group"

  subnet_ids = var.aws_private_subnet_ids

  tags = var.common_tags
}

resource "aws_dms_replication_instance" "main" {
  count = var.enable_data_replication ? 1 : 0
  
  allocated_storage            = 100
  apply_immediately           = true
  auto_minor_version_upgrade  = true
  availability_zone           = var.aws_availability_zones[0]
  engine_version              = "3.4.7"
  multi_az                    = false
  publicly_accessible        = false
  replication_instance_class  = "dms.t3.micro"
  replication_instance_id     = "${var.environment}-replication-instance"
  replication_subnet_group_id = aws_dms_replication_subnet_group.main[0].id

  tags = var.common_tags

  vpc_security_group_ids = [var.aws_dms_security_group_id]

  depends_on = [
    aws_dms_replication_subnet_group.main
  ]
}

# DMS endpoints for cross-cloud replication
resource "aws_dms_endpoint" "source" {
  count = var.enable_data_replication ? 1 : 0
  
  endpoint_id   = "${var.environment}-source-endpoint"
  endpoint_type = "source"
  engine_name   = "postgres"
  
  server_name = var.source_database_endpoint
  port        = var.source_database_port
  database_name = var.source_database_name
  username    = var.source_database_username
  password    = var.source_database_password

  ssl_mode = "require"

  tags = var.common_tags
}

resource "aws_dms_endpoint" "target" {
  count = var.enable_data_replication ? 1 : 0
  
  endpoint_id   = "${var.environment}-target-endpoint"
  endpoint_type = "target"
  engine_name   = "postgres"
  
  server_name = var.target_database_endpoint
  port        = var.target_database_port
  database_name = var.target_database_name
  username    = var.target_database_username
  password    = var.target_database_password

  ssl_mode = "require"

  tags = var.common_tags
}

# DMS replication task
resource "aws_dms_replication_task" "main" {
  count = var.enable_data_replication ? 1 : 0
  
  migration_type           = "full-load-and-cdc"
  replication_instance_arn = aws_dms_replication_instance.main[0].replication_instance_arn
  replication_task_id      = "${var.environment}-replication-task"
  source_endpoint_arn      = aws_dms_endpoint.source[0].endpoint_arn
  target_endpoint_arn      = aws_dms_endpoint.target[0].endpoint_arn

  table_mappings = jsonencode({
    rules = [
      {
        rule-type = "selection"
        rule-id   = "1"
        rule-name = "1"
        object-locator = {
          schema-name = "public"
          table-name  = "%"
        }
        rule-action = "include"
      }
    ]
  })

  replication_task_settings = jsonencode({
    TargetMetadata = {
      TargetSchema                 = ""
      SupportLobs                  = true
      FullLobMode                  = false
      LobChunkSize                 = 0
      LimitedSizeLobMode           = true
      LobMaxSize                   = 32
      InlineLobMaxSize            = 0
      LoadMaxFileSize             = 0
      ParallelLoadThreads         = 0
      ParallelLoadBufferSize      = 0
      BatchApplyEnabled           = false
      TaskRecoveryTableEnabled    = false
      ParallelApplyThreads        = 0
      ParallelApplyBufferSize     = 0
      ParallelApplyQueuesPerThread = 0
    }
    FullLoadSettings = {
      TargetTablePrepMode          = "DROP_AND_CREATE"
      CreatePkAfterFullLoad        = false
      StopTaskCachedChangesApplied = false
      StopTaskCachedChangesNotApplied = false
      MaxFullLoadSubTasks          = 8
      TransactionConsistencyTimeout = 600
      CommitRate                   = 10000
    }
    Logging = {
      EnableLogging = true
    }
  })

  tags = var.common_tags

  depends_on = [
    aws_dms_endpoint.source,
    aws_dms_endpoint.target
  ]
}

# S3 cross-region replication for object storage
resource "aws_s3_bucket_replication_configuration" "main" {
  count = var.enable_data_replication && var.enable_s3_cross_region_replication ? 1 : 0
  
  role   = aws_iam_role.s3_replication[0].arn
  bucket = var.source_s3_bucket_id

  rule {
    id     = "replicate-all"
    status = "Enabled"

    destination {
      bucket        = var.target_s3_bucket_arn
      storage_class = "STANDARD_IA"
      
      encryption_configuration {
        replica_kms_key_id = var.target_s3_kms_key_arn
      }
    }
  }

  depends_on = [aws_s3_bucket_versioning.source]
}

resource "aws_s3_bucket_versioning" "source" {
  count = var.enable_data_replication && var.enable_s3_cross_region_replication ? 1 : 0
  
  bucket = var.source_s3_bucket_id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_iam_role" "s3_replication" {
  count = var.enable_data_replication && var.enable_s3_cross_region_replication ? 1 : 0
  
  name = "${var.environment}-s3-replication-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_tags
}

resource "aws_iam_policy" "s3_replication" {
  count = var.enable_data_replication && var.enable_s3_cross_region_replication ? 1 : 0
  
  name = "${var.environment}-s3-replication-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Resource = "${var.source_s3_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = var.source_s3_bucket_arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Resource = "${var.target_s3_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = var.source_s3_kms_key_arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:GenerateDataKey"
        ]
        Resource = var.target_s3_kms_key_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "s3_replication" {
  count = var.enable_data_replication && var.enable_s3_cross_region_replication ? 1 : 0
  
  role       = aws_iam_role.s3_replication[0].name
  policy_arn = aws_iam_policy.s3_replication[0].arn
}

# Backup and disaster recovery
resource "aws_backup_vault" "main" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  name        = "${var.environment}-backup-vault"
  kms_key_arn = var.aws_backup_kms_key_arn

  tags = var.common_tags
}

resource "aws_backup_plan" "main" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  name = "${var.environment}-backup-plan"

  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.main[0].name
    schedule          = "cron(0 5 ? * * *)"

    recovery_point_tags = var.common_tags

    lifecycle {
      cold_storage_after = 30
      delete_after       = 120
    }

    copy_action {
      destination_vault_arn = var.cross_region_backup_vault_arn
      
      lifecycle {
        cold_storage_after = 30
        delete_after       = 120
      }
    }
  }

  tags = var.common_tags
}

# Azure Site Recovery for disaster recovery
resource "azurerm_recovery_services_vault" "main" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  name                = "${var.environment}-recovery-vault"
  location            = var.azure_location
  resource_group_name = var.azure_resource_group_name
  sku                 = "Standard"

  soft_delete_enabled = true

  tags = var.common_tags
}

resource "azurerm_backup_policy_vm" "main" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  name                = "${var.environment}-vm-backup-policy"
  resource_group_name = var.azure_resource_group_name
  recovery_vault_name = azurerm_recovery_services_vault.main[0].name

  backup {
    frequency = "Daily"
    time      = "23:00"
  }

  retention_daily {
    count = 10
  }

  retention_weekly {
    count    = 42
    weekdays = ["Sunday", "Wednesday", "Friday", "Saturday"]
  }

  retention_monthly {
    count    = 7
    weekdays = ["Sunday", "Wednesday"]
    weeks    = ["First", "Last"]
  }

  retention_yearly {
    count    = 77
    weekdays = ["Sunday"]
    weeks    = ["Last"]
    months   = ["January"]
  }
}

# GCP backup and disaster recovery
resource "google_compute_resource_policy" "backup" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  name   = "${var.environment}-backup-policy"
  region = var.gcp_region

  snapshot_schedule_policy {
    schedule {
      daily_schedule {
        days_in_cycle = 1
        start_time    = "04:00"
      }
    }

    retention_policy {
      max_retention_days    = var.backup_retention_days
      on_source_disk_delete = "KEEP_AUTO_SNAPSHOTS"
    }

    snapshot_properties {
      labels = var.common_labels
      storage_locations = [var.gcp_region]
      guest_flush       = false
    }
  }
}

# Multi-region backup strategy
resource "google_compute_resource_policy" "cross_region_backup" {
  count = var.enable_disaster_recovery && var.cross_region_replication_enabled ? 1 : 0
  
  name   = "${var.environment}-cross-region-backup-policy"
  region = var.gcp_region

  snapshot_schedule_policy {
    schedule {
      weekly_schedule {
        day_of_weeks {
          day        = "SUNDAY"
          start_time = "02:00"
        }
      }
    }

    retention_policy {
      max_retention_days    = var.backup_retention_days * 2
      on_source_disk_delete = "KEEP_AUTO_SNAPSHOTS"
    }

    snapshot_properties {
      labels = merge(var.common_labels, {
        backup_type = "cross_region"
      })
      storage_locations = [var.gcp_region, "${substr(var.gcp_region, 0, 2)}-central1"]
      guest_flush       = true
    }
  }
}

# Disaster Recovery Runbook automation
resource "aws_lambda_function" "disaster_recovery_orchestrator" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  filename         = "dr_orchestrator.zip"
  function_name    = "${var.environment}-dr-orchestrator"
  role            = aws_iam_role.dr_orchestrator[0].arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 900  # 15 minutes

  environment {
    variables = {
      ENVIRONMENT = var.environment
      BACKUP_RETENTION_DAYS = var.backup_retention_days
      CROSS_REGION_REPLICATION = var.cross_region_replication_enabled
    }
  }

  tags = var.common_tags
}

resource "aws_iam_role" "dr_orchestrator" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  name = "${var.environment}-dr-orchestrator-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_tags
}

resource "aws_iam_role_policy" "dr_orchestrator" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  name = "${var.environment}-dr-orchestrator-policy"
  role = aws_iam_role.dr_orchestrator[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "backup:StartBackupJob",
          "backup:StopBackupJob",
          "backup:GetBackupJob",
          "backup:ListBackupJobs",
          "rds:CreateDBSnapshot",
          "rds:DescribeDBSnapshots",
          "rds:RestoreDBInstanceFromDBSnapshot",
          "ec2:CreateSnapshot",
          "ec2:DescribeSnapshots",
          "ec2:CreateImage",
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject",
          "sns:Publish"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Event Rule for automated DR testing
resource "aws_cloudwatch_event_rule" "dr_testing" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  name                = "${var.environment}-dr-testing"
  description         = "Trigger disaster recovery testing"
  schedule_expression = "cron(0 6 * * SUN)"  # Weekly on Sunday at 6 AM

  tags = var.common_tags
}

resource "aws_cloudwatch_event_target" "dr_testing_lambda" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  rule      = aws_cloudwatch_event_rule.dr_testing[0].name
  target_id = "DRTestingTarget"
  arn       = aws_lambda_function.disaster_recovery_orchestrator[0].arn

  input = jsonencode({
    action = "test_dr_procedures"
    dry_run = true
  })
}

resource "aws_lambda_permission" "allow_cloudwatch_dr" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  statement_id  = "AllowExecutionFromCloudWatchDR"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.disaster_recovery_orchestrator[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.dr_testing[0].arn
}

# RTO/RPO monitoring and alerting
resource "aws_cloudwatch_metric_alarm" "backup_failure" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  alarm_name          = "${var.environment}-backup-failure"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BackupJobsFailed"
  namespace           = "AWS/Backup"
  period              = "3600"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors backup job failures"
  alarm_actions       = [var.aws_sns_topic_arn]

  tags = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rpo_violation" {
  count = var.enable_disaster_recovery ? 1 : 0
  
  alarm_name          = "${var.environment}-rpo-violation"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "TimeSinceLastBackup"
  namespace           = "Custom/DisasterRecovery"
  period              = "3600"
  statistic           = "Maximum"
  threshold           = "86400"  # 24 hours
  alarm_description   = "This metric monitors RPO violations"
  alarm_actions       = [var.aws_sns_topic_arn]

  tags = var.common_tags
}

# Cross-cloud monitoring and alerting
resource "aws_cloudwatch_metric_alarm" "cross_cloud_connectivity" {
  count = var.enable_cross_cloud_monitoring ? 1 : 0
  
  alarm_name          = "${var.environment}-cross-cloud-connectivity"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TunnelState"
  namespace           = "AWS/VPN"
  period              = "60"
  statistic           = "Maximum"
  threshold           = "1"
  alarm_description   = "This metric monitors cross-cloud VPN connectivity"
  alarm_actions       = [var.aws_sns_topic_arn]

  dimensions = {
    VpnId = var.enable_cross_cloud_networking ? aws_vpn_connection.aws_to_azure[0].id : ""
  }

  tags = var.common_tags
}

# Cost optimization across clouds
resource "aws_budgets_budget" "cross_cloud" {
  count = var.enable_cost_optimization ? 1 : 0
  
  name         = "${var.environment}-cross-cloud-budget"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  time_period_start = "2024-01-01_00:00"

  cost_filters {
    service = [
      "Amazon Elastic Compute Cloud - Compute",
      "Amazon Relational Database Service",
      "Amazon ElastiCache",
      "Amazon Simple Storage Service"
    ]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_email_addresses = var.budget_notification_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_notification_emails
  }

  tags = var.common_tags
}