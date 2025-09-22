import { test, expect, Page } from '@playwright/test'

/**
 * End-to-End Test Suite for User Workflows
 * 
 * This test suite covers all major user workflows in the AI Orchestrator platform:
 * - User authentication and registration
 * - Workflow creation and management
 * - Multi-engine workflow execution
 * - Collaboration features
 * - Marketplace interactions
 * - Monitoring and analytics
 * 
 * Requirements covered: 1.1, 1.2, 1.3, 2.1, 3.1, 3.2, 4.1, 4.2, 5.1, 6.1, 9.1
 */

test.describe('User Authentication Workflows', () => {
  test('should complete user registration flow', async ({ page }) => {
    await page.goto('/signup')
    
    // Fill registration form
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!')
    await page.fill('[data-testid="confirm-password-input"]', 'SecurePassword123!')
    await page.fill('[data-testid="name-input"]', 'Test User')
    
    // Submit registration
    await page.click('[data-testid="register-button"]')
    
    // Verify successful registration
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText('Welcome, Test User')
  })

  test('should complete OAuth login flow', async ({ page }) => {
    await page.goto('/login')
    
    // Mock OAuth provider response
    await page.route('**/auth/google', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ 
          user: { id: '1', email: 'oauth@example.com', name: 'OAuth User' },
          token: 'mock-jwt-token'
        })
      })
    })
    
    await page.click('[data-testid="google-login-button"]')
    
    // Verify successful OAuth login
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid="user-menu"]')).toContainText('OAuth User')
  })

  test('should handle SAML SSO authentication', async ({ page }) => {
    await page.goto('/login')
    
    // Mock SAML response
    await page.route('**/auth/saml', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          user: { id: '2', email: 'saml@enterprise.com', name: 'Enterprise User' },
          token: 'saml-jwt-token'
        })
      })
    })
    
    await page.click('[data-testid="saml-login-button"]')
    
    // Verify SAML authentication
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid="organization-badge"]')).toBeVisible()
  })
})

test.describe('Workflow Creation and Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await expect(page).toHaveURL('/dashboard')
  })

  test('should create Langflow workflow', async ({ page }) => {
    await page.goto('/workflows')
    await page.click('[data-testid="create-workflow-button"]')
    
    // Select Langflow engine
    await page.click('[data-testid="engine-selector"]')
    await page.click('[data-testid="langflow-option"]')
    
    // Fill workflow details
    await page.fill('[data-testid="workflow-name"]', 'Test Langflow Workflow')
    await page.fill('[data-testid="workflow-description"]', 'A test workflow for Langflow')
    
    // Create workflow
    await page.click('[data-testid="create-button"]')
    
    // Verify workflow creation
    await expect(page).toHaveURL(/\/workflows\/.*/)
    await expect(page.locator('[data-testid="workflow-editor"]')).toBeVisible()
    await expect(page.locator('[data-testid="engine-indicator"]')).toContainText('Langflow')
  })

  test('should create N8N workflow', async ({ page }) => {
    await page.goto('/workflows')
    await page.click('[data-testid="create-workflow-button"]')
    
    // Select N8N engine
    await page.click('[data-testid="engine-selector"]')
    await page.click('[data-testid="n8n-option"]')
    
    // Fill workflow details
    await page.fill('[data-testid="workflow-name"]', 'Test N8N Workflow')
    await page.fill('[data-testid="workflow-description"]', 'A test workflow for N8N')
    
    // Create workflow
    await page.click('[data-testid="create-button"]')
    
    // Verify workflow creation
    await expect(page).toHaveURL(/\/workflows\/.*/)
    await expect(page.locator('[data-testid="workflow-editor"]')).toBeVisible()
    await expect(page.locator('[data-testid="engine-indicator"]')).toContainText('N8N')
  })

  test('should import existing workflow', async ({ page }) => {
    await page.goto('/workflows')
    await page.click('[data-testid="import-workflow-button"]')
    
    // Upload workflow file
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles({
      name: 'test-workflow.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        name: 'Imported Workflow',
        engine: 'langflow',
        nodes: [],
        edges: []
      }))
    })
    
    await page.click('[data-testid="import-button"]')
    
    // Verify import success
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Workflow imported successfully')
    await expect(page.locator('[data-testid="workflow-list"]')).toContainText('Imported Workflow')
  })

  test('should manage workflow versions', async ({ page }) => {
    // Navigate to existing workflow
    await page.goto('/workflows')
    await page.click('[data-testid="workflow-item"]:first-child')
    
    // Make changes to workflow
    await page.click('[data-testid="add-node-button"]')
    await page.click('[data-testid="text-input-node"]')
    
    // Save as new version
    await page.click('[data-testid="save-version-button"]')
    await page.fill('[data-testid="version-notes"]', 'Added text input node')
    await page.click('[data-testid="confirm-save-button"]')
    
    // Verify version creation
    await page.click('[data-testid="version-history-button"]')
    await expect(page.locator('[data-testid="version-list"]')).toContainText('Added text input node')
    
    // Test version rollback
    await page.click('[data-testid="rollback-button"]:first-child')
    await page.click('[data-testid="confirm-rollback-button"]')
    
    // Verify rollback
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Rolled back to previous version')
  })
})

test.describe('Multi-Engine Workflow Execution', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
  })

  test('should execute Langflow workflow', async ({ page }) => {
    await page.goto('/workflows')
    await page.click('[data-testid="langflow-workflow"]:first-child')
    
    // Configure execution parameters
    await page.click('[data-testid="execute-button"]')
    await page.fill('[data-testid="input-parameter"]', 'Test input data')
    
    // Mock execution response
    await page.route('**/api/executions', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: 'exec-123',
          status: 'running',
          startTime: new Date().toISOString()
        })
      })
    })
    
    await page.click('[data-testid="start-execution-button"]')
    
    // Verify execution started
    await expect(page.locator('[data-testid="execution-status"]')).toContainText('Running')
    await expect(page.locator('[data-testid="execution-id"]')).toContainText('exec-123')
  })

  test('should monitor execution progress', async ({ page }) => {
    await page.goto('/executions/exec-123')
    
    // Mock real-time updates
    await page.route('**/api/executions/exec-123/status', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          status: 'completed',
          progress: 100,
          result: { output: 'Execution completed successfully' }
        })
      })
    })
    
    // Verify execution monitoring
    await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('value', '100')
    await expect(page.locator('[data-testid="execution-result"]')).toContainText('Execution completed successfully')
  })

  test('should handle execution errors', async ({ page }) => {
    await page.goto('/workflows')
    await page.click('[data-testid="workflow-item"]:first-child')
    
    // Mock execution error
    await page.route('**/api/executions', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({
          error: 'Execution failed: Invalid input parameter'
        })
      })
    })
    
    await page.click('[data-testid="execute-button"]')
    await page.click('[data-testid="start-execution-button"]')
    
    // Verify error handling
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Execution failed: Invalid input parameter')
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  })
})

test.describe('Collaboration Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
  })

  test('should share workflow with team members', async ({ page }) => {
    await page.goto('/workflows')
    await page.click('[data-testid="workflow-item"]:first-child')
    
    // Open sharing dialog
    await page.click('[data-testid="share-button"]')
    
    // Add collaborator
    await page.fill('[data-testid="collaborator-email"]', 'collaborator@example.com')
    await page.click('[data-testid="permission-selector"]')
    await page.click('[data-testid="edit-permission"]')
    await page.click('[data-testid="add-collaborator-button"]')
    
    // Verify sharing
    await expect(page.locator('[data-testid="collaborator-list"]')).toContainText('collaborator@example.com')
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Workflow shared successfully')
  })

  test('should enable real-time collaborative editing', async ({ page, context }) => {
    // Open workflow in first tab
    await page.goto('/workflows/workflow-123')
    
    // Open same workflow in second tab (simulating another user)
    const secondPage = await context.newPage()
    await secondPage.goto('/workflows/workflow-123')
    
    // Make change in first tab
    await page.click('[data-testid="add-node-button"]')
    await page.click('[data-testid="text-node"]')
    
    // Verify change appears in second tab
    await expect(secondPage.locator('[data-testid="text-node"]')).toBeVisible()
    
    // Verify collaboration indicator
    await expect(secondPage.locator('[data-testid="active-collaborators"]')).toContainText('1 other user')
  })

  test('should handle workflow comments and discussions', async ({ page }) => {
    await page.goto('/workflows/workflow-123')
    
    // Add comment
    await page.click('[data-testid="comments-panel-button"]')
    await page.fill('[data-testid="comment-input"]', 'This node needs optimization')
    await page.click('[data-testid="add-comment-button"]')
    
    // Verify comment added
    await expect(page.locator('[data-testid="comment-list"]')).toContainText('This node needs optimization')
    
    // Reply to comment
    await page.click('[data-testid="reply-button"]:first-child')
    await page.fill('[data-testid="reply-input"]', 'I agree, let me update it')
    await page.click('[data-testid="submit-reply-button"]')
    
    // Verify reply
    await expect(page.locator('[data-testid="comment-replies"]')).toContainText('I agree, let me update it')
  })
})

test.describe('Marketplace Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
  })

  test('should browse and search marketplace', async ({ page }) => {
    await page.goto('/marketplace')
    
    // Search for workflows
    await page.fill('[data-testid="search-input"]', 'data processing')
    await page.click('[data-testid="search-button"]')
    
    // Verify search results
    await expect(page.locator('[data-testid="workflow-results"]')).toBeVisible()
    await expect(page.locator('[data-testid="result-count"]')).toContainText('results found')
    
    // Filter by category
    await page.click('[data-testid="category-filter"]')
    await page.click('[data-testid="ai-category"]')
    
    // Verify filtered results
    await expect(page.locator('[data-testid="workflow-card"]')).toHaveCount(5)
  })

  test('should publish workflow to marketplace', async ({ page }) => {
    await page.goto('/workflows')
    await page.click('[data-testid="workflow-item"]:first-child')
    
    // Open publish dialog
    await page.click('[data-testid="publish-button"]')
    
    // Fill publication details
    await page.fill('[data-testid="marketplace-title"]', 'Advanced Data Processing Workflow')
    await page.fill('[data-testid="marketplace-description"]', 'A comprehensive workflow for data processing tasks')
    await page.click('[data-testid="category-selector"]')
    await page.click('[data-testid="data-processing-category"]')
    await page.fill('[data-testid="tags-input"]', 'data, processing, automation')
    
    // Set pricing
    await page.click('[data-testid="pricing-type"]')
    await page.click('[data-testid="free-option"]')
    
    // Publish workflow
    await page.click('[data-testid="publish-workflow-button"]')
    
    // Verify publication
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Workflow published successfully')
  })

  test('should install workflow from marketplace', async ({ page }) => {
    await page.goto('/marketplace')
    
    // Find and select workflow
    await page.click('[data-testid="workflow-card"]:first-child')
    
    // View workflow details
    await expect(page.locator('[data-testid="workflow-preview"]')).toBeVisible()
    await expect(page.locator('[data-testid="workflow-rating"]')).toBeVisible()
    
    // Install workflow
    await page.click('[data-testid="install-button"]')
    await page.click('[data-testid="confirm-install-button"]')
    
    // Verify installation
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Workflow installed successfully')
    
    // Navigate to workflows and verify
    await page.goto('/workflows')
    await expect(page.locator('[data-testid="workflow-list"]')).toContainText('Installed from marketplace')
  })
})

test.describe('Monitoring and Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
  })

  test('should view real-time execution monitoring', async ({ page }) => {
    await page.goto('/monitoring')
    
    // Verify dashboard components
    await expect(page.locator('[data-testid="active-executions"]')).toBeVisible()
    await expect(page.locator('[data-testid="system-metrics"]')).toBeVisible()
    await expect(page.locator('[data-testid="performance-charts"]')).toBeVisible()
    
    // Check real-time updates
    await page.waitForTimeout(2000) // Wait for WebSocket connection
    await expect(page.locator('[data-testid="live-indicator"]')).toHaveClass(/live/)
  })

  test('should generate and export analytics reports', async ({ page }) => {
    await page.goto('/analytics')
    
    // Configure report parameters
    await page.click('[data-testid="date-range-picker"]')
    await page.click('[data-testid="last-30-days"]')
    
    await page.click('[data-testid="report-type-selector"]')
    await page.click('[data-testid="execution-summary-report"]')
    
    // Generate report
    await page.click('[data-testid="generate-report-button"]')
    
    // Verify report generation
    await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()
    
    // Export report
    const downloadPromise = page.waitForEvent('download')
    await page.click('[data-testid="export-pdf-button"]')
    const download = await downloadPromise
    
    // Verify download
    expect(download.suggestedFilename()).toContain('execution-summary')
  })

  test('should configure and receive alerts', async ({ page }) => {
    await page.goto('/monitoring/alerts')
    
    // Create new alert
    await page.click('[data-testid="create-alert-button"]')
    
    // Configure alert conditions
    await page.fill('[data-testid="alert-name"]', 'High Failure Rate Alert')
    await page.click('[data-testid="metric-selector"]')
    await page.click('[data-testid="failure-rate-metric"]')
    await page.fill('[data-testid="threshold-value"]', '10')
    
    // Configure notifications
    await page.click('[data-testid="notification-channel"]')
    await page.click('[data-testid="email-channel"]')
    await page.fill('[data-testid="notification-email"]', 'alerts@example.com')
    
    // Save alert
    await page.click('[data-testid="save-alert-button"]')
    
    // Verify alert creation
    await expect(page.locator('[data-testid="alert-list"]')).toContainText('High Failure Rate Alert')
    await expect(page.locator('[data-testid="alert-status"]')).toContainText('Active')
  })
})

test.describe('API Integration Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
  })

  test('should manage API keys and authentication', async ({ page }) => {
    await page.goto('/settings/api')
    
    // Create new API key
    await page.click('[data-testid="create-api-key-button"]')
    await page.fill('[data-testid="api-key-name"]', 'Test Integration Key')
    await page.click('[data-testid="permission-selector"]')
    await page.click('[data-testid="read-write-permission"]')
    
    // Generate API key
    await page.click('[data-testid="generate-key-button"]')
    
    // Verify key creation
    await expect(page.locator('[data-testid="api-key-value"]')).toBeVisible()
    await expect(page.locator('[data-testid="copy-key-button"]')).toBeVisible()
    
    // Copy API key
    await page.click('[data-testid="copy-key-button"]')
    await expect(page.locator('[data-testid="copy-success"]')).toContainText('API key copied')
  })

  test('should configure webhook endpoints', async ({ page }) => {
    await page.goto('/settings/webhooks')
    
    // Add webhook endpoint
    await page.click('[data-testid="add-webhook-button"]')
    await page.fill('[data-testid="webhook-url"]', 'https://api.example.com/webhooks')
    await page.click('[data-testid="event-selector"]')
    await page.click('[data-testid="execution-completed-event"]')
    
    // Configure authentication
    await page.click('[data-testid="auth-type-selector"]')
    await page.click('[data-testid="bearer-token-auth"]')
    await page.fill('[data-testid="auth-token"]', 'webhook-secret-token')
    
    // Save webhook
    await page.click('[data-testid="save-webhook-button"]')
    
    // Test webhook
    await page.click('[data-testid="test-webhook-button"]')
    await expect(page.locator('[data-testid="webhook-test-result"]')).toContainText('Webhook test successful')
  })
})