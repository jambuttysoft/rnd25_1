import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"

interface PhaseData {
  name: string
  description: string
  allowed: string[]
  restricted: string[]
  forbidden: string[]
}

interface PolicyData {
  policy_name: string
  project_name: string
  description: string
  version?: string
  identifier?: string
  updated_at?: string
  updated_by?: string
  phases: PhaseData[]
}

const EMPTY_PHASE: PhaseData = {
  name: "",
  description: "",
  allowed: [],
  restricted: [],
  forbidden: [],
}

const POLICY_LABELS: Record<string, string> = {
  clear: "Clear Policy",
  vague: "Vague Policy",
  contradictory: "Contradictory Policy",
}

function TagInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState("")

  const addTag = () => {
    const values = input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (values.length) {
      onChange([...tags, ...values])
      setInput("")
    }
  }

  const removeTag = (idx: number) => {
    onChange(tags.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-lg bg-white min-h-[2rem]">
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs"
        >
          <span>{tag}</span>
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="text-slate-400 hover:text-red-500 font-bold leading-none"
          >
            &times;
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            addTag()
          }
        }}
        onBlur={addTag}
        placeholder="Add item..."
        className="flex-1 min-w-[80px] border-0 outline-none text-xs bg-transparent"
      />
    </div>
  )
}

function PhaseEditor({
  phase,
  index,
  onChange,
}: {
  phase: PhaseData
  index: number
  onChange: (patch: Partial<PhaseData>) => void
}) {
  const [open, setOpen] = useState(index === 0)
  const totalRules = phase.allowed.length + phase.restricted.length + phase.forbidden.length

  return (
    <div className="border border-slate-200 rounded-lg mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 text-sm font-medium cursor-pointer hover:bg-slate-50 flex items-center justify-between rounded-t-lg"
      >
        <span>
          Phase {index + 1}: {phase.name || "Untitled"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-mute">Total Rules: {totalRules}</span>
          <span className="text-ink-mute">{open ? "\u25b2" : "\u25bc"}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-slate-200 space-y-3">
          <div>
            <Label className="mb-0.5 text-xs">Phase Name</Label>
            <Input
              value={phase.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="mb-0.5 text-xs">Description</Label>
            <textarea
              value={phase.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={1}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
            />
          </div>
          <div>
            <Label className="mb-0.5 text-xs">Allowed</Label>
            <TagInput
              tags={phase.allowed}
              onChange={(allowed) => onChange({ allowed })}
            />
          </div>
          <div>
            <Label className="mb-0.5 text-xs">Restricted</Label>
            <TagInput
              tags={phase.restricted}
              onChange={(restricted) => onChange({ restricted })}
            />
          </div>
          <div>
            <Label className="mb-0.5 text-xs">Forbidden</Label>
            <TagInput
              tags={phase.forbidden}
              onChange={(forbidden) => onChange({ forbidden })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function PolicyEditorPage() {
  const [selectedPolicy, setSelectedPolicy] = useState("clear")
  const [policy, setPolicy] = useState<PolicyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null)
  const [changeReason, setChangeReason] = useState("")

  const loadPolicy = useCallback(async (name: string) => {
    setLoading(true)
    setFeedback(null)
    try {
      const data = await api.getPolicy(name)
      setPolicy(data)
    } catch (e: any) {
      setFeedback({ type: "error", message: `Failed to load policy: ${e.message}` })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPolicy(selectedPolicy)
  }, [selectedPolicy, loadPolicy])

  const updatePhase = useCallback((index: number, patch: Partial<PhaseData>) => {
    setPolicy((prev) => {
      if (!prev) return prev
      const phases = [...prev.phases]
      phases[index] = { ...phases[index], ...patch }
      return { ...prev, phases }
    })
  }, [])

  const savePolicy = useCallback(async () => {
    if (!policy) return
    if (!changeReason.trim()) {
      setFeedback({ type: "error", message: "Reason for Change is required. Explain why this policy version is being modified before saving." })
      return
    }
    setFeedback({ type: "info", message: "Saving\u2026" })
    try {
      const result = await api.updatePolicy(selectedPolicy, {
        policy_name: selectedPolicy,
        project_name: policy.project_name,
        description: policy.description,
        phases: policy.phases,
      })
      if (result.ok) {
        setFeedback({ type: "success", message: "\u2713 Policy saved" })
        setChangeReason("")
      } else {
        setFeedback({ type: "error", message: result.error || "Save failed" })
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: `Save failed: ${e.message}` })
    }
  }, [policy, selectedPolicy, changeReason])

  const resetPolicy = useCallback(async () => {
    setFeedback({ type: "info", message: "Resetting\u2026" })
    await loadPolicy(selectedPolicy)
    setFeedback({ type: "success", message: "\u2713 Reset to current saved version" })
  }, [selectedPolicy, loadPolicy])

  const clearForm = useCallback(() => {
    if (!confirm("Clear all policy fields? This empties the form but does NOT save. You must click Save to persist changes.")) return
    setPolicy((prev) =>
      prev
        ? {
            ...prev,
            project_name: "",
            description: "",
            phases: prev.phases.map((p) => ({ ...p, name: "", description: "", allowed: [], restricted: [], forbidden: [] })),
          }
        : prev
    )
    setFeedback({ type: "info", message: "\u2713 Form cleared. Click Save to persist your changes." })
  }, [])

  const feedbackColors = {
    success: "text-green-600",
    error: "text-red-600",
    info: "text-slate-500",
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-ink tracking-tight">PE: Policy Editor</h1>
        <p className="text-sm text-ink-mute mt-1 max-w-3xl leading-relaxed">
          Define and maintain the controlled organisational policy variants used
          across Experiments E2\u2013E6. Policy changes affect future experiment
          runs and must be versioned to preserve research reproducibility.
        </p>
      </header>

      {/* Policy Status */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-ink">Policy Status</h3>
          <span className="text-xs text-ink-mute">(Current Selection)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <div className="text-xs text-ink-mute">Selected Policy</div>
            <div className="text-sm font-semibold text-indigo-600">
              {POLICY_LABELS[selectedPolicy] || selectedPolicy}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-mute">Policy Name</div>
            <div className="text-xs text-ink truncate">
              {policy?.policy_name || "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-mute">Version</div>
            <div className="text-sm text-ink">{policy?.version || "v1.0"}</div>
          </div>
          <div>
            <div className="text-xs text-ink-mute">Status</div>
            <Badge variant="default">Saved</Badge>
          </div>
          <div>
            <div className="text-xs text-ink-mute">Last Updated</div>
            <div className="text-xs text-ink">
              {policy?.updated_at
                ? new Date(policy.updated_at).toLocaleString("en-AU", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "\u2014"}
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2.5">
          <strong>Research Control:</strong> Saved policy changes apply only to
          future experiment runs. Existing experiment results remain linked to the
          exact policy version used when they were generated.
        </div>
      </Card>

      {/* Policy Identity */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-ink">Policy Identity</h3>
          <span className="text-xs text-ink-mute">(Editing)</span>
        </div>

        {selectedPolicy === "contradictory" && (
          <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md p-2.5 mb-3">
            <strong>E6 Adversarial Variant:</strong> This contradictory policy is
            used to stress-test the model. Contradictions between Allowed and
            Forbidden lists are intentional.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <Label className="mb-1 text-xs">Policy Variant</Label>
            <select
              value={selectedPolicy}
              onChange={(e) => setSelectedPolicy(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="clear">Clear Policy</option>
              <option value="vague">Vague Policy</option>
              <option value="contradictory">Contradictory Policy</option>
            </select>
          </div>
          <div>
            <Label className="mb-1 text-xs">
              Policy Name <span className="text-red-600">*</span>
            </Label>
            <Input
              value={policy?.policy_name || ""}
              onChange={(e) =>
                setPolicy((prev) =>
                  prev ? { ...prev, policy_name: e.target.value } : prev
                )
              }
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="mb-1 text-xs">Project Name</Label>
            <Input
              value={policy?.project_name || ""}
              onChange={(e) =>
                setPolicy((prev) =>
                  prev ? { ...prev, project_name: e.target.value } : prev
                )
              }
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="mb-1 text-xs">
              Change Reason <span className="text-red-600">*</span>{" "}
              <span className="text-ink-mute font-normal">(required for edits)</span>
            </Label>
            <Input
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Explain why this policy is being modified"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div>
          <Label className="mb-1 text-xs">Policy Description</Label>
          <textarea
            value={policy?.description || ""}
            onChange={(e) =>
              setPolicy((prev) =>
                prev ? { ...prev, description: e.target.value } : prev
              )
            }
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
          />
        </div>
      </Card>

      {/* Phase Rules */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink mb-1">Policy Rules by Phase</h3>
        <p className="text-xs text-ink-mute mb-4">
          Define ALLOWED, RESTRICTED and FORBIDDEN rules for each project phase.
        </p>
        {policy?.phases.map((phase, i) => (
          <PhaseEditor
            key={i}
            phase={phase}
            index={i}
            onChange={(patch) => updatePhase(i, patch)}
          />
        ))}
        {loading && <div className="text-sm text-ink-mute text-center py-4">Loading policy...</div>}
      </Card>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <strong>Important: Policy Changes</strong> \u2014 Saving a policy creates a
        new version. This new version will be used for future experiment runs
        only. Existing experiment results remain linked to their original policy
        version.
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button onClick={savePolicy} className="min-w-[160px]">
          Save Policy
        </Button>
        <Button variant="outline" onClick={resetPolicy} className="min-w-[160px]">
          Reset to Default
        </Button>
        <Button variant="destructive" onClick={clearForm} className="min-w-[180px]">
          Discard Unsaved Changes
        </Button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`text-center text-sm ${feedbackColors[feedback.type]}`}>
          {feedback.message}
        </div>
      )}

      <div className="text-xs text-ink-faint text-center py-2">
        All policy versions are immutable and auditable to ensure research
        reproducibility and traceability.
      </div>
    </div>
  )
}
