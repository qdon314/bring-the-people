import { redirect } from 'next/navigation'

interface CyclePageProps {
  params: { show_id: string; cycle_id: string }
}

export default function CyclePage({ params }: CyclePageProps) {
  const { show_id, cycle_id } = params
  redirect(`/shows/${show_id}/cycles/${cycle_id}/overview`)
}
