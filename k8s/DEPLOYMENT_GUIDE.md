# AI Orchestrator Kubernetes Deployment Guide

This guide provides comprehensive instructions for deploying the AI Orchestrator platform on Kubernetes.

## Prerequisites

### Required Tools
- Kubernetes cluster (v1.24+)
- kubectl configured to access your cluster
- Helm 3.x (for Helm deployment method)
- Docker (for building custom images)

### Optional Tools
- Istio service mesh (for advanced traffic management)
- Prometheus & Grafana (for monitoring)
- cert-manager (for TLS certificates)

### Cluster Requirements
- **Minimum Resources**: 8 CPU cores, 16GB RAM, 100GB storage
- **Recommended Resources**: 16 CPU cores, 32GB RAM, 500GB storage
- **Storage Classes**: Support for ReadWriteOnce and ReadWriteMany volumes
- **Load Balancer**: For external access (cloud provider or MetalLB)

## Quick Start

### 1. Clone and Prepare
```bash
# Navigate to the k8s directory
cd k8s

# Make scripts executable (Linux/macOS)
chmod +x scripts/*.sh

# On Windows, use PowerShell to run scripts directly
```

### 2. Deploy with Manifests (Recommended for Development)
```bash
# Deploy to default namespace (ai-orchestrator)
./scripts/deploy.sh

# Deploy to custom namespace
./scripts/deploy.sh production

# Deploy with validation
./scripts/deploy.sh staging && ./scripts/validate-deployment.sh staging
```

### 3. Deploy with Helm (Recommended for Production)
```bash
# Deploy with Helm
./scripts/deploy.sh production helm ai-orchestrator-prod

# Or manually with Helm
helm install ai-orchestrator ./helm/ai-orchestrator \
  --namespace production \
  --create-namespace \
  --values ./helm/ai-orchestrator/values.yaml
```

## Deployment Methods

### Method 1: Raw Kubernetes Manifests

**Pros:**
- Full control over configuration
- Easy to customize
- No additional dependencies

**Cons:**
- More manual configuration
- Harder to manage upgrades

**Usage:**
```bash
# Basic deployment
kubectl apply -f manifests/

# With custom namespace
kubectl create namespace my-namespace
kubectl apply -f manifests/ -n my-namespace
```

### Method 2: Helm Charts

**Pros:**
- Easy configuration management
- Built-in upgrade/rollback support
- Templating and parameterization

**Cons:**
- Requires Helm knowledge
- Additional dependency

**Usage:**
```bash
# Install with default values
helm install ai-orchestrator ./helm/ai-orchestrator

# Install with custom values
helm install ai-orchestrator ./helm/ai-orchestrator \
  --values custom-values.yaml

# Upgrade deployment
helm upgrade ai-orchestrator ./helm/ai-orchestrator
```

## Configuration

### Environment Variables
Key configuration options in ConfigMap:

```yaml
# Database Configuration
POSTGRES_HOST: "postgres-service"
POSTGRES_PORT: "5432"
POSTGRES_DB: "ai_orchestrator"

# External Engine Configuration
LANGFLOW_ENABLED: "true"
N8N_ENABLED: "true"
LANGSMITH_ENABLED: "true"

# Security Configuration
JWT_EXPIRY: "24h"
SESSION_TIMEOUT: "30m"
```

### Secrets Management
Sensitive data in Secrets:

```yaml
# Database Credentials
POSTGRES_USER: <base64-encoded>
POSTGRES_PASSWORD: <base64-encoded>

# API Keys
LANGFLOW_API_KEY: <base64-encoded>
N8N_API_KEY: <base64-encoded>
LANGSMITH_API_KEY: <base64-encoded>

# OAuth Credentials
GOOGLE_CLIENT_ID: <base64-encoded>
GOOGLE_CLIENT_SECRET: <base64-encoded>
```

### Persistent Storage
Configure storage classes and sizes:

```yaml
# PostgreSQL Storage
postgres-pvc:
  size: 10Gi
  storageClass: fast-ssd

# File Storage
file-storage-pvc:
  size: 50Gi
  storageClass: standard
  accessMode: ReadWriteMany
```

## Scaling Configuration

### Horizontal Pod Autoscaling
Each service includes HPA configuration:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: orchestration-service-hpa
spec:
  minReplicas: 3
  maxReplicas: 15
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### Resource Limits
Adjust resource requests and limits:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

## Istio Service Mesh (Optional)

### Prerequisites
```bash
# Install Istio
curl -L https://istio.io/downloadIstio | sh -
istioctl install --set values.defaultRevision=default

# Enable injection for namespace
kubectl label namespace ai-orchestrator istio-injection=enabled
```

### Deploy Istio Configuration
```bash
# Apply Istio manifests
kubectl apply -f istio/
```

### Features Enabled
- **mTLS**: Automatic mutual TLS between services
- **Traffic Management**: Load balancing, circuit breakers
- **Security Policies**: Authorization and authentication
- **Observability**: Distributed tracing and metrics

## Monitoring Setup

### Prometheus & Grafana
```bash
# Add Helm repositories
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Install Grafana
helm install grafana grafana/grafana \
  --namespace monitoring
```

### Custom Dashboards
Import provided Grafana dashboards for:
- Service performance metrics
- Database monitoring
- Execution tracking
- Resource utilization

## Security Considerations

### Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ai-orchestrator-netpol
spec:
  podSelector:
    matchLabels:
      app: ai-orchestrator
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ai-orchestrator
```

### Pod Security Standards
```yaml
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
  containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
```

### RBAC Configuration
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ai-orchestrator-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
```

## Backup and Recovery

### Database Backup
```bash
# PostgreSQL backup
kubectl exec -n ai-orchestrator postgres-0 -- pg_dump -U ai_orchestrator ai_orchestrator > backup.sql

# Restore
kubectl exec -i -n ai-orchestrator postgres-0 -- psql -U ai_orchestrator ai_orchestrator < backup.sql
```

### Persistent Volume Backup
```bash
# Create volume snapshots
kubectl apply -f - <<EOF
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: postgres-snapshot
spec:
  source:
    persistentVolumeClaimName: postgres-pvc
EOF
```

## Troubleshooting

### Common Issues

#### 1. Pods Stuck in Pending
```bash
# Check node resources
kubectl describe nodes

# Check PVC status
kubectl get pvc -n ai-orchestrator

# Check events
kubectl get events -n ai-orchestrator --sort-by='.lastTimestamp'
```

#### 2. Service Connection Issues
```bash
# Check service endpoints
kubectl get endpoints -n ai-orchestrator

# Test connectivity
kubectl run debug --rm -i --tty --image=nicolaka/netshoot -- /bin/bash
```

#### 3. Database Connection Problems
```bash
# Check database logs
kubectl logs -n ai-orchestrator deployment/postgres

# Test database connection
kubectl exec -it -n ai-orchestrator deployment/postgres -- psql -U ai_orchestrator
```

### Validation Commands
```bash
# Run full validation
./scripts/validate-deployment.sh ai-orchestrator

# Check specific components
kubectl get all -n ai-orchestrator
kubectl get pv,pvc -n ai-orchestrator
kubectl get hpa -n ai-orchestrator
```

## Maintenance

### Updates and Upgrades
```bash
# Update with Helm
helm upgrade ai-orchestrator ./helm/ai-orchestrator

# Update with manifests
kubectl apply -f manifests/

# Rolling restart
kubectl rollout restart deployment -n ai-orchestrator
```

### Scaling Operations
```bash
# Scale specific service
kubectl scale deployment orchestration-service --replicas=5 -n ai-orchestrator

# Update HPA limits
kubectl patch hpa orchestration-service-hpa -n ai-orchestrator -p '{"spec":{"maxReplicas":20}}'
```

### Cleanup
```bash
# Complete cleanup
./scripts/cleanup.sh ai-orchestrator

# Helm cleanup
helm uninstall ai-orchestrator -n ai-orchestrator
kubectl delete namespace ai-orchestrator
```

## Production Checklist

### Pre-Deployment
- [ ] Cluster resources verified
- [ ] Storage classes configured
- [ ] Load balancer available
- [ ] DNS configured
- [ ] TLS certificates ready
- [ ] Backup strategy defined

### Security
- [ ] Secrets properly configured
- [ ] RBAC policies applied
- [ ] Network policies configured
- [ ] Pod security standards enforced
- [ ] Istio security policies (if using)

### Monitoring
- [ ] Prometheus configured
- [ ] Grafana dashboards imported
- [ ] Alerting rules configured
- [ ] Log aggregation setup
- [ ] Health checks validated

### High Availability
- [ ] Multi-node cluster
- [ ] Database replication
- [ ] Load balancer redundancy
- [ ] Cross-zone deployment
- [ ] Disaster recovery plan

## Support

### Logs Collection
```bash
# Collect all logs
kubectl logs -n ai-orchestrator --all-containers=true --prefix=true > ai-orchestrator-logs.txt

# Specific service logs
kubectl logs -n ai-orchestrator deployment/orchestration-service -f
```

### Debug Information
```bash
# Generate debug report
kubectl cluster-info dump --namespaces ai-orchestrator --output-directory=debug-info
```

### Performance Monitoring
```bash
# Resource usage
kubectl top pods -n ai-orchestrator
kubectl top nodes

# Service metrics
kubectl get --raw /metrics | grep ai_orchestrator
```

For additional support, refer to the troubleshooting section or contact the development team.