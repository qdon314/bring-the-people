'use client'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { showsApi } from '@/lib/api/shows'

const schema = z.object({
  artist_name: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  venue: z.string().min(1).max(255),
  show_time: z.string().min(1),
  timezone: z.string().min(1).max(50),
  capacity: z.coerce.number().int().positive(),
  tickets_total: z.coerce.number().int().min(0),
  tickets_sold: z.coerce.number().int().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  ticket_base_url: z.string().url().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (data.tickets_total > data.capacity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Tickets available cannot exceed capacity',
      path: ['tickets_total'],
    })
  }
  if (data.tickets_sold > data.tickets_total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Tickets sold cannot exceed tickets available',
      path: ['tickets_sold'],
    })
  }
})

type FormData = z.infer<typeof schema>

export default function NewShowPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const form = useForm<FormData>({ 
    resolver: zodResolver(schema),
    defaultValues: {
      currency: 'USD',
      tickets_sold: 0,
    }
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => showsApi.create(data as any),
    onSuccess: (show) => {
      qc.invalidateQueries({ queryKey: ['shows'] })
      router.push(`/shows/${show.show_id}/overview`)
    },
  })

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <h2 className="text-2xl font-bold mb-8">New Show</h2>
      <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-5">
        {/* Artist name */}
        <FormField fieldId="artist_name" label="Artist name" error={form.formState.errors.artist_name?.message}>
          <input id="artist_name" {...form.register('artist_name')} className="input" placeholder="e.g. Khruangbin" />
        </FormField>
        
        {/* Venue */}
        <FormField fieldId="venue" label="Venue" error={form.formState.errors.venue?.message}>
          <input id="venue" {...form.register('venue')} className="input" placeholder="e.g. Thalia Hall" />
        </FormField>
        
        {/* City */}
        <FormField fieldId="city" label="City" error={form.formState.errors.city?.message}>
          <input id="city" {...form.register('city')} className="input" placeholder="e.g. Chicago" />
        </FormField>
        
        {/* Show date/time */}
        <FormField fieldId="show_time" label="Show date & time" error={form.formState.errors.show_time?.message}>
          <input id="show_time" {...form.register('show_time')} type="datetime-local" className="input" />
        </FormField>
        
        {/* Timezone */}
        <FormField fieldId="timezone" label="Timezone" error={form.formState.errors.timezone?.message}>
          <input id="timezone" {...form.register('timezone')} className="input" placeholder="e.g. America/Chicago" />
        </FormField>
        
        {/* Capacity */}
        <div className="grid grid-cols-2 gap-4">
          <FormField fieldId="capacity" label="Capacity" error={form.formState.errors.capacity?.message}>
            <input id="capacity" {...form.register('capacity')} type="number" className="input" />
          </FormField>
          <FormField fieldId="tickets_total" label="Tickets available" error={form.formState.errors.tickets_total?.message}>
            <input id="tickets_total" {...form.register('tickets_total')} type="number" className="input" />
          </FormField>
        </div>
        <FormField fieldId="tickets_sold" label="Tickets sold" error={form.formState.errors.tickets_sold?.message}>
          <input id="tickets_sold" {...form.register('tickets_sold')} type="number" className="input" />
        </FormField>
        
        {/* Ticket URL */}
        <FormField fieldId="ticket_base_url" label="Ticket URL (for UTMs)" error={undefined}>
          <input id="ticket_base_url" {...form.register('ticket_base_url')} className="input" placeholder="https://dice.fm/..." />
        </FormField>

        {mutation.error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg text-danger">
            {mutation.error.message}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Creating…' : 'Create Show'}
          </button>
        </div>
      </form>
    </div>
  )
}

function FormField({ 
  fieldId,
  label, 
  error, 
  children 
}: { 
  fieldId: string
  label: string
  error?: string
  children: React.ReactNode 
}) {
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  )
}
