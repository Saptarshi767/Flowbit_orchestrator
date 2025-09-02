import request from 'supertest';
import { createApp } from '../app';
import { initializeRedis } from '../middleware/rateLimiter';

// Mock Redis to avoid connection issues in tests
jest.mock('../middleware/rateLimiter', () => ({
  initializeRedis: jest.fn(),
  generalRateLimit: (req: any, res: any, next: any) => next(),
  apiRateLimit: (req: any, res: any, next: any) => next(),
  authRateLimit: (req: any, res: any, next: any) => next(),
}));

describe('API Gateway', () => {
  let app: any;

  beforeAll(async () => {
    await initializeRedis();
    app = createApp();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.meta.correlationId).toBeDefined();
    });
  });

  describe('Version Endpoint', () => {
    it('should return version information', async () => {
      const response = await request(app)
        .get('/api/v1/version')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data.apiVersion).toBe('v1');
    });
  });

  describe('Root Endpoint', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Robust AI Orchestrator API Gateway');
    });
  });

  describe('Protected Routes', () => {
    it('should return 401 for protected route without token', async () => {
      const response = await request(app)
        .get('/api/v1/protected')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 for invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-correlation-id']).toBeDefined();
    });
  });
});