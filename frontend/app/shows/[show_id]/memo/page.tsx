'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useMemos } from '@/lib/hooks/useMemos'
import { useCycles } from '@/lib/hooks/useCycles'
import { memosApi } from '@/lib/api/memos'
import { AgentRunButton } from '@/components/shared/AgentRunButton'
import { MemoView } from '@/components/memo/MemoView'
import { FormField } from '@/components/shared/FormField'
import { format, subDays } from 'date-fns'

export default function MemoPage() {
  const { show_id } = useParams<{ show_id: string }>()
  const qc = useQueryClient()
  const { data: cycles } = useCycles(show_id)
  const { data: memos } = useMemos(show_id)
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null)

  const currentCycle = cycles?.[0]
  const [cycleStart, setCycleStart] = useState(
    currentCycle?.started_at
      ? format(new Date(currentCycle.started_at), "yyyy-MM-dd'T'HH:mm")
      : format(subDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm")
  )
  const [cycleEnd, setCycleEnd] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"))

  const selectedMemo = memos?.find(m => m.memo_id === selectedMemoId) ??
    (memos?.length ? memos[memos.length - 1] : null)

  function onMemoGenerated(job: unknown) {
    qc.invalidateQueries({ queryKey: ['memos', show_id] })
    const result = (job as { result_json?: { memo_id?: string } }).result_json
    if (result?.memo_id) setSelectedMemoId(result.memo_id)
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Generate panel + past memos list */}
        <div className="space-y-5">
          {/* Generate */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-3">Generate Memo</h3>
            <div className="space-y-3 mb-4">
              <FormField label="Cycle start">
                <input type="datetime-local" value={cycleStart}
                  onChange={e => setCycleStart(e.target.value)} className="input text-sm w-full" />
              </FormField>
              <FormField label="Cycle end">
                <input type="datetime-local" value={cycleEnd}
                  onChange={e => setCycleEnd(e.target.value)} className="input text-sm w-full" />
              </FormField>
            </div>
            <AgentRunButton
              label="Generate Memo"
              onRun={() => memosApi.run(show_id, {
                cycle_start: new Date(cycleStart).toISOString(),
                cycle_end: new Date(cycleEnd).toISOString(),
              })}
              onComplete={onMemoGenerated}
            />
          </div>

          {/* Past memos */}
          {memos && memos.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-3">Past Memos</h4>
              <ul className="space-y-1">
                {memos.map(memo => (
                  <li key={memo.memo_id}>
                    <button
                      onClick={() => setSelectedMemoId(memo.memo_id)}
                      className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                        selectedMemo?.memo_id === memo.memo_id
                          ? 'bg-primary-light text-primary font-medium'
                          : 'hover:bg-bg text-text-muted'
                      }`}
                    >
                      {format(new Date(memo.cycle_start), 'MMM d')} – {format(new Date(memo.cycle_end), 'MMM d, yyyy')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: Memo content */}
        <div className="lg:col-span-2">
          {selectedMemo ? (
            <MemoView memo={selectedMemo} />
          ) : (
            <div className="bg-surface border border-border rounded-lg p-12 text-center text-text-muted">
              <p className="text-lg font-medium mb-2">No memo yet</p>
              <p className="text-sm">Generate a memo after running the decision engine.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
