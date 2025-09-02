"use client"

import { useState, useEffect, useRef } from "react"
import { 
  Play, 
  Pause, 
  Square, 
  SkipForward, 
  SkipBack, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Zap,
  Activity,
  Eye,
  Download,
  Share2
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface ExecutionNode {
  id: string
  name: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startTime?: Date
  endTime?: Date
  duration?: number
  input?: any
  output?: any
  error?: string
  position: { x: number; y: number }
  connections: string[]
}

interface ExecutionStep {
  timestamp: Date
  nodeId: string
  event: 'started' | 'completed' | 'failed' | 'data_received' | 'data_sent'
  data?: any
  message?: string
}

interface ExecutionVisualizerProps {
  executionId: string
  workflowId: string
  isLive?: boolean
}

const mockNodes: ExecutionNode[] = [
  {
    id: 'start',
    name: 'Start',
    type: 'trigger',
    status: 'completed',
    startTime: new Date(Date.now() - 10000),
    endTime: new Date(Date.now() - 9500),
    duration: 500,
    position: { x: 100, y: 200 },
    connections: ['validate']
  },
  {
    id: 'validate',
    name: 'Validate Input',
    type: 'validation',
    status: 'completed',
    startTime: new Date(Date.now() - 9000),
    endTime: new Date(Date.now() - 8000),
    duration: 1000,
    position: { x: 300, y: 200 },
    connections: ['process']
  },
  {
    id: 'process',
    name: 'Process Data',
    type: 'processing',
    status: 'running',
    startTime: new Date(Date.now() - 7500),
    position: { x: 500, y: 200 },
    connections: ['notify', 'store']
  },
  {
    id: 'notify',
    name: 'Send Notification',
    type: 'notification',
    status: 'pending',
    position: { x: 700, y: 150 },
    connections: ['end']
  },
  {
    id: 'store',
    name: 'Store Results',
    type: 'storage',
    status: 'pending',
    position: { x: 700, y: 250 },
    connections: ['end']
  },
  {
    id: 'end',
    name: 'End',
    type: 'end',
    status: 'pending',
    position: { x: 900, y: 200 },
    connections: []
  }
]

const mockSteps: ExecutionStep[] = [
  {
    timestamp: new Date(Date.now() - 10000),
    nodeId: 'start',
    event: 'started',
    message: 'Workflow execution started'
  },
  {
    timestamp: new Date(Date.now() - 9500),
    nodeId: 'start',
    event: 'completed',
    data: { trigger: 'webhook', payload: { userId: '123' } }
  },
  {
    timestamp: new Date(Date.now() - 9000),
    nodeId: 'validate',
    event: 'started',
    message: 'Validating input data'
  },
  {
    timestamp: new Date(Date.now() - 8000),
    nodeId: 'validate',
    event: 'completed',
    data: { valid: true, userId: '123', email: 'user@example.com' }
  },
  {
    timestamp: new Date(Date.now() - 7500),
    nodeId: 'process',
    event: 'started',
    message: 'Processing user data'
  }
]

export function ExecutionVisualizer({ executionId, workflowId, isLive = false }: ExecutionVisualizerProps) {
  const [nodes, setNodes] = useState<ExecutionNode[]>(mockNodes)
  const [steps, setSteps] = useState<ExecutionStep[]>(mockSteps)
  const [currentStep, setCurrentStep] = useState(steps.length - 1)
  const [isPlaying, setIsPlaying] = useState(isLive)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [showDataFlow, setShowDataFlow] = useState(true)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Simulate live updates for running executions
  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      // Simulate progress updates
      const runningNode = nodes.find(n => n.status === 'running')
      if (runningNode) {
        // Randomly complete or add new steps
        if (Math.random() > 0.7) {
          const newStep: ExecutionStep = {
            timestamp: new Date(),
            nodeId: runningNode.id,
            event: Math.random() > 0.8 ? 'failed' : 'completed',
            data: { result: 'processed', count: Math.floor(Math.random() * 100) }
          }
          setSteps(prev => [...prev, newStep])
        }
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [isLive, nodes])

  // Playback control
  useEffect(() => {
    if (!isPlaying || isLive) return

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 1000 / playbackSpeed)

    return () => clearInterval(interval)
  }, [isPlaying, playbackSpeed, steps.length, isLive])

  const getNodeStatusColor = (status: ExecutionNode['status']) => {
    switch (status) {
      case 'completed':
        return '#10B981'
      case 'running':
        return '#3B82F6'
      case 'failed':
        return '#EF4444'
      case 'pending':
        return '#6B7280'
      case 'skipped':
        return '#F59E0B'
      default:
        return '#6B7280'
    }
  }

  const getNodeIcon = (type: string, status: ExecutionNode['status']) => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4" />
    if (status === 'failed') return <XCircle className="w-4 h-4" />
    if (status === 'running') return <Activity className="w-4 h-4 animate-pulse" />
    
    switch (type) {
      case 'trigger':
        return <Play className="w-4 h-4" />
      case 'validation':
        return <AlertCircle className="w-4 h-4" />
      case 'processing':
        return <Zap className="w-4 h-4" />
      case 'notification':
        return <Activity className="w-4 h-4" />
      case 'storage':
        return <Download className="w-4 h-4" />
      default:
        return <Square className="w-4 h-4" />
    }
  }

  const handlePlayPause = () => {
    if (isLive) return
    setIsPlaying(!isPlaying)
  }

  const handleReset = () => {
    if (isLive) return
    setCurrentStep(0)
    setIsPlaying(false)
  }

  const handleStepChange = (step: number[]) => {
    if (isLive) return
    setCurrentStep(step[0])
  }

  const getExecutionProgress = () => {
    const completedNodes = nodes.filter(n => n.status === 'completed').length
    return (completedNodes / nodes.length) * 100
  }

  const getTotalDuration = () => {
    const completedNodes = nodes.filter(n => n.duration)
    return completedNodes.reduce((sum, node) => sum + (node.duration || 0), 0)
  }

  const selectedNodeData = selectedNode ? nodes.find(n => n.id === selectedNode) : null
  const selectedNodeSteps = selectedNode ? steps.filter(s => s.nodeId === selectedNode) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Execution Visualization
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isLive ? 'Live execution monitoring' : 'Execution playback'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={isLive ? "default" : "secondary"}>
            {isLive ? 'Live' : 'Playback'}
          </Badge>
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Execution Stats */}
      <div className="glass dark:glass-dark bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{getExecutionProgress().toFixed(0)}%</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Progress</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{getTotalDuration()}ms</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{nodes.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Nodes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{steps.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Events</div>
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      {!isLive && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <Button size="sm" onClick={handleReset}>
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button size="sm" onClick={handlePlayPause}>
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button size="sm" onClick={() => setCurrentStep(steps.length - 1)}>
                <SkipForward className="w-4 h-4" />
              </Button>
              
              <div className="flex-1">
                <Slider
                  value={[currentStep]}
                  onValueChange={handleStepChange}
                  max={steps.length - 1}
                  step={1}
                  className="w-full"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Speed:</span>
                <Slider
                  value={[playbackSpeed]}
                  onValueChange={(value) => setPlaybackSpeed(value[0])}
                  min={0.5}
                  max={3}
                  step={0.5}
                  className="w-20"
                />
                <span className="text-sm text-gray-600">{playbackSpeed}x</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workflow Canvas */}
        <div className="lg:col-span-2">
          <Card className="h-96">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Workflow Flow</span>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant={showDataFlow ? "default" : "outline"}
                    onClick={() => setShowDataFlow(!showDataFlow)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Data Flow
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                ref={canvasRef}
                className="relative w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden"
              >
                {/* Connections */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {nodes.map(node => 
                    node.connections.map(targetId => {
                      const target = nodes.find(n => n.id === targetId)
                      if (!target) return null
                      
                      const isActive = node.status === 'completed' || node.status === 'running'
                      
                      return (
                        <line
                          key={`${node.id}-${targetId}`}
                          x1={node.position.x + 60}
                          y1={node.position.y + 30}
                          x2={target.position.x}
                          y2={target.position.y + 30}
                          stroke={isActive ? '#3B82F6' : '#D1D5DB'}
                          strokeWidth={isActive ? 3 : 1}
                          strokeDasharray={isActive ? '0' : '5,5'}
                          className="transition-all duration-300"
                        />
                      )
                    })
                  )}
                </svg>

                {/* Nodes */}
                {nodes.map(node => (
                  <div
                    key={node.id}
                    className={`absolute cursor-pointer transition-all duration-300 ${
                      selectedNode === node.id ? 'scale-110 z-10' : 'z-0'
                    }`}
                    style={{
                      left: node.position.x,
                      top: node.position.y,
                      transform: selectedNode === node.id ? 'scale(1.1)' : 'scale(1)'
                    }}
                    onClick={() => setSelectedNode(node.id)}
                  >
                    <div 
                      className="w-16 h-16 rounded-lg border-2 flex items-center justify-center text-white shadow-lg"
                      style={{ 
                        backgroundColor: getNodeStatusColor(node.status),
                        borderColor: selectedNode === node.id ? '#1F2937' : 'transparent'
                      }}
                    >
                      {getNodeIcon(node.type, node.status)}
                    </div>
                    <div className="text-xs text-center mt-1 font-medium max-w-16 truncate">
                      {node.name}
                    </div>
                    {node.status === 'running' && (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-4 h-4 bg-blue-500 rounded-full animate-ping" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Data Flow Animation */}
                {showDataFlow && steps.slice(0, currentStep + 1).map((step, index) => {
                  if (step.event !== 'data_sent') return null
                  
                  const node = nodes.find(n => n.id === step.nodeId)
                  if (!node) return null
                  
                  return (
                    <div
                      key={`data-${index}`}
                      className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-pulse"
                      style={{
                        left: node.position.x + 30,
                        top: node.position.y + 30
                      }}
                    />
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Execution Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={getExecutionProgress()} className="mb-4" />
              <div className="space-y-2">
                {nodes.map(node => (
                  <div key={node.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center space-x-2">
                      {getNodeIcon(node.type, node.status)}
                      <span>{node.name}</span>
                    </span>
                    <Badge 
                      variant={node.status === 'completed' ? 'default' : 
                              node.status === 'failed' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {node.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Node Details */}
          {selectedNodeData && (
            <Card>
              <CardHeader>
                <CardTitle>Node Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="info">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="info">Info</TabsTrigger>
                    <TabsTrigger value="data">Data</TabsTrigger>
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="info" className="space-y-3">
                    <div>
                      <span className="text-sm font-medium">Name:</span>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedNodeData.name}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Type:</span>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedNodeData.type}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Status:</span>
                      <Badge className="ml-2">{selectedNodeData.status}</Badge>
                    </div>
                    {selectedNodeData.duration && (
                      <div>
                        <span className="text-sm font-medium">Duration:</span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{selectedNodeData.duration}ms</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="data">
                    <ScrollArea className="h-32">
                      <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">
                        {JSON.stringify(selectedNodeData.output || selectedNodeData.input || {}, null, 2)}
                      </pre>
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="logs">
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {selectedNodeSteps.map((step, index) => (
                          <div key={index} className="text-xs">
                            <span className="text-gray-500">{step.timestamp.toLocaleTimeString()}</span>
                            <span className="ml-2">{step.event}</span>
                            {step.message && (
                              <p className="text-gray-600 dark:text-gray-400 ml-4">{step.message}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}