import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PrismaClient, UserRole } from '@prisma/client'
import { AuthService } from '../src/auth.service'
import { AuthConfig } from '../src/types/auth.types'
import { hashPassword } from '../src/utils/password.utils'

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

describe('AuthService', () => {
  let authService: AuthService
  let authConfig: AuthConfig

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup test configuration
    authConfig = {
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
  })

  afterEach(async () => {
    await authService.close()
  })

  describe('register', () => {
    it('should successfully register a new user', async () => {
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

      mockPrisma.user.findUnique.mockResolvedValue(null) // User doesn't exist
      mockPrisma.organization.create.mockResolvedValue(mockOrganization)
      mockPrisma.user.create.mockResolvedValue(mockUser)
      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.setEx.mockResolvedValue('OK')

      const result = await authService.register({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!'
      })

      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user?.email).toBe('john@example.com')
      expect(result.requiresVerification).toBe(true)
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          role: UserRole.DEVELOPER
        }),
        include: { organization: true }
      })
    })

    it('should fail if user already exists', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'john@example.com'
      }

      mockPrisma.user.findUnique.mockResolvedValue(existingUser)

      const result = await authService.register({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123!'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('User with this email already exists')
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('should fail with weak password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await authService.register({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'weak'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Password validation failed')
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })
  })

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const hashedPassword = await hashPassword('SecurePass123!')
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
      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.hSet.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)
      mockRedis.sAdd.mockResolvedValue(1)

      const result = await authService.login(
        { email: 'john@example.com', password: 'SecurePass123!' },
        '127.0.0.1',
        'test-agent'
      )

      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.tokens).toBeDefined()
      expect(result.user?.email).toBe('john@example.com')
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLoginAt: expect.any(Date) }
      })
    })

    it('should fail with invalid email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await authService.login(
        { email: 'nonexistent@example.com', password: 'SecurePass123!' },
        '127.0.0.1',
        'test-agent'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email or password')
    })

    it('should fail with invalid password', async () => {
      const hashedPassword = await hashPassword('SecurePass123!')
      const mockUser = {
        id: 'user-1',
        email: 'john@example.com',
        password: hashedPassword,
        emailVerified: new Date()
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await authService.login(
        { email: 'john@example.com', password: 'WrongPassword!' },
        '127.0.0.1',
        'test-agent'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email or password')
    })

    it('should fail if email not verified', async () => {
      const hashedPassword = await hashPassword('SecurePass123!')
      const mockUser = {
        id: 'user-1',
        email: 'john@example.com',
        password: hashedPassword,
        emailVerified: null
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await authService.login(
        { email: 'john@example.com', password: 'SecurePass123!' },
        '127.0.0.1',
        'test-agent'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Email not verified')
      expect(result.requiresVerification).toBe(true)
    })
  })

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
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
      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.exists.mockResolvedValue(1) // Session exists
      mockRedis.hSet.mockResolvedValue(1) // Update activity

      // Create a valid token first
      const authService = new AuthService(mockPrisma, authConfig)
      const jwtManager = (authService as any).jwtManager

      const token = jwtManager.generateAccessToken({
        userId: 'user-1',
        email: 'john@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write', 'execute'],
        sessionId: 'session-1'
      })

      const result = await authService.validateToken(token)

      expect(result.isValid).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user?.email).toBe('john@example.com')
    })

    it('should reject invalid token', async () => {
      const result = await authService.validateToken('invalid-token')

      expect(result.isValid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject token with expired session', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'john@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        emailVerified: new Date()
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.exists.mockResolvedValue(0) // Session doesn't exist

      const jwtManager = (authService as any).jwtManager
      const token = jwtManager.generateAccessToken({
        userId: 'user-1',
        email: 'john@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write', 'execute'],
        sessionId: 'expired-session'
      })

      const result = await authService.validateToken(token)

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Session expired')
    })
  })

  describe('refreshToken', () => {
    it('should refresh a valid token', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        emailVerified: new Date()
      }

      const mockSessionData = {
        userId: 'user-1',
        organizationId: 'org-1',
        role: UserRole.DEVELOPER,
        permissions: ['read', 'write', 'execute'],
        lastActivity: Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        loginMethod: 'local' as const
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.hGetAll.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'DEVELOPER',
        permissions: JSON.stringify(['read', 'write', 'execute']),
        lastActivity: Date.now().toString(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        loginMethod: 'local'
      })

      const jwtManager = (authService as any).jwtManager
      const refreshToken = jwtManager.generateRefreshToken({
        userId: 'user-1',
        sessionId: 'session-1'
      })

      const result = await authService.refreshToken(refreshToken)

      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.tokens).toBeDefined()
      expect(result.user?.email).toBe('john@example.com')
    })

    it('should fail with invalid refresh token', async () => {
      const result = await authService.refreshToken('invalid-refresh-token')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('logout', () => {
    it('should successfully logout', async () => {
      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.hGetAll.mockResolvedValue({
        userId: 'user-1'
      })
      mockRedis.sRem.mockResolvedValue(1)
      mockRedis.del.mockResolvedValue(1)

      const result = await authService.logout('session-1')

      expect(result.success).toBe(true)
      expect(mockRedis.del).toHaveBeenCalledWith('session:session-1')
    })
  })

  describe('logoutAll', () => {
    it('should logout from all sessions', async () => {
      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.sMembers.mockResolvedValue(['session-1', 'session-2'])
      mockRedis.del.mockResolvedValue(2)

      const result = await authService.logoutAll('user-1')

      expect(result.success).toBe(true)
      expect(mockRedis.del).toHaveBeenCalledWith('session:session-1', 'session:session-2')
      expect(mockRedis.del).toHaveBeenCalledWith('user_sessions:user-1')
    })
  })

  describe('requestPasswordReset', () => {
    it('should create password reset request', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'john@example.com'
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.setEx.mockResolvedValue('OK')

      const result = await authService.requestPasswordReset({
        email: 'john@example.com'
      })

      expect(result.success).toBe(true)
      expect(mockRedis.setEx).toHaveBeenCalled()
    })

    it('should not reveal if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await authService.requestPasswordReset({
        email: 'nonexistent@example.com'
      })

      expect(result.success).toBe(true) // Still returns success
      expect(mockRedis.setEx).not.toHaveBeenCalled()
    })
  })

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const resetData = {
        userId: 'user-1',
        email: 'john@example.com'
      }

      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.get.mockResolvedValue(JSON.stringify(resetData))
      mockRedis.del.mockResolvedValue(1)
      mockRedis.sMembers.mockResolvedValue(['session-1'])
      mockPrisma.user.update.mockResolvedValue({})

      const result = await authService.resetPassword({
        token: 'valid-reset-token',
        newPassword: 'NewSecurePass123!'
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { password: expect.any(String) }
      })
    })

    it('should fail with invalid token', async () => {
      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.get.mockResolvedValue(null)

      const result = await authService.resetPassword({
        token: 'invalid-token',
        newPassword: 'NewSecurePass123!'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid or expired reset token')
    })

    it('should fail with weak password', async () => {
      const resetData = {
        userId: 'user-1',
        email: 'john@example.com'
      }

      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.get.mockResolvedValue(JSON.stringify(resetData))

      const result = await authService.resetPassword({
        token: 'valid-reset-token',
        newPassword: 'weak'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Password validation failed')
    })
  })

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const verificationData = {
        userId: 'user-1',
        email: 'john@example.com'
      }

      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.get.mockResolvedValue(JSON.stringify(verificationData))
      mockRedis.del.mockResolvedValue(1)
      mockPrisma.user.update.mockResolvedValue({})

      const result = await authService.verifyEmail({
        token: 'valid-verification-token'
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerified: expect.any(Date) }
      })
    })

    it('should fail with invalid token', async () => {
      mockRedis.connect.mockResolvedValue(undefined)
      mockRedis.get.mockResolvedValue(null)

      const result = await authService.verifyEmail({
        token: 'invalid-token'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid or expired verification token')
    })
  })
})