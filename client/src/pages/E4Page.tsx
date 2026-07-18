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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const PHASES = [
  { index: 0, label: "Phase 1: Infrastructure Setup" },
  { index: 1, label: "Phase 2: Experimentation" },
  { index: 2, label: "Phase 3: Evaluation & Documentation" },
]

interface PhaseResult {
  verdict: string
  reason: string
  phase: string
  phaseIndex: number
}

export default function E4Page() {
  const [results, setResults] = useState<PhaseResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [policyName, setPolicyName] = useState("clear")
  const [selectedPhases, setSelectedPhases] = useState<Set<number>>(
    new Set([0, 1, 2])
  )
  const { receipt } = useReceipt()
  const { settings } = useSettings()

  const togglePhase = (index: number) => {
    setSelectedPhases((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleRun = async () => {
    if (!receipt || selectedPhases.size === 0) return
    setIsRunning(true)
    setError(null)
    setResults([])
    try {
      const basePayload = {
        base64: receipt.base64,
        mimeType: receipt.mimeType,
        filename: receipt.filename,
        model: settings.model,
        visionModel: settings.visionModel,
        currency: settings.currency,
        policyName,
      }

      const phaseIndices = Array.from(selectedPhases).sort()
      const requests = phaseIndices.map((phaseIndex) =>
        api.phaseSensitivity({ ...basePayload, phaseIndex })
      )

      const responses = await Promise.all(requests)
      const phaseResults: PhaseResult[] = responses.map((res, i) => {
        if (res.error) throw new Error(res.error)
        return {
          verdict: res.verdict,
          reason: res.reason,
          phase: res.phase || PHASES[phaseIndices[i]]?.label || `Phase ${phaseIndices[i] + 1}`,
          phaseIndex: phaseIndices[i],
        }
      })
      setResults(phaseResults)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Experiment failed")
    }
    setIsRunning(false)
  }

  const configPanel = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="e4-policy">Policy Variant</Label>
        <Select
          value={policyName}
          onValueChange={(v) => v != null && setPolicyName(v)}
        >
          <SelectTrigger id="e4-policy">
            <SelectValue placeholder="Select policy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="clear">Clear</SelectItem>
            <SelectItem value="vague">Vague</SelectItem>
            <SelectItem value="contradictory">Contradictory</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Project Phases</Label>
        <div className="space-y-2 mt-2">
          {PHASES.map((phase) => (
            <label
              key={phase.index}
              className="flex items-center gap-2 text-sm text-ink cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedPhases.has(phase.index)}
                onChange={() => togglePhase(phase.index)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              {phase.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <ExperimentLayout
      experimentId="e4"
      title="E4: Context-Sensitive Reasoning"
      hypothesis="An LLM can apply organisational policy across multiple project phases and context scenarios"
      expectedOutput='{"verdict": "justified|suspicious|unclear", "reason": "one sentence", "phase": "Phase 1: ..."}'
      configPanel={configPanel}
      onRun={handleRun}
      isRunning={isRunning}
      error={error}
    >
      {results.length > 0 && (
        <div className="space-y-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Phase Results
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {results.map((r) => (
              <Card key={r.phaseIndex} className="border border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {r.phase}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <VerdictBadge verdict={r.verdict} />
                  <p className="text-sm font-medium text-gray-700">{r.reason}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <ResultsExport
            experimentId="e4"
            data={{ policy: policyName, phases: results }}
          />
        </div>
      )}
    </ExperimentLayout>
  )
}
