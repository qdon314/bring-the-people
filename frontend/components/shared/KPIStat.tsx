interface KPIStatProps {
  label: string
  value: string
  delta?: string
  deltaDirection?: 'up' | 'down' | 'neutral'
  subtext?: string
  sparklineValues?: number[]
}

export function KPIStat({ label, value, delta, deltaDirection, subtext, sparklineValues }: KPIStatProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 card-hover">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-text-muted">{label}</p>
        {delta && (
          <span className={`inline-flex items-center text-xs font-semibold ${
            deltaDirection === 'up' ? 'text-success' :
            deltaDirection === 'down' ? 'text-danger' :
            'text-text-muted'
          }`}>
            {deltaDirection === 'up' ? '↑' : deltaDirection === 'down' ? '↓' : ''}
            {delta}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold mb-1">{value}</p>
      <div className="flex items-end justify-between">
        {subtext && <p className="text-xs text-text-muted">{subtext}</p>}
        {sparklineValues && <MiniSparkline values={sparklineValues} />}
      </div>
    </div>
  )
}

function MiniSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-0.5 h-8" aria-hidden="true">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-primary"
          style={{
            height: `${Math.round((v / max) * 100)}%`,
            opacity: i === values.length - 1 ? 1 : 0.4 + (i / values.length) * 0.4,
          }}
        />
      ))}
    </div>
  )
}
