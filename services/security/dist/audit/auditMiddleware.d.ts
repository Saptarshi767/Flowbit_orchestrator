import { Request, Response, NextFunction } from 'express';
export interface AuditableRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
    sessionId?: string;
    startTime?: number;
}
export declare class AuditMiddleware {
    requestAudit(): (req: AuditableRequest, res: Response, next: NextFunction) => Promise<void>;
    sensitiveOperationAudit(operation: string): (req: AuditableRequest, res: Response, next: NextFunction) => Promise<void>;
    authenticationAudit(): (req: AuditableRequest, res: Response, next: NextFunction) => Promise<void>;
    authorizationAudit(requiredPermission: string): (req: AuditableRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    private determineSeverity;
    private sanitizeRequestBody;
    private checkPermission;
}
export declare const auditMiddleware: AuditMiddleware;
//# sourceMappingURL=auditMiddleware.d.ts.map