/**
 * Basic API Tests
 * 
 * Simple tests to verify the core API functionality works
 */

import request from 'supertest';
import { createApp } from '../app';
import { Application } from 'express';

describe('Basic API Tests', () => {
  let app: Application;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    app = createApp();
  });

  afterAll(() => {
    // Clean up any resources if needed
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          status: expect.any(String),
          timestamp: expect.any(String),
          version: expect.any(String),
          uptime: expect.any(Number)
        }),
        meta: expect.objectContaining({
          correlationId: expect.any(String),
          timestamp: expect.any(String),
          version: expect.any(String)
        })
      });
    });
  });

  describe('Version Info', () => {
    test('should return version information', async () => {
      const response = await request(app)
        .get('/api/v1/version')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          version: expect.any(String),
          apiVersion: expect.any(String),
          buildDate: expect.any(String)
        })
      });
    });
  });

  describe('API Documentation', () => {
    test('should serve interactive documentation', async () => {
      const response = await request(app)
        .get('/api/v1/docs')
        .expect(200);

      expect(response.text).toContain('Robust AI Orchestrator API');
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    test('should provide API examples', async () => {
      const response = await request(app)
        .get('/api/v1/docs/examples')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.examples).toBeDefined();
      expect(response.body.data.examples.authentication).toBeDefined();
      expect(response.body.data.examples.workflows).toBeDefined();
    });

    test('should provide API status', async () => {
      const response = await request(app)
        .get('/api/v1/docs/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.api).toBeDefined();
      expect(response.body.data.versioning).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: expect.any(String),
          message: expect.any(String)
        }),
        meta: expect.objectContaining({
          correlationId: expect.any(String),
          timestamp: expect.any(String),
          version: expect.any(String)
        })
      });
    });
  });

  describe('API Versioning', () => {
    test('should accept version via header', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('X-API-Version', '1.1')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('1.1');
    });

    test('should handle deprecated version', async () => {
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
  });

  describe('Security Headers', () => {
    test('should include basic security headers', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Response Format', () => {
    test('should return consistent success format', async () => {
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

  describe('Content Type', () => {
    test('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Correlation ID', () => {
    test('should include correlation ID in responses', async () => {
      const correlationId = 'test-correlation-123';
      
      const response = await request(app)
        .get('/api/v1/health')
        .set('X-Correlation-ID', correlationId)
        .expect(200);

      expect(response.body.meta.correlationId).toBe(correlationId);
    });

    test('should generate correlation ID if not provided', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.meta.correlationId).toBeDefined();
      expect(response.body.meta.correlationId).not.toBe('');
    });
  });
});