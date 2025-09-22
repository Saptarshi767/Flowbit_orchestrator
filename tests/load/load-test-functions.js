module.exports = {
  authenticate,
  createTestWorkflow,
  generateWorkflowDefinition,
  validateResponse
};

async function authenticate(context, events, done) {
  const response = await fetch(`${context.vars.target}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'loadtest@example.com',
      password: 'loadtest123'
    })
  });
  
  if (response.ok) {
    const data = await response.json();
    context.vars.authToken = data.token;
  }
  
  return done();
}

async function createTestWorkflow(context, events, done) {
  const workflowDefinition = generateWorkflowDefinition(context.vars.$randomPick(['langflow', 'n8n', 'langsmith']));
  
  const response = await fetch(`${context.vars.target}/api/workflows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${context.vars.authToken}`
    },
    body: JSON.stringify({
      name: `Load Test Workflow ${Date.now()}`,
      engine: workflowDefinition.engine,
      definition: workflowDefinition.definition
    })
  });
  
  if (response.ok) {
    const data = await response.json();
    context.vars.workflowId = data.id;
  }
  
  return done();
}

function generateWorkflowDefinition(engine) {
  const definitions = {
    langflow: {
      engine: 'langflow',
      definition: {
        nodes: [
          {
            id: 'input_node',
            type: 'TextInput',
            data: { value: 'Load test input' },
            position: { x: 100, y: 100 }
          },
          {
            id: 'llm_node',
            type: 'LLMChain',
            data: { 
              model: 'gpt-3.5-turbo',
              temperature: 0.7,
              max_tokens: 150
            },
            position: { x: 300, y: 100 }
          }
        ],
        edges: [
          {
            id: 'edge_1',
            source: 'input_node',
            target: 'llm_node',
            sourceHandle: 'output',
            targetHandle: 'input'
          }
        ]
      }
    },
    
    n8n: {
      engine: 'n8n',
      definition: {
        nodes: [
          {
            id: 'manual_trigger',
            name: 'Manual Trigger',
            type: 'n8n-nodes-base.manualTrigger',
            position: [100, 100],
            parameters: {}
          },
          {
            id: 'http_request',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            position: [300, 100],
            parameters: {
              url: 'https://jsonplaceholder.typicode.com/posts/1',
              method: 'GET'
            }
          }
        ],
        connections: {
          'Manual Trigger': {
            main: [
              [
                {
                  node: 'HTTP Request',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          }
        }
      }
    },
    
    langsmith: {
      engine: 'langsmith',
      definition: {
        chains: [
          {
            id: 'simple_chain',
            type: 'LLMChain',
            llm: {
              type: 'OpenAI',
              model: 'gpt-3.5-turbo',
              temperature: 0.7
            },
            prompt: {
              template: 'Process this input: {input}',
              input_variables: ['input']
            }
          }
        ],
        inputs: {
          input: 'Load test input data'
        }
      }
    }
  };
  
  return definitions[engine] || definitions.langflow;
}

function validateResponse(context, events, done) {
  // Custom validation logic for responses
  const response = context.response;
  
  if (response.statusCode >= 400) {
    events.emit('error', `HTTP ${response.statusCode}: ${response.body}`);
  }
  
  // Check response time
  if (response.timings && response.timings.response > 5000) {
    events.emit('error', `Slow response: ${response.timings.response}ms`);
  }
  
  // Validate JSON structure for API responses
  if (response.headers['content-type']?.includes('application/json')) {
    try {
      JSON.parse(response.body);
    } catch (e) {
      events.emit('error', `Invalid JSON response: ${e.message}`);
    }
  }
  
  return done();
}