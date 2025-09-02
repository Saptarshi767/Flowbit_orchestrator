import { IMonitoringService } from '../interfaces/monitoring.interface';
import {
  Metrics,
  MetricSource,
  Alert,
  AlertCondition,
  NotificationConfig,
  DashboardData,
  TimeRange,
  HealthCheck,
  ServiceDiscovery,
  Report,
  ReportType
} from '@robust-ai-orchestrator/shared';
import { Logger } from 'winston';
import { MetricsCollectorService } from './metrics-collector.service';
import { RealtimeMonitorService } from './realtime-monitor.service';
import { HealthCheckerService } from './health-checker.service';
import { AlertManagerService } from './alert-manager.service';
import { LogAggregatorService } from './log-aggregator.service';
import { ServiceRegistryService } from './service-registry.service';
import { NotificationService } from './notification.service';
import { Server as HttpServer } from 'http';

export class MonitoringService implements IMonitoringService {
  private metricsCollector: MetricsCollectorService;
  private realtimeMonitor: RealtimeMonitorService;
  private healthChecker: HealthCheckerService;
  private alertManager: AlertManagerService;
  private logAggregator: LogAggregatorService;
  private serviceRegistry: ServiceRegistryService;
  private notificationService: NotificationService;
  private logger: Logger;

  constructor(httpServer: HttpServer, logger: Logger) {
    this.logger = logger;
    
    // Initialize services
    this.metricsCollector = new MetricsCollectorService(logger);
    this.realtimeMonitor = new RealtimeMonitorService(httpServer, logger);
    this.healthChecker = new HealthCheckerService(logger);
    this.alertManager = new AlertManagerService(logger);
    this.logAggregator = new LogAggregatorService(logger);
    this.serviceRegistry = new ServiceRegistryService(logger);
    this.notificationService = new NotificationService(logger);

    this.setupIntegrations();
    this.logger.info('Monitoring service initialized');
  }

  private setupIntegrations(): void {
    // Connect alert manager to metrics collector
    this.setupMetricsToAlertsIntegration();
    
    // Connect alerts to real-time monitoring
    this.setupAlertsToRealtimeIntegration();
    
    // Connect alerts to notifications
    this.setupAlertsToNotificationsIntegration();
    
    // Setup periodic health checks
    this.setupPeriodicHealthChecks();
    
    // Setup metrics collection from other services
    this.setupMetricsCollection();
  }

  private setupMetricsToAlertsIntegration(): void {
    // Update alert manager with new metric values
    setInterval(async () => {
      try {
        const source: MetricSource = {
          service: 'monitoring',
          instance: process.env.HOSTNAME || 'localhost',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        };

        const metrics = await this.metricsCollector.collect(source);
        
        // Update alert manager with current metric values
        Object.entries(metrics.counters).forEach(([name, value]) => {
          this.alertManager.updateMetric(name, value);
        });
        
        Object.entries(metrics.gauges).forEach(([name, value]) => {
          this.alertManager.updateMetric(name, value);
        });
      } catch (error) {
        this.logger.error('Failed to update alert manager with metrics:', error);
      }
    }, 30000); // Every 30 seconds
  }

  private setupAlertsToRealtimeIntegration(): void {
    // Forward triggered alerts to real-time monitoring
    const originalEvaluateConditions = this.alertManager.evaluateConditions.bind(this.alertManager);
    this.alertManager.evaluateConditions = async () => {
      const alerts = await originalEvaluateConditions();
      
      // Broadcast new alerts
      alerts.forEach(alert => {
        this.realtimeMonitor.broadcastAlert(alert);
      });
      
      return alerts;
    };
  }

  private setupAlertsToNotificationsIntegration(): void {
    // This would be set up when creating alert conditions with notification configs
    // For now, we'll create a simple integration
  }

  private setupPeriodicHealthChecks(): void {
    // Run health checks every 2 minutes
    setInterval(async () => {
      try {
        await this.healthChecker.runChecks();
      } catch (error) {
        this.logger.error('Periodic health check failed:', error);
      }
    }, 120000); // Every 2 minutes
  }

  private setupMetricsCollection(): void {
    // Collect and broadcast metrics every 10 seconds
    setInterval(async () => {
      try {
        const source: MetricSource = {
          service: 'monitoring',
          instance: process.env.HOSTNAME || 'localhost',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        };

        const metrics = await this.metricsCollector.collect(source);
        this.realtimeMonitor.broadcastMetricsUpdate(metrics);
      } catch (error) {
        this.logger.error('Failed to collect and broadcast metrics:', error);
      }
    }, 10000); // Every 10 seconds
  }

  // IMonitoringService implementation
  async collectMetrics(source: MetricSource, metrics: Metrics): Promise<void> {
    try {
      // Store metrics for historical analysis
      // In a real implementation, this would persist to a time-series database
      
      // Update alert manager with new metric values
      Object.entries(metrics.counters).forEach(([name, value]) => {
        this.alertManager.updateMetric(name, value, metrics.labels);
      });
      
      Object.entries(metrics.gauges).forEach(([name, value]) => {
        this.alertManager.updateMetric(name, value, metrics.labels);
      });

      // Broadcast metrics update
      this.realtimeMonitor.broadcastMetricsUpdate(metrics);
      
      this.logger.debug(`Collected metrics from ${source.service}:${source.instance}`);
    } catch (error) {
      this.logger.error('Failed to collect metrics:', error);
      throw error;
    }
  }

  async createAlert(condition: AlertCondition, notification: NotificationConfig): Promise<Alert> {
    try {
      // Create the alert condition
      const createdCondition = await this.alertManager.createCondition(condition);
      
      // Store notification configuration for this condition
      // In a real implementation, this would be persisted
      
      // For now, return a placeholder alert
      const alert: Alert = {
        id: `alert_${Date.now()}`,
        conditionId: createdCondition.id,
        status: 'triggered' as any,
        triggeredAt: new Date(),
        message: `Alert condition created: ${condition.name}`,
        value: 0,
        threshold: condition.threshold,
        severity: condition.severity,
        metadata: {
          conditionName: condition.name,
          notificationChannels: notification.channels.length
        }
      };

      this.logger.info(`Created alert condition: ${condition.name}`);
      return alert;
    } catch (error) {
      this.logger.error('Failed to create alert:', error);
      throw error;
    }
  }

  async getDashboardData(dashboardId: string, timeRange: TimeRange): Promise<DashboardData> {
    try {
      // In a real implementation, this would fetch dashboard configuration
      // and aggregate data from various sources
      
      const dashboardData: DashboardData = {
        id: dashboardId,
        name: `Dashboard ${dashboardId}`,
        widgets: [
          {
            id: 'widget_1',
            type: 'line_chart' as any,
            title: 'System Metrics',
            query: 'system_metrics',
            config: {},
            position: { x: 0, y: 0, width: 6, height: 4 }
          },
          {
            id: 'widget_2',
            type: 'gauge' as any,
            title: 'CPU Usage',
            query: 'cpu_usage',
            config: {},
            position: { x: 6, y: 0, width: 3, height: 4 }
          }
        ],
        timeRange,
        refreshInterval: 30000
      };

      this.logger.debug(`Retrieved dashboard data: ${dashboardId}`);
      return dashboardData;
    } catch (error) {
      this.logger.error(`Failed to get dashboard data for ${dashboardId}:`, error);
      throw error;
    }
  }

  async generateReport(reportType: ReportType, parameters: Record<string, any>): Promise<Report> {
    try {
      // In a real implementation, this would generate reports based on collected data
      
      const report: Report = {
        id: `report_${Date.now()}`,
        type: reportType.id,
        generatedAt: new Date(),
        parameters,
        data: {
          summary: 'Report generated successfully',
          metrics: {},
          alerts: [],
          healthChecks: []
        },
        format: 'json' as any
      };

      this.logger.info(`Generated report: ${reportType.name}`);
      return report;
    } catch (error) {
      this.logger.error(`Failed to generate report ${reportType.id}:`, error);
      throw error;
    }
  }

  async getSystemHealth(): Promise<HealthCheck[]> {
    try {
      const healthCheck = await this.healthChecker.getHealthStatus();
      return [healthCheck];
    } catch (error) {
      this.logger.error('Failed to get system health:', error);
      throw error;
    }
  }

  async getServiceDiscovery(): Promise<ServiceDiscovery> {
    try {
      return await this.serviceRegistry.getServices();
    } catch (error) {
      this.logger.error('Failed to get service discovery:', error);
      throw error;
    }
  }

  // Additional utility methods
  getMetricsCollector(): MetricsCollectorService {
    return this.metricsCollector;
  }

  getRealtimeMonitor(): RealtimeMonitorService {
    return this.realtimeMonitor;
  }

  getHealthChecker(): HealthCheckerService {
    return this.healthChecker;
  }

  getAlertManager(): AlertManagerService {
    return this.alertManager;
  }

  getLogAggregator(): LogAggregatorService {
    return this.logAggregator;
  }

  getServiceRegistry(): ServiceRegistryService {
    return this.serviceRegistry;
  }

  getNotificationService(): NotificationService {
    return this.notificationService;
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    try {
      this.alertManager.cleanup();
      this.logAggregator.cleanup();
      await this.healthChecker.cleanup();
      await this.serviceRegistry.cleanup();
      
      this.logger.info('Monitoring service cleaned up');
    } catch (error) {
      this.logger.error('Error during monitoring service cleanup:', error);
    }
  }
}