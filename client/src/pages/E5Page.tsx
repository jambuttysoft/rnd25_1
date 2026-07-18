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

export default function E5Page() {
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
        useE5Prompt: true,
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

  const isUnclear = result?.verdict === "unclear"

  const configPanel = (
    <div className="space-y-3">
      <div>
        <Label htmlFor="e5-policy">Policy Variant</Label>
        <Select value={policyName} onValueChange={(v) => v != null && setPolicyName(v)}>
          <SelectTrigger id="e5-policy">
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
      experimentId="e5"
      title="E5: Uncertainty Calibration"
      hypothesis="Adding an information sufficiency step increases appropriate 'unclear' verdicts on ambiguous receipts"
      expectedOutput='{"verdict": "...", "reason": "...", "reasoning": "5-step analysis"}'
      configPanel={configPanel}
      onRun={handleRun}
      isRunning={isRunning}
      error={error}
    >
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <VerdictBadge verdict={result.verdict} />
              {isUnclear ? (
                <span className="text-xs bg-green-100 border border-green-300 text-green-800 px-2 py-0.5 rounded">
                  ✓ Uncertainty expressed
                </span>
              ) : (
                <span className="text-xs bg-orange-100 border border-orange-300 text-orange-700 px-2 py-0.5 rounded">
                  ⚠ Confident verdict on ambiguous receipt
                </span>
              )}
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Ambiguity Assessment
            </span>
          </div>
          <p className="text-sm font-medium text-gray-700">{result.reason}</p>
          {result.reasoning && (
            <ReasoningChain reasoning={result.reasoning} />
          )}
        </div>
      )}
      {result && <ResultsExport experimentId="e5" data={result} />}
    </ExperimentLayout>
  )
}
