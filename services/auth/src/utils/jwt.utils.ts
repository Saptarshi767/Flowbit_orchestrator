import jwt from 'jsonwebtoken'
import { JWTPayload, AuthConfig } from '../types/auth.types'

/**
 * JWT utility functions for token generation and validation
 */

export class JWTManager {
  private accessTokenSecret: string
  private refreshTokenSecret: string
  private accessTokenExpiry: string
  private refreshTokenExpiry: string

  constructor(config: AuthConfig['jwt']) {
    this.accessTokenSecret = config.secret
    this.refreshTokenSecret = config.secret + '_refresh' // Different secret for refresh tokens
    this.accessTokenExpiry = config.accessTokenExpiry
    this.refreshTokenExpiry = config.refreshTokenExpiry
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    try {
      // Validate expiry format before using it
      const expiresIn = this.accessTokenExpiry.match(/^(\d+)([smhd])$/) ? this.accessTokenExpiry : '15m'
      
      return jwt.sign(payload, this.accessTokenSecret, {
        expiresIn,
        issuer: 'ai-orchestrator',
        audience: 'ai-orchestrator-users'
      })
    } catch (error) {
      throw new Error(`Failed to generate access token: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload: Pick<JWTPayload, 'userId' | 'sessionId'>): string {
    try {
      // Validate expiry format before using it
      const expiresIn = this.refreshTokenExpiry.match(/^(\d+)([smhd])$/) ? this.refreshTokenExpiry : '7d'
      
      return jwt.sign(payload, this.refreshTokenSecret, {
        expiresIn,
        issuer: 'ai-orchestrator',
        audience: 'ai-orchestrator-refresh'
      })
    } catch (error) {
      throw new Error(`Failed to generate refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'ai-orchestrator',
        audience: 'ai-orchestrator-users'
      }) as JWTPayload

      return decoded
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired')
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token')
      } else {
        throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): Pick<JWTPayload, 'userId' | 'sessionId'> {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'ai-orchestrator',
        audience: 'ai-orchestrator-refresh'
      }) as Pick<JWTPayload, 'userId' | 'sessionId'>

      return decoded
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired')
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token')
      } else {
        throw new Error(`Refresh token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload
    } catch (error) {
      return null
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = this.decodeToken(token)
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000)
      }
      return null
    } catch (error) {
      return null
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token)
    if (!expiration) return true
    return expiration < new Date()
  }

  /**
   * Get time until token expires (in seconds)
   */
  getTimeUntilExpiry(token: string): number {
    const expiration = this.getTokenExpiration(token)
    if (!expiration) return 0
    return Math.max(0, Math.floor((expiration.getTime() - Date.now()) / 1000))
  }

  /**
   * Extract bearer token from authorization header
   */
  extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader) return null
    
    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null
    }
    
    return parts[1]
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp'>): {
    accessToken: string
    refreshToken: string
    expiresIn: number
  } {
    const accessToken = this.generateAccessToken(payload)
    const refreshToken = this.generateRefreshToken({
      userId: payload.userId,
      sessionId: payload.sessionId
    })

    // Calculate expiry in seconds
    const expiresIn = this.parseExpiryToSeconds(this.accessTokenExpiry)

    return {
      accessToken,
      refreshToken,
      expiresIn
    }
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/)
    if (!match) {
      // For invalid format, return 15 minutes as default
      return 15 * 60
    }

    const value = parseInt(match[1])
    const unit = match[2]

    switch (unit) {
      case 's': return value
      case 'm': return value * 60
      case 'h': return value * 60 * 60
      case 'd': return value * 60 * 60 * 24
      default: return 15 * 60 // 15 minutes default
    }
  }
}

/**
 * Utility function to create JWT manager instance
 */
export function createJWTManager(config: AuthConfig['jwt']): JWTManager {
  return new JWTManager(config)
}