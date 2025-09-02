"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVersionInfo = exports.versionedRoute = exports.transformResponseForVersion = exports.versionResponseTransformer = exports.versioningMiddleware = exports.isDeprecatedVersion = exports.isValidVersion = exports.extractApiVersion = exports.VERSION_COMPATIBILITY = exports.DEPRECATED_VERSIONS = exports.CURRENT_VERSION = exports.SUPPORTED_VERSIONS = void 0;
// Supported API versions
exports.SUPPORTED_VERSIONS = ['1.0', '1.1'];
exports.CURRENT_VERSION = '1.1';
exports.DEPRECATED_VERSIONS = ['1.0'];
// Version compatibility mapping
exports.VERSION_COMPATIBILITY = {
    '1.0': {
        supportedUntil: '2025-12-31',
        deprecationNotice: 'API version 1.0 is deprecated. Please upgrade to version 1.1.',
        breakingChanges: [
            'Pagination format changed in list endpoints',
            'Error response format updated',
            'Authentication token format changed'
        ]
    }
};
/**
 * Extract API version from request
 */
const extractApiVersion = (req) => {
    // Check Accept header first (preferred method)
    const acceptHeader = req.headers.accept;
    if (acceptHeader) {
        const versionMatch = acceptHeader.match(/application\/vnd\.robust-ai-orchestrator\.v(\d+\.\d+)\+json/);
        if (versionMatch) {
            return versionMatch[1];
        }
    }
    // Check custom header
    const versionHeader = req.headers['x-api-version'];
    if (versionHeader) {
        return versionHeader;
    }
    // Check query parameter
    const versionQuery = req.query.version;
    if (versionQuery) {
        return versionQuery;
    }
    // Default to current version
    return exports.CURRENT_VERSION;
};
exports.extractApiVersion = extractApiVersion;
/**
 * Validate API version
 */
const isValidVersion = (version) => {
    return exports.SUPPORTED_VERSIONS.includes(version);
};
exports.isValidVersion = isValidVersion;
/**
 * Check if version is deprecated
 */
const isDeprecatedVersion = (version) => {
    return exports.DEPRECATED_VERSIONS.includes(version);
};
exports.isDeprecatedVersion = isDeprecatedVersion;
/**
 * API versioning middleware
 */
const versioningMiddleware = (req, res, next) => {
    const versionedReq = req;
    const requestedVersion = (0, exports.extractApiVersion)(versionedReq);
    // Validate version
    if (!(0, exports.isValidVersion)(requestedVersion)) {
        const errorResponse = {
            success: false,
            error: {
                code: 'UNSUPPORTED_API_VERSION',
                message: `API version ${requestedVersion} is not supported. Supported versions: ${exports.SUPPORTED_VERSIONS.join(', ')}`,
                details: {
                    requestedVersion,
                    supportedVersions: exports.SUPPORTED_VERSIONS,
                    currentVersion: exports.CURRENT_VERSION
                }
            },
            meta: {
                correlationId: versionedReq.correlationId || '',
                timestamp: new Date().toISOString(),
                version: exports.CURRENT_VERSION
            }
        };
        res.status(400).json(errorResponse);
        return;
    }
    // Set version info on request
    versionedReq.apiVersion = requestedVersion;
    versionedReq.isDeprecatedVersion = (0, exports.isDeprecatedVersion)(requestedVersion);
    // Add deprecation warning header for deprecated versions
    if (versionedReq.isDeprecatedVersion) {
        const versionInfo = exports.VERSION_COMPATIBILITY[requestedVersion];
        if (versionInfo) {
            res.set('X-API-Deprecation-Warning', versionInfo.deprecationNotice);
            res.set('X-API-Deprecation-Date', versionInfo.supportedUntil);
            res.set('X-API-Migration-Guide', 'https://docs.robust-ai-orchestrator.com/migration');
        }
    }
    // Set version headers
    res.set('X-API-Version', requestedVersion);
    res.set('X-API-Current-Version', exports.CURRENT_VERSION);
    next();
};
exports.versioningMiddleware = versioningMiddleware;
/**
 * Transform response based on API version
 */
const versionResponseTransformer = (version) => {
    return (req, res, next) => {
        const originalJson = res.json;
        res.json = function (body) {
            // Transform response based on version
            const transformedBody = (0, exports.transformResponseForVersion)(body, version);
            return originalJson.call(this, transformedBody);
        };
        next();
    };
};
exports.versionResponseTransformer = versionResponseTransformer;
/**
 * Transform response data based on API version
 */
const transformResponseForVersion = (data, version) => {
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
exports.transformResponseForVersion = transformResponseForVersion;
/**
 * Transform response to v1.0 format for backward compatibility
 */
const transformToV1Format = (data) => {
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
const versionedRoute = (handlers) => {
    return (req, res, next) => {
        const version = req.apiVersion;
        const handler = handlers[version] || handlers.default;
        if (!handler) {
            const errorResponse = {
                success: false,
                error: {
                    code: 'VERSION_NOT_IMPLEMENTED',
                    message: `This endpoint is not available in API version ${version}`,
                    details: {
                        availableVersions: Object.keys(handlers).filter(v => v !== 'default')
                    }
                },
                meta: {
                    correlationId: req.correlationId || '',
                    timestamp: new Date().toISOString(),
                    version: exports.CURRENT_VERSION
                }
            };
            res.status(501).json(errorResponse);
            return;
        }
        handler(req, res, next);
    };
};
exports.versionedRoute = versionedRoute;
/**
 * Get version compatibility info
 */
const getVersionInfo = () => {
    return {
        currentVersion: exports.CURRENT_VERSION,
        supportedVersions: exports.SUPPORTED_VERSIONS,
        deprecatedVersions: exports.DEPRECATED_VERSIONS,
        compatibility: exports.VERSION_COMPATIBILITY
    };
};
exports.getVersionInfo = getVersionInfo;
//# sourceMappingURL=versioning.js.map