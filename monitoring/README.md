# AI Orchestrator Monitoring and Observability

This directory contains the complete monitoring and observability stack for the AI Orchestrator platform, implementing comprehensive metrics collection, distributed tracing, alerting, and business intelligence.

## Overview

The monitoring system provides:

- **Prometheus Metrics**: Application and infrastructure metrics collection
- **Grafana Dashboards**: Real-time visualization and monitoring
- **Jaeger Tracing**: Distributed tracing for request flow analysis
- **AlertManager**: Intelligent alerting and incident management
- **Business Metrics**: KPI tracking and business intelligence
- **Operational Runbooks**: Incident response and maintenance procedures

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │───▶│   Prometheus    │───▶│     Grafana     │
│    Services     │    │    (Metrics)    │    │  (Dashboards)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Jaeger      │    │  AlertManager   │    │   Runbooks &    │
│   (Tracing)     │    │   (Alerting)    │    │   Procedures    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### Local Development Setup

1. **Start the monitoring stack**:
   ```bash
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

2. **Validate the setup**:
   ```bash
   ./scripts/validate-monitoring.sh
   ```

3. **Access the services**:
   - Grafana: http://localhost:3000 (admin/admin123)
   - Prometheus: http://localhost:9090
   - Jaeger: http://localhost:16686
   - AlertManager: http://localhost:9093

### Production Deployment

1. **Deploy to Kubernetes**:
   ```bash
   ./scripts/monitoring-setup.sh
   ```

2. **Configure ingress** (update domains in script):
   - Grafana: https://grafana.ai-orchestrator.com
   - Prometheus: https://prometheus.ai-orchestrator.com
   - Jaeger: https://jaeger.ai-orchestrator.com

## Components

### 1. Prometheus Configuration

**Location**: `monitoring/prometheus/`

- **prometheus.yml**: Main configuration with scrape targets
- **alert_rules.yml**: Alerting rules for system and application metrics
- **recording_rules.yml**: Pre-computed metrics for performance

**Key Metrics Collected**:
- HTTP request metrics (rate, duration, errors)
- Workflow execution metrics (success rate, duration, queue size)
- System metrics (CPU, memory, disk usage)
- Business metrics (active users, revenue, API usage)

### 2. Grafana Dashboards

**Location**: `monitoring/grafana/dashboards/`

- **system-overview.json**: System health and performance overview
- **workflow-metrics.json**: Workflow execution and business metrics

**Dashboard Features**:
- Real-time metrics visualization
- Alerting integration
- Custom time ranges and filters
- Mobile-responsive design

### 3. Jaeger Tracing

**Location**: `monitoring/jaeger/`

**Capabilities**:
- Distributed request tracing
- Performance bottleneck identification
- Service dependency mapping
- Error correlation and debugging

### 4. AlertManager

**Location**: `monitoring/alertmanager/`

**Alert Channels**:
- Slack notifications
- Email alerts
- PagerDuty integration
- Webhook notifications

**Alert Severity Levels**:
- **Critical (P0)**: Service outages, data loss
- **Warning (P1)**: Performance degradation, high error rates
- **Info (P2)**: Capacity planning, business metrics

### 5. Business Metrics

**Location**: `lib/monitoring/business-metrics.ts`

**KPI Tracking**:
- Monthly Active Users (MAU)
- Workflow Success Rate
- Average Response Time
- Monthly Recurring Revenue (MRR)
- Customer Satisfaction Score

## Implementation Guide

### Adding Metrics to Your Service

1. **Install dependencies**:
   ```bash
   npm install prom-client
   ```

2. **Initialize metrics service**:
   ```typescript
   import { MetricsService, createMetricsMiddleware } from '../lib/monitoring/metrics';
   
   const app = express();
   const metricsService = MetricsService.getInstance();
   
   // Add metrics middleware
   app.use(createMetricsMiddleware('your-service-name'));
   
   // Expose metrics endpoint
   app.get('/metrics', createMetricsHandler());
   ```

3. **Record custom metrics**:
   ```typescript
   // Record workflow execution
   metricsService.recordWorkflowExecution(
     workflowId,
     workflowName,
     engineType,
     status,
     duration,
     userId
   );
   
   // Record engine calls
   metricsService.recordEngineCall(
     engineType,
     operation,
     status,
     duration
   );
   ```

### Adding Distributed Tracing

1. **Install OpenTelemetry dependencies**:
   ```bash
   npm install @opentelemetry/sdk-node @opentelemetry/api
   ```

2. **Initialize tracing**:
   ```typescript
   import { TracingService } from '../lib/monitoring/tracing';
   
   const tracing = new TracingService({
     serviceName: 'your-service',
     serviceVersion: '1.0.0',
     jaegerEndpoint: 'http://jaeger-collector:14268/api/traces'
   });
   
   tracing.initialize();
   ```

3. **Trace operations**:
   ```typescript
   // Trace a function
   const result = await tracing.traceFunction('operation-name', async () => {
     // Your operation code
     return await someAsyncOperation();
   });
   
   // Manual span management
   const span = tracing.createSpan('custom-operation');
   span.setAttributes({ 'custom.attribute': 'value' });
   // ... operation code ...
   span.end();
   ```

### Service Configuration

Add these labels to your Kubernetes services to enable monitoring:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: your-service
  labels:
    monitoring: enabled
spec:
  ports:
  - name: http
    port: 3000
  - name: metrics
    port: 9464
  selector:
    app: your-service
```

## Alerting Rules

### System Alerts

- **HighCPUUsage**: CPU > 80% for 5 minutes
- **HighMemoryUsage**: Memory > 85% for 5 minutes
- **DiskSpaceLow**: Disk space < 10%
- **ServiceDown**: Service unavailable for 1 minute

### Application Alerts

- **HighErrorRate**: Error rate > 5% for 5 minutes
- **HighResponseTime**: 95th percentile > 1 second
- **WorkflowExecutionFailureRate**: Failure rate > 10%
- **QueueBacklog**: Queue size > 100 items

### Business Alerts

- **LowUserActivity**: Login rate < 10/hour for 30 minutes
- **WorkflowCreationDrop**: Creation rate < 5/hour
- **ExecutionVolumeSpike**: Execution rate > 100/5min

## Operational Procedures

### Daily Operations

1. **Morning Health Check** (9:00 AM):
   - Review overnight alerts
   - Check system health metrics
   - Verify business metrics

2. **Performance Review**:
   - Response times < 1 second (95th percentile)
   - Error rate < 1%
   - Workflow success rate > 95%

### Incident Response

1. **P0 (Critical)**: < 5 minutes response time
2. **P1 (High)**: < 15 minutes response time
3. **P2 (Medium)**: < 1 hour response time

See `monitoring/runbooks/incident-response.md` for detailed procedures.

### Maintenance Windows

- **Weekly**: Database maintenance (Sunday 2:00 AM)
- **Monthly**: Security updates and patches
- **Quarterly**: Disaster recovery testing

## Troubleshooting

### Common Issues

1. **Metrics not appearing in Prometheus**:
   - Check service labels: `monitoring: enabled`
   - Verify metrics endpoint: `curl http://service:port/metrics`
   - Check Prometheus targets: http://localhost:9090/targets

2. **Grafana dashboards not loading**:
   - Verify Prometheus datasource configuration
   - Check dashboard JSON syntax
   - Ensure proper permissions

3. **Jaeger traces not appearing**:
   - Verify tracing initialization in application
   - Check Jaeger collector connectivity
   - Validate trace sampling configuration

4. **Alerts not firing**:
   - Check AlertManager configuration
   - Verify alert rule syntax
   - Test notification channels

### Performance Optimization

1. **Reduce metric cardinality**:
   - Limit label values
   - Use recording rules for complex queries
   - Implement metric retention policies

2. **Optimize dashboard queries**:
   - Use recording rules for expensive queries
   - Implement proper time ranges
   - Cache dashboard data

3. **Trace sampling**:
   - Implement adaptive sampling
   - Reduce trace volume in production
   - Focus on critical paths

## Testing

Run the monitoring validation tests:

```bash
# Basic monitoring tests
npm test -- tests/monitoring/monitoring-basic.test.ts

# Full validation suite
npm test -- tests/monitoring/

# Integration testing
./scripts/validate-monitoring.sh
```

## Security Considerations

1. **Access Control**:
   - Use RBAC for Grafana access
   - Secure Prometheus with authentication
   - Implement network policies

2. **Data Protection**:
   - Encrypt metrics in transit
   - Sanitize sensitive data in traces
   - Implement data retention policies

3. **Compliance**:
   - GDPR compliance for user metrics
   - SOC2 audit trail requirements
   - Data residency controls

## Scaling Considerations

1. **High Availability**:
   - Deploy Prometheus in HA mode
   - Use Grafana clustering
   - Implement AlertManager clustering

2. **Storage**:
   - Configure appropriate retention periods
   - Use remote storage for long-term metrics
   - Implement data compression

3. **Performance**:
   - Optimize scrape intervals
   - Use federation for multi-cluster setups
   - Implement metric sharding

## Contributing

1. **Adding New Metrics**:
   - Follow naming conventions
   - Add appropriate labels
   - Update documentation

2. **Creating Dashboards**:
   - Use consistent styling
   - Include proper descriptions
   - Test with different time ranges

3. **Alert Rules**:
   - Test thoroughly before deployment
   - Include clear descriptions
   - Define appropriate thresholds

## Support

For monitoring-related issues:

1. Check the troubleshooting guide
2. Review operational runbooks
3. Contact the platform team
4. Create an incident ticket

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [AlertManager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)