const EXperiments = [
  { title: "E1: OCR Extraction Baseline", desc: "Establish a baseline for OCR extraction accuracy by capturing all structured information from real-world receipts.", href: "/e1" },
  { title: "E2: Direct Policy Reasoning", desc: "Apply organisational policy directly to structured accounting data without structured reasoning.", href: "/e2" },
  { title: "E3: Structured CoT", desc: "Test whether structured chain-of-thought reasoning improves policy interpretation and verdict accuracy.", href: "/e3" },
  { title: "E4: Context-Sensitive Reasoning", desc: "Evaluate how project phase context affects the same transaction's compliance outcome.", href: "/e4" },
  { title: "E5: Uncertainty Handling", desc: "Test whether the model recognises ambiguity and avoids forced confident verdicts on incomplete evidence.", href: "/e5" },
  { title: "E6: Adversarial Stress Test", desc: "Run the same transaction against all three policy variants simultaneously to surface policy-quality issues.", href: "/e6" },
  { title: "Ground Truth Annotation", desc: "Annotate each receipt with a human verdict and supporting reason. The reference dataset for evaluation.", href: "/annotate" },
  { title: "Policy Editor", desc: "Define and version the three controlled policy variants used by E2\u2013E6.", href: "/policy-editor" },
  { title: "Research Configuration", desc: "Configure the API key, models, currency treatment and saved-result controls used across all experiments.", href: "/settings" },
]

export default function HomePage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-ink tracking-tight">
          TOTALFLOW Compliance Intelligence Engine
        </h1>
        <p className="text-ink-mute mt-2 text-sm">
          Semantic Reasoning Research Platform
        </p>
      </div>

      <header className="mb-6">
        <h2 className="text-xl font-semibold text-ink">Research Programme Overview</h2>
        <p className="text-sm text-ink-mute mt-1 max-w-3xl leading-relaxed">
          The TOTALFLOW Compliance Intelligence Engine is a research platform that
          evaluates whether multimodal large language models can reliably apply
          organisational expense policy to real-world receipts. Each experiment is a
          self-contained page \u2014 open the one you want to run.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {EXperiments.map((card) => (
          <a
            key={card.href}
            href={card.href}
            className="block p-4 rounded-xl ring-1 ring-foreground/10 hover:ring-indigo-300 hover:shadow-sm transition-all text-decoration-none"
          >
            <h3 className="font-semibold text-ink text-sm">{card.title}</h3>
            <p className="text-xs text-ink-mute mt-1 leading-relaxed">{card.desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
