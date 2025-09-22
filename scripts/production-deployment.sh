#!/bin/bash

# Production Deployment and Rollback Script for Robust AI Orchestrator
# Zero-downtime deployment with automated rollback capabilities

set -e

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"production"}
NAMESPACE=${NAMESPACE:-"orchestrator-prod"}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"your-registry.com"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}
ROLLBACK_TIMEOUT=${ROLLBACK_TIMEOUT:-600}

# Deployment configuration
DEPLOYMENT_STRATEGY=${DEPLOYMENT_STRATEGY:-"rolling"}
MAX_UNAVAILABLE=${MAX_UNAVAILABLE:-"25%"}
MAX_SURGE=${MAX_SURGE:-"25%"}

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check kubectl access
    if ! kubectl cluster-info > /dev/null 2>&1; then
        log "ERROR: kubectl not configured or cluster not accessible"
        exit 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" > /dev/null 2>&1; then
        log "Creating namespace: $NAMESPACE"
        kubectl create namespace "$NAMESPACE"
    fi
    
    # Check Docker registry access
    if ! docker pull "$DOCKER_REGISTRY/orchestrator-api:$IMAGE_TAG" > /dev/null 2>&1; then
        log "ERROR: Cannot pull image from registry"
        exit 1
    fi
    
    # Check required secrets exist
    required_secrets=("db-credentials" "redis-credentials" "jwt-secret" "oauth-secrets")
    for secret in "${required_secrets[@]}"; do
        if ! kubectl get secret "$secret" -n "$NAMESPACE" > /dev/null 2>&1; then
            log "ERROR: Required secret not found: $secret"
            exit 1
        fi
    done
    
    log "Prerequisites check passed"
}

# Function to backup current deployment
backup_current_deployment() {
    log "Backing up current deployment state..."
    
    local backup_dir="./deployment-backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup all deployments
    kubectl get deployments -n "$NAMESPACE" -o yaml > "$backup_dir/deployments.yaml"
    
    # Backup all services
    kubectl get services -n "$NAMESPACE" -o yaml > "$backup_dir/services.yaml"
    
    # Backup all configmaps
    kubectl get configmaps -n "$NAMESPACE" -o yaml > "$backup_dir/configmaps.yaml"
    
    # Backup all ingress
    kubectl get ingress -n "$NAMESPACE" -o yaml > "$backup_dir/ingress.yaml"
    
    # Store current image tags
    kubectl get deployments -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[0].image}{"\n"}{end}' > "$backup_dir/current-images.txt"
    
    echo "$backup_dir" > ./last-backup-path.txt
    
    log "Deployment backup completed: $backup_dir"
}

# Function to update deployment manifests
update_deployment_manifests() {
    log "Updating deployment manifests..."
    
    # Update image tags in deployment files
    find ./k8s/manifests -name "*.yaml" -exec sed -i "s|image: .*orchestrator-.*:.*|image: $DOCKER_REGISTRY/orchestrator-api:$IMAGE_TAG|g" {} \;
    find ./k8s/manifests -name "*.yaml" -exec sed -i "s|image: .*orchestrator-worker:.*|image: $DOCKER_REGISTRY/orchestrator-worker:$IMAGE_TAG|g" {} \;
    find ./k8s/manifests -name "*.yaml" -exec sed -i "s|image: .*orchestrator-frontend:.*|image: $DOCKER_REGISTRY/orchestrator-frontend:$IMAGE_TAG|g" {} \;
    
    # Update deployment strategy
    find ./k8s/manifests -name "*deployment*.yaml" -exec sed -i "s|maxUnavailable: .*|maxUnavailable: $MAX_UNAVAILABLE|g" {} \;
    find ./k8s/manifests -name "*deployment*.yaml" -exec sed -i "s|maxSurge: .*|maxSurge: $MAX_SURGE|g" {} \;
    
    log "Deployment manifests updated"
}

# Function to run pre-deployment tests
run_pre_deployment_tests() {
    log "Running pre-deployment tests..."
    
    # Build and test images locally
    docker build -t "test-orchestrator-api:$IMAGE_TAG" -f Dockerfile.api .
    docker build -t "test-orchestrator-worker:$IMAGE_TAG" -f Dockerfile.worker .
    docker build -t "test-orchestrator-frontend:$IMAGE_TAG" -f Dockerfile.frontend .
    
    # Run security scan
    if command -v trivy > /dev/null 2>&1; then
        trivy image "test-orchestrator-api:$IMAGE_TAG"
        trivy image "test-orchestrator-worker:$IMAGE_TAG"
        trivy image "test-orchestrator-frontend:$IMAGE_TAG"
    fi
    
    # Run unit tests
    npm test
    
    # Run integration tests
    npm run test:integration
    
    log "Pre-deployment tests passed"
}

# Function to deploy database migrations
deploy_database_migrations() {
    log "Deploying database migrations..."
    
    # Create migration job
    cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration-$(date +%s)
  namespace: $NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: migration
        image: $DOCKER_REGISTRY/orchestrator-api:$IMAGE_TAG
        command: ["npm", "run", "migrate"]
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: db-credentials
      restartPolicy: Never
  backoffLimit: 3
EOF
    
    # Wait for migration to complete
    local job_name="db-migration-$(date +%s)"
    kubectl wait --for=condition=complete job/"$job_name" -n "$NAMESPACE" --timeout=300s
    
    if kubectl get job "$job_name" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' | grep -q "True"; then
        log "ERROR: Database migration failed"
        kubectl logs job/"$job_name" -n "$NAMESPACE"
        exit 1
    fi
    
    log "Database migrations completed"
}

# Function to deploy application
deploy_application() {
    log "Deploying application..."
    
    case "$DEPLOYMENT_STRATEGY" in
        "rolling")
            deploy_rolling_update
            ;;
        "blue-green")
            deploy_blue_green
            ;;
        "canary")
            deploy_canary
            ;;
        *)
            log "ERROR: Unknown deployment strategy: $DEPLOYMENT_STRATEGY"
            exit 1
            ;;
    esac
}

# Function for rolling update deployment
deploy_rolling_update() {
    log "Performing rolling update deployment..."
    
    # Apply all manifests
    kubectl apply -f ./k8s/manifests/ -n "$NAMESPACE"
    
    # Wait for rollout to complete
    deployments=$(kubectl get deployments -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    for deployment in $deployments; do
        log "Waiting for deployment: $deployment"
        kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout=600s
    done
    
    log "Rolling update deployment completed"
}

# Function for blue-green deployment
deploy_blue_green() {
    log "Performing blue-green deployment..."
    
    # Determine current and new environments
    local current_env
    current_env=$(kubectl get service orchestrator-api -n "$NAMESPACE" -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "blue")
    local new_env
    if [ "$current_env" = "blue" ]; then
        new_env="green"
    else
        new_env="blue"
    fi
    
    log "Current environment: $current_env, deploying to: $new_env"
    
    # Update manifests with new environment label
    find ./k8s/manifests -name "*deployment*.yaml" -exec sed -i "s|version: .*|version: $new_env|g" {} \;
    
    # Deploy to new environment
    kubectl apply -f ./k8s/manifests/ -n "$NAMESPACE"
    
    # Wait for new environment to be ready
    deployments=$(kubectl get deployments -n "$NAMESPACE" -l version="$new_env" -o jsonpath='{.items[*].metadata.name}')
    
    for deployment in $deployments; do
        kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout=600s
    done
    
    # Run health checks on new environment
    if run_health_checks "$new_env"; then
        # Switch traffic to new environment
        kubectl patch service orchestrator-api -n "$NAMESPACE" -p '{"spec":{"selector":{"version":"'$new_env'"}}}'
        kubectl patch service orchestrator-frontend -n "$NAMESPACE" -p '{"spec":{"selector":{"version":"'$new_env'"}}}'
        
        log "Traffic switched to new environment: $new_env"
        
        # Clean up old environment after successful switch
        sleep 60
        kubectl delete deployments -n "$NAMESPACE" -l version="$current_env"
        
        log "Blue-green deployment completed"
    else
        log "ERROR: Health checks failed for new environment"
        kubectl delete deployments -n "$NAMESPACE" -l version="$new_env"
        exit 1
    fi
}

# Function for canary deployment
deploy_canary() {
    log "Performing canary deployment..."
    
    local canary_percentage=${CANARY_PERCENTAGE:-10}
    
    # Deploy canary version
    find ./k8s/manifests -name "*deployment*.yaml" -exec sed -i "s|version: .*|version: canary|g" {} \;
    find ./k8s/manifests -name "*deployment*.yaml" -exec sed -i "s|replicas: .*|replicas: 1|g" {} \;
    
    kubectl apply -f ./k8s/manifests/ -n "$NAMESPACE"
    
    # Wait for canary to be ready
    deployments=$(kubectl get deployments -n "$NAMESPACE" -l version="canary" -o jsonpath='{.items[*].metadata.name}')
    
    for deployment in $deployments; do
        kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout=600s
    done
    
    # Configure traffic splitting (requires service mesh like Istio)
    if kubectl get virtualservice orchestrator-api -n "$NAMESPACE" > /dev/null 2>&1; then
        kubectl patch virtualservice orchestrator-api -n "$NAMESPACE" --type='json' -p='[
            {
                "op": "replace",
                "path": "/spec/http/0/route",
                "value": [
                    {"destination": {"host": "orchestrator-api", "subset": "stable"}, "weight": '$((100-canary_percentage))'},
                    {"destination": {"host": "orchestrator-api", "subset": "canary"}, "weight": '$canary_percentage'}
                ]
            }
        ]'
    fi
    
    log "Canary deployment active with $canary_percentage% traffic"
    
    # Monitor canary for specified duration
    local monitor_duration=${CANARY_MONITOR_DURATION:-300}
    log "Monitoring canary for $monitor_duration seconds..."
    sleep "$monitor_duration"
    
    # Check canary metrics
    if check_canary_metrics; then
        # Promote canary to full deployment
        log "Promoting canary to full deployment"
        kubectl delete deployments -n "$NAMESPACE" -l version="stable"
        kubectl patch deployments -n "$NAMESPACE" -l version="canary" -p '{"metadata":{"labels":{"version":"stable"}}}'
        kubectl patch virtualservice orchestrator-api -n "$NAMESPACE" --type='json' -p='[
            {"op": "replace", "path": "/spec/http/0/route", "value": [{"destination": {"host": "orchestrator-api", "subset": "stable"}, "weight": 100}]}
        ]'
        
        log "Canary deployment promoted successfully"
    else
        log "ERROR: Canary metrics indicate issues, rolling back"
        rollback_deployment
        exit 1
    fi
}

# Function to run health checks
run_health_checks() {
    local environment=${1:-""}
    log "Running health checks..."
    
    local api_url
    if [ -n "$environment" ]; then
        api_url="http://orchestrator-api-$environment.$NAMESPACE.svc.cluster.local:3000"
    else
        api_url="http://orchestrator-api.$NAMESPACE.svc.cluster.local:3000"
    fi
    
    # Wait for services to be ready
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ]; do
        if kubectl run health-check-pod --rm -i --restart=Never --image=curlimages/curl -- \
           curl -f "$api_url/api/health" > /dev/null 2>&1; then
            break
        fi
        
        attempts=$((attempts + 1))
        log "Health check attempt $attempts/$max_attempts failed, retrying..."
        sleep 10
    done
    
    if [ $attempts -eq $max_attempts ]; then
        log "ERROR: Health checks failed after $max_attempts attempts"
        return 1
    fi
    
    # Run comprehensive health checks
    local health_checks=(
        "/api/health"
        "/api/health/database"
        "/api/health/redis"
        "/api/health/elasticsearch"
    )
    
    for endpoint in "${health_checks[@]}"; do
        if ! kubectl run health-check-pod --rm -i --restart=Never --image=curlimages/curl -- \
             curl -f "$api_url$endpoint" > /dev/null 2>&1; then
            log "ERROR: Health check failed for endpoint: $endpoint"
            return 1
        fi
    done
    
    log "All health checks passed"
    return 0
}

# Function to check canary metrics
check_canary_metrics() {
    log "Checking canary metrics..."
    
    # Check error rate
    local error_rate
    error_rate=$(kubectl exec -n monitoring prometheus-0 -- \
        promtool query instant 'rate(http_requests_total{job="orchestrator-api",code=~"5.."}[5m]) / rate(http_requests_total{job="orchestrator-api"}[5m])' | \
        grep -o '[0-9.]*' | head -1)
    
    if (( $(echo "$error_rate > 0.05" | bc -l) )); then
        log "ERROR: Canary error rate too high: $error_rate"
        return 1
    fi
    
    # Check response time
    local response_time
    response_time=$(kubectl exec -n monitoring prometheus-0 -- \
        promtool query instant 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="orchestrator-api"}[5m]))' | \
        grep -o '[0-9.]*' | head -1)
    
    if (( $(echo "$response_time > 2.0" | bc -l) )); then
        log "ERROR: Canary response time too high: $response_time"
        return 1
    fi
    
    log "Canary metrics are within acceptable thresholds"
    return 0
}

# Function to rollback deployment
rollback_deployment() {
    log "Starting deployment rollback..."
    
    local backup_path
    if [ -f "./last-backup-path.txt" ]; then
        backup_path=$(cat ./last-backup-path.txt)
    else
        log "ERROR: No backup path found"
        exit 1
    fi
    
    if [ ! -d "$backup_path" ]; then
        log "ERROR: Backup directory not found: $backup_path"
        exit 1
    fi
    
    # Restore previous deployment state
    kubectl apply -f "$backup_path/deployments.yaml"
    kubectl apply -f "$backup_path/services.yaml"
    kubectl apply -f "$backup_path/configmaps.yaml"
    kubectl apply -f "$backup_path/ingress.yaml"
    
    # Wait for rollback to complete
    deployments=$(kubectl get deployments -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    for deployment in $deployments; do
        log "Waiting for rollback of deployment: $deployment"
        kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout="$ROLLBACK_TIMEOUT"
    done
    
    # Verify rollback health
    if run_health_checks; then
        log "Deployment rollback completed successfully"
    else
        log "ERROR: Rollback health checks failed"
        exit 1
    fi
}

# Function to post-deployment verification
post_deployment_verification() {
    log "Running post-deployment verification..."
    
    # Run smoke tests
    npm run test:smoke
    
    # Check all pods are running
    if kubectl get pods -n "$NAMESPACE" | grep -v Running | grep -v Completed > /dev/null; then
        log "ERROR: Some pods are not in Running state"
        kubectl get pods -n "$NAMESPACE"
        exit 1
    fi
    
    # Check resource usage
    kubectl top pods -n "$NAMESPACE"
    
    # Verify external connectivity
    if ! curl -f "https://your-domain.com/api/health" > /dev/null 2>&1; then
        log "ERROR: External health check failed"
        exit 1
    fi
    
    log "Post-deployment verification completed"
}

# Function to send deployment notifications
send_deployment_notification() {
    local status="$1"
    local message="$2"
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Deployment $status: $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    # Email notification (if configured)
    if [ -n "$NOTIFICATION_EMAIL" ]; then
        echo "$message" | mail -s "Deployment $status" "$NOTIFICATION_EMAIL"
    fi
}

# Main deployment function
main_deploy() {
    log "Starting production deployment..."
    
    # Send start notification
    send_deployment_notification "STARTED" "Deployment to $ENVIRONMENT started with image tag: $IMAGE_TAG"
    
    # Run deployment steps
    check_prerequisites
    backup_current_deployment
    update_deployment_manifests
    run_pre_deployment_tests
    deploy_database_migrations
    deploy_application
    
    # Health checks
    if run_health_checks; then
        post_deployment_verification
        send_deployment_notification "SUCCESS" "Deployment to $ENVIRONMENT completed successfully"
        log "Deployment completed successfully"
    else
        log "ERROR: Post-deployment health checks failed, initiating rollback"
        rollback_deployment
        send_deployment_notification "FAILED" "Deployment to $ENVIRONMENT failed and was rolled back"
        exit 1
    fi
}

# Main function
main() {
    case "${1:-deploy}" in
        "deploy")
            main_deploy
            ;;
        "rollback")
            rollback_deployment
            ;;
        "health-check")
            run_health_checks
            ;;
        "backup")
            backup_current_deployment
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|health-check|backup}"
            echo "  deploy       - Perform full deployment"
            echo "  rollback     - Rollback to previous version"
            echo "  health-check - Run health checks"
            echo "  backup       - Backup current deployment state"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"