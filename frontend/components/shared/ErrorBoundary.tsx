'use client'
import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-6 bg-danger-light rounded-lg text-danger" role="alert">
          <p className="font-medium">Something went wrong</p>
          <p className="text-sm mt-1">{this.state.error?.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
