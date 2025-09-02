#!/bin/bash

# Kubernetes Deployment Validation Script for AI Orchestrator
# This script validates the deployment of all components

set -e

NAMESPACE=${1:-ai-orchestrator}
TIMEOUT=${2:-300}

echo "🚀 Starting AI Orchestrator deployment validation..."
echo "Namespace: $NAMESPACE"
echo "Timeout: ${TIMEOUT}s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARNING]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
    esac
}

# Function to check if namespace exists
check_namespace() {
    print_status "INFO" "Checking namespace: $NAMESPACE"
    if kubectl get namespace $NAMESPACE >/dev/null 2>&1; then
        print_status "SUCCESS" "Namespace $NAMESPACE exists"
    else
        print_status "ERROR" "Namespace $NAMESPACE does not exist"
        exit 1
    fi
}

# Function to check persistent volumes
check_persistent_volumes() {
    print_status "INFO" "Checking persistent volumes..."
    
    local pvs=("postgres-pv" "redis-pv" "elasticsearch-pv" "file-storage-pv")
    for pv in "${pvs[@]}"; do
        if kubectl get pv $pv >/dev/null 2>&1; then
            local status=$(kubectl get pv $pv -o jsonpath='{.status.phase}')
            if [ "$status" = "Available" ] || [ "$status" = "Bound" ]; then
                print_status "SUCCESS" "PV $pv is $status"
            else
                print_status "WARNING" "PV $pv status: $status"
            fi
        else
            print_status "ERROR" "PV $pv not found"
        fi
    done
}

# Function to check persistent volume claims
check_persistent_volume_claims() {
    print_status "INFO" "Checking persistent volume claims..."
    
    local pvcs=("postgres-pvc" "redis-pvc" "elasticsearch-pvc" "file-storage-pvc")
    for pvc in "${pvcs[@]}"; do
        if kubectl get pvc $pvc -n $NAMESPACE >/dev/null 2>&1; then
            local status=$(kubectl get pvc $pvc -n $NAMESPACE -o jsonpath='{.status.phase}')
            if [ "$status" = "Bound" ]; then
                print_status "SUCCESS" "PVC $pvc is bound"
            else
                print_status "WARNING" "PVC $pvc status: $status"
            fi
        else
            print_status "ERROR" "PVC $pvc not found"
        fi
    done
}

# Function to check deployments
check_deployments() {
    print_status "INFO" "Checking deployments..."
    
    local deployments=("postgres" "redis" "elasticsearch" "api-gateway" "auth-service" 
                      "orchestration-service" "workflow-service" "execution-service" 
                      "monitoring-service" "user-service" "marketplace-service" 
                      "notification-service" "storage-service")
    
    for deployment in "${deployments[@]}"; do
        if kubectl get deployment $deployment -n $NAMESPACE >/dev/null 2>&1; then
            print_status "INFO" "Waiting for deployment $deployment to be ready..."
            if kubectl wait --for=condition=available --timeout=${TIMEOUT}s deployment/$deployment -n $NAMESPACE; then
                local ready=$(kubectl get deployment $deployment -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
                local desired=$(kubectl get deployment $deployment -n $NAMESPACE -o jsonpath='{.spec.replicas}')
                print_status "SUCCESS" "Deployment $deployment is ready ($ready/$desired replicas)"
            else
                print_status "ERROR" "Deployment $deployment failed to become ready within ${TIMEOUT}s"
                kubectl describe deployment $deployment -n $NAMESPACE
            fi
        else
            print_status "ERROR" "Deployment $deployment not found"
        fi
    done
}

# Function to check services
check_services() {
    print_status "INFO" "Checking services..."
    
    local services=("postgres-service" "redis-service" "elasticsearch-service" 
                   "api-gateway-service" "auth-service" "orchestration-service" 
                   "workflow-service" "execution-service" "monitoring-service" 
                   "user-service" "marketplace-service" "notification-service" 
                   "storage-service")
    
    for service in "${services[@]}"; do
        if kubectl get service $service -n $NAMESPACE >/dev/null 2>&1; then
            local endpoints=$(kubectl get endpoints $service -n $NAMESPACE -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w)
            if [ $endpoints -gt 0 ]; then
                print_status "SUCCESS" "Service $service has $endpoints endpoint(s)"
            else
                print_status "WARNING" "Service $service has no endpoints"
            fi
        else
            print_status "ERROR" "Service $service not found"
        fi
    done
}

# Function to check horizontal pod autoscalers
check_hpa() {
    print_status "INFO" "Checking horizontal pod autoscalers..."
    
    local hpas=("api-gateway-hpa" "auth-service-hpa" "orchestration-service-hpa" 
               "workflow-service-hpa" "execution-service-hpa" "monitoring-service-hpa" 
               "user-service-hpa" "marketplace-service-hpa" "notification-service-hpa" 
               "storage-service-hpa")
    
    for hpa in "${hpas[@]}"; do
        if kubectl get hpa $hpa -n $NAMESPACE >/dev/null 2>&1; then
            local targets=$(kubectl get hpa $hpa -n $NAMESPACE -o jsonpath='{.status.currentReplicas}')
            local min=$(kubectl get hpa $hpa -n $NAMESPACE -o jsonpath='{.spec.minReplicas}')
            local max=$(kubectl get hpa $hpa -n $NAMESPACE -o jsonpath='{.spec.maxReplicas}')
            print_status "SUCCESS" "HPA $hpa: $targets replicas (min: $min, max: $max)"
        else
            print_status "WARNING" "HPA $hpa not found"
        fi
    done
}

# Function to check Istio configuration
check_istio() {
    if kubectl get crd gateways.networking.istio.io >/dev/null 2>&1; then
        print_status "INFO" "Checking Istio configuration..."
        
        # Check Gateway
        if kubectl get gateway ai-orchestrator-gateway -n $NAMESPACE >/dev/null 2>&1; then
            print_status "SUCCESS" "Istio Gateway configured"
        else
            print_status "WARNING" "Istio Gateway not found"
        fi
        
        # Check VirtualService
        if kubectl get virtualservice ai-orchestrator-vs -n $NAMESPACE >/dev/null 2>&1; then
            print_status "SUCCESS" "Istio VirtualService configured"
        else
            print_status "WARNING" "Istio VirtualService not found"
        fi
        
        # Check DestinationRules
        local drs=("api-gateway-dr" "auth-service-dr" "orchestration-service-dr" 
                  "workflow-service-dr" "execution-service-dr" "monitoring-service-dr")
        for dr in "${drs[@]}"; do
            if kubectl get destinationrule $dr -n $NAMESPACE >/dev/null 2>&1; then
                print_status "SUCCESS" "DestinationRule $dr configured"
            else
                print_status "WARNING" "DestinationRule $dr not found"
            fi
        done
        
        # Check Security Policies
        if kubectl get peerauthentication default -n $NAMESPACE >/dev/null 2>&1; then
            print_status "SUCCESS" "Istio mTLS policy configured"
        else
            print_status "WARNING" "Istio mTLS policy not found"
        fi
    else
        print_status "INFO" "Istio not installed, skipping Istio checks"
    fi
}

# Function to perform health checks
perform_health_checks() {
    print_status "INFO" "Performing health checks..."
    
    # Get API Gateway service endpoint
    local api_gateway_ip=$(kubectl get service api-gateway-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [ -z "$api_gateway_ip" ]; then
        api_gateway_ip=$(kubectl get service api-gateway-service -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')
    fi
    
    if [ -n "$api_gateway_ip" ]; then
        print_status "INFO" "Testing API Gateway health endpoint..."
        if kubectl run health-check --rm -i --restart=Never --image=curlimages/curl -- curl -f http://$api_gateway_ip/health --max-time 10; then
            print_status "SUCCESS" "API Gateway health check passed"
        else
            print_status "WARNING" "API Gateway health check failed"
        fi
    else
        print_status "WARNING" "Could not determine API Gateway IP"
    fi
}

# Function to check resource usage
check_resource_usage() {
    print_status "INFO" "Checking resource usage..."
    
    # Check node resources
    kubectl top nodes 2>/dev/null || print_status "WARNING" "Could not get node metrics (metrics-server may not be installed)"
    
    # Check pod resources
    kubectl top pods -n $NAMESPACE 2>/dev/null || print_status "WARNING" "Could not get pod metrics (metrics-server may not be installed)"
}

# Function to generate deployment report
generate_report() {
    print_status "INFO" "Generating deployment report..."
    
    local report_file="deployment-validation-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "AI Orchestrator Deployment Validation Report"
        echo "============================================="
        echo "Date: $(date)"
        echo "Namespace: $NAMESPACE"
        echo ""
        
        echo "Deployments:"
        kubectl get deployments -n $NAMESPACE -o wide
        echo ""
        
        echo "Services:"
        kubectl get services -n $NAMESPACE -o wide
        echo ""
        
        echo "Pods:"
        kubectl get pods -n $NAMESPACE -o wide
        echo ""
        
        echo "Persistent Volumes:"
        kubectl get pv
        echo ""
        
        echo "Persistent Volume Claims:"
        kubectl get pvc -n $NAMESPACE
        echo ""
        
        echo "Horizontal Pod Autoscalers:"
        kubectl get hpa -n $NAMESPACE
        echo ""
        
        if kubectl get crd gateways.networking.istio.io >/dev/null 2>&1; then
            echo "Istio Configuration:"
            kubectl get gateway,virtualservice,destinationrule,peerauthentication -n $NAMESPACE
            echo ""
        fi
        
    } > $report_file
    
    print_status "SUCCESS" "Deployment report saved to: $report_file"
}

# Main validation flow
main() {
    echo "========================================"
    echo "AI Orchestrator Deployment Validation"
    echo "========================================"
    
    check_namespace
    check_persistent_volumes
    check_persistent_volume_claims
    check_deployments
    check_services
    check_hpa
    check_istio
    perform_health_checks
    check_resource_usage
    generate_report
    
    print_status "SUCCESS" "Deployment validation completed!"
    echo ""
    echo "Next steps:"
    echo "1. Review the deployment report for any warnings"
    echo "2. Configure DNS or load balancer for external access"
    echo "3. Set up monitoring dashboards"
    echo "4. Configure backup procedures"
    echo ""
    echo "Access the application:"
    echo "- Internal: http://api-gateway-service.$NAMESPACE.svc.cluster.local"
    echo "- External: Configure ingress or load balancer"
}

# Run main function
main "$@"