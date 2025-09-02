import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { Strategy as GitHubStrategy } from 'passport-github2'
import { Strategy as MicrosoftStrategy } from 'passport-microsoft'
import { AuthConfig, OAuthProfile } from '../types/auth.types'

/**
 * OAuth authentication strategies
 */

export interface OAuthStrategyCallbacks {
  onGoogleAuth: (profile: OAuthProfile) => Promise<any>
  onGitHubAuth: (profile: OAuthProfile) => Promise<any>
  onMicrosoftAuth: (profile: OAuthProfile) => Promise<any>
}

export class OAuthManager {
  private config: AuthConfig['oauth']
  private callbacks: OAuthStrategyCallbacks

  constructor(config: AuthConfig['oauth'], callbacks: OAuthStrategyCallbacks) {
    this.config = config
    this.callbacks = callbacks
  }

  /**
   * Initialize all OAuth strategies
   */
  initialize(): void {
    this.initializeGoogleStrategy()
    this.initializeGitHubStrategy()
    this.initializeMicrosoftStrategy()
  }

  /**
   * Initialize Google OAuth strategy
   */
  private initializeGoogleStrategy(): void {
    if (!this.config.google) return

    passport.use(new GoogleStrategy({
      clientID: this.config.google.clientId,
      clientSecret: this.config.google.clientSecret,
      callbackURL: this.config.google.callbackURL,
      scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const oauthProfile: OAuthProfile = {
          id: profile.id,
          email: profile.emails?.[0]?.value || '',
          name: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim(),
          provider: 'google',
          avatar: profile.photos?.[0]?.value
        }

        const user = await this.callbacks.onGoogleAuth(oauthProfile)
        return done(null, user)
      } catch (error) {
        return done(error, null)
      }
    }))
  }

  /**
   * Initialize GitHub OAuth strategy
   */
  private initializeGitHubStrategy(): void {
    if (!this.config.github) return

    passport.use(new GitHubStrategy({
      clientID: this.config.github.clientId,
      clientSecret: this.config.github.clientSecret,
      callbackURL: this.config.github.callbackURL,
      scope: ['user:email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const oauthProfile: OAuthProfile = {
          id: profile.id,
          email: profile.emails?.[0]?.value || '',
          name: profile.displayName || profile.username || '',
          provider: 'github',
          avatar: profile.photos?.[0]?.value
        }

        const user = await this.callbacks.onGitHubAuth(oauthProfile)
        return done(null, user)
      } catch (error) {
        return done(error, null)
      }
    }))
  }

  /**
   * Initialize Microsoft OAuth strategy
   */
  private initializeMicrosoftStrategy(): void {
    if (!this.config.microsoft) return

    passport.use(new MicrosoftStrategy({
      clientID: this.config.microsoft.clientId,
      clientSecret: this.config.microsoft.clientSecret,
      callbackURL: this.config.microsoft.callbackURL,
      scope: ['user.read']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const oauthProfile: OAuthProfile = {
          id: profile.id,
          email: profile.emails?.[0]?.value || '',
          name: profile.displayName || '',
          provider: 'microsoft',
          avatar: profile.photos?.[0]?.value
        }

        const user = await this.callbacks.onMicrosoftAuth(oauthProfile)
        return done(null, user)
      } catch (error) {
        return done(error, null)
      }
    }))
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationURL(provider: 'google' | 'github' | 'microsoft', state?: string): string {
    const baseUrls = {
      google: 'https://accounts.google.com/o/oauth2/v2/auth',
      github: 'https://github.com/login/oauth/authorize',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    }

    const configs = {
      google: this.config.google,
      github: this.config.github,
      microsoft: this.config.microsoft
    }

    const config = configs[provider]
    if (!config) {
      throw new Error(`OAuth provider ${provider} is not configured`)
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackURL,
      response_type: 'code'
    })

    // Provider-specific parameters
    switch (provider) {
      case 'google':
        params.append('scope', 'profile email')
        params.append('access_type', 'offline')
        break
      case 'github':
        params.append('scope', 'user:email')
        break
      case 'microsoft':
        params.append('scope', 'user.read')
        params.append('response_mode', 'query')
        break
    }

    if (state) {
      params.append('state', state)
    }

    return `${baseUrls[provider]}?${params.toString()}`
  }

  /**
   * Validate OAuth state parameter
   */
  validateState(receivedState: string, expectedState: string): boolean {
    return receivedState === expectedState
  }

  /**
   * Generate OAuth state parameter
   */
  generateState(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let state = ''
    for (let i = 0; i < 32; i++) {
      state += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return state
  }
}

/**
 * Serialize user for session
 */
export function configurePassportSerialization(): void {
  passport.serializeUser((user: any, done) => {
    done(null, user.id)
  })

  passport.deserializeUser(async (id: string, done) => {
    try {
      // This would typically fetch user from database
      // For now, we'll just pass the ID through
      done(null, { id })
    } catch (error) {
      done(error, null)
    }
  })
}

/**
 * Utility function to create OAuth manager
 */
export function createOAuthManager(config: AuthConfig['oauth'], callbacks: OAuthStrategyCallbacks): OAuthManager {
  return new OAuthManager(config, callbacks)
}