import { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  fieldId?: string
  error?: string
  children: ReactNode
}

export function FormField({ label, fieldId, error, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-text-muted mb-1">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}
