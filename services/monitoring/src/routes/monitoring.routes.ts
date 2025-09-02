import { Router } from 'express';
import { Logger } from 'winston';
import { MonitoringService } from '../services/monitoring.service';
import { 
  AlertCondition, 
  NotificationConfig, 
  TimeRange,
  LogEntry,
  MetricSource,
  Metrics
} from '@robust-ai-orchestrator/shared';
import Joi from 'joi';

export function createMonitoringRoutes(monitoringService: MonitoringService, logger: Logger): Router {
  const router = Router();

  // Validation schemas
  const alertConditionSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    metric: Joi.string().required(),
    operator: Joi.string().valid('gt', 'lt', 'eq', 'ne', 'gte', 'lte').required(),
    threshold: Joi.number().required(),
    duration: Joi.number().min(1).required(),
    severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
    enabled: Joi.boolean().default(true)
  });

  const notificationConfigSchema = Joi.object({
    channels: Joi.array().items(Joi.object({
      type: Joi.string().valid('email', 'slack', 'webhook', 'sms').required(),
      config: Joi.object().required(),
      enabled: Joi.boolean().default(true)
    })).required(),
    template: Joi.string().optional(),
    throttle: Joi.number().min(0).optional()
  });

  const timeRangeSchema = Joi.object({
    start: Joi.date().required(),
    end: Joi.date().required()
  });

  const metricsSchema = Joi.object({
    source: Joi.object({
      service: Joi.string().required(),
      instance: Joi.string().required(),
      version: Joi.string().required(),
      environment: Joi.string().required()
    }).required(),
    metrics: Joi.object({
      timestamp: Joi.date().required(),
      counters: Joi.object().pattern(Joi.string(), Joi.number()).required(),
      gauges: Joi.object().pattern(Joi.string(), Joi.number()).required(),
      histograms: Joi.object().pattern(Joi.string(), Joi.array().items(Joi.number())).required(),
      labels: Joi.object().pattern(Joi.string(), Joi.string()).required()
    }).required()
  });

  // Middleware for request validation
  const validateRequest = (schema: Joi.ObjectSchema) => {
    return (req: any, res: any, next: any) => {
      const { error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }
      next();
    };
  };

  // Metrics endpoints
  router.post('/metrics', validateRequest(metricsSchema), async (req, res) => {
    try {
      const { source, metrics } = req.body;
      await monitoringService.collectMetrics(source, metrics);
      
      res.json({
        success: true,
        message: 'Metrics collected successfully'
      });
    } catch (error) {
      logger.error('Failed to collect metrics:', error);
      res.status(500).json({
        error: 'Failed to collect metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.get('/metrics/prometheus', async (req, res) => {
    try {
      const metrics = await monitoringService.getMetricsCollector().getMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    } catch (error) {
      logger.error('Failed to get Prometheus metrics:', error);
      res.status(500).json({
        error: 'Failed to get metrics'
      });
    }
  });

  // Alert management endpoints
  router.post('/alerts/conditions', validateRequest(alertConditionSchema), async (req, res) => {
    try {
      const condition = await monitoringService.getAlertManager().createCondition(req.body);
      
      res.status(201).json({
        success: true,
        data: condition
      });
    } catch (error) {
      logger.error('Failed to create alert condition:', error);
      res.status(500).json({
        error: 'Failed to create alert condition',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.get('/alerts/conditions', async (req, res) => {
    try {
      const conditions = await monitoringService.getAlertManager().getConditions();
      
      res.json({
        success: true,
        data: conditions
      });
    } catch (error) {
      logger.error('Failed to get alert conditions:', error);
      res.status(500).json({
        error: 'Failed to get alert conditions'
      });
    }
  });

  router.put('/alerts/conditions/:id', validateRequest(alertConditionSchema.fork(['name', 'metric', 'operator', 'threshold', 'duration', 'severity'], (schema) => schema.optional())), async (req, res) => {
    try {
      const { id } = req.params;
      const condition = await monitoringService.getAlertManager().updateCondition(id, req.body);
      
      res.json({
        success: true,
        data: condition
      });
    } catch (error) {
      logger.error(`Failed to update alert condition ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Failed to update alert condition',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.delete('/alerts/conditions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await monitoringService.getAlertManager().deleteCondition(id);
      
      res.json({
        success: true,
        message: 'Alert condition deleted successfully'
      });
    } catch (error) {
      logger.error(`Failed to delete alert condition ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Failed to delete alert condition',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.get('/alerts/active', async (req, res) => {
    try {
      const alerts = monitoringService.getAlertManager().getActiveAlerts();
      
      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      logger.error('Failed to get active alerts:', error);
      res.status(500).json({
        error: 'Failed to get active alerts'
      });
    }
  });

  router.post('/alerts/:id/acknowledge', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          error: 'User ID is required'
        });
      }

      await monitoringService.getAlertManager().acknowledgeAlert(id, userId);
      
      res.json({
        success: true,
        message: 'Alert acknowledged successfully'
      });
    } catch (error) {
      logger.error(`Failed to acknowledge alert ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Failed to acknowledge alert',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.post('/alerts/:id/resolve', async (req, res) => {
    try {
      const { id } = req.params;
      await monitoringService.getAlertManager().resolveAlert(id);
      
      res.json({
        success: true,
        message: 'Alert resolved successfully'
      });
    } catch (error) {
      logger.error(`Failed to resolve alert ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Failed to resolve alert',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Health check endpoints
  router.get('/health', async (req, res) => {
    try {
      const healthChecks = await monitoringService.getSystemHealth();
      const overallStatus = healthChecks.every(check => check.status === 'healthy') ? 'healthy' : 'unhealthy';
      
      res.status(overallStatus === 'healthy' ? 200 : 503).json({
        success: true,
        data: {
          status: overallStatus,
          checks: healthChecks
        }
      });
    } catch (error) {
      logger.error('Failed to get health status:', error);
      res.status(500).json({
        error: 'Failed to get health status'
      });
    }
  });

  router.get('/health/:checkName', async (req, res) => {
    try {
      const { checkName } = req.params;
      const result = await monitoringService.getHealthChecker().runSingleCheck(checkName);
      
      if (!result) {
        return res.status(404).json({
          error: 'Health check not found',
          message: `No health check named '${checkName}' is registered`
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Failed to run health check ${req.params.checkName}:`, error);
      res.status(500).json({
        error: 'Failed to run health check',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Service discovery endpoints
  router.get('/services', async (req, res) => {
    try {
      const services = await monitoringService.getServiceDiscovery();
      
      res.json({
        success: true,
        data: services
      });
    } catch (error) {
      logger.error('Failed to get service discovery:', error);
      res.status(500).json({
        error: 'Failed to get service discovery'
      });
    }
  });

  router.post('/services/register', async (req, res) => {
    try {
      const serviceRegistration = req.body;
      await monitoringService.getServiceRegistry().registerService(serviceRegistration);
      
      res.status(201).json({
        success: true,
        message: 'Service registered successfully'
      });
    } catch (error) {
      logger.error('Failed to register service:', error);
      res.status(500).json({
        error: 'Failed to register service',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.delete('/services/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await monitoringService.getServiceRegistry().deregisterService(id);
      
      res.json({
        success: true,
        message: 'Service deregistered successfully'
      });
    } catch (error) {
      logger.error(`Failed to deregister service ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Failed to deregister service',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.post('/services/:id/heartbeat', async (req, res) => {
    try {
      const { id } = req.params;
      await monitoringService.getServiceRegistry().heartbeat(id);
      
      res.json({
        success: true,
        message: 'Heartbeat recorded successfully'
      });
    } catch (error) {
      logger.error(`Failed to record heartbeat for service ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Failed to record heartbeat',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Log aggregation endpoints
  router.post('/logs', async (req, res) => {
    try {
      const { logs } = req.body;
      
      if (!Array.isArray(logs)) {
        return res.status(400).json({
          error: 'Logs must be an array'
        });
      }

      await monitoringService.getLogAggregator().ingest(logs);
      
      res.json({
        success: true,
        message: `Ingested ${logs.length} log entries`
      });
    } catch (error) {
      logger.error('Failed to ingest logs:', error);
      res.status(500).json({
        error: 'Failed to ingest logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.post('/logs/search', async (req, res) => {
    try {
      const searchQuery = req.body;
      const result = await monitoringService.getLogAggregator().search(searchQuery);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to search logs:', error);
      res.status(500).json({
        error: 'Failed to search logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.get('/logs/stats', async (req, res) => {
    try {
      const stats = monitoringService.getLogAggregator().getLogStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get log stats:', error);
      res.status(500).json({
        error: 'Failed to get log stats'
      });
    }
  });

  // Dashboard endpoints
  router.get('/dashboards/:id', validateRequest(Joi.object({
    timeRange: timeRangeSchema.optional()
  })), async (req, res) => {
    try {
      const { id } = req.params;
      const { timeRange } = req.body;
      
      const defaultTimeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: new Date()
      };

      const dashboardData = await monitoringService.getDashboardData(
        id, 
        timeRange || defaultTimeRange
      );
      
      res.json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      logger.error(`Failed to get dashboard data for ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Failed to get dashboard data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Notification testing endpoint
  router.post('/notifications/test', validateRequest(notificationConfigSchema), async (req, res) => {
    try {
      const config = req.body;
      const success = await monitoringService.getNotificationService().testNotification(config);
      
      res.json({
        success,
        message: success ? 'Test notification sent successfully' : 'Test notification failed'
      });
    } catch (error) {
      logger.error('Failed to send test notification:', error);
      res.status(500).json({
        error: 'Failed to send test notification',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Real-time monitoring stats
  router.get('/realtime/stats', async (req, res) => {
    try {
      const realtimeMonitor = monitoringService.getRealtimeMonitor();
      
      res.json({
        success: true,
        data: {
          connectedClients: realtimeMonitor.getConnectedClientsCount(),
          totalSubscriptions: realtimeMonitor.getSubscriptionsCount(),
          subscriptionsByType: {
            executions: realtimeMonitor.getSubscriptionsByType('executions').length,
            metrics: realtimeMonitor.getSubscriptionsByType('metrics').length,
            alerts: realtimeMonitor.getSubscriptionsByType('alerts').length
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get real-time stats:', error);
      res.status(500).json({
        error: 'Failed to get real-time stats'
      });
    }
  });

  return router;
}
  