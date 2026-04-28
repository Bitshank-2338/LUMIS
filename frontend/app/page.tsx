import Link from "next/link";
import {
  Shield,
  ShieldAlert,
  Zap,
  GitBranch,
  Lock,
  ArrowRight,
  Globe,
  FileCheck,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen">
      <nav className="border-b border-border/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">LUMIS</span>
            <span className="text-xs text-slate-500 ml-1">/ AI Compliance OS</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#audit" className="text-slate-400 hover:text-white transition">Audit</a>
            <Link href="/monitor" className="text-slate-400 hover:text-white transition">Monitor</Link>
            <Link href="/laws" className="text-slate-400 hover:text-white transition">Laws</Link>
            <Link href="/crisis" className="text-slate-400 hover:text-white transition">Crisis</Link>
            <a href="#sdk" className="text-slate-400 hover:text-white transition">SDK</a>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white transition font-medium"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-xs text-accent-glow mb-8">
          <span className="w-2 h-2 rounded-full bg-accent-glow animate-pulse" />
          Built on MiroFish · Powered by Google Cloud
        </div>
        <h1 className="text-6xl md:text-7xl font-bold tracking-tight bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent mb-6">
          Every AI decision
          <br />
          deserves an audit.
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
          LUMIS is the plug-and-play AI bias auditing platform. Plug in any model
          — REST API, OpenAI, or Python callable — and get a regulatory-grade
          fairness report in minutes.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/dashboard/new"
            className="px-6 py-3 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold flex items-center gap-2 transition"
          >
            Start an audit <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#sdk"
            className="px-6 py-3 rounded-lg border border-border hover:bg-elevated text-slate-200 font-semibold transition"
          >
            View SDK
          </a>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {[
            { label: "EU AI Act", icon: Shield },
            { label: "EEOC", icon: FileCheck },
            { label: "ECOA", icon: Lock },
            { label: "GDPR Art. 22", icon: Globe },
          ].map((b) => (
            <div
              key={b.label}
              className="glow-card rounded-xl p-4 flex items-center gap-3"
            >
              <b.icon className="w-5 h-5 text-accent-glow" />
              <span className="text-sm font-medium text-slate-300">{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="audit" className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="glow-card rounded-2xl p-8 hover:scale-[1.01] transition">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent-primary/20 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-accent-glow" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">LUMIS Audit</h2>
                <p className="text-sm text-slate-400">AI Fairness Inspection</p>
              </div>
            </div>
            <p className="text-slate-300 mb-6">
              Plug your AI model in. We generate 10,000 synthetic diverse
              applicants via MiroFish, run them through your model, and produce
              a regulatory-grade bias report with remediation steps.
            </p>
            <ul className="space-y-2 mb-6 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <span className="text-accent-glow">→</span> 7 fairness metrics
                (demographic parity, equalized odds, etc.)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent-glow">→</span> Intersectional
                analysis (gender × race × age)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent-glow">→</span> Proxy feature
                detection (zip code → race)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent-glow">→</span> Compliance reports
                for EU AI Act, EEOC, ECOA, GDPR
              </li>
            </ul>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-accent-glow hover:underline font-medium"
            >
              Audit a model <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div id="crisis" className="glow-card rounded-2xl p-8 hover:scale-[1.01] transition">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-severity-critical/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-severity-critical" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">LUMIS Crisis</h2>
                <p className="text-sm text-slate-400">
                  Hospitality Emergency Coordination
                </p>
              </div>
            </div>
            <p className="text-slate-300 mb-6">
              Real-time crisis detection and multi-party coordination for hotels.
              Guest SOS → Vertex AI classifies → All staff notified in &lt;2
              seconds. MiroFish powers pre-deployment scenario simulation.
            </p>
            <ul className="space-y-2 mb-6 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <span className="text-severity-critical">→</span> Sub-2-second
                staff notification via Firebase FCM
              </li>
              <li className="flex items-center gap-2">
                <span className="text-severity-critical">→</span> Vertex AI
                crisis classification (Fire/Medical/Security)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-severity-critical">→</span> Google Maps
                indoor routing for evacuation
              </li>
              <li className="flex items-center gap-2">
                <span className="text-severity-critical">→</span> MiroFish-powered
                drill simulation for staff training
              </li>
            </ul>
            <Link
              href="/crisis"
              className="inline-flex items-center gap-2 text-severity-critical hover:underline font-medium"
            >
              Open command center <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="sdk" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">5 ways to integrate</h2>
          <p className="text-slate-400">
            Drop LUMIS into any AI workflow — REST, SDK, OpenAI wrapper, GitHub
            Actions, or notebook.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              icon: Zap,
              title: "Python SDK",
              code: `from lumis import LumisAudit

auditor = LumisAudit(api_key="lm_sk_...")
report = auditor.audit_endpoint(
    url="https://your-ai.com/predict",
    domain="hiring",
    sample_size=1000,
)
print(report.summary())
report.save_pdf("audit.pdf")`,
            },
            {
              icon: Globe,
              title: "REST API",
              code: `curl -X POST https://api.lumis.ai/v1/audit \\
  -H "Authorization: Bearer lm_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_endpoint": "https://your-ai.com/predict",
    "domain": "hiring",
    "sample_size": 1000,
    "protected_attributes": ["gender","race"]
  }'`,
            },
            {
              icon: Sparkles,
              title: "OpenAI Drop-in Wrapper",
              code: `# Zero code changes — auto-audited
from lumis import LumisOpenAI

client = LumisOpenAI(
    openai_api_key="sk-...",
    lumis_api_key="lm_sk_...",
    audit_policy="hiring_v2",
)
# all completions monitored & flagged`,
            },
            {
              icon: GitBranch,
              title: "GitHub Action",
              code: `# .github/workflows/ai-audit.yml
- uses: lumis-ai/audit-action@v1
  with:
    model-endpoint: \${{ vars.MODEL_URL }}
    api-key: \${{ secrets.LUMIS_API_KEY }}
    fail-on-bias: true
    threshold: 0.05`,
            },
          ].map((item) => (
            <div key={item.title} className="glow-card rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <item.icon className="w-5 h-5 text-accent-glow" />
                <h3 className="font-semibold text-lg">{item.title}</h3>
              </div>
              <pre className="bg-background/50 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto border border-border/50">
                <code>{item.code}</code>
              </pre>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div>
            LUMIS — Large Unified Model Inspection System ·{" "}
            <span className="text-slate-400">Powered by MiroFish + Google Cloud</span>
          </div>
          <div>Every AI decision deserves an audit.</div>
        </div>
      </footer>
    </main>
  );
}
