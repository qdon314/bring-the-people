import { getShow } from '@/features/shows/api'
import { getCycle } from '@/features/cycles/api'
import { AppShell } from '@/features/layout'

interface CycleLayoutProps {
  children: React.ReactNode
  params: { show_id: string; cycle_id: string }
}

export default async function CycleLayout({ children, params }: CycleLayoutProps) {
  const { show_id: showId, cycle_id: cycleId } = params

  // Fetch data server-side
  const [show, cycle] = await Promise.all([
    getShow(showId).catch(() => null),
    getCycle(cycleId).catch(() => null),
  ])

  return (
    <AppShell
      showId={showId}
      cycleId={cycleId}
      show={show}
      cycle={cycle}
      progress={null}
    >
      {children}
    </AppShell>
  )
}
