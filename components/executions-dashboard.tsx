"use client"

import { useState, useEffect } from "react"
import {
  Play,
  Clock,
  CheckCircle,
  XCircle,
  Mail,
  Webhook,
  Calendar,
  User,
  Eye,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ExecutionDetailsModal } from "@/components/execution-details-modal"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Execution {
  id: string
  workflowId: string
  workflowName: string
  engine: string
  status: string
  duration: string
  startTime: string
  triggerType: string
  folderId: string
}

interface ExecutionsDashboardProps {
  selectedFolder: string | null
}

export function ExecutionsDashboard({ selectedFolder }: ExecutionsDashboardProps) {
  const [executions, setExecutions] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [engineFilter, setEngineFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [selectedExecution, setSelectedExecution] = useState<{ id: string; engine: string } | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [isUsingMockData, setIsUsingMockData] = useState(false)

  useEffect(() => {
    fetchExecutions()
    // Set up polling for real-time updates
    const interval = setInterval(fetchExecutions, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchExecutions = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      console.log("Fetching executions from API...")
      const response = await fetch("/api/executions")

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("API response:", data)

      // Check if we're using mock data
      setIsUsingMockData(data.usingMockData || false)
      setExecutions(data.executions || [])

      console.log(`Loaded ${data.executions?.length || 0} executions`)
    } catch (error) {
      console.error("Error fetching executions:", error)
      setError("Failed to fetch execution data. The dashboard will show mock data.")
      setIsUsingMockData(true)

      // Set some fallback mock data if the API completely fails
      setExecutions([
        {
          id: "fallback-1",
          workflowId: "wf-1",
          workflowName: "Email Processor",
          engine: "n8n",
          status: "success",
          duration: "2.3s",
          startTime: "15.01.2024 14:30:22",
          triggerType: "webhook",
          folderId: "unassigned",
        },
        {
          id: "fallback-2",
          workflowId: "wf-5",
          workflowName: "ETL Pipeline",
          engine: "langflow",
          status: "success",
          duration: "45.2s",
          startTime: "15.01.2024 14:20:08",
          triggerType: "schedule",
          folderId: "data-processing",
        },
      ])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const filteredExecutions = executions.filter((execution) => {
    if (selectedFolder && execution.folderId !== selectedFolder) return false
    if (statusFilter !== "all" && execution.status !== statusFilter) return false
    if (engineFilter !== "all" && execution.engine !== engineFilter) return false
    return true
  })

  // Calculate pagination
  const totalPages = Math.ceil(filteredExecutions.length / itemsPerPage)
  const paginatedExecutions = filteredExecutions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "error":
        return <XCircle className="w-4 h-4 text-red-600" />
      case "running":
        return <Clock className="w-4 h-4 text-blue-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
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

  const getEngineBadge = (engine: string) => {
    switch (engine) {
      case "n8n":
        return <Badge className="bg-blue-100 text-blue-800">n8n</Badge>
      case "langflow":
        return <Badge className="bg-green-100 text-green-800">Langflow</Badge>
      case "langsmith":
        return <Badge className="bg-purple-100 text-purple-800">LangSmith</Badge>
      default:
        return <Badge variant="outline">{engine}</Badge>
    }
  }

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case "email":
        return <Mail className="w-4 h-4 text-gray-600" />
      case "webhook":
        return <Webhook className="w-4 h-4 text-gray-600" />
      case "schedule":
        return <Calendar className="w-4 h-4 text-gray-600" />
      case "manual":
        return <User className="w-4 h-4 text-gray-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const handleTriggerWorkflow = async (workflowId: string, engine: string) => {
    try {
      const response = await fetch("/api/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workflowId, engine }),
      })

      if (response.ok) {
        // Refresh executions after triggering
        setTimeout(() => fetchExecutions(true), 2000)
      }
    } catch (error) {
      console.error("Error triggering workflow:", error)
    }
  }

  const handleViewDetails = (executionId: string, engine: string) => {
    setSelectedExecution({ id: executionId, engine })
    setDetailsModalOpen(true)
  }

  const handleRefresh = () => {
    fetchExecutions(true)
  }

  const successCount = filteredExecutions.filter((e) => e.status === "success").length
  const errorCount = filteredExecutions.filter((e) => e.status === "error").length
  const runningCount = filteredExecutions.filter((e) => e.status === "running").length

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number.parseInt(value))
    setCurrentPage(1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7575e4] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading execution data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isUsingMockData && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Using Mock Data</AlertTitle>
          <AlertDescription className="text-amber-700">
            The dashboard is currently displaying mock data because the API connections to n8n and/or Langflow are not
            available. To connect to real instances, please configure your environment variables in the .env.local file.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connection Issue</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredExecutions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{successCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{errorCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{runningCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="running">Running</SelectItem>
          </SelectContent>
        </Select>

        <Select value={engineFilter} onValueChange={setEngineFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by engine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Engines</SelectItem>
            <SelectItem value="n8n">n8n</SelectItem>
            <SelectItem value="langflow">Langflow</SelectItem>
            <SelectItem value="langsmith">LangSmith</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
          {refreshing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {/* Executions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Executions</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Rows per page:</span>
            <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
              <SelectTrigger className="w-16 h-8">
                <SelectValue placeholder="5" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredExecutions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-8 h-8 mx-auto mb-2" />
              <p>No executions found matching your filters</p>
              {isUsingMockData && (
                <p className="text-sm mt-2">Configure your API connections to see real execution data</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Engine</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedExecutions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(execution.status)}
                        {getStatusBadge(execution.status)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{execution.workflowName}</TableCell>
                    <TableCell>{getEngineBadge(execution.engine)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTriggerIcon(execution.triggerType)}
                        <span className="capitalize">{execution.triggerType}</span>
                      </div>
                    </TableCell>
                    <TableCell>{execution.duration}</TableCell>
                    <TableCell>{execution.startTime}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetails(execution.id, execution.engine)}
                          className="h-8"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTriggerWorkflow(execution.workflowId, execution.engine)}
                          className="h-8"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Trigger
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination Controls */}
          {filteredExecutions.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredExecutions.length)} of {filteredExecutions.length}{" "}
                executions
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage - 2 + i
                  if (pageNum < 1) pageNum = i + 1
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i)
                  if (pageNum < 1 || pageNum > totalPages) return null

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className={currentPage === pageNum ? "bg-[#7575e4] hover:bg-[#6565d4]" : ""}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ExecutionDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        executionId={selectedExecution?.id || null}
        engine={selectedExecution?.engine || null}
      />
    </div>
  )
}
