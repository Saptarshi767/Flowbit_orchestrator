import { Request, Response, NextFunction } from 'express';
import { SecurityContext } from './zeroTrustEngine';
export interface ZeroTrustRequest extends Request {
    securityContext?: SecurityContext;
    trustDecision?: any;
}
export declare class ZeroTrustMiddleware {
    evaluate(resource?: string, action?: string): (req: ZeroTrustRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    continuousVerification(): (req: ZeroTrustRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    deviceFingerprinting(): (req: ZeroTrustRequest, res: Response, next: NextFunction) => void;
    adaptiveAuth(): (req: ZeroTrustRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    sessionSecurity(): (req: ZeroTrustRequest, res: Response, next: NextFunction) => void;
    private buildSecurityContext;
    private generateDeviceFingerprint;
    private extractLocationFromIP;
    private addSecurityHeaders;
    private isSensitiveOperation;
}
export declare const zeroTrustMiddleware: ZeroTrustMiddleware;
//# sourceMappingURL=zeroTrustMiddleware.d.ts.map