"use client";

import { CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn, SEVERITY_COLORS } from "@/lib/utils";

export function MetricsTable({ metrics }: { metrics: any }) {
  const [openAttr, setOpenAttr] = useState<string | null>(
    Object.keys(metrics)[0] ?? null
  );

  return (
    <div className="space-y-2">
      {Object.entries(metrics).map(([attr, ms]: any) => {
        const isOpen = openAttr === attr;
        const failedCount = ms.filter((m: any) => !m.passed).length;
        return (
          <div key={attr} className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenAttr(isOpen ? null : attr)}
              className="w-full px-5 py-3 bg-elevated/40 hover:bg-elevated/60 flex items-center justify-between transition"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold capitalize">
                  {attr.replace(/_/g, " ")}
                </span>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-md border",
                    failedCount === 0
                      ? SEVERITY_COLORS.OK
                      : SEVERITY_COLORS.HIGH
                  )}
                >
                  {failedCount === 0
                    ? `${ms.length} metrics passed`
                    : `${failedCount}/${ms.length} failed`}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-slate-400 transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            {isOpen && (
              <div className="divide-y divide-border">
                {ms.map((m: any, i: number) => (
                  <div key={i} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2">
                        {m.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-severity-ok flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-severity-critical flex-shrink-0" />
                        )}
                        <code className="text-sm font-medium">{m.metric}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">
                          {m.value}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-md border",
                            SEVERITY_COLORS[m.severity] || ""
                          )}
                        >
                          {m.severity}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 ml-6">
                      {m.interpretation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
