import { useState } from "react"
import { ExperimentLayout } from "@/components/experiments/ExperimentLayout"
import { ResultsExport } from "@/components/experiments/ResultsExport"
import { useReceipt } from "@/hooks/useReceipt"
import { useSettings } from "@/hooks/useSettings"
import { api, type ExtractionResponse } from "@/lib/api"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectDiscountItems(data: ExtractionResponse) {
  if (!Array.isArray(data.line_items)) return []
  return data.line_items.filter((item) => {
    const desc = (
      typeof item === "string" ? item : item.description || ""
    ).toLowerCase()
    const total = typeof item === "object" ? Number(item.total_price || 0) : 0
    return (
      total < 0 ||
      desc.includes("point") ||
      desc.includes("redeem") ||
      desc.includes("discount") ||
      desc.includes("credit") ||
      desc.includes("coupon") ||
      desc.includes("voucher")
    )
  })
}

function sumDiscount(items: ReturnType<typeof detectDiscountItems>) {
  return items.reduce(
    (sum, item) =>
      sum + (typeof item === "object" ? Number(item.total_price || 0) : 0),
    0,
  )
}

// ─── Cheque Display ───────────────────────────────────────────────────────────

function ChequeDisplay({ data }: { data: ExtractionResponse }) {
  const discountItems = detectDiscountItems(data)
  const discountTotal = sumDiscount(discountItems)

  const lineItems = Array.isArray(data.line_items) ? data.line_items : []

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "0 auto",
        background: "#ffffff",
        border: "1px dashed #d1d5db",
        borderRadius: 8,
        boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
        padding: 24,
        fontFamily: "'Courier New', Courier, monospace",
        color: "#1f2937",
      }}
    >
      {/* Receipt Header */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <h3
          style={{
            margin: "0 0 4px",
            fontSize: 18,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {data.vendor || "RECEIPT"}
        </h3>
        {data.vendor_address && (
          <p style={{ margin: 0, fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>
            {data.vendor_address}
          </p>
        )}
        {data.vendor_phone && (
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>
            Tel: {data.vendor_phone}
          </p>
        )}
        {data.vendor_tax_id && (
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>
            Tax ID: {data.vendor_tax_id}
          </p>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #d1d5db", margin: "12px 0" }} />

      {/* Metadata */}
      <div
        style={{
          fontSize: 11,
          color: "#6b7280",
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "4px 12px",
          marginBottom: 12,
        }}
      >
        {data.receipt_number && (
          <>
            <span>REC #:</span>
            <span style={{ textAlign: "right", fontWeight: 600 }}>
              {data.receipt_number}
            </span>
          </>
        )}
        <span>DATE:</span>
        <span style={{ textAlign: "right" }}>
          {data.date || "\u2014"} {data.time || ""}
        </span>
        {data.payment_method && (
          <>
            <span>PAYMENT:</span>
            <span style={{ textAlign: "right", textTransform: "uppercase" }}>
              {data.payment_method}
            </span>
          </>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #d1d5db", margin: "12px 0" }} />

      {/* Line items table */}
      <table
        style={{
          width: "100%",
          fontSize: 11,
          borderCollapse: "collapse",
          marginBottom: 12,
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "1px dashed #d1d5db",
              fontWeight: 700,
              color: "#6b7280",
            }}
          >
            <th style={{ textAlign: "left", paddingBottom: 6 }}>ITEM</th>
            <th style={{ textAlign: "right", paddingBottom: 6, width: 40 }}>
              QTY
            </th>
            <th style={{ textAlign: "right", paddingBottom: 6, width: 60 }}>
              PRICE
            </th>
            <th style={{ textAlign: "right", paddingBottom: 6, width: 60 }}>
              TOTAL
            </th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length > 0 ? (
            lineItems.map((item, i) => {
              const desc =
                typeof item === "string" ? item : item.description || "Item"
              const qty =
                typeof item === "object" ? (item.quantity ?? 1) : 1
              const price =
                typeof item === "object" ? (item.unit_price ?? 0) : 0
              const total =
                typeof item === "object"
                  ? (item.total_price ?? price * qty)
                  : 0
              return (
                <tr key={i}>
                  <td
                    style={{
                      padding: "4px 0",
                      maxWidth: 150,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {desc}
                  </td>
                  <td style={{ padding: "4px 0", textAlign: "right" }}>
                    {qty}
                  </td>
                  <td style={{ padding: "4px 0", textAlign: "right" }}>
                    {Number(price).toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: "4px 0",
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  >
                    {Number(total).toFixed(2)}
                  </td>
                </tr>
              )
            })
          ) : (
            <tr>
              <td
                colSpan={4}
                style={{
                  textAlign: "center",
                  color: "#9ca3af",
                  padding: "8px 0",
                }}
              >
                No items listed
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #d1d5db", margin: "12px 0" }} />

      {/* Totals block */}
      <div
        style={{
          fontSize: 12,
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "6px 12px",
          marginBottom: 12,
        }}
      >
        {data.subtotal != null && (
          <>
            <span>SUBTOTAL:</span>
            <span style={{ textAlign: "right" }}>
              {Number(data.subtotal).toFixed(2)}
            </span>
          </>
        )}
        {data.tax_amount != null && (
          <>
            <span>
              TAX/VAT{data.tax_rate ? ` (${data.tax_rate}%)` : ""}:
            </span>
            <span style={{ textAlign: "right" }}>
              {Number(data.tax_amount).toFixed(2)}
            </span>
          </>
        )}
        {data.surcharge != null && Number(data.surcharge) !== 0 && (
          <>
            <span>SURCHARGE:</span>
            <span style={{ textAlign: "right" }}>
              {Number(data.surcharge).toFixed(2)}
            </span>
          </>
        )}
        {data.cash_out != null && Number(data.cash_out) !== 0 && (
          <>
            <span>CASH OUT:</span>
            <span style={{ textAlign: "right" }}>
              {Number(data.cash_out).toFixed(2)}
            </span>
          </>
        )}
        {data.points_payment != null && Number(data.points_payment) !== 0 && (
          <>
            <span style={{ color: "#6366f1", fontWeight: 600 }}>
              POINTS PAYMENT:
            </span>
            <span
              style={{ textAlign: "right", color: "#6366f1", fontWeight: 600 }}
            >
              {Number(data.points_payment).toFixed(2)}
            </span>
          </>
        )}
        {data.points_earned != null && Number(data.points_earned) !== 0 && (
          <>
            <span style={{ color: "#16a34a", fontWeight: 600 }}>
              POINTS EARNED:
            </span>
            <span
              style={{ textAlign: "right", color: "#16a34a", fontWeight: 600 }}
            >
              +{Number(data.points_earned).toFixed(2)}
            </span>
          </>
        )}
        {data.gift_card_payment != null &&
          Number(data.gift_card_payment) !== 0 && (
            <>
              <span style={{ color: "#6366f1", fontWeight: 600 }}>
                GIFT CARD PAYMENT:
              </span>
              <span
                style={{
                  textAlign: "right",
                  color: "#6366f1",
                  fontWeight: 600,
                }}
              >
                {Number(data.gift_card_payment).toFixed(2)}
              </span>
            </>
          )}
        {data.other_virtual_payment != null &&
          Number(data.other_virtual_payment) !== 0 && (
            <>
              <span style={{ color: "#6366f1", fontWeight: 600 }}>
                OTHER VIRTUAL PAYMENT:
              </span>
              <span
                style={{
                  textAlign: "right",
                  color: "#6366f1",
                  fontWeight: 600,
                }}
              >
                {Number(data.other_virtual_payment).toFixed(2)}
              </span>
            </>
          )}
        {discountTotal !== 0 && (
          <>
            <span style={{ color: "#6366f1", fontWeight: 600 }}>
              POINTS / DISCOUNT:
            </span>
            <span
              style={{ textAlign: "right", color: "#6366f1", fontWeight: 600 }}
            >
              {Number(discountTotal).toFixed(2)}
            </span>
          </>
        )}
        <span style={{ fontSize: 14, fontWeight: 700 }}>TOTAL:</span>
        <span style={{ fontSize: 14, fontWeight: 700, textAlign: "right" }}>
          {data.currency || ""} {Number(data.amount || 0).toFixed(2)}
        </span>
      </div>

      <div style={{ borderTop: "1px dashed #d1d5db", margin: "12px 0" }} />

      {/* Category footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          marginTop: 4,
        }}
      >
        <span style={{ color: "#6b7280" }}>CATEGORY:</span>
        <span
          style={{
            background: "#f9fafb",
            color: "#1f2937",
            border: "1px solid #e5e7eb",
            borderRadius: 4,
            padding: "2px 8px",
            fontWeight: 600,
            textTransform: "uppercase",
            fontSize: 10,
          }}
        >
          {data.category || "OTHER"}
        </span>
      </div>
    </div>
  )
}

// ─── Extraction Data Table ────────────────────────────────────────────────────

const EXTRACTION_FIELDS = [
  { label: "Vendor", key: "vendor", section: "vendor" },
  { label: "Vendor Address", key: "vendor_address", section: "vendor" },
  { label: "Vendor Phone", key: "vendor_phone", section: "vendor" },
  { label: "Vendor Tax ID", key: "vendor_tax_id", section: "vendor" },
  { label: "Receipt #", key: "receipt_number", section: "receipt" },
  { label: "Date", key: "date", section: "receipt" },
  { label: "Time", key: "time", section: "receipt" },
  { label: "Payment Method", key: "payment_method", section: "receipt" },
  { label: "Subtotal", key: "subtotal", section: "amounts" },
  { label: "Tax Amount", key: "tax_amount", section: "amounts" },
  { label: "Tax Rate", key: "tax_rate", section: "amounts" },
  { label: "Points Payment", key: "points_payment", section: "amounts" },
  { label: "Points Earned", key: "points_earned", section: "amounts" },
  { label: "Gift Card Payment", key: "gift_card_payment", section: "amounts" },
  {
    label: "Other Virtual Payment",
    key: "other_virtual_payment",
    section: "amounts",
  },
  { label: "Total Amount", key: "amount", section: "amounts" },
  { label: "Currency", key: "currency", section: "amounts" },
  { label: "Category", key: "category", section: "class" },
]

const SECTIONS = [
  { id: "vendor", title: "Vendor" },
  { id: "receipt", title: "Receipt Details" },
  { id: "amounts", title: "Amounts & Tax" },
  { id: "class", title: "Classification" },
]

function ExtractionDataTable({ data }: { data: ExtractionResponse }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="font-semibold text-sm mb-4">Extracted Receipt Data</h3>

      {SECTIONS.map((section) => {
        const rows = EXTRACTION_FIELDS.filter((f) => f.section === section.id)
        return (
          <div key={section.id}>
            <h4 className="font-medium text-xs text-gray-500 mt-3 mb-1.5 uppercase">
              {section.title}
            </h4>
            <table className="w-full text-xs">
              <tbody>
                {rows.map((field) => {
                  const val = (data as Record<string, unknown>)[field.key]
                  return (
                    <tr
                      key={field.key}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="py-1.5 pr-4 text-gray-500 w-36 text-xs">
                        {field.label}
                      </td>
                      <td className="py-1.5 font-mono text-xs">
                        {val != null ? (
                          typeof val === "number" ? (
                            val.toFixed(2)
                          ) : (
                            String(val)
                          )
                        ) : (
                          <span className="text-gray-400 italic">null</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      {Array.isArray(data.line_items) && data.line_items.length > 0 && (
        <div>
          <h4 className="font-medium text-xs text-gray-500 mt-4 mb-2 uppercase">
            Line Items
          </h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <td className="py-1 pr-2">#</td>
                <td className="py-1 pr-2">Description</td>
                <td className="py-1 pr-2 text-right">Qty</td>
                <td className="py-1 pr-2 text-right">Unit</td>
                <td className="py-1 text-right">Total</td>
              </tr>
            </thead>
            <tbody>
              {data.line_items.map((item, i) => {
                const desc =
                  typeof item === "string" ? item : item.description || ""
                const qty =
                  typeof item === "object" ? item.quantity : null
                const unit =
                  typeof item === "object" ? item.unit_price : null
                const total =
                  typeof item === "object" ? item.total_price : null
                return (
                  <tr
                    key={i}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-1 pr-2 text-gray-400">{i + 1}</td>
                    <td className="py-1 pr-2 font-mono">{desc}</td>
                    <td className="py-1 pr-2 text-right font-mono">
                      {qty != null ? qty : "\u2014"}
                    </td>
                    <td className="py-1 pr-2 text-right font-mono">
                      {unit != null ? Number(unit).toFixed(2) : "\u2014"}
                    </td>
                    <td className="py-1 text-right font-mono">
                      {total != null ? Number(total).toFixed(2) : "\u2014"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── E1 Page ──────────────────────────────────────────────────────────────────

export default function E1Page() {
  const [result, setResult] = useState<ExtractionResponse | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { receipt } = useReceipt()
  const { settings } = useSettings()

  const handleRun = async () => {
    if (!receipt) return
    setIsRunning(true)
    setError(null)
    try {
      const res = await api.extract({
        base64: receipt.base64,
        mimeType: receipt.mimeType,
        filename: receipt.filename,
        model: settings.visionModel,
        currency: settings.currency,
      })
      if (res.error) throw new Error(res.error)
      setResult(res.extraction)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Extraction failed")
    }
    setIsRunning(false)
  }

  return (
    <ExperimentLayout
      experimentId="e1"
      title="E1: OCR Extraction Baseline"
      hypothesis="A multimodal LLM can reliably extract structured fields (vendor, date, amount, currency, category, line items) from real-world receipt photos of varying quality, language, and format."
      expectedOutput="Table of extracted fields: vendor (string), date (YYYY-MM-DD), amount (float), currency (ISO 4217), category (enum), line_items (array). Unreadable fields show as null."
      onRun={handleRun}
      isRunning={isRunning}
      error={error}
    >
      {result && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <ChequeDisplay data={result} />
            <ExtractionDataTable data={result} />
          </div>
          <ResultsExport experimentId="e1" data={result} />
        </div>
      )}
    </ExperimentLayout>
  )
}
