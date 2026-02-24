'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { key: 'plan',    label: 'Plan',    path: 'plan' },
  { key: 'create',  label: 'Create',  path: 'create' },
  { key: 'run',     label: 'Run',     path: 'run' },
  { key: 'results', label: 'Results', path: 'results' },
  { key: 'memo',    label: 'Memo',    path: 'memo' },
] as const

interface StepperState {
  plan: boolean
  create: boolean
  run: boolean
  results: boolean
  memo: boolean
}

interface CycleStepperProps {
  showId: string
  state: StepperState
}

export function CycleStepper({ showId, state }: CycleStepperProps) {
  const pathname = usePathname()

  return (
    <div className="bg-surface border-b border-border px-8 py-3">
      <nav aria-label="Cycle progress">
        <ol className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const isCompleted = state[step.key as keyof StepperState]
            const href = `/shows/${showId}/${step.path}`
            const isCurrent = pathname.endsWith(`/${step.path}`)
            const isLast = i === STEPS.length - 1

            return (
              <li key={step.key} className="flex items-center flex-1">
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors flex-1 justify-center',
                    isCurrent ? 'bg-primary-light' : 'hover:bg-bg'
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className={cn(
                    'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold',
                    isCompleted
                      ? 'bg-primary text-white'
                      : isCurrent
                        ? 'bg-primary text-white font-bold'
                        : 'bg-bg text-text-muted border border-border'
                  )}>
                    {isCompleted ? <Check className="w-4 h-4" /> : i + 1}
                  </span>
                  <span className={cn(
                    'text-sm',
                    isCurrent ? 'font-semibold text-primary' :
                    isCompleted ? 'font-medium text-text' :
                    'text-text-muted'
                  )}>
                    {step.label}
                  </span>
                </Link>
                {!isLast && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      'h-0.5 flex-1 min-w-6 mx-2',
                      isCompleted ? 'bg-primary' : 'bg-border'
                    )}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}
