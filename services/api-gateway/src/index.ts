import { createApp } from './app';
import { config } from './config';
import { initializeRedis } from './middleware/rateLimiter';
import { logger, logInfo, logError } from './middleware/logging';

const startServer = async (): Promise<void> => {
  try {
    // Initialize Redis connection for rate limiting
    await initializeRedis();

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(config.port, () => {
      logInfo(`API Gateway server started`, {
        correlationId: 'startup',
        method: 'GET',
        url: `http://localhost:${config.port}`,
        ip: 'localhost'
      });
      
      console.log(`🚀 API Gateway running on port ${config.port}`);
      console.log(`📊 Environment: ${config.nodeEnv}`);
      console.log(`🔒 CORS Origins: ${config.corsOrigins.join(', ')}`);
      console.log(`⚡ Rate Limiting: ${config.rateLimiting.max} requests per ${config.rateLimiting.windowMs / 1000}s`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      logInfo(`Received ${signal}, shutting down gracefully`, {
        correlationId: 'shutdown',
        method: 'SYSTEM',
        url: '',
        ip: 'localhost'
      });

      server.close(() => {
        logInfo('Server closed successfully', {
          correlationId: 'shutdown',
          method: 'SYSTEM',
          url: '',
          ip: 'localhost'
        });
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logError(new Error('Forced shutdown after timeout'), {
          correlationId: 'shutdown',
          method: 'SYSTEM',
          url: '',
          ip: 'localhost'
        });
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logError(error, {
        correlationId: 'uncaught-exception',
        method: 'SYSTEM',
        url: '',
        ip: 'localhost'
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logError(new Error(`Unhandled Rejection: ${reason}`), {
        correlationId: 'unhandled-rejection',
        method: 'SYSTEM',
        url: '',
        ip: 'localhost'
      });
      process.exit(1);
    });

  } catch (error) {
    logError(error as Error, {
      correlationId: 'startup-error',
      method: 'SYSTEM',
      url: '',
      ip: 'localhost'
    });
    process.exit(1);
  }
};

// Start the server
startServer();