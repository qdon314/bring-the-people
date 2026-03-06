'use client'

import { useMutation } from '@tanstack/react-query'
import { runCreative, type RunCreativeResponse } from './api'

export function useRunCreative() {
  return useMutation({
    mutationFn: (frameId: string) => runCreative(frameId),
  })
}

export type { RunCreativeResponse }
