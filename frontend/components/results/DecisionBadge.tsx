'use client'
import type { Decision } from '@/lib/types'
import { useState } from 'react'

export function DecisionBadge({ decision }: { decision: Decision }) {
  const [expanded, setExpanded] = useState(false)
  const conf = Math.round(decision.confidence * 100)

  return (
    <div>
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2"
      >
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
          decision.action === 'scale' ? 'bg-success-light text-success' :
          decision.action === 'hold' ? 'bg-warning-light text-warning' :
          'bg-danger-light text-danger'
        }`}>
          {decision.action.toUpperCase()}
        </span>
        <span className="text-xs text-text-muted">{conf}% confidence</span>
        <span className="text-xs text-text-muted">{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div className="mt-2 p-3 bg-bg rounded-lg text-sm space-y-2">
          <p className="text-text">{decision.rationale}</p>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {Object.entries(decision.metrics_snapshot).slice(0, 6).map(([k, v]) => (
              <div key={k}>
                <p className="text-text-muted">{k.replace(/_/g, ' ')}</p>
                <p className="font-mono font-medium">{String(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
