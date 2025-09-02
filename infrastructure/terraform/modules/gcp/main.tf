# GCP Infrastructure Module for Robust AI Orchestrator
terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# VPC Network
resource "google_compute_network" "main" {
  name                    = "${var.environment}-vpc"
  auto_create_subnetworks = false
  routing_mode           = "REGIONAL"
}

# Subnets
resource "google_compute_subnetwork" "gke" {
  name          = "${var.environment}-gke-subnet"
  ip_cidr_range = var.gke_subnet_cidr
  region        = var.region
  network       = google_compute_network.main.id

  secondary_ip_range {
    range_name    = "gke-pods"
    ip_cidr_range = var.gke_pods_cidr
  }

  secondary_ip_range {
    range_name    = "gke-services"
    ip_cidr_range = var.gke_services_cidr
  }

  private_ip_google_access = true
}

resource "google_compute_subnetwork" "database" {
  name          = "${var.environment}-database-subnet"
  ip_cidr_range = var.database_subnet_cidr
  region        = var.region
  network       = google_compute_network.main.id

  private_ip_google_access = true
}

# Cloud NAT for private instances
resource "google_compute_router" "main" {
  name    = "${var.environment}-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "main" {
  name                               = "${var.environment}-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Firewall Rules
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.environment}-allow-internal"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [var.gke_subnet_cidr, var.database_subnet_cidr]
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.environment}-allow-ssh"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ssh-allowed"]
}

resource "google_compute_firewall" "allow_http_https" {
  name    = "${var.environment}-allow-http-https"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server", "https-server"]
}

# GKE Cluster
resource "google_container_cluster" "main" {
  name     = "${var.environment}-gke"
  location = var.region

  # We can't create a cluster with no node pool defined, but we want to only use
  # separately managed node pools. So we create the smallest possible default
  # node pool and immediately delete it.
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.main.name
  subnetwork = google_compute_subnetwork.gke.name

  # Enable IP aliasing
  ip_allocation_policy {
    cluster_secondary_range_name  = "gke-pods"
    services_secondary_range_name = "gke-services"
  }

  # Enable network policy
  network_policy {
    enabled = true
  }

  # Enable private cluster
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = var.gke_master_cidr
  }

  # Master authorized networks
  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"
      display_name = "All networks"
    }
  }

  # Enable workload identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Enable logging and monitoring
  logging_service    = "logging.googleapis.com/kubernetes"
  monitoring_service = "monitoring.googleapis.com/kubernetes"

  # Addons
  addons_config {
    http_load_balancing {
      disabled = false
    }

    horizontal_pod_autoscaling {
      disabled = false
    }

    network_policy_config {
      disabled = false
    }

    gcp_filestore_csi_driver_config {
      enabled = true
    }
  }

  # Enable binary authorization
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }

  # Database encryption
  database_encryption {
    state    = "ENCRYPTED"
    key_name = google_kms_crypto_key.gke.id
  }

  # Maintenance policy
  maintenance_policy {
    recurring_window {
      start_time = "2023-01-01T09:00:00Z"
      end_time   = "2023-01-01T17:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SA,SU"
    }
  }

  depends_on = [
    google_project_service.container,
    google_project_service.compute,
  ]
}# G
KE Node Pool
resource "google_container_node_pool" "main" {
  name       = "${var.environment}-node-pool"
  location   = var.region
  cluster    = google_container_cluster.main.name
  node_count = var.node_count

  node_config {
    preemptible  = var.use_preemptible_nodes
    machine_type = var.node_machine_type
    disk_size_gb = var.node_disk_size
    disk_type    = "pd-ssd"

    # Google recommends custom service accounts that have cloud-platform scope and permissions granted via IAM Roles.
    service_account = google_service_account.gke_nodes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = var.common_labels

    tags = ["gke-node", "${var.environment}-gke-node"]

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }

  autoscaling {
    min_node_count = var.min_node_count
    max_node_count = var.max_node_count
  }

  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# System Node Pool for critical workloads
resource "google_container_node_pool" "system" {
  name       = "${var.environment}-system-pool"
  location   = var.region
  cluster    = google_container_cluster.main.name
  node_count = var.system_node_count

  node_config {
    preemptible  = false
    machine_type = var.system_node_machine_type
    disk_size_gb = var.node_disk_size
    disk_type    = "pd-ssd"

    service_account = google_service_account.gke_nodes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = merge(var.common_labels, {
      "node-type" = "system"
    })

    tags = ["gke-node", "${var.environment}-gke-system-node"]

    taint {
      key    = "CriticalAddonsOnly"
      value  = "true"
      effect = "NO_SCHEDULE"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# Cloud SQL PostgreSQL Instance
resource "google_sql_database_instance" "main" {
  name             = "${var.environment}-postgresql"
  database_version = "POSTGRES_${var.postgresql_version}"
  region           = var.region

  settings {
    tier              = var.database_tier
    availability_type = "REGIONAL"
    disk_type         = "PD_SSD"
    disk_size         = var.database_disk_size
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      location                       = var.region
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = var.database_backup_retention_days
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
      require_ssl     = true
    }

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }

    maintenance_window {
      day          = 7
      hour         = 3
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
  }

  deletion_protection = false

  depends_on = [
    google_service_networking_connection.private_vpc_connection,
    google_project_service.sqladmin,
  ]
}

resource "google_sql_database" "main" {
  name     = var.database_name
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "main" {
  name     = var.database_username
  instance = google_sql_database_instance.main.name
  password = var.database_password
}

# Private Service Connection for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  name          = "${var.environment}-private-ip-address"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# Redis Instance (Memorystore)
resource "google_redis_instance" "main" {
  name           = "${var.environment}-redis"
  tier           = var.redis_tier
  memory_size_gb = var.redis_memory_size_gb
  region         = var.region

  location_id             = "${var.region}-a"
  alternative_location_id = "${var.region}-b"

  authorized_network = google_compute_network.main.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version     = var.redis_version
  display_name      = "${var.environment} Redis Instance"
  reserved_ip_range = var.redis_reserved_ip_range

  auth_enabled   = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 3
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  depends_on = [google_project_service.redis]
}

# Cloud Storage Bucket
resource "google_storage_bucket" "main" {
  name          = "${var.environment}-orchestrator-storage-${random_id.bucket_suffix.hex}"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = var.storage_lifecycle_age_days
    }
    action {
      type = "Delete"
    }
  }

  encryption {
    default_kms_key_name = google_kms_crypto_key.storage.id
  }

  labels = var.common_labels
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# Enable required APIs
resource "google_project_service" "container" {
  service = "container.googleapis.com"

  disable_dependent_services = true
}

resource "google_project_service" "compute" {
  service = "compute.googleapis.com"

  disable_dependent_services = true
}

resource "google_project_service" "sqladmin" {
  service = "sqladmin.googleapis.com"

  disable_dependent_services = true
}

resource "google_project_service" "redis" {
  service = "redis.googleapis.com"

  disable_dependent_services = true
}

resource "google_project_service" "servicenetworking" {
  service = "servicenetworking.googleapis.com"

  disable_dependent_services = true
}

resource "google_project_service" "cloudkms" {
  service = "cloudkms.googleapis.com"

  disable_dependent_services = true
}

# Service Account for GKE nodes
resource "google_service_account" "gke_nodes" {
  account_id   = "${var.environment}-gke-nodes"
  display_name = "GKE Nodes Service Account"
}

resource "google_project_iam_member" "gke_nodes" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/stackdriver.resourceMetadata.writer",
    "roles/storage.objectViewer",
  ])

  role   = each.value
  member = "serviceAccount:${google_service_account.gke_nodes.email}"
}

# KMS Key Ring and Keys
resource "google_kms_key_ring" "main" {
  name     = "${var.environment}-keyring"
  location = var.region

  depends_on = [google_project_service.cloudkms]
}

resource "google_kms_crypto_key" "gke" {
  name     = "${var.environment}-gke-key"
  key_ring = google_kms_key_ring.main.id

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_kms_crypto_key" "storage" {
  name     = "${var.environment}-storage-key"
  key_ring = google_kms_key_ring.main.id

  lifecycle {
    prevent_destroy = true
  }
}

# Load Balancer
resource "google_compute_global_address" "main" {
  name = "${var.environment}-lb-ip"
}

# Cloud Armor Security Policy
resource "google_compute_security_policy" "main" {
  name = "${var.environment}-security-policy"

  rule {
    action   = "allow"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Allow all traffic"
  }

  rule {
    action   = "deny(403)"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default deny rule"
  }

  adaptive_protection_config {
    layer_7_ddos_defense_config {
      enable = true
    }
  }
}