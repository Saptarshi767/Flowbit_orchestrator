import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import passport from 'passport'
import { PrismaClient } from '@prisma/client'
import { AuthService } from './auth.service'
import { createAuthRoutes } from './routes/auth.routes'
import { AuthConfig } from './types/auth.types'
import { configurePassportSerialization } from './strategies/oauth.strategies'

/**
 * Authentication service Express application
 */

export interface AppConfig {
  port: number
  corsOrigins: string[]
  rateLimitWindowMs: number
  rateLimitMaxRequests: number
}

export class AuthApp {
  private app: express.Application
  private authService: AuthService
  private config: AppConfig

  constructor(authConfig: AuthConfig, appConfig: AppConfig) {
    this.app = express()
    this.config = appConfig
    
    // Initialize Prisma client
    const prisma = new PrismaClient()
    
    // Initialize auth service
    this.authService = new AuthService(prisma, authConfig)
    
    this.setupMiddleware()
    this.setupRoutes()
    this.setupErrorHandling()
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false
    }))

    // CORS configuration
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }))

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: this.config.rateLimitMaxRequests,
      message: {
        success: false,
        error: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false
    })
    this.app.use('/auth', limiter)

    // Stricter rate limiting for sensitive endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      message: {
        success: false,
        error: 'Too many authentication attempts, please try again later'
      },
      skip: (req) => {
        // Skip rate limiting for token refresh and logout
        return req.path.includes('/refresh') || req.path.includes('/logout')
      }
    })
    this.app.use(['/auth/login', '/auth/register', '/auth/password-reset'], authLimiter)

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }))
    this.app.use(cookieParser())

    // Passport middleware
    this.app.use(passport.initialize())
    configurePassportSerialization()

    // Request logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now()
      
      res.on('finish', () => {
        const duration = Date.now() - start
        const logData = {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        }
        
        console.log(`[${logData.timestamp}] ${logData.method} ${logData.url} ${logData.status} ${logData.duration}`)
      })
      
      next()
    })

    // Health check middleware
    this.app.use('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'auth-service',
        version: process.env.npm_package_version || '1.0.0'
      })
    })
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    // Authentication routes
    this.app.use('/auth', createAuthRoutes(this.authService))

    // API documentation route
    this.app.get('/docs', (req, res) => {
      res.json({
        service: 'Authentication Service',
        version: '1.0.0',
        endpoints: {
          'POST /auth/register': 'Register a new user',
          'POST /auth/login': 'Login with email and password',
          'POST /auth/refresh': 'Refresh access token',
          'POST /auth/logout': 'Logout current session',
          'POST /auth/logout-all': 'Logout from all sessions',
          'POST /auth/password-reset/request': 'Request password reset',
          'POST /auth/password-reset/confirm': 'Reset password with token',
          'POST /auth/verify-email': 'Verify email address',
          'GET /auth/me': 'Get current user info',
          'GET /auth/google': 'Google OAuth login',
          'GET /auth/github': 'GitHub OAuth login',
          'GET /auth/microsoft': 'Microsoft OAuth login',
          'GET /auth/saml': 'SAML SSO login',
          'GET /auth/saml/metadata': 'SAML metadata',
          'GET /health': 'Health check',
          'GET /docs': 'API documentation'
        }
      })
    })

    // Root route
    this.app.get('/', (req, res) => {
      res.json({
        message: 'AI Orchestrator Authentication Service',
        version: '1.0.0',
        status: 'running',
        docs: '/docs',
        health: '/health'
      })
    })

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      })
    })
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', error)

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development'
      
      res.status(error.status || 500).json({
        success: false,
        error: isDevelopment ? error.message : 'Internal server error',
        ...(isDevelopment && { stack: error.stack })
      })
    })

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error)
      process.exit(1)
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason)
      process.exit(1)
    })

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully')
      await this.shutdown()
      process.exit(0)
    })

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully')
      await this.shutdown()
      process.exit(0)
    })
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    try {
      await this.authService.initialize()
      console.log('Authentication service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize authentication service:', error)
      throw error
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      await this.initialize()
      
      this.app.listen(this.config.port, () => {
        console.log(`Authentication service running on port ${this.config.port}`)
        console.log(`Health check: http://localhost:${this.config.port}/health`)
        console.log(`API docs: http://localhost:${this.config.port}/docs`)
      })
    } catch (error) {
      console.error('Failed to start authentication service:', error)
      process.exit(1)
    }
  }

  /**
   * Shutdown the application
   */
  async shutdown(): Promise<void> {
    try {
      console.log('Shutting down authentication service...')
      await this.authService.close()
      console.log('Authentication service shutdown complete')
    } catch (error) {
      console.error('Error during shutdown:', error)
    }
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app
  }

  /**
   * Get auth service instance
   */
  getAuthService(): AuthService {
    return this.authService
  }
}

/**
 * Create and configure the authentication app
 */
export function createAuthApp(authConfig: AuthConfig, appConfig: AppConfig): AuthApp {
  return new AuthApp(authConfig, appConfig)
}