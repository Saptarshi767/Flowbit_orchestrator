import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from '@robust-ai-orchestrator/shared';
declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
            correlationId?: string;
        }
    }
}
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => void;
export declare const authorizePermission: (resource: string, action: string) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map