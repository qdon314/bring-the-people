import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  describe('review statuses', () => {
    it('renders "Pending" for pending status', () => {
      render(<StatusBadge status="pending" />)
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('renders "Approved" for approved status', () => {
      render(<StatusBadge status="approved" />)
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })

    it('renders "Rejected" for rejected status', () => {
      render(<StatusBadge status="rejected" />)
      expect(screen.getByText('Rejected')).toBeInTheDocument()
    })

    it('applies yellow colour class for pending', () => {
      const { container } = render(<StatusBadge status="pending" />)
      expect(container.firstChild).toHaveClass('bg-yellow-100', 'text-yellow-800')
    })

    it('applies green colour class for approved', () => {
      const { container } = render(<StatusBadge status="approved" />)
      expect(container.firstChild).toHaveClass('bg-green-100', 'text-green-800')
    })

    it('applies red colour class for rejected', () => {
      const { container } = render(<StatusBadge status="rejected" />)
      expect(container.firstChild).toHaveClass('bg-red-100', 'text-red-800')
    })
  })

  describe('job statuses', () => {
    it('renders "Queued" for queued status', () => {
      render(<StatusBadge status="queued" />)
      expect(screen.getByText('Queued')).toBeInTheDocument()
    })

    it('renders "Running" for running status', () => {
      render(<StatusBadge status="running" />)
      expect(screen.getByText('Running')).toBeInTheDocument()
    })

    it('renders "Completed" for completed status', () => {
      render(<StatusBadge status="completed" />)
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('renders "Failed" for failed status', () => {
      render(<StatusBadge status="failed" />)
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('applies blue colour class for running', () => {
      const { container } = render(<StatusBadge status="running" />)
      expect(container.firstChild).toHaveClass('bg-blue-100', 'text-blue-800')
    })
  })

  describe('experiment statuses', () => {
    it('renders "Draft" for draft status', () => {
      render(<StatusBadge status="draft" />)
      expect(screen.getByText('Draft')).toBeInTheDocument()
    })

    it('renders "Active" for active status', () => {
      render(<StatusBadge status="active" />)
      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('renders "Awaiting Approval" for awaiting_approval status', () => {
      render(<StatusBadge status="awaiting_approval" />)
      expect(screen.getByText('Awaiting Approval')).toBeInTheDocument()
    })

    it('renders "Decided" for decided status', () => {
      render(<StatusBadge status="decided" />)
      expect(screen.getByText('Decided')).toBeInTheDocument()
    })
  })

  it('accepts and applies additional className', () => {
    const { container } = render(<StatusBadge status="pending" className="extra-class" />)
    expect(container.firstChild).toHaveClass('extra-class')
  })
})
