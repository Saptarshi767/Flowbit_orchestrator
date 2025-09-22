import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const workflowExecutions = new Counter('workflow_executions');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '10m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '10m', target: 100 }, // Stay at 100 users
    { duration: '5m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.05'], // Error rate must be below 5%
    errors: ['rate<0.1'], // Custom error rate must be below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_TOKEN = __ENV.API_TOKEN || 'test-token';

// Test data
const testWorkflows = {
  langflow: {
    name: 'Load Test Langflow Workflow',
    engine: 'langflow',
    definition: {
      nodes: [
        { id: 'input', type: 'TextInput', data: { value: 'Hello World' } },
        { id: 'llm', type: 'LLMChain', data: { model: 'gpt-3.5-turbo' } }
      ],
      edges: [{ source: 'input', target: 'llm' }]
    }
  },
  n8n: {
    name: 'Load Test N8N Workflow',
    engine: 'n8n',
    definition: {
      nodes: [
        { id: 'trigger', type: 'Manual Trigger' },
        { id: 'http', type: 'HTTP Request', data: { url: 'https://api.github.com/users/octocat' } }
      ],
      connections: { 'Manual Trigger': { main: [['HTTP Request']] } }
    }
  }
};

export function setup() {
  // Authenticate and get token
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'loadtest@example.com',
    password: 'loadtest123'
  });
  
  check(loginResponse, {
    'login successful': (r) => r.status === 200,
  });
  
  const token = loginResponse.json('token');
  
  // Create test workflows
  const headers = { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  const createdWorkflows = {};
  
  for (const [key, workflow] of Object.entries(testWorkflows)) {
    const response = http.post(
      `${BASE_URL}/api/workflows`,
      JSON.stringify(workflow),
      { headers }
    );
    
    if (response.status === 201) {
      createdWorkflows[key] = response.json('id');
    }
  }
  
  return { token, workflows: createdWorkflows };
}

export default function(data) {
  const headers = { 
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json'
  };

  // Simulate realistic user behavior
  const userScenario = Math.random();
  
  if (userScenario < 0.4) {
    // 40% - Browse workflows
    browseWorkflows(headers);
  } else if (userScenario < 0.7) {
    // 30% - Execute existing workflow
    executeWorkflow(headers, data.workflows);
  } else if (userScenario < 0.9) {
    // 20% - Create new workflow
    createWorkflow(headers);
  } else {
    // 10% - Monitor executions
    monitorExecutions(headers);
  }
  
  sleep(Math.random() * 3 + 1); // Random sleep between 1-4 seconds
}

function browseWorkflows(headers) {
  // Get workflow list
  const listResponse = http.get(`${BASE_URL}/api/workflows`, { headers });
  const listSuccess = check(listResponse, {
    'workflow list loaded': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  errorRate.add(!listSuccess);
  responseTime.add(listResponse.timings.duration);
  
  if (listSuccess && listResponse.json().length > 0) {
    // Get details of first workflow
    const workflows = listResponse.json();
    const workflowId = workflows[0].id;
    
    const detailResponse = http.get(`${BASE_URL}/api/workflows/${workflowId}`, { headers });
    check(detailResponse, {
      'workflow details loaded': (r) => r.status === 200,
    });
  }
  
  // Search workflows
  const searchResponse = http.get(`${BASE_URL}/api/workflows?search=test`, { headers });
  check(searchResponse, {
    'search results loaded': (r) => r.status === 200,
  });
}

function executeWorkflow(headers, workflows) {
  const workflowTypes = Object.keys(workflows);
  const randomType = workflowTypes[Math.floor(Math.random() * workflowTypes.length)];
  const workflowId = workflows[randomType];
  
  if (!workflowId) return;
  
  // Execute workflow
  const executeResponse = http.post(
    `${BASE_URL}/api/workflows/${workflowId}/execute`,
    JSON.stringify({
      parameters: {
        input_text: `Load test execution ${Date.now()}`
      }
    }),
    { headers }
  );
  
  const executeSuccess = check(executeResponse, {
    'workflow execution started': (r) => r.status === 202,
    'execution response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  errorRate.add(!executeSuccess);
  responseTime.add(executeResponse.timings.duration);
  
  if (executeSuccess) {
    workflowExecutions.add(1);
    const executionId = executeResponse.json('executionId');
    
    // Poll execution status
    let attempts = 0;
    let completed = false;
    
    while (attempts < 10 && !completed) {
      sleep(2);
      const statusResponse = http.get(
        `${BASE_URL}/api/executions/${executionId}`,
        { headers }
      );
      
      if (statusResponse.status === 200) {
        const status = statusResponse.json('status');
        completed = ['completed', 'failed', 'cancelled'].includes(status);
      }
      attempts++;
    }
  }
}

function createWorkflow(headers) {
  const engines = ['langflow', 'n8n', 'langsmith'];
  const randomEngine = engines[Math.floor(Math.random() * engines.length)];
  
  const newWorkflow = {
    name: `Load Test Workflow ${Date.now()}`,
    engine: randomEngine,
    definition: testWorkflows[randomEngine]?.definition || {}
  };
  
  const createResponse = http.post(
    `${BASE_URL}/api/workflows`,
    JSON.stringify(newWorkflow),
    { headers }
  );
  
  const createSuccess = check(createResponse, {
    'workflow created': (r) => r.status === 201,
    'create response time < 3s': (r) => r.timings.duration < 3000,
  });
  
  errorRate.add(!createSuccess);
  responseTime.add(createResponse.timings.duration);
}

function monitorExecutions(headers) {
  // Get execution history
  const historyResponse = http.get(`${BASE_URL}/api/executions`, { headers });
  check(historyResponse, {
    'execution history loaded': (r) => r.status === 200,
  });
  
  // Get system metrics
  const metricsResponse = http.get(`${BASE_URL}/api/monitoring/metrics`, { headers });
  check(metricsResponse, {
    'system metrics loaded': (r) => r.status === 200,
  });
  
  // Get dashboard data
  const dashboardResponse = http.get(`${BASE_URL}/api/dashboard/summary`, { headers });
  check(dashboardResponse, {
    'dashboard data loaded': (r) => r.status === 200,
  });
}

export function teardown(data) {
  // Cleanup created workflows
  const headers = { 
    'Authorization': `Bearer ${data.token}`,
  };
  
  for (const workflowId of Object.values(data.workflows)) {
    http.del(`${BASE_URL}/api/workflows/${workflowId}`, { headers });
  }
}