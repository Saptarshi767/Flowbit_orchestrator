import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { LogContext } from '@robust-ai-orchestrator/shared';
export declare const logger: winston.Logger;
export declare const correlationIdMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const requestLoggingMiddleware: import("express").Handler;
export declare const responseLoggingMiddleware: import("express").ErrorRequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const logError: (error: Error, context?: Partial<LogContext>) => void;
export declare const logInfo: (message: string, context?: Partial<LogContext>) => void;
export declare const logWarning: (message: string, context?: Partial<LogContext>) => void;
//# sourceMappingURL=logging.d.ts.map