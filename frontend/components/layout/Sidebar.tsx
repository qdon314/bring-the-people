'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useShows } from '@/lib/hooks/useShow'
import { cn } from '@/lib/utils'
import { LayoutGrid, FlaskConical, Settings } from 'lucide-react'
import type { Show } from '@/lib/types'

export function Sidebar() {
  const pathname = usePathname()
  const { data: shows } = useShows()
  const recentShows = shows?.slice(0, 3) ?? []

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight">Bring the People</h1>
      </div>
      
      {/* Nav */}
      <nav className="flex-1 p-3" aria-label="Main navigation">
        <ul className="space-y-1">
          <NavItem href="/shows" icon={<LayoutGrid className="w-4 h-4" />} label="Shows" pathname={pathname} />
          <NavItem href="/experiments" icon={<FlaskConical className="w-4 h-4" />} label="Experiments" pathname={pathname} />
        </ul>
        
        {recentShows.length > 0 && (
          <div className="mt-8 pt-4 border-t border-border">
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Recent Shows
            </p>
            <ul className="space-y-1">
              {recentShows.map(show => (
                <li key={show.show_id}>
                  <Link 
                    href={`/shows/${show.show_id}/overview`}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                      pathname.includes(show.show_id)
                        ? 'bg-bg text-text font-medium'
                        : 'text-text-muted hover:bg-bg hover:text-text'
                    )}
                  >
                    <StatusDot show={show} />
                    {show.artist_name} – {show.city}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
      
      {/* Settings */}
      <div className="p-3 border-t border-border">
        <NavItem href="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" pathname={pathname} />
      </div>
    </aside>
  )
}

function NavItem({ 
  href, 
  icon, 
  label, 
  pathname 
}: { 
  href: string
  icon: React.ReactNode
  label: string
  pathname: string 
}) {
  const isActive = pathname.startsWith(href)
  
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
          isActive
            ? 'bg-bg text-text font-medium'
            : 'text-text-muted hover:bg-bg hover:text-text'
        )}
      >
        {icon}
        {label}
      </Link>
    </li>
  )
}

function StatusDot({ show }: { show: Show }) {
  const showTime = new Date(show.show_time)
  const now = new Date()
  
  // Past show
  if (showTime < now) {
    return <span className="w-2 h-2 rounded-full bg-text-muted" />
  }
  
  // Default - muted
  return <span className="w-2 h-2 rounded-full bg-border" />
}
