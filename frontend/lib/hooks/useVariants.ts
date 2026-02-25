import { useQuery } from '@tanstack/react-query'
import { variantsApi } from '../api/variants'

export function useVariants(frameId: string) {
  return useQuery({
    queryKey: ['variants', frameId],
    queryFn: () => variantsApi.list(frameId),
    enabled: !!frameId,
  })
}

export function useVariant(variantId: string) {
  return useQuery({
    queryKey: ['variants', variantId],
    queryFn: () => variantsApi.get(variantId),
    enabled: !!variantId,
  })
}
