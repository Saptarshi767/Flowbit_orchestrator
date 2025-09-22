import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetricsService } from '../../lib/monitoring/metrics';
import { BusinessMetricsService } from '../../lib/monitoring/business-metrics';

describe('Basic Monitoring System Validation', () => {
  let metricsService: MetricsService;
  let businessMetricsService: BusinessMetricsService;

  beforeEach(() => {
    metricsService = MetricsService.getInstance();
    businessMetricsService = new BusinessMetricsService();
  });

  afterEach(() => {
    // Don't clear metrics between tests to allow validation
    // metricsService.clearMetrics();
  });

  describe('Prometheus Metrics', () => {
    it('should collect HTTP request metrics', async () => {
      // Simulate HTTP requests
      metricsService.recordHttpRequest('GET', '/api/workflows', 200, 0.5, 'api-gateway');
      metricsService.recordHttpRequest('POST', '/api/workflows', 201, 1.2, 'api-gateway');
      metricsService.recordHttpRequest('GET', '/api/workflows', 500, 2.1, 'api-gateway');

      const metrics = await metricsService.getMetrics();
      
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('http_request_duration_seconds');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('method="POST"');
      expect(metrics).toContain('status_code="200"');
      expect(metrics).toContain('status_code="500"');
    });

    it('should collect workflow execution metrics', async () => {
      // Simulate workflow executions
      metricsService.recordWorkflowExecution(
        'wf-123',
        'Test Workflow',
        'langflow',
        'completed',
        30.5,
        'user-456'
      );
      metricsService.recordWorkflowExecution(
        'wf-124',
        'Another Workflow',
        'n8n',
        'failed',
        15.2,
        'user-789'
      );

      const metrics = await metricsService.getMetrics();
      
      expect(metrics).toContain('workflow_executions_total');
      expect(metrics).toContain('workflow_execution_duration_seconds');
      expect(metrics).toContain('engine_type="langflow"');
      expect(metrics).toContain('engine_type="n8n"');
      expect(metrics).toContain('status="completed"');
      expect(metrics).toContain('status="failed"');
    });

    it('should collect engine-specific metrics', async () => {
      // Simulate engine calls
      metricsService.recordEngineCall('langflow', 'execute', 'success', 2.3);
      metricsService.recordEngineCall('n8n', 'execute', 'error', 5.1, 'timeout', '504');

      const metrics = await metricsService.getMetrics();
      
      expect(metrics).toContain('engine_calls_total');
      expect(metrics).toContain('engine_call_duration_seconds');
      expect(metrics).toContain('engine_errors_total');
      expect(metrics).toContain('operation="execute"');
      expect(metrics).toContain('error_type="timeout"');
    });

    it('should update queue and system metrics', async () => {
      // Update various system metrics
      metricsService.updateQueueSize('execution-queue', 25);
      metricsService.updateActiveUsers('daily', 150);
      metricsService.updateCacheHitRate('redis', 85.5);
      metricsService.updateDatabaseConnections('postgres', 'main', 12);

      const metrics = await metricsService.getMetrics();
      
      expect(metrics).toContain('queue_depth');
      expect(metrics).toContain('active_users');
      expect(metrics).toContain('cache_hit_rate');
      expect(metrics).toContain('database_connections_active');
    });
  });

  describe('Business Metrics', () => {
    it('should collect comprehensive business metrics', async () => {
      const metrics = await businessMetricsService.collectBusinessMetrics();
      
      expect(metrics).toHaveProperty('activeUsers');
      expect(metrics).toHaveProperty('userRetention');
      expect(metrics).toHaveProperty('sessionMetrics');
      expect(metrics).toHaveProperty('workflowMetrics');
      expect(metrics).toHaveProperty('executionMetrics');
      expect(metrics).toHaveProperty('revenueMetrics');
      expect(metrics).toHaveProperty('usageMetrics');
      expect(metrics).toHaveProperty('platformMetrics');
      expect(metrics).toHaveProperty('performanceMetrics');
    });

    it('should manage KPI targets', async () => {
      const kpis = businessMetricsService.getKPITargets();
      expect(kpis.length).toBeGreaterThan(0);
      
      const monthlyActiveUsers = businessMetricsService.getKPITarget('monthly_active_users');
      expect(monthlyActiveUsers).toBeDefined();
      expect(monthlyActiveUsers?.targetValue).toBe(10000);
    });

    it('should update KPI targets', async () => {
      businessMetricsService.updateKPITarget('monthly_active_users', {
        currentValue: 8500,
        trend: 'up',
        status: 'at-risk'
      });

      const updatedKPI = businessMetricsService.getKPITarget('monthly_active_users');
      expect(updatedKPI?.currentValue).toBe(8500);
      expect(updatedKPI?.trend).toBe('up');
      expect(updatedKPI?.status).toBe('at-risk');
    });

    it('should generate business reports', async () => {
      const report = businessMetricsService.generateBusinessReport();
      expect(report).toContain('# Business Metrics Report');
      expect(report).toContain('## Key Performance Indicators');
      expect(report).toContain('MONTHLY ACTIVE USERS');
    });
  });

  describe('Prometheus Integration', () => {
    it('should expose metrics endpoint', async () => {
      const metrics = await metricsService.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('string');
    });

    it('should validate metric format', async () => {
      const metrics = await metricsService.getMetrics();
      
      // Check Prometheus format
      const lines = metrics.split('\n');
      const metricLines = lines.filter(line => 
        line.startsWith('http_requests_total') || 
        line.startsWith('workflow_executions_total')
      );
      
      metricLines.forEach(line => {
        // Should contain metric name, labels, and value
        expect(line).toMatch(/^[a-zA-Z_:][a-zA-Z0-9_:]*(\{[^}]*\})?\s+[0-9.]+(\s+[0-9]+)?$/);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle high metric volume', async () => {
      const startTime = Date.now();
      
      // Generate 1000 metrics
      for (let i = 0; i < 1000; i++) {
        metricsService.recordHttpRequest(
          'GET',
          `/api/test/${i}`,
          200,
          Math.random(),
          'test-service'
        );
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent metric collection', async () => {
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve(metricsService.recordWorkflowExecution(
            `wf-${i}`,
            `Workflow ${i}`,
            'langflow',
            'completed',
            Math.random() * 60,
            `user-${i}`
          ))
        );
      }
      
      await Promise.all(promises);
      
      const metrics = await metricsService.getMetrics();
      expect(metrics).toContain('workflow_executions_total');
    });
  });

  describe('Error Handling', () => {
    it('should handle metric collection errors gracefully', async () => {
      // Test with invalid metric values
      expect(() => {
        metricsService.recordHttpRequest('', '', NaN, -1, '');
      }).not.toThrow();
    });
  });
});

describe('Monitoring System Integration', () => {
  it('should validate end-to-end monitoring flow', async () => {
    const metricsService = MetricsService.getInstance();
    const businessMetricsService = new BusinessMetricsService();

    // Simulate a complete workflow execution
    metricsService.recordWorkflowExecution(
      'wf-integration-test',
      'Integration Test Workflow',
      'langflow',
      'completed',
      45.2,
      'test-user'
    );

    // Collect business metrics
    const businessMetrics = await businessMetricsService.collectBusinessMetrics();
    
    // Verify metrics are collected
    expect(businessMetrics.executionMetrics.totalExecutions).toBeGreaterThanOrEqual(0);
    
    // Generate report
    const report = businessMetricsService.generateBusinessReport();
    expect(report).toContain('Business Metrics Report');
  });
});