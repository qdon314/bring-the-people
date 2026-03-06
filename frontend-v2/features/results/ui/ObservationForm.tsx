'use client'

import { useState } from 'react'
import { useCreateObservation } from '@/features/observations/queries'
import type { ObservationCreate } from '@/features/observations/api'

interface ObservationFormProps {
  runId: string
  onSuccess?: () => void
}

export function ObservationForm({ runId, onSuccess }: ObservationFormProps) {
  const createObservation = useCreateObservation()
  const [formData, setFormData] = useState({
    spend_cents: 0,
    impressions: 0,
    clicks: 0,
    purchases: 0,
    revenue_cents: 0,
  })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const observation: ObservationCreate = {
      run_id: runId,
      window_start: yesterday.toISOString(),
      window_end: now.toISOString(),
      spend_cents: formData.spend_cents,
      impressions: formData.impressions,
      clicks: formData.clicks,
      sessions: 0,
      checkouts: 0,
      purchases: formData.purchases,
      revenue_cents: formData.revenue_cents,
      refunds: 0,
      refund_cents: 0,
      complaints: 0,
      attribution_model: 'last_click_utm',
    }
    
    try {
      await createObservation.mutateAsync(observation)
      onSuccess?.()
      setFormData({ spend_cents: 0, impressions: 0, clicks: 0, purchases: 0, revenue_cents: 0 })
    } catch (error) {
      console.error('Failed to create observation:', error)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Spend (cents)</label>
          <input
            type="number"
            min="0"
            value={formData.spend_cents}
            onChange={(e) => setFormData({ ...formData, spend_cents: parseInt(e.target.value) || 0 })}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Revenue (cents)</label>
          <input
            type="number"
            min="0"
            value={formData.revenue_cents}
            onChange={(e) => setFormData({ ...formData, revenue_cents: parseInt(e.target.value) || 0 })}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Impressions</label>
          <input
            type="number"
            min="0"
            value={formData.impressions}
            onChange={(e) => setFormData({ ...formData, impressions: parseInt(e.target.value) || 0 })}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Clicks</label>
          <input
            type="number"
            min="0"
            value={formData.clicks}
            onChange={(e) => setFormData({ ...formData, clicks: parseInt(e.target.value) || 0 })}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Purchases</label>
          <input
            type="number"
            min="0"
            value={formData.purchases}
            onChange={(e) => setFormData({ ...formData, purchases: parseInt(e.target.value) || 0 })}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
      </div>
      
      <button
        type="submit"
        disabled={createObservation.isPending}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {createObservation.isPending ? 'Saving...' : 'Add Observation'}
      </button>
      
      {createObservation.isError && (
        <p className="text-red-500 text-sm">Failed to save observation</p>
      )}
    </form>
  )
}
