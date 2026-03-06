'use client'

import React, { useState } from 'react'
import { SpinnerIcon } from '@/shared/ui/SpinnerIcon'
import { showToast } from '@/shared/ui/toast'
import { useCreateExperiment } from '../mutations'
import type { SegmentResponse } from '@/features/segments/api'
import type { FrameResponse } from '@/features/frames/api'

interface ExperimentFormProps {
  showId: string
  cycleId: string
  approvedSegments: SegmentResponse[]
  approvedFrames: FrameResponse[]
}

export function ExperimentForm({ showId, cycleId, approvedSegments, approvedFrames }: ExperimentFormProps) {
  const [selectedSegmentId, setSelectedSegmentId] = useState('')
  const [selectedFrameId, setSelectedFrameId] = useState('')
  const [channel, setChannel] = useState('')
  const [objective, setObjective] = useState('ticket_sales')
  const [budgetDollars, setBudgetDollars] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({})

  const createMutation = useCreateExperiment(showId)

  const filteredFrames = selectedSegmentId
    ? approvedFrames.filter((f) => f.segment_id === selectedSegmentId)
    : approvedFrames

  const canSubmit =
    selectedSegmentId &&
    selectedFrameId &&
    channel.trim() &&
    objective &&
    budgetDollars &&
    Number(budgetDollars) > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setFieldErrors({})

    createMutation.mutate(
      {
        originCycleId: cycleId,
        segmentId: selectedSegmentId,
        frameId: selectedFrameId,
        channel: channel.trim(),
        objective,
        budgetCapCents: Math.round(Number(budgetDollars) * 100),
      },
      {
        onSuccess: () => {
          showToast('Experiment created', 'success')
          setSelectedSegmentId('')
          setSelectedFrameId('')
          setChannel('')
          setObjective('ticket_sales')
          setBudgetDollars('')
          setFieldErrors({})
        },
        onError: (error) => {
          if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 422) {
            const body = (error as { body?: { detail?: Array<{ loc: string[]; msg: string }> } }).body
            if (body?.detail) {
              const next: Partial<Record<string, string>> = {}
              for (const err of body.detail) {
                const field = err.loc[err.loc.length - 1]
                if (field) next[field] = err.msg
              }
              setFieldErrors(next)
              return
            }
          }
          showToast('Failed to create experiment. Try again.', 'error')
        },
      }
    )
  }

  if (approvedSegments.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Create Experiment</h2>
        <p className="mt-2 text-sm text-gray-500">
          Approve at least one segment before creating an experiment.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Create Experiment</h2>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="segment" className="block text-sm font-medium text-gray-700">
            Segment
          </label>
          <select
            id="segment"
            value={selectedSegmentId}
            onChange={(e) => {
              setSelectedSegmentId(e.target.value)
              setSelectedFrameId('')
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Select a segment...</option>
            {approvedSegments.map((seg) => (
              <option key={seg.segment_id} value={seg.segment_id}>
                {seg.name}
              </option>
            ))}
          </select>
          {fieldErrors.segment_id && (
            <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.segment_id}</p>
          )}
        </div>

        <div>
          <label htmlFor="frame" className="block text-sm font-medium text-gray-700">
            Frame
          </label>
          <select
            id="frame"
            value={selectedFrameId}
            onChange={(e) => setSelectedFrameId(e.target.value)}
            disabled={!selectedSegmentId}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
          >
            <option value="">
              {selectedSegmentId
                ? filteredFrames.length === 0
                  ? 'No approved frames for this segment'
                  : 'Select a frame...'
                : 'Select a segment first'}
            </option>
            {filteredFrames.map((frame) => (
              <option key={frame.frame_id} value={frame.frame_id}>
                {frame.hypothesis.substring(0, 50)}...
              </option>
            ))}
          </select>
          {fieldErrors.frame_id && (
            <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.frame_id}</p>
          )}
        </div>

        <div>
          <label htmlFor="channel" className="block text-sm font-medium text-gray-700">
            Channel
          </label>
          <input
            id="channel"
            type="text"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="e.g., email, social"
            maxLength={50}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          {fieldErrors.channel && (
            <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.channel}</p>
          )}
        </div>

        <div>
          <label htmlFor="objective" className="block text-sm font-medium text-gray-700">
            Objective
          </label>
          <select
            id="objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="ticket_sales">Ticket Sales</option>
          </select>
          {fieldErrors.objective && (
            <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.objective}</p>
          )}
        </div>

        <div>
          <label htmlFor="budget" className="block text-sm font-medium text-gray-700">
            Budget ($)
          </label>
          <input
            id="budget"
            type="number"
            min="0.01"
            step="0.01"
            value={budgetDollars}
            onChange={(e) => setBudgetDollars(e.target.value)}
            placeholder="e.g., 500.00"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          {fieldErrors.budget_cap_cents && (
            <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors.budget_cap_cents}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit || createMutation.isPending}
          className="flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createMutation.isPending && <SpinnerIcon className="mr-2 h-4 w-4" />}
          {createMutation.isPending ? 'Creating...' : 'Create Experiment'}
        </button>
      </form>
    </div>
  )
}
