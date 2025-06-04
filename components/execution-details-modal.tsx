"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle, XCircle, Clock, AlertTriangle, Info, ChevronDown, ChevronRight, Copy } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ExecutionDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  executionId: string | null
  engine: string | null
}

interface ExecutionDetails {
  id: string
  workflowName: string
  status: string
  startTime: string
  endTime?: string
  duration: string
  triggerType: string
  nodes?: any[]
  logs?: any[]
  error?: string
  data?: any
}

export function ExecutionDetailsModal({ open, onOpenChange, executionId, engine }: ExecutionDetailsModalProps) {
  const [executionDetails, setExecutionDetails] = useState<ExecutionDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<string[]>([])
  const [isUsingMockData, setIsUsingMockData] = useState(false)

  useEffect(() => {
    if (open && executionId && engine) {
      fetchExecutionDetails()
    }
  }, [open, executionId, engine])

  const fetchExecutionDetails = async () => {
    if (!executionId || !engine) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/executions/${executionId}?engine=${engine}`)

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Check if we're using mock data (based on ID pattern or response structure)
      if (
        executionId.startsWith("mock-") ||
        (data.execution &&
          (data.execution.id.startsWith("n8n-exec-") || data.execution.id.startsWith("langflow-exec-")))
      ) {
        setIsUsingMockData(true)
      } else {
        setIsUsingMockData(false)
      }

      setExecutionDetails(transformExecutionData(data.execution, engine))
    } catch (error) {
      console.error("Error fetching execution details:", error)
      setError("Failed to fetch execution details. Please check your API configuration.")
    } finally {
      setLoading(false)
    }
  }

  const transformExecutionData = (data: any, engine: string): ExecutionDetails => {
    if (engine === "n8n") {
      return {
        id: data.id,
        workflowName: data.workflowData?.name || "Unknown Workflow",
        status: data.finished ? (data.stoppedAt ? "success" : "error") : "running",
        startTime: new Date(data.startedAt)
          .toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
          .replace(",", ""),
        endTime: data.stoppedAt
          ? new Date(data.stoppedAt)
              .toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
              .replace(",", "")
          : undefined,
        duration: data.finished
          ? `${((new Date(data.stoppedAt).getTime() - new Date(data.startedAt).getTime()) / 1000).toFixed(1)}s`
          : "Running...",
        triggerType: data.mode || "manual",
        nodes: data.data?.resultData?.runData
          ? Object.entries(data.data.resultData.runData).map(([nodeName, nodeData]: [string, any]) => ({
              name: nodeName,
              status: nodeData[0]?.error ? "error" : "success",
              executionTime: nodeData[0]?.executionTime || 0,
              data: nodeData[0]?.data,
              error: nodeData[0]?.error,
            }))
          : [],
        error: data.data?.resultData?.error?.message,
        data: data.data,
      }
    } else if (engine === "langflow") {
      return {
        id: data.id,
        workflowName: data.flow_name || "Unknown Flow",
        status: data.status === "SUCCESS" ? "success" : data.status === "ERROR" ? "error" : "running",
        startTime: new Date(data.timestamp)
          .toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
          .replace(",", ""),
        duration: data.duration ? `${data.duration.toFixed(1)}s` : "N/A",
        triggerType: data.trigger_type || "manual",
        logs: data.logs || [],
        nodes: data.outputs
          ? Object.entries(data.outputs).map(([nodeName, nodeData]: [string, any]) => ({
              name: nodeName,
              status: nodeData.error ? "error" : "success",
              data: nodeData.data,
              error: nodeData.error,
            }))
          : [],
        error: data.error,
        data: data,
      }
    }

    return {
      id: executionId || "",
      workflowName: "Unknown",
      status: "unknown",
      startTime: "",
      duration: "",
      triggerType: "unknown",
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
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
    switch (status) {
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

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7575e4]"></div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-600">{error}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!executionDetails) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-600">Failed to load execution details</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        {isUsingMockData && (
          <Alert className="bg-amber-50 border-amber-200 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Using Mock Data</AlertTitle>
            <AlertDescription className="text-amber-700">
              Displaying mock execution details because the API connection is not available.
            </AlertDescription>
          </Alert>
        )}

        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getStatusIcon(executionDetails.status)}
            <span>{executionDetails.workflowName}</span>
            {getStatusBadge(executionDetails.status)}
            <Badge variant="outline" className="ml-auto">
              {engine}
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
                  <Badge variant="outline">{engine}</Badge>
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
                  {executionDetails.nodes.map((node, index) => (
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
                  {executionDetails.logs.map((log, index) => (
                    <Card key={index}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              log.level === "ERROR" || log.level === "error"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : ""
                            }`}
                          >
                            {log.level || "INFO"}
                          </Badge>
                          <div className="flex-1">
                            <div className="text-xs text-gray-500 mb-1">
                              {log.timestamp || executionDetails.startTime}
                            </div>
                            <pre
                              className={`text-sm whitespace-pre-wrap ${
                                log.level === "ERROR" || log.level === "error" ? "text-red-600" : ""
                              }`}
                            >
                              {log.message || JSON.stringify(log, null, 2)}
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
                  <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(executionDetails.data, null, 2)}</pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
