import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JWTPayload, ApiResponse } from '@robust-ai-orchestrator/shared';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      correlationId?: string;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access token is required'
      },
      meta: {
        correlationId: req.correlationId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    res.status(401).json(response);
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      },
      meta: {
        correlationId: req.correlationId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    res.status(403).json(response);
  }
};

export const authorizePermission = (resource: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        },
        meta: {
          correlationId: req.correlationId || '',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      res.status(401).json(response);
      return;
    }

    const hasPermission = req.user.permissions.some(
      permission => permission.resource === resource && permission.actions.includes(action)
    );

    if (!hasPermission) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient permissions for ${action} on ${resource}`
        },
        meta: {
          correlationId: req.correlationId || '',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
};