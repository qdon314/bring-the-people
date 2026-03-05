import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreateShowModal } from './CreateShowModal'
import { ApiError } from '@/shared/api/client'

const noop = () => {}
const asyncNoop = async () => {}

function renderModal(overrides: Partial<React.ComponentProps<typeof CreateShowModal>> = {}) {
  return render(
    <CreateShowModal
      onClose={noop}
      onSubmit={asyncNoop}
      isPending={false}
      error={null}
      {...overrides}
    />
  )
}

describe('CreateShowModal', () => {
  it('renders the dialog with accessible role and label', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: /new show/i })).toBeInTheDocument()
  })

  it('renders all required form fields', () => {
    renderModal()
    expect(screen.getByLabelText(/artist name/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /city/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/venue/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/show date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/timezone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/capacity/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tickets total/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tickets sold/i)).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose on Escape when isPending', () => {
    const onClose = vi.fn()
    renderModal({ onClose, isPending: true })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('disables submit and cancel buttons while pending', () => {
    renderModal({ isPending: true })
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('shows "Creating…" label while pending', () => {
    renderModal({ isPending: true })
    expect(screen.getByText('Creating…')).toBeInTheDocument()
  })

  it('displays an API error message', () => {
    const error = new ApiError(422, 'Validation error', {})
    renderModal({ error })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('displays a generic error for non-ApiError', () => {
    const error = new Error('Network failure')
    renderModal({ error })
    expect(screen.getByRole('alert')).toHaveTextContent(/unexpected error/i)
  })

  it('calls onSubmit with form data on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderModal({ onSubmit })

    fireEvent.change(screen.getByLabelText(/artist name/i), { target: { value: 'Radiohead' } })
    fireEvent.change(screen.getByRole('textbox', { name: /city/i }), { target: { value: 'New York' } })
    fireEvent.change(screen.getByLabelText(/venue/i), { target: { value: 'MSG' } })
    fireEvent.change(screen.getByLabelText(/show date/i), { target: { value: '2026-06-15T19:00' } })
    fireEvent.change(screen.getByLabelText(/timezone/i), { target: { value: 'America/New_York' } })
    fireEvent.change(screen.getByLabelText(/capacity/i), { target: { value: '10000' } })
    fireEvent.change(screen.getByLabelText(/tickets total/i), { target: { value: '10000' } })
    fireEvent.change(screen.getByLabelText(/tickets sold/i), { target: { value: '5000' } })

    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        artist_name: 'Radiohead',
        city: 'New York',
        venue: 'MSG',
        show_time: '2026-06-15T19:00:00',
        capacity: 10000,
        tickets_total: 10000,
        tickets_sold: 5000,
        currency: 'USD',
      })
    )
  })
})
