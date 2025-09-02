"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Workflow, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp,
  Activity
} from "lucide-react"

interface StatsCardsProps {
  stats: {
    totalWorkflows: number
    activeExecutions: number
    successfulExecutions: number
    failedExecutions: number
    avgExecutionTime: number
    executionsToday: number
  }
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: "Total Workflows",
      value: stats.totalWorkflows,
      icon: Workflow,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      title: "Active Executions",
      value: stats.activeExecutions,
      icon: Play,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-900/20"
    },
    {
      title: "Successful Today",
      value: stats.successfulExecutions,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20"
    },
    {
      title: "Failed Today",
      value: stats.failedExecutions,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-900/20"
    },
    {
      title: "Avg Execution Time",
      value: `${stats.avgExecutionTime}s`,
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
      title: "Executions Today",
      value: stats.executionsToday,
      icon: Activity,
      color: "text-teal-600",
      bgColor: "bg-teal-50 dark:bg-teal-900/20"
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
      {cards.map((card, index) => (
        <Card key={index} className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {card.value}
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-xs text-green-600">+12% from last week</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}