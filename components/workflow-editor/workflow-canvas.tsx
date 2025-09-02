"use client"

import { useCallback, useState } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Save, Play, Download, Upload } from 'lucide-react'
import { EngineType } from '@/types/workflow'

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start' },
    position: { x: 250, y: 25 },
  },
]

const initialEdges: Edge[] = []

interface WorkflowCanvasProps {
  engineType: EngineType
  workflowName: string
  onSave?: () => void
  onRun?: () => void
}

export function WorkflowCanvas({ 
  engineType, 
  workflowName, 
  onSave, 
  onRun 
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [isRunning, setIsRunning] = useState(false)

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const handleRun = async () => {
    setIsRunning(true)
    onRun?.()
    // Simulate execution
    setTimeout(() => setIsRunning(false), 3000)
  }

  const engineColors = {
    [EngineType.LANGFLOW]: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
    [EngineType.N8N]: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
    [EngineType.LANGSMITH]: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
  }

  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        className="bg-gray-50 dark:bg-gray-800"
      >
        <Controls className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
        <MiniMap 
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          nodeColor="#3b82f6"
        />
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={12} 
          size={1}
          className="bg-gray-50 dark:bg-gray-800"
        />
        
        {/* Top Panel */}
        <Panel position="top-left" className="m-4">
          <div className="flex items-center space-x-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {workflowName}
              </h2>
              <Badge className={engineColors[engineType]}>
                {engineType}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={onSave}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button 
                size="sm" 
                onClick={handleRun}
                disabled={isRunning}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="w-4 h-4 mr-2" />
                {isRunning ? 'Running...' : 'Run'}
              </Button>
            </div>
          </div>
        </Panel>

        {/* Node Count Panel */}
        <Panel position="bottom-right" className="m-4">
          <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Nodes: {nodes.length} | Edges: {edges.length}
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}