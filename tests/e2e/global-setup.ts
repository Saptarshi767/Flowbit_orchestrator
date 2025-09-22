import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global E2E test setup...');
  
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';
  
  // Launch browser for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for application to be ready
    console.log('⏳ Waiting for application to be ready...');
    await page.goto(`${baseURL}/health`, { waitUntil: 'networkidle' });
    
    // Setup test users and data
    console.log('👥 Setting up test users...');
    await setupTestUsers(page, baseURL);
    
    // Setup test workflows
    console.log('🔧 Setting up test workflows...');
    await setupTestWorkflows(page, baseURL);
    
    console.log('✅ Global setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function setupTestUsers(page: any, baseURL: string) {
  // Create test users via API
  const testUsers = [
    {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      role: 'user'
    },
    {
      email: 'admin@example.com',
      password: 'admin123',
      name: 'Admin User',
      role: 'admin'
    },
    {
      email: 'user1@example.com',
      password: 'password123',
      name: 'User One',
      role: 'user'
    },
    {
      email: 'user2@example.com',
      password: 'password123',
      name: 'User Two',
      role: 'user'
    }
  ];
  
  for (const user of testUsers) {
    try {
      const response = await page.request.post(`${baseURL}/api/auth/register`, {
        data: user
      });
      
      if (response.ok()) {
        console.log(`✓ Created test user: ${user.email}`);
      } else {
        console.log(`⚠️ User ${user.email} may already exist`);
      }
    } catch (error) {
      console.log(`⚠️ Failed to create user ${user.email}:`, error);
    }
  }
}

async function setupTestWorkflows(page: any, baseURL: string) {
  // Login as admin to create test workflows
  const loginResponse = await page.request.post(`${baseURL}/api/auth/login`, {
    data: {
      email: 'admin@example.com',
      password: 'admin123'
    }
  });
  
  if (!loginResponse.ok()) {
    console.log('⚠️ Could not login as admin for workflow setup');
    return;
  }
  
  const { token } = await loginResponse.json();
  
  const testWorkflows = [
    {
      name: 'Test Langflow Workflow',
      engine: 'langflow',
      definition: {
        nodes: [
          { id: 'input', type: 'TextInput', data: { value: 'Hello World' } },
          { id: 'llm', type: 'LLMChain', data: { model: 'gpt-3.5-turbo' } }
        ],
        edges: [{ source: 'input', target: 'llm' }]
      },
      isPublic: true
    },
    {
      name: 'Test N8N Workflow',
      engine: 'n8n',
      definition: {
        nodes: [
          { id: 'trigger', type: 'Manual Trigger' },
          { id: 'http', type: 'HTTP Request', data: { url: 'https://api.github.com/users/octocat' } }
        ],
        connections: { 'Manual Trigger': { main: [['HTTP Request']] } }
      },
      isPublic: true
    }
  ];
  
  for (const workflow of testWorkflows) {
    try {
      const response = await page.request.post(`${baseURL}/api/workflows`, {
        data: workflow,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok()) {
        console.log(`✓ Created test workflow: ${workflow.name}`);
      }
    } catch (error) {
      console.log(`⚠️ Failed to create workflow ${workflow.name}:`, error);
    }
  }
}

export default globalSetup;