const BASE = '/api'

export interface SettingsResponse {
  model: string; visionModel: string; currency: string; hasApiKey: boolean
}
export interface SettingsInput {
  model?: string; visionModel?: string; currency?: string
}
export interface ExtractionResponse {
  vendor?: string; date?: string; amount?: number; currency?: string;
  category?: string; line_items?: Array<{description?: string; quantity?: number; unit_price?: number; total_price?: number}>;
  points_payment?: number; points_earned?: number; gift_card_payment?: number;
  other_virtual_payment?: number; subtotal?: number; tax_amount?: number;
  surcharge?: number; cash_out?: number; [key: string]: any
}
export interface VerdictResponse {
  verdict: "justified" | "suspicious" | "unclear"; reason: string; reasoning?: string
}
export interface AnnotationStats {
  pending: number; completed: number; skipped: number; total: number; lastUpdated: string
}
export interface Policy {
  name: string; description?: string; phases?: any[]
}

export const api = {
  getSettings: (): Promise<SettingsResponse> =>
    fetch(`${BASE}/settings`).then(r => r.json()),
  updateSettings: (data: SettingsInput): Promise<{ok:boolean}> =>
    fetch(`${BASE}/settings`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),

  health: (): Promise<{ok:boolean}> => fetch(`${BASE}/health`).then(r => r.json()),
  testConnection: (model: string): Promise<{ok:boolean; response?:string; error?:string}> =>
    fetch(`${BASE}/test-connection`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({model}) }).then(r => r.json()),

  extract: (data: {base64:string; mimeType:string; filename?:string; model?:string; currency?:string}): Promise<{extraction: ExtractionResponse; error?:string}> =>
    fetch(`${BASE}/extract`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),

  verdict: (data: any): Promise<VerdictResponse & {error?:string}> =>
    fetch(`${BASE}/verdict`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
  phaseSensitivity: (data: any): Promise<any> =>
    fetch(`${BASE}/phase-sensitivity`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
  adversarial: (data: any): Promise<any> =>
    fetch(`${BASE}/adversarial`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),

  getReceipts: (): Promise<string[]> => fetch(`${BASE}/receipts`).then(r => r.json()),
  getReceiptUrl: (filename: string): string => `${BASE}/receipts/${encodeURIComponent(filename)}`,

  getAnnotations: (): Promise<any[]> => fetch(`${BASE}/annotations`).then(r => r.json()),
  getAnnotationStats: (): Promise<AnnotationStats> => fetch(`${BASE}/annotations/stats`).then(r => r.json()),
  saveAnnotation: (data: any): Promise<{ok:boolean; error?:string}> =>
    fetch(`${BASE}/annotations`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
  clearAnnotations: (): Promise<{ok:boolean}> =>
    fetch(`${BASE}/annotations/clear`, { method:'POST' }).then(r => r.json()),

  getPolicies: (): Promise<Policy[]> => fetch(`${BASE}/policies`).then(r => r.json()),
  getPolicy: (name: string): Promise<any> => fetch(`${BASE}/policies/${name}`).then(r => r.json()),
  updatePolicy: (name: string, data: any): Promise<{ok:boolean; error?:string}> =>
    fetch(`${BASE}/policies/${name}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),

  restoreReceipts: (): Promise<{ok:boolean}> => fetch(`${BASE}/receipts/restore`, { method:'POST' }).then(r => r.json()),
}
