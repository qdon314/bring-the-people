'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { segmentsApi } from '@/lib/api/segments'
import type { Segment } from '@/lib/types'

interface Props {
  segment: Segment
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function SegmentEditorModal({ segment, open, onClose, onSaved }: Props) {
  const [name, setName] = useState(segment.name)
  const [defJson, setDefJson] = useState(JSON.stringify(segment.definition_json, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      let def: object
      try {
        def = JSON.parse(defJson)
        setJsonError(null)
      } catch {
        setJsonError('Invalid JSON')
        throw new Error('Invalid JSON')
      }
      return segmentsApi.update(segment.segment_id, { name, definition_json: def })
    },
    onSuccess: () => { onSaved(); onClose() },
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Segment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input w-full mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Definition (JSON)</label>
            <textarea
              value={defJson}
              onChange={e => setDefJson(e.target.value)}
              className="input w-full mt-1 font-mono text-xs"
              rows={8}
            />
            {jsonError && <p className="text-xs text-danger mt-1">{jsonError}</p>}
          </div>
          <p className="text-xs text-text-muted">
            ✏️ Editing marks this segment as human-authored.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border text-text rounded-lg text-sm font-medium hover:bg-bg transition-colors">Cancel</button>
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary">
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
