interface ErrorBannerProps {
  message: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="bg-danger-light border border-danger/20 text-danger rounded-lg px-4 py-3 text-sm">
      {message}
    </div>
  )
}
