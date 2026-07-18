import { type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useReceipt } from "@/hooks/useReceipt"
import { ResultsExport } from "./ResultsExport"

interface ExperimentLayoutProps {
  experimentId: string
  title: string
  hypothesis?: string
  expectedOutput?: string
  configPanel?: ReactNode
  children?: ReactNode
  onRun: () => Promise<void>
  isRunning?: boolean
  error?: string | null
}

export function ExperimentLayout({
  experimentId,
  title,
  hypothesis,
  expectedOutput,
  configPanel,
  children,
  onRun,
  isRunning = false,
  error = null,
}: ExperimentLayoutProps) {
  const { receipt, setReceipt } = useReceipt()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = ev => resolve((ev.target?.result as string).split(",")[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    setReceipt({ base64, mimeType: file.type || "image/jpeg", filename: file.name })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          {(hypothesis || expectedOutput) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                alert(`Hypothesis: ${hypothesis}\n\nExpected: ${expectedOutput}`)
              }}
            >
              Info
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {receipt && (
            <span className="text-sm text-ink-soft truncate max-w-[200px]">
              {receipt.filename}
            </span>
          )}
        </div>
      </Card>

      {configPanel && <Card className="p-4">{configPanel}</Card>}

      <div className="flex items-center gap-4">
        <Button onClick={onRun} disabled={isRunning || !receipt}>
          {isRunning ? "Running..." : "Run Experiment"}
        </Button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {children && (
        <Card className="p-4">
          <div className="space-y-4">
            {children}
            <ResultsExport experimentId={experimentId} data={null} />
          </div>
        </Card>
      )}
    </div>
  )
}
