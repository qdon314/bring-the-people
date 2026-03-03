interface CycleLayoutProps {
  children: React.ReactNode
  params: { show_id: string; cycle_id: string }
}

// Scaffold: AppShell, ShowHeader, and CycleStepper will be wired here in V2-022/V2-023/V2-024.
export default function CycleLayout({ children }: CycleLayoutProps) {
  return <div className="min-h-screen">{children}</div>
}
