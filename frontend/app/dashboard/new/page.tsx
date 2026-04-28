"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Play,
  Loader2,
  Info,
  Cpu,
  Globe,
  Zap,
  Server,
  Lock,
} from "lucide-react";
import { startAudit, getLLMProviders, LLMProvider } from "@/lib/api";

const DOMAINS = [
  { id: "hiring", label: "Hiring", desc: "Resume / candidate screening" },
  { id: "lending", label: "Lending", desc: "Loan / credit approval" },
  { id: "medical", label: "Medical", desc: "Patient triage / priority" },
  { id: "housing", label: "Housing", desc: "Rental approval" },
  { id: "insurance", label: "Insurance", desc: "Risk pricing" },
];

const FRAMEWORKS = [
  { id: "EU_AI_ACT", label: "EU AI Act" },
  { id: "EEOC", label: "EEOC (4/5ths)" },
  { id: "ECOA", label: "ECOA" },
  { id: "GDPR", label: "GDPR Art. 22" },
];

const ATTRS = ["gender", "race", "age_group", "disability", "nationality_origin"];

type SourceMode = "demo" | "rest" | "llm";

export default function NewAudit() {
  const router = useRouter();

  // Core
  const [domain, setDomain] = useState("hiring");
  const [sampleSize, setSampleSize] = useState(500);
  const [protectedAttrs, setProtectedAttrs] = useState<string[]>([
    "gender",
    "race",
    "age_group",
  ]);
  const [frameworks, setFrameworks] = useState<string[]>(["EU_AI_ACT", "EEOC"]);

  // Model source
  const [sourceMode, setSourceMode] = useState<SourceMode>("demo");
  const [endpoint, setEndpoint] = useState("http://localhost:6001/predict");

  // LLM-as-classifier
  const [providers, setProviders] = useState<Record<string, LLMProvider>>({});
  const [llmProvider, setLLMProvider] = useState<string>("nvidia");
  const [llmModel, setLLMModel] = useState<string>("");
  const [llmApiKey, setLLMApiKey] = useState<string>("");
  const [llmCustomBase, setLLMCustomBase] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLLMProviders()
      .then((r) => {
        setProviders(r.providers);
        const first = Object.keys(r.providers)[0];
        if (first) {
          setLLMProvider(first);
          setLLMModel(r.providers[first].models[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (llmProvider !== "custom" && providers[llmProvider]) {
      setLLMModel(providers[llmProvider].models[0]);
    }
  }, [llmProvider, providers]);

  const toggleAttr = (a: string) =>
    setProtectedAttrs((p) =>
      p.includes(a) ? p.filter((x) => x !== a) : [...p, a]
    );
  const toggleFramework = (f: string) =>
    setFrameworks((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const base: any = {
        domain,
        sample_size: sampleSize,
        protected_attributes: protectedAttrs,
        compliance_frameworks: frameworks,
        seed: 42,
      };

      if (sourceMode === "demo") {
        base.model_endpoint = "http://localhost:6001/predict";
      } else if (sourceMode === "rest") {
        if (!endpoint) throw new Error("Model endpoint required");
        base.model_endpoint = endpoint;
      } else {
        // llm
        if (!llmModel || !llmApiKey)
          throw new Error("Model and API key required");
        base.llm_provider = llmProvider;
        base.llm_model = llmModel;
        base.llm_api_key = llmApiKey;
        if (llmProvider === "custom") {
          if (!llmCustomBase) throw new Error("Custom base URL required");
          base.llm_base_url = llmCustomBase;
        }
      }

      const r = await startAudit(base);
      router.push(`/dashboard/${r.audit_id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to start audit");
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    protectedAttrs.length > 0 &&
    frameworks.length > 0 &&
    (sourceMode === "demo" ||
      (sourceMode === "rest" && !!endpoint) ||
      (sourceMode === "llm" &&
        !!llmModel &&
        !!llmApiKey &&
        (llmProvider !== "custom" || !!llmCustomBase)));

  return (
    <main className="min-h-screen">
      <nav className="border-b border-border/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">LUMIS</span>
            <span className="text-xs text-slate-500">/ New Audit</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Configure your audit</h1>
        <p className="text-slate-400 mb-10">
          Plug any AI model — REST endpoint, NVIDIA NIM, OpenAI, Groq, Together,
          or our built-in biased demo — and we'll run a full fairness audit.
        </p>

        <div className="space-y-6">
          <Section title="1. Decision domain">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {DOMAINS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDomain(d.id)}
                  className={`p-4 rounded-xl border text-left transition ${
                    domain === d.id
                      ? "border-accent-primary bg-accent-primary/10"
                      : "border-border hover:border-slate-600"
                  }`}
                >
                  <div className="font-semibold mb-1">{d.label}</div>
                  <div className="text-xs text-slate-400">{d.desc}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="2. Model source">
            <div className="grid md:grid-cols-3 gap-3 mb-4">
              <SourceTile
                active={sourceMode === "demo"}
                onClick={() => setSourceMode("demo")}
                icon={Cpu}
                title="Built-in demo"
                desc="Audit the bundled biased model. Always works — no setup."
              />
              <SourceTile
                active={sourceMode === "rest"}
                onClick={() => setSourceMode("rest")}
                icon={Globe}
                title="REST endpoint"
                desc="Any model with /predict that returns {decision,score}."
              />
              <SourceTile
                active={sourceMode === "llm"}
                onClick={() => setSourceMode("llm")}
                icon={Zap}
                title="LLM as classifier"
                desc="NVIDIA NIM, OpenAI, Groq, Together — 200+ models."
              />
            </div>

            {sourceMode === "demo" && (
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Info className="w-3 h-3" />
                Will audit{" "}
                <code className="px-1 py-0.5 rounded bg-elevated">
                  http://localhost:6001/predict
                </code>{" "}
                — the bundled biased hiring model.
              </div>
            )}

            {sourceMode === "rest" && (
              <>
                <input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://your-ai.com/predict"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background/40 focus:border-accent-primary focus:outline-none transition"
                />
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                  <Info className="w-3 h-3" /> Endpoint must accept JSON POST
                  and return{" "}
                  <code className="px-1 py-0.5 rounded bg-elevated">
                    {"{ decision: 0|1, score: 0..1 }"}
                  </code>
                </div>
              </>
            )}

            {sourceMode === "llm" && (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1.5 uppercase tracking-wider">
                    Provider
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(providers).map(([id, p]) => (
                      <button
                        key={id}
                        onClick={() => setLLMProvider(id)}
                        className={`px-3 py-1.5 rounded-full border text-sm transition ${
                          llmProvider === id
                            ? "border-accent-primary bg-accent-primary/15 text-white"
                            : "border-border text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setLLMProvider("custom")}
                      className={`px-3 py-1.5 rounded-full border text-sm transition ${
                        llmProvider === "custom"
                          ? "border-accent-primary bg-accent-primary/15 text-white"
                          : "border-border text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Custom (any OpenAI-compatible)
                    </button>
                  </div>
                </div>

                {llmProvider === "custom" ? (
                  <div>
                    <div className="text-xs text-slate-400 mb-1.5 uppercase tracking-wider">
                      Base URL
                    </div>
                    <input
                      value={llmCustomBase}
                      onChange={(e) => setLLMCustomBase(e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background/40 focus:border-accent-primary focus:outline-none"
                    />
                  </div>
                ) : null}

                <div>
                  <div className="text-xs text-slate-400 mb-1.5 uppercase tracking-wider">
                    Model
                  </div>
                  {llmProvider === "custom" ? (
                    <input
                      value={llmModel}
                      onChange={(e) => setLLMModel(e.target.value)}
                      placeholder="model-id"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background/40 focus:border-accent-primary focus:outline-none"
                    />
                  ) : (
                    <select
                      value={llmModel}
                      onChange={(e) => setLLMModel(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background/40 focus:border-accent-primary focus:outline-none"
                    >
                      {providers[llmProvider]?.models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> API key
                  </div>
                  <input
                    type="password"
                    value={llmApiKey}
                    onChange={(e) => setLLMApiKey(e.target.value)}
                    placeholder={
                      llmProvider === "nvidia"
                        ? "nvapi-..."
                        : llmProvider === "openai"
                        ? "sk-..."
                        : "your provider's API key"
                    }
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background/40 focus:border-accent-primary focus:outline-none font-mono text-sm"
                  />
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <Server className="w-3 h-3" /> Key sent server-side only,
                    never logged. Get NVIDIA keys at{" "}
                    <a
                      href="https://build.nvidia.com/models"
                      target="_blank"
                      className="text-accent-glow hover:underline"
                    >
                      build.nvidia.com
                    </a>
                    .
                  </div>
                </div>
              </div>
            )}
          </Section>

          <Section title="3. Sample size">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={100}
                max={2000}
                step={100}
                value={sampleSize}
                onChange={(e) => setSampleSize(parseInt(e.target.value))}
                className="flex-1 accent-accent-primary"
              />
              <div className="w-24 text-right">
                <div className="text-2xl font-bold">{sampleSize}</div>
                <div className="text-xs text-slate-500">profiles</div>
              </div>
            </div>
            {sourceMode === "llm" && sampleSize > 500 && (
              <div className="mt-3 text-xs text-amber-400 flex items-center gap-1.5">
                <Info className="w-3 h-3" />
                LLM audits cost ~$0.001-0.05 per profile depending on the model.
                {sampleSize}× adds up — consider 200-500 for a first pass.
              </div>
            )}
          </Section>

          <Section title="4. Protected attributes">
            <div className="flex flex-wrap gap-2">
              {ATTRS.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAttr(a)}
                  className={`px-4 py-2 rounded-full border text-sm transition ${
                    protectedAttrs.includes(a)
                      ? "border-accent-primary bg-accent-primary/15 text-white"
                      : "border-border text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {a.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </Section>

          <Section title="5. Compliance frameworks">
            <div className="flex flex-wrap gap-2">
              {FRAMEWORKS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => toggleFramework(f.id)}
                  className={`px-4 py-2 rounded-full border text-sm transition ${
                    frameworks.includes(f.id)
                      ? "border-accent-glow bg-accent-secondary/15 text-white"
                      : "border-border text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Section>

          {error && (
            <div className="p-4 rounded-xl border border-severity-critical/30 bg-severity-critical/10 text-severity-critical text-sm">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Starting audit...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" /> Run audit
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glow-card rounded-2xl p-6">
      <h3 className="font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function SourceTile({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border text-left transition ${
        active
          ? "border-accent-primary bg-accent-primary/10"
          : "border-border hover:border-slate-600"
      }`}
    >
      <Icon className="w-5 h-5 mb-2 text-accent-glow" />
      <div className="font-semibold text-sm mb-1">{title}</div>
      <div className="text-xs text-slate-400">{desc}</div>
    </button>
  );
}
