import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExecutionDetailsModal } from './execution-details-modal'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ExecutionDetailsModal Component', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    executionId: 'test-execution-id',
    engine: 'langflow'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'test-execution-id',
        workflowName: 'Test Workflow',
        status: 'completed',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T10:05:00Z',
        duration: 300,
        engine: 'langflow',
        logs: ['Step 1 completed', 'Step 2 completed'],
        output: 'Execution completed successfully'
      })
    })
  })

  it('renders modal when open', async () => {
    render(<ExecutionDetailsModal {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Execution Details')).toBeInTheDocument()
    })
  })

  it('does not render when closed', () => {
    render(<ExecutionDetailsModal {...defaultProps} open={false} />)
    
    expect(screen.queryByText('Execution Details')).not.toBeInTheDocument()
  })

  it('fetches execution details on mount', async () => {
    render(<ExecutionDetailsModal {...defaultProps} />)
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/executions/test-execution-id?engine=langflow`
      )
    })
  })

  it('displays execution information', async () => {
    render(<ExecutionDetailsModal {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      expect(screen.getByText('completed')).toBeInTheDocument()
      expect(screen.getByText('langflow')).toBeInTheDocument()
    })
  })

  it('shows loading state initially', () => {
    mockFetch.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({})
      }), 100))
    )
    
    render(<ExecutionDetailsModal {...defaultProps} />)
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('displays error message on fetch failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Execution not found' })
    })
    
    render(<ExecutionDetailsModal {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load execution details/i)).toBeInTheDocument()
    })
  })

  it('shows execution logs', async () => {
    render(<ExecutionDetailsModal {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Step 1 completed')).toBeInTheDocument()
      expect(screen.getByText('Step 2 completed')).toBeInTheDocument()
    })
  })

  it('displays execution output', async () => {
    render(<ExecutionDetailsModal {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Execution completed successfully')).toBeInTheDocument()
    })
  })

  it('calls onOpenChange when close button is clicked', async () => {
    render(<ExecutionDetailsModal {...defaultProps} />)
    
    await waitFor(() => {
      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('handles missing executionId gracefully', () => {
    render(<ExecutionDetailsModal {...defaultProps} executionId={null} />)
    
    expect(mockFetch).not.toHaveBeenCalled()
    expect(screen.queryByText('Execution Details')).not.toBeInTheDocument()
  })

  it('formats duration correctly', async () => {
    render(<ExecutionDetailsModal {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('5m 0s')).toBeInTheDocument()
    })
  })

  it('shows different status badges', async () => {
    const { rerender } = render(<ExecutionDetailsModal {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    // Test with different status
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'test-execution-id',
        status: 'failed',
        workflowName: 'Test Workflow'
      })
    })

    rerender(<ExecutionDetailsModal {...defaultProps} executionId="different-id" />)
    
    await waitFor(() => {
      expect(screen.getByText('failed')).toBeInTheDocument()
    })
  })

  it('displays timestamps in readable format', async () => {
    render(<ExecutionDetailsModal {...defaultProps} />)
    
    await waitFor(() => {
      // Should show formatted dates
      expect(screen.getByText(/2024/)).toBeInTheDocument()
    })
  })

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    
    render(<ExecutionDetailsModal {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load execution details/i)).toBeInTheDocument()
    })
  })
})