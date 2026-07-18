import { useState } from "react"
import { ExperimentLayout } from "@/components/experiments/ExperimentLayout"
import { VerdictBadge } from "@/components/experiments/VerdictBadge"
import { ResultsExport } from "@/components/experiments/ResultsExport"
import { useReceipt } from "@/hooks/useReceipt"
import { useSettings } from "@/hooks/useSettings"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const POLICIES = ["clear", "vague", "contradictory"] as const

interface PolicyResult {
  policyName: string
  verdict: string
  reason: string
  policy_clarity?: string
}

export default function E6Page() {
  const [results, setResults] = useState<PolicyResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { receipt } = useReceipt()
  const { settings } = useSettings()

  const handleRun = async () => {
    if (!receipt) return
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
      }

      const requests = POLICIES.map((policyName) =>
        api.adversarial({ ...basePayload, policyName })
      )

      const responses = await Promise.all(requests)
      const policyResults: PolicyResult[] = responses.map((res, i) => {
        if (res.error) throw new Error(res.error)
        return {
          policyName: POLICIES[i],
          verdict: res.verdict,
          reason: res.reason,
          policy_clarity: res.policy_clarity,
        }
      })
      setResults(policyResults)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Experiment failed")
    }
    setIsRunning(false)
  }

  const isHallucination = (r: PolicyResult) =>
    r.policyName !== "clear" && r.policy_clarity === "clear"

  return (
    <ExperimentLayout
      experimentId="e6"
      title="E6: Adversarial Policy Stress Test"
      hypothesis="The model's verdict changes predictably when policy clarity degrades, and hallucination detection identifies misassessed clarity"
      expectedOutput='{"verdict": "justified|suspicious|unclear", "reason": "one sentence", "policy_clarity": "clear|vague|contradictory"}'
      onRun={handleRun}
      isRunning={isRunning}
      error={error}
    >
      {results.length > 0 && (
        <div className="space-y-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Policy Comparison
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {results.map((r) => (
              <Card key={r.policyName} className="border border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {r.policyName} policy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <VerdictBadge verdict={r.verdict} />
                    {isHallucination(r) && (
                      <Badge
                        variant="outline"
                        className="bg-orange-50 text-orange-700 border-orange-300 text-xs"
                      >
                        ⚠ hallucination
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-700">{r.reason}</p>
                  {r.policy_clarity && (
                    <p className="text-xs text-gray-500">
                      Policy assessed as:{" "}
                      <strong>{r.policy_clarity}</strong>
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <ResultsExport
            experimentId="e6"
            data={{ policies: results }}
          />
        </div>
      )}
    </ExperimentLayout>
  )
}
