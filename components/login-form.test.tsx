import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './login-form'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'mock-token' })
    })
  })

  it('renders login form elements', () => {
    render(<LoginForm />)
    
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('displays OAuth login options', () => {
    render(<LoginForm />)
    
    expect(screen.getByText(/continue with google/i)).toBeInTheDocument()
    expect(screen.getByText(/continue with github/i)).toBeInTheDocument()
    expect(screen.getByText(/continue with microsoft/i)).toBeInTheDocument()
  })

  it('handles email input changes', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const emailInput = screen.getByLabelText(/email/i)
    await user.type(emailInput, 'test@example.com')
    
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('handles password input changes', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const passwordInput = screen.getByLabelText(/password/i)
    await user.type(passwordInput, 'password123')
    
    expect(passwordInput).toHaveValue('password123')
  })

  it('submits form with valid credentials', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    })
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    
    // Mock a delayed response
    mockFetch.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ token: 'mock-token' })
      }), 100))
    )
    
    render(<LoginForm />)
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    expect(screen.getByText(/signing in/i)).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })

  it('displays error message on failed login', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Invalid credentials' })
    })
    
    render(<LoginForm />)
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)
    
    // Should not call fetch without required fields
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows "Remember me" checkbox', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument()
  })

  it('displays "Forgot password" link', () => {
    render(<LoginForm />)
    expect(screen.getByText(/forgot your password/i)).toBeInTheDocument()
  })

  it('shows sign up link', () => {
    render(<LoginForm />)
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument()
    expect(screen.getByText(/sign up/i)).toBeInTheDocument()
  })

  it('handles OAuth button clicks', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const googleButton = screen.getByText(/continue with google/i)
    const githubButton = screen.getByText(/continue with github/i)
    const microsoftButton = screen.getByText(/continue with microsoft/i)
    
    // These should be clickable (testing that they don't throw errors)
    await user.click(googleButton)
    await user.click(githubButton)
    await user.click(microsoftButton)
    
    // In a real implementation, these would redirect or open OAuth flows
    expect(googleButton).toBeInTheDocument()
    expect(githubButton).toBeInTheDocument()
    expect(microsoftButton).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    render(<LoginForm />)
    
    const title = screen.getByText('Welcome back')
    expect(title).toHaveClass('text-2xl', 'font-bold')
    
    const form = screen.getByRole('form')
    expect(form).toHaveClass('space-y-6')
  })
})