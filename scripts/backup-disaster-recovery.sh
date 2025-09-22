#!/bin/bash

# Backup and Disaster Recovery Script for Robust AI Orchestrator
# Comprehensive backup, restore, and disaster recovery procedures

set -e

# Configuration
BACKUP_DIR=${BACKUP_DIR:-"/backups"}
S3_BUCKET=${S3_BUCKET:-"orchestrator-backups"}
RETENTION_DAYS=${RETENTION_DAYS:-30}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Database configuration
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-"orchestrator"}
DB_USER=${DB_USER:-"postgres"}
DB_PASSWORD=${DB_PASSWORD:-"password"}

# Redis configuration
REDIS_HOST=${REDIS_HOST:-"localhost"}
REDIS_PORT=${REDIS_PORT:-6379}

# Elasticsearch configuration
ES_HOST=${ES_HOST:-"localhost"}
ES_PORT=${ES_PORT:-9200}

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to create backup directory
create_backup_dir() {
    local backup_path="$BACKUP_DIR/$TIMESTAMP"
    mkdir -p "$backup_path"
    echo "$backup_path"
}

# Function to backup PostgreSQL database
backup_postgresql() {
    local backup_path="$1"
    log "Starting PostgreSQL backup..."
    
    # Full database backup
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --verbose \
        --no-password \
        --format=custom \
        --compress=9 \
        > "$backup_path/postgresql_$TIMESTAMP.dump"
    
    # Schema-only backup for quick restore testing
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --schema-only \
        --no-password \
        > "$backup_path/postgresql_schema_$TIMESTAMP.sql"
    
    # Individual table backups for critical data
    critical_tables=("users" "workflows" "executions" "organizations")
    
    for table in "${critical_tables[@]}"; do
        PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --table="$table" \
            --data-only \
            --no-password \
            > "$backup_path/table_${table}_$TIMESTAMP.sql"
    done
    
    log "PostgreSQL backup completed"
}

# Function to backup Redis data
backup_redis() {
    local backup_path="$1"
    log "Starting Redis backup..."
    
    # Create Redis backup
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" BGSAVE
    
    # Wait for backup to complete
    while [ "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LASTSAVE)" = "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LASTSAVE)" ]; do
        sleep 1
    done
    
    # Copy RDB file
    docker cp redis-container:/data/dump.rdb "$backup_path/redis_$TIMESTAMP.rdb"
    
    # Export Redis configuration
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" CONFIG GET "*" > "$backup_path/redis_config_$TIMESTAMP.txt"
    
    log "Redis backup completed"
}

# Function to backup Elasticsearch data
backup_elasticsearch() {
    local backup_path="$1"
    log "Starting Elasticsearch backup..."
    
    # Create snapshot repository if it doesn't exist
    curl -X PUT "$ES_HOST:$ES_PORT/_snapshot/backup_repo" \
        -H 'Content-Type: application/json' \
        -d "{
            \"type\": \"fs\",
            \"settings\": {
                \"location\": \"/usr/share/elasticsearch/backups\"
            }
        }"
    
    # Create snapshot
    curl -X PUT "$ES_HOST:$ES_PORT/_snapshot/backup_repo/snapshot_$TIMESTAMP" \
        -H 'Content-Type: application/json' \
        -d "{
            \"indices\": \"*\",
            \"ignore_unavailable\": true,
            \"include_global_state\": false
        }"
    
    # Wait for snapshot to complete
    while true; do
        status=$(curl -s "$ES_HOST:$ES_PORT/_snapshot/backup_repo/snapshot_$TIMESTAMP" | jq -r '.snapshots[0].state')
        if [ "$status" = "SUCCESS" ]; then
            break
        elif [ "$status" = "FAILED" ]; then
            log "ERROR: Elasticsearch snapshot failed"
            exit 1
        fi
        sleep 5
    done
    
    # Export Elasticsearch mappings and settings
    curl -s "$ES_HOST:$ES_PORT/_mapping" > "$backup_path/elasticsearch_mappings_$TIMESTAMP.json"
    curl -s "$ES_HOST:$ES_PORT/_settings" > "$backup_path/elasticsearch_settings_$TIMESTAMP.json"
    
    log "Elasticsearch backup completed"
}

# Function to backup application files
backup_application_files() {
    local backup_path="$1"
    log "Starting application files backup..."
    
    # Backup configuration files
    mkdir -p "$backup_path/config"
    cp -r ./config/* "$backup_path/config/" 2>/dev/null || true
    cp .env* "$backup_path/config/" 2>/dev/null || true
    
    # Backup uploaded files and artifacts
    if [ -d "./uploads" ]; then
        tar -czf "$backup_path/uploads_$TIMESTAMP.tar.gz" ./uploads/
    fi
    
    # Backup logs (last 7 days)
    if [ -d "./logs" ]; then
        find ./logs -name "*.log" -mtime -7 -exec tar -czf "$backup_path/logs_$TIMESTAMP.tar.gz" {} +
    fi
    
    # Backup SSL certificates
    if [ -d "./certs" ]; then
        tar -czf "$backup_path/certs_$TIMESTAMP.tar.gz" ./certs/
    fi
    
    log "Application files backup completed"
}

# Function to create backup manifest
create_backup_manifest() {
    local backup_path="$1"
    log "Creating backup manifest..."
    
    cat > "$backup_path/manifest.json" << EOF
{
    "timestamp": "$TIMESTAMP",
    "backup_date": "$(date -Iseconds)",
    "version": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "components": {
        "postgresql": {
            "file": "postgresql_$TIMESTAMP.dump",
            "schema_file": "postgresql_schema_$TIMESTAMP.sql",
            "size": "$(du -h "$backup_path/postgresql_$TIMESTAMP.dump" | cut -f1)"
        },
        "redis": {
            "file": "redis_$TIMESTAMP.rdb",
            "config_file": "redis_config_$TIMESTAMP.txt",
            "size": "$(du -h "$backup_path/redis_$TIMESTAMP.rdb" | cut -f1)"
        },
        "elasticsearch": {
            "snapshot": "snapshot_$TIMESTAMP",
            "mappings_file": "elasticsearch_mappings_$TIMESTAMP.json",
            "settings_file": "elasticsearch_settings_$TIMESTAMP.json"
        },
        "application": {
            "uploads": "uploads_$TIMESTAMP.tar.gz",
            "logs": "logs_$TIMESTAMP.tar.gz",
            "certs": "certs_$TIMESTAMP.tar.gz"
        }
    },
    "backup_size": "$(du -sh "$backup_path" | cut -f1)",
    "checksum": "$(find "$backup_path" -type f -exec md5sum {} + | md5sum | cut -d' ' -f1)"
}
EOF
    
    log "Backup manifest created"
}

# Function to upload backup to S3
upload_to_s3() {
    local backup_path="$1"
    log "Uploading backup to S3..."
    
    # Create compressed archive
    tar -czf "$backup_path.tar.gz" -C "$BACKUP_DIR" "$(basename "$backup_path")"
    
    # Upload to S3
    aws s3 cp "$backup_path.tar.gz" "s3://$S3_BUCKET/backups/$(basename "$backup_path").tar.gz" \
        --storage-class STANDARD_IA
    
    # Upload manifest separately for quick access
    aws s3 cp "$backup_path/manifest.json" "s3://$S3_BUCKET/manifests/manifest_$TIMESTAMP.json"
    
    # Clean up local compressed archive
    rm "$backup_path.tar.gz"
    
    log "Backup uploaded to S3"
}

# Function to restore PostgreSQL database
restore_postgresql() {
    local backup_file="$1"
    log "Restoring PostgreSQL database from $backup_file..."
    
    # Create new database if it doesn't exist
    PGPASSWORD="$DB_PASSWORD" createdb \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        "$DB_NAME" 2>/dev/null || true
    
    # Restore database
    PGPASSWORD="$DB_PASSWORD" pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --clean \
        --if-exists \
        --no-password \
        --verbose \
        "$backup_file"
    
    log "PostgreSQL database restored"
}

# Function to restore Redis data
restore_redis() {
    local backup_file="$1"
    log "Restoring Redis data from $backup_file..."
    
    # Stop Redis temporarily
    docker stop redis-container
    
    # Replace RDB file
    docker cp "$backup_file" redis-container:/data/dump.rdb
    
    # Start Redis
    docker start redis-container
    
    # Wait for Redis to be ready
    while ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; do
        sleep 1
    done
    
    log "Redis data restored"
}

# Function to restore Elasticsearch data
restore_elasticsearch() {
    local snapshot_name="$1"
    log "Restoring Elasticsearch data from snapshot $snapshot_name..."
    
    # Close all indices
    curl -X POST "$ES_HOST:$ES_PORT/_all/_close"
    
    # Restore snapshot
    curl -X POST "$ES_HOST:$ES_PORT/_snapshot/backup_repo/$snapshot_name/_restore" \
        -H 'Content-Type: application/json' \
        -d '{
            "indices": "*",
            "ignore_unavailable": true,
            "include_global_state": false
        }'
    
    # Wait for restore to complete
    while true; do
        status=$(curl -s "$ES_HOST:$ES_PORT/_snapshot/backup_repo/$snapshot_name/_status" | jq -r '.snapshots[0].state')
        if [ "$status" = "SUCCESS" ]; then
            break
        elif [ "$status" = "FAILED" ]; then
            log "ERROR: Elasticsearch restore failed"
            exit 1
        fi
        sleep 5
    done
    
    log "Elasticsearch data restored"
}

# Function to cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Local cleanup
    find "$BACKUP_DIR" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} +
    
    # S3 cleanup
    aws s3 ls "s3://$S3_BUCKET/backups/" | while read -r line; do
        backup_date=$(echo "$line" | awk '{print $1}')
        backup_file=$(echo "$line" | awk '{print $4}')
        
        if [ -n "$backup_date" ] && [ -n "$backup_file" ]; then
            days_old=$(( ($(date +%s) - $(date -d "$backup_date" +%s)) / 86400 ))
            
            if [ $days_old -gt $RETENTION_DAYS ]; then
                aws s3 rm "s3://$S3_BUCKET/backups/$backup_file"
                log "Deleted old backup: $backup_file"
            fi
        fi
    done
    
    log "Old backups cleaned up"
}

# Function to test backup integrity
test_backup_integrity() {
    local backup_path="$1"
    log "Testing backup integrity..."
    
    # Verify all expected files exist
    expected_files=(
        "postgresql_$TIMESTAMP.dump"
        "redis_$TIMESTAMP.rdb"
        "manifest.json"
    )
    
    for file in "${expected_files[@]}"; do
        if [ ! -f "$backup_path/$file" ]; then
            log "ERROR: Missing backup file: $file"
            return 1
        fi
    done
    
    # Test PostgreSQL backup
    PGPASSWORD="$DB_PASSWORD" pg_restore --list "$backup_path/postgresql_$TIMESTAMP.dump" > /dev/null
    
    # Verify manifest checksum
    current_checksum=$(find "$backup_path" -type f -exec md5sum {} + | md5sum | cut -d' ' -f1)
    manifest_checksum=$(jq -r '.checksum' "$backup_path/manifest.json")
    
    if [ "$current_checksum" != "$manifest_checksum" ]; then
        log "ERROR: Backup checksum mismatch"
        return 1
    fi
    
    log "Backup integrity test passed"
    return 0
}

# Function to perform disaster recovery
disaster_recovery() {
    local backup_timestamp="$1"
    log "Starting disaster recovery for backup: $backup_timestamp"
    
    # Download backup from S3 if needed
    if [ ! -d "$BACKUP_DIR/$backup_timestamp" ]; then
        log "Downloading backup from S3..."
        aws s3 cp "s3://$S3_BUCKET/backups/$backup_timestamp.tar.gz" "/tmp/"
        tar -xzf "/tmp/$backup_timestamp.tar.gz" -C "$BACKUP_DIR"
        rm "/tmp/$backup_timestamp.tar.gz"
    fi
    
    local backup_path="$BACKUP_DIR/$backup_timestamp"
    
    # Test backup integrity
    if ! test_backup_integrity "$backup_path"; then
        log "ERROR: Backup integrity test failed"
        exit 1
    fi
    
    # Stop services
    log "Stopping services..."
    docker-compose down
    
    # Restore databases
    restore_postgresql "$backup_path/postgresql_$backup_timestamp.dump"
    restore_redis "$backup_path/redis_$backup_timestamp.rdb"
    restore_elasticsearch "snapshot_$backup_timestamp"
    
    # Restore application files
    if [ -f "$backup_path/uploads_$backup_timestamp.tar.gz" ]; then
        tar -xzf "$backup_path/uploads_$backup_timestamp.tar.gz" -C ./
    fi
    
    if [ -f "$backup_path/certs_$backup_timestamp.tar.gz" ]; then
        tar -xzf "$backup_path/certs_$backup_timestamp.tar.gz" -C ./
    fi
    
    # Start services
    log "Starting services..."
    docker-compose up -d
    
    # Wait for services to be ready
    sleep 30
    
    # Verify system health
    if curl -f "http://localhost:3000/api/health" > /dev/null 2>&1; then
        log "Disaster recovery completed successfully"
    else
        log "ERROR: System health check failed after recovery"
        exit 1
    fi
}

# Main backup function
perform_backup() {
    log "Starting backup process..."
    
    local backup_path
    backup_path=$(create_backup_dir)
    
    # Perform backups
    backup_postgresql "$backup_path"
    backup_redis "$backup_path"
    backup_elasticsearch "$backup_path"
    backup_application_files "$backup_path"
    
    # Create manifest
    create_backup_manifest "$backup_path"
    
    # Test backup integrity
    if ! test_backup_integrity "$backup_path"; then
        log "ERROR: Backup integrity test failed"
        exit 1
    fi
    
    # Upload to S3
    upload_to_s3 "$backup_path"
    
    # Cleanup old backups
    cleanup_old_backups
    
    log "Backup process completed successfully"
    log "Backup location: $backup_path"
}

# Function to list available backups
list_backups() {
    log "Available backups:"
    
    # Local backups
    echo "Local backups:"
    ls -la "$BACKUP_DIR" | grep "^d" | awk '{print $9}' | grep -E "^[0-9]{8}_[0-9]{6}$" || echo "No local backups found"
    
    # S3 backups
    echo "S3 backups:"
    aws s3 ls "s3://$S3_BUCKET/backups/" | awk '{print $4}' | sed 's/.tar.gz$//' || echo "No S3 backups found"
}

# Main function
main() {
    case "${1:-backup}" in
        "backup")
            perform_backup
            ;;
        "restore")
            if [ -z "$2" ]; then
                echo "Usage: $0 restore <backup_timestamp>"
                exit 1
            fi
            disaster_recovery "$2"
            ;;
        "list")
            list_backups
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        "test")
            if [ -z "$2" ]; then
                echo "Usage: $0 test <backup_path>"
                exit 1
            fi
            test_backup_integrity "$2"
            ;;
        *)
            echo "Usage: $0 {backup|restore|list|cleanup|test}"
            echo "  backup                    - Perform full system backup"
            echo "  restore <timestamp>       - Restore from backup"
            echo "  list                      - List available backups"
            echo "  cleanup                   - Remove old backups"
            echo "  test <path>              - Test backup integrity"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"