import { redirect, notFound } from 'next/navigation'
import { listCycles } from '@/features/cycles/api'
import { ApiError } from '@/shared/api/client'
import { getActiveCycle } from '@/shared/lib/cycles'

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
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-2xl font-semibold">Show</h1>
        <p className="mt-2 text-sm text-gray-600">
          No cycles have been started for this show.
        </p>
      </main>
    )
  }

  redirect(`/shows/${show_id}/cycles/${activeCycle.cycle_id}/overview`)
}
