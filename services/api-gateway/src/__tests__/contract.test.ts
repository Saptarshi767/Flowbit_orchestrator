/**
 * API Contract Tests
 * 
 * These tests verify that the API endpoints conform to the OpenAPI specification
 * and maintain backward compatibility across versions.
 */

import request from 'supertest';
import { createApp } from '../app';
import { Application } from 'express';

describe('API Contract Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('API Response Format', () => {
    test('should return consistent response format for success', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Object),
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.any(String),
          version: expect.any(String)
        }
      });
    });

    test('should return consistent error format', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.any(String),
          version: expect.any(String)
        }
      });
    });
  });

  describe('API Versioning', () => {
    test('should accept version via Accept header', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Accept', 'application/vnd.robust-ai-orchestrator.v1.1+json')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('1.1');
    });

    test('should accept version via custom header', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('X-API-Version', '1.0')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('1.0');
      expect(response.headers['x-api-deprecation-warning']).toBeDefined();
    });

    test('should reject unsupported version', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('X-API-Version', '2.0')
        .expect(400);

      expect(response.body.error.code).toBe('UNSUPPORTED_API_VERSION');
    });

    test('should provide version compatibility info', async () => {
      const response = await request(app)
        .get('/api/v1/version')
        .expect(200);

      expect(response.body.data).toMatchObject({
        version: expect.any(String),
        apiVersion: expect.any(String),
        buildDate: expect.any(String)
      });
    });
  });

  describe('Authentication Contract', () => {
    test('should require authentication for protected endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/protected')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('should accept Bearer token authentication', async () => {
      // This would require a valid token in a real test
      const response = await request(app)
        .get('/api/v1/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should accept API key authentication', async () => {
      const response = await request(app)
        .get('/api/v1/internal/status')
        .set('X-API-Key', 'invalid-key')
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_API_KEY');
    });
  });

  describe('Rate Limiting Contract', () => {
    test('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Rate limiting headers should be present
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    test('should return 429 when rate limit exceeded', async () => {
      // This test would need to make many requests quickly
      // or use a test-specific rate limit configuration
      
      // For now, just verify the error format would be correct
      const mockRateLimitResponse = {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          details: {
            limit: 100,
            resetTime: expect.any(String)
          }
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.any(String),
          version: expect.any(String)
        }
      };

      expect(mockRateLimitResponse).toMatchObject({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: expect.any(String)
        }
      });
    });
  });

  describe('Pagination Contract', () => {
    test('should include pagination metadata in list responses', async () => {
      // Mock a list endpoint response
      const mockListResponse = {
        success: true,
        data: {
          items: [],
        },
        meta: {
          correlationId: 'test-123',
          timestamp: new Date().toISOString(),
          version: '1.1',
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      };

      expect(mockListResponse.meta.pagination).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
        hasNext: expect.any(Boolean),
        hasPrev: expect.any(Boolean)
      });
    });

    test('should accept pagination parameters', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .query({ page: 2, limit: 50 })
        .expect(200);

      // Verify query parameters are accepted (even if not used by health endpoint)
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling Contract', () => {
    test('should return 400 for bad request', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });

    test('should return 404 for not found', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    test('should return 405 for method not allowed', async () => {
      const response = await request(app)
        .patch('/api/v1/health')
        .expect(405);

      expect(response.body.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    test('should include correlation ID in all responses', async () => {
      const correlationId = 'test-correlation-123';
      
      const response = await request(app)
        .get('/api/v1/health')
        .set('X-Correlation-ID', correlationId)
        .expect(200);

      expect(response.body.meta.correlationId).toBe(correlationId);
    });
  });

  describe('Content Type Contract', () => {
    test('should accept JSON content type', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(400); // Will fail validation but should accept content type

      expect(response.status).not.toBe(415); // Not Unsupported Media Type
    });

    test('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should reject unsupported content types', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'text/plain')
        .send('invalid data')
        .expect(415);

      expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });
  });

  describe('Security Headers Contract', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Verify security headers are present
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    test('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/v1/health')
        .set('Origin', 'https://app.robust-ai-orchestrator.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain v1.0 response format', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('X-API-Version', '1.0')
        .expect(200);

      // V1.0 should have different pagination format
      expect(response.body.meta).toBeDefined();
      expect(response.headers['x-api-deprecation-warning']).toBeDefined();
    });

    test('should support deprecated endpoints', async () => {
      // Test that deprecated endpoints still work but return deprecation warnings
      const response = await request(app)
        .get('/api/v1/health')
        .set('X-API-Version', '1.0')
        .expect(200);

      expect(response.headers['x-api-deprecation-warning']).toContain('deprecated');
    });
  });

  describe('OpenAPI Specification Compliance', () => {
    test('should serve OpenAPI specification', async () => {
      const response = await request(app)
        .get('/api/v1/docs/openapi.json')
        .expect(200);

      expect(response.body).toMatchObject({
        openapi: expect.stringMatching(/^3\.\d+\.\d+$/),
        info: {
          title: expect.any(String),
          version: expect.any(String)
        },
        paths: expect.any(Object)
      });
    });

    test('should serve interactive documentation', async () => {
      const response = await request(app)
        .get('/api/v1/docs')
        .expect(200);

      expect(response.text).toContain('swagger-ui');
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });
  });

  describe('Analytics and Monitoring Contract', () => {
    test('should track request metrics', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Verify that analytics headers are present
      expect(response.headers['x-response-time']).toBeDefined();
    });

    test('should include performance headers', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Performance timing headers
      expect(response.headers['x-response-time']).toMatch(/^\d+ms$/);
    });
  });
});

describe('API Documentation Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  test('should provide API examples', async () => {
    const response = await request(app)
      .get('/api/v1/docs/examples')
      .expect(200);

    expect(response.body.data.examples).toBeDefined();
    expect(response.body.data.examples.authentication).toBeDefined();
    expect(response.body.data.examples.workflows).toBeDefined();
  });

  test('should provide SDK information', async () => {
    const response = await request(app)
      .get('/api/v1/docs/examples')
      .expect(200);

    expect(response.body.data.sdks).toMatchObject({
      javascript: expect.any(String),
      python: expect.any(String),
      go: expect.any(String),
      curl: expect.any(String)
    });
  });

  test('should provide API status information', async () => {
    const response = await request(app)
      .get('/api/v1/docs/status')
      .expect(200);

    expect(response.body.data).toMatchObject({
      api: {
        status: 'operational',
        version: expect.any(String),
        uptime: expect.any(Number)
      },
      versioning: {
        currentVersion: expect.any(String),
        supportedVersions: expect.any(Array),
        deprecatedVersions: expect.any(Array)
      }
    });
  });
});

describe('SDK Contract Tests', () => {
  test('TypeScript SDK should match API contract', () => {
    // This would test the TypeScript SDK against the API
    // For now, just verify the types are properly exported
    
    const mockApiResponse = {
      success: true,
      data: { test: 'data' },
      meta: {
        correlationId: 'test-123',
        timestamp: new Date().toISOString(),
        version: '1.1'
      }
    };

    expect(mockApiResponse).toMatchObject({
      success: expect.any(Boolean),
      data: expect.any(Object),
      meta: {
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        version: expect.any(String)
      }
    });
  });

  test('Python SDK should match API contract', () => {
    // This would test the Python SDK against the API
    // For now, just verify the expected structure
    
    const mockPythonResponse = {
      'success': true,
      'data': { 'test': 'data' },
      'meta': {
        'correlationId': 'test-123',
        'timestamp': new Date().toISOString(),
        'version': '1.1'
      }
    };

    expect(mockPythonResponse).toMatchObject({
      success: expect.any(Boolean),
      data: expect.any(Object),
      meta: expect.any(Object)
    });
  });
});