"use client"

import { useState, useEffect } from "react"
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Settings,
  Plus,
  Maximize2,
  Minimize2,
  RefreshCw,
  Filter,
  Calendar
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Widget {
  id: string
  type: 'metric' | 'chart' | 'table' | 'alert'
  title: string
  size: 'small' | 'medium' | 'large'
  position: { x: number; y: number }
  config: any
  data?: any
}

interface MetricData {
  label: string
  value: number
  change: number
  trend: 'up' | 'down' | 'stable'
  color: string
}

const mockMetrics: MetricData[] = [
  {
    label: "Active Workflows",
    value: 24,
    change: 12.5,
    trend: 'up',
    color: '#3B82F6'
  },
  {
    label: "Executions Today",
    value: 156,
    change: -5.2,
    trend: 'down',
    color: '#10B981'
  },
  {
    label: "Success Rate",
    value: 94.8,
    change: 2.1,
    trend: 'up',
    color: '#F59E0B'
  },
  {
    label: "Avg Response Time",
    value: 1.2,
    change: -8.3,
    trend: 'up',
    color: '#EF4444'
  }
]

const mockChartData = [
  { time: '00:00', executions: 12, success: 11, failed: 1 },
  { time: '04:00', executions: 8, success: 7, failed: 1 },
  { time: '08:00', executions: 24, success: 22, failed: 2 },
  { time: '12:00', executions: 32, success: 30, failed: 2 },
  { time: '16:00', executions: 28, success: 26, failed: 2 },
  { time: '20:00', executions: 18, success: 17, failed: 1 }
]

const mockEngineData = [
  { name: 'Langflow', value: 45, color: '#3B82F6' },
  { name: 'N8N', value: 35, color: '#10B981' },
  { name: 'LangSmith', value: 20, color: '#F59E0B' }
]

const mockAlerts = [
  {
    id: 'alert-1',
    type: 'error',
    title: 'High Error Rate',
    message: 'Workflow "Customer Processing" has 15% error rate in last hour',
    timestamp: new Date(Date.now() - 300000),
    severity: 'high'
  },
  {
    id: 'alert-2',
    type: 'warning',
    title: 'Slow Response Time',
    message: 'API response time increased by 200ms',
    timestamp: new Date(Date.now() - 600000),
    severity: 'medium'
  },
  {
    id: 'alert-3',
    type: 'info',
    title: 'New Workflow Deployed',
    message: 'Workflow "Email Automation v2" deployed successfully',
    timestamp: new Date(Date.now() - 900000),
    severity: 'low'
  }
]

const defaultWidgets: Widget[] = [
  {
    id: 'metrics-overview',
    type: 'metric',
    title: 'Key Metrics',
    size: 'large',
    position: { x: 0, y: 0 },
    config: { metrics: mockMetrics }
  },
  {
    id: 'execution-trend',
    type: 'chart',
    title: 'Execution Trends',
    size: 'large',
    position: { x: 1, y: 0 },
    config: { chartType: 'line', data: mockChartData }
  },
  {
    id: 'engine-distribution',
    type: 'chart',
    title: 'Engine Distribution',
    size: 'medium',
    position: { x: 0, y: 1 },
    config: { chartType: 'pie', data: mockEngineData }
  },
  {
    id: 'recent-alerts',
    type: 'alert',
    title: 'Recent Alerts',
    size: 'medium',
    position: { x: 1, y: 1 },
    config: { alerts: mockAlerts }
  }
]

export function MonitoringDashboard() {
  const [widgets, setWidgets] = useState<Widget[]>(defaultWidgets)
  const [timeRange, setTimeRange] = useState('24h')
  const [refreshInterval, setRefreshInterval] = useState('30s')
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date())
      // Simulate data refresh
    }, parseInt(refreshInterval) * 1000)

    return () => clearInterval(interval)
  }, [refreshInterval])

  const handleRefresh = () => {
    setLastRefresh(new Date())
    // Trigger data refresh
  }

  const handleAddWidget = () => {
    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type: 'metric',
      title: 'New Widget',
      size: 'medium',
      position: { x: 0, y: widgets.length },
      config: {}
    }
    setWidgets(prev => [...prev, newWidget])
  }

  const handleRemoveWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId))
  }

  const handleExpandWidget = (widgetId: string) => {
    setExpandedWidget(expandedWidget === widgetId ? null : widgetId)
  }

  const renderMetricWidget = (widget: Widget) => {
    const metrics = widget.config.metrics || []
    
    return (
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric: MetricData, index: number) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{metric.label}</span>
              <div className="flex items-center space-x-1">
                {metric.trend === 'up' ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : metric.trend === 'down' ? (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                ) : (
                  <Activity className="w-3 h-3 text-gray-500" />
                )}
                <span className={`text-xs ${
                  metric.trend === 'up' ? 'text-green-500' : 
                  metric.trend === 'down' ? 'text-red-500' : 'text-gray-500'
                }`}>
                  {metric.change > 0 ? '+' : ''}{metric.change}%
                </span>
              </div>
            </div>
            <div className="text-2xl font-bold" style={{ color: metric.color }}>
              {metric.value}{metric.label.includes('Rate') || metric.label.includes('Time') ? 
                (metric.label.includes('Rate') ? '%' : 's') : ''}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderChartWidget = (widget: Widget) => {
    const { chartType, data } = widget.config

    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="executions" stroke="#3B82F6" strokeWidth={2} />
              <Line type="monotone" dataKey="success" stroke="#10B981" strokeWidth={2} />
              <Line type="monotone" dataKey="failed" stroke="#EF4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )
      
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="executions" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        )
      
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="executions" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        )
      
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )
      
      default:
        return <div>Unsupported chart type</div>
    }
  }

  const renderAlertWidget = (widget: Widget) => {
    const alerts = widget.config.alerts || []
    
    return (
      <div className="space-y-3">
        {alerts.map((alert: any) => (
          <div key={alert.id} className="flex items-start space-x-3 p-3 border rounded-lg">
            <div className="flex-shrink-0">
              {alert.type === 'error' ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : alert.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-blue-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{alert.title}</p>
                <Badge 
                  variant={alert.severity === 'high' ? 'destructive' : 
                          alert.severity === 'medium' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {alert.severity}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {alert.message}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {alert.timestamp.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderWidget = (widget: Widget) => {
    const isExpanded = expandedWidget === widget.id
    const sizeClass = isExpanded ? 'col-span-2 row-span-2' : 
                     widget.size === 'large' ? 'col-span-2' :
                     widget.size === 'medium' ? 'col-span-1' : 'col-span-1'

    return (
      <Card key={widget.id} className={`${sizeClass} transition-all duration-200`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
          <div className="flex items-center space-x-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleExpandWidget(widget.id)}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            {isCustomizing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveWidget(widget.id)}
              >
                ×
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {widget.type === 'metric' && renderMetricWidget(widget)}
          {widget.type === 'chart' && renderChartWidget(widget)}
          {widget.type === 'alert' && renderAlertWidget(widget)}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Monitoring Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time monitoring and analytics for your workflows
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="glass dark:glass-dark bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={refreshInterval} onValueChange={setRefreshInterval}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Refresh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 seconds</SelectItem>
                <SelectItem value="30">30 seconds</SelectItem>
                <SelectItem value="60">1 minute</SelectItem>
                <SelectItem value="300">5 minutes</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant={isCustomizing ? "default" : "outline"}
              onClick={() => setIsCustomizing(!isCustomizing)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Customize
            </Button>
            
            {isCustomizing && (
              <Button onClick={handleAddWidget}>
                <Plus className="w-4 h-4 mr-2" />
                Add Widget
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-2 gap-6 auto-rows-min">
        {widgets.map(renderWidget)}
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">API Gateway</span>
                <Badge className="bg-green-100 text-green-800">Healthy</Badge>
              </div>
              <Progress value={98} className="h-2" />
              <p className="text-xs text-gray-500">98% uptime</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Database</span>
                <Badge className="bg-green-100 text-green-800">Healthy</Badge>
              </div>
              <Progress value={95} className="h-2" />
              <p className="text-xs text-gray-500">95% uptime</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Queue System</span>
                <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>
              </div>
              <Progress value={87} className="h-2" />
              <p className="text-xs text-gray-500">87% uptime</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}