"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { 
  Database, 
  Mail, 
  MessageSquare, 
  FileText, 
  Image, 
  Code, 
  Zap,
  Filter,
  GitBranch,
  Clock,
  Globe,
  Brain
} from "lucide-react"
import { EngineType } from "@/types/workflow"

interface NodeType {
  id: string
  name: string
  description: string
  icon: React.ComponentType<any>
  category: string
  engineTypes: EngineType[]
}

const nodeTypes: NodeType[] = [
  {
    id: 'data-input',
    name: 'Data Input',
    description: 'Input data from various sources',
    icon: Database,
    category: 'Input/Output',
    engineTypes: [EngineType.LANGFLOW, EngineType.N8N, EngineType.LANGSMITH]
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Send or receive emails',
    icon: Mail,
    category: 'Communication',
    engineTypes: [EngineType.N8N]
  },
  {
    id: 'chat',
    name: 'Chat Model',
    description: 'AI chat and conversation',
    icon: MessageSquare,
    category: 'AI/ML',
    engineTypes: [EngineType.LANGFLOW, EngineType.LANGSMITH]
  },
  {
    id: 'document',
    name: 'Document Processor',
    description: 'Process and analyze documents',
    icon: FileText,
    category: 'Processing',
    engineTypes: [EngineType.LANGFLOW, EngineType.LANGSMITH]
  },
  {
    id: 'image',
    name: 'Image Processor',
    description: 'Process and analyze images',
    icon: Image,
    category: 'Processing',
    engineTypes: [EngineType.LANGFLOW]
  },
  {
    id: 'code',
    name: 'Code Executor',
    description: 'Execute custom code',
    icon: Code,
    category: 'Processing',
    engineTypes: [EngineType.N8N, EngineType.LANGFLOW]
  },
  {
    id: 'trigger',
    name: 'Trigger',
    description: 'Workflow triggers and webhooks',
    icon: Zap,
    category: 'Triggers',
    engineTypes: [EngineType.N8N]
  },
  {
    id: 'filter',
    name: 'Filter',
    description: 'Filter and transform data',
    icon: Filter,
    category: 'Processing',
    engineTypes: [EngineType.N8N, EngineType.LANGFLOW]
  },
  {
    id: 'condition',
    name: 'Condition',
    description: 'Conditional logic and branching',
    icon: GitBranch,
    category: 'Logic',
    engineTypes: [EngineType.N8N, EngineType.LANGFLOW]
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    description: 'Schedule and time-based triggers',
    icon: Clock,
    category: 'Triggers',
    engineTypes: [EngineType.N8N]
  },
  {
    id: 'api',
    name: 'API Call',
    description: 'Make HTTP API requests',
    icon: Globe,
    category: 'Integration',
    engineTypes: [EngineType.N8N, EngineType.LANGFLOW]
  },
  {
    id: 'llm',
    name: 'LLM Chain',
    description: 'Large Language Model chains',
    icon: Brain,
    category: 'AI/ML',
    engineTypes: [EngineType.LANGSMITH, EngineType.LANGFLOW]
  }
]

const categories = Array.from(new Set(nodeTypes.map(node => node.category)))

interface NodePaletteProps {
  selectedEngine: EngineType
  onNodeDrag?: (nodeType: NodeType) => void
}

export function NodePalette({ selectedEngine, onNodeDrag }: NodePaletteProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredNodes = nodeTypes.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesEngine = node.engineTypes.includes(selectedEngine)
    const matchesCategory = !selectedCategory || node.category === selectedCategory
    
    return matchesSearch && matchesEngine && matchesCategory
  })

  const handleDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeType))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Node Palette</CardTitle>
        <div className="space-y-3">
          <Input
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          <div className="flex flex-wrap gap-1">
            <Badge
              variant={selectedCategory === null ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Badge>
            {categories.map(category => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-2 max-h-96 overflow-y-auto p-4">
          {filteredNodes.map(node => (
            <div
              key={node.id}
              draggable
              onDragStart={(e) => handleDragStart(e, node)}
              className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-move hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <node.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {node.name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {node.category}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {node.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}