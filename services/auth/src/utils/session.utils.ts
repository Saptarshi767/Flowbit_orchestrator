import { createClient, RedisClientType } from 'redis'
import { v4 as uuidv4 } from 'uuid'
import { SessionData, AuthConfig } from '../types/auth.types'

/**
 * Session management utilities using Redis
 */

export class SessionManager {
  private redis: RedisClientType
  private sessionPrefix = 'session:'
  private userSessionsPrefix = 'user_sessions:'
  private sessionExpiry: number

  constructor(config: AuthConfig['redis'], sessionExpiry: number = 86400) {
    this.redis = createClient({
      socket: {
        host: config.host,
        port: config.port
      },
      password: config.password
    })
    this.sessionExpiry = sessionExpiry
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    try {
      await this.redis.connect()
      console.log('Session manager connected to Redis')
    } catch (error) {
      throw new Error(`Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create a new session
   */
  async createSession(sessionData: SessionData): Promise<string> {
    const sessionId = uuidv4()
    const sessionKey = `${this.sessionPrefix}${sessionId}`
    const userSessionsKey = `${this.userSessionsPrefix}${sessionData.userId}`

    try {
      // Store session data
      await this.redis.hSet(sessionKey, {
        userId: sessionData.userId,
        organizationId: sessionData.organizationId,
        role: sessionData.role,
        permissions: JSON.stringify(sessionData.permissions),
        lastActivity: sessionData.lastActivity.toString(),
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        loginMethod: sessionData.loginMethod,
        createdAt: Date.now().toString()
      })

      // Set session expiry
      await this.redis.expire(sessionKey, this.sessionExpiry)

      // Add session to user's session list
      await this.redis.sAdd(userSessionsKey, sessionId)
      await this.redis.expire(userSessionsKey, this.sessionExpiry)

      return sessionId
    } catch (error) {
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const sessionKey = `${this.sessionPrefix}${sessionId}`

    try {
      const sessionData = await this.redis.hGetAll(sessionKey)
      
      if (!sessionData || Object.keys(sessionData).length === 0) {
        return null
      }

      return {
        userId: sessionData.userId,
        organizationId: sessionData.organizationId,
        role: sessionData.role as any,
        permissions: JSON.parse(sessionData.permissions || '[]'),
        lastActivity: parseInt(sessionData.lastActivity),
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        loginMethod: sessionData.loginMethod as any
      }
    } catch (error) {
      throw new Error(`Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string, ipAddress?: string): Promise<void> {
    const sessionKey = `${this.sessionPrefix}${sessionId}`

    try {
      const updates: Record<string, string> = {
        lastActivity: Date.now().toString()
      }

      if (ipAddress) {
        updates.ipAddress = ipAddress
      }

      await this.redis.hSet(sessionKey, updates)
      await this.redis.expire(sessionKey, this.sessionExpiry)
    } catch (error) {
      throw new Error(`Failed to update session activity: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const sessionKey = `${this.sessionPrefix}${sessionId}`

    try {
      // Get session data to find user ID
      const sessionData = await this.getSession(sessionId)
      
      if (sessionData) {
        const userSessionsKey = `${this.userSessionsPrefix}${sessionData.userId}`
        await this.redis.sRem(userSessionsKey, sessionId)
      }

      // Delete the session
      await this.redis.del(sessionKey)
    } catch (error) {
      throw new Error(`Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<void> {
    const userSessionsKey = `${this.userSessionsPrefix}${userId}`

    try {
      const sessionIds = await this.redis.sMembers(userSessionsKey)
      
      if (sessionIds.length > 0) {
        const sessionKeys = sessionIds.map(id => `${this.sessionPrefix}${id}`)
        await this.redis.del(...sessionKeys)
      }

      await this.redis.del(userSessionsKey)
    } catch (error) {
      throw new Error(`Failed to delete user sessions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<Array<{ sessionId: string; data: SessionData }>> {
    const userSessionsKey = `${this.userSessionsPrefix}${userId}`

    try {
      const sessionIds = await this.redis.sMembers(userSessionsKey)
      const sessions: Array<{ sessionId: string; data: SessionData }> = []

      for (const sessionId of sessionIds) {
        const sessionData = await this.getSession(sessionId)
        if (sessionData) {
          sessions.push({ sessionId, data: sessionData })
        } else {
          // Clean up invalid session reference
          await this.redis.sRem(userSessionsKey, sessionId)
        }
      }

      return sessions
    } catch (error) {
      throw new Error(`Failed to get user sessions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if session exists and is valid
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    const sessionKey = `${this.sessionPrefix}${sessionId}`

    try {
      const exists = await this.redis.exists(sessionKey)
      return exists === 1
    } catch (error) {
      return false
    }
  }

  /**
   * Extend session expiry
   */
  async extendSession(sessionId: string, additionalSeconds?: number): Promise<void> {
    const sessionKey = `${this.sessionPrefix}${sessionId}`
    const expiry = additionalSeconds || this.sessionExpiry

    try {
      await this.redis.expire(sessionKey, expiry)
    } catch (error) {
      throw new Error(`Failed to extend session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number
    sessionsByUser: Record<string, number>
  }> {
    try {
      const sessionKeys = await this.redis.keys(`${this.sessionPrefix}*`)
      const sessionsByUser: Record<string, number> = {}

      for (const key of sessionKeys) {
        const sessionData = await this.redis.hGetAll(key)
        if (sessionData.userId) {
          sessionsByUser[sessionData.userId] = (sessionsByUser[sessionData.userId] || 0) + 1
        }
      }

      return {
        totalActiveSessions: sessionKeys.length,
        sessionsByUser
      }
    } catch (error) {
      throw new Error(`Failed to get session stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const sessionKeys = await this.redis.keys(`${this.sessionPrefix}*`)
      let cleanedCount = 0

      for (const key of sessionKeys) {
        const ttl = await this.redis.ttl(key)
        if (ttl === -1 || ttl === -2) { // No expiry or expired
          await this.redis.del(key)
          cleanedCount++
        }
      }

      return cleanedCount
    } catch (error) {
      throw new Error(`Failed to cleanup expired sessions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Store temporary data (for OAuth flows, password resets, etc.)
   */
  async setTemporaryData(key: string, data: any, expirySeconds: number = 600): Promise<void> {
    try {
      await this.redis.setEx(`temp:${key}`, expirySeconds, JSON.stringify(data))
    } catch (error) {
      throw new Error(`Failed to set temporary data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get temporary data
   */
  async getTemporaryData(key: string): Promise<any | null> {
    try {
      const data = await this.redis.get(`temp:${key}`)
      return data ? JSON.parse(data) : null
    } catch (error) {
      return null
    }
  }

  /**
   * Delete temporary data
   */
  async deleteTemporaryData(key: string): Promise<void> {
    try {
      await this.redis.del(`temp:${key}`)
    } catch (error) {
      // Ignore errors for cleanup operations
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit()
    } catch (error) {
      // Ignore errors during shutdown
    }
  }
}

/**
 * Utility function to create session manager instance
 */
export function createSessionManager(config: AuthConfig['redis'], sessionExpiry?: number): SessionManager {
  return new SessionManager(config, sessionExpiry)
}