import React from 'react'
import type { MemoResponse } from '../api'

interface MemoViewProps {
  memo: MemoResponse
}

function formatDateRange(cycleStart: string, cycleEnd: string): string {
  const start = new Date(cycleStart)
  const end = new Date(cycleEnd)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

export function MemoView({ memo }: MemoViewProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 border-b border-gray-100 pb-4">
        <h2 className="text-base font-semibold text-gray-900">Cycle Memo</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          {formatDateRange(memo.cycle_start, memo.cycle_end)}
        </p>
      </div>
      {memo.markdown ? (
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">
          {memo.markdown}
        </pre>
      ) : (
        <p className="text-sm text-gray-400">No content</p>
      )}
    </div>
  )
}
