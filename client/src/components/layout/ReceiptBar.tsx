import { useReceipt } from "@/hooks/useReceipt"

export function ReceiptBar() {
  const { receipt, clearReceipt } = useReceipt()

  if (!receipt) return null

  return (
    <div className="bg-indigo-soft border-b border-border px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium text-ink">Receipt:</span>
        <span className="text-ink-soft">{receipt.filename}</span>
        {receipt.hash && (
          <span className="text-xs text-ink-mute font-mono">[{receipt.hash}]</span>
        )}
      </div>
      <button
        onClick={clearReceipt}
        className="text-xs text-ink-soft hover:text-ink cursor-pointer bg-transparent border-none"
      >
        Clear
      </button>
    </div>
  )
}
