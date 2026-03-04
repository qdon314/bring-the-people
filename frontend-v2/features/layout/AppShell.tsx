'use client'

import React from 'react'
import { Sidebar } from './Sidebar'
import { TopBar, TopBarSkeleton } from './TopBar'
import { CycleStepper, CycleStepperSkeleton } from '@/features/cycles/ui/CycleStepper'
import type { components } from '@/shared/api/generated/schema'
import type { CycleProgress } from '@/features/cycles/getCycleProgress'

type ShowResponse = components['schemas']['ShowResponse']
type CycleResponse = components['schemas']['CycleResponse']

interface AppShellProps {
  children: React.ReactNode
  showId: string
  cycleId: string
  show?: ShowResponse | null
  cycle?: CycleResponse | null
  isLoading?: boolean
  error?: Error | null
  progress?: CycleProgress | null
}

export function AppShell({
  children,
  showId,
  cycleId,
  show,
  cycle,
  isLoading = false,
  error = null,
  progress = null,
}: AppShellProps) {
  return (
    <div className="flex h-screen w-full flex-col bg-bg">
      {/* Top bar */}
      {isLoading ? (
        <TopBarSkeleton />
      ) : error ? (
        <div className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
          <p className="text-sm text-danger">
            Failed to load show data. Please refresh.
          </p>
        </div>
      ) : show && cycle ? (
        <TopBar show={show} cycle={cycle} />
      ) : (
        <TopBarSkeleton />
      )}

      {/* Cycle stepper */}
      {isLoading ? (
        <CycleStepperSkeleton />
      ) : (
        <CycleStepper showId={showId} cycleId={cycleId} progress={progress} />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar showId={showId} cycleId={cycleId} />

        {/* Main content area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

interface AppShellSkeletonProps {
  children?: React.ReactNode
}

export function AppShellSkeleton({ children }: AppShellSkeletonProps) {
  return (
    <div className="flex h-screen w-full flex-col bg-bg">
      <TopBarSkeleton />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <aside className="flex h-full w-60 flex-col border-r border-border bg-surface p-3">
          <div className="flex flex-1 flex-col gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="nav-item h-10 animate-pulse rounded-lg bg-border"
              />
            ))}
          </div>
        </aside>

        {/* Main content skeleton */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export { TopBar, TopBarSkeleton, Sidebar }
