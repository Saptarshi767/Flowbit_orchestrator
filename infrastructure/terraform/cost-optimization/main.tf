# Cost Optimization and Resource Monitoring
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

# AWS Cost Optimization
resource "aws_budgets_budget" "monthly" {
  name         = "${var.environment}-monthly-budget"
  budget_type  = "COST"
  limit_amount = var.aws_monthly_budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  time_period_start = "2024-01-01_00:00"

  cost_filters {
    tag {
      key = "Environment"
      values = [var.environment]
    }
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 50
    threshold_type            = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.notification_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.notification_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.notification_emails
  }

  tags = var.common_tags
}

# AWS Cost Anomaly Detection
resource "aws_ce_anomaly_detector" "main" {
  name         = "${var.environment}-cost-anomaly-detector"
  monitor_type = "DIMENSIONAL"

  specification {
    dimension_key           = "SERVICE"
    match_options          = ["EQUALS"]
    values                 = ["EC2-Instance", "RDS", "ElastiCache", "S3"]
  }

  tags = var.common_tags
}

resource "aws_ce_anomaly_subscription" "main" {
  name      = "${var.environment}-cost-anomaly-subscription"
  frequency = "DAILY"
  
  monitor_arn_list = [
    aws_ce_anomaly_detector.main.arn,
  ]
  
  subscriber {
    type    = "EMAIL"
    address = var.cost_anomaly_notification_email
  }

  threshold_expression {
    and {
      dimension {
        key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
        values        = [tostring(var.cost_anomaly_threshold)]
        match_options = ["GREATER_THAN_OR_EQUAL"]
      }
    }
  }

  tags = var.common_tags
}

# AWS Trusted Advisor for cost optimization
resource "aws_support_app_slack_channel_configuration" "cost_optimization" {
  count = var.enable_trusted_advisor_notifications ? 1 : 0
  
  channel_id               = var.slack_channel_id
  channel_name             = var.slack_channel_name
  channel_role_arn         = aws_iam_role.support_app[0].arn
  notify_on_add_correspondence_to_case    = true
  notify_on_case_severity                 = "high"
  notify_on_create_or_reopen_case        = true
  notify_on_resolve_case                 = true
  team_id                                = var.slack_team_id
}

resource "aws_iam_role" "support_app" {
  count = var.enable_trusted_advisor_notifications ? 1 : 0
  
  name = "${var.environment}-support-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "support.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_tags
}

# AWS Auto Scaling for cost optimization
resource "aws_autoscaling_policy" "scale_down" {
  name                   = "${var.environment}-scale-down"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown              = 300
  autoscaling_group_name = var.aws_autoscaling_group_name

  policy_type = "SimpleScaling"
}

resource "aws_autoscaling_policy" "scale_up" {
  name                   = "${var.environment}-scale-up"
  scaling_adjustment     = 1
  adjustment_type        = "ChangeInCapacity"
  cooldown              = 300
  autoscaling_group_name = var.aws_autoscaling_group_name

  policy_type = "SimpleScaling"
}

# CloudWatch alarms for auto scaling
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.environment}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = var.cpu_scale_up_threshold
  alarm_description   = "This metric monitors ec2 cpu utilization"
  alarm_actions       = [aws_autoscaling_policy.scale_up.arn]

  dimensions = {
    AutoScalingGroupName = var.aws_autoscaling_group_name
  }

  tags = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "cpu_low" {
  alarm_name          = "${var.environment}-cpu-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = var.cpu_scale_down_threshold
  alarm_description   = "This metric monitors ec2 cpu utilization"
  alarm_actions       = [aws_autoscaling_policy.scale_down.arn]

  dimensions = {
    AutoScalingGroupName = var.aws_autoscaling_group_name
  }

  tags = var.common_tags
}

# Azure Cost Management
resource "azurerm_consumption_budget_resource_group" "main" {
  name              = "${var.environment}-budget"
  resource_group_id = var.azure_resource_group_id

  amount     = var.azure_monthly_budget_limit
  time_grain = "Monthly"

  time_period {
    start_date = "2024-01-01T00:00:00Z"
    end_date   = "2025-12-31T00:00:00Z"
  }

  filter {
    dimension {
      name = "ResourceGroupName"
      values = [var.azure_resource_group_name]
    }
  }

  notification {
    enabled        = true
    threshold      = 50.0
    operator       = "GreaterThan"
    threshold_type = "Actual"

    contact_emails = var.notification_emails
  }

  notification {
    enabled        = true
    threshold      = 80.0
    operator       = "GreaterThan"
    threshold_type = "Actual"

    contact_emails = var.notification_emails
  }

  notification {
    enabled        = true
    threshold      = 100.0
    operator       = "GreaterThan"
    threshold_type = "Forecasted"

    contact_emails = var.notification_emails
  }

  tags = var.common_tags
}

# Azure Advisor recommendations
resource "azurerm_advisor_recommendations" "cost" {
  count = var.enable_azure_advisor ? 1 : 0
  
  filter_by_category                = ["Cost"]
  filter_by_impact                  = ["High", "Medium"]
  filter_by_resource_groups         = [var.azure_resource_group_name]
}

# Azure Monitor for resource utilization
resource "azurerm_monitor_action_group" "cost_optimization" {
  name                = "${var.environment}-cost-optimization-ag"
  resource_group_name = var.azure_resource_group_name
  short_name          = "costopt"

  email_receiver {
    name          = "cost-alerts"
    email_address = var.cost_anomaly_notification_email
  }

  webhook_receiver {
    name        = "slack-webhook"
    service_uri = var.slack_webhook_url
  }

  tags = var.common_tags
}

resource "azurerm_monitor_metric_alert" "high_cpu" {
  name                = "${var.environment}-high-cpu-alert"
  resource_group_name = var.azure_resource_group_name
  scopes              = [var.azure_aks_cluster_id]
  description         = "Alert when CPU usage is high"

  criteria {
    metric_namespace = "Microsoft.ContainerService/managedClusters"
    metric_name      = "node_cpu_usage_percentage"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = var.cpu_scale_up_threshold
  }

  action {
    action_group_id = azurerm_monitor_action_group.cost_optimization.id
  }

  tags = var.common_tags
}

# GCP Cost Management
resource "google_billing_budget" "main" {
  billing_account = var.gcp_billing_account_id
  display_name    = "${var.environment}-budget"

  budget_filter {
    projects = ["projects/${var.gcp_project_id}"]
    
    labels = {
      environment = var.environment
    }
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.gcp_monthly_budget_limit)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.8
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  all_updates_rule {
    monitoring_notification_channels = var.gcp_notification_channels
    disable_default_iam_recipients   = false
  }
}

# GCP Recommender for cost optimization
resource "google_project_service" "recommender" {
  service = "recommender.googleapis.com"
  
  disable_dependent_services = true
}

# GCP Monitoring for resource utilization
resource "google_monitoring_alert_policy" "high_cpu" {
  display_name = "${var.environment}-high-cpu-alert"
  combiner     = "OR"
  
  conditions {
    display_name = "High CPU Usage"
    
    condition_threshold {
      filter          = "resource.type=\"gke_container\" AND resource.labels.cluster_name=\"${var.gcp_cluster_name}\""
      duration        = "300s"
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = var.cpu_scale_up_threshold / 100
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.gcp_notification_channels

  alert_strategy {
    auto_close = "1800s"
  }
}

# Resource tagging for cost allocation
resource "aws_resourcegroupstaggingapi_resources" "cost_allocation" {
  count = var.enable_cost_allocation_tags ? 1 : 0
  
  resource_type_filters = [
    "ec2:instance",
    "rds:db",
    "elasticache:cluster",
    "s3:bucket"
  ]

  tag_filters {
    key    = "CostCenter"
    values = var.cost_centers
  }

  tag_filters {
    key    = "Environment"
    values = [var.environment]
  }

  tag_filters {
    key    = "Project"
    values = [var.project_name]
  }
}

# AWS Cost Explorer Savings Plans recommendations
resource "aws_ce_cost_category" "environment" {
  name         = "${var.environment}-cost-category"
  rule_version = "CostCategoryExpression.v1"

  rule {
    value = var.environment
    rule {
      dimension {
        key           = "TAG"
        values        = [var.environment]
        match_options = ["EQUALS"]
      }
    }
  }

  tags = var.common_tags
}

# AWS Compute Optimizer for right-sizing recommendations
resource "aws_compute_optimizer_enrollment_status" "main" {
  count = var.enable_resource_optimization ? 1 : 0
  
  status                 = "Active"
  include_member_accounts = false
}

# Lambda function for automated resource optimization
resource "aws_lambda_function" "resource_optimizer" {
  count = var.enable_resource_optimization ? 1 : 0
  
  filename         = "resource_optimizer.zip"
  function_name    = "${var.environment}-resource-optimizer"
  role            = aws_iam_role.lambda_optimizer[0].arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      ENVIRONMENT = var.environment
      IDLE_THRESHOLD_DAYS = var.idle_resource_threshold_days
    }
  }

  tags = var.common_tags
}

resource "aws_iam_role" "lambda_optimizer" {
  count = var.enable_resource_optimization ? 1 : 0
  
  name = "${var.environment}-lambda-optimizer-role"

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

resource "aws_iam_role_policy" "lambda_optimizer" {
  count = var.enable_resource_optimization ? 1 : 0
  
  name = "${var.environment}-lambda-optimizer-policy"
  role = aws_iam_role.lambda_optimizer[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "ec2:DescribeInstances",
          "ec2:DescribeVolumes",
          "ec2:StopInstances",
          "ec2:TerminateInstances",
          "rds:DescribeDBInstances",
          "rds:StopDBInstance",
          "cloudwatch:GetMetricStatistics",
          "ce:GetUsageAndCosts",
          "ce:GetReservationCoverage",
          "ce:GetReservationPurchaseRecommendation"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Event Rule for scheduled optimization
resource "aws_cloudwatch_event_rule" "resource_optimization" {
  count = var.enable_resource_optimization ? 1 : 0
  
  name                = "${var.environment}-resource-optimization"
  description         = "Trigger resource optimization"
  schedule_expression = "cron(${var.optimization_schedule})"

  tags = var.common_tags
}

resource "aws_cloudwatch_event_target" "lambda" {
  count = var.enable_resource_optimization ? 1 : 0
  
  rule      = aws_cloudwatch_event_rule.resource_optimization[0].name
  target_id = "ResourceOptimizerTarget"
  arn       = aws_lambda_function.resource_optimizer[0].arn
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  count = var.enable_resource_optimization ? 1 : 0
  
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.resource_optimizer[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.resource_optimization[0].arn
}

# Spot instance recommendations
resource "aws_ec2_spot_fleet_request" "cost_optimized" {
  count = var.enable_spot_instances ? 1 : 0
  
  iam_fleet_role      = aws_iam_role.spot_fleet[0].arn
  allocation_strategy = "diversified"
  target_capacity     = var.spot_fleet_target_capacity
  valid_until         = "2025-12-31T23:59:59Z"

  launch_specification {
    image_id             = var.spot_instance_ami_id
    instance_type        = var.spot_instance_types[0]
    key_name             = var.key_pair_name
    security_groups      = var.security_group_ids
    subnet_id            = var.private_subnet_ids[0]
    availability_zone    = var.availability_zones[0]
    weighted_capacity    = 1
  }

  launch_specification {
    image_id             = var.spot_instance_ami_id
    instance_type        = var.spot_instance_types[1]
    key_name             = var.key_pair_name
    security_groups      = var.security_group_ids
    subnet_id            = var.private_subnet_ids[1]
    availability_zone    = var.availability_zones[1]
    weighted_capacity    = 2
  }

  tags = var.common_tags
}

resource "aws_iam_role" "spot_fleet" {
  count = var.enable_spot_instances ? 1 : 0
  
  name = "${var.environment}-spot-fleet-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "spotfleet.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "spot_fleet" {
  count = var.enable_spot_instances ? 1 : 0
  
  role       = aws_iam_role.spot_fleet[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetTaggingRole"
}