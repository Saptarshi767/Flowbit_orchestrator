# Incident Response Runbook

## Overview

This runbook provides step-by-step procedures for responding to incidents in the AI Orchestrator platform. It covers common scenarios, escalation procedures, and recovery steps.

## Incident Classification

### Severity Levels

#### P0 - Critical (Complete Service Outage)
- **Definition**: Complete platform unavailability or data loss
- **Response Time**: Immediate (< 5 minutes)
- **Escalation**: Immediate to on-call engineer and management
- **Examples**: 
  - All services down
  - Database corruption
  - Security breach

#### P1 - High (Major Feature Unavailable)
- **Definition**: Major functionality unavailable affecting multiple users
- **Response Time**: < 15 minutes
- **Escalation**: On-call engineer, escalate to team lead if not resolved in 1 hour
- **Examples**:
  - Workflow execution failures
  - Authentication service down
  - API gateway failures

#### P2 - Medium (Degraded Performance)
- **Definition**: Performance degradation or minor feature issues
- **Response Time**: < 1 hour
- **Escalation**: Assigned to on-call engineer, escalate if not resolved in 4 hours
- **Examples**:
  - Slow response times
  - Intermittent failures
  - Non-critical service degradation

#### P3 - Low (Minor Issues)
- **Definition**: Minor issues with workarounds available
- **Response Time**: < 4 hours
- **Escalation**: Standard business hours support
- **Examples**:
  - UI glitches
  - Documentation issues
  - Non-critical monitoring alerts

## Common Incident Scenarios

### 1. Service Down Alert

#### Symptoms
- Prometheus alert: `ServiceDown`
- Service health check failures
- User reports of unavailability

#### Investigation Steps
1. **Check service status**:
   ```bash
   kubectl get pods -n ai-orchestrator
   kubectl describe pod <pod-name> -n ai-orchestrator
   ```

2. **Check service logs**:
   ```bash
   kubectl logs <pod-name> -n ai-orchestrator --tail=100
   ```

3. **Check resource usage**:
   ```bash
   kubectl top pods -n ai-orchestrator
   kubectl top nodes
   ```

#### Resolution Steps
1. **If pod is crashed**:
   ```bash
   kubectl delete pod <pod-name> -n ai-orchestrator
   # Wait for automatic restart
   ```

2. **If resource exhaustion**:
   ```bash
   # Scale up the deployment
   kubectl scale deployment <deployment-name> --replicas=<new-count> -n ai-orchestrator
   ```

3. **If persistent issues**:
   - Check recent deployments
   - Review configuration changes
   - Escalate to development team

### 2. High Error Rate Alert

#### Symptoms
- Prometheus alert: `HighErrorRate`
- Increased 5xx responses
- User complaints about failures

#### Investigation Steps
1. **Check error patterns**:
   - Review Grafana dashboards
   - Check application logs
   - Identify affected endpoints

2. **Check dependencies**:
   - Database connectivity
   - External service status
   - Network connectivity

#### Resolution Steps
1. **If database issues**:
   ```bash
   # Check database connections
   kubectl exec -it <postgres-pod> -- psql -U postgres -c "SELECT * FROM pg_stat_activity;"
   ```

2. **If external service issues**:
   - Check engine adapter status
   - Verify API credentials
   - Test connectivity

3. **If application bugs**:
   - Rollback to previous version if recent deployment
   - Apply hotfix if available
   - Escalate to development team

### 3. High Response Time Alert

#### Symptoms
- Prometheus alert: `HighResponseTime`
- Slow user experience
- Timeout errors

#### Investigation Steps
1. **Check system resources**:
   - CPU and memory usage
   - Database performance
   - Cache hit rates

2. **Check application performance**:
   - Review distributed traces in Jaeger
   - Identify slow operations
   - Check for database slow queries

#### Resolution Steps
1. **If resource constraints**:
   ```bash
   # Scale up services
   kubectl scale deployment <deployment-name> --replicas=<new-count>
   ```

2. **If database performance**:
   ```sql
   -- Check slow queries
   SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
   ```

3. **If cache issues**:
   ```bash
   # Check Redis status
   kubectl exec -it <redis-pod> -- redis-cli info
   ```

### 4. Workflow Execution Failures

#### Symptoms
- Prometheus alert: `WorkflowExecutionFailureRate`
- User reports of failed workflows
- High failure rate in dashboards

#### Investigation Steps
1. **Check execution logs**:
   - Review workflow execution traces
   - Check engine adapter logs
   - Identify failure patterns

2. **Check engine status**:
   - Verify Langflow/N8N/LangSmith connectivity
   - Check engine resource usage
   - Test engine API endpoints

#### Resolution Steps
1. **If engine connectivity issues**:
   ```bash
   # Test engine connectivity
   curl -X GET http://langflow-service:7860/health
   curl -X GET http://n8n-service:5678/healthz
   ```

2. **If resource issues**:
   - Scale engine instances
   - Increase resource limits
   - Check queue backlogs

3. **If workflow definition issues**:
   - Validate workflow definitions
   - Check for breaking changes
   - Notify workflow owners

## Escalation Procedures

### On-Call Rotation
- **Primary**: Current on-call engineer
- **Secondary**: Backup on-call engineer
- **Escalation**: Team lead → Engineering manager → CTO

### Contact Information
- **Slack**: #incident-response
- **PagerDuty**: ai-orchestrator-oncall
- **Email**: oncall@ai-orchestrator.com

### Escalation Timeline
- **P0**: Immediate escalation to management
- **P1**: Escalate after 1 hour if not resolved
- **P2**: Escalate after 4 hours if not resolved
- **P3**: Escalate during business hours if needed

## Communication Procedures

### Internal Communication
1. **Create incident channel**: #incident-YYYY-MM-DD-HHMMSS
2. **Post initial status**: Include severity, impact, and ETA
3. **Regular updates**: Every 30 minutes for P0/P1, hourly for P2
4. **Resolution notification**: Include root cause and prevention measures

### External Communication
1. **Status page updates**: Update status.ai-orchestrator.com
2. **Customer notifications**: Email for P0/P1 incidents affecting multiple customers
3. **Post-incident communication**: Summary and prevention measures

## Recovery Procedures

### Database Recovery
```bash
# Restore from backup
kubectl exec -it <postgres-pod> -- pg_restore -U postgres -d orchestrator /backups/latest.dump

# Verify data integrity
kubectl exec -it <postgres-pod> -- psql -U postgres -d orchestrator -c "SELECT COUNT(*) FROM workflows;"
```

### Service Recovery
```bash
# Rolling restart of all services
kubectl rollout restart deployment -n ai-orchestrator

# Verify service health
kubectl get pods -n ai-orchestrator
curl -f http://api-gateway/health
```

### Cache Recovery
```bash
# Clear Redis cache if corrupted
kubectl exec -it <redis-pod> -- redis-cli FLUSHALL

# Warm up cache with critical data
curl -X POST http://api-gateway/admin/cache/warmup
```

## Post-Incident Procedures

### Immediate Actions (Within 24 hours)
1. **Document timeline**: Record all actions taken
2. **Collect artifacts**: Logs, metrics, traces
3. **Initial root cause analysis**: Preliminary findings
4. **Implement immediate fixes**: Prevent recurrence

### Follow-up Actions (Within 1 week)
1. **Detailed post-mortem**: Root cause analysis
2. **Action items**: Prevention and improvement measures
3. **Process improvements**: Update runbooks and procedures
4. **Team review**: Share learnings with the team

### Post-Mortem Template
```markdown
# Post-Mortem: [Incident Title]

## Summary
- **Date**: YYYY-MM-DD
- **Duration**: X hours Y minutes
- **Severity**: PX
- **Impact**: Description of user impact

## Timeline
- HH:MM - Initial alert
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix implemented
- HH:MM - Service restored

## Root Cause
Detailed explanation of what caused the incident

## Resolution
Steps taken to resolve the incident

## Action Items
1. [ ] Prevention measure 1 (Owner: Name, Due: Date)
2. [ ] Prevention measure 2 (Owner: Name, Due: Date)
3. [ ] Process improvement (Owner: Name, Due: Date)

## Lessons Learned
What we learned and how we can improve
```