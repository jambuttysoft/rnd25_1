import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { api, type AnnotationStats, type ExtractionResponse } from "@/lib/api"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function formatTimestamp(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "\u2014", time: "\u00a0" }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: "\u2014", time: "\u00a0" }
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  let hours = d.getHours()
  const mins = String(d.getMinutes()).padStart(2, "0")
  const ampm = hours >= 12 ? "pm" : "am"
  hours = hours % 12 || 12
  return { date, time: `${hours}:${mins} ${ampm}` }
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return "\u2014"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileTypeFor(filename: string): string {
  if (!filename) return "\u2014"
  const ext = filename.toLowerCase().split(".").pop()
  if (ext === "jpg" || ext === "jpeg") return "JPEG image"
  if (ext === "png") return "PNG image"
  if (ext === "pdf") return "PDF document"
  return ext?.toUpperCase() ?? ""
}

function parseFilenameDate(filename: string): { date: string; time: string } | null {
  if (!filename) return null
  const m = filename.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2})\.(\d{2})\.(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const dt = new Date(+y, +mo - 1, +d, +h, +mi, +s)
  if (Number.isNaN(dt.getTime())) return null
  let hours = dt.getHours()
  const mins = String(dt.getMinutes()).padStart(2, "0")
  const ampm = hours >= 12 ? "pm" : "am"
  hours = hours % 12 || 12
  return {
    date: `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`,
    time: `${hours}:${mins} ${ampm}`,
  }
}

function getE1CachedExtraction(filename: string): ExtractionResponse | null {
  try {
    const autoKey = `psa_e1_auto_${filename}`
    const autoRaw = sessionStorage.getItem(autoKey)
    if (autoRaw) return JSON.parse(autoRaw)
    return null
  } catch {
    return null
  }
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KpiStrip({ stats }: { stats: AnnotationStats }) {
  const ts = formatTimestamp(stats.lastUpdated)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      <Card className="p-3 text-center">
        <div className="text-xl font-bold text-amber-600">{stats.pending}</div>
        <div className="text-xs font-medium text-ink-mute">Pending Review</div>
      </Card>
      <Card className="p-3 text-center">
        <div className="text-xl font-bold text-green-600">{stats.completed}</div>
        <div className="text-xs font-medium text-ink-mute">Completed</div>
      </Card>
      <Card className="p-3 text-center">
        <div className="text-xl font-bold text-purple-600">{stats.skipped}</div>
        <div className="text-xs font-medium text-ink-mute">Skipped</div>
      </Card>
      <Card className="p-3 text-center">
        <div className="text-xl font-bold text-slate-600">{stats.total}</div>
        <div className="text-xs font-medium text-ink-mute">Total Receipts</div>
      </Card>
      <Card className="p-3 text-center">
        <div className="text-sm font-bold text-slate-600">{ts.date}</div>
        <div className="text-xs text-ink-mute">{ts.time}</div>
        <div className="text-xs font-medium text-ink-mute mt-0.5">Last Updated</div>
      </Card>
    </div>
  )
}

// ─── Status Banner ────────────────────────────────────────────────────────────

function StatusBanner({
  kind,
  message,
}: {
  kind: "new" | "existing" | "error" | null
  message: string
}) {
  if (!kind) return null
  const colors = {
    new: "bg-blue-50 border-blue-200 text-blue-700",
    existing: "bg-green-50 border-green-200 text-green-700",
    error: "bg-red-50 border-red-200 text-red-700",
  }
  return (
    <div className={`p-2.5 rounded-md border text-xs mb-4 ${colors[kind]}`}>
      {message}
    </div>
  )
}

// ─── Meta List ────────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-1 border-b border-dashed border-slate-200 last:border-0">
      <span className="text-xs text-ink-mute">{label}</span>
      <span className="text-xs text-ink">{value}</span>
    </div>
  )
}

// ─── AI Extraction Panel ──────────────────────────────────────────────────────

function AiExtractionPanel({ e1 }: { e1: ExtractionResponse | null }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink">
          AI Extraction <span className="font-normal text-ink-mute">(from E1)</span>
        </h3>
        <Badge variant={e1 ? "default" : "secondary"}>
          {e1 ? "Populated" : "Not run"}
        </Badge>
      </div>
      <div className="space-y-0">
        <MetaRow label="Vendor" value={e1?.vendor || "\u2014"} />
        <MetaRow label="Date" value={e1?.date || "\u2014"} />
        <MetaRow label="Amount" value={e1?.amount != null ? String(e1.amount) : "\u2014"} />
        <MetaRow label="Currency" value={e1?.currency || "\u2014"} />
        <MetaRow label="Category" value={e1?.category || "\u2014"} />
        <MetaRow label="Points Pay" value={e1?.points_payment != null ? String(e1.points_payment) : "\u2014"} />
        <MetaRow label="Points Earned" value={e1?.points_earned != null ? String(e1.points_earned) : "\u2014"} />
        <MetaRow label="Gift Card Pay" value={e1?.gift_card_payment != null ? String(e1.gift_card_payment) : "\u2014"} />
        <MetaRow label="Other Virtual Pay" value={e1?.other_virtual_payment != null ? String(e1.other_virtual_payment) : "\u2014"} />
      </div>
    </Card>
  )
}

// ─── Receipt Metadata ─────────────────────────────────────────────────────────

function ReceiptMetadata({
  filename,
  resolution,
}: {
  filename: string | null
  resolution: string
}) {
  const parsed = filename ? parseFilenameDate(filename) : null
  return (
    <Card className="p-4">
      <div className="text-[11px] font-bold text-ink-mute uppercase tracking-wider mb-2.5">
        Receipt Metadata
      </div>
      <MetaRow label="Filename" value={filename || "\u2014"} />
      <MetaRow
        label="Uploaded"
        value={parsed ? `${parsed.date}, ${parsed.time}` : "\u2014"}
      />
      <MetaRow label="File Type" value={filename ? fileTypeFor(filename) : "\u2014"} />
      <MetaRow label="Resolution" value={resolution} />
      <MetaRow label="Source" value="Repository" />
    </Card>
  )
}

// ─── Annotation Form ──────────────────────────────────────────────────────────

interface AnnotationForm {
  filename: string
  vendor: string
  date: string
  amount: string
  currency: string
  category: string
  points_payment: string
  points_earned: string
  gift_card_payment: string
  other_virtual_payment: string
  human_verdict: string
  human_verdict_reason: string
  is_ambiguous: boolean
  notes: string
}

const EMPTY_FORM: AnnotationForm = {
  filename: "",
  vendor: "",
  date: "",
  amount: "",
  currency: "",
  category: "other",
  points_payment: "",
  points_earned: "",
  gift_card_payment: "",
  other_virtual_payment: "",
  human_verdict: "justified",
  human_verdict_reason: "",
  is_ambiguous: false,
  notes: "",
}

function AnnotationFormFields({
  form,
  onChange,
}: {
  form: AnnotationForm
  onChange: (patch: Partial<AnnotationForm>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1 text-xs">Vendor</Label>
          <Input
            value={form.vendor}
            onChange={(e) => onChange({ vendor: e.target.value })}
            placeholder="Vendor name"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">Date</Label>
          <Input
            type="date"
            value={form.date}
            onChange={(e) => onChange({ date: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1 text-xs">Amount</Label>
          <Input
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0.00"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">Currency</Label>
          <select
            value={form.currency}
            onChange={(e) => onChange({ currency: e.target.value })}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">\u2014</option>
            <option value="AUD">AUD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
            <option value="SGD">SGD</option>
            <option value="NZD">NZD</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1 text-xs">Points Payment</Label>
          <Input
            type="number"
            step="0.01"
            value={form.points_payment}
            onChange={(e) => onChange({ points_payment: e.target.value })}
            placeholder="0.00"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">Points Earned</Label>
          <Input
            type="number"
            step="0.01"
            value={form.points_earned}
            onChange={(e) => onChange({ points_earned: e.target.value })}
            placeholder="0.00"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1 text-xs">Gift Card Payment</Label>
          <Input
            type="number"
            step="0.01"
            value={form.gift_card_payment}
            onChange={(e) => onChange({ gift_card_payment: e.target.value })}
            placeholder="0.00"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">Other Virtual Payment</Label>
          <Input
            type="number"
            step="0.01"
            value={form.other_virtual_payment}
            onChange={(e) => onChange({ other_virtual_payment: e.target.value })}
            placeholder="0.00"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div>
        <Label className="mb-1 text-xs">Category</Label>
        <select
          value={form.category}
          onChange={(e) => onChange({ category: e.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="equipment">Equipment</option>
          <option value="software">Software / Subscriptions</option>
          <option value="travel">Travel</option>
          <option value="meals">Meals</option>
          <option value="services">Services</option>
          <option value="supplies">Supplies</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <Label className="mb-1 text-xs">Human Verdict</Label>
        <select
          value={form.human_verdict}
          onChange={(e) => onChange({ human_verdict: e.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="justified">Justified</option>
          <option value="suspicious">Suspicious</option>
          <option value="unclear">Unclear</option>
        </select>
      </div>

      <div>
        <Label className="mb-1 text-xs">
          Verdict Reason{" "}
          <span className="text-ink-faint font-normal">(one sentence, required)</span>
        </Label>
        <Input
          value={form.human_verdict_reason}
          onChange={(e) => onChange({ human_verdict_reason: e.target.value })}
          placeholder="State the primary reason in a single sentence."
          className="h-8 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="ann-ambiguous"
          checked={form.is_ambiguous}
          onChange={(e) => onChange({ is_ambiguous: e.target.checked })}
          className="size-4 rounded border-slate-300"
        />
        <Label htmlFor="ann-ambiguous" className="text-xs font-normal cursor-pointer">
          Mark as ambiguous (reasonable reviewers might disagree)
        </Label>
      </div>

      <div>
        <Label className="mb-1 text-xs">Notes</Label>
        <textarea
          value={form.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={3}
          placeholder="Optional notes about this receipt or any quality issues."
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
        />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnnotatePage() {
  const [receipts, setReceipts] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [annotations, setAnnotations] = useState<any[]>([])
  const [stats, setStats] = useState<AnnotationStats>({
    pending: 0,
    completed: 0,
    skipped: 0,
    total: 0,
    lastUpdated: "",
  })
  const [form, setForm] = useState<AnnotationForm>({ ...EMPTY_FORM })
  const [status, setStatus] = useState<{ kind: "new" | "existing" | "error" | null; message: string }>({
    kind: null,
    message: "",
  })
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)
  const [resolution, setResolution] = useState("\u2014")
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [imageLoading, setImageLoading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const filename = receipts[currentIndex] ?? null

  // ─── Load data ────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getAnnotationStats()
      setStats(data)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getReceipts(), api.getAnnotations()]).then(([r, a]) => {
      if (cancelled) return
      setReceipts(r)
      setAnnotations(a)
    }).catch(() => {})
    loadStats()
    return () => { cancelled = true }
  }, [loadStats])

  // ─── Populate form when receipt changes ──────────────────────────────────

  useEffect(() => {
    if (!filename) {
      setForm({ ...EMPTY_FORM })
      setStatus({ kind: null, message: "" })
      setResolution("\u2014")
      return
    }

    const ann = annotations.find((a) => a.filename === filename)
    if (ann && ann.status !== "skipped" && ann.skipped !== true) {
      setForm({
        filename,
        vendor: ann.vendor || "",
        date: ann.date || "",
        amount: ann.amount != null ? String(ann.amount) : "",
        currency: ann.currency || "",
        category: ann.category || "other",
        points_payment: ann.points_payment != null ? String(ann.points_payment) : "",
        points_earned: ann.points_earned != null ? String(ann.points_earned) : "",
        gift_card_payment: ann.gift_card_payment != null ? String(ann.gift_card_payment) : "",
        other_virtual_payment: ann.other_virtual_payment != null ? String(ann.other_virtual_payment) : "",
        human_verdict: ann.human_verdict || "justified",
        human_verdict_reason: ann.human_verdict_reason || "",
        is_ambiguous: ann.is_ambiguous || false,
        notes: ann.notes || "",
      })
      setStatus({ kind: "existing", message: `Existing annotation loaded for ${filename}. Editing will overwrite the saved entry.` })
    } else {
      // Try E1 cache
      const e1 = getE1CachedExtraction(filename)
      if (e1) {
        setForm({
          filename,
          vendor: e1.vendor || "",
          date: e1.date || "",
          amount: e1.amount != null ? String(e1.amount) : "",
          currency: e1.currency || "",
          category: e1.category || "other",
          points_payment: e1.points_payment != null ? String(e1.points_payment) : "",
          points_earned: e1.points_earned != null ? String(e1.points_earned) : "",
          gift_card_payment: e1.gift_card_payment != null ? String(e1.gift_card_payment) : "",
          other_virtual_payment: e1.other_virtual_payment != null ? String(e1.other_virtual_payment) : "",
          human_verdict: "justified",
          human_verdict_reason: "",
          is_ambiguous: false,
          notes: ann?.notes || "",
        })
        if (ann && (ann.status === "skipped" || ann.skipped === true)) {
          setStatus({ kind: "existing", message: "Receipt was marked as skipped. Fill the fields and save to overwrite." })
        } else {
          setStatus({ kind: "new", message: "New annotation. Fields pre-populated from cached E1 extraction \u2014 review and correct as needed." })
        }
      } else {
        setForm({ ...EMPTY_FORM, filename })
        if (ann && (ann.status === "skipped" || ann.skipped === true)) {
          setStatus({ kind: "existing", message: "Receipt was marked as skipped. Fill the fields and save to overwrite." })
        } else {
          setStatus({ kind: "new", message: "New annotation. No E1 extraction cached \u2014 fill the fields manually from the receipt preview." })
        }
      }
    }
  }, [filename, annotations])

  // ─── Image resolution tracking ───────────────────────────────────────────

  useEffect(() => {
    setResolution("\u2014")
    setScale(1)
    setRotation(0)
  }, [filename])

  const handleImageLoad = useCallback(() => {
    const img = imgRef.current
    if (img?.naturalWidth && img?.naturalHeight) {
      setResolution(`${img.naturalWidth} \u00d7 ${img.naturalHeight}`)
    }
  }, [])

  // ─── Navigation ──────────────────────────────────────────────────────────

  const prevReceipt = useCallback(() => {
    if (!receipts.length) return
    setCurrentIndex((i) => (i <= 0 ? receipts.length - 1 : i - 1))
  }, [receipts])

  const nextReceipt = useCallback(() => {
    if (!receipts.length) return
    setCurrentIndex((i) => (i >= receipts.length - 1 ? 0 : i + 1))
  }, [receipts])

  // ─── Save ────────────────────────────────────────────────────────────────

  const saveAnnotation = useCallback(async () => {
    if (!filename) {
      setSaveFeedback("Select a receipt before saving.")
      return
    }
    if (!form.human_verdict_reason.trim()) {
      setSaveFeedback("Verdict Reason is required.")
      setStatus({ kind: "error", message: "Verdict Reason is required. State the primary reason in one sentence." })
      return
    }

    const parseFloat = (v: string) => {
      if (!v || v.trim() === "") return null
      const n = parseFloat(v)
      return Number.isNaN(n) ? null : n
    }

    const e1 = getE1CachedExtraction(filename)
    const entry = {
      filename,
      vendor: form.vendor || null,
      date: form.date || null,
      amount: parseFloat(form.amount),
      currency: form.currency || null,
      points_payment: parseFloat(form.points_payment),
      points_earned: parseFloat(form.points_earned),
      gift_card_payment: parseFloat(form.gift_card_payment),
      other_virtual_payment: parseFloat(form.other_virtual_payment),
      category: form.category,
      human_verdict: form.human_verdict,
      human_verdict_reason: form.human_verdict_reason.trim(),
      is_ambiguous: form.is_ambiguous,
      notes: form.notes || "",
      original_e1_values: e1 ? {
        vendor: e1.vendor || null,
        date: e1.date || null,
        amount: e1.amount || null,
        currency: e1.currency || null,
        points_payment: e1.points_payment || null,
        points_earned: e1.points_earned || null,
        gift_card_payment: e1.gift_card_payment || null,
        other_virtual_payment: e1.other_virtual_payment || null,
        category: e1.category || null,
      } : null,
    }

    setSaveFeedback("Saving\u2026")
    try {
      const data = await api.saveAnnotation(entry)
      if (!data.ok) throw new Error(data.error || "Save failed")
      setAnnotations((prev) => [...prev.filter((a) => a.filename !== filename), entry])
      setStatus({ kind: "existing", message: `Saved annotation for ${filename}. Re-edit anytime to update.` })
      setSaveFeedback(`\u2713 Saved ${filename}`)
      loadStats()
    } catch (e: any) {
      setSaveFeedback(e.message)
      setStatus({ kind: "error", message: e.message })
    }
  }, [filename, form, loadStats])

  // ─── Skip ────────────────────────────────────────────────────────────────

  const skipReceipt = useCallback(async () => {
    if (!filename) return
    const entry = {
      filename,
      status: "skipped",
      skipped: true,
      vendor: null,
      date: null,
      amount: null,
      currency: null,
      category: null,
      human_verdict: null,
      human_verdict_reason: null,
      is_ambiguous: false,
      notes: "",
      original_e1_values: null,
    }
    try {
      await api.saveAnnotation(entry)
      setAnnotations((prev) => [...prev.filter((a) => a.filename !== filename), entry])
      setStatus({ kind: "existing", message: `Receipt ${filename} marked as skipped.` })
      loadStats()
    } catch { /* silent */ }
  }, [filename, loadStats])

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        saveAnnotation()
      }
      if (e.key === "ArrowLeft") prevReceipt()
      if (e.key === "ArrowRight") nextReceipt()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [saveAnnotation, prevReceipt, nextReceipt])

  // ─── E1 for current receipt ─────────────────────────────────────────────

  const e1Data = filename ? getE1CachedExtraction(filename) : null

  const imageTransform = `scale(${scale}) rotate(${rotation}deg)`

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 items-start">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            GT: Ground Truth Annotation
          </h1>
          <p className="text-sm text-ink-mute mt-1 max-w-[60ch] leading-relaxed">
            Record the human-reviewed compliance outcome for each receipt. These
            annotations form the reference dataset used to evaluate the accuracy,
            consistency and reliability of the Compliance Intelligence Engine
            across all experiments.
          </p>
        </div>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-ink mb-1">About this page</h3>
          <p className="text-xs text-ink-mute leading-relaxed">
            Annotate each receipt with a human verdict, supporting reason and
            ambiguity flag. Fields pre-populate from E1 extraction where
            available. Use the navigation below to move through the review queue.
          </p>
        </Card>
      </div>

      {/* KPI Strip */}
      <KpiStrip stats={stats} />

      {/* Receipt Review + Metadata + Navigation */}
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 items-start">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink">Receipt Review</h3>
            <Badge variant="default">Live preview</Badge>
          </div>

          <div className="text-[15px] font-semibold text-ink mb-3 pb-2 border-b border-dashed border-slate-200 truncate">
            {filename || "\u2014"}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={prevReceipt}>
              \u2190 Previous
            </Button>
            <span className="text-xs text-ink-mute">
              {receipts.length
                ? `Receipt ${currentIndex + 1} of ${receipts.length}`
                : "Receipt \u2014 of \u2014"}
            </span>
            <Button size="sm" onClick={nextReceipt}>
              Next \u2192
            </Button>
          </div>

          {/* Image preview + metadata side by side */}
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 items-start">
            <div>
              <div className="border border-dashed border-slate-200 rounded-lg overflow-hidden bg-slate-50 min-h-[200px] flex items-center justify-center">
                {filename ? (
                  (() => {
                    const ext = filename.toLowerCase().split(".").pop()
                    if (ext === "pdf") {
                      return (
                        <a
                          href={api.getReceiptUrl(filename)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 underline text-sm p-4"
                        >
                          Open PDF: {filename}
                        </a>
                      )
                    }
                    return (
                      <img
                        ref={imgRef}
                        src={api.getReceiptUrl(filename)}
                        alt={filename}
                        className="max-w-full max-h-[500px] object-contain transition-transform duration-200"
                        style={{ transform: imageTransform, transformOrigin: "center center" }}
                        onLoad={handleImageLoad}
                        onLoadStart={() => setImageLoading(true)}
                        onLoadCapture={() => setImageLoading(false)}
                      />
                    )
                  })()
                ) : (
                  <span className="text-sm text-ink-faint p-4">Select a receipt to preview</span>
                )}
              </div>
              {/* Image controls */}
              <div className="flex items-center gap-1 mt-2">
                <Button variant="ghost" size="icon-xs" onClick={() => setScale((s) => s + 0.2)} title="Zoom in">
                  +
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => setScale((s) => Math.max(0.2, s - 0.2))} title="Zoom out">
                  \u2212
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => setRotation((r) => r + 90)} title="Rotate">
                  \u21bb
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => { setScale(1); setRotation(0) }} title="Reset">
                  \u21ba
                </Button>
              </div>
            </div>
            <ReceiptMetadata filename={filename} resolution={resolution} />
          </div>
        </Card>

        {/* Summary panel */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-ink mb-3">Annotation Summary</h3>
          <MetaRow label="Source" value="Repository" />
          <MetaRow label="AI Extraction (E1)" value={e1Data ? "Populated" : "Not run"} />
          <MetaRow
            label="Existing Annotation"
            value={
              filename
                ? annotations.find((a) => a.filename === filename)
                  ? annotations.find((a) => a.filename === filename)?.status === "skipped"
                    ? "Skipped"
                    : "Saved"
                  : "None"
                : "None"
            }
          />
        </Card>
      </div>

      {/* Annotation Form + AI Extraction Sidebar */}
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 items-start">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-ink mb-2">Annotation Workspace</h3>
          <div className="text-xs text-ink-mute mb-4 p-2.5 rounded-md border border-blue-200 bg-blue-50 text-blue-700">
            Fields below are pre-populated from E1 extraction where available. Correct any value before saving.
          </div>

          <StatusBanner kind={status.kind} message={status.message} />

          <div className="mb-4">
            <Label className="mb-1 text-xs">Receipt</Label>
            <select
              value={filename ?? ""}
              onChange={(e) => {
                const idx = receipts.indexOf(e.target.value)
                if (idx >= 0) setCurrentIndex(idx)
              }}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select a receipt...</option>
              {receipts.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <AnnotationFormFields form={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />

          {/* Action buttons */}
          <div className="mt-6 flex items-center gap-4 flex-wrap">
            <Button onClick={saveAnnotation} className="min-w-[200px]">
              Save Annotation
            </Button>
            <Button variant="outline" onClick={skipReceipt} className="min-w-[140px]">
              Skip Receipt
            </Button>
            {saveFeedback && (
              <span className="text-xs text-ink-mute">{saveFeedback}</span>
            )}
          </div>
        </Card>

        {/* Right sidebar */}
        <div className="space-y-4">
          <AiExtractionPanel e1={e1Data} />

          <Card className="p-4 bg-amber-50 border-amber-200">
            <h4 className="text-xs font-semibold text-amber-800 mb-2">Guidance</h4>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>\u2022 Verify each extracted field against the receipt</li>
              <li>\u2022 Verdict reason must be a single sentence</li>
              <li>\u2022 Use "Suspicious" only when policy is clearly violated</li>
              <li>\u2022 Mark as ambiguous if reasonable reviewers could disagree</li>
              <li>\u2022 Skipped receipts do not contribute to accuracy metrics</li>
            </ul>
          </Card>

          <Card className="p-4 bg-blue-50 border-blue-200">
            <h4 className="text-xs font-semibold text-blue-800 mb-2">Keyboard Shortcuts</h4>
            <div className="grid grid-cols-2 gap-1 text-xs text-blue-700">
              <span>\u2190 Previous</span>
              <span>\u2192 Next</span>
              <span>\u2318+S Save</span>
              <span>Esc Clear</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
