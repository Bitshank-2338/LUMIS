"use client";

import { GitBranch } from "lucide-react";
import { cn, SEVERITY_COLORS } from "@/lib/utils";

export function ProxyDetection({ proxy }: { proxy: any }) {
  return (
    <div>
      <p className="text-sm text-slate-400 mb-4">{proxy.recommendation}</p>
      <div className="space-y-2">
        {proxy.details.map((p: any, i: number) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-border bg-elevated/30"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-accent-glow" />
                <code className="font-medium">{p.feature}</code>
                <span className="text-xs text-slate-500">→</span>
                <code className="text-sm text-slate-300">{p.proxy_for}</code>
              </div>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-md border",
                  SEVERITY_COLORS[p.severity] || ""
                )}
              >
                r = {p.correlation}
              </span>
            </div>
            <p className="text-sm text-slate-400">{p.interpretation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
