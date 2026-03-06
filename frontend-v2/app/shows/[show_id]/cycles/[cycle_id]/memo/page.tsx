'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MemoTriggerPanel } from '@/features/memos/ui/MemoTriggerPanel'
import { MemoHistoryList } from '@/features/memos/ui/MemoHistoryList'
import { MemoViewer } from '@/features/memos/ui/MemoViewer'
import { useCycle } from '@/features/cycles/queries'

interface MemoPageProps {
  params: { show_id: string; cycle_id: string }
}

function MemoPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-24 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
          ))}
        </div>
        <div className="col-span-8 h-64 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
      </div>
    </div>
  )
}

function MemoPageContent({ showId, cycleId }: { showId: string; cycleId: string }) {
  const searchParams = useSearchParams()
  const selectedMemoId = searchParams.get('memo') ?? undefined

  const { data: cycle, isLoading: cycleLoading } = useCycle(cycleId)

  if (cycleLoading || !cycle) {
    return <MemoPageSkeleton />
  }

  // cycle_start comes from cycle.started_at; cycle_end is now (current time)
  const cycleStart = cycle.started_at
  const cycleEnd = new Date().toISOString()

  return (
    <div className="space-y-6">
      <MemoTriggerPanel showId={showId} cycleStart={cycleStart} cycleEnd={cycleEnd} />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <MemoHistoryList showId={showId} selectedMemoId={selectedMemoId} />
        </div>
        <div className="col-span-8">
          <MemoViewer memoId={selectedMemoId} />
        </div>
      </div>
    </div>
  )
}

export default function MemoPage({ params }: MemoPageProps) {
  const { show_id: showId, cycle_id: cycleId } = params

  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Memo</h1>
        <p className="mt-1 text-sm text-gray-500">Generate and review cycle summary memos</p>
      </div>

      <Suspense fallback={<MemoPageSkeleton />}>
        <MemoPageContent showId={showId} cycleId={cycleId} />
      </Suspense>
    </main>
  )
}
