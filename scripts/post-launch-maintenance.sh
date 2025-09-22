#!/bin/bash

# Post-Launch Maintenance Script for Robust AI Orchestrator
# Automated maintenance tasks and system health monitoring

set -e

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"production"}
NAMESPACE=${NAMESPACE:-"orchestrator-prod"}
LOG_DIR=${LOG_DIR:-"/var/log/orchestrator"}
BACKUP_DIR=${BACKUP_DIR:-"/backups"}
ALERT_EMAIL=${ALERT_EMAIL:-"ops@company.com"}
SLACK_WEBHOOK=${SLACK_WEBHOOK:-""}

# Thresholds
CPU_THRESHOLD=${CPU_THRESHOLD:-80}
MEMORY_THRESHOLD=${MEMORY_THRESHOLD:-85}
DISK_THRESHOLD=${DISK_THRESHOLD:-80}
ERROR_RATE_THRESHOLD=${ERROR_RATE_THRESHOLD:-5}

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/maintenance.log"
}

# Function to send alerts
send_alert() {
    local severity="$1"
    local message="$2"
    
    log "ALERT [$severity]: $message"
    
    # Send email alert
    if [ -n "$ALERT_EMAIL" ]; then
        echo "$message" | mail -s "Orchestrator Alert [$severity]" "$ALERT_EMAIL"
    fi
    
    # Send Slack alert
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Orchestrator Alert [$severity]: $message\"}" \
            "$SLACK_WEBHOOK"
    fi
}

# Function to check system health
check_system_health() {
    log "Starting system health check..."
    
    local health_issues=0
    
    # Check API health
    if ! curl -f -s "http://localhost:3000/api/health" > /dev/null; then
        send_alert "CRITICAL" "API health check failed"
        health_issues=$((health_issues + 1))
    fi
    
    # Check database connectivity
    if ! kubectl exec -n "$NAMESPACE" deployment/postgres -- pg_isready > /dev/null 2>&1; then
        send_alert "CRITICAL" "Database connectivity check failed"
        health_issues=$((health_issues + 1))
    fi
    
    # Check Redis connectivity
    if ! kubectl exec -n "$NAMESPACE" deployment/redis -- redis-cli ping > /dev/null 2>&1; then
        send_alert "CRITICAL" "Redis connectivity check failed"
        health_issues=$((health_issues + 1))
    fi
    
    # Check Elasticsearch health
    if ! curl -f -s "http://elasticsearch:9200/_cluster/health" | jq -r '.status' | grep -E "green|yellow" > /dev/null; then
        send_alert "WARNING" "Elasticsearch cluster health is not optimal"
        health_issues=$((health_issues + 1))
    fi
    
    if [ $health_issues -eq 0 ]; then
        log "System health check passed"
    else
        log "System health check found $health_issues issues"
    fi
    
    return $health_issues
}

# Function to check resource utilization
check_resource_utilization() {
    log "Checking resource utilization..."
    
    # Check CPU usage
    local cpu_usage
    cpu_usage=$(kubectl top nodes --no-headers | awk '{sum+=$3} END {print sum/NR}' | sed 's/%//')
    
    if (( $(echo "$cpu_usage > $CPU_THRESHOLD" | bc -l) )); then
        send_alert "WARNING" "High CPU usage detected: ${cpu_usage}%"
    fi
    
    # Check memory usage
    local memory_usage
    memory_usage=$(kubectl top nodes --no-headers | awk '{sum+=$5} END {print sum/NR}' | sed 's/%//')
    
    if (( $(echo "$memory_usage > $MEMORY_THRESHOLD" | bc -l) )); then
        send_alert "WARNING" "High memory usage detected: ${memory_usage}%"
    fi
    
    # Check disk usage
    local disk_usage
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt "$DISK_THRESHOLD" ]; then
        send_alert "WARNING" "High disk usage detected: ${disk_usage}%"
    fi
    
    # Check pod resource usage
    kubectl top pods -n "$NAMESPACE" --no-headers | while read -r line; do
        local pod_name=$(echo "$line" | awk '{print $1}')
        local pod_cpu=$(echo "$line" | awk '{print $2}' | sed 's/m//')
        local pod_memory=$(echo "$line" | awk '{print $3}' | sed 's/Mi//')
        
        # Alert if pod is using excessive resources
        if [ "$pod_cpu" -gt 1000 ]; then  # More than 1 CPU core
            send_alert "WARNING" "Pod $pod_name using high CPU: ${pod_cpu}m"
        fi
        
        if [ "$pod_memory" -gt 1024 ]; then  # More than 1GB memory
            send_alert "WARNING" "Pod $pod_name using high memory: ${pod_memory}Mi"
        fi
    done
    
    log "Resource utilization check completed"
}

# Function to check application metrics
check_application_metrics() {
    log "Checking application metrics..."
    
    # Check error rate
    local error_rate
    error_rate=$(curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{code=~\"5..\"}[5m])/rate(http_requests_total[5m])*100" | \
        jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0")
    
    if (( $(echo "$error_rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
        send_alert "WARNING" "High error rate detected: ${error_rate}%"
    fi
    
    # Check response time
    local response_time
    response_time=$(curl -s "http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))" | \
        jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0")
    
    if (( $(echo "$response_time > 2.0" | bc -l) )); then
        send_alert "WARNING" "High response time detected: ${response_time}s"
    fi
    
    # Check workflow execution failures
    local workflow_failures
    workflow_failures=$(curl -s "http://prometheus:9090/api/v1/query?query=rate(workflow_executions_total{status=\"failed\"}[5m])" | \
        jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0")
    
    if (( $(echo "$workflow_failures > 0.1" | bc -l) )); then
        send_alert "WARNING" "High workflow failure rate detected: $workflow_failures per second"
    fi
    
    log "Application metrics check completed"
}

# Function to check database performance
check_database_performance() {
    log "Checking database performance..."
    
    # Check for slow queries
    local slow_queries
    slow_queries=$(kubectl exec -n "$NAMESPACE" deployment/postgres -- \
        psql -U postgres -d orchestrator -t -c \
        "SELECT count(*) FROM pg_stat_statements WHERE mean_time > 1000;" 2>/dev/null || echo "0")
    
    if [ "$slow_queries" -gt 10 ]; then
        send_alert "WARNING" "High number of slow queries detected: $slow_queries"
    fi
    
    # Check database connections
    local db_connections
    db_connections=$(kubectl exec -n "$NAMESPACE" deployment/postgres -- \
        psql -U postgres -d orchestrator -t -c \
        "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null || echo "0")
    
    if [ "$db_connections" -gt 80 ]; then  # Assuming max_connections = 100
        send_alert "WARNING" "High number of database connections: $db_connections"
    fi
    
    # Check database size growth
    local db_size
    db_size=$(kubectl exec -n "$NAMESPACE" deployment/postgres -- \
        psql -U postgres -d orchestrator -t -c \
        "SELECT pg_size_pretty(pg_database_size('orchestrator'));" 2>/dev/null || echo "0")
    
    log "Database size: $db_size"
    
    log "Database performance check completed"
}

# Function to check security status
check_security_status() {
    log "Checking security status..."
    
    # Check for failed login attempts
    local failed_logins
    failed_logins=$(grep -c "authentication failed" "$LOG_DIR"/*.log 2>/dev/null || echo "0")
    
    if [ "$failed_logins" -gt 100 ]; then
        send_alert "WARNING" "High number of failed login attempts: $failed_logins"
    fi
    
    # Check SSL certificate expiration
    local cert_expiry
    cert_expiry=$(echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | \
        openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
    
    local days_until_expiry
    days_until_expiry=$(( ($(date -d "$cert_expiry" +%s) - $(date +%s)) / 86400 ))
    
    if [ "$days_until_expiry" -lt 30 ]; then
        send_alert "WARNING" "SSL certificate expires in $days_until_expiry days"
    fi
    
    # Check for security updates
    local security_updates
    security_updates=$(apt list --upgradable 2>/dev/null | grep -c security || echo "0")
    
    if [ "$security_updates" -gt 0 ]; then
        send_alert "INFO" "$security_updates security updates available"
    fi
    
    log "Security status check completed"
}

# Function to perform log analysis
perform_log_analysis() {
    log "Performing log analysis..."
    
    local log_analysis_file="$LOG_DIR/log_analysis_$(date +%Y%m%d).txt"
    
    # Analyze error patterns
    echo "=== Error Analysis ===" > "$log_analysis_file"
    grep -h "ERROR" "$LOG_DIR"/*.log 2>/dev/null | \
        awk '{print $4}' | sort | uniq -c | sort -nr | head -10 >> "$log_analysis_file"
    
    # Analyze API endpoint usage
    echo "=== API Endpoint Usage ===" >> "$log_analysis_file"
    grep -h "GET\|POST\|PUT\|DELETE" "$LOG_DIR"/*.log 2>/dev/null | \
        awk '{print $7}' | sort | uniq -c | sort -nr | head -10 >> "$log_analysis_file"
    
    # Analyze response times
    echo "=== Slow Requests ===" >> "$log_analysis_file"
    grep -h "response_time" "$LOG_DIR"/*.log 2>/dev/null | \
        awk '$NF > 1000 {print}' | head -20 >> "$log_analysis_file"
    
    log "Log analysis completed: $log_analysis_file"
}

# Function to cleanup old logs and data
cleanup_old_data() {
    log "Cleaning up old data..."
    
    # Rotate logs older than 30 days
    find "$LOG_DIR" -name "*.log" -mtime +30 -delete
    
    # Compress logs older than 7 days
    find "$LOG_DIR" -name "*.log" -mtime +7 -exec gzip {} \;
    
    # Clean up old backups (keep last 30 days)
    find "$BACKUP_DIR" -type f -mtime +30 -delete
    
    # Clean up old Docker images
    docker image prune -f --filter "until=168h"  # 7 days
    
    # Clean up completed Kubernetes jobs
    kubectl delete jobs -n "$NAMESPACE" --field-selector status.successful=1
    
    log "Cleanup completed"
}

# Function to update system packages
update_system_packages() {
    log "Checking for system updates..."
    
    # Update package lists
    apt update > /dev/null 2>&1
    
    # Check for security updates
    local security_updates
    security_updates=$(apt list --upgradable 2>/dev/null | grep -c security || echo "0")
    
    if [ "$security_updates" -gt 0 ]; then
        log "Installing $security_updates security updates..."
        DEBIAN_FRONTEND=noninteractive apt upgrade -y
        
        # Check if reboot is required
        if [ -f /var/run/reboot-required ]; then
            send_alert "INFO" "System reboot required after security updates"
        fi
    else
        log "No security updates available"
    fi
}

# Function to backup critical data
backup_critical_data() {
    log "Starting critical data backup..."
    
    # Create backup directory
    local backup_date=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/critical_$backup_date"
    mkdir -p "$backup_path"
    
    # Backup database
    kubectl exec -n "$NAMESPACE" deployment/postgres -- \
        pg_dump -U postgres orchestrator | gzip > "$backup_path/database.sql.gz"
    
    # Backup Redis data
    kubectl exec -n "$NAMESPACE" deployment/redis -- \
        redis-cli BGSAVE > /dev/null
    sleep 5
    kubectl cp "$NAMESPACE/redis-pod:/data/dump.rdb" "$backup_path/redis.rdb"
    
    # Backup configuration files
    kubectl get configmaps -n "$NAMESPACE" -o yaml > "$backup_path/configmaps.yaml"
    kubectl get secrets -n "$NAMESPACE" -o yaml > "$backup_path/secrets.yaml"
    
    # Create backup manifest
    cat > "$backup_path/manifest.json" << EOF
{
    "backup_date": "$(date -Iseconds)",
    "environment": "$ENVIRONMENT",
    "namespace": "$NAMESPACE",
    "components": ["database", "redis", "configmaps", "secrets"]
}
EOF
    
    log "Critical data backup completed: $backup_path"
}

# Function to generate health report
generate_health_report() {
    log "Generating health report..."
    
    local report_file="$LOG_DIR/health_report_$(date +%Y%m%d_%H%M%S).json"
    
    # Collect system metrics
    local cpu_usage=$(kubectl top nodes --no-headers | awk '{sum+=$3} END {print sum/NR}' | sed 's/%//')
    local memory_usage=$(kubectl top nodes --no-headers | awk '{sum+=$5} END {print sum/NR}' | sed 's/%//')
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    # Collect application metrics
    local api_status="unknown"
    if curl -f -s "http://localhost:3000/api/health" > /dev/null; then
        api_status="healthy"
    else
        api_status="unhealthy"
    fi
    
    # Generate JSON report
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "environment": "$ENVIRONMENT",
    "system_metrics": {
        "cpu_usage": "$cpu_usage",
        "memory_usage": "$memory_usage",
        "disk_usage": "$disk_usage"
    },
    "application_status": {
        "api_status": "$api_status",
        "database_status": "$(kubectl exec -n "$NAMESPACE" deployment/postgres -- pg_isready > /dev/null 2>&1 && echo 'healthy' || echo 'unhealthy')",
        "redis_status": "$(kubectl exec -n "$NAMESPACE" deployment/redis -- redis-cli ping > /dev/null 2>&1 && echo 'healthy' || echo 'unhealthy')"
    },
    "pod_count": $(kubectl get pods -n "$NAMESPACE" --no-headers | wc -l),
    "running_pods": $(kubectl get pods -n "$NAMESPACE" --no-headers | grep Running | wc -l)
}
EOF
    
    log "Health report generated: $report_file"
}

# Function to run daily maintenance
run_daily_maintenance() {
    log "Starting daily maintenance routine..."
    
    check_system_health
    check_resource_utilization
    check_application_metrics
    check_database_performance
    check_security_status
    perform_log_analysis
    cleanup_old_data
    generate_health_report
    
    log "Daily maintenance completed"
}

# Function to run weekly maintenance
run_weekly_maintenance() {
    log "Starting weekly maintenance routine..."
    
    run_daily_maintenance
    update_system_packages
    backup_critical_data
    
    # Generate weekly performance report
    local report_file="$LOG_DIR/weekly_performance_$(date +%Y%m%d).txt"
    echo "=== Weekly Performance Report ===" > "$report_file"
    echo "Generated: $(date)" >> "$report_file"
    
    # Add performance metrics
    kubectl top nodes >> "$report_file"
    kubectl top pods -n "$NAMESPACE" >> "$report_file"
    
    log "Weekly maintenance completed"
}

# Function to run emergency maintenance
run_emergency_maintenance() {
    log "Starting emergency maintenance routine..."
    
    # Immediate health checks
    if ! check_system_health; then
        log "Emergency: System health issues detected"
        
        # Attempt automatic recovery
        log "Attempting automatic recovery..."
        
        # Restart unhealthy pods
        kubectl get pods -n "$NAMESPACE" | grep -E "Error|CrashLoopBackOff|ImagePullBackOff" | \
            awk '{print $1}' | xargs -r kubectl delete pod -n "$NAMESPACE"
        
        # Clear Redis cache if needed
        kubectl exec -n "$NAMESPACE" deployment/redis -- redis-cli FLUSHALL
        
        # Restart API service if needed
        kubectl rollout restart deployment/orchestrator-api -n "$NAMESPACE"
        
        # Wait and recheck
        sleep 60
        if check_system_health; then
            send_alert "INFO" "Automatic recovery successful"
        else
            send_alert "CRITICAL" "Automatic recovery failed - manual intervention required"
        fi
    fi
    
    log "Emergency maintenance completed"
}

# Main function
main() {
    # Create log directory if it doesn't exist
    mkdir -p "$LOG_DIR"
    
    case "${1:-daily}" in
        "daily")
            run_daily_maintenance
            ;;
        "weekly")
            run_weekly_maintenance
            ;;
        "emergency")
            run_emergency_maintenance
            ;;
        "health-check")
            check_system_health
            ;;
        "backup")
            backup_critical_data
            ;;
        "cleanup")
            cleanup_old_data
            ;;
        "report")
            generate_health_report
            ;;
        *)
            echo "Usage: $0 {daily|weekly|emergency|health-check|backup|cleanup|report}"
            echo "  daily       - Run daily maintenance tasks"
            echo "  weekly      - Run weekly maintenance tasks"
            echo "  emergency   - Run emergency maintenance and recovery"
            echo "  health-check - Perform system health check"
            echo "  backup      - Backup critical data"
            echo "  cleanup     - Clean up old logs and data"
            echo "  report      - Generate health report"
            exit 1
            ;;
    esac
}

# Set up signal handlers for graceful shutdown
trap 'log "Maintenance script interrupted"; exit 1' INT TERM

# Run main function
main "$@"