# Kubernetes Deployment Manifests

This directory contains Kubernetes deployment manifests for the Robust AI Orchestrator platform.

## Structure

- `manifests/` - Raw Kubernetes YAML manifests
- `helm/` - Helm charts for easy deployment
- `istio/` - Istio service mesh configurations
- `scripts/` - Deployment validation and utility scripts

## Quick Start

1. Deploy with Helm:
```bash
helm install ai-orchestrator ./helm/ai-orchestrator
```

2. Validate deployment:
```bash
./scripts/validate-deployment.sh
```

## Components

- API Gateway
- Authentication Service
- Orchestration Engine
- Workflow Manager
- Execution Service
- Monitoring Service
- User Management
- Marketplace Service
- Notification Service
- File Storage Service