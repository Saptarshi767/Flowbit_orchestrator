#!/bin/bash

# AI Orchestrator Deployment Script
# This script deploys the AI Orchestrator platform to Kubernetes

set -e

# Configuration
NAMESPACE=${1:-ai-orchestrator}
DEPLOYMENT_TYPE=${2:-manifests}  # manifests or helm
HELM_RELEASE_NAME=${3:-ai-orchestrator}

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

# Function to check prerequisites
check_prerequisites() {
    print_status "INFO" "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_status "ERROR" "kubectl is not installed"
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        print_status "ERROR" "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check Helm if using Helm deployment
    if [ "$DEPLOYMENT_TYPE" = "helm" ]; then
        if ! command -v helm &> /dev/null; then
            print_status "ERROR" "Helm is not installed"
            exit 1
        fi
    fi
    
    print_status "SUCCESS" "Prerequisites check passed"
}

# Function to create namespace
create_namespace() {
    print_status "INFO" "Creating namespace: $NAMESPACE"
    
    if kubectl get namespace $NAMESPACE >/dev/null 2>&1; then
        print_status "WARNING" "Namespace $NAMESPACE already exists"
    else
        kubectl apply -f k8s/manifests/namespace.yaml
        print_status "SUCCESS" "Namespace $NAMESPACE created"
    fi
}

# Function to deploy with raw manifests
deploy_with_manifests() {
    print_status "INFO" "Deploying with Kubernetes manifests..."
    
    # Deploy in order
    local manifest_files=(
        "k8s/manifests/namespace.yaml"
        "k8s/manifests/configmap.yaml"
        "k8s/manifests/secrets.yaml"
        "k8s/manifests/persistent-volumes.yaml"
        "k8s/manifests/postgres.yaml"
        "k8s/manifests/redis.yaml"
        "k8s/manifests/elasticsearch.yaml"
        "k8s/manifests/api-gateway.yaml"
        "k8s/manifests/auth-service.yaml"
        "k8s/manifests/orchestration-service.yaml"
        "k8s/manifests/workflow-service.yaml"
        "k8s/manifests/execution-service.yaml"
        "k8s/manifests/monitoring-service.yaml"
        "k8s/manifests/user-service.yaml"
        "k8s/manifests/marketplace-service.yaml"
        "k8s/manifests/notification-service.yaml"
        "k8s/manifests/storage-service.yaml"
    )
    
    for manifest in "${manifest_files[@]}"; do
        if [ -f "$manifest" ]; then
            print_status "INFO" "Applying $manifest"
            kubectl apply -f "$manifest"
        else
            print_status "WARNING" "Manifest file $manifest not found"
        fi
    done
    
    print_status "SUCCESS" "Manifests deployed"
}

# Function to deploy Istio configuration
deploy_istio() {
    print_status "INFO" "Checking for Istio installation..."
    
    if kubectl get crd gateways.networking.istio.io >/dev/null 2>&1; then
        print_status "INFO" "Istio detected, deploying service mesh configuration..."
        
        local istio_files=(
            "k8s/istio/gateway.yaml"
            "k8s/istio/destination-rules.yaml"
            "k8s/istio/security-policies.yaml"
        )
        
        for istio_file in "${istio_files[@]}"; do
            if [ -f "$istio_file" ]; then
                print_status "INFO" "Applying $istio_file"
                kubectl apply -f "$istio_file"
            else
                print_status "WARNING" "Istio file $istio_file not found"
            fi
        done
        
        print_status "SUCCESS" "Istio configuration deployed"
    else
        print_status "WARNING" "Istio not installed, skipping service mesh configuration"
    fi
}

# Function to deploy with Helm
deploy_with_helm() {
    print_status "INFO" "Deploying with Helm..."
    
    # Add required Helm repositories
    print_status "INFO" "Adding Helm repositories..."
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo add elastic https://helm.elastic.co
    helm repo update
    
    # Deploy with Helm
    print_status "INFO" "Installing Helm chart..."
    helm upgrade --install $HELM_RELEASE_NAME k8s/helm/ai-orchestrator \
        --namespace $NAMESPACE \
        --create-namespace \
        --wait \
        --timeout 10m
    
    print_status "SUCCESS" "Helm deployment completed"
}

# Function to wait for deployments
wait_for_deployments() {
    print_status "INFO" "Waiting for deployments to be ready..."
    
    local deployments=("postgres" "redis" "elasticsearch")
    
    # Wait for databases first
    for deployment in "${deployments[@]}"; do
        print_status "INFO" "Waiting for $deployment..."
        kubectl wait --for=condition=available --timeout=300s deployment/$deployment -n $NAMESPACE || {
            print_status "WARNING" "Deployment $deployment did not become ready within timeout"
        }
    done
    
    # Wait for services
    local service_deployments=("api-gateway" "auth-service" "orchestration-service" 
                              "workflow-service" "execution-service" "monitoring-service" 
                              "user-service" "marketplace-service" "notification-service" 
                              "storage-service")
    
    for deployment in "${service_deployments[@]}"; do
        print_status "INFO" "Waiting for $deployment..."
        kubectl wait --for=condition=available --timeout=300s deployment/$deployment -n $NAMESPACE || {
            print_status "WARNING" "Deployment $deployment did not become ready within timeout"
        }
    done
    
    print_status "SUCCESS" "All deployments are ready"
}

# Function to display deployment information
display_deployment_info() {
    print_status "INFO" "Deployment Information:"
    echo ""
    
    # Get service information
    print_status "INFO" "Services:"
    kubectl get services -n $NAMESPACE
    echo ""
    
    # Get pod information
    print_status "INFO" "Pods:"
    kubectl get pods -n $NAMESPACE
    echo ""
    
    # Get ingress information if available
    if kubectl get ingress -n $NAMESPACE >/dev/null 2>&1; then
        print_status "INFO" "Ingress:"
        kubectl get ingress -n $NAMESPACE
        echo ""
    fi
    
    # Get API Gateway external IP
    local external_ip=$(kubectl get service api-gateway-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [ -n "$external_ip" ]; then
        print_status "SUCCESS" "API Gateway external IP: $external_ip"
    else
        print_status "INFO" "API Gateway is using ClusterIP. Use port-forward for local access:"
        echo "kubectl port-forward service/api-gateway-service -n $NAMESPACE 8080:80"
    fi
}

# Function to run post-deployment validation
run_validation() {
    print_status "INFO" "Running deployment validation..."
    
    if [ -f "k8s/scripts/validate-deployment.sh" ]; then
        chmod +x k8s/scripts/validate-deployment.sh
        ./k8s/scripts/validate-deployment.sh $NAMESPACE
    else
        print_status "WARNING" "Validation script not found"
    fi
}

# Main deployment function
main() {
    echo "========================================"
    echo "AI Orchestrator Deployment Script"
    echo "========================================"
    echo "Namespace: $NAMESPACE"
    echo "Deployment Type: $DEPLOYMENT_TYPE"
    if [ "$DEPLOYMENT_TYPE" = "helm" ]; then
        echo "Helm Release: $HELM_RELEASE_NAME"
    fi
    echo ""
    
    check_prerequisites
    
    if [ "$DEPLOYMENT_TYPE" = "helm" ]; then
        deploy_with_helm
    else
        create_namespace
        deploy_with_manifests
        deploy_istio
        wait_for_deployments
    fi
    
    display_deployment_info
    
    print_status "SUCCESS" "Deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Run validation: ./k8s/scripts/validate-deployment.sh $NAMESPACE"
    echo "2. Configure external access (ingress/load balancer)"
    echo "3. Set up monitoring and alerting"
    echo "4. Configure backup procedures"
    echo ""
    
    # Ask if user wants to run validation
    read -p "Run deployment validation now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_validation
    fi
}

# Show usage information
usage() {
    echo "Usage: $0 [NAMESPACE] [DEPLOYMENT_TYPE] [HELM_RELEASE_NAME]"
    echo ""
    echo "Parameters:"
    echo "  NAMESPACE          Kubernetes namespace (default: ai-orchestrator)"
    echo "  DEPLOYMENT_TYPE    Deployment method: 'manifests' or 'helm' (default: manifests)"
    echo "  HELM_RELEASE_NAME  Helm release name (default: ai-orchestrator, only used with helm)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Deploy to ai-orchestrator namespace with manifests"
    echo "  $0 production                        # Deploy to production namespace with manifests"
    echo "  $0 staging helm ai-orchestrator-dev  # Deploy to staging namespace with Helm"
    echo ""
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

# Run main function
main "$@"