'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { variantsApi } from '@/lib/api/variants'
import type { Variant } from '@/lib/types'

interface Props {
  variant: Variant
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function VariantEditorModal({ variant, open, onClose, onSaved }: Props) {
  const [hook, setHook] = useState(variant.hook)
  const [body, setBody] = useState(variant.body)
  const [cta, setCta] = useState(variant.cta)

  const mutation = useMutation({
    mutationFn: () => variantsApi.update(variant.variant_id, { hook, body, cta }),
    onSuccess: () => { onSaved(); onClose() },
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Variant</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Hook</label>
            <input value={hook} onChange={e => setHook(e.target.value)} className="input w-full mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} className="input w-full mt-1" rows={6} />
          </div>
          <div>
            <label className="text-sm font-medium">CTA</label>
            <input value={cta} onChange={e => setCta(e.target.value)} className="input w-full mt-1" />
          </div>
          <p className="text-xs text-text-muted">
            ✏️ Editing marks this variant as human-authored.
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
