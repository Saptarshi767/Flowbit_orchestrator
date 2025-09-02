import { Router, Request, Response, NextFunction } from 'express'
import passport from 'passport'
import { AuthService } from '../auth.service'
import { 
  LoginCredentials, 
  RegisterCredentials, 
  PasswordResetRequest, 
  PasswordReset, 
  EmailVerification 
} from '../types/auth.types'
import { z } from 'zod'

/**
 * Authentication routes
 */

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
})

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  organizationId: z.string().optional()
})

const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email format')
})

const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
})

const emailVerificationSchema = z.object({
  token: z.string().min(1, 'Verification token is required')
})

export function createAuthRoutes(authService: AuthService): Router {
  const router = Router()

  /**
   * POST /auth/register
   * Register a new user
   */
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const validatedData = registerSchema.parse(req.body)
      const credentials: RegisterCredentials = validatedData

      const result = await authService.register(credentials)

      if (result.success) {
        res.status(201).json({
          success: true,
          message: result.requiresVerification 
            ? 'Registration successful. Please check your email to verify your account.'
            : 'Registration successful',
          user: result.user,
          requiresVerification: result.requiresVerification
        })
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        })
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        })
      }
    }
  })

  /**
   * POST /auth/login
   * Login with email and password
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const validatedData = loginSchema.parse(req.body)
      const credentials: LoginCredentials = validatedData
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown'
      const userAgent = req.get('User-Agent') || 'unknown'

      const result = await authService.login(credentials, ipAddress, userAgent)

      if (result.success) {
        // Set HTTP-only cookie for refresh token
        if (result.tokens) {
          res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          })
        }

        res.json({
          success: true,
          message: 'Login successful',
          user: result.user,
          accessToken: result.tokens?.accessToken,
          expiresIn: result.tokens?.expiresIn
        })
      } else {
        const statusCode = result.requiresVerification ? 403 : 401
        res.status(statusCode).json({
          success: false,
          error: result.error,
          requiresVerification: result.requiresVerification
        })
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        })
      }
    }
  })

  /**
   * POST /auth/refresh
   * Refresh access token
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token not provided'
        })
      }

      const result = await authService.refreshToken(refreshToken)

      if (result.success) {
        // Update refresh token cookie
        if (result.tokens) {
          res.cookie('refreshToken', result.tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          })
        }

        res.json({
          success: true,
          message: 'Token refreshed successfully',
          user: result.user,
          accessToken: result.tokens?.accessToken,
          expiresIn: result.tokens?.expiresIn
        })
      } else {
        res.status(401).json({
          success: false,
          error: result.error
        })
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  /**
   * POST /auth/logout
   * Logout current session
   */
  router.post('/logout', authenticateToken(authService), async (req: Request, res: Response) => {
    try {
      const sessionId = (req as any).user?.sessionId

      if (sessionId) {
        await authService.logout(sessionId)
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken')

      res.json({
        success: true,
        message: 'Logout successful'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  /**
   * POST /auth/logout-all
   * Logout from all sessions
   */
  router.post('/logout-all', authenticateToken(authService), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId

      if (userId) {
        await authService.logoutAll(userId)
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken')

      res.json({
        success: true,
        message: 'Logged out from all sessions'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  /**
   * POST /auth/password-reset/request
   * Request password reset
   */
  router.post('/password-reset/request', async (req: Request, res: Response) => {
    try {
      const validatedData = passwordResetRequestSchema.parse(req.body)
      const request: PasswordResetRequest = validatedData

      const result = await authService.requestPasswordReset(request)

      if (result.success) {
        res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        })
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        })
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        })
      }
    }
  })

  /**
   * POST /auth/password-reset/confirm
   * Reset password with token
   */
  router.post('/password-reset/confirm', async (req: Request, res: Response) => {
    try {
      const validatedData = passwordResetSchema.parse(req.body)
      const reset: PasswordReset = validatedData

      const result = await authService.resetPassword(reset)

      if (result.success) {
        res.json({
          success: true,
          message: 'Password reset successful'
        })
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        })
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        })
      }
    }
  })

  /**
   * POST /auth/verify-email
   * Verify email address
   */
  router.post('/verify-email', async (req: Request, res: Response) => {
    try {
      const validatedData = emailVerificationSchema.parse(req.body)
      const verification: EmailVerification = validatedData

      const result = await authService.verifyEmail(verification)

      if (result.success) {
        res.json({
          success: true,
          message: 'Email verified successfully'
        })
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        })
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        })
      }
    }
  })

  /**
   * GET /auth/me
   * Get current user info
   */
  router.get('/me', authenticateToken(authService), (req: Request, res: Response) => {
    res.json({
      success: true,
      user: (req as any).user
    })
  })

  // OAuth routes
  const oauthManager = authService.getOAuthManager()
  if (oauthManager) {
    /**
     * GET /auth/google
     * Initiate Google OAuth
     */
    router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

    /**
     * GET /auth/google/callback
     * Google OAuth callback
     */
    router.get('/google/callback', 
      passport.authenticate('google', { session: false }),
      handleOAuthCallback(authService)
    )

    /**
     * GET /auth/github
     * Initiate GitHub OAuth
     */
    router.get('/github', passport.authenticate('github', { scope: ['user:email'] }))

    /**
     * GET /auth/github/callback
     * GitHub OAuth callback
     */
    router.get('/github/callback',
      passport.authenticate('github', { session: false }),
      handleOAuthCallback(authService)
    )

    /**
     * GET /auth/microsoft
     * Initiate Microsoft OAuth
     */
    router.get('/microsoft', passport.authenticate('microsoft', { scope: ['user.read'] }))

    /**
     * GET /auth/microsoft/callback
     * Microsoft OAuth callback
     */
    router.get('/microsoft/callback',
      passport.authenticate('microsoft', { session: false }),
      handleOAuthCallback(authService)
    )
  }

  // SAML routes
  const samlManager = authService.getSAMLManager()
  if (samlManager) {
    /**
     * GET /auth/saml
     * Initiate SAML authentication
     */
    router.get('/saml', passport.authenticate('saml'))

    /**
     * POST /auth/saml/callback
     * SAML callback
     */
    router.post('/saml/callback',
      passport.authenticate('saml', { session: false }),
      handleSAMLCallback(authService)
    )

    /**
     * GET /auth/saml/metadata
     * SAML metadata
     */
    router.get('/saml/metadata', (req: Request, res: Response) => {
      const metadata = samlManager.generateMetadata()
      res.type('application/xml')
      res.send(metadata)
    })
  }

  return router
}

/**
 * Authentication middleware
 */
function authenticateToken(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization
      const token = authHeader?.split(' ')[1] // Bearer TOKEN

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Access token required'
        })
      }

      const validation = await authService.validateToken(token)

      if (validation.isValid && validation.user) {
        (req as any).user = validation.user
        next()
      } else {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid token'
        })
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  }
}

/**
 * OAuth callback handler
 */
function handleOAuthCallback(authService: AuthService) {
  return async (req: Request, res: Response) => {
    try {
      const user = req.user as any

      if (!user) {
        return res.redirect('/login?error=oauth_failed')
      }

      // Create session and tokens for OAuth user
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown'
      const userAgent = req.get('User-Agent') || 'unknown'

      // This would typically create a session and redirect with tokens
      // For now, we'll redirect to a success page
      res.redirect('/dashboard?oauth=success')
    } catch (error) {
      res.redirect('/login?error=oauth_failed')
    }
  }
}

/**
 * SAML callback handler
 */
function handleSAMLCallback(authService: AuthService) {
  return async (req: Request, res: Response) => {
    try {
      const user = req.user as any

      if (!user) {
        return res.redirect('/login?error=saml_failed')
      }

      // Create session and tokens for SAML user
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown'
      const userAgent = req.get('User-Agent') || 'unknown'

      // This would typically create a session and redirect with tokens
      // For now, we'll redirect to a success page
      res.redirect('/dashboard?saml=success')
    } catch (error) {
      res.redirect('/login?error=saml_failed')
    }
  }
}