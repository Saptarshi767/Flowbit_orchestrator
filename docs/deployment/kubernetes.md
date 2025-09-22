# Kubernetes Deployment Guide

This guide covers deploying the Robust AI Orchestrator on Kubernetes clusters, including configuration, scaling, and maintenance procedures.

## Prerequisites

### Required Tools
- **kubectl** (v1.25 or higher)
- **Helm** (v3.8 or higher)
- **Docker** (for building images)

### Cluster Requirements
- **Kubernetes**: v1.25 or higher
- **CPU**: Minimum 8 cores (16+ recommended for production)
- **Memory**: Minimum 16GB RAM (32GB+ recommended)
- **Storage**: 100GB+ persistent storage
- **Network**: LoadBalancer or Ingress controller support

### Supported Platforms
- **Amazon EKS**
- **Google GKE**
- **Azure AKS**
- **Self-managed Kubernetes**
- **OpenShift**

## Quick Deployment

### 1. Add Helm Repository

```bash
helm repo add robust-orchestrator https://charts.robust-orchestrator.com
helm repo update
```

### 2. Create Namespace

```bash
kubectl create namespace robust-orchestrator
```

### 3. Install with Default Configuration

```bash
helm install robust-orchestrator robust-orchestrator/robust-orchestrator \
  --namespace robust-orchestrator \
  --set global.domain=your-domain.com \
  --set auth.jwt.secret=$(openssl rand -base64 32)
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -n robust-orchestrator

# Check services
kubectl get services -n robust-orchestrator

# Check ingress
kubectl get ingress -n robust-orchestrator
```

## Detailed Configuration

### 1. Create Values File

Create `values.yaml` for customized deployment:

```yaml
# values.yaml
global:
  domain: "orchestrator.yourcompany.com"
  environment: "production"
  imageRegistry: "your-registry.com"
  imagePullSecrets:
    - name: registry-secret

# Database Configuration
postgresql:
  enabled: true
  auth:
    postgresPassword: "secure-password"
    database: "orchestrator"
  primary:
    persistence:
      enabled: true
      size: 100Gi
      storageClass: "fast-ssd"
  metrics:
    enabled: true

# Redis Configuration
redis:
  enabled: true
  auth:
    enabled: true
    password: "redis-password"
  master:
    persistence:
      enabled: true
      size: 20Gi
  metrics:
    enabled: true

# Elasticsearch Configuration
elasticsearch:
  enabled: true
  replicas: 3
  minimumMasterNodes: 2
  volumeClaimTemplate:
    accessModes: ["ReadWriteOnce"]
    resources:
      requests:
        storage: 50Gi
    storageClassName: "fast-ssd"

# Application Services
api-gateway:
  replicaCount: 3
  image:
    repository: your-registry.com/api-gateway
    tag: "v1.0.0"
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70

orchestration:
  replicaCount: 2
  image:
    repository: your-registry.com/orchestration
    tag: "v1.0.0"
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 4000m
      memory: 8Gi

workflow-management:
  replicaCount: 2
  image:
    repository: your-registry.com/workflow-management
    tag: "v1.0.0"

execution:
  replicaCount: 5
  image:
    repository: your-registry.com/execution
    tag: "v1.0.0"
  autoscaling:
    enabled: true
    minReplicas: 5
    maxReplicas: 50
    targetCPUUtilizationPercentage: 80

# Web Application
web:
  replicaCount: 3
  image:
    repository: your-registry.com/web
    tag: "v1.0.0"
  resources:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 2Gi

# Ingress Configuration
ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
  hosts:
    - host: orchestrator.yourcompany.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: orchestrator-tls
      hosts:
        - orchestrator.yourcompany.com

# Monitoring
monitoring:
  prometheus:
    enabled: true
  grafana:
    enabled: true
    adminPassword: "grafana-admin-password"
  alertmanager:
    enabled: true

# Security
security:
  networkPolicies:
    enabled: true
  podSecurityPolicy:
    enabled: true
  rbac:
    create: true
```

### 2. Deploy with Custom Configuration

```bash
helm install robust-orchestrator robust-orchestrator/robust-orchestrator \
  --namespace robust-orchestrator \
  --values values.yaml \
  --wait --timeout 10m
```

## Manual Kubernetes Manifests

If you prefer manual deployment without Helm:

### 1. Namespace and RBAC

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: robust-orchestrator
  labels:
    name: robust-orchestrator
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: robust-orchestrator
  namespace: robust-orchestrator
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: robust-orchestrator
rules:
- apiGroups: [""]
  resources: ["pods", "services", "endpoints"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: robust-orchestrator
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: robust-orchestrator
subjects:
- kind: ServiceAccount
  name: robust-orchestrator
  namespace: robust-orchestrator
```

### 2. ConfigMaps and Secrets

```yaml
# config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: robust-orchestrator
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  DATABASE_HOST: "postgresql"
  DATABASE_PORT: "5432"
  DATABASE_NAME: "orchestrator"
  REDIS_HOST: "redis"
  REDIS_PORT: "6379"
---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: robust-orchestrator
type: Opaque
data:
  DATABASE_PASSWORD: <base64-encoded-password>
  REDIS_PASSWORD: <base64-encoded-password>
  JWT_SECRET: <base64-encoded-jwt-secret>
```

### 3. Database Deployment

```yaml
# postgresql.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgresql
  namespace: robust-orchestrator
spec:
  serviceName: postgresql
  replicas: 1
  selector:
    matchLabels:
      app: postgresql
  template:
    metadata:
      labels:
        app: postgresql
    spec:
      containers:
      - name: postgresql
        image: postgres:14
        env:
        - name: POSTGRES_DB
          value: "orchestrator"
        - name: POSTGRES_USER
          value: "postgres"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DATABASE_PASSWORD
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgresql-data
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
  volumeClaimTemplates:
  - metadata:
      name: postgresql-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgresql
  namespace: robust-orchestrator
spec:
  selector:
    app: postgresql
  ports:
  - port: 5432
    targetPort: 5432
```

### 4. Application Deployments

```yaml
# api-gateway.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: robust-orchestrator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      serviceAccountName: robust-orchestrator
      containers:
      - name: api-gateway
        image: your-registry.com/api-gateway:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: robust-orchestrator
spec:
  selector:
    app: api-gateway
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

## Scaling Configuration

### Horizontal Pod Autoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: robust-orchestrator
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: execution-hpa
  namespace: robust-orchestrator
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: execution
  minReplicas: 5
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
```

### Vertical Pod Autoscaler

```yaml
# vpa.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: orchestration-vpa
  namespace: robust-orchestrator
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orchestration
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: orchestration
      maxAllowed:
        cpu: 8000m
        memory: 16Gi
      minAllowed:
        cpu: 1000m
        memory: 2Gi
```

## Monitoring and Observability

### Prometheus Configuration

```yaml
# prometheus.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: robust-orchestrator
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
    - job_name: 'robust-orchestrator'
      static_configs:
      - targets: ['api-gateway:3000', 'orchestration:3001', 'execution:3002']
```

### Grafana Dashboards

```yaml
# grafana-dashboard.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboards
  namespace: robust-orchestrator
  labels:
    grafana_dashboard: "1"
data:
  orchestrator-overview.json: |
    {
      "dashboard": {
        "title": "Robust AI Orchestrator Overview",
        "panels": [
          {
            "title": "Active Workflows",
            "type": "stat",
            "targets": [
              {
                "expr": "sum(workflow_executions_active)"
              }
            ]
          },
          {
            "title": "Execution Success Rate",
            "type": "stat",
            "targets": [
              {
                "expr": "rate(workflow_executions_total{status=\"completed\"}[5m]) / rate(workflow_executions_total[5m]) * 100"
              }
            ]
          }
        ]
      }
    }
```

## Security Configuration

### Network Policies

```yaml
# network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-gateway-policy
  namespace: robust-orchestrator
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: orchestration
    ports:
    - protocol: TCP
      port: 3001
  - to:
    - podSelector:
        matchLabels:
          app: postgresql
    ports:
    - protocol: TCP
      port: 5432
```

### Pod Security Policy

```yaml
# pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: robust-orchestrator-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

## Backup and Disaster Recovery

### Database Backup

```yaml
# backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgresql-backup
  namespace: robust-orchestrator
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:14
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h postgresql -U postgres orchestrator | gzip > /backup/orchestrator-$(date +%Y%m%d-%H%M%S).sql.gz
              # Upload to S3 or other storage
              aws s3 cp /backup/orchestrator-*.sql.gz s3://your-backup-bucket/
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: DATABASE_PASSWORD
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            emptyDir: {}
          restartPolicy: OnFailure
```

## Troubleshooting

### Common Issues

1. **Pod Startup Issues**:
```bash
# Check pod status
kubectl describe pod <pod-name> -n robust-orchestrator

# Check logs
kubectl logs <pod-name> -n robust-orchestrator

# Check events
kubectl get events -n robust-orchestrator --sort-by='.lastTimestamp'
```

2. **Database Connection Issues**:
```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:14 --restart=Never -- psql -h postgresql.robust-orchestrator.svc.cluster.local -U postgres -d orchestrator
```

3. **Service Discovery Issues**:
```bash
# Check service endpoints
kubectl get endpoints -n robust-orchestrator

# Test service connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup api-gateway.robust-orchestrator.svc.cluster.local
```

### Performance Tuning

1. **Resource Optimization**:
```bash
# Check resource usage
kubectl top pods -n robust-orchestrator
kubectl top nodes

# Analyze resource requests vs usage
kubectl describe nodes
```

2. **Database Performance**:
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check connection usage
SELECT count(*) as connections, state 
FROM pg_stat_activity 
GROUP BY state;
```

## Maintenance

### Rolling Updates

```bash
# Update deployment image
kubectl set image deployment/api-gateway api-gateway=your-registry.com/api-gateway:v1.1.0 -n robust-orchestrator

# Check rollout status
kubectl rollout status deployment/api-gateway -n robust-orchestrator

# Rollback if needed
kubectl rollout undo deployment/api-gateway -n robust-orchestrator
```

### Cluster Maintenance

```bash
# Drain node for maintenance
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Uncordon node after maintenance
kubectl uncordon <node-name>
```

## Production Checklist

- [ ] SSL/TLS certificates configured
- [ ] Database backups scheduled
- [ ] Monitoring and alerting set up
- [ ] Resource limits configured
- [ ] Network policies applied
- [ ] Security policies enforced
- [ ] Ingress controller configured
- [ ] DNS records configured
- [ ] Load testing completed
- [ ] Disaster recovery plan tested

## Support

For Kubernetes-specific issues:
- **Documentation**: [Kubernetes Docs](https://kubernetes.io/docs/)
- **Community**: [Kubernetes Slack](https://kubernetes.slack.com/)
- **Issues**: [GitHub Issues](https://github.com/your-org/robust-ai-orchestrator/issues)
- **Enterprise Support**: [Contact Support](mailto:support@yourcompany.com)