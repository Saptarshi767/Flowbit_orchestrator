import { Request, Response, NextFunction } from 'express';
import { auditLogger } from './auditLogger';

export interface AuditableRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  sessionId?: string;
  startTime?: number;
}

export class AuditMiddleware {
  // Middleware to capture all API requests
  requestAudit() {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      req.startTime = Date.now();
      
      // Capture original res.json to log responses
      const originalJson = res.json;
      let responseBody: any;
      
      res.json = function(body: any) {
        responseBody = body;
        return originalJson.call(this, body);
      };

      // Log request on response finish
      res.on('finish', async () => {
        const duration = Date.now() - (req.startTime || 0);
        const outcome = res.statusCode < 400 ? 'success' : 'failure';
        
        await auditLogger.logEvent({
          userId: req.user?.id,
          sessionId: req.sessionId,
          action: `api:${req.method.toLowerCase()}`,
          resource: req.path,
          details: {
            method: req.method,
            path: req.path,
            query: req.query,
            statusCode: res.statusCode,
            duration,
            userAgent: req.get('User-Agent'),
            contentLength: res.get('Content-Length')
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          outcome,
          severity: this.determineSeverity(req.method, req.path, res.statusCode)
        });
      });

      next();
    };
  }

  // Middleware for sensitive operations
  sensitiveOperationAudit(operation: string) {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Capture original res.json to determine outcome
      const originalJson = res.json;
      let outcome: 'success' | 'failure' | 'error' = 'success';
      
      res.json = function(body: any) {
        if (res.statusCode >= 400) {
          outcome = res.statusCode >= 500 ? 'error' : 'failure';
        }
        return originalJson.call(this, body);
      };

      res.on('finish', async () => {
        const duration = Date.now() - startTime;
        
        await auditLogger.logEvent({
          userId: req.user?.id,
          sessionId: req.sessionId,
          action: operation,
          resource: req.path,
          resourceId: req.params.id,
          details: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            requestBody: this.sanitizeRequestBody(req.body)
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          outcome,
          severity: 'high'
        });
      });

      next();
    };
  }

  // Middleware for authentication events
  authenticationAudit() {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      const originalJson = res.json;
      
      res.json = function(body: any) {
        const outcome = res.statusCode === 200 ? 'success' : 'failure';
        
        // Log authentication attempt
        auditLogger.logAuthentication(
          req.body?.email || req.body?.username || 'unknown',
          outcome,
          {
            method: req.path.includes('login') ? 'password' : 'unknown',
            statusCode: res.statusCode,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        );
        
        return originalJson.call(this, body);
      };

      next();
    };
  }

  // Middleware for authorization events
  authorizationAudit(requiredPermission: string) {
    return async (req: AuditableRequest, res: Response, next: NextFunction) => {
      const hasPermission = await this.checkPermission(req.user, requiredPermission);
      const outcome = hasPermission ? 'success' : 'failure';
      
      await auditLogger.logAuthorization(
        req.user?.id || 'anonymous',
        req.path,
        requiredPermission,
        outcome,
        {
          method: req.method,
          resource: req.path,
          userRole: req.user?.role
        }
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
      }

      next();
    };
  }

  private determineSeverity(method: string, path: string, statusCode: number): 'low' | 'medium' | 'high' | 'critical' {
    // Critical operations
    if (path.includes('/admin') || path.includes('/system')) {
      return 'critical';
    }

    // High severity for failures on sensitive endpoints
    if (statusCode >= 400 && (path.includes('/auth') || path.includes('/user'))) {
      return 'high';
    }

    // Medium severity for write operations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
      return 'medium';
    }

    return 'low';
  }

  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'privateKey'];
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private async checkPermission(user: any, permission: string): Promise<boolean> {
    // Implement your permission checking logic here
    // This is a simplified example
    if (!user) return false;
    
    // Admin users have all permissions
    if (user.role === 'admin') return true;
    
    // Implement more granular permission checking
    return true; // Placeholder
  }
}

export const auditMiddleware = new AuditMiddleware();