#!/bin/bash

# Monitoring Setup Script for AI Orchestrator
# This script sets up the complete monitoring stack including Prometheus, Grafana, Jaeger, and Alertmanager

set -e

echo "🚀 Setting up AI Orchestrator Monitoring Stack..."

# Configuration
NAMESPACE="ai-orchestrator-monitoring"
PROMETHEUS_VERSION="v2.45.0"
GRAFANA_VERSION="10.0.0"
JAEGER_VERSION="1.47.0"
ALERTMANAGER_VERSION="v0.25.0"

# Create namespace
echo "📦 Creating monitoring namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Add Helm repositories
echo "📚 Adding Helm repositories..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm repo update

# Install Prometheus
echo "📊 Installing Prometheus..."
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace $NAMESPACE \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.ruleSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
  --set alertmanager.alertmanagerSpec.storage.volumeClaimTemplate.spec.resources.requests.storage=10Gi \
  --set grafana.adminPassword=admin123 \
  --set grafana.persistence.enabled=true \
  --set grafana.persistence.size=10Gi

# Apply custom Prometheus configuration
echo "⚙️ Applying custom Prometheus configuration..."
kubectl create configmap prometheus-config \
  --from-file=monitoring/prometheus/prometheus.yml \
  --from-file=monitoring/prometheus/alert_rules.yml \
  --from-file=monitoring/prometheus/recording_rules.yml \
  --namespace $NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

# Install Jaeger
echo "🔍 Installing Jaeger..."
helm upgrade --install jaeger jaegertracing/jaeger \
  --namespace $NAMESPACE \
  --set provisionDataStore.cassandra=false \
  --set provisionDataStore.elasticsearch=true \
  --set storage.type=elasticsearch \
  --set elasticsearch.deploy=true \
  --set elasticsearch.replicas=1 \
  --set elasticsearch.minimumMasterNodes=1 \
  --set elasticsearch.resources.requests.cpu=500m \
  --set elasticsearch.resources.requests.memory=1Gi \
  --set elasticsearch.resources.limits.cpu=1 \
  --set elasticsearch.resources.limits.memory=2Gi

# Apply Jaeger configuration
echo "⚙️ Applying Jaeger configuration..."
kubectl apply -f monitoring/jaeger/jaeger-config.yml -n $NAMESPACE

# Create ServiceMonitors for application services
echo "📡 Creating ServiceMonitors..."
cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ai-orchestrator-services
  namespace: $NAMESPACE
  labels:
    app: ai-orchestrator
spec:
  selector:
    matchLabels:
      monitoring: enabled
  endpoints:
  - port: metrics
    path: /metrics
    interval: 30s
  namespaceSelector:
    matchNames:
    - ai-orchestrator
EOF

# Create PodMonitors for pods with metrics
cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: ai-orchestrator-pods
  namespace: $NAMESPACE
  labels:
    app: ai-orchestrator
spec:
  selector:
    matchLabels:
      monitoring: enabled
  podMetricsEndpoints:
  - port: metrics
    path: /metrics
    interval: 30s
  namespaceSelector:
    matchNames:
    - ai-orchestrator
EOF

# Import Grafana dashboards
echo "📈 Importing Grafana dashboards..."
kubectl create configmap grafana-dashboards \
  --from-file=monitoring/grafana/dashboards/ \
  --namespace $NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

# Create Grafana dashboard ConfigMap with proper labels
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: ai-orchestrator-dashboards
  namespace: $NAMESPACE
  labels:
    grafana_dashboard: "1"
data:
$(find monitoring/grafana/dashboards -name "*.json" -exec basename {} \; | while read file; do
  echo "  $file: |"
  cat "monitoring/grafana/dashboards/$file" | sed 's/^/    /'
done)
EOF

# Create AlertManager configuration
echo "🚨 Configuring AlertManager..."
kubectl create secret generic alertmanager-config \
  --from-file=monitoring/alertmanager/alertmanager.yml \
  --namespace $NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

# Create network policies for monitoring
echo "🔒 Creating network policies..."
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-network-policy
  namespace: $NAMESPACE
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ai-orchestrator
    - namespaceSelector:
        matchLabels:
          name: $NAMESPACE
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: ai-orchestrator
  - to:
    - namespaceSelector:
        matchLabels:
          name: $NAMESPACE
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 443
EOF

# Create ingress for monitoring services
echo "🌐 Creating ingress for monitoring services..."
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: monitoring-ingress
  namespace: $NAMESPACE
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - grafana.ai-orchestrator.com
    - prometheus.ai-orchestrator.com
    - jaeger.ai-orchestrator.com
    secretName: monitoring-tls
  rules:
  - host: grafana.ai-orchestrator.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: prometheus-grafana
            port:
              number: 80
  - host: prometheus.ai-orchestrator.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: prometheus-kube-prometheus-prometheus
            port:
              number: 9090
  - host: jaeger.ai-orchestrator.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: jaeger-query
            port:
              number: 16686
EOF

# Wait for deployments to be ready
echo "⏳ Waiting for monitoring stack to be ready..."
kubectl wait --for=condition=available --timeout=600s deployment/prometheus-grafana -n $NAMESPACE
kubectl wait --for=condition=available --timeout=600s deployment/jaeger-query -n $NAMESPACE

# Create monitoring validation job
echo "✅ Creating monitoring validation job..."
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: monitoring-validation
  namespace: $NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: validator
        image: curlimages/curl:latest
        command:
        - /bin/sh
        - -c
        - |
          echo "Validating Prometheus..."
          curl -f http://prometheus-kube-prometheus-prometheus:9090/-/healthy || exit 1
          
          echo "Validating Grafana..."
          curl -f http://prometheus-grafana:80/api/health || exit 1
          
          echo "Validating Jaeger..."
          curl -f http://jaeger-query:16686/api/services || exit 1
          
          echo "All monitoring services are healthy!"
      restartPolicy: Never
  backoffLimit: 3
EOF

# Output access information
echo ""
echo "🎉 Monitoring stack setup complete!"
echo ""
echo "📊 Access Information:"
echo "  Grafana:    https://grafana.ai-orchestrator.com (admin/admin123)"
echo "  Prometheus: https://prometheus.ai-orchestrator.com"
echo "  Jaeger:     https://jaeger.ai-orchestrator.com"
echo ""
echo "🔧 Local Access (kubectl port-forward):"
echo "  Grafana:    kubectl port-forward -n $NAMESPACE svc/prometheus-grafana 3000:80"
echo "  Prometheus: kubectl port-forward -n $NAMESPACE svc/prometheus-kube-prometheus-prometheus 9090:9090"
echo "  Jaeger:     kubectl port-forward -n $NAMESPACE svc/jaeger-query 16686:16686"
echo ""
echo "📚 Next Steps:"
echo "  1. Configure application services to expose /metrics endpoint"
echo "  2. Add 'monitoring: enabled' label to services and pods"
echo "  3. Import custom dashboards to Grafana"
echo "  4. Configure alert notification channels"
echo "  5. Set up log aggregation with ELK stack"
echo ""
echo "🔍 Validation:"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl logs -n $NAMESPACE job/monitoring-validation"