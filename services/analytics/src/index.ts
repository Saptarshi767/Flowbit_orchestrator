import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import winston from 'winston';
import { AnalyticsService } from './analytics.service';
import { createAnalyticsRoutes } from './routes/analytics.routes';
import { ElasticsearchConfig, CacheConfig } from './interfaces/analytics.interface';

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/analytics-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/analytics-combined.log' })
  ]
});

// Configuration
const elasticsearchConfig: ElasticsearchConfig = {
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: process.env.ELASTICSEARCH_USERNAME ? {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD || ''
  } : undefined,
  ssl: process.env.ELASTICSEARCH_SSL === 'true' ? {
    rejectUnauthorized: process.env.ELASTICSEARCH_SSL_VERIFY !== 'false'
  } : undefined,
  requestTimeout: parseInt(process.env.ELASTICSEARCH_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.ELASTICSEARCH_MAX_RETRIES || '3')
};

const cacheConfig: CacheConfig = {
  ttl: parseInt(process.env.CACHE_TTL || '300'), // 5 minutes
  maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
  enabled: process.env.CACHE_ENABLED !== 'false'
};

// Initialize services
const analyticsService = new AnalyticsService(elasticsearchConfig, logger, cacheConfig);

// Create Express app
const app = express();
const port = process.env.PORT || 3005;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
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
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await analyticsService.getSystemHealth();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'analytics',
      version: process.env.npm_package_version || '1.0.0',
      health
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analytics routes
app.use('/api/v1/analytics', createAnalyticsRoutes(analyticsService, logger));

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  res.status(error.status || 500).json({
    error: {
      message: error.message || 'Internal server error',
      status: error.status || 500,
      timestamp: new Date().toISOString()
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      status: 404,
      timestamp: new Date().toISOString()
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    await analyticsService.cleanup();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  try {
    await analyticsService.cleanup();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Analytics service listening on port ${port}`);
  logger.info('Configuration:', {
    elasticsearch: {
      node: elasticsearchConfig.node,
      hasAuth: !!elasticsearchConfig.auth,
      ssl: !!elasticsearchConfig.ssl
    },
    cache: cacheConfig
  });
});

export { analyticsService, logger };
export default app;