import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { AnnotationStats } from '@/lib/api'

export function useAnnotations() {
  const [stats, setStats] = useState<AnnotationStats>({ pending: 0, completed: 0, skipped: 0, total: 0, lastUpdated: '' })

  const refreshStats = useCallback(async () => {
    try {
      const data = await api.getAnnotationStats()
      setStats(data)
    } catch {}
  }, [])

  const clearAll = useCallback(async () => {
    await api.clearAnnotations()
    setStats({ pending: 0, completed: 0, skipped: 0, total: 0, lastUpdated: '' })
  }, [])

  return { stats, refreshStats, clearAll }
}
