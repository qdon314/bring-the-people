import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpinnerIcon } from './SpinnerIcon'

describe('SpinnerIcon', () => {
  it('renders an SVG element', () => {
    const { container } = render(<SpinnerIcon />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('has animate-spin class', () => {
    const { container } = render(<SpinnerIcon />)
    expect(container.querySelector('svg')).toHaveClass('animate-spin')
  })

  it('is aria-hidden by default', () => {
    const { container } = render(<SpinnerIcon />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders with aria-label when provided', () => {
    render(<SpinnerIcon aria-label="Loading" />)
    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    const { container } = render(<SpinnerIcon className="h-6 w-6 text-red-500" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('h-6', 'w-6', 'text-red-500')
  })
})
