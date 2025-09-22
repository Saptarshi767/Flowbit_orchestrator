import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { app } from '../../app'
import crypto from 'crypto'

describe('Security Audit Tests', () => {
  describe('Authentication Security', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/workflows')
      
      expect(response.status).toBe(401)
    })

    it('should reject invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/workflows')
        .set('Authorization', 'Bearer invalid-token')
      
      expect(response.status).toBe(401)
    })

    it('should enforce rate limiting', async () => {
      const requests = Array.from({ length: 101 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'wrong' })
      )

      const responses = await Promise.all(requests)
      const rateLimited = responses.filter(r => r.status === 429)
      
      expect(rateLimited.length).toBeGreaterThan(0)
    })
  })

  describe('Input Validation Security', () => {
    it('should prevent SQL injection attacks', async () => {
      const maliciousInput = "'; DROP TABLE users; --"
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: maliciousInput,
          password: 'password'
        })
      
      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid input')
    })

    it('should prevent XSS attacks', async () => {
      const xssPayload = '<script>alert("xss")</script>'
      
      const response = await request(app)
        .post('/api/workflows')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: xssPayload,
          engineType: 'langflow',
          definition: {}
        })
      
      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid characters')
    })

    it('should validate file uploads securely', async () => {
      const maliciousFile = Buffer.from('<?php system($_GET["cmd"]); ?>')
      
      const response = await request(app)
        .post('/api/workflows/import')
        .set('Authorization', 'Bearer valid-token')
        .attach('file', maliciousFile, 'malicious.php')
      
      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid file type')
    })
  })

  describe('Authorization Security', () => {
    it('should enforce role-based access control', async () => {
      // Test with user token trying to access admin endpoint
      const userToken = 'user-level-token'
      
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
      
      expect(response.status).toBe(403)
    })

    it('should prevent privilege escalation', async () => {
      const response = await request(app)
        .put('/api/users/self/role')
        .set('Authorization', 'Bearer user-token')
        .send({ role: 'admin' })
      
      expect(response.status).toBe(403)
    })
  })

  describe('Data Protection', () => {
    it('should encrypt sensitive data in transit', async () => {
      // Verify HTTPS enforcement
      const response = await request(app)
        .get('/api/workflows')
        .set('X-Forwarded-Proto', 'http')
      
      expect(response.status).toBe(301) // Redirect to HTTPS
    })

    it('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .get('/api/workflows/non-existent-id')
        .set('Authorization', 'Bearer valid-token')
      
      expect(response.status).toBe(404)
      expect(response.body).not.toHaveProperty('stack')
      expect(response.body).not.toHaveProperty('query')
    })

    it('should implement proper session management', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
      
      const token = loginResponse.body.token
      
      // Logout should invalidate token
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
      
      const protectedResponse = await request(app)
        .get('/api/workflows')
        .set('Authorization', `Bearer ${token}`)
      
      expect(protectedResponse.status).toBe(401)
    })
  })

  describe('Infrastructure Security', () => {
    it('should have secure headers configured', async () => {
      const response = await request(app)
        .get('/api/health')
      
      expect(response.headers['x-content-type-options']).toBe('nosniff')
      expect(response.headers['x-frame-options']).toBe('DENY')
      expect(response.headers['x-xss-protection']).toBe('1; mode=block')
      expect(response.headers['strict-transport-security']).toBeDefined()
    })

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/health')
      
      expect(response.headers['server']).toBeUndefined()
      expect(response.headers['x-powered-by']).toBeUndefined()
    })
  })
})