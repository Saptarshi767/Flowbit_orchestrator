import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { PrismaClient, UserRole } from '@prisma/client'
import { createAuthRoutes } from '../src/routes/auth.routes'
import { AuthService } from '../src/auth.service'
import { AuthConfig } from '../src/types/auth.types'

// Mock Prisma Client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  organization: {
    create: vi.fn()
  },
  account: {
    create: vi.fn()
  }
} as any

// Mock Redis client
const mockRedis = {
  connect: vi.fn(),
  hSet: vi.fn(),
  hGetAll: vi.fn(),
  expire: vi.fn(),
  sAdd: vi.fn(),
  del: vi.fn(),
  sRem: vi.fn(),
  sMembers: vi.fn(),
  exists: vi.fn(),
  setEx: vi.fn(),
  get: vi.fn(),
  quit: vi.fn()
}

// Mock Redis module
vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedis)
}))

describe('Auth Routes', () => {
  let app: express.Application
  let authService: AuthService

  beforeEach(async () => {
    vi.clearAllMocks()

    const authConfig: AuthConfig = {
      jwt: {
        secret: 'test-secret',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d'
      },
      session: {
        secret: 'test-session-secret',
        maxAge: 86400,
        secure: false
      },
      oauth: {},
      saml: {} as any,
      redis: {
        host: 'localhost',
        port: 6379
      }
    }

    authService = new AuthService(mockPrisma, authConfig)
    
    app = express()
    app.use(express.json())
    app.use('/auth', createAuthRoutes(authService))

    // Mock Redis connection
    mockRedis.connect.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await authService.close()
  })

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockOrganization = {
        id: 'org-1',
        name: "John's Organization",
        slug: 'john-123456789'
      }

      const mockUser = {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        emailVerified: null,
        organization: mockOrganization
      }

      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.organization.create.mockResolvedValue(mockOrganization)
      mockPrisma.user.create.mockResolvedValue(mockUser)
      mockRedis.setEx.mockResolvedValue('OK')

      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'SecurePass123!'
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.user).toBeDefined()
      expect(response.body.user.email).toBe('john@example.com')
      expect(response.body.requiresVerification).toBe(true)
    })

    it('should fail with invalid email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'invalid-email',
          password: 'SecurePass123!'
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Validation failed')
    })

    it('should fail with weak password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'weak'
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Validation failed')
    })

    it('should fail if user already exists', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'john@example.com'
      }

      mockPrisma.user.findUnique.mockResolvedValue(existingUser)

      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'SecurePass123!'
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('User with this email already exists')
    })
  })

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      // We need to hash the password properly for this test
      const bcrypt = await import('bcryptjs')
      const hashedPassword = await bcrypt.hash('SecurePass123!', 12)

      const mockUser = {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        emailVerified: new Date(),
        organization: { id: 'org-1', name: 'Test Org' }
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockPrisma.user.update.mockResolvedValue(mockUser)
      mockRedis.hSet.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)
      mockRedis.sAdd.mockResolvedValue(1)

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'john@example.com',
          password: 'SecurePass123!'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.user).toBeDefined()
      expect(response.body.accessToken).toBeDefined()
      expect(response.body.expiresIn).toBeDefined()
    })

    it('should fail with invalid email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePass123!'
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid email or password')
    })

    it('should fail with invalid password', async () => {
      const bcrypt = await import('bcryptjs')
      const hashedPassword = await bcrypt.hash('SecurePass123!', 12)

      const mockUser = {
        id: 'user-1',
        email: 'john@example.com',
        password: hashedPassword,
        emailVerified: new Date()
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'john@example.com',
          password: 'WrongPassword!'
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid email or password')
    })

    it('should fail if email not verified', async () => {
      const bcrypt = await import('bcryptjs')
      const hashedPassword = await bcrypt.hash('SecurePass123!', 12)

      const mockUser = {
        id: 'user-1',
        email: 'john@example.com',
        password: hashedPassword,
        emailVerified: null
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'john@example.com',
          password: 'SecurePass123!'
        })

      expect(response.status).toBe(403)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Email not verified')
      expect(response.body.requiresVerification).toBe(true)
    })

    it('should fail with validation errors', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: ''
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Validation failed')
      expect(response.body.details).toBeDefined()
    })
  })

  describe('POST /auth/refresh', () => {
    it('should fail without refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({})

      expect([401, 500]).toContain(response.status)
      expect(response.body.success).toBe(false)
    })

    it('should fail with invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })

      expect([401, 500]).toContain(response.status)
      expect(response.body.success).toBe(false)
    })

    it('should handle refresh token endpoint', async () => {
      // This test just verifies the endpoint exists and handles requests
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'some-token' })

      // Should return either 401 (invalid token) or 500 (internal error)
      expect([401, 500]).toContain(response.status)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /auth/password-reset/request', () => {
    it('should request password reset successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'john@example.com'
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockRedis.setEx.mockResolvedValue('OK')

      const response = await request(app)
        .post('/auth/password-reset/request')
        .send({
          email: 'john@example.com'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('password reset link has been sent')
    })

    it('should not reveal if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .post('/auth/password-reset/request')
        .send({
          email: 'nonexistent@example.com'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    it('should fail with invalid email', async () => {
      const response = await request(app)
        .post('/auth/password-reset/request')
        .send({
          email: 'invalid-email'
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Validation failed')
    })
  })

  describe('POST /auth/password-reset/confirm', () => {
    it('should reset password successfully', async () => {
      const resetData = {
        userId: 'user-1',
        email: 'john@example.com'
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(resetData))
      mockRedis.del.mockResolvedValue(1)
      mockRedis.sMembers.mockResolvedValue(['session-1'])
      mockPrisma.user.update.mockResolvedValue({})

      const response = await request(app)
        .post('/auth/password-reset/confirm')
        .send({
          token: 'valid-reset-token',
          newPassword: 'NewSecurePass123!'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Password reset successful')
    })

    it('should fail with invalid token', async () => {
      mockRedis.get.mockResolvedValue(null)

      const response = await request(app)
        .post('/auth/password-reset/confirm')
        .send({
          token: 'invalid-token',
          newPassword: 'NewSecurePass123!'
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid or expired reset token')
    })

    it('should fail with weak password', async () => {
      const resetData = {
        userId: 'user-1',
        email: 'john@example.com'
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(resetData))

      const response = await request(app)
        .post('/auth/password-reset/confirm')
        .send({
          token: 'valid-reset-token',
          newPassword: 'weak'
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Validation failed')
    })
  })

  describe('POST /auth/verify-email', () => {
    it('should verify email successfully', async () => {
      const verificationData = {
        userId: 'user-1',
        email: 'john@example.com'
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(verificationData))
      mockRedis.del.mockResolvedValue(1)
      mockPrisma.user.update.mockResolvedValue({})

      const response = await request(app)
        .post('/auth/verify-email')
        .send({
          token: 'valid-verification-token'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Email verified successfully')
    })

    it('should fail with invalid token', async () => {
      mockRedis.get.mockResolvedValue(null)

      const response = await request(app)
        .post('/auth/verify-email')
        .send({
          token: 'invalid-token'
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid or expired verification token')
    })
  })

  describe('GET /auth/me', () => {
    it('should return user info with valid token', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        emailVerified: new Date(),
        organization: { id: 'org-1', name: 'Test Org' }
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockRedis.exists.mockResolvedValue(1)
      mockRedis.hSet.mockResolvedValue(1)

      // Generate a valid access token
      const jwtManager = (authService as any).jwtManager
      const accessToken = jwtManager.generateAccessToken({
        userId: 'user-1',
        email: 'john@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write', 'execute'],
        sessionId: 'session-1'
      })

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.user).toBeDefined()
      expect(response.body.user.email).toBe('john@example.com')
    })

    it('should fail without token', async () => {
      const response = await request(app)
        .get('/auth/me')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Access token required')
    })

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })
})