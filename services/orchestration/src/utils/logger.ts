import * as winston from 'winston';

/**
 * Logger utility class for consistent logging across the orchestration service
 */
export class Logger {
  private logger: winston.Logger;

  constructor(private context: string) {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            context: context || this.context,
            message,
            ...meta
          });
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });

    // Add file transport in production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(new winston.transports.File({
        filename: 'logs/orchestration-error.log',
        level: 'error'
      }));
      this.logger.add(new winston.transports.File({
        filename: 'logs/orchestration-combined.log'
      }));
    }
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, { context: this.context, ...meta });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, { context: this.context, ...meta });
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, { context: this.context, ...meta });
  }

  setContext(context: string): void {
    this.context = context;
  }

  child(childContext: string): Logger {
    return new Logger(`${this.context}:${childContext}`);
  }
}