'use client'

import { useMutation } from '@tanstack/react-query'
import { runStrategy, type RunStrategyResponse } from './api'

export function useRunStrategy(showId: string, cycleId: string) {
  return useMutation({
    mutationFn: () => runStrategy(showId, cycleId),
  })
}

export type { RunStrategyResponse }
