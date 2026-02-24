'use client'
import { useParams } from 'next/navigation'
import { useShow } from '@/lib/hooks/useShow'

export default function OverviewPage() {
  const { show_id } = useParams<{ show_id: string }>()
  const { data: show } = useShow(show_id)

  return (
    <div className="p-8">
      <h3 className="text-lg font-semibold mb-4">Overview</h3>
      {show ? (
        <div className="space-y-4">
          <p className="text-text-muted">
            Welcome to the dashboard for <strong>{show.artist_name}</strong>.
          </p>
          <p className="text-text-muted">
            Use the stepper above to navigate through the cycle: Plan → Create → Run → Results → Memo.
          </p>
        </div>
      ) : (
        <div className="h-20 bg-bg rounded animate-pulse" />
      )}
    </div>
  )
}
