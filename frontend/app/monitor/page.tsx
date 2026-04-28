"use client";

/**
 * LUMIS Continuous Monitoring — the recurring-revenue product.
 * Models drift over time. We probe them every hour with sentinel cohorts and
 * alert the moment fairness regresses.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Sparkles,
  Activity,
  Bell,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Cpu,
  Clock,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";

// ── synthetic monitoring data ───────────────────────────────────────────────
const MODELS = [
  {
    id: "hr-screen-v3",
    name: "HR Screening v3.2",
    vendor: "Internal",
    domain: "hiring",
    fairness: 0.46,
    trend: "down" as const,
    alerts: 3,
    lastAudit: "12 min ago",
    sample_count: 2400,
    cadence: "hourly",
    risk: "CRITICAL",
  },
  {
    id: "loan-credit-v1",
    name: "Loan Credit Scorer",
    vendor: "FinAI Co.",
    domain: "lending",
    fairness: 0.81,
    trend: "stable" as const,
    alerts: 0,
    lastAudit: "5 min ago",
    sample_count: 1800,
    cadence: "hourly",
    risk: "OK",
  },
  {
    id: "med-triage",
    name: "Medical Triage Assistant",
    vendor: "HealthCo",
    domain: "medical",
    fairness: 0.72,
    trend: "up" as const,
    alerts: 1,
    lastAudit: "23 min ago",
    sample_count: 950,
    cadence: "hourly",
    risk: "MEDIUM",
  },
  {
    id: "tenant-screen",
    name: "Tenant Screening Pro",
    vendor: "RentSecure",
    domain: "housing",
    fairness: 0.58,
    trend: "down" as const,
    alerts: 2,
    lastAudit: "45 min ago",
    sample_count: 1100,
    cadence: "every 6h",
    risk: "HIGH",
  },
  {
    id: "ad-targeting",
    name: "Ad Targeting Optimizer",
    vendor: "AdEdge",
    domain: "advertising",
    fairness: 0.91,
    trend: "stable" as const,
    alerts: 0,
    lastAudit: "1h ago",
    sample_count: 5200,
    cadence: "hourly",
    risk: "OK",
  },
  {
    id: "fraud-detect",
    name: "Fraud Detection Net",
    vendor: "Internal",
    domain: "fraud",
    fairness: 0.65,
    trend: "down" as const,
    alerts: 1,
    lastAudit: "8 min ago",
    sample_count: 3400,
    cadence: "every 15m",
    risk: "MEDIUM",
  },
];

const ALERT_FEED = [
  {
    id: "a1",
    severity: "CRITICAL",
    model: "HR Screening v3.2",
    metric: "Disparate Impact (race)",
    value: "0.61 (was 0.83)",
    when: "12 min ago",
    delta: -0.22,
  },
  {
    id: "a2",
    severity: "HIGH",
    model: "HR Screening v3.2",
    metric: "Demographic Parity (gender)",
    value: "−0.18 (was −0.04)",
    when: "12 min ago",
    delta: -0.14,
  },
  {
    id: "a3",
    severity: "HIGH",
    model: "Tenant Screening Pro",
    metric: "Equalized Odds (race)",
    value: "0.21 (was 0.07)",
    when: "45 min ago",
    delta: -0.14,
  },
  {
    id: "a4",
    severity: "MEDIUM",
    model: "Medical Triage Assistant",
    metric: "Equal Opportunity (age)",
    value: "0.09 (was 0.03)",
    when: "1h ago",
    delta: -0.06,
  },
  {
    id: "a5",
    severity: "MEDIUM",
    model: "Fraud Detection Net",
    metric: "Disparate Impact (origin)",
    value: "0.78 (threshold 0.80)",
    when: "8 min ago",
    delta: -0.02,
  },
  {
    id: "a6",
    severity: "HIGH",
    model: "Tenant Screening Pro",
    metric: "Proxy detected: ZIP→race",
    value: "r = 0.71",
    when: "2h ago",
    delta: 0,
  },
];

// ── generate fairness time-series with drift event ──────────────────────────
function generateSeries() {
  const series: { t: string; fairness: number; threshold: number }[] = [];
  for (let i = 0; i < 48; i++) {
    let f = 0.85 - 0.005 * i + (Math.random() - 0.5) * 0.04;
    if (i > 30) f -= (i - 30) * 0.015; // drift event
    series.push({
      t: `${i}h`,
      fairness: Math.max(0.2, Math.min(1, f)),
      threshold: 0.8,
    });
  }
  return series;
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#EF4444",
  HIGH: "#F97316",
  MEDIUM: "#F59E0B",
  LOW: "#10B981",
  OK: "#10B981",
};

export default function MonitorPage() {
  const [tick, setTick] = useState(0);
  const [series, setSeries] = useState(generateSeries());
  const [filter, setFilter] = useState<"all" | "alerts">("all");

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  // jitter the series like a live feed
  useEffect(() => {
    setSeries((prev) =>
      prev.map((p, i) => ({
        ...p,
        fairness:
          i === prev.length - 1
            ? Math.max(0.2, p.fairness + (Math.random() - 0.5) * 0.03)
            : p.fairness,
      }))
    );
  }, [tick]);

  const filtered = filter === "alerts" ? MODELS.filter((m) => m.alerts > 0) : MODELS;

  const totals = useMemo(() => {
    const monitored = MODELS.length;
    const healthy = MODELS.filter((m) => m.risk === "OK").length;
    const breached = MODELS.filter((m) => m.alerts > 0).length;
    const totalAlerts = MODELS.reduce((s, m) => s + m.alerts, 0);
    return { monitored, healthy, breached, totalAlerts };
  }, []);

  return (
    <main className="min-h-screen">
      <nav className="border-b border-border/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">LUMIS</span>
            <span className="text-xs text-slate-500">/ Continuous Monitoring</span>
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-medium">Live · Probing every hour</span>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Hero stats */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Production Model Surveillance</h1>
            <p className="text-slate-400 text-sm">
              MiroFish sentinel cohorts probe every model continuously · drift detected the moment it happens
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat icon={Cpu}    label="Models monitored" value={totals.monitored.toString()} tone="OK" />
          <Stat icon={ShieldCheck} label="Healthy" value={totals.healthy.toString()} tone="OK" />
          <Stat icon={AlertTriangle} label="Breaching SLO" value={totals.breached.toString()} tone="CRITICAL" />
          <Stat icon={Bell}    label="Active alerts" value={totals.totalAlerts.toString()} tone="HIGH" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Time-series + models */}
          <div className="lg:col-span-2 space-y-6">
            {/* Fleet fairness chart */}
            <div className="glow-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-accent-glow" />
                    Fleet Fairness Score — last 48h
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Drift event detected at hour 30 · auto-mitigation triggered at hour 38
                  </p>
                </div>
                <div className="flex gap-2 text-[11px]">
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">SLO 0.80</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="t" stroke="#64748B" fontSize={10} />
                  <YAxis domain={[0, 1]} stroke="#64748B" fontSize={10} />
                  <Tooltip
                    contentStyle={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 8 }}
                    labelStyle={{ color: "#94A3B8" }}
                  />
                  <ReferenceLine y={0.8} stroke="#10B981" strokeDasharray="3 3" label={{ value: "SLO", fill: "#10B981", fontSize: 10 }} />
                  <Area dataKey="fairness" stroke="#6366F1" strokeWidth={2} fill="url(#fg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Model fleet */}
            <div className="glow-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-accent-glow" />
                  Model Fleet
                </h2>
                <div className="flex gap-1 border border-border rounded-lg p-1 text-xs">
                  {(["all", "alerts"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition capitalize",
                        filter === f ? "bg-accent-primary/20 text-accent-glow" : "text-slate-400"
                      )}
                    >
                      {f === "alerts" ? "Breaching" : "All"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {filtered.map((m) => (
                  <ModelRow key={m.id} model={m} />
                ))}
              </div>
            </div>
          </div>

          {/* Alert feed */}
          <div>
            <div className="glow-card rounded-2xl p-6">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4 text-accent-glow" />
                Alert feed
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-severity-critical/15 text-severity-critical">
                  {ALERT_FEED.length} open
                </span>
              </h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {ALERT_FEED.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border p-3"
                    style={{
                      borderColor: SEVERITY_COLOR[a.severity] + "55",
                      background: SEVERITY_COLOR[a.severity] + "10",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-[10px] uppercase font-semibold tracking-wide"
                        style={{ color: SEVERITY_COLOR[a.severity] }}
                      >
                        {a.severity}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {a.when}
                      </span>
                    </div>
                    <div className="font-medium text-sm mb-0.5">{a.model}</div>
                    <div className="text-xs text-slate-400 mb-1.5">{a.metric}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono">{a.value}</span>
                      {a.delta < 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <TrendingDown className="w-3 h-3" /> {(a.delta * 100).toFixed(0)}%
                        </span>
                      )}
                      {a.delta > 0 && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <TrendingUp className="w-3 h-3" /> +{(a.delta * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing CTA */}
            <div className="mt-6 glow-card rounded-2xl p-6 text-center bg-gradient-to-br from-accent-primary/10 to-accent-secondary/10 border-accent-primary/30">
              <ShieldCheck className="w-8 h-8 text-accent-glow mx-auto mb-3" />
              <h3 className="font-bold mb-1">Continuous Monitoring</h3>
              <p className="text-xs text-slate-400 mb-4">
                Probe every model every hour with synthetic sentinel cohorts. Get alerted before regulators do.
              </p>
              <div className="text-2xl font-bold mb-1">
                $4,999<span className="text-sm text-slate-400 font-normal">/mo</span>
              </div>
              <div className="text-[10px] text-slate-500 mb-4">per monitored model</div>
              <Link
                href="/dashboard/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm font-medium"
              >
                Add a model
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ icon: Icon, label, value, tone }: any) {
  const color = SEVERITY_COLOR[tone] || "#94A3B8";
  return (
    <div className="glow-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ModelRow({ model }: { model: any }) {
  const fairColor =
    model.fairness >= 0.8 ? "#10B981" : model.fairness >= 0.65 ? "#F59E0B" : "#EF4444";

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border border-border/50 hover:border-accent-primary/40 hover:bg-elevated/40 transition">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold"
        style={{ background: fairColor + "20", color: fairColor }}
      >
        {(model.fairness * 100).toFixed(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{model.name}</span>
          {model.alerts > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-severity-critical/15 text-severity-critical">
              {model.alerts} alerts
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-500">
          {model.vendor} · {model.domain} · {model.cadence} · {model.sample_count.toLocaleString()} probes
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1 justify-end text-xs">
          {model.trend === "down" && <TrendingDown className="w-3 h-3 text-red-400" />}
          {model.trend === "up" && <TrendingUp className="w-3 h-3 text-emerald-400" />}
          <span className="text-slate-400">{model.lastAudit}</span>
        </div>
        <div className="text-[10px] text-slate-500 uppercase">{model.risk}</div>
      </div>
    </div>
  );
}
