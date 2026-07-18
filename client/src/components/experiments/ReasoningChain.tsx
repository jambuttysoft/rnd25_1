import { useState } from "react"

export function ReasoningChain({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false)
  if (!reasoning) return null
  const steps = reasoning.split(/\d+\.\s+/).filter(Boolean)
  return (
    <details className="mt-2" open={open} onToggle={() => setOpen(!open)}>
      <summary className="text-xs text-indigo cursor-pointer font-medium select-none">
        {open ? "Hide" : "Show"} reasoning chain
      </summary>
      <div className="mt-2 text-xs text-gray-600 space-y-2 pl-2 border-l-2 border-gray-200">
        {steps.map((step, i) => (
          <div key={i} className="pl-2">
            <span className="font-medium text-gray-500">Step {i + 1}:</span>
            <span className="ml-1">{step}</span>
          </div>
        ))}
      </div>
    </details>
  )
}
