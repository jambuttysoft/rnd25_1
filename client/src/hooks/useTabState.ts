import { useCallback } from 'react'

export function useTabState() {
  const saveTabState = useCallback((tabName: string, state: any) => {
    try { sessionStorage.setItem(`psa_tab_${tabName}`, JSON.stringify(state)) } catch {}
  }, [])

  const getTabState = useCallback((tabName: string) => {
    try {
      const raw = sessionStorage.getItem(`psa_tab_${tabName}`)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }, [])

  const clearTabState = useCallback((tabName: string) => {
    sessionStorage.removeItem(`psa_tab_${tabName}`)
  }, [])

  return { saveTabState, getTabState, clearTabState }
}
