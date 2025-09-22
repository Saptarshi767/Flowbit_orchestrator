import { test, expect, Page } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { DashboardPage } from './pages/dashboard.page';
import { WorkflowEditorPage } from './pages/workflow-editor.page';
import { ExecutionPage } from './pages/execution.page';

test.describe('Complete User Workflows', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let workflowEditorPage: WorkflowEditorPage;
  let executionPage: ExecutionPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    workflowEditorPage = new WorkflowEditorPage(page);
    executionPage = new ExecutionPage(page);
  });

  test('User can create, execute, and monitor Langflow workflow', async ({ page }) => {
    // Login
    await loginPage.goto();
    await loginPage.loginWithCredentials('test@example.com', 'password123');
    await expect(page).toHaveURL('/dashboard');

    // Navigate to workflow creation
    await dashboardPage.clickCreateWorkflow();
    await workflowEditorPage.selectEngine('langflow');
    
    // Create workflow
    const workflowName = `Test Langflow Workflow ${Date.now()}`;
    await workflowEditorPage.setWorkflowName(workflowName);
    await workflowEditorPage.addLangflowComponent('TextInput');
    await workflowEditorPage.addLangflowComponent('LLMChain');
    await workflowEditorPage.connectComponents('TextInput', 'LLMChain');
    await workflowEditorPage.saveWorkflow();

    // Execute workflow
    await workflowEditorPage.executeWorkflow({
      input_text: 'Hello, world!'
    });

    // Monitor execution
    await executionPage.waitForExecution();
    const status = await executionPage.getExecutionStatus();
    expect(status).toBe('completed');

    // Verify results
    const result = await executionPage.getExecutionResult();
    expect(result).toBeDefined();
    expect(result.output).toContain('Hello');
  });

  test('User can create and execute N8N workflow', async ({ page }) => {
    await loginPage.goto();
    await loginPage.loginWithCredentials('test@example.com', 'password123');

    await dashboardPage.clickCreateWorkflow();
    await workflowEditorPage.selectEngine('n8n');
    
    const workflowName = `Test N8N Workflow ${Date.now()}`;
    await workflowEditorPage.setWorkflowName(workflowName);
    await workflowEditorPage.addN8NNode('Manual Trigger');
    await workflowEditorPage.addN8NNode('HTTP Request');
    await workflowEditorPage.connectNodes('Manual Trigger', 'HTTP Request');
    await workflowEditorPage.saveWorkflow();

    await workflowEditorPage.executeWorkflow({
      url: 'https://api.github.com/users/octocat'
    });

    await executionPage.waitForExecution();
    const status = await executionPage.getExecutionStatus();
    expect(status).toBe('completed');
  });

  test('User can collaborate on workflow with team members', async ({ page, context }) => {
    // Login as first user
    await loginPage.goto();
    await loginPage.loginWithCredentials('user1@example.com', 'password123');

    // Create workflow
    await dashboardPage.clickCreateWorkflow();
    const workflowName = `Collaborative Workflow ${Date.now()}`;
    await workflowEditorPage.setWorkflowName(workflowName);
    await workflowEditorPage.shareWorkflow(['user2@example.com']);

    // Open second browser context for second user
    const secondPage = await context.newPage();
    const secondLoginPage = new LoginPage(secondPage);
    const secondDashboardPage = new DashboardPage(secondPage);
    const secondWorkflowEditorPage = new WorkflowEditorPage(secondPage);

    await secondLoginPage.goto();
    await secondLoginPage.loginWithCredentials('user2@example.com', 'password123');
    
    // Second user accesses shared workflow
    await secondDashboardPage.openSharedWorkflow(workflowName);
    await secondWorkflowEditorPage.addComment('This looks great!');
    
    // First user sees the comment
    await workflowEditorPage.refreshComments();
    const comments = await workflowEditorPage.getComments();
    expect(comments).toContain('This looks great!');
  });

  test('User can discover and use marketplace workflows', async ({ page }) => {
    await loginPage.goto();
    await loginPage.loginWithCredentials('test@example.com', 'password123');

    await dashboardPage.navigateToMarketplace();
    await page.waitForSelector('[data-testid="marketplace-workflows"]');

    // Search for workflow
    await page.fill('[data-testid="search-input"]', 'data processing');
    await page.click('[data-testid="search-button"]');

    // Select and import workflow
    await page.click('[data-testid="workflow-card"]:first-child');
    await page.click('[data-testid="import-workflow"]');

    // Verify workflow imported
    await dashboardPage.goto();
    const workflows = await dashboardPage.getWorkflowList();
    expect(workflows.length).toBeGreaterThan(0);
  });
});