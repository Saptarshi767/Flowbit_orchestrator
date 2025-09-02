import { describe, it, expect, beforeEach } from 'vitest'
import { JWTManager } from '../src/utils/jwt.utils'
import { UserRole } from '@prisma/client'

describe('JWT Utils', () => {
  let jwtManager: JWTManager

  beforeEach(() => {
    jwtManager = new JWTManager({
      secret: 'test-secret',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d'
    })
  })

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const token = jwtManager.generateAccessToken(payload)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const payload = {
        userId: 'user-1',
        sessionId: 'session-1'
      }

      const token = jwtManager.generateRefreshToken(payload)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })
  })

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const token = jwtManager.generateAccessToken(payload)
      const decoded = jwtManager.verifyAccessToken(token)

      expect(decoded.userId).toBe(payload.userId)
      expect(decoded.email).toBe(payload.email)
      expect(decoded.role).toBe(payload.role)
      expect(decoded.organizationId).toBe(payload.organizationId)
      expect(decoded.permissions).toEqual(payload.permissions)
      expect(decoded.sessionId).toBe(payload.sessionId)
      expect(decoded.iat).toBeDefined()
      expect(decoded.exp).toBeDefined()
    })

    it('should throw error for invalid token', () => {
      expect(() => {
        jwtManager.verifyAccessToken('invalid-token')
      }).toThrow('Invalid access token')
    })

    it('should throw error for malformed token', () => {
      expect(() => {
        jwtManager.verifyAccessToken('not.a.jwt')
      }).toThrow('Invalid access token')
    })
  })

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const payload = {
        userId: 'user-1',
        sessionId: 'session-1'
      }

      const token = jwtManager.generateRefreshToken(payload)
      const decoded = jwtManager.verifyRefreshToken(token)

      expect(decoded.userId).toBe(payload.userId)
      expect(decoded.sessionId).toBe(payload.sessionId)
    })

    it('should throw error for invalid refresh token', () => {
      expect(() => {
        jwtManager.verifyRefreshToken('invalid-token')
      }).toThrow('Invalid refresh token')
    })
  })

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const token = jwtManager.generateAccessToken(payload)
      const decoded = jwtManager.decodeToken(token)

      expect(decoded).toBeDefined()
      expect(decoded?.userId).toBe(payload.userId)
      expect(decoded?.email).toBe(payload.email)
    })

    it('should return null for invalid token', () => {
      const decoded = jwtManager.decodeToken('invalid-token')

      expect(decoded).toBeNull()
    })
  })

  describe('getTokenExpiration', () => {
    it('should get token expiration time', () => {
      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const token = jwtManager.generateAccessToken(payload)
      const expiration = jwtManager.getTokenExpiration(token)

      expect(expiration).toBeInstanceOf(Date)
      expect(expiration!.getTime()).toBeGreaterThan(Date.now())
    })

    it('should return null for invalid token', () => {
      const expiration = jwtManager.getTokenExpiration('invalid-token')

      expect(expiration).toBeNull()
    })
  })

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const token = jwtManager.generateAccessToken(payload)
      const isExpired = jwtManager.isTokenExpired(token)

      expect(isExpired).toBe(false)
    })

    it('should return true for invalid token', () => {
      const isExpired = jwtManager.isTokenExpired('invalid-token')

      expect(isExpired).toBe(true)
    })
  })

  describe('getTimeUntilExpiry', () => {
    it('should return positive time for valid token', () => {
      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const token = jwtManager.generateAccessToken(payload)
      const timeUntilExpiry = jwtManager.getTimeUntilExpiry(token)

      expect(timeUntilExpiry).toBeGreaterThan(0)
      expect(timeUntilExpiry).toBeLessThanOrEqual(15 * 60) // 15 minutes
    })

    it('should return 0 for invalid token', () => {
      const timeUntilExpiry = jwtManager.getTimeUntilExpiry('invalid-token')

      expect(timeUntilExpiry).toBe(0)
    })
  })

  describe('extractBearerToken', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      const authHeader = `Bearer ${token}`

      const extracted = jwtManager.extractBearerToken(authHeader)

      expect(extracted).toBe(token)
    })

    it('should return null for invalid header format', () => {
      const extracted = jwtManager.extractBearerToken('Invalid header')

      expect(extracted).toBeNull()
    })

    it('should return null for undefined header', () => {
      const extracted = jwtManager.extractBearerToken(undefined)

      expect(extracted).toBeNull()
    })

    it('should return null for non-Bearer header', () => {
      const extracted = jwtManager.extractBearerToken('Basic dXNlcjpwYXNz')

      expect(extracted).toBeNull()
    })
  })

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const tokenPair = jwtManager.generateTokenPair(payload)

      expect(tokenPair.accessToken).toBeDefined()
      expect(tokenPair.refreshToken).toBeDefined()
      expect(tokenPair.expiresIn).toBeDefined()
      expect(typeof tokenPair.accessToken).toBe('string')
      expect(typeof tokenPair.refreshToken).toBe('string')
      expect(typeof tokenPair.expiresIn).toBe('number')
      expect(tokenPair.expiresIn).toBe(15 * 60) // 15 minutes in seconds
    })

    it('should generate different access and refresh tokens', () => {
      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const tokenPair = jwtManager.generateTokenPair(payload)

      expect(tokenPair.accessToken).not.toBe(tokenPair.refreshToken)
    })
  })

  describe('token expiry parsing', () => {
    it('should parse seconds correctly', () => {
      const jwtManager = new JWTManager({
        secret: 'test-secret',
        accessTokenExpiry: '30s',
        refreshTokenExpiry: '7d'
      })

      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const tokenPair = jwtManager.generateTokenPair(payload)

      expect(tokenPair.expiresIn).toBe(30)
    })

    it('should parse minutes correctly', () => {
      const jwtManager = new JWTManager({
        secret: 'test-secret',
        accessTokenExpiry: '5m',
        refreshTokenExpiry: '7d'
      })

      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const tokenPair = jwtManager.generateTokenPair(payload)

      expect(tokenPair.expiresIn).toBe(5 * 60)
    })

    it('should parse hours correctly', () => {
      const jwtManager = new JWTManager({
        secret: 'test-secret',
        accessTokenExpiry: '2h',
        refreshTokenExpiry: '7d'
      })

      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const tokenPair = jwtManager.generateTokenPair(payload)

      expect(tokenPair.expiresIn).toBe(2 * 60 * 60)
    })

    it('should parse days correctly', () => {
      const jwtManager = new JWTManager({
        secret: 'test-secret',
        accessTokenExpiry: '1d',
        refreshTokenExpiry: '7d'
      })

      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const tokenPair = jwtManager.generateTokenPair(payload)

      expect(tokenPair.expiresIn).toBe(24 * 60 * 60)
    })

    it('should default to 15m for invalid format', () => {
      const jwtManager = new JWTManager({
        secret: 'test-secret',
        accessTokenExpiry: 'invalid',
        refreshTokenExpiry: '7d'
      })

      const payload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'org-1',
        permissions: ['read', 'write'],
        sessionId: 'session-1'
      }

      const tokenPair = jwtManager.generateTokenPair(payload)

      expect(tokenPair.expiresIn).toBe(15 * 60) // 15 minutes (default fallback)
    })
  })
})