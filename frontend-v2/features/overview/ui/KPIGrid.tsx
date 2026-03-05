'use client'

import React from 'react'
import type { components } from '@/shared/api/generated/schema'

type ShowResponse = components['schemas']['ShowResponse']
type ObservationResponse = components['schemas']['ObservationResponse']

interface KPIStat {
  label: string
  value: string
  sub?: string
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function computeStats(show: ShowResponse, observations: ObservationResponse[]): KPIStat[] {
  const totalSpendCents = observations.reduce((sum, o) => sum + o.spend_cents, 0)
  const totalPurchases = observations.reduce((sum, o) => sum + o.purchases, 0)
  const cpaCents = totalPurchases > 0 ? Math.round(totalSpendCents / totalPurchases) : null

  return [
    {
      label: 'Tickets sold',
      value: show.tickets_sold.toLocaleString('en-US'),
      sub: `of ${show.capacity.toLocaleString('en-US')} capacity`,
    },
    {
      label: 'Spend this cycle',
      value: totalSpendCents > 0 ? formatCents(totalSpendCents) : '—',
    },
    {
      label: 'Purchases this cycle',
      value: totalPurchases > 0 ? totalPurchases.toLocaleString('en-US') : '—',
    },
    {
      label: 'CPA',
      value: cpaCents !== null ? formatCents(cpaCents) : '—',
      sub: 'cost per ticket',
    },
  ]
}

interface KPIGridProps {
  show: ShowResponse
  observations: ObservationResponse[]
}

export function KPIGrid({ show, observations }: KPIGridProps) {
  const stats = computeStats(show, observations)

  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <dt className="text-xs font-medium text-gray-500">{stat.label}</dt>
          <dd className="mt-1 text-xl font-semibold text-gray-900">{stat.value}</dd>
          {stat.sub && <dd className="mt-0.5 text-xs text-gray-400">{stat.sub}</dd>}
        </div>
      ))}
    </dl>
  )
}

export function KPIGridSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-gray-100 px-4 py-3">
          <div className="h-3 w-20 rounded bg-gray-300" />
          <div className="mt-2 h-6 w-16 rounded bg-gray-300" />
        </div>
      ))}
    </div>
  )
}
