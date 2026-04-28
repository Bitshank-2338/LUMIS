"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { listAudits } from "@/lib/api";
import { cn, SEVERITY_COLORS } from "@/lib/utils";

type AuditItem = {
  audit_id: string;
  state: string;
  progress: number;
  message: string;
  started_at: string;
  completed_at?: string;
};

export default function Dashboard() {
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await listAudits();
        if (active) setAudits(data.audits || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="min-h-screen">
      <nav className="border-b border-border/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">LUMIS</span>
            <span className="text-xs text-slate-500">/ Dashboard</span>
          </Link>
          <Link
            href="/dashboard/new"
            className="px-4 py-2 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white transition font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Audit
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-1">Audits</h1>
          <p className="text-slate-400">
            Monitor running audits and review historical reports.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
          </div>
        ) : audits.length === 0 ? (
          <div className="glow-card rounded-2xl p-16 text-center">
            <Sparkles className="w-12 h-12 text-accent-glow mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No audits yet</h3>
            <p className="text-slate-400 mb-6">
              Run your first AI bias audit in under 60 seconds.
            </p>
            <Link
              href="/dashboard/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white font-medium"
            >
              <Plus className="w-4 h-4" /> Start your first audit
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {audits.map((a) => (
              <AuditCard key={a.audit_id} audit={a} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function AuditCard({ audit }: { audit: AuditItem }) {
  const isComplete = audit.state === "COMPLETED";
  const isFailed = audit.state === "FAILED";
  const isRunning = !isComplete && !isFailed;

  return (
    <Link
      href={`/dashboard/${audit.audit_id}`}
      className="glow-card rounded-xl p-5 hover:bg-elevated/40 transition flex items-center gap-4 group"
    >
      <div className="flex-shrink-0">
        {isComplete && (
          <CheckCircle2 className="w-6 h-6 text-severity-ok" />
        )}
        {isFailed && <XCircle className="w-6 h-6 text-severity-critical" />}
        {isRunning && (
          <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <code className="text-xs text-slate-500 font-mono">
            {audit.audit_id.slice(0, 8)}
          </code>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-md font-medium border",
              isComplete && SEVERITY_COLORS.OK,
              isFailed && SEVERITY_COLORS.CRITICAL,
              isRunning && "text-accent-glow bg-accent-primary/10 border-accent-primary/30"
            )}
          >
            {audit.state}
          </span>
        </div>
        <p className="text-sm text-slate-300">{audit.message}</p>
        {isRunning && (
          <div className="mt-2 w-full h-1 rounded-full bg-elevated overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all"
              style={{ width: `${audit.progress * 100}%` }}
            />
          </div>
        )}
      </div>
      <div className="text-xs text-slate-500 hidden md:block">
        <Clock className="w-3 h-3 inline mr-1" />
        {new Date(audit.started_at).toLocaleString()}
      </div>
    </Link>
  );
}
