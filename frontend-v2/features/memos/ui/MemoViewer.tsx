'use client'

import React from 'react'
import { useMemo } from '../queries'
import { MemoView } from './MemoView'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'

interface MemoViewerProps {
  memoId?: string
}

function MemoViewerSkeleton() {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-6"
      aria-busy="true"
      aria-label="Loading memo"
    >
      <div className="mb-4 space-y-2 border-b border-gray-100 pb-4">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-48 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`h-3 animate-pulse rounded bg-gray-100 ${i === 5 ? 'w-3/4' : 'w-full'}`} />
        ))}
      </div>
    </div>
  )
}

function MemoViewerPlaceholder() {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50">
      <p className="text-sm text-gray-400">Select a memo to view</p>
    </div>
  )
}

export function MemoViewer({ memoId }: MemoViewerProps) {
  const { data: memo, isLoading, isError, refetch } = useMemo(memoId ?? '')

  if (!memoId) {
    return <MemoViewerPlaceholder />
  }

  if (isLoading) {
    return <MemoViewerSkeleton />
  }

  if (isError) {
    return (
      <ErrorBanner
        message="Failed to load memo"
        onRetry={() => void refetch()}
      />
    )
  }

  if (!memo) {
    return <MemoViewerPlaceholder />
  }

  return <MemoView memo={memo} />
}
