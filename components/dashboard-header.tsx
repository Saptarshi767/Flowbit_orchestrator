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
    <header className="glass dark:glass-dark border-b border-flowbit-blue bg-gradient-to-r from-flowbit-blue/90 to-flowbit-deep/80 dark:bg-gradient-to-r dark:from-flowbit-blue/80 dark:to-flowbit-deep/90 bg-opacity-80 px-8 py-6 rounded-t-3xl shadow-xl text-white">
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
            <Button
              className="bg-flowbit-teal text-white border border-flowbit-teal shadow hover:bg-flowbit-blue hover:text-white dark:bg-white dark:text-flowbit-blue dark:border-flowbit-blue dark:hover:bg-flowbit-blue dark:hover:text-white transition"
            >
              View Sample Data
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
