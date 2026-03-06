'use client'

import { CreateRunForm } from '@/features/runs/ui/CreateRunForm'
import { RunList } from '@/features/runs/ui/RunList'

interface RunPageProps {
  params: { show_id: string; cycle_id: string }
}

export default function RunPage({ params }: RunPageProps) {
  const { show_id, cycle_id } = params

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Run</h1>

      <div className="mt-6 flex flex-col gap-8">
        <CreateRunForm showId={show_id} cycleId={cycle_id} />

        <section>
          <h2 className="text-xl font-medium mb-4">Runs</h2>
          <RunList showId={show_id} cycleId={cycle_id} />
        </section>
      </div>
    </main>
  )
}
