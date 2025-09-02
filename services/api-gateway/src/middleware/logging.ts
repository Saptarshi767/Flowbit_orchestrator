import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import expressWinston from 'express-winston';
import { config } from '../config';

// Local type definition
interface LogContext {
  correlationId: string;
  userId?: string;
  organizationId?: string;
  method?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
}

// Configure Winston logger
export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, correlationId, userId, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        correlationId,
        userId,
        ...meta
      });
    })
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console transport in development
if (config.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Correlation ID middleware
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Check if correlation ID is provided in headers, otherwise generate one
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
};

// Request logging middleware
export const requestLoggingMiddleware = expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: 'HTTP {{req.method}} {{req.url}}',
  expressFormat: false,
  colorize: false,
  dynamicMeta: (req: Request, res: Response) => {
    const logContext: LogContext = {
      correlationId: req.correlationId || '',
      userId: req.user?.userId,
      organizationId: req.user?.organizationId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip || 'unknown'
    };
    return logContext;
  },
  skip: (req: Request, res: Response) => {
    // Skip logging for health checks and static assets
    return req.url === '/health' || req.url.startsWith('/static');
  }
});

// Response logging middleware
export const responseLoggingMiddleware = expressWinston.errorLogger({
  winstonInstance: logger,
  meta: true,
  msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms',
  dynamicMeta: (req: Request, res: Response, err: Error) => {
    return {
      correlationId: req.correlationId,
      userId: req.user?.userId,
      organizationId: req.user?.organizationId,
      error: err ? {
        name: err.name,
        message: err.message,
        stack: err.stack
      } : undefined
    };
  }
});

// Custom error logging function
export const logError = (error: Error, context?: Partial<LogContext>): void => {
  logger.error('Application error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...context
  });
};

// Custom info logging function
export const logInfo = (message: string, context?: Partial<LogContext>): void => {
  logger.info(message, context);
};

// Custom warning logging function
export const logWarning = (message: string, context?: Partial<LogContext>): void => {
  logger.warn(message, context);
};