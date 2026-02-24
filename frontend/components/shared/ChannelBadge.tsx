const CHANNEL_COLORS: Record<string, string> = {
  meta: 'bg-accent-light text-accent',
  instagram: 'bg-primary-light text-primary',
  tiktok: 'bg-bg text-text-muted',
  reddit: 'bg-warning-light text-warning',
  email: 'bg-success-light text-success',
}

export function ChannelBadge({ channel }: { channel: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CHANNEL_COLORS[channel] ?? 'bg-bg text-text-muted'}`}>
      {channel.charAt(0).toUpperCase() + channel.slice(1)}
    </span>
  )
}
