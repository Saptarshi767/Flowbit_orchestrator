import { Page, Locator } from '@playwright/test';

export class ExecutionPage {
  readonly page: Page;
  readonly executionStatus: Locator;
  readonly executionLogs: Locator;
  readonly executionResult: Locator;
  readonly cancelButton: Locator;
  readonly retryButton: Locator;
  readonly downloadResultButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.executionStatus = page.locator('[data-testid="execution-status"]');
    this.executionLogs = page.locator('[data-testid="execution-logs"]');
    this.executionResult = page.locator('[data-testid="execution-result"]');
    this.cancelButton = page.locator('[data-testid="cancel-execution"]');
    this.retryButton = page.locator('[data-testid="retry-execution"]');
    this.downloadResultButton = page.locator('[data-testid="download-result"]');
  }

  async waitForExecution(timeout: number = 30000) {
    await this.page.waitForFunction(
      () => {
        const status = document.querySelector('[data-testid="execution-status"]')?.textContent;
        return status === 'completed' || status === 'failed' || status === 'cancelled';
      },
      { timeout }
    );
  }

  async getExecutionStatus(): Promise<string> {
    return await this.executionStatus.textContent() || '';
  }

  async getExecutionLogs(): Promise<string[]> {
    const logEntries = await this.executionLogs.locator('[data-testid="log-entry"]').all();
    return Promise.all(logEntries.map(entry => entry.textContent() || ''));
  }

  async getExecutionResult(): Promise<any> {
    const resultText = await this.executionResult.textContent();
    try {
      return JSON.parse(resultText || '{}');
    } catch {
      return { output: resultText };
    }
  }

  async cancelExecution() {
    await this.cancelButton.click();
    await this.page.waitForSelector('[data-testid="cancel-confirmation"]');
    await this.page.click('[data-testid="confirm-cancel"]');
  }

  async retryExecution() {
    await this.retryButton.click();
    await this.page.waitForSelector('[data-testid="retry-confirmation"]');
    await this.page.click('[data-testid="confirm-retry"]');
  }

  async downloadResult() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadResultButton.click();
    return await downloadPromise;
  }

  async getExecutionMetrics() {
    await this.page.click('[data-testid="metrics-tab"]');
    return {
      duration: await this.page.locator('[data-testid="execution-duration"]').textContent(),
      memoryUsage: await this.page.locator('[data-testid="memory-usage"]').textContent(),
      cpuUsage: await this.page.locator('[data-testid="cpu-usage"]').textContent()
    };
  }

  async getExecutionTimeline() {
    await this.page.click('[data-testid="timeline-tab"]');
    const timelineItems = await this.page.locator('[data-testid="timeline-item"]').all();
    return Promise.all(timelineItems.map(async (item) => ({
      timestamp: await item.locator('[data-testid="timeline-timestamp"]').textContent(),
      event: await item.locator('[data-testid="timeline-event"]').textContent(),
      details: await item.locator('[data-testid="timeline-details"]').textContent()
    })));
  }
}