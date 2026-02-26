'use client'
import { useState, useEffect } from 'react'
import { FormField } from '@/components/shared/FormField'

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setApiUrl(localStorage.getItem('btp_api_url') ?? 'http://localhost:8000')
  }, [])

  function save() {
    localStorage.setItem('btp_api_url', apiUrl)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <h2 className="text-2xl font-bold mb-8">Settings</h2>
      <div className="bg-surface border border-border rounded-lg p-6 space-y-5">
        <h3 className="font-semibold">API Configuration</h3>
        <FormField label="Backend API URL">
          <input
            value={apiUrl}
            onChange={e => setApiUrl(e.target.value)}
            className="input w-full"
            placeholder="http://localhost:8000"
          />
          <p className="text-xs text-text-muted mt-1">
            Override the default API URL (useful for remote deployments).
          </p>
        </FormField>
        <div className="flex items-center gap-3">
          <button onClick={save} className="btn-primary text-sm">Save</button>
          {saved && <span className="text-xs text-success">✓ Saved</span>}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 mt-5 space-y-3">
        <h3 className="font-semibold">Default Ticket URL</h3>
        <p className="text-sm text-text-muted">
          Set per-show ticket URLs when creating or editing shows. The ticket URL is used
          to generate UTM tracking links.
        </p>
      </div>
    </div>
  )
}
