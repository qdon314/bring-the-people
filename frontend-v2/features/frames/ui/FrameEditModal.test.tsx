const mockUpdate = vi.fn()

vi.mock('../mutations', () => ({
  useUpdateFrame: () => ({
    mutate: mockUpdate,
    isPending: false,
    isError: false,
  }),
  useApproveFrame: () => ({ mutate: vi.fn(), isPending: false }),
  useRejectFrame: () => ({ mutate: vi.fn(), isPending: false }),
  useUndoFrameReview: () => ({ mutate: vi.fn(), isPending: false }),
}))

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FrameEditModal } from './FrameEditModal'
import type { FrameResponse } from '../api'

const SHOW_ID = 'show-1'

const frame: FrameResponse = {
  frame_id: 'frame-1',
  show_id: SHOW_ID,
  segment_id: 'seg-1',
  cycle_id: 'cycle-1',
  hypothesis: 'Rock fans respond to energy',
  promise: 'The most electrifying show of the year',
  evidence_refs: [],
  channel: 'email',
  risk_notes: 'Might alienate casual fans',
  review_status: 'pending',
  reviewed_at: null,
  reviewed_by: null,
}

function renderModal(overrides: { open?: boolean; onClose?: () => void } = {}) {
  const onClose = overrides.onClose ?? vi.fn()
  return {
    ...render(
      <FrameEditModal
        frame={frame}
        showId={SHOW_ID}
        open={overrides.open ?? true}
        onClose={onClose}
      />
    ),
    onClose,
  }
}

describe('FrameEditModal', () => {
  beforeEach(() => {
    mockUpdate.mockReset()
  })

  describe('rendering', () => {
    it('renders dialog when open', () => {
      renderModal()
      expect(screen.getByRole('dialog', { name: /edit frame/i })).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      renderModal({ open: false })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('pre-fills hypothesis field', () => {
      renderModal()
      expect(screen.getByLabelText(/hypothesis/i)).toHaveValue('Rock fans respond to energy')
    })

    it('pre-fills promise field', () => {
      renderModal()
      expect(screen.getByLabelText(/promise/i)).toHaveValue('The most electrifying show of the year')
    })

    it('pre-fills channel field', () => {
      renderModal()
      expect(screen.getByLabelText(/channel/i)).toHaveValue('email')
    })

    it('pre-fills risk notes field', () => {
      renderModal()
      expect(screen.getByLabelText(/risk notes/i)).toHaveValue('Might alienate casual fans')
    })

    it('renders Save and Cancel buttons', () => {
      renderModal()
      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
    })
  })

  describe('form validation', () => {
    it('shows error when hypothesis is empty on submit', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.clear(screen.getByLabelText(/hypothesis/i))
      await user.click(screen.getByRole('button', { name: /^save$/i }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/hypothesis is required/i)
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('shows error when promise is empty on submit', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.clear(screen.getByLabelText(/promise/i))
      await user.click(screen.getByRole('button', { name: /^save$/i }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/promise is required/i)
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('shows error when channel is empty on submit', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.clear(screen.getByLabelText(/channel/i))
      await user.click(screen.getByRole('button', { name: /^save$/i }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/channel is required/i)
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  describe('submission', () => {
    it('calls updateMutation with all fields on valid submit', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.clear(screen.getByLabelText(/hypothesis/i))
      await user.type(screen.getByLabelText(/hypothesis/i), 'Updated hypothesis')
      await user.click(screen.getByRole('button', { name: /^save$/i }))
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledOnce())
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          frameId: frame.frame_id,
          hypothesis: 'Updated hypothesis',
        }),
        expect.any(Object)
      )
    })
  })

  describe('close behaviour', () => {
    it('calls onClose when Cancel is clicked', () => {
      const { onClose } = renderModal()
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('calls onClose when dialog close button is clicked', () => {
      const { onClose } = renderModal()
      fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('resets form to original values when closed and reopened', async () => {
      const user = userEvent.setup()
      const { onClose, rerender } = renderModal()

      await user.clear(screen.getByLabelText(/hypothesis/i))
      await user.type(screen.getByLabelText(/hypothesis/i), 'Changed hypothesis')

      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(onClose).toHaveBeenCalledOnce()

      rerender(
        <FrameEditModal
          frame={frame}
          showId={SHOW_ID}
          open={true}
          onClose={onClose}
        />
      )

      expect(screen.getByLabelText(/hypothesis/i)).toHaveValue('Rock fans respond to energy')
    })
  })
})
