import nodemailer from 'nodemailer'
import { PrismaClient } from '@prisma/client'

/**
 * Notification Service
 * Handles email notifications, invitations, and user communications
 */
export class NotificationService {
  private prisma: PrismaClient
  private transporter: nodemailer.Transporter

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.transporter = this.createTransporter()
  }

  /**
   * Create email transporter
   */
  private createTransporter(): nodemailer.Transporter {
    // In production, this would use actual SMTP settings
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  }

  /**
   * Send user invitation email
   */
  async sendInvitationEmail(
    email: string,
    organizationId: string,
    token: string,
    message?: string
  ): Promise<void> {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true }
      })

      if (!organization) {
        throw new Error('Organization not found')
      }

      const inviteUrl = `${process.env.FRONTEND_URL}/invite/accept?token=${token}`

      const emailContent = {
        from: process.env.FROM_EMAIL || 'noreply@orchestrator.ai',
        to: email,
        subject: `Invitation to join ${organization.name} on AI Orchestrator`,
        html: this.generateInvitationEmailTemplate(
          organization.name,
          inviteUrl,
          message
        )
      }

      await this.transporter.sendMail(emailContent)
    } catch (error) {
      console.error('Failed to send invitation email:', error)
      throw new Error('Failed to send invitation email')
    }
  }

  /**
   * Send welcome email with temporary password
   */
  async sendWelcomeEmail(
    email: string,
    name: string,
    tempPassword: string,
    organizationId: string
  ): Promise<void> {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true }
      })

      if (!organization) {
        throw new Error('Organization not found')
      }

      const loginUrl = `${process.env.FRONTEND_URL}/login`

      const emailContent = {
        from: process.env.FROM_EMAIL || 'noreply@orchestrator.ai',
        to: email,
        subject: `Welcome to ${organization.name} on AI Orchestrator`,
        html: this.generateWelcomeEmailTemplate(
          name,
          organization.name,
          email,
          tempPassword,
          loginUrl
        )
      }

      await this.transporter.sendMail(emailContent)
    } catch (error) {
      console.error('Failed to send welcome email:', error)
      throw new Error('Failed to send welcome email')
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`

      const emailContent = {
        from: process.env.FROM_EMAIL || 'noreply@orchestrator.ai',
        to: email,
        subject: 'Reset your AI Orchestrator password',
        html: this.generatePasswordResetEmailTemplate(resetUrl)
      }

      await this.transporter.sendMail(emailContent)
    } catch (error) {
      console.error('Failed to send password reset email:', error)
      throw new Error('Failed to send password reset email')
    }
  }

  /**
   * Send email verification email
   */
  async sendEmailVerificationEmail(email: string, verificationToken: string): Promise<void> {
    try {
      const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`

      const emailContent = {
        from: process.env.FROM_EMAIL || 'noreply@orchestrator.ai',
        to: email,
        subject: 'Verify your AI Orchestrator email address',
        html: this.generateEmailVerificationTemplate(verifyUrl)
      }

      await this.transporter.sendMail(emailContent)
    } catch (error) {
      console.error('Failed to send email verification:', error)
      throw new Error('Failed to send email verification')
    }
  }

  /**
   * Generate invitation email template
   */
  private generateInvitationEmailTemplate(
    organizationName: string,
    inviteUrl: string,
    message?: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invitation to ${organizationName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AI Orchestrator</h1>
          </div>
          <div class="content">
            <h2>You've been invited to join ${organizationName}</h2>
            <p>You have been invited to join <strong>${organizationName}</strong> on AI Orchestrator, a powerful platform for AI workflow automation and orchestration.</p>
            ${message ? `<p><em>"${message}"</em></p>` : ''}
            <p>Click the button below to accept your invitation and create your account:</p>
            <a href="${inviteUrl}" class="button">Accept Invitation</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p><a href="${inviteUrl}">${inviteUrl}</a></p>
            <p>This invitation will expire in 7 days.</p>
          </div>
          <div class="footer">
            <p>This email was sent by AI Orchestrator. If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Generate welcome email template
   */
  private generateWelcomeEmailTemplate(
    name: string,
    organizationName: string,
    email: string,
    tempPassword: string,
    loginUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to ${organizationName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .credentials { background: #fff; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .warning { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to AI Orchestrator</h1>
          </div>
          <div class="content">
            <h2>Welcome to ${organizationName}, ${name}!</h2>
            <p>Your account has been created successfully. You can now access AI Orchestrator and start building powerful AI workflows.</p>
            
            <div class="credentials">
              <h3>Your Login Credentials</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
            </div>
            
            <div class="warning">
              <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
            </div>
            
            <a href="${loginUrl}" class="button">Login to AI Orchestrator</a>
            
            <h3>Getting Started</h3>
            <ul>
              <li>Explore the workflow editor and create your first AI workflow</li>
              <li>Connect to different AI engines (Langflow, N8N, LangSmith)</li>
              <li>Monitor your workflow executions in real-time</li>
              <li>Collaborate with your team members</li>
            </ul>
            
            <p>If you have any questions, please don't hesitate to reach out to your organization administrator or our support team.</p>
          </div>
          <div class="footer">
            <p>This email was sent by AI Orchestrator. Please keep your login credentials secure.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Generate password reset email template
   */
  private generatePasswordResetEmailTemplate(resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .warning { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AI Orchestrator</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password for your AI Orchestrator account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            
            <div class="warning">
              <p><strong>Security Notice:</strong> This password reset link will expire in 1 hour. If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
            </div>
          </div>
          <div class="footer">
            <p>This email was sent by AI Orchestrator. If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  /**
   * Generate email verification template
   */
  private generateEmailVerificationTemplate(verifyUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Email Address</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AI Orchestrator</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for signing up for AI Orchestrator! To complete your registration, please verify your email address.</p>
            <p>Click the button below to verify your email:</p>
            <a href="${verifyUrl}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p><a href="${verifyUrl}">${verifyUrl}</a></p>
            <p>This verification link will expire in 24 hours.</p>
          </div>
          <div class="footer">
            <p>This email was sent by AI Orchestrator. If you didn't create an account, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }
}