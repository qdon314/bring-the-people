import { redirect, notFound } from 'next/navigation'
import { listCycles } from '@/features/cycles/api'
import { ApiError } from '@/shared/api/client'
import { getActiveCycle } from '@/shared/lib/cycles'
import { StartCycleView } from '@/features/shows/ui/StartCycleView'

interface ShowPageProps {
  params: { show_id: string }
}

export default async function ShowPage({ params }: ShowPageProps) {
  const { show_id } = params

  let cycles: Awaited<ReturnType<typeof listCycles>>

  try {
    cycles = await listCycles(show_id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound()
    }
    throw error
  }

  const activeCycle = getActiveCycle(cycles)

  if (!activeCycle) {
    return <StartCycleView showId={show_id} />
  }

  redirect(`/shows/${show_id}/cycles/${activeCycle.cycle_id}/overview`)
}
