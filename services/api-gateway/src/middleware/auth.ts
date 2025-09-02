import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
// Local type definitions
interface Permission {
  resource: string
  actions: string[]
}

interface JWTPayload {
  userId: string
  email: string
  organizationId?: string
  roles: string[]
  permissions: Permission[]
  iat?: number
  exp?: number
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

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
      error: 'UNAUTHORIZED: Access token is required',
      message: 'Authentication required'
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
      error: 'INVALID_TOKEN: Invalid or expired token',
      message: 'Token validation failed'
    };
    res.status(403).json(response);
  }
};

export const authorizePermission = (resource: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        error: 'UNAUTHORIZED: Authentication required',
        message: 'User authentication failed'
      };
      res.status(401).json(response);
      return;
    }

    const hasPermission = req.user.permissions.some(
      (permission: Permission) => permission.resource === resource && permission.actions.includes(action)
    );

    if (!hasPermission) {
      const response: ApiResponse = {
        success: false,
        error: `FORBIDDEN: Insufficient permissions for ${action} on ${resource}`,
        message: 'Access denied'
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
};