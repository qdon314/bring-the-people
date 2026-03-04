'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/shared/lib/utils'
import type { CycleProgress, CycleNextAction } from '@/features/cycles/getCycleProgress'

interface CycleStepperProps {
  showId: string
  cycleId: string
  progress: CycleProgress | null
}

type StepKey = 'plan' | 'create' | 'run' | 'results' | 'memo'

interface StepConfig {
  key: StepKey
  label: string
  completeKey: keyof Pick<CycleProgress, 'planComplete' | 'createComplete' | 'runComplete' | 'resultsComplete' | 'memoComplete'>
}

const STEPS: StepConfig[] = [
  { key: 'plan',    label: 'Plan',    completeKey: 'planComplete' },
  { key: 'create',  label: 'Create',  completeKey: 'createComplete' },
  { key: 'run',     label: 'Run',     completeKey: 'runComplete' },
  { key: 'results', label: 'Results', completeKey: 'resultsComplete' },
  { key: 'memo',    label: 'Memo',    completeKey: 'memoComplete' },
]

export function CycleStepper({ showId, cycleId, progress }: CycleStepperProps) {
  const pathname = usePathname() ?? ''

  return (
    <nav
      aria-label="Cycle workflow progress"
      className="flex items-center gap-0 border-b border-border bg-surface px-6 py-2"
    >
      {STEPS.map((step, index) => {
        const href = `/shows/${showId}/cycles/${cycleId}/${step.key}`
        const isActive = pathname === href || pathname.startsWith(href + '/')
        const isComplete = progress !== null && progress[step.completeKey]
        const isNext =
          progress !== null &&
          progress.nextAction !== 'complete' &&
          (progress.nextAction as CycleNextAction) === step.key

        return (
          <React.Fragment key={step.key}>
            {index > 0 && (
              <div
                className={cn(
                  'h-px w-8 flex-shrink-0',
                  isComplete || (index < STEPS.findIndex((s) => s.key === progress?.nextAction))
                    ? 'bg-primary'
                    : 'bg-border'
                )}
                aria-hidden="true"
              />
            )}
            <Link
              href={href}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-light text-primary'
                  : 'text-text-muted hover:bg-bg hover:text-text'
              )}
            >
              <StepIndicator isComplete={isComplete} isNext={isNext} isActive={isActive} />
              <span>{step.label}</span>
            </Link>
          </React.Fragment>
        )
      })}
    </nav>
  )
}

interface StepIndicatorProps {
  isComplete: boolean
  isNext: boolean
  isActive: boolean
}

function StepIndicator({ isComplete, isNext, isActive }: StepIndicatorProps) {
  if (isComplete) {
    return (
      <span aria-label="complete" className="flex h-4 w-4 items-center justify-center">
        <CheckIcon className="h-4 w-4 text-success" />
      </span>
    )
  }

  if (isNext && !isActive) {
    return (
      <span
        aria-label="next action"
        className="h-2 w-2 flex-shrink-0 rounded-full border-2 border-primary bg-transparent"
      />
    )
  }

  return (
    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-border" aria-hidden="true" />
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

export function CycleStepperSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-2 border-b border-border bg-surface px-6 py-2"
    >
      {STEPS.map((step, index) => (
        <React.Fragment key={step.key}>
          {index > 0 && <div className="h-px w-8 flex-shrink-0 bg-border" />}
          <div className="h-7 w-16 animate-pulse rounded-md bg-border" />
        </React.Fragment>
      ))}
    </div>
  )
}
