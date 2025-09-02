import { Request, Response, NextFunction } from 'express';
export interface VersionedRequest extends Request {
    apiVersion: string;
    isDeprecatedVersion: boolean;
}
export declare const SUPPORTED_VERSIONS: readonly ["1.0", "1.1"];
export declare const CURRENT_VERSION = "1.1";
export declare const DEPRECATED_VERSIONS: readonly ["1.0"];
export declare const VERSION_COMPATIBILITY: {
    readonly '1.0': {
        readonly supportedUntil: "2025-12-31";
        readonly deprecationNotice: "API version 1.0 is deprecated. Please upgrade to version 1.1.";
        readonly breakingChanges: readonly ["Pagination format changed in list endpoints", "Error response format updated", "Authentication token format changed"];
    };
};
/**
 * Extract API version from request
 */
export declare const extractApiVersion: (req: Request) => string;
/**
 * Validate API version
 */
export declare const isValidVersion: (version: string) => boolean;
/**
 * Check if version is deprecated
 */
export declare const isDeprecatedVersion: (version: string) => boolean;
/**
 * API versioning middleware
 */
export declare const versioningMiddleware: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Transform response based on API version
 */
export declare const versionResponseTransformer: (version: string) => (req: Request, res: Response, next: NextFunction) => void;
/**
 * Transform response data based on API version
 */
export declare const transformResponseForVersion: (data: any, version: string) => any;
/**
 * Version-aware route wrapper
 */
export declare const versionedRoute: (handlers: Record<string, any>) => (req: Request, res: Response, next: NextFunction) => void;
/**
 * Get version compatibility info
 */
export declare const getVersionInfo: () => {
    currentVersion: string;
    supportedVersions: readonly ["1.0", "1.1"];
    deprecatedVersions: readonly ["1.0"];
    compatibility: {
        readonly '1.0': {
            readonly supportedUntil: "2025-12-31";
            readonly deprecationNotice: "API version 1.0 is deprecated. Please upgrade to version 1.1.";
            readonly breakingChanges: readonly ["Pagination format changed in list endpoints", "Error response format updated", "Authentication token format changed"];
        };
    };
};
//# sourceMappingURL=versioning.d.ts.map