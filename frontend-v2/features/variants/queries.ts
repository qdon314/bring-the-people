'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listVariants } from './api'

export function useVariants(frameId: string) {
  return useQuery({
    queryKey: queryKeys.variants.byFrame(frameId),
    queryFn: () => listVariants(frameId),
    enabled: !!frameId,
  })
}
