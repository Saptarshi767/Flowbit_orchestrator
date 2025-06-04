"use client"

import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import Link from "next/link"

interface DashboardHeaderProps {
  onCreateWorkflow: () => void
}

export function DashboardHeader({ onCreateWorkflow }: DashboardHeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Workflow Executions</h1>
            <p className="text-sm text-gray-500">Monitor and manage your automation workflows</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search executions..." className="pl-10 w-64" />
          </div>

          <Button onClick={onCreateWorkflow} className="bg-[#7575e4] hover:bg-[#6565d4] text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Workflow
          </Button>

          <Link href="/sample-data">
            <Button variant="outline">View Sample Data</Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
