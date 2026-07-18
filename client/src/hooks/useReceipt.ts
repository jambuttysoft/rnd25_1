import { useState, useCallback } from 'react'

export interface FileData {
  base64: string
  mimeType: string
  filename: string
  hash?: string
}
const STORAGE_KEY = 'psa_receipt'

function psaHash(str: string): string {
  if (!str) return ''
  let hash = 0
  for (let i = 0; i < Math.min(str.length, 100); i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36).slice(0, 8)
}

export function useReceipt() {
  const [receipt, setReceiptState] = useState<FileData | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  const setReceipt = useCallback((data: FileData) => {
    const entry = { ...data, hash: psaHash(data.base64), timestamp: new Date().toISOString() }
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry)) } catch {}
    setReceiptState(entry)
  }, [])

  const clearReceipt = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setReceiptState(null)
  }, [])

  return { receipt, setReceipt, clearReceipt }
}
