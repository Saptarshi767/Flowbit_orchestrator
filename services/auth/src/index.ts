import { createAuthApp } from './app'
import { AuthConfig } from './types/auth.types'
import { AppConfig } from './app'

/**
 * Authentication service entry point
 */

// Load configuration from environment variables
const authConfig: AuthConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
  },
  session: {
    secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400'), // 24 hours
    secure: process.env.NODE_ENV === 'production'
  },
  oauth: {
    google: process.env.GOOGLE_CLIENT_ID ? {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback'
    } : undefined,
    github: process.env.GITHUB_CLIENT_ID ? {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/auth/github/callback'
    } : undefined,
    microsoft: process.env.MICROSOFT_CLIENT_ID ? {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      callbackURL: process.env.MICROSOFT_CALLBACK_URL || 'http://localhost:3001/auth/microsoft/callback'
    } : undefined
  },
  saml: process.env.SAML_ENTRY_POINT ? {
    entryPoint: process.env.SAML_ENTRY_POINT,
    issuer: process.env.SAML_ISSUER || 'ai-orchestrator',
    cert: process.env.SAML_CERT || '',
    callbackURL: process.env.SAML_CALLBACK_URL || 'http://localhost:3001/auth/saml/callback'
  } : {} as any,
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  }
}

const appConfig: AppConfig = {
  port: parseInt(process.env.AUTH_SERVICE_PORT || '3001'),
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
}

// Validate required configuration
function validateConfig(): void {
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'SESSION_SECRET'
  ]

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar])
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '))
    console.error('Please check your .env file and ensure all required variables are set.')
    process.exit(1)
  }

  // Warn about OAuth/SAML configuration
  if (!authConfig.oauth.google && !authConfig.oauth.github && !authConfig.oauth.microsoft) {
    console.warn('Warning: No OAuth providers configured. Only local authentication will be available.')
  }

  if (!authConfig.saml.entryPoint) {
    console.warn('Warning: SAML not configured. Enterprise SSO will not be available.')
  }

  // Validate production settings
  if (process.env.NODE_ENV === 'production') {
    if (authConfig.jwt.secret === 'your-super-secret-jwt-key-change-in-production') {
      console.error('Error: Default JWT secret detected in production. Please set JWT_SECRET environment variable.')
      process.exit(1)
    }

    if (authConfig.session.secret === 'your-super-secret-session-key-change-in-production') {
      console.error('Error: Default session secret detected in production. Please set SESSION_SECRET environment variable.')
      process.exit(1)
    }

    if (!authConfig.session.secure) {
      console.warn('Warning: Session cookies are not secure in production. Consider setting NODE_ENV=production.')
    }
  }
}

// Main function
async function main(): Promise<void> {
  try {
    console.log('Starting AI Orchestrator Authentication Service...')
    
    // Validate configuration
    validateConfig()
    
    // Create and start the application
    const app = createAuthApp(authConfig, appConfig)
    await app.start()
    
    console.log('Authentication service started successfully!')
    console.log('Configuration:')
    console.log(`- Port: ${appConfig.port}`)
    console.log(`- CORS Origins: ${appConfig.corsOrigins.join(', ')}`)
    console.log(`- OAuth Providers: ${Object.keys(authConfig.oauth).filter(key => authConfig.oauth[key as keyof typeof authConfig.oauth]).join(', ') || 'None'}`)
    console.log(`- SAML Configured: ${authConfig.saml.entryPoint ? 'Yes' : 'No'}`)
    console.log(`- Redis: ${authConfig.redis.host}:${authConfig.redis.port}`)
    
  } catch (error) {
    console.error('Failed to start authentication service:', error)
    process.exit(1)
  }
}

// Start the service
if (require.main === module) {
  main()
}

export { createAuthApp, AuthConfig, AppConfig }