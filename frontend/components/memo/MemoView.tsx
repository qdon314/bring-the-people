'use client'
import ReactMarkdown from 'react-markdown'
import { CopyButton } from '@/components/shared/CopyButton'
import { format } from 'date-fns'
import type { ProducerMemo } from '@/lib/types'

export function MemoView({ memo }: { memo: ProducerMemo }) {
  return (
    <div className="bg-surface border border-border rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <h3 className="font-semibold">Producer Memo</h3>
          <p className="text-sm text-text-muted">
            {format(new Date(memo.cycle_start), 'MMM d')} – {format(new Date(memo.cycle_end), 'MMM d, yyyy')}
          </p>
        </div>
        <CopyButton text={memo.markdown} label="Copy Markdown" />
      </div>

      {/* Rendered markdown */}
      <div className="p-6 prose prose-sm max-w-none
        prose-headings:font-semibold prose-headings:text-text
        prose-p:text-text prose-p:leading-relaxed
        prose-strong:text-text
        prose-ul:text-text prose-li:text-text
        prose-code:font-mono prose-code:text-sm prose-code:bg-bg prose-code:px-1 prose-code:rounded">
        <ReactMarkdown>{memo.markdown}</ReactMarkdown>
      </div>
    </div>
  )
}
