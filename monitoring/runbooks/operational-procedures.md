# Operational Procedures

## Daily Operations

### Morning Health Check (9:00 AM)
1. **Review overnight alerts**:
   - Check Slack #alerts channel
   - Review PagerDuty incidents
   - Check Grafana dashboards

2. **System health verification**:
   ```bash
   # Check all services are running
   kubectl get pods -n ai-orchestrator
   
   # Check resource usage
   kubectl top nodes
   kubectl top pods -n ai-orchestrator
   
   # Verify database connectivity
   kubectl exec -it postgres-0 -- pg_isready
   ```

3. **Performance metrics review**:
   - Response times < 1 second (95th percentile)
   - Error rate < 1%
   - Workflow success rate > 95%
   - Queue depth < 50 items

4. **Business metrics check**:
   - Active users (last 24h)
   - Workflow executions (last 24h)
   - Revenue metrics
   - API usage

### Weekly Operations (Monday 10:00 AM)

1. **Capacity planning review**:
   - Resource utilization trends
   - Growth projections
   - Scaling recommendations

2. **Security review**:
   - Failed authentication attempts
   - Unusual access patterns
   - Security scan results

3. **Performance analysis**:
   - Slow query analysis
   - Cache hit rate optimization
   - Database index recommendations

4. **Backup verification**:
   ```bash
   # Verify backup completion
   kubectl logs -l app=backup-job --tail=50
   
   # Test backup restore (staging)
   kubectl apply -f backup-restore-test.yaml
   ```

### Monthly Operations (First Monday)

1. **Disaster recovery test**:
   - Failover procedures
   - Backup restoration
   - RTO/RPO validation

2. **Security audit**:
   - Access review
   - Certificate renewal
   - Vulnerability assessment

3. **Cost optimization**:
   - Resource usage analysis
   - Right-sizing recommendations
   - Reserved instance planning

## Maintenance Procedures

### Planned Maintenance Window

#### Pre-maintenance (T-24 hours)
1. **Notification**:
   - Update status page
   - Send customer notifications
   - Notify internal teams

2. **Preparation**:
   ```bash
   # Create maintenance branch
   git checkout -b maintenance-YYYY-MM-DD
   
   # Backup current state
   kubectl create backup production-pre-maintenance
   
   # Prepare rollback plan
   kubectl get deployments -o yaml > rollback-state.yaml
   ```

#### During maintenance
1. **Enable maintenance mode**:
   ```bash
   kubectl patch configmap api-config --patch '{"data":{"maintenance_mode":"true"}}'
   ```

2. **Perform updates**:
   ```bash
   # Update services one by one
   kubectl set image deployment/api-gateway api-gateway=new-image:tag
   kubectl rollout status deployment/api-gateway
   ```

3. **Verify functionality**:
   ```bash
   # Run health checks
   ./scripts/health-check.sh
   
   # Run smoke tests
   ./scripts/smoke-tests.sh
   ```

#### Post-maintenance
1. **Disable maintenance mode**:
   ```bash
   kubectl patch configmap api-config --patch '{"data":{"maintenance_mode":"false"}}'
   ```

2. **Monitor for issues**:
   - Watch error rates for 2 hours
   - Monitor performance metrics
   - Check user feedback

### Database Maintenance

#### Weekly Database Maintenance (Sunday 2:00 AM)
```bash
# Connect to database
kubectl exec -it postgres-0 -- psql -U postgres

-- Update statistics
ANALYZE;

-- Reindex if needed
REINDEX DATABASE orchestrator;

-- Check for bloat
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Vacuum if needed
VACUUM ANALYZE;
```

#### Monthly Database Cleanup
```sql
-- Clean old execution logs (older than 90 days)
DELETE FROM execution_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- Clean old audit logs (older than 1 year)
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year';

-- Archive old workflow versions (keep last 10 versions)
WITH versions_to_keep AS (
  SELECT id FROM workflow_versions 
  WHERE workflow_id = ? 
  ORDER BY version DESC 
  LIMIT 10
)
DELETE FROM workflow_versions 
WHERE workflow_id = ? AND id NOT IN (SELECT id FROM versions_to_keep);
```

### Cache Maintenance

#### Redis Maintenance
```bash
# Check Redis memory usage
kubectl exec -it redis-0 -- redis-cli info memory

# Clear expired keys
kubectl exec -it redis-0 -- redis-cli --scan --pattern "*" | xargs -L 1000 redis-cli del

# Optimize memory
kubectl exec -it redis-0 -- redis-cli memory doctor
```

## Monitoring Procedures

### Alert Response Procedures

#### High Priority Alerts (P0/P1)
1. **Immediate response** (< 5 minutes):
   - Acknowledge alert in PagerDuty
   - Join incident response channel
   - Begin investigation

2. **Initial assessment** (< 15 minutes):
   - Determine impact and scope
   - Classify incident severity
   - Notify stakeholders

3. **Investigation** (< 30 minutes):
   - Check system health
   - Review recent changes
   - Identify root cause

4. **Resolution** (< 2 hours for P0, < 4 hours for P1):
   - Implement fix
   - Verify resolution
   - Monitor for stability

#### Medium Priority Alerts (P2)
1. **Response** (< 1 hour):
   - Review alert details
   - Assess impact
   - Plan investigation

2. **Investigation** (< 4 hours):
   - Analyze metrics and logs
   - Identify trends
   - Determine action needed

3. **Resolution** (< 24 hours):
   - Implement fix or optimization
   - Update monitoring if needed
   - Document findings

### Performance Monitoring

#### Daily Performance Review
1. **Response time analysis**:
   ```bash
   # Check 95th percentile response times
   curl -s "http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
   ```

2. **Error rate analysis**:
   ```bash
   # Check error rates by service
   curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[5m])"
   ```

3. **Resource utilization**:
   ```bash
   # Check CPU and memory usage
   kubectl top nodes
   kubectl top pods --sort-by=cpu
   kubectl top pods --sort-by=memory
   ```

#### Weekly Performance Optimization
1. **Database performance**:
   ```sql
   -- Check slow queries
   SELECT query, mean_time, calls, total_time 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   
   -- Check index usage
   SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
   FROM pg_stat_user_indexes
   ORDER BY idx_scan ASC;
   ```

2. **Cache optimization**:
   ```bash
   # Check cache hit rates
   kubectl exec -it redis-0 -- redis-cli info stats | grep hit_rate
   
   # Analyze cache usage patterns
   kubectl exec -it redis-0 -- redis-cli --bigkeys
   ```

## Backup and Recovery

### Automated Backup Procedures

#### Database Backups (Daily at 2:00 AM)
```bash
#!/bin/bash
# Database backup script

BACKUP_DIR="/backups/$(date +%Y-%m-%d)"
mkdir -p $BACKUP_DIR

# Full database backup
kubectl exec postgres-0 -- pg_dump -U postgres orchestrator > $BACKUP_DIR/orchestrator-full.sql

# Compressed backup
kubectl exec postgres-0 -- pg_dump -U postgres -Fc orchestrator > $BACKUP_DIR/orchestrator-compressed.dump

# Upload to cloud storage
aws s3 cp $BACKUP_DIR/ s3://ai-orchestrator-backups/database/ --recursive

# Cleanup old backups (keep 30 days)
find /backups -type d -mtime +30 -exec rm -rf {} \;
```

#### Configuration Backups (Daily at 3:00 AM)
```bash
#!/bin/bash
# Configuration backup script

BACKUP_DIR="/backups/config/$(date +%Y-%m-%d)"
mkdir -p $BACKUP_DIR

# Kubernetes configurations
kubectl get all -n ai-orchestrator -o yaml > $BACKUP_DIR/k8s-resources.yaml
kubectl get configmaps -n ai-orchestrator -o yaml > $BACKUP_DIR/configmaps.yaml
kubectl get secrets -n ai-orchestrator -o yaml > $BACKUP_DIR/secrets.yaml

# Application configurations
cp -r /app/config $BACKUP_DIR/
cp -r /app/certificates $BACKUP_DIR/

# Upload to cloud storage
aws s3 cp $BACKUP_DIR/ s3://ai-orchestrator-backups/config/ --recursive
```

### Recovery Procedures

#### Database Recovery
```bash
# Stop application services
kubectl scale deployment --replicas=0 -n ai-orchestrator

# Restore database
kubectl exec -it postgres-0 -- dropdb -U postgres orchestrator
kubectl exec -it postgres-0 -- createdb -U postgres orchestrator
kubectl exec -i postgres-0 -- psql -U postgres orchestrator < backup.sql

# Restart services
kubectl scale deployment --replicas=3 -n ai-orchestrator

# Verify recovery
./scripts/health-check.sh
```

#### Configuration Recovery
```bash
# Restore Kubernetes resources
kubectl apply -f k8s-resources.yaml

# Restore configmaps and secrets
kubectl apply -f configmaps.yaml
kubectl apply -f secrets.yaml

# Restart affected services
kubectl rollout restart deployment -n ai-orchestrator
```

## Security Procedures

### Daily Security Monitoring
1. **Failed authentication review**:
   ```bash
   # Check failed login attempts
   kubectl logs -l app=auth-service | grep "authentication failed" | tail -50
   ```

2. **Unusual access patterns**:
   ```bash
   # Check for unusual API access
   kubectl logs -l app=api-gateway | grep -E "(429|401|403)" | tail -100
   ```

3. **Security scan results**:
   ```bash
   # Run security scan
   ./scripts/security-scan.sh
   
   # Check vulnerability reports
   cat /reports/security/latest-scan.json
   ```

### Weekly Security Review
1. **Access audit**:
   - Review user permissions
   - Check service account access
   - Validate API key usage

2. **Certificate management**:
   ```bash
   # Check certificate expiration
   kubectl get certificates -n ai-orchestrator
   
   # Renew certificates if needed
   certbot renew --dry-run
   ```

3. **Security updates**:
   ```bash
   # Check for security updates
   kubectl get vulnerabilityreports
   
   # Apply security patches
   kubectl patch deployment api-gateway -p '{"spec":{"template":{"spec":{"containers":[{"name":"api-gateway","image":"api-gateway:security-patch"}]}}}}'
   ```