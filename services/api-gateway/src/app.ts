import express from 'express';
import compression from 'compression';
import { config } from './config';

// Middleware imports
import { corsMiddleware, securityMiddleware, additionalSecurityMiddleware } from './middleware/security';
import { correlationIdMiddleware, requestLoggingMiddleware, responseLoggingMiddleware } from './middleware/logging';
import { generalRateLimit } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { versioningMiddleware, versionResponseTransformer } from './middleware/versioning';
import { analyticsMiddleware } from './middleware/analytics';

// Routes
import routes from './routes';
import docsRoutes from './routes/docs';

export const createApp = (): express.Application => {
  const app = express();

  // Trust proxy for accurate IP addresses (important for rate limiting)
  app.set('trust proxy', 1);

  // Basic middleware
  app.use(compression()); // Compress responses
  app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
  app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

  // Security middleware
  app.use(corsMiddleware);
  app.use(securityMiddleware);
  app.use(additionalSecurityMiddleware);

  // Logging and correlation
  app.use(correlationIdMiddleware);
  app.use(requestLoggingMiddleware);

  // API versioning
  app.use(versioningMiddleware);
  app.use(versionResponseTransformer('1.1'));

  // Analytics and usage tracking
  app.use(analyticsMiddleware);

  // Rate limiting
  app.use(generalRateLimit);

  // API routes
  app.use('/api/v1', routes);
  app.use('/api/v1/docs', docsRoutes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        message: 'Robust AI Orchestrator API Gateway',
        version: '1.0.0',
        documentation: '/api/v1/docs',
        health: '/api/v1/health'
      },
      meta: {
        correlationId: req.correlationId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });
  });

  // Error handling middleware (must be last)
  app.use(notFoundHandler);
  app.use(responseLoggingMiddleware);
  app.use(errorHandler);

  return app;
};