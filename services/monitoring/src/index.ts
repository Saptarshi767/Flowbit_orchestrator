import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { createLogger, format, transports } from 'winston';
import { MonitoringService } from './services/monitoring.service';
import { createMonitoringRoutes } from './routes/monitoring.routes';

// Environment configuration
const PORT = process.env.PORT || 3005;
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Create logger
const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'monitoring' },
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

// Create Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
});

// Create HTTP server
const httpServer = createServer(app);

// Initialize monitoring service
const monitoringService = new MonitoringService(httpServer, logger);

// Setup routes
app.use('/api/monitoring', createMonitoringRoutes(monitoringService, logger));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const healthChecks = await monitoringService.getSystemHealth();
    const overallStatus = healthChecks.every(check => check.status === 'healthy') ? 'healthy' : 'unhealthy';
    
    res.status(overallStatus === 'healthy' ? 200 : 503).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'monitoring',
      version: '1.0.0',
      checks: healthChecks
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'monitoring',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await monitoringService.getMetricsCollector().getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Stop accepting new connections
    httpServer.close(async () => {
      logger.info('HTTP server closed');
      
      // Cleanup monitoring service
      await monitoringService.cleanup();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
    
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
httpServer.listen(PORT, () => {
  logger.info(`Monitoring service started on port ${PORT}`, {
    environment: NODE_ENV,
    logLevel: LOG_LEVEL,
    pid: process.pid
  });
});

export { app, httpServer, monitoringService, logger };