'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { framesApi } from '@/lib/api/frames'
import type { Frame } from '@/lib/types'

interface Props {
  frame: Frame
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function FrameEditorModal({ frame, open, onClose, onSaved }: Props) {
  const [hypothesis, setHypothesis] = useState(frame.hypothesis)
  const [promise, setPromise] = useState(frame.promise)
  const [channel, setChannel] = useState(frame.channel)
  const [riskNotes, setRiskNotes] = useState(frame.risk_notes ?? '')

  // Track original values for dirty checking
  const [originalHypothesis] = useState(frame.hypothesis)
  const [originalPromise] = useState(frame.promise)
  const [originalChannel] = useState(frame.channel)
  const [originalRiskNotes] = useState(frame.risk_notes ?? '')

  const isDirty = hypothesis !== originalHypothesis || 
                  promise !== originalPromise || 
                  channel !== originalChannel || 
                  riskNotes !== originalRiskNotes

  const mutation = useMutation({
    mutationFn: () => {
      // Skip mutation if nothing changed
      if (!isDirty) {
        return Promise.resolve(frame)
      }
      return framesApi.update(frame.frame_id, {
        hypothesis,
        promise,
        channel,
        risk_notes: riskNotes || null,
      })
    },
    onSuccess: () => { onSaved(); onClose() },
  })

  const handleClose = () => {
    if (isDirty && !window.confirm('Discard your changes?')) {
      return
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Frame</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Hypothesis</label>
            <input value={hypothesis} onChange={e => setHypothesis(e.target.value)} className="input w-full mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Promise</label>
            <textarea value={promise} onChange={e => setPromise(e.target.value)} className="input w-full mt-1" rows={3} />
          </div>
          <div>
            <label className="text-sm font-medium">Channel</label>
            <select value={channel} onChange={e => setChannel(e.target.value)} className="input w-full mt-1">
              <option value="meta">Meta</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="reddit">Reddit</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Risk Notes</label>
            <textarea value={riskNotes} onChange={e => setRiskNotes(e.target.value)} className="input w-full mt-1" rows={2} />
          </div>
          <p className="text-xs text-text-muted">
            ✏️ Editing marks this frame as human-authored.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={handleClose} className="px-4 py-2 border border-border text-text rounded-lg text-sm font-medium hover:bg-bg transition-colors">Cancel</button>
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !isDirty} className="btn-primary">
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
