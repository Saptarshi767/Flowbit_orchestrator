#!/bin/bash

# AI Orchestrator Cleanup Script
# This script removes the AI Orchestrator deployment from Kubernetes

set -e

NAMESPACE=${1:-ai-orchestrator}
DEPLOYMENT_TYPE=${2:-manifests}  # manifests or helm
HELM_RELEASE_NAME=${3:-ai-orchestrator}
FORCE=${4:-false}

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

# Function to confirm cleanup
confirm_cleanup() {
    if [ "$FORCE" != "true" ]; then
        echo "========================================"
        echo "AI Orchestrator Cleanup"
        echo "========================================"
        echo "This will remove the following:"
        echo "- Namespace: $NAMESPACE"
        echo "- All deployments and services"
        echo "- Persistent volumes and data"
        echo "- Istio configuration"
        echo ""
        print_status "WARNING" "This action cannot be undone!"
        echo ""
        read -p "Are you sure you want to continue? (type 'yes' to confirm): " -r
        if [ "$REPLY" != "yes" ]; then
            print_status "INFO" "Cleanup cancelled"
            exit 0
        fi
    fi
}

# Function to cleanup Helm deployment
cleanup_helm() {
    print_status "INFO" "Cleaning up Helm deployment..."
    
    if helm list -n $NAMESPACE | grep -q $HELM_RELEASE_NAME; then
        print_status "INFO" "Uninstalling Helm release: $HELM_RELEASE_NAME"
        helm uninstall $HELM_RELEASE_NAME -n $NAMESPACE
        print_status "SUCCESS" "Helm release uninstalled"
    else
        print_status "WARNING" "Helm release $HELM_RELEASE_NAME not found"
    fi
}

# Function to cleanup manifests
cleanup_manifests() {
    print_status "INFO" "Cleaning up Kubernetes manifests..."
    
    # Remove in reverse order
    local manifest_files=(
        "k8s/manifests/storage-service.yaml"
        "k8s/manifests/notification-service.yaml"
        "k8s/manifests/marketplace-service.yaml"
        "k8s/manifests/user-service.yaml"
        "k8s/manifests/monitoring-service.yaml"
        "k8s/manifests/execution-service.yaml"
        "k8s/manifests/workflow-service.yaml"
        "k8s/manifests/orchestration-service.yaml"
        "k8s/manifests/auth-service.yaml"
        "k8s/manifests/api-gateway.yaml"
        "k8s/manifests/elasticsearch.yaml"
        "k8s/manifests/redis.yaml"
        "k8s/manifests/postgres.yaml"
    )
    
    for manifest in "${manifest_files[@]}"; do
        if [ -f "$manifest" ]; then
            print_status "INFO" "Removing $manifest"
            kubectl delete -f "$manifest" --ignore-not-found=true
        fi
    done
    
    print_status "SUCCESS" "Manifests cleaned up"
}

# Function to cleanup Istio configuration
cleanup_istio() {
    print_status "INFO" "Cleaning up Istio configuration..."
    
    if kubectl get crd gateways.networking.istio.io >/dev/null 2>&1; then
        local istio_files=(
            "k8s/istio/security-policies.yaml"
            "k8s/istio/destination-rules.yaml"
            "k8s/istio/gateway.yaml"
        )
        
        for istio_file in "${istio_files[@]}"; do
            if [ -f "$istio_file" ]; then
                print_status "INFO" "Removing $istio_file"
                kubectl delete -f "$istio_file" --ignore-not-found=true
            fi
        done
        
        print_status "SUCCESS" "Istio configuration cleaned up"
    else
        print_status "INFO" "Istio not installed, skipping Istio cleanup"
    fi
}

# Function to cleanup persistent volumes
cleanup_persistent_volumes() {
    print_status "INFO" "Cleaning up persistent volumes..."
    
    # Remove PVCs first
    local pvcs=("postgres-pvc" "redis-pvc" "elasticsearch-pvc" "file-storage-pvc")
    for pvc in "${pvcs[@]}"; do
        if kubectl get pvc $pvc -n $NAMESPACE >/dev/null 2>&1; then
            print_status "INFO" "Removing PVC: $pvc"
            kubectl delete pvc $pvc -n $NAMESPACE --ignore-not-found=true
        fi
    done
    
    # Remove PVs
    local pvs=("postgres-pv" "redis-pv" "elasticsearch-pv" "file-storage-pv")
    for pv in "${pvs[@]}"; do
        if kubectl get pv $pv >/dev/null 2>&1; then
            print_status "INFO" "Removing PV: $pv"
            kubectl delete pv $pv --ignore-not-found=true
        fi
    done
    
    print_status "SUCCESS" "Persistent volumes cleaned up"
}

# Function to cleanup secrets and configmaps
cleanup_config() {
    print_status "INFO" "Cleaning up configuration..."
    
    # Remove secrets
    kubectl delete secret ai-orchestrator-secrets -n $NAMESPACE --ignore-not-found=true
    
    # Remove configmaps
    kubectl delete configmap ai-orchestrator-config -n $NAMESPACE --ignore-not-found=true
    
    print_status "SUCCESS" "Configuration cleaned up"
}

# Function to cleanup namespace
cleanup_namespace() {
    print_status "INFO" "Cleaning up namespace..."
    
    if kubectl get namespace $NAMESPACE >/dev/null 2>&1; then
        print_status "INFO" "Removing namespace: $NAMESPACE"
        kubectl delete namespace $NAMESPACE --ignore-not-found=true
        
        # Wait for namespace to be fully deleted
        print_status "INFO" "Waiting for namespace deletion..."
        while kubectl get namespace $NAMESPACE >/dev/null 2>&1; do
            sleep 5
            echo -n "."
        done
        echo ""
        
        print_status "SUCCESS" "Namespace $NAMESPACE removed"
    else
        print_status "WARNING" "Namespace $NAMESPACE not found"
    fi
}

# Function to cleanup data directories (if using local storage)
cleanup_data_directories() {
    print_status "INFO" "Checking for local data directories..."
    
    local data_dirs=("/data/postgres" "/data/redis" "/data/elasticsearch" "/data/file-storage")
    
    for dir in "${data_dirs[@]}"; do
        if [ -d "$dir" ]; then
            print_status "WARNING" "Local data directory found: $dir"
            if [ "$FORCE" = "true" ]; then
                print_status "INFO" "Removing data directory: $dir"
                sudo rm -rf "$dir" 2>/dev/null || print_status "WARNING" "Could not remove $dir (permission denied)"
            else
                read -p "Remove data directory $dir? (y/n): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    sudo rm -rf "$dir" 2>/dev/null || print_status "WARNING" "Could not remove $dir (permission denied)"
                fi
            fi
        fi
    done
}

# Function to verify cleanup
verify_cleanup() {
    print_status "INFO" "Verifying cleanup..."
    
    # Check if namespace still exists
    if kubectl get namespace $NAMESPACE >/dev/null 2>&1; then
        print_status "WARNING" "Namespace $NAMESPACE still exists"
        kubectl get all -n $NAMESPACE
    else
        print_status "SUCCESS" "Namespace $NAMESPACE successfully removed"
    fi
    
    # Check for remaining PVs
    local remaining_pvs=$(kubectl get pv | grep -E "(postgres-pv|redis-pv|elasticsearch-pv|file-storage-pv)" | wc -l)
    if [ $remaining_pvs -gt 0 ]; then
        print_status "WARNING" "$remaining_pvs persistent volume(s) still exist"
        kubectl get pv | grep -E "(postgres-pv|redis-pv|elasticsearch-pv|file-storage-pv)"
    else
        print_status "SUCCESS" "All persistent volumes removed"
    fi
}

# Main cleanup function
main() {
    echo "========================================"
    echo "AI Orchestrator Cleanup Script"
    echo "========================================"
    echo "Namespace: $NAMESPACE"
    echo "Deployment Type: $DEPLOYMENT_TYPE"
    if [ "$DEPLOYMENT_TYPE" = "helm" ]; then
        echo "Helm Release: $HELM_RELEASE_NAME"
    fi
    echo ""
    
    confirm_cleanup
    
    print_status "INFO" "Starting cleanup process..."
    
    # Cleanup based on deployment type
    if [ "$DEPLOYMENT_TYPE" = "helm" ]; then
        cleanup_helm
    else
        cleanup_manifests
    fi
    
    cleanup_istio
    cleanup_config
    cleanup_persistent_volumes
    cleanup_namespace
    cleanup_data_directories
    verify_cleanup
    
    print_status "SUCCESS" "Cleanup completed successfully!"
    echo ""
    echo "The AI Orchestrator has been completely removed from the cluster."
}

# Show usage information
usage() {
    echo "Usage: $0 [NAMESPACE] [DEPLOYMENT_TYPE] [HELM_RELEASE_NAME] [FORCE]"
    echo ""
    echo "Parameters:"
    echo "  NAMESPACE          Kubernetes namespace (default: ai-orchestrator)"
    echo "  DEPLOYMENT_TYPE    Deployment method: 'manifests' or 'helm' (default: manifests)"
    echo "  HELM_RELEASE_NAME  Helm release name (default: ai-orchestrator, only used with helm)"
    echo "  FORCE              Skip confirmation prompts: 'true' or 'false' (default: false)"
    echo ""
    echo "Examples:"
    echo "  $0                                          # Clean up ai-orchestrator namespace"
    echo "  $0 production                               # Clean up production namespace"
    echo "  $0 staging helm ai-orchestrator-dev         # Clean up Helm deployment"
    echo "  $0 ai-orchestrator manifests '' true        # Force cleanup without prompts"
    echo ""
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

# Run main function
main "$@"