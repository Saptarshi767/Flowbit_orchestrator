import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
export declare const corsMiddleware: (req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void;
export declare const securityMiddleware: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
export declare const additionalSecurityMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateApiKey: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=security.d.ts.map