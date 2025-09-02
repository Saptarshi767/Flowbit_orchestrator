import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrchestrationDashboard } from './orchestration-dashboard'

// Mock the child components
vi.mock('./layout/dashboard-layout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  )
}))

vi.mock('./dashboard/stats-cards', () => ({
  StatsCards: ({ stats }: { stats: any }) => (
    <div data-testid="stats-cards">
      <span>Total: {stats.totalWorkflows}</span>
      <span>Active: {stats.activeExecutions}</span>
    </div>
  )
}))

vi.mock('./dashboard/recent-executions', () => ({
  RecentExecutions: ({ executions }: { executions: any[] }) => (
    <div data-testid="recent-executions">
      <span>Executions: {executions.length}</span>
    </div>
  )
}))

vi.mock('./dashboard/workflow-overview', () => ({
  WorkflowOverview: ({ workflows }: { workflows: any[] }) => (
    <div data-testid="workflow-overview">
      <span>Workflows: {workflows.length}</span>
    </div>
  )
}))

describe('OrchestrationDashboard Component', () => {
  it('renders within dashboard layout', () => {
    render(<OrchestrationDashboard />)
    expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
  })

  it('displays main dashboard title', () => {
    render(<OrchestrationDashboard />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('shows dashboard description', () => {
    render(<OrchestrationDashboard />)
    expect(screen.getByText('Monitor your AI workflows and executions')).toBeInTheDocument()
  })

  it('renders stats cards with mock data', () => {
    render(<OrchestrationDashboard />)
    
    const statsCards = screen.getByTestId('stats-cards')
    expect(statsCards).toBeInTheDocument()
    expect(statsCards).toHaveTextContent('Total: 24')
    expect(statsCards).toHaveTextContent('Active: 3')
  })

  it('renders recent executions component', () => {
    render(<OrchestrationDashboard />)
    
    const recentExecutions = screen.getByTestId('recent-executions')
    expect(recentExecutions).toBeInTheDocument()
    expect(recentExecutions).toHaveTextContent('Executions: 4') // Based on mock data
  })

  it('renders workflow overview component', () => {
    render(<OrchestrationDashboard />)
    
    const workflowOverview = screen.getByTestId('workflow-overview')
    expect(workflowOverview).toBeInTheDocument()
    expect(workflowOverview).toHaveTextContent('Workflows: 3') // Based on mock data
  })

  it('has proper layout structure', () => {
    render(<OrchestrationDashboard />)
    
    // Check for main container with proper spacing
    const mainContainer = screen.getByTestId('dashboard-layout').firstChild
    expect(mainContainer).toHaveClass('space-y-6')
  })

  it('displays components in correct grid layout', () => {
    render(<OrchestrationDashboard />)
    
    // The main content should be in a grid layout
    const gridContainer = screen.getByTestId('dashboard-layout')
      .querySelector('.grid.grid-cols-1.lg\\:grid-cols-2')
    
    expect(gridContainer).toBeInTheDocument()
  })

  it('renders all main sections', () => {
    render(<OrchestrationDashboard />)
    
    // Header section
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    
    // Stats section
    expect(screen.getByTestId('stats-cards')).toBeInTheDocument()
    
    // Main content grid
    expect(screen.getByTestId('recent-executions')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-overview')).toBeInTheDocument()
  })

  it('uses proper heading hierarchy', () => {
    render(<OrchestrationDashboard />)
    
    const mainHeading = screen.getByRole('heading', { level: 1 })
    expect(mainHeading).toHaveTextContent('Dashboard')
    expect(mainHeading).toHaveClass('text-3xl', 'font-bold')
  })

  it('applies correct styling classes', () => {
    render(<OrchestrationDashboard />)
    
    const title = screen.getByText('Dashboard')
    expect(title).toHaveClass('text-3xl', 'font-bold', 'text-gray-900', 'dark:text-white')
    
    const description = screen.getByText('Monitor your AI workflows and executions')
    expect(description).toHaveClass('text-gray-600', 'dark:text-gray-400')
  })
})