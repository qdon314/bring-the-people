'use client'

import React from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useMemos } from '../queries'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'
import { EmptyState } from '@/shared/ui/EmptyState'
import type { MemoResponse } from '../api'

interface MemoHistoryListProps {
  showId: string
  selectedMemoId?: string
}

function formatDateRange(cycleStart: string, cycleEnd: string): string {
  const start = new Date(cycleStart)
  const end = new Date(cycleEnd)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function MemoHistoryItem({
  memo,
  isSelected,
  onSelect,
}: {
  memo: MemoResponse
  isSelected: boolean
  onSelect: (memoId: string) => void
}) {
  return (
    <button
      onClick={() => onSelect(memo.memo_id)}
      className={[
        'w-full rounded-lg border px-4 py-3 text-left transition-colors',
        isSelected
          ? 'border-blue-500 bg-blue-50 text-blue-900'
          : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50',
      ].join(' ')}
    >
      <p className="text-sm font-medium">
        {formatDateRange(memo.cycle_start, memo.cycle_end)}
      </p>
      {memo.cycle_id && (
        <p className="mt-0.5 text-xs text-gray-500">Cycle {memo.cycle_id.slice(0, 8)}</p>
      )}
    </button>
  )
}

function MemoHistoryListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading memos">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
      ))}
    </div>
  )
}

export function MemoHistoryList({ showId, selectedMemoId }: MemoHistoryListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { data: memos, isLoading, isError, refetch } = useMemos(showId)

  const handleSelect = (memoId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('memo', memoId)
    router.push(`${pathname}?${params.toString()}`)
  }

  if (isLoading) {
    return <MemoHistoryListSkeleton />
  }

  if (isError) {
    return (
      <ErrorBanner
        message="Failed to load memo history"
        onRetry={() => void refetch()}
      />
    )
  }

  if (!memos || memos.length === 0) {
    return (
      <EmptyState
        title="No memos yet"
        description="Generate your first memo above."
      />
    )
  }

  const sorted = [...memos].sort(
    (a, b) => new Date(b.cycle_start).getTime() - new Date(a.cycle_start).getTime()
  )

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">Memo History</h3>
      <ul className="flex flex-col gap-2">
        {sorted.map((memo) => (
          <li key={memo.memo_id}>
            <MemoHistoryItem
              memo={memo}
              isSelected={selectedMemoId === memo.memo_id}
              onSelect={handleSelect}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
