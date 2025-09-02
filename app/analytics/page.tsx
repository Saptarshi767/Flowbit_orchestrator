"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Activity,
  Download,
  Calendar,
  Filter
} from "lucide-react"

// Mock analytics data
const analyticsData = {
  overview: {
    totalExecutions: 1247,
    successRate: 94.2,
    avgExecutionTime: 45.3,
    activeWorkflows: 24
  },
  executionTrends: [
    { date: "2024-01-01", executions: 45, success: 42, failed: 3 },
    { date: "2024-01-02", executions: 52, success: 49, failed: 3 },
    { date: "2024-01-03", executions: 38, success: 36, failed: 2 },
    { date: "2024-01-04", executions: 61, success: 58, failed: 3 },
    { date: "2024-01-05", executions: 47, success: 44, failed: 3 },
    { date: "2024-01-06", executions: 55, success: 52, failed: 3 },
    { date: "2024-01-07", executions: 49, success: 47, failed: 2 }
  ],
  topWorkflows: [
    { name: "Customer Data Processing", executions: 234, successRate: 96.2, avgTime: 42 },
    { name: "Email Campaign Automation", executions: 189, successRate: 98.4, avgTime: 28 },
    { name: "Document Analysis Pipeline", executions: 156, successRate: 89.1, avgTime: 67 },
    { name: "Social Media Monitoring", executions: 143, successRate: 95.8, avgTime: 35 },
    { name: "Data Backup Workflow", executions: 98, successRate: 99.0, avgTime: 15 }
  ],
  engineUsage: [
    { engine: "Langflow", executions: 567, percentage: 45.5 },
    { engine: "N8N", executions: 423, percentage: 33.9 },
    { engine: "LangSmith", executions: 257, percentage: 20.6 }
  ]
}

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Insights and performance metrics for your workflows
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Last 30 days
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Executions
              </CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analyticsData.overview.totalExecutions.toLocaleString()}
              </div>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-600">+12% from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Success Rate
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analyticsData.overview.successRate}%
              </div>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-600">+2.1% from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Avg Execution Time
              </CardTitle>
              <Clock className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analyticsData.overview.avgExecutionTime}s
              </div>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-3 w-3 text-red-500 mr-1 rotate-180" />
                <span className="text-xs text-red-600">-5.2s from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Workflows
              </CardTitle>
              <Activity className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analyticsData.overview.activeWorkflows}
              </div>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-600">+3 new this month</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Execution Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Execution Trends</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Daily execution volume over the last 7 days
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between space-x-2">
                {analyticsData.executionTrends.map((day, index) => (
                  <div key={index} className="flex flex-col items-center space-y-2 flex-1">
                    <div className="flex flex-col items-center space-y-1 w-full">
                      <div 
                        className="bg-blue-500 rounded-t w-full"
                        style={{ height: `${(day.executions / 70) * 200}px` }}
                      />
                      <div 
                        className="bg-green-500 rounded-b w-full"
                        style={{ height: `${(day.success / 70) * 200}px` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center space-x-4 mt-4 text-xs">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span>Total Executions</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span>Successful</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Engine Usage */}
          <Card>
            <CardHeader>
              <CardTitle>Engine Usage</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Distribution of executions by engine type
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.engineUsage.map((engine, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {engine.engine}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {engine.executions}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {engine.percentage}%
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          index === 0 ? 'bg-blue-500' : 
                          index === 1 ? 'bg-purple-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${engine.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Workflows */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Workflows</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Most executed workflows and their performance metrics
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.topWorkflows.map((workflow, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {workflow.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {workflow.executions} executions
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {workflow.successRate}%
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">Success Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {workflow.avgTime}s
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">Avg Time</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}