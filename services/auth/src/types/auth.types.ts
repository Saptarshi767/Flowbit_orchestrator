import { UserRole } from '@prisma/client'

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  name: string
  email: string
  password: string
  organizationId?: string
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  organizationId: string
  permissions: string[]
  emailVerified: boolean
}

export interface JWTPayload {
  userId: string
  email: string
  role: UserRole
  organizationId: string
  permissions: string[]
  sessionId: string
  iat?: number
  exp?: number
}

export interface SessionData {
  userId: string
  organizationId: string
  role: UserRole
  permissions: string[]
  lastActivity: number
  ipAddress: string
  userAgent: string
  loginMethod: 'local' | 'oauth' | 'saml'
}

export interface OAuthProfile {
  id: string
  email: string
  name: string
  provider: 'google' | 'github' | 'microsoft'
  avatar?: string
}

export interface SAMLProfile {
  nameID: string
  email: string
  firstName?: string
  lastName?: string
  attributes: Record<string, any>
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordReset {
  token: string
  newPassword: string
}

export interface EmailVerification {
  token: string
}

export interface AuthConfig {
  jwt: {
    secret: string
    accessTokenExpiry: string
    refreshTokenExpiry: string
  }
  session: {
    secret: string
    maxAge: number
    secure: boolean
  }
  oauth: {
    google?: {
      clientId: string
      clientSecret: string
      callbackURL: string
    }
    github?: {
      clientId: string
      clientSecret: string
      callbackURL: string
    }
    microsoft?: {
      clientId: string
      clientSecret: string
      callbackURL: string
    }
  }
  saml: {
    entryPoint: string
    issuer: string
    cert: string
    callbackURL: string
  }
  redis: {
    host: string
    port: number
    password?: string
  }
}

export interface AuthResult {
  success: boolean
  user?: AuthUser
  tokens?: AuthTokens
  error?: string
  requiresVerification?: boolean
}

export interface ValidationResult {
  isValid: boolean
  user?: AuthUser
  error?: string
}