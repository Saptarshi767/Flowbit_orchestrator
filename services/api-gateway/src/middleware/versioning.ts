import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@robust-ai-orchestrator/shared';

export interface VersionedRequest extends Request {
  apiVersion: string;
  isDeprecatedVersion: boolean;
}

// Supported API versions
export const SUPPORTED_VERSIONS = ['1.0', '1.1'] as const;
export const CURRENT_VERSION = '1.1';
export const DEPRECATED_VERSIONS = ['1.0'] as const;

// Version compatibility mapping
export const VERSION_COMPATIBILITY = {
  '1.0': {
    supportedUntil: '2025-12-31',
    deprecationNotice: 'API version 1.0 is deprecated. Please upgrade to version 1.1.',
    breakingChanges: [
      'Pagination format changed in list endpoints',
      'Error response format updated',
      'Authentication token format changed'
    ]
  }
} as const;

/**
 * Extract API version from request
 */
export const extractApiVersion = (req: Request): string => {
  // Check Accept header first (preferred method)
  const acceptHeader = req.headers.accept;
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/application\/vnd\.robust-ai-orchestrator\.v(\d+\.\d+)\+json/);
    if (versionMatch) {
      return versionMatch[1];
    }
  }

  // Check custom header
  const versionHeader = req.headers['x-api-version'] as string;
  if (versionHeader) {
    return versionHeader;
  }

  // Check query parameter
  const versionQuery = req.query.version as string;
  if (versionQuery) {
    return versionQuery;
  }

  // Default to current version
  return CURRENT_VERSION;
};

/**
 * Validate API version
 */
export const isValidVersion = (version: string): boolean => {
  return SUPPORTED_VERSIONS.includes(version as any);
};

/**
 * Check if version is deprecated
 */
export const isDeprecatedVersion = (version: string): boolean => {
  return DEPRECATED_VERSIONS.includes(version as any);
};

/**
 * API versioning middleware
 */
export const versioningMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const versionedReq = req as VersionedRequest;
  const requestedVersion = extractApiVersion(versionedReq);

  // Validate version
  if (!isValidVersion(requestedVersion)) {
    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: 'UNSUPPORTED_API_VERSION',
        message: `API version ${requestedVersion} is not supported. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`,
        details: {
          requestedVersion,
          supportedVersions: SUPPORTED_VERSIONS,
          currentVersion: CURRENT_VERSION
        }
      },
      meta: {
        correlationId: (versionedReq as any).correlationId || '',
        timestamp: new Date().toISOString(),
        version: CURRENT_VERSION
      }
    };

    res.status(400).json(errorResponse);
    return;
  }

  // Set version info on request
  versionedReq.apiVersion = requestedVersion;
  versionedReq.isDeprecatedVersion = isDeprecatedVersion(requestedVersion);

  // Add deprecation warning header for deprecated versions
  if (versionedReq.isDeprecatedVersion) {
    const versionInfo = VERSION_COMPATIBILITY[requestedVersion as keyof typeof VERSION_COMPATIBILITY];
    if (versionInfo) {
      res.set('X-API-Deprecation-Warning', versionInfo.deprecationNotice);
      res.set('X-API-Deprecation-Date', versionInfo.supportedUntil);
      res.set('X-API-Migration-Guide', 'https://docs.robust-ai-orchestrator.com/migration');
    }
  }

  // Set version headers
  res.set('X-API-Version', requestedVersion);
  res.set('X-API-Current-Version', CURRENT_VERSION);

  next();
};

/**
 * Transform response based on API version
 */
export const versionResponseTransformer = (version: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function(body: any) {
      // Transform response based on version
      const transformedBody = transformResponseForVersion(body, version);
      return originalJson.call(this, transformedBody);
    };

    next();
  };
};

/**
 * Transform response data based on API version
 */
export const transformResponseForVersion = (data: any, version: string): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  switch (version) {
    case '1.0':
      return transformToV1Format(data);
    case '1.1':
    default:
      return data; // Current format
  }
};

/**
 * Transform response to v1.0 format for backward compatibility
 */
const transformToV1Format = (data: any): any => {
  if (!data.meta) {
    return data;
  }

  // V1.0 had different pagination format
  if (data.meta.pagination) {
    const { pagination, ...restMeta } = data.meta;
    return {
      ...data,
      meta: {
        ...restMeta,
        // V1.0 format
        page: pagination.page,
        per_page: pagination.limit,
        total: pagination.total,
        total_pages: pagination.totalPages
      }
    };
  }

  return data;
};

/**
 * Version-aware route wrapper
 */
export const versionedRoute = (handlers: Record<string, any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const version = (req as VersionedRequest).apiVersion;
    const handler = handlers[version] || handlers.default;

    if (!handler) {
      const errorResponse: ApiResponse = {
        success: false,
        error: {
          code: 'VERSION_NOT_IMPLEMENTED',
          message: `This endpoint is not available in API version ${version}`,
          details: {
            availableVersions: Object.keys(handlers).filter(v => v !== 'default')
          }
        },
        meta: {
          correlationId: (req as any).correlationId || '',
          timestamp: new Date().toISOString(),
          version: CURRENT_VERSION
        }
      };

      res.status(501).json(errorResponse);
      return;
    }

    handler(req, res, next);
  };
};

/**
 * Get version compatibility info
 */
export const getVersionInfo = () => {
  return {
    currentVersion: CURRENT_VERSION,
    supportedVersions: SUPPORTED_VERSIONS,
    deprecatedVersions: DEPRECATED_VERSIONS,
    compatibility: VERSION_COMPATIBILITY
  };
};