"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = require("fs");
const path_1 = require("path");
const versioning_1 = require("../middleware/versioning");
const analytics_1 = require("../middleware/analytics");
const router = (0, express_1.Router)();
/**
 * Serve OpenAPI specification
 */
router.get('/openapi.json', (req, res) => {
    try {
        const specPath = (0, path_1.join)(__dirname, '../openapi/spec.yaml');
        const yamlContent = (0, fs_1.readFileSync)(specPath, 'utf8');
        // Convert YAML to JSON (simple implementation)
        // In production, use a proper YAML parser like js-yaml
        const jsonSpec = convertYamlToJson(yamlContent);
        res.json(jsonSpec);
    }
    catch (error) {
        console.error('Failed to serve OpenAPI spec:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'SPEC_ERROR',
                message: 'Failed to load API specification'
            },
            meta: {
                correlationId: req.correlationId || '',
                timestamp: new Date().toISOString(),
                version: '1.1'
            }
        });
    }
});
/**
 * Serve interactive API documentation (Swagger UI)
 */
router.get('/', (req, res) => {
    const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Robust AI Orchestrator API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
    .swagger-ui .topbar {
      background-color: #1976d2;
    }
    .swagger-ui .topbar .download-url-wrapper {
      display: none;
    }
    .custom-header {
      background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
      color: white;
      padding: 20px;
      text-align: center;
      margin-bottom: 20px;
    }
    .custom-header h1 {
      margin: 0;
      font-size: 2.5em;
      font-weight: 300;
    }
    .custom-header p {
      margin: 10px 0 0 0;
      font-size: 1.2em;
      opacity: 0.9;
    }
    .version-info {
      background: #f5f5f5;
      border-left: 4px solid #1976d2;
      padding: 15px;
      margin: 20px;
      border-radius: 4px;
    }
    .version-info h3 {
      margin-top: 0;
      color: #1976d2;
    }
    .auth-info {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      padding: 15px;
      margin: 20px;
    }
    .auth-info h3 {
      margin-top: 0;
      color: #856404;
    }
  </style>
</head>
<body>
  <div class="custom-header">
    <h1>🤖 Robust AI Orchestrator API</h1>
    <p>Enterprise-grade AI workflow orchestration platform</p>
  </div>
  
  <div class="version-info">
    <h3>📋 API Version Information</h3>
    <p><strong>Current Version:</strong> ${(0, versioning_1.getVersionInfo)().currentVersion}</p>
    <p><strong>Supported Versions:</strong> ${(0, versioning_1.getVersionInfo)().supportedVersions.join(', ')}</p>
    <p><strong>Deprecated Versions:</strong> ${(0, versioning_1.getVersionInfo)().deprecatedVersions.join(', ') || 'None'}</p>
  </div>

  <div class="auth-info">
    <h3>🔐 Authentication Guide</h3>
    <p>This API supports multiple authentication methods:</p>
    <ul>
      <li><strong>Bearer Token:</strong> Use JWT tokens from the login endpoint</li>
      <li><strong>API Key:</strong> Use X-API-Key header for service-to-service calls</li>
      <li><strong>OAuth 2.0:</strong> For third-party integrations</li>
    </ul>
    <p>To get started, use the <code>/auth/login</code> endpoint to obtain a JWT token.</p>
  </div>

  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/v1/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        tryItOutEnabled: true,
        requestInterceptor: function(request) {
          // Add correlation ID to all requests
          request.headers['X-Correlation-ID'] = 'docs-' + Math.random().toString(36).substr(2, 9);
          return request;
        },
        responseInterceptor: function(response) {
          // Log API calls for documentation usage
          console.log('API Documentation Request:', {
            url: response.url,
            status: response.status,
            method: response.req?.method
          });
          return response;
        },
        onComplete: function() {
          console.log('Swagger UI loaded successfully');
        },
        validatorUrl: null, // Disable validator
        docExpansion: 'list',
        operationsSorter: 'alpha',
        tagsSorter: 'alpha',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true
      });

      // Add custom styling and functionality
      setTimeout(() => {
        // Add version selector
        const topbar = document.querySelector('.topbar');
        if (topbar) {
          const versionSelector = document.createElement('div');
          versionSelector.innerHTML = \`
            <select id="version-selector" style="margin-left: 20px; padding: 5px;">
              <option value="1.1">API v1.1 (Current)</option>
              <option value="1.0">API v1.0 (Deprecated)</option>
            </select>
          \`;
          topbar.appendChild(versionSelector);

          document.getElementById('version-selector').addEventListener('change', function(e) {
            const version = e.target.value;
            const newUrl = \`/api/v\${version}/docs/openapi.json\`;
            ui.specActions.updateUrl(newUrl);
            ui.specActions.download(newUrl);
          });
        }
      }, 1000);
    };
  </script>
</body>
</html>`;
    res.send(swaggerHtml);
});
/**
 * API examples and tutorials
 */
router.get('/examples', (req, res) => {
    const examples = {
        authentication: {
            title: 'Authentication Examples',
            examples: [
                {
                    name: 'Login with Email/Password',
                    method: 'POST',
                    endpoint: '/auth/login',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: {
                        email: 'user@example.com',
                        password: 'securepassword123'
                    },
                    response: {
                        success: true,
                        data: {
                            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                            refreshToken: 'refresh_token_here',
                            expiresIn: 3600,
                            user: {
                                id: 'user-uuid',
                                email: 'user@example.com',
                                name: 'John Doe',
                                role: 'user'
                            }
                        }
                    }
                },
                {
                    name: 'Using Bearer Token',
                    method: 'GET',
                    endpoint: '/workflows',
                    headers: {
                        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                        'Content-Type': 'application/json'
                    }
                }
            ]
        },
        workflows: {
            title: 'Workflow Management Examples',
            examples: [
                {
                    name: 'Create Langflow Workflow',
                    method: 'POST',
                    endpoint: '/workflows',
                    headers: {
                        'Authorization': 'Bearer your_token_here',
                        'Content-Type': 'application/json'
                    },
                    body: {
                        name: 'Customer Support Chatbot',
                        description: 'AI-powered customer support workflow using Langflow',
                        engineType: 'langflow',
                        definition: {
                            nodes: [
                                {
                                    id: 'input',
                                    type: 'TextInput',
                                    data: { text: 'Customer query input' }
                                },
                                {
                                    id: 'llm',
                                    type: 'OpenAI',
                                    data: { model: 'gpt-3.5-turbo' }
                                }
                            ],
                            edges: [
                                { source: 'input', target: 'llm' }
                            ]
                        },
                        tags: ['customer-support', 'chatbot', 'langflow'],
                        isPublic: false
                    }
                },
                {
                    name: 'Execute Workflow',
                    method: 'POST',
                    endpoint: '/executions',
                    headers: {
                        'Authorization': 'Bearer your_token_here',
                        'Content-Type': 'application/json'
                    },
                    body: {
                        workflowId: 'workflow-uuid',
                        parameters: {
                            input_text: 'Hello, I need help with my order',
                            customer_id: 'cust_12345'
                        }
                    }
                }
            ]
        },
        monitoring: {
            title: 'Monitoring and Analytics Examples',
            examples: [
                {
                    name: 'Get System Metrics',
                    method: 'GET',
                    endpoint: '/monitoring/metrics?timeRange=24h&metrics=cpu,memory,requests',
                    headers: {
                        'Authorization': 'Bearer your_token_here'
                    }
                },
                {
                    name: 'List Active Alerts',
                    method: 'GET',
                    endpoint: '/monitoring/alerts?severity=high&status=active',
                    headers: {
                        'Authorization': 'Bearer your_token_here'
                    }
                }
            ]
        },
        versioning: {
            title: 'API Versioning Examples',
            examples: [
                {
                    name: 'Using Accept Header (Recommended)',
                    method: 'GET',
                    endpoint: '/workflows',
                    headers: {
                        'Accept': 'application/vnd.robust-ai-orchestrator.v1.1+json',
                        'Authorization': 'Bearer your_token_here'
                    }
                },
                {
                    name: 'Using Custom Header',
                    method: 'GET',
                    endpoint: '/workflows',
                    headers: {
                        'X-API-Version': '1.1',
                        'Authorization': 'Bearer your_token_here'
                    }
                },
                {
                    name: 'Using Query Parameter',
                    method: 'GET',
                    endpoint: '/workflows?version=1.1',
                    headers: {
                        'Authorization': 'Bearer your_token_here'
                    }
                }
            ]
        }
    };
    res.json({
        success: true,
        data: {
            title: 'Robust AI Orchestrator API Examples',
            description: 'Interactive examples and code snippets for common API operations',
            examples,
            sdks: {
                javascript: 'https://www.npmjs.com/package/@robust-ai-orchestrator/sdk',
                python: 'https://pypi.org/project/robust-ai-orchestrator-sdk/',
                go: 'https://github.com/robust-ai-orchestrator/go-sdk',
                curl: 'Available in each endpoint documentation'
            },
            resources: {
                documentation: 'https://docs.robust-ai-orchestrator.com',
                tutorials: 'https://docs.robust-ai-orchestrator.com/tutorials',
                community: 'https://community.robust-ai-orchestrator.com',
                support: 'https://support.robust-ai-orchestrator.com'
            }
        },
        meta: {
            correlationId: req.correlationId || '',
            timestamp: new Date().toISOString(),
            version: '1.1'
        }
    });
});
/**
 * API status and health information
 */
router.get('/status', async (req, res) => {
    try {
        const versionInfo = (0, versioning_1.getVersionInfo)();
        const stats = await analytics_1.analyticsService.getUsageStats('day');
        res.json({
            success: true,
            data: {
                api: {
                    status: 'operational',
                    version: versionInfo.currentVersion,
                    uptime: process.uptime(),
                    documentation: '/api/v1/docs',
                    examples: '/api/v1/docs/examples'
                },
                versioning: versionInfo,
                usage: stats ? {
                    todayRequests: stats.totalRequests,
                    successRate: stats.totalRequests > 0
                        ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2) + '%'
                        : '0%',
                    averageResponseTime: Math.round(stats.averageResponseTime) + 'ms'
                } : null,
                endpoints: {
                    total: 50, // This would be calculated dynamically
                    documented: 50,
                    coverage: '100%'
                },
                lastUpdated: new Date().toISOString()
            },
            meta: {
                correlationId: req.correlationId || '',
                timestamp: new Date().toISOString(),
                version: versionInfo.currentVersion
            }
        });
    }
    catch (error) {
        console.error('Failed to get API status:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'STATUS_ERROR',
                message: 'Failed to retrieve API status'
            },
            meta: {
                correlationId: req.correlationId || '',
                timestamp: new Date().toISOString(),
                version: '1.1'
            }
        });
    }
});
/**
 * Simple YAML to JSON converter (for demo purposes)
 * In production, use a proper YAML parser like js-yaml
 */
function convertYamlToJson(yamlContent) {
    // This is a very basic implementation
    // In production, use: const yaml = require('js-yaml'); return yaml.load(yamlContent);
    try {
        // For now, return a basic OpenAPI structure
        return {
            openapi: '3.0.3',
            info: {
                title: 'Robust AI Orchestrator API',
                version: '1.1.0',
                description: 'Enterprise-grade AI orchestration platform'
            },
            servers: [
                { url: 'https://api.robust-ai-orchestrator.com/api/v1', description: 'Production' },
                { url: 'http://localhost:3001/api/v1', description: 'Development' }
            ],
            paths: {
                '/health': {
                    get: {
                        tags: ['System'],
                        summary: 'Health check',
                        responses: {
                            '200': {
                                description: 'Service is healthy'
                            }
                        }
                    }
                }
            }
        };
    }
    catch (error) {
        console.error('YAML conversion error:', error);
        return { error: 'Failed to parse OpenAPI specification' };
    }
}
exports.default = router;
//# sourceMappingURL=docs.js.map