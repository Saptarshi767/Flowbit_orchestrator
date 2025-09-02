import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  calculatePasswordStrength,
  generateSecurePassword,
  checkPasswordCompromised,
  generateResetToken,
  generateVerificationToken
} from '../src/utils/password.utils'

describe('Password Utils', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'SecurePass123!'
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(50) // bcrypt hashes are typically 60 chars
    })

    it('should generate different hashes for the same password', async () => {
      const password = 'SecurePass123!'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).not.toBe(hash2) // Due to salt
    })
  })

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'SecurePass123!'
      const hash = await hashPassword(password)
      const isValid = await verifyPassword(password, hash)

      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'SecurePass123!'
      const wrongPassword = 'WrongPass123!'
      const hash = await hashPassword(password)
      const isValid = await verifyPassword(wrongPassword, hash)

      expect(isValid).toBe(false)
    })
  })

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const result = validatePassword('SecurePass123!')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject password too short', () => {
      const result = validatePassword('Short1!')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must be at least 8 characters long')
    })

    it('should reject password without lowercase', () => {
      const result = validatePassword('UPPERCASE123!')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one lowercase letter')
    })

    it('should reject password without uppercase', () => {
      const result = validatePassword('lowercase123!')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
    })

    it('should reject password without numbers', () => {
      const result = validatePassword('NoNumbers!')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one number')
    })

    it('should reject password without special characters', () => {
      const result = validatePassword('NoSpecial123')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one special character')
    })

    it('should reject password too long', () => {
      const longPassword = 'A'.repeat(130) + '1!'
      const result = validatePassword(longPassword)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password must not exceed 128 characters')
    })
  })

  describe('calculatePasswordStrength', () => {
    it('should rate strong password highly', () => {
      const result = calculatePasswordStrength('MyVerySecureP@ssw0rd2023!')

      expect(result.score).toBeGreaterThanOrEqual(3)
      expect(result.isStrong).toBe(true)
      expect(result.feedback).toHaveLength(0)
    })

    it('should rate weak password poorly', () => {
      const result = calculatePasswordStrength('password')

      expect(result.score).toBeLessThan(3)
      expect(result.isStrong).toBe(false)
      expect(result.feedback.length).toBeGreaterThan(0)
    })

    it('should penalize common patterns', () => {
      const result = calculatePasswordStrength('Password123!')

      expect(result.feedback).toContain('Avoid common patterns and words')
    })

    it('should penalize repeating characters', () => {
      const result = calculatePasswordStrength('Passsssword123!')

      expect(result.feedback).toContain('Avoid repeating characters')
    })

    it('should give bonus for length', () => {
      const short = calculatePasswordStrength('Pass123!')
      const long = calculatePasswordStrength('MyVeryLongAndComplexPassword123!@#')

      expect(long.score).toBeGreaterThanOrEqual(short.score)
    })
  })

  describe('generateSecurePassword', () => {
    it('should generate password of specified length', () => {
      const password = generateSecurePassword(16)

      expect(password).toHaveLength(16)
    })

    it('should generate password with default length', () => {
      const password = generateSecurePassword()

      expect(password).toHaveLength(16)
    })

    it('should generate password with all character types', () => {
      const password = generateSecurePassword(20)

      expect(password).toMatch(/[a-z]/) // lowercase
      expect(password).toMatch(/[A-Z]/) // uppercase
      expect(password).toMatch(/[0-9]/) // numbers
      expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/) // symbols
    })

    it('should generate different passwords each time', () => {
      const password1 = generateSecurePassword()
      const password2 = generateSecurePassword()

      expect(password1).not.toBe(password2)
    })

    it('should generate strong passwords', () => {
      const password = generateSecurePassword()
      const strength = calculatePasswordStrength(password)

      expect(strength.isStrong).toBe(true)
    })
  })

  describe('checkPasswordCompromised', () => {
    it('should detect common compromised passwords', async () => {
      const isCompromised = await checkPasswordCompromised('password')

      expect(isCompromised).toBe(true)
    })

    it('should not flag secure passwords', async () => {
      const isCompromised = await checkPasswordCompromised('MyVerySecureP@ssw0rd2023!')

      expect(isCompromised).toBe(false)
    })

    it('should be case insensitive', async () => {
      const isCompromised = await checkPasswordCompromised('PASSWORD')

      expect(isCompromised).toBe(true)
    })
  })

  describe('generateResetToken', () => {
    it('should generate token of correct length', () => {
      const token = generateResetToken()

      expect(token).toHaveLength(32)
    })

    it('should generate different tokens each time', () => {
      const token1 = generateResetToken()
      const token2 = generateResetToken()

      expect(token1).not.toBe(token2)
    })

    it('should generate alphanumeric tokens', () => {
      const token = generateResetToken()

      expect(token).toMatch(/^[A-Za-z0-9]+$/)
    })
  })

  describe('generateVerificationToken', () => {
    it('should generate token of correct length', () => {
      const token = generateVerificationToken()

      expect(token).toHaveLength(48)
    })

    it('should generate different tokens each time', () => {
      const token1 = generateVerificationToken()
      const token2 = generateVerificationToken()

      expect(token1).not.toBe(token2)
    })

    it('should generate alphanumeric tokens', () => {
      const token = generateVerificationToken()

      expect(token).toMatch(/^[A-Za-z0-9]+$/)
    })
  })
})