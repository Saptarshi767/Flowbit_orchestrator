import { NextResponse } from "next/server"

// Mock data for when API connections fail
const mockN8nExecutions = [
  {
    id: "n8n-exec-1",
    workflowId: "wf-1",
    workflowName: "Email Processor",
    engine: "n8n",
    status: "success",
    duration: "2.3s",
    startTime: "15.01.2024 14:30:22",
    triggerType: "webhook",
    folderId: "unassigned",
    executionData: {
      data: {
        resultData: {
          runData: {
            Webhook: [{ data: { body: { email: "test@example.com" } }, executionTime: 120 }],
            "Process Email": [{ data: { output: "Email processed" }, executionTime: 350 }],
          },
        },
      },
    },
  },
  {
    id: "n8n-exec-2",
    workflowId: "wf-3",
    workflowName: "Lead Scoring",
    engine: "n8n",
    status: "error",
    duration: "1.1s",
    startTime: "15.01.2024 14:25:15",
    triggerType: "webhook",
    folderId: "marketing",
    executionData: {
      data: {
        resultData: {
          error: { message: "Failed to process lead data" },
        },
      },
    },
  },
  {
    id: "n8n-exec-3",
    workflowId: "wf-6",
    workflowName: "Report Generator",
    engine: "n8n",
    status: "running",
    duration: "Running...",
    startTime: "15.01.2024 14:35:10",
    triggerType: "schedule",
    folderId: "data-processing",
    executionData: {
      data: {
        resultData: {
          runData: {
            "Data Fetch": [{ data: { records: 500 }, executionTime: 1200 }],
          },
        },
      },
    },
  },
]

const mockLangflowExecutions = [
  {
    id: "langflow-exec-1",
    workflowId: "wf-5",
    workflowName: "ETL Pipeline",
    engine: "langflow",
    status: "success",
    duration: "45.2s",
    startTime: "15.01.2024 14:20:08",
    triggerType: "schedule",
    folderId: "data-processing",
    executionData: {
      outputs: {
        "Data Source": { status: "success", data: { records: 1250 } },
        Transform: { status: "success", data: { transformations: ["join", "filter"] } },
      },
    },
  },
  {
    id: "langflow-exec-2",
    workflowId: "wf-2",
    workflowName: "Data Sync",
    engine: "langflow",
    status: "success",
    duration: "12.7s",
    startTime: "15.01.2024 14:15:33",
    triggerType: "manual",
    folderId: "unassigned",
    executionData: {
      outputs: {
        Sync: { status: "success", data: { synced: true } },
      },
    },
  },
  {
    id: "langflow-exec-3",
    workflowId: "wf-4",
    workflowName: "Campaign Tracker",
    engine: "langflow",
    status: "error",
    duration: "8.1s",
    startTime: "15.01.2024 14:10:15",
    triggerType: "webhook",
    folderId: "marketing",
    executionData: {
      outputs: {
        "Campaign Data": { status: "error", error: "API rate limit exceeded" },
      },
      error: "API rate limit exceeded",
    },
  },
]

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

// n8n API integration with improved error handling
async function fetchN8nExecutions() {
  // Check if environment variables are set
  const n8nBaseUrl = process.env.N8N_BASE_URL
  const n8nApiKey = process.env.N8N_API_KEY

  console.log("N8N Configuration:", {
    baseUrl: n8nBaseUrl ? "Set" : "Not set",
    apiKey: n8nApiKey ? "Set" : "Not set",
  })

  if (!n8nBaseUrl || !n8nApiKey) {
    console.log("N8N environment variables not configured, using mock data")
    return mockN8nExecutions
  }

  try {
    const url = `${n8nBaseUrl}/rest/executions`
    console.log(`Attempting to fetch n8n executions from: ${url}`)

    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${n8nApiKey}`,
          "Content-Type": "application/json",
        },
      },
      5000,
    ) // 5 second timeout

    console.log(`N8N API Response Status: ${response.status}`)

    if (!response.ok) {
      throw new Error(`n8n API error: ${response.status} ${response.statusText}`)
    }

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (err) {
        console.warn('Langflow response was not JSON. Falling back to mock.');
        data = { runs: [{ id: 'mock-1', status: 'Success', source: 'Langflow (Mock)' }] };
    }
    console.log(`N8N API returned ${data.data?.length || 0} executions`)

    return data.data.map((execution: any) => ({
      id: execution.id,
      workflowId: execution.workflowId,
      workflowName: execution.workflowData?.name || "Unknown Workflow",
      engine: "n8n",
      status: execution.finished ? (execution.stoppedAt ? "success" : "error") : "running",
      duration: execution.finished
        ? `${((new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000).toFixed(1)}s`
        : "Running...",
      startTime: new Date(execution.startedAt)
        .toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
        .replace(",", ""),
      triggerType: execution.mode || "manual",
      folderId: execution.workflowData?.tags?.[0] || "unassigned",
      executionData: execution,
    }))
  } catch (error) {
    console.error("Error fetching n8n executions:", error)
    console.log("Falling back to mock n8n execution data")
    return mockN8nExecutions
  }
}

// Langflow API integration with improved error handling
async function fetchLangflowExecutions() {
  // Check if environment variables are set
  const langflowBaseUrl = process.env.LANGFLOW_BASE_URL
  const langflowApiKey = process.env.LANGFLOW_API_KEY

  console.log("Langflow Configuration:", {
    baseUrl: langflowBaseUrl ? "Set" : "Not set",
    apiKey: langflowApiKey ? "Set" : "Not set",
  })

  if (!langflowBaseUrl || !langflowApiKey) {
    console.log("Langflow environment variables not configured, using mock data")
    return mockLangflowExecutions
  }

  try {
    const url = `${langflowBaseUrl}/api/v1/runs`
    console.log(`Attempting to fetch Langflow executions from: ${url}`)

    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${langflowApiKey}`,
          "Content-Type": "application/json",
        },
      },
      5000,
    ) // 5 second timeout

    console.log(`Langflow API Response Status: ${response.status}`)

    if (!response.ok) {
      throw new Error(`Langflow API error: ${response.status} ${response.statusText}`)
    }

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (err) {
        console.warn('Langflow response was not JSON. Falling back to mock.');
        data = { runs: [{ id: 'mock-1', status: 'Success', source: 'Langflow (Mock)' }] };
    }
    console.log(`Langflow API returned ${data.runs?.length || 0} executions`)

    return data.runs.map((run: any) => ({
      id: run.id,
      workflowId: run.flow_id,
      workflowName: run.flow_name || "Unknown Flow",
      engine: "langflow",
      status: run.status === "SUCCESS" ? "success" : run.status === "ERROR" ? "error" : "running",
      duration: run.duration ? `${run.duration.toFixed(1)}s` : "N/A",
      startTime: new Date(run.timestamp)
        .toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
        .replace(",", ""),
      triggerType: run.trigger_type || "manual",
      folderId: run.tags?.[0] || "unassigned",
      executionData: run,
    }))
  } catch (error) {
    console.error("Error fetching Langflow executions:", error)
    console.log("Falling back to mock Langflow execution data")
    return mockLangflowExecutions
  }
}

export async function GET() {
  try {
    console.log("=== Fetching executions from all sources ===")

    // Use Promise.allSettled to handle cases where one API fails but the other succeeds
    const [n8nResult, langflowResult] = await Promise.allSettled([fetchN8nExecutions(), fetchLangflowExecutions()])

    // Extract results or use empty arrays for failed promises
    const n8nExecutions = n8nResult.status === "fulfilled" ? n8nResult.value : mockN8nExecutions
    const langflowExecutions = langflowResult.status === "fulfilled" ? langflowResult.value : mockLangflowExecutions

    console.log(`N8N executions: ${n8nExecutions.length}`)
    console.log(`Langflow executions: ${langflowExecutions.length}`)

    const allExecutions = [...n8nExecutions, ...langflowExecutions]
      .sort((a, b) => {
        // Parse dates for proper comparison
        const dateA = a.startTime.split(" ")[0].split(".").reverse().join("-") + " " + a.startTime.split(" ")[1]
        const dateB = b.startTime.split(" ")[0].split(".").reverse().join("-") + " " + b.startTime.split(" ")[1]
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
      .slice(0, 50) // Last 50 executions

    console.log(`Returning ${allExecutions.length} total executions`)

    // Determine if we're using any mock data
    const usingMockData =
      n8nResult.status === "rejected" ||
      langflowResult.status === "rejected" ||
      !process.env.N8N_BASE_URL ||
      !process.env.N8N_API_KEY ||
      !process.env.LANGFLOW_BASE_URL ||
      !process.env.LANGFLOW_API_KEY

    return NextResponse.json({
      executions: allExecutions,
      usingMockData,
      message: usingMockData ? "Using mock data due to API configuration or connection issues" : "Live data",
    })
  } catch (error) {
    console.error("Unexpected error in executions API route:", error)

    // Return mock data as ultimate fallback
    const mockExecutions = [...mockN8nExecutions, ...mockLangflowExecutions].sort((a, b) => {
      const dateA = a.startTime.split(" ")[0].split(".").reverse().join("-") + " " + a.startTime.split(" ")[1]
      const dateB = b.startTime.split(" ")[0].split(".").reverse().join("-") + " " + b.startTime.split(" ")[1]
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })

    return NextResponse.json({
      executions: mockExecutions,
      usingMockData: true,
      message: "Using mock data due to unexpected error",
    })
  }
}
