import { format } from 'date-fns'
import type { Show } from '../types'

export interface UTMBundle {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_content: string
  utm_term: string
  full_url: string
}

const PLATFORM_SOURCE: Record<string, string> = {
  meta: 'meta',
  instagram: 'instagram',
  tiktok: 'tiktok',
  email: 'email',
  reddit: 'reddit',
  youtube: 'youtube',
}

const PLATFORM_MEDIUM: Record<string, string> = {
  meta: 'paid_social',
  instagram: 'paid_social',
  tiktok: 'paid_social',
  email: 'email',
  reddit: 'paid_social',
  youtube: 'paid_social',
}

export function buildUTM(params: {
  show: Show
  experimentId: string
  variantId: string
  platform: string
  segmentId: string
}): UTMBundle {
  const source = PLATFORM_SOURCE[params.platform] ?? params.platform
  const medium = PLATFORM_MEDIUM[params.platform] ?? 'paid_social'
  const date = format(new Date(params.show.show_time), 'yyyyMMdd')
  const city = params.show.city.toLowerCase().replace(/\s+/g, '_')

  const bundle: UTMBundle = {
    utm_source: source,
    utm_medium: medium,
    utm_campaign: `show_${city}_${date}`,
    utm_content: `exp_${params.experimentId}_var_${params.variantId}`,
    utm_term: `segment_${params.segmentId}`,
    full_url: '',
  }

  const baseUrl = params.show.ticket_base_url
  if (baseUrl) {
    const url = new URL(baseUrl)
    Object.entries(bundle).forEach(([k, v]) => {
      if (k !== 'full_url') url.searchParams.set(k, v)
    })
    bundle.full_url = url.toString()
  }

  return bundle
}

export function buildAdSetName(params: {
  show: Show
  platform: string
  segmentId: string
  experimentId: string
}): string {
  const date = format(new Date(params.show.show_time), 'yyyyMMdd')
  const city = params.show.city.toLowerCase().replace(/\s+/g, '_')
  return `${params.platform}_${city}_${date}_seg${params.segmentId.slice(0, 8)}_${params.experimentId.slice(0, 8)}`
}
