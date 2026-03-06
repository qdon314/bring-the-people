'use client'

import { useState } from 'react'
import { useDecisions } from '@/features/decisions/queries'

interface DecisionOverrideProps {
  runId: string
}

export function DecisionOverride({ runId }: DecisionOverrideProps) {
  const { data: decisions } = useDecisions(runId)
  const [showForm, setShowForm] = useState(false)
  
  const existingDecision = decisions?.[0]
  
  return (
    <div className="border rounded p-4">
      <h3 className="text-lg font-medium mb-4">Decision</h3>
      
      {existingDecision ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded text-sm font-medium ${
              existingDecision.action === 'scale' ? 'bg-green-100 text-green-800' :
              existingDecision.action === 'hold' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {existingDecision.action.toUpperCase()}
            </span>
          </div>
          {existingDecision.rationale && (
            <p className="text-sm text-gray-600">{existingDecision.rationale}</p>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">No decision yet. Run the Decision Engine to get a recommendation.</p>
      )}
      
      <button
        onClick={() => setShowForm(!showForm)}
        className="mt-4 text-blue-600 text-sm hover:underline"
      >
        {showForm ? 'Cancel' : 'Set Manual Override'}
      </button>
      
      {showForm && (
        <ManualOverrideForm runId={runId} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

function ManualOverrideForm({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [decision, setDecision] = useState<'scale' | 'hold' | 'kill'>('hold')
  const [reason, setReason] = useState('')
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Manual override:', { runId, decision, reason })
    onClose()
  }
  
  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Decision</label>
        <div className="flex gap-2">
          {(['scale', 'hold', 'kill'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDecision(d)}
              className={`px-3 py-1 rounded text-sm ${
                decision === d
                  ? d === 'scale' ? 'bg-green-600 text-white' :
                    d === 'hold' ? 'bg-yellow-600 text-white' :
                    'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="border rounded px-3 py-2 w-full"
          rows={3}
          placeholder="Why are you making this decision?"
        />
      </div>
      
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Save Decision
      </button>
    </form>
  )
}
