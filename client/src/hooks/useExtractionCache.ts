import { useCallback } from 'react'

export function useExtractionCache() {
  const getExtraction = useCallback((hash: string) => {
    try {
      const raw = sessionStorage.getItem(`psa_extraction_${hash}`)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }, [])

  const setExtraction = useCallback((hash: string, data: any) => {
    try { sessionStorage.setItem(`psa_extraction_${hash}`, JSON.stringify(data)) }
    catch (e) { console.warn('Extraction cache quota exceeded', e) }
  }, [])

  const clearExtraction = useCallback((hash?: string) => {
    if (hash) {
      sessionStorage.removeItem(`psa_extraction_${hash}`)
    } else {
      const keys: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.startsWith('psa_extraction_')) keys.push(key)
      }
      keys.forEach(k => sessionStorage.removeItem(k))
    }
  }, [])

  return { getExtraction, setExtraction, clearExtraction }
}
