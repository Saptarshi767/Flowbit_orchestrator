import { Page, Locator } from '@playwright/test';

export class WorkflowEditorPage {
  readonly page: Page;
  readonly engineSelector: Locator;
  readonly workflowNameInput: Locator;
  readonly saveButton: Locator;
  readonly executeButton: Locator;
  readonly componentPalette: Locator;
  readonly canvas: Locator;
  readonly shareButton: Locator;
  readonly commentsPanel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.engineSelector = page.locator('[data-testid="engine-selector"]');
    this.workflowNameInput = page.locator('[data-testid="workflow-name"]');
    this.saveButton = page.locator('[data-testid="save-workflow"]');
    this.executeButton = page.locator('[data-testid="execute-workflow"]');
    this.componentPalette = page.locator('[data-testid="component-palette"]');
    this.canvas = page.locator('[data-testid="workflow-canvas"]');
    this.shareButton = page.locator('[data-testid="share-workflow"]');
    this.commentsPanel = page.locator('[data-testid="comments-panel"]');
  }

  async selectEngine(engine: 'langflow' | 'n8n' | 'langsmith') {
    await this.engineSelector.selectOption(engine);
    await this.page.waitForTimeout(500);
  }

  async setWorkflowName(name: string) {
    await this.workflowNameInput.fill(name);
  }

  async addLangflowComponent(componentType: string) {
    await this.page.click(`[data-testid="langflow-component-${componentType}"]`);
    await this.canvas.click({ position: { x: 200, y: 200 } });
  }

  async addN8NNode(nodeType: string) {
    await this.page.click(`[data-testid="n8n-node-${nodeType.replace(' ', '-')}"]`);
    await this.canvas.click({ position: { x: 200, y: 200 } });
  }

  async addLangSmithChain(chainType: string) {
    await this.page.click(`[data-testid="langsmith-chain-${chainType}"]`);
    await this.canvas.click({ position: { x: 200, y: 200 } });
  }

  async connectComponents(source: string, target: string) {
    const sourceElement = this.page.locator(`[data-component="${source}"] [data-testid="output-port"]`);
    const targetElement = this.page.locator(`[data-component="${target}"] [data-testid="input-port"]`);
    
    await sourceElement.hover();
    await this.page.mouse.down();
    await targetElement.hover();
    await this.page.mouse.up();
  }

  async connectNodes(source: string, target: string) {
    return this.connectComponents(source, target);
  }

  async saveWorkflow() {
    await this.saveButton.click();
    await this.page.waitForSelector('[data-testid="save-success"]');
  }

  async executeWorkflow(parameters: Record<string, any> = {}) {
    await this.executeButton.click();
    
    // Fill in parameters if provided
    for (const [key, value] of Object.entries(parameters)) {
      await this.page.fill(`[data-testid="param-${key}"]`, String(value));
    }
    
    await this.page.click('[data-testid="confirm-execute"]');
  }

  async shareWorkflow(emails: string[]) {
    await this.shareButton.click();
    
    for (const email of emails) {
      await this.page.fill('[data-testid="share-email"]', email);
      await this.page.click('[data-testid="add-collaborator"]');
    }
    
    await this.page.click('[data-testid="confirm-share"]');
  }

  async addComment(text: string) {
    await this.page.click('[data-testid="add-comment"]');
    await this.page.fill('[data-testid="comment-text"]', text);
    await this.page.click('[data-testid="submit-comment"]');
  }

  async refreshComments() {
    await this.page.click('[data-testid="refresh-comments"]');
    await this.page.waitForTimeout(500);
  }

  async getComments(): Promise<string[]> {
    const comments = await this.page.locator('[data-testid="comment-item"]').all();
    return Promise.all(comments.map(c => c.textContent() || ''));
  }

  async getWorkflowValidation() {
    await this.page.click('[data-testid="validate-workflow"]');
    await this.page.waitForSelector('[data-testid="validation-result"]');
    return await this.page.locator('[data-testid="validation-result"]').textContent();
  }
}