'use client'

import React from 'react'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useVariants } from '../queries'
import { VariantCard, VariantCardSkeleton } from './VariantCard'

interface VariantGroupProps {
  frameId: string
}

export function VariantGroup({ frameId }: VariantGroupProps) {
  const { data, isPending, isError, refetch } = useVariants(frameId)

  if (isPending) {
    return <VariantGroupSkeleton />
  }

  if (isError) {
    return (
      <ErrorBanner
        message="Failed to load variants."
        onRetry={() => refetch()}
      />
    )
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No variants yet."
        description="Select this frame in the picker and click Generate variants."
      />
    )
  }

  // Group variants by platform
  const grouped = data.reduce<Record<string, typeof data>>((acc, variant) => {
    const key = variant.platform ?? 'Unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(variant)
    return acc
  }, {})

  const platforms = Object.keys(grouped).sort()

  return (
    <div className="space-y-6">
      {platforms.map((platform) => (
        <section key={platform}>
          <h3 className="mb-3 text-sm font-semibold text-text-muted uppercase tracking-wide">
            {platform}
          </h3>
          <ul className="space-y-3">
            {grouped[platform].map((variant) => (
              <li key={variant.variant_id}>
                <VariantCard variant={variant} frameId={frameId} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function VariantGroupSkeleton() {
  return (
    <ul aria-hidden="true" className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <VariantCardSkeleton />
        </li>
      ))}
    </ul>
  )
}
