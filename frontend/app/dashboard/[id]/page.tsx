"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Download,
  FileText,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Activity,
  BarChart3,
  Users,
  GitBranch,
} from "lucide-react";
import {
  getAuditStatus,
  getAuditResults,
  reportPdfUrl,
  reportMarkdownUrl,
} from "@/lib/api";
import { cn, SEVERITY_COLORS, SEVERITY_HEX } from "@/lib/utils";
import { FairnessRadar } from "@/components/FairnessRadar";
import { GroupComparison } from "@/components/GroupComparison";
import { MetricsTable } from "@/components/MetricsTable";
import { ComplianceCards } from "@/components/ComplianceCards";
import { ProxyDetection } from "@/components/ProxyDetection";
import { Recommendations } from "@/components/Recommendations";
import { IntersectionalHeatmap } from "@/components/IntersectionalHeatmap";
import { AgentChatPanel } from "@/components/AgentChat";
import { AgentSimulationGrid } from "@/components/AgentSimulationGrid";
import { AuditForceGraph } from "@/components/AuditForceGraph";
import { listAuditProfiles, AgentProfile } from "@/lib/api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars

export default function AuditDetail() {
  const params = useParams<{ id: string }>();
  const auditId = params.id;
  const [status, setStatus] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let pollId: any;

    const tick = async () => {
      try {
        const s = await getAuditStatus(auditId);
        if (!active) return;
        setError(null); // clear any transient error (e.g. Render cold-start 404)
        setStatus(s);
        if (s.state === "COMPLETED") {
          const [r, p] = await Promise.all([
            getAuditResults(auditId),
            listAuditProfiles(auditId, "", 1000).catch(() => ({ profiles: [] })),
          ]);
          if (!active) return;
          setResults(r);
          setProfiles(p.profiles || []);
          clearInterval(pollId);
        } else if (s.state === "FAILED") {
          setError(s.error || "Audit failed");
          clearInterval(pollId);
        }
      } catch (e: any) {
        // Only show error if we don't already have status (avoid flashing on cold-start)
        if (!status) {
          let msg = e?.message || "Error";
          try { msg = JSON.parse(msg)?.error ?? msg; } catch {}
          setError(msg);
        }
      }
    };
    tick();
    pollId = setInterval(tick, 1500);
    return () => {
      active = false;
      clearInterval(pollId);
    };
  }, [auditId]);

  return (
    <main className="min-h-screen">
      <nav className="border-b border-border/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">LUMIS</span>
            <span className="text-xs text-slate-500 font-mono">
              / {auditId.slice(0, 8)}
            </span>
          </Link>
          {results && (
            <div className="flex items-center gap-2">
              <a
                href={reportMarkdownUrl(auditId)}
                target="_blank"
                className="px-3 py-2 rounded-lg border border-border hover:bg-elevated text-sm flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Markdown
              </a>
              <a
                href={reportPdfUrl(auditId)}
                target="_blank"
                className="px-3 py-2 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white text-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> PDF Report
              </a>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {error && (
          <div className="p-4 rounded-xl border border-severity-critical/30 bg-severity-critical/10 text-severity-critical mb-6">
            {error}
          </div>
        )}

        {status && status.state !== "COMPLETED" && status.state !== "FAILED" && (
          <RunningView status={status} auditId={auditId} />
        )}

        {results && <ResultsView results={results} auditId={auditId} profiles={profiles} />}
      </div>
      {results && <AgentChatPanel auditId={auditId} />}
    </main>
  );
}

function RunningView({ status, auditId }: { status: any; auditId: string }) {
  const stages = [
    { id: "GENERATING", label: "Synthesize" },
    { id: "RUNNING", label: "Evaluate" },
    { id: "ANALYZING", label: "Analyze" },
    { id: "COMPLETED", label: "Report" },
  ];
  const current = stages.findIndex((s) => s.id === status.state);
  const sampleSize = 1000; // default; could read from config if available

  return (
    <div className="max-w-5xl mx-auto py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-accent-primary/10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-accent-glow animate-spin" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Audit in progress</h1>
          <p className="text-slate-400 text-sm">{status.message}</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-3xl font-mono font-bold text-accent-glow">
            {Math.round(status.progress * 100)}%
          </div>
          <div className="text-xs text-slate-500">{status.state}</div>
        </div>
      </div>

      {/* Stage pills */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {stages.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "px-3 py-2 rounded-xl border text-center text-xs font-medium transition",
              i < current
                ? "border-severity-ok/40 bg-severity-ok/10 text-severity-ok"
                : i === current
                ? "border-accent-primary/60 bg-accent-primary/15 text-white"
                : "border-border text-slate-600"
            )}
          >
            {i < current ? "✓ " : i === current ? "⟳ " : ""}
            {s.label}
          </div>
        ))}
      </div>

      {/* THE GRAPH — visible from GENERATING onward so users see the network form live */}
      {(status.state === "GENERATING" ||
        status.state === "RUNNING" ||
        status.state === "ANALYZING") && (
        <div className="glow-card rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3 text-sm">
            <Activity className="w-4 h-4 text-accent-glow" />
            <span className="font-semibold">
              Live Agent Network —{" "}
              {status.state === "GENERATING"
                ? "agents materializing…"
                : status.state === "RUNNING"
                ? "decisions arriving"
                : "finalizing analysis"}
            </span>
            <span className="text-slate-500 text-xs ml-auto">
              Pulsing gray = pending · solid = decided · drag to explore · scroll to zoom
            </span>
          </div>
          <AuditForceGraph
            auditId={auditId}
            isRunning={true}
            colorBy="decision"
            maxNodes={200}
            height={500}
          />
        </div>
      )}

      {/* thin progress bar at bottom */}
      <div className="h-1 rounded-full bg-elevated overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-700"
          style={{ width: `${status.progress * 100}%` }}
        />
      </div>
    </div>
  );
}

function ResultsView({
  results,
  auditId,
  profiles,
}: {
  results: any;
  auditId: string;
  profiles: AgentProfile[];
}) {
  const summary = results.summary || {};
  const exec = results.execution || {};
  const cfg = results.config || {};
  const compliance = results.compliance || {};
  const metrics = results.metrics || {};
  const groupStats = results.group_stats || {};
  const proxy = results.proxy_detection || {};
  const intersectional = results.intersectional || {};
  const recs = results.recommendations || [];

  const radarData = Object.entries(metrics).flatMap(([attr, ms]: any) =>
    ms.map((m: any) => ({
      metric: m.metric.replace(/_/g, " "),
      attribute: attr,
      value: m.value,
      passed: m.passed,
      severity: m.severity,
    }))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-6 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-500 mb-1">
            {cfg.domain?.toUpperCase()} · {exec.profiles_generated} profiles ·{" "}
            {exec.avg_model_latency_ms}ms avg
          </div>
          <h1 className="text-3xl font-bold mb-2">Audit Report</h1>
          <p className="text-slate-400 truncate max-w-xl">
            {cfg.model_endpoint}
          </p>
        </div>
        <RiskBadge level={summary.risk_level} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPI
          icon={ShieldCheck}
          label="Fairness Score"
          value={`${(summary.fairness_score * 100).toFixed(0)}%`}
          tone={summary.fairness_score >= 0.8 ? "OK" : "CRITICAL"}
        />
        <KPI
          icon={Activity}
          label="Metrics Failed"
          value={`${summary.metrics_failed}/${summary.total_metrics_evaluated}`}
          tone={summary.metrics_failed > 0 ? "HIGH" : "OK"}
        />
        <KPI
          icon={AlertTriangle}
          label="Critical"
          value={summary.critical_findings}
          tone={summary.critical_findings > 0 ? "CRITICAL" : "OK"}
        />
        <KPI
          icon={ShieldAlert}
          label="High"
          value={summary.high_findings}
          tone={summary.high_findings > 0 ? "HIGH" : "OK"}
        />
        <KPI
          icon={GitBranch}
          label="Proxies"
          value={summary.proxies_detected}
          tone={summary.proxies_detected > 0 ? "HIGH" : "OK"}
        />
      </div>

      <ComplianceCards compliance={compliance} />

      {/* MiroFish-style D3 force graph */}
      <Card title="Agent Network Graph — MiroFish Visualization" icon={Activity}>
        <p className="text-xs text-slate-500 mb-4">
          D3 force-directed graph · each node = one synthetic agent · edges = demographic relationships ·
          click to inspect · drag · scroll to zoom
        </p>
        <AuditForceGraph
          auditId={auditId}
          isRunning={false}
          colorBy="decision"
          maxNodes={300}
          height={580}
        />
      </Card>

      <Card title="All Synthetic Agents — Pixel Grid" icon={Users}>
        <AgentSimulationGrid auditId={auditId} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Fairness Across All Metrics" icon={BarChart3}>
          <FairnessRadar data={radarData} />
        </Card>
        <Card title="Group Acceptance Rates" icon={Users}>
          <GroupComparison groupStats={groupStats} />
        </Card>
      </div>

      {intersectional && intersectional.groups && (
        <Card title="Intersectional Analysis" icon={Activity}>
          <IntersectionalHeatmap data={intersectional} />
        </Card>
      )}

      <Card title="Detailed Findings" icon={BarChart3}>
        <MetricsTable metrics={metrics} />
      </Card>

      {proxy.proxies_detected > 0 && (
        <Card title="Proxy Feature Detection" icon={GitBranch}>
          <ProxyDetection proxy={proxy} />
        </Card>
      )}

      {recs.length > 0 && (
        <Card title="Recommendations" icon={ShieldCheck}>
          <Recommendations recommendations={recs} />
        </Card>
      )}
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  return (
    <div
      className={cn(
        "px-5 py-3 rounded-2xl border-2 font-semibold tracking-wide",
        SEVERITY_COLORS[level] || SEVERITY_COLORS.OK
      )}
    >
      <div className="text-xs uppercase opacity-70 mb-0.5">Risk Level</div>
      <div className="text-2xl">{level}</div>
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: any;
  tone: string;
}) {
  return (
    <div className="glow-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        <Icon
          className="w-4 h-4"
          style={{ color: SEVERITY_HEX[tone] || "#64748B" }}
        />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="glow-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-accent-glow" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
