import { Request, Response, NextFunction } from 'express';
import { zeroTrustEngine, SecurityContext } from './zeroTrustEngine';
import crypto from 'crypto';

export interface ZeroTrustRequest extends Request {
  securityContext?: SecurityContext;
  trustDecision?: any;
}

export class ZeroTrustMiddleware {
  // Main zero-trust evaluation middleware
  evaluate(resource?: string, action?: string) {
    return async (req: ZeroTrustRequest, res: Response, next: NextFunction) => {
      try {
        // Build security context
        const context = this.buildSecurityContext(req);
        req.securityContext = context;

        // Determine resource and action
        const evaluationResource = resource || req.path;
        const evaluationAction = action || req.method.toLowerCase();

        // Evaluate access
        const decision = await zeroTrustEngine.evaluateAccess(
          evaluationResource,
          evaluationAction,
          context
        );

        req.trustDecision = decision;

        // Handle decision
        if (!decision.allowed) {
          return res.status(403).json({
            error: 'Access Denied',
            message: decision.reason,
            trustScore: decision.trustScore,
            requiredActions: decision.requiredActions
          });
        }

        // Add security headers based on trust score
        this.addSecurityHeaders(res, decision.trustScore);

        next();
      } catch (error) {
        console.error('Zero-trust evaluation error:', error);
        // Fail secure - deny access on error
        return res.status(500).json({
          error: 'Security Evaluation Failed',
          message: 'Unable to evaluate access request'
        });
      }
    };
  }

  // Continuous verification middleware
  continuousVerification() {
    return async (req: ZeroTrustRequest, res: Response, next: NextFunction) => {
      // Skip if no existing security context
      if (!req.securityContext) {
        return next();
      }

      const timeSinceLastCheck = Date.now() - req.securityContext.timestamp.getTime();
      
      // Re-evaluate if more than 5 minutes since last check
      if (timeSinceLastCheck > 5 * 60 * 1000) {
        const updatedContext = this.buildSecurityContext(req);
        const decision = await zeroTrustEngine.evaluateAccess(
          req.path,
          req.method.toLowerCase(),
          updatedContext
        );

        if (!decision.allowed) {
          return res.status(403).json({
            error: 'Continuous Verification Failed',
            message: 'Access revoked due to changed security context',
            trustScore: decision.trustScore
          });
        }

        req.securityContext = updatedContext;
        req.trustDecision = decision;
      }

      next();
    };
  }

  // Device fingerprinting middleware
  deviceFingerprinting() {
    return (req: ZeroTrustRequest, res: Response, next: NextFunction) => {
      const fingerprint = this.generateDeviceFingerprint(req);
      (req as any).deviceFingerprint = fingerprint;
      next();
    };
  }

  // Adaptive authentication middleware
  adaptiveAuth() {
    return async (req: ZeroTrustRequest, res: Response, next: NextFunction) => {
      if (!req.trustDecision) {
        return next();
      }

      const trustScore = req.trustDecision.trustScore;

      // Require additional authentication for low trust scores
      if (trustScore.overall < 0.5) {
        const mfaRequired = !req.headers['x-mfa-verified'];
        
        if (mfaRequired) {
          return res.status(401).json({
            error: 'Additional Authentication Required',
            message: 'Multi-factor authentication required due to low trust score',
            trustScore: trustScore,
            authMethods: ['totp', 'sms', 'email']
          });
        }
      }

      // Require step-up authentication for sensitive operations
      if (this.isSensitiveOperation(req) && trustScore.overall < 0.8) {
        const stepUpRequired = !req.headers['x-step-up-verified'];
        
        if (stepUpRequired) {
          return res.status(401).json({
            error: 'Step-up Authentication Required',
            message: 'Additional verification required for sensitive operation',
            trustScore: trustScore
          });
        }
      }

      next();
    };
  }

  // Session security middleware
  sessionSecurity() {
    return (req: ZeroTrustRequest, res: Response, next: NextFunction) => {
      if (!req.trustDecision) {
        return next();
      }

      const trustScore = req.trustDecision.trustScore;

      // Adjust session timeout based on trust score
      let sessionTimeout = 3600; // Default 1 hour
      
      if (trustScore.overall < 0.3) {
        sessionTimeout = 300; // 5 minutes for very low trust
      } else if (trustScore.overall < 0.6) {
        sessionTimeout = 1800; // 30 minutes for low trust
      } else if (trustScore.overall > 0.9) {
        sessionTimeout = 7200; // 2 hours for high trust
      }

      res.set('X-Session-Timeout', sessionTimeout.toString());
      next();
    };
  }

  private buildSecurityContext(req: Request): SecurityContext {
    const deviceFingerprint = (req as any).deviceFingerprint || 
      this.generateDeviceFingerprint(req);

    return {
      userId: (req as any).user?.id,
      sessionId: (req as any).sessionId || req.sessionID || 'anonymous',
      deviceFingerprint,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      location: this.extractLocationFromIP(req.ip || ''),
      userAgent: req.get('User-Agent') || 'unknown',
      timestamp: new Date()
    };
  }

  private generateDeviceFingerprint(req: Request): string {
    const components = [
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
      req.ip || '',
      req.get('X-Forwarded-For') || ''
    ];

    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  private extractLocationFromIP(ip: string): any {
    // Mock implementation - replace with actual GeoIP service
    const mockLocations = [
      { country: 'US', region: 'CA', city: 'San Francisco' },
      { country: 'US', region: 'NY', city: 'New York' },
      { country: 'UK', region: 'England', city: 'London' },
      { country: 'DE', region: 'Bavaria', city: 'Munich' }
    ];

    return mockLocations[Math.floor(Math.random() * mockLocations.length)];
  }

  private addSecurityHeaders(res: Response, trustScore: any): void {
    // Add trust score to response headers for debugging
    res.set('X-Trust-Score', trustScore.overall.toString());
    res.set('X-Risk-Level', trustScore.riskLevel);

    // Adjust security headers based on trust level
    if (trustScore.riskLevel === 'high' || trustScore.riskLevel === 'critical') {
      res.set('X-Frame-Options', 'DENY');
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Referrer-Policy', 'no-referrer');
    }
  }

  private isSensitiveOperation(req: Request): boolean {
    const sensitivePaths = [
      '/admin',
      '/user/delete',
      '/workflow/delete',
      '/settings/security',
      '/api/keys'
    ];

    const sensitiveActions = ['DELETE', 'PUT'];

    return sensitivePaths.some(path => req.path.startsWith(path)) ||
           sensitiveActions.includes(req.method);
  }
}

export const zeroTrustMiddleware = new ZeroTrustMiddleware();