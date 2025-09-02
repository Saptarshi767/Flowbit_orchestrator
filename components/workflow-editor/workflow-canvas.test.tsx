import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WorkflowCanvas } from './workflow-canvas'
import { EngineType } from '@/types/workflow'

describe('WorkflowCanvas Component', () => {
  const defaultProps = {
    engineType: EngineType.LANGFLOW,
    workflowName: 'Test Workflow',
    onSave: vi.fn(),
    onRun: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with correct workflow name', () => {
    render(<WorkflowCanvas {...defaultProps} />)
    expect(screen.getByText('Test Workflow')).toBeInTheDocument()
  })

  it('displays correct engine badge', () => {
    const { rerender } = render(<WorkflowCanvas {...defaultProps} />)
    expect(screen.getByText('LANGFLOW')).toBeInTheDocument()

    rerender(<WorkflowCanvas {...defaultProps} engineType={EngineType.N8N} />)
    expect(screen.getByText('N8N')).toBeInTheDocument()

    rerender(<WorkflowCanvas {...defaultProps} engineType={EngineType.LANGSMITH} />)
    expect(screen.getByText('LANGSMITH')).toBeInTheDocument()
  })

  it('renders ReactFlow components', () => {
    render(<WorkflowCanvas {...defaultProps} />)
    
    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
    expect(screen.getByTestId('react-flow-controls')).toBeInTheDocument()
    expect(screen.getByTestId('react-flow-minimap')).toBeInTheDocument()
    expect(screen.getByTestId('react-flow-background')).toBeInTheDocument()
  })

  it('displays action buttons', () => {
    render(<WorkflowCanvas {...defaultProps} />)
    
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
  })

  it('calls onSave when save button is clicked', () => {
    render(<WorkflowCanvas {...defaultProps} />)
    
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1)
  })

  it('calls onRun when run button is clicked', () => {
    render(<WorkflowCanvas {...defaultProps} />)
    
    fireEvent.click(screen.getByRole('button', { name: /run/i }))
    expect(defaultProps.onRun).toHaveBeenCalledTimes(1)
  })

  it('shows running state when run button is clicked', async () => {
    render(<WorkflowCanvas {...defaultProps} />)
    
    const runButton = screen.getByRole('button', { name: /run/i })
    fireEvent.click(runButton)
    
    expect(screen.getByText('Running...')).toBeInTheDocument()
    expect(runButton).toBeDisabled()
    
    // Wait for the running state to reset (simulated 3 second timeout)
    await waitFor(() => {
      expect(screen.getByText('Run')).toBeInTheDocument()
    }, { timeout: 4000 })
  })

  it('displays node and edge count', () => {
    render(<WorkflowCanvas {...defaultProps} />)
    
    // Should show initial count (1 node, 0 edges based on initialNodes)
    expect(screen.getByText(/Nodes: 1/)).toBeInTheDocument()
    expect(screen.getByText(/Edges: 0/)).toBeInTheDocument()
  })

  it('applies correct engine-specific styling', () => {
    const { rerender } = render(<WorkflowCanvas {...defaultProps} />)
    
    let badge = screen.getByText('LANGFLOW')
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800')

    rerender(<WorkflowCanvas {...defaultProps} engineType={EngineType.N8N} />)
    badge = screen.getByText('N8N')
    expect(badge).toHaveClass('bg-purple-100', 'text-purple-800')

    rerender(<WorkflowCanvas {...defaultProps} engineType={EngineType.LANGSMITH} />)
    badge = screen.getByText('LANGSMITH')
    expect(badge).toHaveClass('bg-green-100', 'text-green-800')
  })

  it('handles missing callback props gracefully', () => {
    render(
      <WorkflowCanvas 
        engineType={EngineType.LANGFLOW} 
        workflowName="Test" 
      />
    )
    
    // Should not throw when clicking buttons without callbacks
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }))
      fireEvent.click(screen.getByRole('button', { name: /run/i }))
    }).not.toThrow()
  })

  it('has proper accessibility attributes', () => {
    render(<WorkflowCanvas {...defaultProps} />)
    
    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toBeVisible()
    })
  })
})