import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly createWorkflowButton: Locator;
  readonly workflowList: Locator;
  readonly marketplaceLink: Locator;
  readonly searchInput: Locator;
  readonly filterButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createWorkflowButton = page.locator('[data-testid="create-workflow"]');
    this.workflowList = page.locator('[data-testid="workflow-list"]');
    this.marketplaceLink = page.locator('[data-testid="marketplace-link"]');
    this.searchInput = page.locator('[data-testid="workflow-search"]');
    this.filterButtons = page.locator('[data-testid^="filter-"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async clickCreateWorkflow() {
    await this.createWorkflowButton.click();
    await this.page.waitForURL('/workflows/create');
  }

  async getWorkflowList(): Promise<string[]> {
    await this.workflowList.waitFor();
    const workflows = await this.page.locator('[data-testid="workflow-item"]').all();
    return Promise.all(workflows.map(w => w.textContent() || ''));
  }

  async searchWorkflows(query: string) {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(1000); // Wait for search results
  }

  async filterByEngine(engine: 'langflow' | 'n8n' | 'langsmith') {
    await this.page.click(`[data-testid="filter-${engine}"]`);
    await this.page.waitForTimeout(500);
  }

  async openWorkflow(workflowName: string) {
    await this.page.click(`[data-testid="workflow-item"]:has-text("${workflowName}")`);
  }

  async openSharedWorkflow(workflowName: string) {
    await this.page.click('[data-testid="shared-workflows-tab"]');
    await this.openWorkflow(workflowName);
  }

  async navigateToMarketplace() {
    await this.marketplaceLink.click();
    await this.page.waitForURL('/marketplace');
  }

  async getExecutionHistory() {
    await this.page.click('[data-testid="executions-tab"]');
    const executions = await this.page.locator('[data-testid="execution-item"]').all();
    return Promise.all(executions.map(async (exec) => ({
      id: await exec.getAttribute('data-execution-id'),
      status: await exec.locator('[data-testid="execution-status"]').textContent(),
      workflow: await exec.locator('[data-testid="execution-workflow"]').textContent()
    })));
  }
}