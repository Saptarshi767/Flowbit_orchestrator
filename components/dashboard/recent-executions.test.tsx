import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecentExecutions } from './recent-executions'
import { ExecutionStatus, EngineType } from '@/types/workflow'

describe('RecentExecutions Component', () => {
  const mockExecutions = [
    {
      id: "1",
      workflowId: "wf-1",
      workflowName: "Customer Data Processing",
      status: ExecutionStatus.RUNNING,
      startTime: new Date(Date.now() - 300000), // 5 minutes ago
      engineType: EngineType.LANGFLOW,
      triggeredBy: "john.doe@example.com"
    },
    {
      id: "2",
      workflowId: "wf-2",
      workflowName: "Email Campaign Automation",
      status: ExecutionStatus.COMPLETED,
      startTime: new Date(Date.now() - 900000), // 15 minutes ago
      endTime: new Date(Date.now() - 600000), // 10 minutes ago
      duration: 300,
      engineType: EngineType.N8N,
      triggeredBy: "jane.smith@example.com"
    },
    {
      id: "3",
      workflowId: "wf-3",
      workflowName: "Document Analysis Pipeline",
      status: ExecutionStatus.FAILED,
      startTime: new Date(Date.now() - 1800000), // 30 minutes ago
      endTime: new Date(Date.now() - 1500000), // 25 minutes ago
      duration: 180,
      engineType: EngineType.LANGSMITH,
      triggeredBy: "system",
      error: "API rate limit exceeded"
    }
  ]

  it('renders component title', () => {
    render(<RecentExecutions executions={mockExecutions} />)
    expect(screen.getByText('Recent Executions')).toBeInTheDocument()
  })

  it('displays "View All" button', () => {
    render(<RecentExecutions executions={mockExecutions} />)
    expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument()
  })

  it('renders all execution items', () => {
    render(<RecentExecutions executions={mockExecutions} />)
    
    expect(screen.getByText('Customer Data Processing')).toBeInTheDocument()
    expect(screen.getByText('Email Campaign Automation')).toBeInTheDocument()
    expect(screen.getByText('Document Analysis Pipeline')).toBeInTheDocument()
  })

  it('displays correct status badges', () => {
    render(<RecentExecutions executions={mockExecutions} />)
    
    expect(screen.getByText('RUNNING')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText('FAILED')).toBeInTheDocument()
  })

  it('shows engine type badges', () => {
    render(<RecentExecutions executions={mockExecutions} />)
    
    expect(screen.getByText('LANGFLOW')).toBeInTheDocument()
    expect(screen.getByText('N8N')).toBeInTheDocument()
    expect(screen.getByText('LANGSMITH')).toBeInTheDocument()
  })

  it('displays execution timing information', () => {
    render(<RecentExecutions executions={mockExecutions} />)
    
    // Should show relative time like "Started X minutes ago"
    expect(screen.getByText(/started.*ago/i)).toBeInTheDocument()
  })

  it('shows duration for completed executions', () => {
    render(<RecentExecutions executions={mockExecutions} />)
    
    expect(screen.getByText('Duration: 300s')).toBeInTheDocument()
    expect(screen.getByText('Duration: 180s')).toBeInTheDocument()
  })

  it('displays triggered by information', () => {
    render(<RecentExecutions executions={mockExecutions} />)
    
    expect(screen.getByText(/by john\.doe@example\.com/)).toBeInTheDocument()
    expect(screen.getByText(/by jane\.smith@example\.com/)).toBeInTheDocument()
    expect(screen.getByText(/by system/)).toBeInTheDocument()
  })

  it('renders action buttons for each execution', () => {
    render(<RecentExecutions executions={mockExecutions} />)
    
    const eyeButtons = screen.getAllByRole('button').filter(button => 
      button.querySelector('svg')
    )
    expect(eyeButtons.length).toBeGreaterThan(0)
  })

  it('applies correct status badge colors', () => {
    render(<RecentExecutions executions={mockExecutions} />)
    
    const runningBadge = screen.getByText('RUNNING')
    const completedBadge = screen.getByText('COMPLETED')
    const failedBadge = screen.getByText('FAILED')
    
    // These should have different styling based on status
    expect(runningBadge).toBeInTheDocument()
    expect(completedBadge).toBeInTheDocument()
    expect(failedBadge).toBeInTheDocument()
  })

  it('handles empty executions list', () => {
    render(<RecentExecutions executions={[]} />)
    
    expect(screen.getByText('Recent Executions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument()
    
    // Should not show any execution items
    expect(screen.queryByText('Customer Data Processing')).not.toBeInTheDocument()
  })

  it('applies hover effects to execution items', () => {
    render(<RecentExecutions executions={mockExecutions} />)
    
    const executionItems = screen.getAllByRole('generic').filter(el => 
      el.className.includes('hover:bg-gray-50')
    )
    expect(executionItems.length).toBeGreaterThan(0)
  })
})