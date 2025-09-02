import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { PrismaClient } from '@prisma/client'
import { Redis } from 'ioredis'
import { UserService } from './services/user.service'
import { OrganizationService } from './services/organization.service'
import { RBACService } from './services/rbac.service'
import { NotificationService } from './services/notification.service'
import { createUserRoutes } from './routes/user.routes'
import { createOrganizationRoutes } from './routes/organization.routes'
import { ValidationResult } from './types/user.types'

// Try to import auth service, fallback to mock if not available
let AuthService: any
let AuthConfig: any
try {
  const authModule = require('../../auth/src/auth.service')
  const authTypesModule = require('../../auth/src/types/auth.types')
  AuthService = authModule.AuthService
  AuthConfig = authTypesModule.AuthConfig
} catch (error) {
  console.warn('Auth service not available, will use mock')
}

/**
 * User Management Service Application
 */
export class UserManagementApp {
  private app: express.Application
  private prisma: PrismaClient
  private redis: Redis
  private userService: UserService
  private organizationService: OrganizationService
  private rbacService: RBACService
  private notificationService: NotificationService
  private authService: any

  constructor() {
    this.app = express()
    this.prisma = new PrismaClient()
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    })

    this.initializeServices()
    this.setupMiddleware()
    this.setupRoutes()
    this.setupErrorHandling()
  }

  /**
   * Initialize services
   */
  private initializeServices(): void {
    this.rbacService = new RBACService(this.prisma, this.redis)
    this.notificationService = new NotificationService(this.prisma)
    this.userService = new UserService(
      this.prisma,
      this.redis,
      this.rbacService,
      this.notificationService
    )
    this.organizationService = new OrganizationService(
      this.prisma,
      this.redis,
      this.rbacService
    )

    // Initialize auth service for authentication middleware
    const authConfig = {
      jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d'
      },
      session: {
        secret: process.env.SESSION_SECRET || 'your-session-secret',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: process.env.NODE_ENV === 'production'
      },
      oauth: {},
      saml: {
        entryPoint: '',
        issuer: '',
        cert: '',
        callbackURL: ''
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      }
    }

    try {
      this.authService = new AuthService(this.prisma, authConfig)
    } catch (error) {
      console.warn('Auth service not available, using mock for testing')
      this.authService = this.createMockAuthService()
    }
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet())
    
    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }))

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        success: false,
        error: 'Too many requests from this IP, please try again later'
      }
    })
    this.app.use(limiter)

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
      next()
    })

    // Authentication middleware
    this.app.use(this.authenticateToken.bind(this))
  }

  /**
   * Authentication middleware
   */
  private async authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
    // Skip authentication for public endpoints
    const publicEndpoints = [
      '/health',
      '/users/invite/accept',
      '/organizations' // Only POST for creating new organizations
    ]

    const isPublicEndpoint = publicEndpoints.some(endpoint => {
      if (endpoint === '/organizations' && req.method === 'POST') {
        return true
      }
      return req.path.startsWith(endpoint)
    })

    if (isPublicEndpoint) {
      return next()
    }

    try {
      const authHeader = req.headers.authorization
      const token = authHeader?.split(' ')[1] // Bearer TOKEN

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Access token required'
        })
        return
      }

      const validation = await this.authService.validateToken(token)

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
        error: 'Authentication error'
      })
    }
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        message: 'User Management Service is healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      })
    })

    // API routes
    this.app.use('/api/v1/users', createUserRoutes(this.userService))
    this.app.use('/api/v1/organizations', createOrganizationRoutes(this.organizationService))

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      })
    })
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', error)

      res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message
      })
    })
  }

  /**
   * Start the server
   */
  async start(port: number = 3002): Promise<void> {
    try {
      // Initialize auth service
      await this.authService.initialize()

      // Test database connection
      await this.prisma.$connect()
      console.log('Connected to database')

      // Test Redis connection
      await this.redis.ping()
      console.log('Connected to Redis')

      // Start server
      this.app.listen(port, () => {
        console.log(`User Management Service running on port ${port}`)
        console.log(`Health check: http://localhost:${port}/health`)
      })
    } catch (error) {
      console.error('Failed to start User Management Service:', error)
      process.exit(1)
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down User Management Service...')
    
    try {
      await this.authService.close()
      await this.prisma.$disconnect()
      await this.redis.quit()
      console.log('User Management Service shut down successfully')
    } catch (error) {
      console.error('Error during shutdown:', error)
    }
  }

  /**
   * Create mock auth service for testing
   */
  private createMockAuthService(): any {
    return {
      async initialize(): Promise<void> {
        // Mock implementation
      },
      async close(): Promise<void> {
        // Mock implementation
      },
      async validateToken(token: string): Promise<ValidationResult> {
        // Mock validation - in tests, we'll set req.user directly
        return {
          isValid: true,
          user: {
            id: 'mock-user-id',
            email: 'mock@test.com',
            name: 'Mock User',
            role: 'ADMIN' as UserRole,
            organizationId: 'mock-org-id',
            permissions: [],
            emailVerified: true
          }
        }
      }
    }
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app
  }
}

// Handle process signals for graceful shutdown
if (require.main === module) {
  const app = new UserManagementApp()
  
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...')
    await app.shutdown()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...')
    await app.shutdown()
    process.exit(0)
  })

  // Start the service
  const port = parseInt(process.env.PORT || '3002')
  app.start(port)
}