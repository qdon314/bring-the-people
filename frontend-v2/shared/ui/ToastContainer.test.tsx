import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ToastContainer } from './ToastContainer'
import { showToast } from './toast'

describe('ToastContainer', () => {
  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer />)
    expect(container.firstChild).toBeNull()
  })

  it('shows a success toast when showToast is called', () => {
    render(<ToastContainer />)
    act(() => {
      showToast('Segment approved', 'success')
    })
    expect(screen.getByText('Segment approved')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error toast', () => {
    render(<ToastContainer />)
    act(() => {
      showToast('Something went wrong', 'error')
    })
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('dismisses toast when dismiss button is clicked', () => {
    render(<ToastContainer />)
    act(() => {
      showToast('Segment approved', 'success')
    })
    expect(screen.getByText('Segment approved')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText('Segment approved')).not.toBeInTheDocument()
  })

  it('renders multiple toasts', () => {
    render(<ToastContainer />)
    act(() => {
      showToast('First toast', 'info')
      showToast('Second toast', 'success')
    })
    expect(screen.getByText('First toast')).toBeInTheDocument()
    expect(screen.getByText('Second toast')).toBeInTheDocument()
  })

  it('has aria-live region', () => {
    const { container } = render(<ToastContainer />)
    act(() => {
      showToast('Live region test', 'info')
    })
    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeInTheDocument()
  })
})
