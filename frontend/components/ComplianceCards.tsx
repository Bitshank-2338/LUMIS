"use client";

import { ShieldCheck, ShieldX } from "lucide-react";
import { cn, SEVERITY_COLORS } from "@/lib/utils";

export function ComplianceCards({ compliance }: { compliance: any }) {
  const items = Object.entries(compliance);
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(([key, fw]: any) => {
        const compliant = fw.status === "COMPLIANT";
        return (
          <div
            key={key}
            className={cn(
              "rounded-2xl p-4 border-2",
              compliant
                ? "border-severity-ok/30 bg-severity-ok/5"
                : "border-severity-critical/30 bg-severity-critical/5"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-mono">{key}</span>
              {compliant ? (
                <ShieldCheck className="w-4 h-4 text-severity-ok" />
              ) : (
                <ShieldX className="w-4 h-4 text-severity-critical" />
              )}
            </div>
            <div className="text-sm font-medium mb-1 truncate">{fw.framework}</div>
            <div
              className={cn(
                "text-xs font-semibold tracking-wide",
                compliant ? "text-severity-ok" : "text-severity-critical"
              )}
            >
              {fw.status}
            </div>
            {fw.failed_metrics?.length > 0 && (
              <div className="mt-2 text-xs text-slate-400">
                {fw.failed_metrics.length} metric
                {fw.failed_metrics.length !== 1 ? "s" : ""} failed
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
