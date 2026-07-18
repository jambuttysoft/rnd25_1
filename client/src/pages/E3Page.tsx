import { useState } from "react"
import { ExperimentLayout } from "@/components/experiments/ExperimentLayout"
import { VerdictBadge } from "@/components/experiments/VerdictBadge"
import { ReasoningChain } from "@/components/experiments/ReasoningChain"
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

export default function E3Page() {
  const [result, setResult] = useState<{
    verdict: string
    reason: string
    reasoning?: string
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
        useCot: true,
      })
      if (res.error) throw new Error(res.error)
      setResult({
        verdict: res.verdict,
        reason: res.reason,
        reasoning: res.reasoning,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Experiment failed")
    }
    setIsRunning(false)
  }

  const configPanel = (
    <div className="space-y-3">
      <div>
        <Label htmlFor="e3-policy">Policy Variant</Label>
        <Select value={policyName} onValueChange={(v) => v != null && setPolicyName(v)}>
          <SelectTrigger id="e3-policy">
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
      experimentId="e3"
      title="E3: Structured Chain-of-Thought"
      hypothesis="Explicit step-by-step reasoning improves verdict accuracy and provides auditable rationale"
      expectedOutput='{"verdict": "...", "reason": "...", "reasoning": "step-by-step analysis"}'
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
          {result.reasoning && (
            <ReasoningChain reasoning={result.reasoning} />
          )}
        </div>
      )}
      {result && <ResultsExport experimentId="e3" data={result} />}
    </ExperimentLayout>
  )
}
