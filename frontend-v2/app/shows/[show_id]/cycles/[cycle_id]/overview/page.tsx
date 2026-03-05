import { OverviewDashboard } from './OverviewDashboard'

interface OverviewPageProps {
  params: { show_id: string; cycle_id: string }
}

export default function OverviewPage({ params }: OverviewPageProps) {
  return <OverviewDashboard showId={params.show_id} cycleId={params.cycle_id} />
}
