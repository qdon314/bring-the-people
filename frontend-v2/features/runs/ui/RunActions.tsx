'use client'

import React, { useState } from 'react'
import { Dialog } from '@/shared/ui/dialog'
import { SpinnerIcon } from '@/shared/ui/SpinnerIcon'
import { useLaunchRun, useRequestRunReapproval } from '../queries'
import type { RunResponse } from '../api'

interface RunActionsProps {
  run: RunResponse
}

export function RunActions({ run }: RunActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const launch = useLaunchRun()
  const reapproval = useRequestRunReapproval()

  function handleLaunchConfirm() {
    launch.mutate(run.run_id, {
      onSuccess: () => setConfirmOpen(false),
    })
  }

  if (run.status === 'draft') {
    return (
      <>
        <button
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          Launch
        </button>

        <Dialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Launch this run?"
          description="Ads will begin running externally. This action cannot be undone."
        >
          <div className="flex flex-col gap-4">
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-text hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border"
              >
                Cancel
              </button>
              <button
                onClick={handleLaunchConfirm}
                disabled={launch.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50"
              >
                {launch.isPending && <SpinnerIcon className="h-4 w-4" />}
                {launch.isPending ? 'Launching…' : 'Confirm Launch'}
              </button>
            </div>
            {launch.isError && (
              <p className="text-sm text-red-600">
                Failed to launch run. Try again or refresh the page.
              </p>
            )}
          </div>
        </Dialog>
      </>
    )
  }

  if (run.status === 'awaiting_approval') {
    return (
      <button
        onClick={() => reapproval.mutate(run.run_id)}
        disabled={reapproval.isPending}
        className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border disabled:opacity-50"
      >
        {reapproval.isPending && <SpinnerIcon className="h-4 w-4" />}
        {reapproval.isPending ? 'Requesting…' : 'Request Reapproval'}
      </button>
    )
  }

  return null
}
