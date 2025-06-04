import { NextResponse } from "next/server"

export async function GET() {
  // This is a guide for developers on how to integrate with n8n and Langflow
  const integrationGuide = {
    n8n: {
      baseUrl: process.env.N8N_BASE_URL || "http://localhost:5678",
      apiKey: "YOUR_N8N_API_KEY", // Replace with your actual API key in .env
      endpoints: {
        listExecutions: "/rest/executions",
        getExecution: "/rest/executions/:id",
        triggerWorkflow: "/rest/workflows/:id/run",
      },
      dataMapping: {
        id: "id",
        workflowId: "workflowId",
        workflowName: "workflowData.name",
        status: "finished ? (stoppedAt ? 'success' : 'error') : 'running'",
        startTime: "startedAt (format as dd.MM.yyyy HH:mm:ss)",
        duration: "calculate from startedAt and stoppedAt",
        nodes: "data.resultData.runData",
        logs: "extract from execution data",
      },
      sampleCurl: `curl -X GET "${process.env.N8N_BASE_URL}/rest/executions" \\
  -H "Authorization: Bearer YOUR_N8N_API_KEY"`,
    },
    langflow: {
      baseUrl: process.env.LANGFLOW_BASE_URL || "http://localhost:7860",
      apiKey: "YOUR_LANGFLOW_API_KEY", // Replace with your actual API key in .env
      endpoints: {
        listRuns: "/api/v1/runs",
        getRun: "/api/v1/runs/:id",
        triggerFlow: "/api/v1/run/:id",
      },
      dataMapping: {
        id: "id",
        workflowId: "flow_id",
        workflowName: "flow_name",
        status: "status (map 'SUCCESS' to 'success', 'ERROR' to 'error')",
        startTime: "timestamp (format as dd.MM.yyyy HH:mm:ss)",
        duration: "duration + 's'",
        nodes: "outputs",
        logs: "logs",
      },
      sampleCurl: `curl -X GET "${process.env.LANGFLOW_BASE_URL}/api/v1/runs" \\
  -H "Authorization: Bearer YOUR_LANGFLOW_API_KEY"`,
    },
    implementation: {
      steps: [
        "1. Configure environment variables for API endpoints and keys",
        "2. Create API routes for fetching executions and execution details",
        "3. Implement data transformation functions for each engine",
        "4. Add real-time updates using polling or webhooks",
        "5. Connect the UI components to the API routes",
      ],
      files: [
        "/app/api/executions/route.ts - Fetch all executions",
        "/app/api/executions/[id]/route.ts - Fetch execution details",
        "/app/api/trigger/route.ts - Trigger workflows",
        "/components/execution-details-modal.tsx - Display execution details",
      ],
    },
  }

  return NextResponse.json(integrationGuide)
}
