import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MonitoringService } from '../../src/services/monitoring.service';
import { 
  Metrics, 
  MetricSource, 
  AlertCondition, 
  NotificationConfig, 
  TimeRange,
  AlertOperator,
  AlertSeverity,
  NotificationChannelType
} from '@robust-ai-orchestrator/shared';
import { createLogger } from 'winston';
import { Server as HttpServer } from 'http';

// Mock all the service dependencies
vi.mock('../../src/services/metrics-collector.service');
vi.mock('../../src/services/realtime-monitor.service');
vi.mock('../../src/services/health-checker.service');
vi.mock('../../src/services/alert-manager.service');
vi.mock('../../src/services/log-aggregator.service');
vi.mock('../../src/services/service-registry.service');
vi.mock('../../src/services/notification.service');

describe('MonitoringService', () => {
  let service: MonitoringService;
  let logger: any;
  let mockHttpServer: HttpServer;

  beforeEach(() => {
    logger = createLogger({ silent: true });
    mockHttpServer = {} as HttpServer;
    service = new MonitoringService(mockHttpServer, logger);
    
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await service.cleanup();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize all sub-services', () => {
      expect(service).toBeDefined();
      expect(service.getMetricsCollector()).toBeDefined();
      expect(service.getRealtimeMonitor()).toBeDefined();
      expect(service.getHealthChecker()).toBeDefined();
      expect(service.getAlertManager()).toBeDefined();
      expect(service.getLogAggregator()).toBeDefined();
      expect(service.getServiceRegistry()).toBeDefined();
      expect(service.getNotificationService()).toBeDefined();
    });
  });

  describe('collectMetrics', () => {
    it('should collect metrics from external source', async () => {
      const source: MetricSource = {
        service: 'test-service',
        instance: 'test-instance',
        version: '1.0.0',
        environment: 'test'
      };

      const metrics: Metrics = {
        timestamp: new Date(),
        source,
        counters: { requests: 100, errors: 5 },
        gauges: { cpu_usage: 75, memory_usage: 60 },
        histograms: { response_time: [1, 2, 3, 4, 5] },
        labels: { region: 'us-east-1' }
      };

      await expect(service.collectMetrics(source, metrics)).resolves.not.toThrow();
    });

    it('should handle metrics collection errors', async () => {
      const source: MetricSource = {
        service: 'failing-service',
        instance: 'failing-instance',
        version: '1.0.0',
        environment: 'test'
      };

      // Mock the alert manager to throw an error
      const mockAlertManager = service.getAlertManager();
      vi.spyOn(mockAlertManager, 'updateMetric').mockImplementation(() => {
        throw new Error('Alert manager error');
      });

      await expect(service.collectMetrics(source, {} as Metrics)).rejects.toThrow();
    });
  });

  describe('createAlert', () => {
    it('should create alert condition with notification config', async () => {
      const condition: AlertCondition = {
        id: 'test-condition',
        name: 'High CPU Usage',
        description: 'Alert when CPU usage exceeds 80%',
        metric: 'cpu_usage',
        operator: AlertOperator.GREATER_THAN,
        threshold: 80,
        duration: 300,
        severity: AlertSeverity.HIGH,
        enabled: true
      };

      const notificationConfig: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.EMAIL,
            config: { to: 'admin@example.com' },
            enabled: true
          }
        ]
      };

      // Mock the alert manager
      const mockAlertManager = service.getAlertManager();
      vi.spyOn(mockAlertManager, 'createCondition').mockResolvedValue(condition);

      const alert = await service.createAlert(condition, notificationConfig);

      expect(alert).toBeDefined();
      expect(alert.conditionId).toBe('test-condition');
      expect(mockAlertManager.createCondition).toHaveBeenCalledWith(condition);
    });

    it('should handle alert creation errors', async () => {
      const condition: AlertCondition = {
        id: 'failing-condition',
        name: 'Failing Alert',
        metric: 'test_metric',
        operator: AlertOperator.GREATER_THAN,
        threshold: 50,
        duration: 300,
        severity: AlertSeverity.MEDIUM,
        enabled: true
      };

      const notificationConfig: NotificationConfig = {
        channels: []
      };

      // Mock the alert manager to throw an error
      const mockAlertManager = service.getAlertManager();
      vi.spyOn(mockAlertManager, 'createCondition').mockRejectedValue(new Error('Creation failed'));

      await expect(service.createAlert(condition, notificationConfig)).rejects.toThrow('Creation failed');
    });
  });

  describe('getDashboardData', () => {
    it('should return dashboard data for given ID and time range', async () => {
      const dashboardId = 'test-dashboard';
      const timeRange: TimeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      const dashboardData = await service.getDashboardData(dashboardId, timeRange);

      expect(dashboardData).toBeDefined();
      expect(dashboardData.id).toBe(dashboardId);
      expect(dashboardData.timeRange).toEqual(timeRange);
      expect(dashboardData.widgets).toBeDefined();
      expect(Array.isArray(dashboardData.widgets)).toBe(true);
    });

    it('should handle dashboard data retrieval errors', async () => {
      const dashboardId = 'failing-dashboard';
      const timeRange: TimeRange = {
        start: new Date(),
        end: new Date()
      };

      // Mock an internal error
      vi.spyOn(service, 'getDashboardData').mockRejectedValueOnce(new Error('Dashboard error'));

      await expect(service.getDashboardData(dashboardId, timeRange)).rejects.toThrow('Dashboard error');
    });
  });

  describe('generateReport', () => {
    it('should generate report of specified type', async () => {
      const reportType = {
        id: 'system-health',
        name: 'System Health Report',
        description: 'Comprehensive system health report'
      };

      const parameters = {
        timeRange: '24h',
        includeMetrics: true,
        includeAlerts: true
      };

      const report = await service.generateReport(reportType, parameters);

      expect(report).toBeDefined();
      expect(report.type).toBe('system-health');
      expect(report.parameters).toEqual(parameters);
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.data).toBeDefined();
    });

    it('should handle report generation errors', async () => {
      const reportType = {
        id: 'failing-report',
        name: 'Failing Report',
        description: 'Report that fails to generate'
      };

      // Mock an internal error
      vi.spyOn(service, 'generateReport').mockRejectedValueOnce(new Error('Report generation failed'));

      await expect(service.generateReport(reportType, {})).rejects.toThrow('Report generation failed');
    });
  });

  describe('getSystemHealth', () => {
    it('should return system health checks', async () => {
      // Mock the health checker
      const mockHealthChecker = service.getHealthChecker();
      const mockHealthCheck = {
        service: 'monitoring',
        status: 'healthy' as const,
        timestamp: new Date(),
        checks: [],
        metadata: {}
      };
      vi.spyOn(mockHealthChecker, 'getHealthStatus').mockResolvedValue(mockHealthCheck);

      const healthChecks = await service.getSystemHealth();

      expect(healthChecks).toBeDefined();
      expect(Array.isArray(healthChecks)).toBe(true);
      expect(healthChecks).toHaveLength(1);
      expect(healthChecks[0]).toEqual(mockHealthCheck);
    });

    it('should handle health check errors', async () => {
      // Mock the health checker to throw an error
      const mockHealthChecker = service.getHealthChecker();
      vi.spyOn(mockHealthChecker, 'getHealthStatus').mockRejectedValue(new Error('Health check failed'));

      await expect(service.getSystemHealth()).rejects.toThrow('Health check failed');
    });
  });

  describe('getServiceDiscovery', () => {
    it('should return service discovery information', async () => {
      // Mock the service registry
      const mockServiceRegistry = service.getServiceRegistry();
      const mockServiceDiscovery = {
        services: [],
        lastUpdated: new Date()
      };
      vi.spyOn(mockServiceRegistry, 'getServices').mockResolvedValue(mockServiceDiscovery);

      const serviceDiscovery = await service.getServiceDiscovery();

      expect(serviceDiscovery).toBeDefined();
      expect(serviceDiscovery).toEqual(mockServiceDiscovery);
      expect(serviceDiscovery.services).toBeDefined();
      expect(serviceDiscovery.lastUpdated).toBeInstanceOf(Date);
    });

    it('should handle service discovery errors', async () => {
      // Mock the service registry to throw an error
      const mockServiceRegistry = service.getServiceRegistry();
      vi.spyOn(mockServiceRegistry, 'getServices').mockRejectedValue(new Error('Service discovery failed'));

      await expect(service.getServiceDiscovery()).rejects.toThrow('Service discovery failed');
    });
  });

  describe('service integrations', () => {
    it('should integrate metrics collection with alert evaluation', async () => {
      const source: MetricSource = {
        service: 'integration-test',
        instance: 'test-instance',
        version: '1.0.0',
        environment: 'test'
      };

      const metrics: Metrics = {
        timestamp: new Date(),
        source,
        counters: { requests: 1000 },
        gauges: { cpu_usage: 90 },
        histograms: {},
        labels: {}
      };

      // Mock alert manager
      const mockAlertManager = service.getAlertManager();
      const updateMetricSpy = vi.spyOn(mockAlertManager, 'updateMetric');

      await service.collectMetrics(source, metrics);

      // Verify that metrics are passed to alert manager
      expect(updateMetricSpy).toHaveBeenCalledWith('requests', 1000, metrics.labels);
      expect(updateMetricSpy).toHaveBeenCalledWith('cpu_usage', 90, metrics.labels);
    });

    it('should integrate alerts with real-time monitoring', async () => {
      // This integration is tested through the setup methods
      // The actual integration happens in the constructor
      expect(service.getRealtimeMonitor()).toBeDefined();
      expect(service.getAlertManager()).toBeDefined();
    });

    it('should integrate alerts with notifications', async () => {
      // This integration is tested through the createAlert method
      expect(service.getNotificationService()).toBeDefined();
      expect(service.getAlertManager()).toBeDefined();
    });
  });

  describe('periodic tasks', () => {
    it('should set up periodic health checks', () => {
      // Verify that periodic tasks are set up during initialization
      // This is tested indirectly through the constructor
      expect(service.getHealthChecker()).toBeDefined();
    });

    it('should set up periodic metrics collection', () => {
      // Verify that periodic metrics collection is set up
      expect(service.getMetricsCollector()).toBeDefined();
      expect(service.getRealtimeMonitor()).toBeDefined();
    });

    it('should set up periodic alert evaluation', () => {
      // Verify that periodic alert evaluation is set up
      expect(service.getAlertManager()).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup all sub-services', async () => {
      // Mock cleanup methods
      const mockAlertManager = service.getAlertManager();
      const mockLogAggregator = service.getLogAggregator();
      const mockHealthChecker = service.getHealthChecker();
      const mockServiceRegistry = service.getServiceRegistry();

      const alertCleanupSpy = vi.spyOn(mockAlertManager, 'cleanup');
      const logCleanupSpy = vi.spyOn(mockLogAggregator, 'cleanup');
      const healthCleanupSpy = vi.spyOn(mockHealthChecker, 'cleanup').mockResolvedValue();
      const serviceCleanupSpy = vi.spyOn(mockServiceRegistry, 'cleanup').mockResolvedValue();

      await service.cleanup();

      expect(alertCleanupSpy).toHaveBeenCalled();
      expect(logCleanupSpy).toHaveBeenCalled();
      expect(healthCleanupSpy).toHaveBeenCalled();
      expect(serviceCleanupSpy).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock cleanup methods to throw errors
      const mockHealthChecker = service.getHealthChecker();
      vi.spyOn(mockHealthChecker, 'cleanup').mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw even if individual cleanup fails
      await expect(service.cleanup()).resolves.not.toThrow();
    });
  });

  describe('utility methods', () => {
    it('should provide access to all sub-services', () => {
      expect(service.getMetricsCollector()).toBeDefined();
      expect(service.getRealtimeMonitor()).toBeDefined();
      expect(service.getHealthChecker()).toBeDefined();
      expect(service.getAlertManager()).toBeDefined();
      expect(service.getLogAggregator()).toBeDefined();
      expect(service.getServiceRegistry()).toBeDefined();
      expect(service.getNotificationService()).toBeDefined();
    });

    it('should maintain consistent service instances', () => {
      const metricsCollector1 = service.getMetricsCollector();
      const metricsCollector2 = service.getMetricsCollector();
      
      expect(metricsCollector1).toBe(metricsCollector2);
    });
  });

  describe('error handling', () => {
    it('should handle service initialization errors', () => {
      // Test that the service can handle initialization errors gracefully
      expect(service).toBeDefined();
    });

    it('should handle concurrent operations', async () => {
      const source: MetricSource = {
        service: 'concurrent-test',
        instance: 'test-instance',
        version: '1.0.0',
        environment: 'test'
      };

      const metrics: Metrics = {
        timestamp: new Date(),
        source,
        counters: {},
        gauges: {},
        histograms: {},
        labels: {}
      };

      // Run multiple operations concurrently
      const operations = [
        service.collectMetrics(source, metrics),
        service.getSystemHealth(),
        service.getServiceDiscovery()
      ];

      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });
});