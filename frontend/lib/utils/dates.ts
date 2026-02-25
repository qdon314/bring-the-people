import { differenceInDays, format } from 'date-fns'
import type { Show } from '../types'

export function daysUntilShow(showTime: string): number {
  return differenceInDays(new Date(showTime), new Date())
}

export function getShowPhaseLabel(daysAway: number): string {
  if (daysAway >= 22) return 'Early'
  if (daysAway >= 8) return 'Mid'
  return 'Late'
}

export function getShowStatus(show: Show): 'past' | 'active' {
  if (new Date(show.show_time) < new Date()) return 'past'
  return 'active'
}

export function formatDate(iso: string): string {
  return format(new Date(iso), 'MMM d, yyyy')
}

export function timeSince(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}
