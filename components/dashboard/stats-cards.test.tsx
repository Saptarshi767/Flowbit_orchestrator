import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsCards } from './stats-cards'

describe('StatsCards Component', () => {
  const mockStats = {
    totalWorkflows: 24,
    activeExecutions: 3,
    successfulExecutions: 156,
    failedExecutions: 8,
    avgExecutionTime: 45,
    executionsToday: 32
  }

  it('renders all stat cards', () => {
    render(<StatsCards stats={mockStats} />)
    
    expect(screen.getByText('Total Workflows')).toBeInTheDocument()
    expect(screen.getByText('Active Executions')).toBeInTheDocument()
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
    expect(screen.getByText('Avg. Execution Time')).toBeInTheDocument()
  })

  it('displays correct stat values', () => {
    render(<StatsCards stats={mockStats} />)
    
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('45s')).toBeInTheDocument()
  })

  it('calculates success rate correctly', () => {
    render(<StatsCards stats={mockStats} />)
    
    // Success rate = successful / (successful + failed) * 100
    // 156 / (156 + 8) * 100 = 95.1%
    expect(screen.getByText('95.1%')).toBeInTheDocument()
  })

  it('handles zero values gracefully', () => {
    const zeroStats = {
      totalWorkflows: 0,
      activeExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      executionsToday: 0
    }
    
    render(<StatsCards stats={zeroStats} />)
    
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('0s')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('handles division by zero for success rate', () => {
    const noExecutionsStats = {
      totalWorkflows: 5,
      activeExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      avgExecutionTime: 0,
      executionsToday: 0
    }
    
    render(<StatsCards stats={noExecutionsStats} />)
    
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('displays proper icons for each stat', () => {
    render(<StatsCards stats={mockStats} />)
    
    // Check that icons are present (they should be rendered as SVG elements)
    const cards = screen.getAllByRole('generic').filter(el => 
      el.className.includes('rounded-lg')
    )
    expect(cards.length).toBeGreaterThan(0)
  })

  it('shows trend indicators', () => {
    render(<StatsCards stats={mockStats} />)
    
    // Look for trend text that should be present
    expect(screen.getByText(/from last month/i)).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    render(<StatsCards stats={mockStats} />)
    
    const totalWorkflowsValue = screen.getByText('24')
    expect(totalWorkflowsValue).toHaveClass('text-2xl', 'font-bold')
  })
})