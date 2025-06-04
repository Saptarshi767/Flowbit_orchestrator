"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle, XCircle, Clock, Info, ChevronDown, ChevronRight, Copy } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Sample n8n execution data
const n8nSampleExecution = {
  id: "123456",
  workflowId: "wf-1",
  workflowName: "Email Processor",
  engine: "n8n",
  status: "success",
  startTime: "15.01.2024 14:30:22",
  endTime: "15.01.2024 14:30:25",
  duration: "2.3s",
  triggerType: "webhook",
  nodes: [
    {
      name: "Webhook",
      status: "success",
      executionTime: 120,
      data: {
        headers: {
          "content-type": "application/json",
          "user-agent": "PostmanRuntime/7.32.3",
        },
        params: {},
        query: {},
        body: {
          email: "user@example.com",
          subject: "Test Email",
          content: "This is a test email content",
        },
      },
    },
    {
      name: "Filter",
      status: "success",
      executionTime: 45,
      data: {
        isSpam: false,
        priority: "high",
        passthrough: true,
      },
    },
    {
      name: "Email",
      status: "success",
      executionTime: 1850,
      data: {
        messageId: "<20240115143024.1234567@smtp.example.com>",
        accepted: ["recipient@example.com"],
        rejected: [],
        response: "250 Message accepted",
      },
    },
  ],
  logs: [
    {
      level: "INFO",
      timestamp: "15.01.2024 14:30:22",
      message: "Workflow execution started",
    },
    {
      level: "INFO",
      timestamp: "15.01.2024 14:30:22",
      message: "Webhook received request",
    },
    {
      level: "INFO",
      timestamp: "15.01.2024 14:30:23",
      message: "Email passed filter checks",
    },
    {
      level: "INFO",
      timestamp: "15.01.2024 14:30:25",
      message: "Email sent successfully",
    },
    {
      level: "INFO",
      timestamp: "15.01.2024 14:30:25",
      message: "Workflow execution completed",
    },
  ],
  data: {
    resultData: {
      runData: {
        Webhook: [
          {
            data: {
              headers: {
                "content-type": "application/json",
                "user-agent": "PostmanRuntime/7.32.3",
              },
              params: {},
              query: {},
              body: {
                email: "user@example.com",
                subject: "Test Email",
                content: "This is a test email content",
              },
            },
            executionTime: 120,
          },
        ],
        Filter: [
          {
            data: {
              isSpam: false,
              priority: "high",
              passthrough: true,
            },
            executionTime: 45,
          },
        ],
        Email: [
          {
            data: {
              messageId: "<20240115143024.1234567@smtp.example.com>",
              accepted: ["recipient@example.com"],
              rejected: [],
              response: "250 Message accepted",
            },
            executionTime: 1850,
          },
        ],
      },
    },
    workflowData: {
      name: "Email Processor",
      active: true,
      nodes: [
        {
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          position: [100, 100],
        },
        {
          name: "Filter",
          type: "n8n-nodes-base.filter",
          position: [300, 100],
        },
        {
          name: "Email",
          type: "n8n-nodes-base.emailSend",
          position: [500, 100],
        },
      ],
    },
  },
}

// Sample n8n error execution data
const n8nErrorSampleExecution = {
  id: "123457",
  workflowId: "wf-1",
  workflowName: "Email Processor",
  engine: "n8n",
  status: "error",
  startTime: "15.01.2024 14:35:10",
  endTime: "15.01.2024 14:35:12",
  duration: "1.8s",
  triggerType: "webhook",
  nodes: [
    {
      name: "Webhook",
      status: "success",
      executionTime: 115,
      data: {
        headers: {
          "content-type": "application/json",
          "user-agent": "PostmanRuntime/7.32.3",
        },
        params: {},
        query: {},
        body: {
          email: "invalid-email",
          subject: "Test Email",
          content: "This is a test email content",
        },
      },
    },
    {
      name: "Filter",
      status: "success",
      executionTime: 40,
      data: {
        isSpam: false,
        priority: "high",
        passthrough: true,
      },
    },
    {
      name: "Email",
      status: "error",
      executionTime: 1650,
      error: {
        message: "Invalid recipient email address: invalid-email",
        stack:
          "Error: Invalid recipient email address: invalid-email\n    at EmailSend.execute (/data/node_modules/n8n-nodes-base/dist/nodes/Email/EmailSend.node.js:128:23)",
      },
    },
  ],
  logs: [
    {
      level: "INFO",
      timestamp: "15.01.2024 14:35:10",
      message: "Workflow execution started",
    },
    {
      level: "INFO",
      timestamp: "15.01.2024 14:35:10",
      message: "Webhook received request",
    },
    {
      level: "INFO",
      timestamp: "15.01.2024 14:35:11",
      message: "Email passed filter checks",
    },
    {
      level: "ERROR",
      timestamp: "15.01.2024 14:35:12",
      message: "Invalid recipient email address: invalid-email",
    },
    {
      level: "ERROR",
      timestamp: "15.01.2024 14:35:12",
      message: "Workflow execution failed",
    },
  ],
  error: "Invalid recipient email address: invalid-email",
  data: {
    resultData: {
      runData: {
        Webhook: [
          {
            data: {
              headers: {
                "content-type": "application/json",
                "user-agent": "PostmanRuntime/7.32.3",
              },
              params: {},
              query: {},
              body: {
                email: "invalid-email",
                subject: "Test Email",
                content: "This is a test email content",
              },
            },
            executionTime: 115,
          },
        ],
        Filter: [
          {
            data: {
              isSpam: false,
              priority: "high",
              passthrough: true,
            },
            executionTime: 40,
          },
        ],
        Email: [
          {
            error: {
              message: "Invalid recipient email address: invalid-email",
              stack:
                "Error: Invalid recipient email address: invalid-email\n    at EmailSend.execute (/data/node_modules/n8n-nodes-base/dist/nodes/Email/EmailSend.node.js:128:23)",
            },
            executionTime: 1650,
          },
        ],
      },
      error: {
        message: "Invalid recipient email address: invalid-email",
        stack:
          "Error: Invalid recipient email address: invalid-email\n    at EmailSend.execute (/data/node_modules/n8n-nodes-base/dist/nodes/Email/EmailSend.node.js:128:23)",
      },
    },
    workflowData: {
      name: "Email Processor",
      active: true,
      nodes: [
        {
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          position: [100, 100],
        },
        {
          name: "Filter",
          type: "n8n-nodes-base.filter",
          position: [300, 100],
        },
        {
          name: "Email",
          type: "n8n-nodes-base.emailSend",
          position: [500, 100],
        },
      ],
    },
  },
}

// Sample Langflow execution data
const langflowSampleExecution = {
  id: "789012",
  flow_id: "wf-5",
  flow_name: "ETL Pipeline",
  engine: "langflow",
  status: "SUCCESS",
  timestamp: "15.01.2024 14:20:08",
  duration: 45.2,
  trigger_type: "schedule",
  logs: [
    {
      level: "INFO",
      timestamp: "15.01.2024 14:20:08",
      message: "Flow execution started",
    },
    {
      level: "INFO",
      timestamp: "15.01.2024 14:20:10",
      message: "Loading data from source",
    },
    {
      level: "INFO",
      timestamp: "15.01.2024 14:20:25",
      message: "Transforming data",
    },
    {
      level: "INFO",
      timestamp: "15.01.2024 14:20:45",
      message: "Loading data to destination",
    },
    {
      level: "INFO",
      timestamp: "15.01.2024 14:20:53",
      message: "Flow execution completed",
    },
  ],
  outputs: {
    "Data Source": {
      status: "success",
      data: {
        records: 1250,
        source: "postgres://localhost:5432/source_db",
        tables: ["users", "orders", "products"],
      },
    },
    "Data Transform": {
      status: "success",
      data: {
        transformations: ["join", "filter", "aggregate"],
        records_processed: 1250,
        records_filtered: 120,
      },
    },
    "Data Load": {
      status: "success",
      data: {
        destination: "postgres://localhost:5432/target_db",
        records_loaded: 1130,
        tables_updated: ["user_metrics", "order_summary"],
      },
    },
    Notification: {
      status: "success",
      data: {
        notification_sent: true,
        recipients: ["admin@example.com"],
        subject: "ETL Pipeline Completed",
      },
    },
  },
  tags: ["data-processing"],
}

// Sample Langflow error execution data
const langflowErrorSampleExecution = {
  id: "789013",
  flow_id: "wf-5",
  flow_name: "ETL Pipeline",
  engine: "langflow",
  status: "ERROR",
  timestamp: "15.01.2024 15:20:08",
  duration: 22.7,
  trigger_type: "schedule",
  logs: [
    {
      level: "INFO",
      timestamp: "15.01.2024 15:20:08",
      message: "Flow execution started",
    },
    {
      level: "INFO",
      timestamp: "15.01.2024 15:20:10",
      message: "Loading data from source",
    },
    {
      level: "INFO",
      timestamp: "15.01.2024 15:20:25",
      message: "Transforming data",
    },
    {
      level: "ERROR",
      timestamp: "15.01.2024 15:20:30",
      message: "Database connection error: Connection refused",
    },
    {
      level: "ERROR",
      timestamp: "15.01.2024 15:20:30",
      message: "Flow execution failed",
    },
  ],
  outputs: {
    "Data Source": {
      status: "success",
      data: {
        records: 1250,
        source: "postgres://localhost:5432/source_db",
        tables: ["users", "orders", "products"],
      },
    },
    "Data Transform": {
      status: "success",
      data: {
        transformations: ["join", "filter", "aggregate"],
        records_processed: 1250,
        records_filtered: 120,
      },
    },
    "Data Load": {
      status: "error",
      error: "Database connection error: Connection refused",
    },
  },
  error: "Database connection error: Connection refused",
  tags: ["data-processing"],
}

export function ExecutionDetailsSample() {
  const [open, setOpen] = useState(false)
  const [selectedSample, setSelectedSample] = useState<any>(null)
  const [expandedNodes, setExpandedNodes] = useState<string[]>([])

  const handleOpenSample = (sample: any) => {
    setSelectedSample(sample)
    setOpen(true)
    setExpandedNodes([])
  }

  const getStatusIcon = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    switch (normalizedStatus) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case "error":
        return <XCircle className="w-5 h-5 text-red-600" />
      case "running":
        return <Clock className="w-5 h-5 text-blue-600" />
      default:
        return <Clock className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    switch (normalizedStatus) {
      case "success":
        return <Badge className="bg-green-100 text-green-800">Success</Badge>
      case "error":
        return <Badge className="bg-red-100 text-red-800">Error</Badge>
      case "running":
        return <Badge className="bg-blue-100 text-blue-800">Running</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const toggleNodeExpansion = (nodeName: string) => {
    setExpandedNodes((prev) =>
      prev.includes(nodeName) ? prev.filter((name) => name !== nodeName) : [...prev, nodeName],
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Transform the sample data to a common format for display
  const transformExecutionData = (data: any) => {
    if (data.engine === "n8n") {
      return {
        id: data.id,
        workflowName: data.workflowName,
        status: data.status,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        triggerType: data.triggerType,
        nodes: data.nodes,
        logs: data.logs,
        error: data.error,
        data: data.data,
        engine: data.engine,
      }
    } else if (data.engine === "langflow") {
      return {
        id: data.id,
        workflowName: data.flow_name,
        status: data.status === "SUCCESS" ? "success" : data.status === "ERROR" ? "error" : "running",
        startTime: data.timestamp,
        duration: `${data.duration}s`,
        triggerType: data.trigger_type,
        logs: data.logs,
        nodes: data.outputs
          ? Object.entries(data.outputs).map(([nodeName, nodeData]: [string, any]) => ({
              name: nodeName,
              status: nodeData.status,
              data: nodeData.data,
              error: nodeData.error,
            }))
          : [],
        error: data.error,
        data: data,
        engine: data.engine,
      }
    }

    return data
  }

  const executionDetails = selectedSample ? transformExecutionData(selectedSample) : null

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Sample Execution Data</h2>
      <p className="text-gray-600">
        Click on any sample execution to view detailed logs. This demonstrates how the execution details modal works
        with both n8n and Langflow data.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:border-[#7575e4]" onClick={() => handleOpenSample(n8nSampleExecution)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              n8n Successful Execution
              <Badge className="ml-auto bg-blue-100 text-blue-800">n8n</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Workflow:</span>
                <span>Email Processor</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <Badge className="bg-green-100 text-green-800">Success</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration:</span>
                <span>2.3s</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-[#7575e4]"
          onClick={() => handleOpenSample(n8nErrorSampleExecution)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              n8n Failed Execution
              <Badge className="ml-auto bg-blue-100 text-blue-800">n8n</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Workflow:</span>
                <span>Email Processor</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <Badge className="bg-red-100 text-red-800">Error</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Error:</span>
                <span className="text-red-600 truncate max-w-[200px]">Invalid recipient email address</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-[#7575e4]"
          onClick={() => handleOpenSample(langflowSampleExecution)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Langflow Successful Execution
              <Badge className="ml-auto bg-green-100 text-green-800">Langflow</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Flow:</span>
                <span>ETL Pipeline</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <Badge className="bg-green-100 text-green-800">Success</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration:</span>
                <span>45.2s</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-[#7575e4]"
          onClick={() => handleOpenSample(langflowErrorSampleExecution)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Langflow Failed Execution
              <Badge className="ml-auto bg-green-100 text-green-800">Langflow</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Flow:</span>
                <span>ETL Pipeline</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <Badge className="bg-red-100 text-red-800">Error</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Error:</span>
                <span className="text-red-600 truncate max-w-[200px]">Database connection error</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Execution Details Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          {executionDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {getStatusIcon(executionDetails.status)}
                  <span>{executionDetails.workflowName}</span>
                  {getStatusBadge(executionDetails.status)}
                  <Badge variant="outline" className="ml-auto">
                    {executionDetails.engine}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Execution ID: {executionDetails.id} • Started: {executionDetails.startTime}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="nodes">Nodes</TabsTrigger>
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                  <TabsTrigger value="data">Raw Data</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(executionDetails.status)}
                          <span className="capitalize">{executionDetails.status}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Duration</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-semibold">{executionDetails.duration}</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Trigger</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="capitalize">{executionDetails.triggerType}</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Engine</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge variant="outline">{executionDetails.engine}</Badge>
                      </CardContent>
                    </Card>
                  </div>

                  {executionDetails.error && (
                    <Card className="border-red-200">
                      <CardHeader>
                        <CardTitle className="text-red-600 flex items-center gap-2">
                          <XCircle className="w-4 h-4" />
                          Error Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-sm text-red-600 whitespace-pre-wrap bg-red-50 p-3 rounded">
                          {executionDetails.error}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="nodes" className="space-y-4">
                  <ScrollArea className="h-96">
                    {executionDetails.nodes && executionDetails.nodes.length > 0 ? (
                      <div className="space-y-2">
                        {executionDetails.nodes.map((node: any, index: number) => (
                          <Collapsible
                            key={index}
                            open={expandedNodes.includes(node.name)}
                            onOpenChange={() => toggleNodeExpansion(node.name)}
                          >
                            <Card>
                              <CollapsibleTrigger asChild>
                                <CardHeader className="cursor-pointer hover:bg-gray-50">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      {expandedNodes.includes(node.name) ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                      {node.status === "error" ? (
                                        <XCircle className="w-4 h-4 text-red-600" />
                                      ) : (
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                      )}
                                      <CardTitle className="text-sm">{node.name}</CardTitle>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {node.executionTime && <Badge variant="outline">{node.executionTime}ms</Badge>}
                                      <Badge variant={node.status === "error" ? "destructive" : "default"}>
                                        {node.status}
                                      </Badge>
                                    </div>
                                  </div>
                                </CardHeader>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <CardContent>
                                  {node.error && (
                                    <div className="mb-4">
                                      <h4 className="text-sm font-medium text-red-600 mb-2">Error:</h4>
                                      <pre className="text-xs text-red-600 bg-red-50 p-2 rounded whitespace-pre-wrap">
                                        {JSON.stringify(node.error, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {node.data && (
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium">Output Data:</h4>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => copyToClipboard(JSON.stringify(node.data, null, 2))}
                                        >
                                          <Copy className="w-3 h-3 mr-1" />
                                          Copy
                                        </Button>
                                      </div>
                                      <pre className="text-xs bg-gray-50 p-2 rounded whitespace-pre-wrap max-h-40 overflow-auto">
                                        {JSON.stringify(node.data, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </CardContent>
                              </CollapsibleContent>
                            </Card>
                          </Collapsible>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Info className="w-8 h-8 mx-auto mb-2" />
                        <p>No node execution data available</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="logs" className="space-y-4">
                  <ScrollArea className="h-96">
                    {executionDetails.logs && executionDetails.logs.length > 0 ? (
                      <div className="space-y-2">
                        {executionDetails.logs.map((log: any, index: number) => (
                          <Card key={index}>
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    log.level === "ERROR" ? "bg-red-50 text-red-700 border-red-200" : ""
                                  }`}
                                >
                                  {log.level || "INFO"}
                                </Badge>
                                <div className="flex-1">
                                  <div className="text-xs text-gray-500 mb-1">{log.timestamp}</div>
                                  <pre
                                    className={`text-sm whitespace-pre-wrap ${
                                      log.level === "ERROR" ? "text-red-600" : ""
                                    }`}
                                  >
                                    {log.message}
                                  </pre>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Info className="w-8 h-8 mx-auto mb-2" />
                        <p>No logs available for this execution</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="data" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Raw Execution Data</CardTitle>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(JSON.stringify(executionDetails.data, null, 2))}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy All
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-96">
                        <pre className="text-xs whitespace-pre-wrap">
                          {JSON.stringify(executionDetails.data, null, 2)}
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">Integration Guide</h3>
        <p className="text-blue-700 mb-4">
          This sample demonstrates how to display execution details from both n8n and Langflow. Here are the key
          integration points:
        </p>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-blue-800">1. API Integration</h4>
            <pre className="bg-white p-3 rounded text-sm overflow-auto">
              {`// Fetch n8n execution details
GET ${process.env.N8N_BASE_URL}/rest/executions/:id
Authorization: Bearer ${process.env.N8N_API_KEY}

// Fetch Langflow execution details
GET ${process.env.LANGFLOW_BASE_URL}/api/v1/runs/:id
Authorization: Bearer ${process.env.LANGFLOW_API_KEY}`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium text-blue-800">2. Data Transformation</h4>
            <pre className="bg-white p-3 rounded text-sm overflow-auto">
              {`// Transform n8n data
function transformN8nData(data) {
  return {
    id: data.id,
    workflowName: data.workflowData?.name,
    status: data.finished ? (data.stoppedAt ? "success" : "error") : "running",
    nodes: Object.entries(data.data?.resultData?.runData || {}).map(([nodeName, nodeData]) => ({
      name: nodeName,
      status: nodeData[0]?.error ? "error" : "success",
      data: nodeData[0]?.data,
      error: nodeData[0]?.error,
    })),
    // ... other fields
  }
}

// Transform Langflow data
function transformLangflowData(data) {
  return {
    id: data.id,
    workflowName: data.flow_name,
    status: data.status === "SUCCESS" ? "success" : "error",
    nodes: Object.entries(data.outputs || {}).map(([nodeName, nodeData]) => ({
      name: nodeName,
      status: nodeData.error ? "error" : "success",
      data: nodeData.data,
      error: nodeData.error,
    })),
    // ... other fields
  }
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
