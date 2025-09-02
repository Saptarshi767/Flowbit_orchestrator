import passport from 'passport'
import { Strategy as SamlStrategy } from 'passport-saml'
import { AuthConfig, SAMLProfile } from '../types/auth.types'

/**
 * SAML authentication strategy for enterprise SSO
 */

export interface SAMLStrategyCallbacks {
  onSAMLAuth: (profile: SAMLProfile) => Promise<any>
}

export class SAMLManager {
  private config: AuthConfig['saml']
  private callbacks: SAMLStrategyCallbacks

  constructor(config: AuthConfig['saml'], callbacks: SAMLStrategyCallbacks) {
    this.config = config
    this.callbacks = callbacks
  }

  /**
   * Initialize SAML strategy
   */
  initialize(): void {
    passport.use(new SamlStrategy({
      entryPoint: this.config.entryPoint,
      issuer: this.config.issuer,
      cert: this.config.cert,
      callbackUrl: this.config.callbackURL,
      authnRequestBinding: 'HTTP-POST',
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
      acceptedClockSkewMs: 5000
    }, async (profile, done) => {
      try {
        const samlProfile: SAMLProfile = {
          nameID: profile.nameID,
          email: profile.email || profile.nameID,
          firstName: profile.firstName || profile.givenName,
          lastName: profile.lastName || profile.surname,
          attributes: profile
        }

        const user = await this.callbacks.onSAMLAuth(samlProfile)
        return done(null, user)
      } catch (error) {
        return done(error, null)
      }
    }))
  }

  /**
   * Generate SAML metadata
   */
  generateMetadata(): string {
    const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" 
                     entityID="${this.config.issuer}">
  <md:SPSSODescriptor AuthnRequestsSigned="true" 
                      WantAssertionsSigned="true" 
                      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${this.config.cert.replace(/-----BEGIN CERTIFICATE-----|\r\n|\n|-----END CERTIFICATE-----/g, '')}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
                                Location="${this.config.callbackURL}" 
                                index="1" 
                                isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`

    return metadata
  }

  /**
   * Get SAML login URL
   */
  getLoginURL(relayState?: string): string {
    const params = new URLSearchParams({
      SAMLRequest: this.generateSAMLRequest(),
      RelayState: relayState || ''
    })

    return `${this.config.entryPoint}?${params.toString()}`
  }

  /**
   * Generate SAML authentication request
   */
  private generateSAMLRequest(): string {
    const id = '_' + this.generateId()
    const issueInstant = new Date().toISOString()

    const samlRequest = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                                           xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                                           ID="${id}"
                                           Version="2.0"
                                           IssueInstant="${issueInstant}"
                                           Destination="${this.config.entryPoint}"
                                           AssertionConsumerServiceURL="${this.config.callbackURL}"
                                           ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
      <saml:Issuer>${this.config.issuer}</saml:Issuer>
      <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>
    </samlp:AuthnRequest>`

    // In a real implementation, this would be properly encoded and signed
    return Buffer.from(samlRequest).toString('base64')
  }

  /**
   * Generate unique ID for SAML requests
   */
  private generateId(): string {
    const chars = 'abcdef0123456789'
    let id = ''
    for (let i = 0; i < 32; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return id
  }

  /**
   * Validate SAML response
   */
  validateResponse(samlResponse: string): boolean {
    try {
      // Basic validation - in production, this would include signature verification
      const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8')
      return decoded.includes('samlp:Response') && decoded.includes('saml:Assertion')
    } catch (error) {
      return false
    }
  }

  /**
   * Extract attributes from SAML response
   */
  extractAttributes(profile: any): Record<string, any> {
    const attributes: Record<string, any> = {}

    // Standard SAML attributes
    if (profile.email) attributes.email = profile.email
    if (profile.firstName) attributes.firstName = profile.firstName
    if (profile.lastName) attributes.lastName = profile.lastName
    if (profile.displayName) attributes.displayName = profile.displayName
    if (profile.department) attributes.department = profile.department
    if (profile.title) attributes.title = profile.title
    if (profile.phone) attributes.phone = profile.phone

    // Custom attributes
    if (profile.attributes) {
      Object.keys(profile.attributes).forEach(key => {
        if (!attributes[key]) {
          attributes[key] = profile.attributes[key]
        }
      })
    }

    return attributes
  }

  /**
   * Generate SAML logout request
   */
  generateLogoutRequest(nameID: string, sessionIndex?: string): string {
    const id = '_' + this.generateId()
    const issueInstant = new Date().toISOString()

    const logoutRequest = `<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                                              xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                                              ID="${id}"
                                              Version="2.0"
                                              IssueInstant="${issueInstant}"
                                              Destination="${this.config.entryPoint}">
      <saml:Issuer>${this.config.issuer}</saml:Issuer>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${nameID}</saml:NameID>
      ${sessionIndex ? `<samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>` : ''}
    </samlp:LogoutRequest>`

    return Buffer.from(logoutRequest).toString('base64')
  }

  /**
   * Get SAML logout URL
   */
  getLogoutURL(nameID: string, sessionIndex?: string): string {
    const params = new URLSearchParams({
      SAMLRequest: this.generateLogoutRequest(nameID, sessionIndex)
    })

    return `${this.config.entryPoint}?${params.toString()}`
  }
}

/**
 * Utility function to create SAML manager
 */
export function createSAMLManager(config: AuthConfig['saml'], callbacks: SAMLStrategyCallbacks): SAMLManager {
  return new SAMLManager(config, callbacks)
}