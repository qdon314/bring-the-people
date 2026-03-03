interface OverviewPageProps {
  params: { show_id: string; cycle_id: string }
}

export default function OverviewPage({ params }: OverviewPageProps) {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <p className="mt-2 text-sm text-gray-500">Cycle {params.cycle_id} — Stage 1</p>
    </main>
  )
}
