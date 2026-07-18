import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface Settings {
  model: string
  visionModel: string
  currency: string
}
const STORAGE_KEY = 'psa_settings'

export function useSettings() {
  const [apiKey, setApiKey] = useState('')
  const [settings, setSettings] = useState<Settings>({ model: '', visionModel: '', currency: 'Any' })
  const [hasApiKey, setHasApiKey] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { setSettings(JSON.parse(saved)) } catch {}
    }
    api.getSettings().then(s => {
      setSettings(prev => ({ ...prev, model: s.model || prev.model, visionModel: s.visionModel || prev.visionModel, currency: s.currency || prev.currency }))
      setHasApiKey(s.hasApiKey)
    }).catch(() => {})
  }, [])

  const save = useCallback((s: Settings) => {
    setSettings(s)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    api.updateSettings(s).catch(() => {})
  }, [])

  return { settings, setSettings: save, apiKey, setApiKey, hasApiKey }
}
