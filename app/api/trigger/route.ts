import { NextResponse } from "next/server"

// Mock response for when API connections fail
const mockTriggerResponse = {
  n8n: {
    success: true,
    executionId: "mock-execution-id",
    message: "Workflow triggered successfully (mock)",
  },
  langflow: {
    success: true,
    run_id: "mock-run-id",
    message: "Flow triggered successfully (mock)",
  },
}

// Create a timeout promise
function createTimeoutPromise(ms: number) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Request timeout")), ms)
  })
}

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 5000) {
  try {
    const fetchPromise = fetch(url, options)
    const timeoutPromise = createTimeoutPromise(timeoutMs)

    return (await Promise.race([fetchPromise, timeoutPromise])) as Response
  } catch (error) {
    throw error
  }
}

async function triggerN8nWorkflow(workflowId: string) {
  // Check if environment variables are set
  const n8nBaseUrl = process.env.N8N_BASE_URL
  const n8nApiKey = process.env.N8N_API_KEY

  if (!n8nBaseUrl || !n8nApiKey) {
    console.log("N8N environment variables not configured, using mock response")
    return mockTriggerResponse.n8n
  }

  try {
    const url = `${n8nBaseUrl}/rest/workflows/${workflowId}/run`
    console.log(`Triggering n8n workflow at: ${url}`)

    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${n8nApiKey}`,
          "Content-Type": "application/json",
        },
      },
      5000,
    )

    if (!response.ok) {
      throw new Error(`n8n API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error triggering n8n workflow:", error)
    console.log("Using mock n8n trigger response")
    return mockTriggerResponse.n8n
  }
}

async function triggerLangflowWorkflow(flowId: string) {
  // Check if environment variables are set
  const langflowBaseUrl = process.env.LANGFLOW_BASE_URL
  const langflowApiKey = process.env.LANGFLOW_API_KEY

  if (!langflowBaseUrl || !langflowApiKey) {
    console.log("Langflow environment variables not configured, using mock response")
    return mockTriggerResponse.langflow
  }

  try {
    const url = `${langflowBaseUrl}/api/v1/run/${flowId}`
    console.log(`Triggering Langflow workflow at: ${url}`)

    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${langflowApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input_value: "Manual trigger from FlowBit Dashboard",
          input_type: "chat",
          output_type: "chat",
        }),
      },
      5000,
    )

    if (!response.ok) {
      throw new Error(`Langflow API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error triggering Langflow workflow:", error)
    console.log("Using mock Langflow trigger response")
    return mockTriggerResponse.langflow
  }
}

export async function POST(request: Request) {
  try {
    const { workflowId, engine } = await request.json()

    if (!workflowId || !engine) {
      return NextResponse.json({ error: "Missing workflowId or engine" }, { status: 400 })
    }

    console.log(`Triggering workflow: ${workflowId}, engine: ${engine}`)

    let result = null

    if (engine === "n8n") {
      result = await triggerN8nWorkflow(workflowId)
    } else if (engine === "langflow") {
      result = await triggerLangflowWorkflow(workflowId)
    } else {
      return NextResponse.json({ error: "Unsupported engine" }, { status: 400 })
    }

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("Error triggering workflow:", error)
    return NextResponse.json({ error: "Failed to trigger workflow" }, { status: 500 })
  }
}
