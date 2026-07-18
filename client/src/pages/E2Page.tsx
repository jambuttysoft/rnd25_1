import { useState } from "react"
import { ExperimentLayout } from "@/components/experiments/ExperimentLayout"
import { VerdictBadge } from "@/components/experiments/VerdictBadge"
import { ResultsExport } from "@/components/experiments/ResultsExport"
import { useReceipt } from "@/hooks/useReceipt"
import { useSettings } from "@/hooks/useSettings"
import { api } from "@/lib/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export default function E2Page() {
  const [result, setResult] = useState<{
    verdict: string
    reason: string
  } | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [policyName, setPolicyName] = useState("clear")
  const { receipt } = useReceipt()
  const { settings } = useSettings()

  const handleRun = async () => {
    if (!receipt) return
    setIsRunning(true)
    setError(null)
    try {
      const res = await api.verdict({
        base64: receipt.base64,
        mimeType: receipt.mimeType,
        filename: receipt.filename,
        model: settings.model,
        visionModel: settings.visionModel,
        currency: settings.currency,
        policy: policyName,
        useCot: false,
      })
      if (res.error) throw new Error(res.error)
      setResult({ verdict: res.verdict, reason: res.reason })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Experiment failed")
    }
    setIsRunning(false)
  }

  const configPanel = (
    <div className="space-y-3">
      <div>
        <Label htmlFor="e2-policy">Policy Variant</Label>
        <Select value={policyName} onValueChange={(v) => v != null && setPolicyName(v)}>
          <SelectTrigger id="e2-policy">
            <SelectValue placeholder="Select policy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="clear">Clear</SelectItem>
            <SelectItem value="vague">Vague</SelectItem>
            <SelectItem value="contradictory">Contradictory</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <ExperimentLayout
      experimentId="e2"
      title="E2: Direct Policy Reasoning"
      hypothesis="An LLM can classify expenses as justified/suspicious/unclear given a policy without explicit step-by-step reasoning"
      expectedOutput='{"verdict": "justified|suspicious|unclear", "reason": "one sentence explanation"}'
      configPanel={configPanel}
      onRun={handleRun}
      isRunning={isRunning}
      error={error}
    >
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Verdict Assessment
            </span>
            <VerdictBadge verdict={result.verdict} />
          </div>
          <p className="text-sm font-medium text-gray-700">{result.reason}</p>
        </div>
      )}
      {result && <ResultsExport experimentId="e2" data={result} />}
    </ExperimentLayout>
  )
}
