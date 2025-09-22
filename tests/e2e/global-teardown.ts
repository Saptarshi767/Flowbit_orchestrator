import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...');
  
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';
  
  // Launch browser for teardown
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Login as admin to clean up test data
    console.log('🔐 Logging in as admin for cleanup...');
    const loginResponse = await page.request.post(`${baseURL}/api/auth/login`, {
      data: {
        email: 'admin@example.com',
        password: 'admin123'
      }
    });
    
    if (loginResponse.ok()) {
      const { token } = await loginResponse.json();
      
      // Clean up test workflows
      console.log('🗑️ Cleaning up test workflows...');
      await cleanupTestWorkflows(page, baseURL, token);
      
      // Clean up test executions
      console.log('🗑️ Cleaning up test executions...');
      await cleanupTestExecutions(page, baseURL, token);
      
      // Note: We don't clean up test users as they might be needed for other tests
      // In a real scenario, you might want to clean them up or use a separate test database
    }
    
    console.log('✅ Global teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  } finally {
    await browser.close();
  }
}

async function cleanupTestWorkflows(page: any, baseURL: string, token: string) {
  try {
    // Get all workflows
    const response = await page.request.get(`${baseURL}/api/workflows`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok()) {
      const workflows = await response.json();
      
      // Delete test workflows (those with "Test" in the name)
      for (const workflow of workflows) {
        if (workflow.name.includes('Test') || workflow.name.includes('Load Test')) {
          try {
            await page.request.delete(`${baseURL}/api/workflows/${workflow.id}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            console.log(`✓ Deleted test workflow: ${workflow.name}`);
          } catch (error) {
            console.log(`⚠️ Failed to delete workflow ${workflow.name}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.log('⚠️ Failed to cleanup workflows:', error);
  }
}

async function cleanupTestExecutions(page: any, baseURL: string, token: string) {
  try {
    // Get all executions
    const response = await page.request.get(`${baseURL}/api/executions?limit=1000`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok()) {
      const executions = await response.json();
      
      // Delete test executions (those from test workflows or older than 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      for (const execution of executions) {
        const executionDate = new Date(execution.createdAt);
        const isTestExecution = execution.workflowName?.includes('Test') || 
                               execution.workflowName?.includes('Load Test');
        const isOldExecution = executionDate < oneHourAgo;
        
        if (isTestExecution || isOldExecution) {
          try {
            await page.request.delete(`${baseURL}/api/executions/${execution.id}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            console.log(`✓ Deleted test execution: ${execution.id}`);
          } catch (error) {
            console.log(`⚠️ Failed to delete execution ${execution.id}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.log('⚠️ Failed to cleanup executions:', error);
  }
}

export default globalTeardown;