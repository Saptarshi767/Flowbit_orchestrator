import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const throughput = new Counter('throughput');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],    // Error rate under 5%
    error_rate: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const testWorkflow = {
  name: 'Performance Test Workflow',
  engineType: 'langflow',
  definition: {
    nodes: [
      { id: 'input', type: 'input', data: { value: 'test' } },
      { id: 'process', type: 'llm', data: { model: 'gpt-3.5-turbo' } },
      { id: 'output', type: 'output', data: {} }
    ],
    edges: [
      { source: 'input', target: 'process' },
      { source: 'process', target: 'output' }
    ]
  }
};

let authToken = '';

export function setup() {
  // Login and get auth token
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'testpassword123'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  if (loginResponse.status === 200) {
    const body = JSON.parse(loginResponse.body);
    return { token: body.token };
  }
  
  throw new Error('Failed to authenticate');
}

export default function(data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`
  };

  // Test workflow creation
  testWorkflowCreation(headers);
  
  // Test workflow listing
  testWorkflowListing(headers);
  
  // Test workflow execution
  testWorkflowExecution(headers);
  
  // Test monitoring endpoints
  testMonitoringEndpoints(headers);
  
  sleep(1);
}

function testWorkflowCreation(headers) {
  const response = http.post(
    `${BASE_URL}/api/workflows`,
    JSON.stringify(testWorkflow),
    { headers }
  );

  const success = check(response, {
    'workflow creation status is 201': (r) => r.status === 201,
    'workflow creation response time < 1s': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
  throughput.add(1);

  return response.status === 201 ? JSON.parse(response.body).id : null;
}

function testWorkflowListing(headers) {
  const response = http.get(`${BASE_URL}/api/workflows`, { headers });

  const success = check(response, {
    'workflow listing status is 200': (r) => r.status === 200,
    'workflow listing response time < 500ms': (r) => r.timings.duration < 500,
    'workflow listing returns array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
  throughput.add(1);
}

function testWorkflowExecution(headers) {
  // First create a workflow
  const workflowId = testWorkflowCreation(headers);
  
  if (!workflowId) return;

  const response = http.post(
    `${BASE_URL}/api/workflows/${workflowId}/execute`,
    JSON.stringify({ parameters: { input: 'performance test data' } }),
    { headers }
  );

  const success = check(response, {
    'workflow execution status is 200': (r) => r.status === 200,
    'workflow execution response time < 2s': (r) => r.timings.duration < 2000,
    'execution returns execution id': (r) => JSON.parse(r.body).executionId,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
  throughput.add(1);
}

function testMonitoringEndpoints(headers) {
  const endpoints = [
    '/api/health',
    '/api/metrics',
    '/api/executions/stats'
  ];

  endpoints.forEach(endpoint => {
    const response = http.get(`${BASE_URL}${endpoint}`, { headers });

    const success = check(response, {
      [`${endpoint} status is 200`]: (r) => r.status === 200,
      [`${endpoint} response time < 200ms`]: (r) => r.timings.duration < 200,
    });

    errorRate.add(!success);
    responseTime.add(response.timings.duration);
    throughput.add(1);
  });
}

export function teardown(data) {
  // Cleanup test data if needed
  console.log('Performance test completed');
}