import { test, expect } from '@playwright/test'

test.describe('Advanced UI Features', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
  })

  test.describe('Workflow Marketplace', () => {
    test('should display marketplace with search and filtering', async ({ page }) => {
      await page.goto('/marketplace')
      
      // Check if marketplace loads
      await expect(page.locator('h1')).toContainText('Workflow Marketplace')
      
      // Test search functionality
      await page.fill('[placeholder*="Search workflows"]', 'customer')
      await page.waitForTimeout(500)
      
      // Verify search results
      const workflowCards = page.locator('[data-testid="workflow-card"]')
      await expect(workflowCards).toHaveCount(1)
      await expect(workflowCards.first()).toContainText('Customer Support')
      
      // Test category filter
      await page.selectOption('[data-testid="category-filter"]', 'Marketing')
      await page.waitForTimeout(500)
      
      // Test engine filter
      await page.selectOption('[data-testid="engine-filter"]', 'langflow')
      await page.waitForTimeout(500)
      
      // Test price filter
      await page.selectOption('[data-testid="price-filter"]', 'free')
      await page.waitForTimeout(500)
      
      // Test sort functionality
      await page.selectOption('[data-testid="sort-filter"]', 'rating')
      await page.waitForTimeout(500)
      
      // Clear filters
      await page.click('[data-testid="clear-filters"]')
      await page.waitForTimeout(500)
      
      // Verify all workflows are shown again
      await expect(workflowCards).toHaveCountGreaterThan(1)
    })

    test('should handle workflow download and interaction', async ({ page }) => {
      await page.goto('/marketplace')
      
      const firstWorkflow = page.locator('[data-testid="workflow-card"]').first()
      
      // Test like functionality
      await firstWorkflow.locator('[data-testid="like-button"]').click()
      await expect(firstWorkflow.locator('[data-testid="like-count"]')).toContainText('90')
      
      // Test download functionality
      await firstWorkflow.locator('[data-testid="download-button"]').click()
      // Verify download modal or success message
      await expect(page.locator('[data-testid="download-modal"]')).toBeVisible()
      
      // Test view details
      await firstWorkflow.locator('[data-testid="view-button"]').click()
      await expect(page.locator('[data-testid="workflow-details"]')).toBeVisible()
    })

    test('should be mobile responsive', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
      await page.goto('/marketplace')
      
      // Check mobile layout
      await expect(page.locator('[data-testid="mobile-filters"]')).toBeVisible()
      
      // Test mobile search
      await page.fill('[placeholder*="Search workflows"]', 'automation')
      await page.waitForTimeout(500)
      
      // Verify mobile card layout
      const workflowCards = page.locator('[data-testid="workflow-card"]')
      await expect(workflowCards.first()).toBeVisible()
      
      // Test mobile filter drawer
      await page.click('[data-testid="mobile-filter-button"]')
      await expect(page.locator('[data-testid="filter-drawer"]')).toBeVisible()
    })
  })

  test.describe('Collaborative Editor', () => {
    test('should display collaborative editing interface', async ({ page }) => {
      await page.goto('/workflows/test-workflow/collaborate')
      
      // Check if collaborative editor loads
      await expect(page.locator('h2')).toContainText('Collaborative Editor')
      
      // Verify collaborators are shown
      await expect(page.locator('[data-testid="collaborator-avatars"]')).toBeVisible()
      await expect(page.locator('[data-testid="collaborator-count"]')).toContainText('editing')
      
      // Test editor functionality
      const editor = page.locator('[data-testid="workflow-editor"]')
      await editor.fill('# Updated Workflow\n\nThis is a test update')
      
      // Verify unsaved changes indicator
      await expect(page.locator('[data-testid="save-button"]')).toContainText('Save')
      
      // Test save functionality
      await page.click('[data-testid="save-button"]')
      await expect(page.locator('[data-testid="save-button"]')).toContainText('Saved')
    })

    test('should handle comments and collaboration features', async ({ page }) => {
      await page.goto('/workflows/test-workflow/collaborate')
      
      // Test comment functionality
      await page.click('[data-testid="comments-toggle"]')
      await expect(page.locator('[data-testid="comments-panel"]')).toBeVisible()
      
      // Add a new comment
      await page.fill('[data-testid="new-comment"]', 'This needs review')
      await page.click('[data-testid="add-comment-button"]')
      
      // Verify comment appears
      await expect(page.locator('[data-testid="comment-list"]')).toContainText('This needs review')
      
      // Test comment resolution
      await page.click('[data-testid="resolve-comment-button"]')
      await expect(page.locator('[data-testid="resolved-comments"]')).toContainText('This needs review')
      
      // Test version history
      await page.click('[data-testid="history-toggle"]')
      await expect(page.locator('[data-testid="version-history"]')).toBeVisible()
      
      // Test version restoration
      const firstVersion = page.locator('[data-testid="version-item"]').first()
      await firstVersion.locator('[data-testid="restore-button"]').click()
      await expect(page.locator('[data-testid="restore-modal"]')).toBeVisible()
    })

    test('should handle real-time collaboration', async ({ page, context }) => {
      // Open two tabs to simulate collaboration
      const page2 = await context.newPage()
      
      await page.goto('/workflows/test-workflow/collaborate')
      await page2.goto('/workflows/test-workflow/collaborate')
      
      // Verify both pages show collaborators
      await expect(page.locator('[data-testid="collaborator-count"]')).toContainText('2 editing')
      await expect(page2.locator('[data-testid="collaborator-count"]')).toContainText('2 editing')
      
      // Test cursor synchronization (mock)
      await page.locator('[data-testid="workflow-editor"]').click()
      await page.waitForTimeout(1000)
      
      // Verify collaborative cursors are visible
      await expect(page2.locator('[data-testid="collaborator-cursor"]')).toBeVisible()
    })
  })

  test.describe('Monitoring Dashboard', () => {
    test('should display monitoring dashboard with widgets', async ({ page }) => {
      await page.goto('/monitoring')
      
      // Check if monitoring dashboard loads
      await expect(page.locator('h1')).toContainText('Monitoring Dashboard')
      
      // Verify default widgets are present
      await expect(page.locator('[data-testid="metrics-widget"]')).toBeVisible()
      await expect(page.locator('[data-testid="chart-widget"]')).toBeVisible()
      await expect(page.locator('[data-testid="alerts-widget"]')).toBeVisible()
      
      // Test time range filter
      await page.selectOption('[data-testid="time-range"]', '1h')
      await page.waitForTimeout(500)
      
      // Test refresh functionality
      await page.click('[data-testid="refresh-button"]')
      await page.waitForTimeout(500)
      
      // Verify last updated time changes
      await expect(page.locator('[data-testid="last-updated"]')).toBeVisible()
    })

    test('should handle widget customization', async ({ page }) => {
      await page.goto('/monitoring')
      
      // Enter customization mode
      await page.click('[data-testid="customize-button"]')
      await expect(page.locator('[data-testid="add-widget-button"]')).toBeVisible()
      
      // Add a new widget
      await page.click('[data-testid="add-widget-button"]')
      await expect(page.locator('[data-testid="widget-selector"]')).toBeVisible()
      
      // Select widget type
      await page.click('[data-testid="metric-widget-option"]')
      
      // Verify new widget is added
      const widgets = page.locator('[data-testid="dashboard-widget"]')
      await expect(widgets).toHaveCountGreaterThan(4)
      
      // Test widget expansion
      await widgets.first().locator('[data-testid="expand-widget"]').click()
      await expect(widgets.first()).toHaveClass(/col-span-2/)
      
      // Test widget removal
      await widgets.last().locator('[data-testid="remove-widget"]').click()
      await page.waitForTimeout(500)
    })

    test('should display real-time metrics and alerts', async ({ page }) => {
      await page.goto('/monitoring')
      
      // Verify metrics are displayed
      await expect(page.locator('[data-testid="active-workflows-metric"]')).toBeVisible()
      await expect(page.locator('[data-testid="executions-today-metric"]')).toBeVisible()
      await expect(page.locator('[data-testid="success-rate-metric"]')).toBeVisible()
      
      // Test alert handling
      const alertsWidget = page.locator('[data-testid="alerts-widget"]')
      await expect(alertsWidget.locator('[data-testid="alert-item"]')).toHaveCountGreaterThan(0)
      
      // Test alert severity badges
      await expect(alertsWidget.locator('[data-testid="high-severity"]')).toBeVisible()
      await expect(alertsWidget.locator('[data-testid="medium-severity"]')).toBeVisible()
      
      // Test system status
      await expect(page.locator('[data-testid="system-status"]')).toBeVisible()
      await expect(page.locator('[data-testid="api-gateway-status"]')).toContainText('Healthy')
    })
  })

  test.describe('Execution Visualizer', () => {
    test('should display execution visualization', async ({ page }) => {
      await page.goto('/executions/test-execution/visualize')
      
      // Check if execution visualizer loads
      await expect(page.locator('h2')).toContainText('Execution Visualization')
      
      // Verify execution stats
      await expect(page.locator('[data-testid="execution-progress"]')).toBeVisible()
      await expect(page.locator('[data-testid="execution-duration"]')).toBeVisible()
      await expect(page.locator('[data-testid="total-nodes"]')).toBeVisible()
      
      // Verify workflow canvas
      await expect(page.locator('[data-testid="workflow-canvas"]')).toBeVisible()
      
      // Test node interaction
      const firstNode = page.locator('[data-testid="workflow-node"]').first()
      await firstNode.click()
      
      // Verify node details panel
      await expect(page.locator('[data-testid="node-details"]')).toBeVisible()
      await expect(page.locator('[data-testid="node-info-tab"]')).toBeVisible()
      await expect(page.locator('[data-testid="node-data-tab"]')).toBeVisible()
      await expect(page.locator('[data-testid="node-logs-tab"]')).toBeVisible()
    })

    test('should handle playback controls for completed executions', async ({ page }) => {
      await page.goto('/executions/completed-execution/visualize')
      
      // Verify playback controls are visible
      await expect(page.locator('[data-testid="playback-controls"]')).toBeVisible()
      
      // Test play/pause
      await page.click('[data-testid="play-button"]')
      await expect(page.locator('[data-testid="pause-button"]')).toBeVisible()
      
      // Test reset
      await page.click('[data-testid="reset-button"]')
      await expect(page.locator('[data-testid="play-button"]')).toBeVisible()
      
      // Test speed control
      await page.locator('[data-testid="speed-slider"]').fill('2')
      await page.waitForTimeout(500)
      
      // Test step slider
      await page.locator('[data-testid="step-slider"]').fill('5')
      await page.waitForTimeout(500)
    })

    test('should show live execution updates', async ({ page }) => {
      await page.goto('/executions/live-execution/visualize')
      
      // Verify live badge
      await expect(page.locator('[data-testid="live-badge"]')).toContainText('Live')
      
      // Verify running node animation
      await expect(page.locator('[data-testid="running-node"]')).toHaveClass(/animate-pulse/)
      
      // Test data flow visualization
      await page.click('[data-testid="data-flow-toggle"]')
      await expect(page.locator('[data-testid="data-flow-animation"]')).toBeVisible()
      
      // Verify progress updates
      const progressBar = page.locator('[data-testid="execution-progress-bar"]')
      await expect(progressBar).toBeVisible()
    })
  })

  test.describe('Mobile Responsiveness', () => {
    test('should be responsive on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }) // iPad
      
      // Test marketplace on tablet
      await page.goto('/marketplace')
      await expect(page.locator('[data-testid="workflow-grid"]')).toHaveClass(/md:grid-cols-2/)
      
      // Test monitoring dashboard on tablet
      await page.goto('/monitoring')
      await expect(page.locator('[data-testid="dashboard-grid"]')).toBeVisible()
      
      // Test collaborative editor on tablet
      await page.goto('/workflows/test-workflow/collaborate')
      await expect(page.locator('[data-testid="editor-toolbar"]')).toBeVisible()
    })

    test('should be responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
      
      // Test marketplace mobile layout
      await page.goto('/marketplace')
      await expect(page.locator('[data-testid="mobile-search"]')).toBeVisible()
      await expect(page.locator('[data-testid="mobile-filters"]')).toBeVisible()
      
      // Test monitoring dashboard mobile layout
      await page.goto('/monitoring')
      await expect(page.locator('[data-testid="mobile-dashboard"]')).toBeVisible()
      
      // Test execution visualizer mobile layout
      await page.goto('/executions/test-execution/visualize')
      await expect(page.locator('[data-testid="mobile-canvas"]')).toBeVisible()
      
      // Test collaborative editor mobile layout
      await page.goto('/workflows/test-workflow/collaborate')
      await expect(page.locator('[data-testid="mobile-editor"]')).toBeVisible()
    })
  })

  test.describe('Performance and Accessibility', () => {
    test('should meet performance benchmarks', async ({ page }) => {
      // Test marketplace performance
      const marketplaceStart = Date.now()
      await page.goto('/marketplace')
      await page.waitForLoadState('networkidle')
      const marketplaceLoad = Date.now() - marketplaceStart
      expect(marketplaceLoad).toBeLessThan(3000) // Should load within 3 seconds
      
      // Test monitoring dashboard performance
      const monitoringStart = Date.now()
      await page.goto('/monitoring')
      await page.waitForLoadState('networkidle')
      const monitoringLoad = Date.now() - monitoringStart
      expect(monitoringLoad).toBeLessThan(3000)
    })

    test('should be accessible', async ({ page }) => {
      await page.goto('/marketplace')
      
      // Test keyboard navigation
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')
      
      // Test ARIA labels
      await expect(page.locator('[aria-label]')).toHaveCountGreaterThan(0)
      
      // Test focus management
      const searchInput = page.locator('[placeholder*="Search workflows"]')
      await searchInput.focus()
      await expect(searchInput).toBeFocused()
      
      // Test color contrast (basic check)
      const buttons = page.locator('button')
      await expect(buttons.first()).toBeVisible()
    })
  })
})