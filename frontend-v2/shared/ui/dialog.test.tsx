import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog } from './dialog'

function renderDialog(overrides: Partial<React.ComponentProps<typeof Dialog>> = {}) {
  const onClose = vi.fn()
  const result = render(
    <Dialog open={true} onClose={onClose} title="Test Dialog" {...overrides}>
      <button>Action</button>
    </Dialog>
  )
  return { ...result, onClose }
}

describe('Dialog', () => {
  it('renders dialog with role and title when open', () => {
    renderDialog()
    expect(screen.getByRole('dialog', { name: /Test Dialog/i })).toBeInTheDocument()
  })

  it('renders children content', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    renderDialog({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', () => {
    const { onClose } = renderDialog()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()
    const overlay = screen.getByTestId('dialog-overlay')
    await user.click(overlay)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when clicking inside the dialog', () => {
    const { onClose } = renderDialog()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when the close button is clicked', () => {
    const { onClose } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders with aria-modal="true"', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('renders the dialog title', () => {
    renderDialog({ title: 'My Custom Title' })
    expect(screen.getByText('My Custom Title')).toBeInTheDocument()
  })
})
