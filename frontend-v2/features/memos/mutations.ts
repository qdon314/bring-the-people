'use client'

import { useMutation } from '@tanstack/react-query'
import { runMemo, type RunMemoResponse } from './api'

export function useRunMemo(showId: string) {
  return useMutation({
    mutationFn: ({
      cycleStart,
      cycleEnd,
    }: {
      cycleStart: string
      cycleEnd: string
    }) => runMemo(showId, cycleStart, cycleEnd),
  })
}

export type { RunMemoResponse }
