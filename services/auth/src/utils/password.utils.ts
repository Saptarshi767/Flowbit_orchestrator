import bcrypt from 'bcryptjs'
import { z } from 'zod'

/**
 * Password utility functions for hashing, validation, and security
 */

const SALT_ROUNDS = 12

// Password validation schema
export const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')

export interface PasswordStrength {
    score: number // 0-4
    feedback: string[]
    isStrong: boolean
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    try {
        const salt = await bcrypt.genSalt(SALT_ROUNDS)
        return await bcrypt.hash(password, salt)
    } catch (error) {
        throw new Error(`Failed to hash password: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
        return await bcrypt.compare(password, hash)
    } catch (error) {
        throw new Error(`Failed to verify password: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

/**
 * Validate password strength and format
 */
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
    try {
        passwordSchema.parse(password)
        return { isValid: true, errors: [] }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                isValid: false,
                errors: error.errors.map(err => err.message)
            }
        }
        return { isValid: false, errors: ['Invalid password format'] }
    }
}

/**
 * Calculate password strength score
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
    let score = 0
    const feedback: string[] = []

    // Length check
    if (password.length >= 8) score += 1
    else feedback.push('Use at least 8 characters')

    if (password.length >= 12) score += 1
    else if (password.length >= 8) feedback.push('Consider using 12+ characters for better security')

    // Character variety checks
    if (/[a-z]/.test(password)) score += 1
    else feedback.push('Add lowercase letters')

    if (/[A-Z]/.test(password)) score += 1
    else feedback.push('Add uppercase letters')

    if (/[0-9]/.test(password)) score += 1
    else feedback.push('Add numbers')

    if (/[^a-zA-Z0-9]/.test(password)) score += 1
    else feedback.push('Add special characters (!@#$%^&*)')

    // Complexity bonus
    const uniqueChars = new Set(password).size
    if (uniqueChars >= password.length * 0.7) score += 1

    // Common patterns penalty
    if (/(.)\1{2,}/.test(password)) {
        score -= 1
        feedback.push('Avoid repeating characters')
    }

    if (/123|abc|qwe|password|admin/i.test(password)) {
        score -= 2
        feedback.push('Avoid common patterns and words')
    }

    // Normalize score to 0-4 range
    score = Math.max(0, Math.min(4, score))

    return {
        score,
        feedback,
        isStrong: score >= 3
    }
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'

    const allChars = lowercase + uppercase + numbers + symbols

    let password = ''

    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += symbols[Math.floor(Math.random() * symbols.length)]

    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)]
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('')
}

/**
 * Check if password has been compromised (basic implementation)
 * In production, this would integrate with services like HaveIBeenPwned
 */
export async function checkPasswordCompromised(password: string): Promise<boolean> {
    // Common compromised passwords list (simplified)
    const commonPasswords = [
        'password', '123456', '123456789', 'qwerty', 'abc123',
        'password123', 'admin', 'letmein', 'welcome', 'monkey',
        'dragon', 'master', 'shadow', 'superman', 'michael'
    ]

    return commonPasswords.includes(password.toLowerCase())
}

/**
 * Generate password reset token
 */
export function generateResetToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
}

/**
 * Generate email verification token
 */
export function generateVerificationToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 48; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
}