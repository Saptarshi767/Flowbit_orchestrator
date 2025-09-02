import { PrismaClient, User, UserRole } from '@prisma/client'
import { 
  LoginCredentials, 
  RegisterCredentials, 
  AuthUser, 
  AuthResult, 
  ValidationResult,
  OAuthProfile,
  SAMLProfile,
  AuthTokens,
  SessionData,
  AuthConfig,
  PasswordResetRequest,
  PasswordReset,
  EmailVerification
} from './types/auth.types'
import { hashPassword, verifyPassword, validatePassword, generateResetToken, generateVerificationToken } from './utils/password.utils'
import { JWTManager } from './utils/jwt.utils'
import { SessionManager } from './utils/session.utils'
import { OAuthManager, OAuthStrategyCallbacks } from './strategies/oauth.strategies'
import { SAMLManager, SAMLStrategyCallbacks } from './strategies/saml.strategy'
import { v4 as uuidv4 } from 'uuid'

/**
 * Main authentication service
 */

export class AuthService {
  private prisma: PrismaClient
  private jwtManager: JWTManager
  private sessionManager: SessionManager
  private oauthManager?: OAuthManager
  private samlManager?: SAMLManager
  private config: AuthConfig

  constructor(prisma: PrismaClient, config: AuthConfig) {
    this.prisma = prisma
    this.config = config
    this.jwtManager = new JWTManager(config.jwt)
    this.sessionManager = new SessionManager(config.redis, config.session.maxAge)

    // Initialize OAuth if configured
    if (config.oauth && (config.oauth.google || config.oauth.github || config.oauth.microsoft)) {
      const oauthCallbacks: OAuthStrategyCallbacks = {
        onGoogleAuth: this.handleOAuthLogin.bind(this),
        onGitHubAuth: this.handleOAuthLogin.bind(this),
        onMicrosoftAuth: this.handleOAuthLogin.bind(this)
      }
      this.oauthManager = new OAuthManager(config.oauth, oauthCallbacks)
    }

    // Initialize SAML if configured
    if (config.saml) {
      const samlCallbacks: SAMLStrategyCallbacks = {
        onSAMLAuth: this.handleSAMLLogin.bind(this)
      }
      this.samlManager = new SAMLManager(config.saml, samlCallbacks)
    }
  }

  /**
   * Initialize the authentication service
   */
  async initialize(): Promise<void> {
    await this.sessionManager.initialize()
    this.oauthManager?.initialize()
    this.samlManager?.initialize()
  }

  /**
   * Register a new user with email and password
   */
  async register(credentials: RegisterCredentials): Promise<AuthResult> {
    try {
      // Validate password
      const passwordValidation = validatePassword(credentials.password)
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: `Password validation failed: ${passwordValidation.errors.join(', ')}`
        }
      }

      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase() }
      })

      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists'
        }
      }

      // Hash password
      const hashedPassword = await hashPassword(credentials.password)

      // Get or create organization
      let organizationId = credentials.organizationId
      if (!organizationId) {
        // Create a default organization for the user
        const organization = await this.prisma.organization.create({
          data: {
            name: `${credentials.name}'s Organization`,
            slug: `${credentials.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
            plan: 'FREE'
          }
        })
        organizationId = organization.id
      }

      // Create user
      const user = await this.prisma.user.create({
        data: {
          name: credentials.name,
          email: credentials.email.toLowerCase(),
          password: hashedPassword,
          role: UserRole.DEVELOPER,
          organizationId,
          emailVerified: null, // Requires email verification
          preferences: {
            theme: 'light',
            notifications: { email: true, inApp: true },
            defaultEngine: 'LANGFLOW'
          }
        },
        include: {
          organization: true
        }
      })

      // Generate verification token
      const verificationToken = generateVerificationToken()
      await this.sessionManager.setTemporaryData(
        `email_verification:${verificationToken}`,
        { userId: user.id, email: user.email },
        86400 // 24 hours
      )

      // Create auth user object
      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        permissions: this.getUserPermissions(user.role),
        emailVerified: false
      }

      return {
        success: true,
        user: authUser,
        requiresVerification: true
      }
    } catch (error) {
      return {
        success: false,
        error: `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials, ipAddress: string, userAgent: string): Promise<AuthResult> {
    try {
      // Find user
      const user = await this.prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase() },
        include: { organization: true }
      })

      if (!user || !user.password) {
        return {
          success: false,
          error: 'Invalid email or password'
        }
      }

      // Verify password
      const isPasswordValid = await verifyPassword(credentials.password, user.password)
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid email or password'
        }
      }

      // Check if email is verified
      if (!user.emailVerified) {
        return {
          success: false,
          error: 'Email not verified. Please check your email for verification link.',
          requiresVerification: true
        }
      }

      // Create session
      const sessionData: SessionData = {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        permissions: this.getUserPermissions(user.role),
        lastActivity: Date.now(),
        ipAddress,
        userAgent,
        loginMethod: 'local'
      }

      const sessionId = await this.sessionManager.createSession(sessionData)

      // Generate tokens
      const tokens = this.jwtManager.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        permissions: this.getUserPermissions(user.role),
        sessionId
      })

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })

      // Create auth user object
      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        permissions: this.getUserPermissions(user.role),
        emailVerified: true
      }

      return {
        success: true,
        user: authUser,
        tokens
      }
    } catch (error) {
      return {
        success: false,
        error: `Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Validate JWT token and return user info
   */
  async validateToken(token: string): Promise<ValidationResult> {
    try {
      // Verify JWT token
      const payload = this.jwtManager.verifyAccessToken(token)

      // Check if session is still valid
      const isSessionValid = await this.sessionManager.isSessionValid(payload.sessionId)
      if (!isSessionValid) {
        return {
          isValid: false,
          error: 'Session expired'
        }
      }

      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        include: { organization: true }
      })

      if (!user) {
        return {
          isValid: false,
          error: 'User not found'
        }
      }

      // Update session activity
      await this.sessionManager.updateSessionActivity(payload.sessionId)

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        permissions: this.getUserPermissions(user.role),
        emailVerified: !!user.emailVerified
      }

      return {
        isValid: true,
        user: authUser
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Token validation failed'
      }
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      // Verify refresh token
      const payload = this.jwtManager.verifyRefreshToken(refreshToken)

      // Check if session is still valid
      const sessionData = await this.sessionManager.getSession(payload.sessionId)
      if (!sessionData) {
        return {
          success: false,
          error: 'Session expired'
        }
      }

      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId }
      })

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        }
      }

      // Generate new tokens
      const tokens = this.jwtManager.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        permissions: this.getUserPermissions(user.role),
        sessionId: payload.sessionId
      })

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        permissions: this.getUserPermissions(user.role),
        emailVerified: !!user.emailVerified
      }

      return {
        success: true,
        user: authUser,
        tokens
      }
    } catch (error) {
      return {
        success: false,
        error: `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.sessionManager.deleteSession(sessionId)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Logout user from all sessions
   */
  async logoutAll(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.sessionManager.deleteUserSessions(userId)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `Logout all failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Handle OAuth login
   */
  private async handleOAuthLogin(profile: OAuthProfile): Promise<AuthUser> {
    try {
      // Check if user exists
      let user = await this.prisma.user.findUnique({
        where: { email: profile.email.toLowerCase() },
        include: { organization: true }
      })

      if (!user) {
        // Create new user
        const organization = await this.prisma.organization.create({
          data: {
            name: `${profile.name}'s Organization`,
            slug: `${profile.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
            plan: 'FREE'
          }
        })

        user = await this.prisma.user.create({
          data: {
            name: profile.name,
            email: profile.email.toLowerCase(),
            role: UserRole.DEVELOPER,
            organizationId: organization.id,
            emailVerified: new Date(), // OAuth emails are considered verified
            image: profile.avatar,
            preferences: {
              theme: 'light',
              notifications: { email: true, inApp: true },
              defaultEngine: 'LANGFLOW'
            }
          },
          include: { organization: true }
        })

        // Create OAuth account record
        await this.prisma.account.create({
          data: {
            userId: user.id,
            type: 'oauth',
            provider: profile.provider,
            providerAccountId: profile.id
          }
        })
      } else {
        // Update last login
        await this.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        permissions: this.getUserPermissions(user.role),
        emailVerified: !!user.emailVerified
      }
    } catch (error) {
      throw new Error(`OAuth login failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Handle SAML login
   */
  private async handleSAMLLogin(profile: SAMLProfile): Promise<AuthUser> {
    try {
      // Check if user exists
      let user = await this.prisma.user.findUnique({
        where: { email: profile.email.toLowerCase() },
        include: { organization: true }
      })

      if (!user) {
        // Create new user
        const organization = await this.prisma.organization.create({
          data: {
            name: `${profile.firstName || ''} ${profile.lastName || ''}'s Organization`.trim(),
            slug: `${(profile.firstName || '').toLowerCase()}-${Date.now()}`,
            plan: 'ENTERPRISE'
          }
        })

        user = await this.prisma.user.create({
          data: {
            name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email,
            email: profile.email.toLowerCase(),
            role: UserRole.DEVELOPER,
            organizationId: organization.id,
            emailVerified: new Date(), // SAML emails are considered verified
            preferences: {
              theme: 'light',
              notifications: { email: true, inApp: true },
              defaultEngine: 'LANGFLOW'
            }
          },
          include: { organization: true }
        })
      } else {
        // Update last login
        await this.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        permissions: this.getUserPermissions(user.role),
        emailVerified: !!user.emailVerified
      }
    } catch (error) {
      throw new Error(`SAML login failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: request.email.toLowerCase() }
      })

      if (!user) {
        // Don't reveal if user exists
        return { success: true }
      }

      const resetToken = generateResetToken()
      await this.sessionManager.setTemporaryData(
        `password_reset:${resetToken}`,
        { userId: user.id, email: user.email },
        3600 // 1 hour
      )

      // In a real implementation, send email with reset link
      console.log(`Password reset token for ${user.email}: ${resetToken}`)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `Password reset request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword(reset: PasswordReset): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate new password
      const passwordValidation = validatePassword(reset.newPassword)
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: `Password validation failed: ${passwordValidation.errors.join(', ')}`
        }
      }

      // Get reset data
      const resetData = await this.sessionManager.getTemporaryData(`password_reset:${reset.token}`)
      if (!resetData) {
        return {
          success: false,
          error: 'Invalid or expired reset token'
        }
      }

      // Hash new password
      const hashedPassword = await hashPassword(reset.newPassword)

      // Update user password
      await this.prisma.user.update({
        where: { id: resetData.userId },
        data: { password: hashedPassword }
      })

      // Clean up reset token
      await this.sessionManager.deleteTemporaryData(`password_reset:${reset.token}`)

      // Invalidate all user sessions
      await this.sessionManager.deleteUserSessions(resetData.userId)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `Password reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(verification: EmailVerification): Promise<{ success: boolean; error?: string }> {
    try {
      // Get verification data
      const verificationData = await this.sessionManager.getTemporaryData(`email_verification:${verification.token}`)
      if (!verificationData) {
        return {
          success: false,
          error: 'Invalid or expired verification token'
        }
      }

      // Update user email verification
      await this.prisma.user.update({
        where: { id: verificationData.userId },
        data: { emailVerified: new Date() }
      })

      // Clean up verification token
      await this.sessionManager.deleteTemporaryData(`email_verification:${verification.token}`)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: `Email verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Get user permissions based on role
   */
  private getUserPermissions(role: UserRole): string[] {
    const permissions: Record<UserRole, string[]> = {
      [UserRole.ADMIN]: ['read', 'write', 'delete', 'manage_users', 'manage_organization', 'execute', 'publish'],
      [UserRole.MANAGER]: ['read', 'write', 'delete', 'manage_users', 'execute', 'publish'],
      [UserRole.DEVELOPER]: ['read', 'write', 'execute'],
      [UserRole.VIEWER]: ['read']
    }

    return permissions[role] || []
  }

  /**
   * Get OAuth manager
   */
  getOAuthManager(): OAuthManager | undefined {
    return this.oauthManager
  }

  /**
   * Get SAML manager
   */
  getSAMLManager(): SAMLManager | undefined {
    return this.samlManager
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.sessionManager.close()
  }
}