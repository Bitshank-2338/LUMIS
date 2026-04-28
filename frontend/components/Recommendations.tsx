"use client";

import { cn, SEVERITY_COLORS } from "@/lib/utils";

export function Recommendations({
  recommendations,
}: {
  recommendations: any[];
}) {
  return (
    <ol className="space-y-3">
      {recommendations.map((rec, i) => (
        <li
          key={i}
          className="p-4 rounded-xl border border-border bg-elevated/30"
        >
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-primary/20 text-accent-glow text-sm font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-md border font-semibold",
                    SEVERITY_COLORS[rec.priority] || ""
                  )}
                >
                  {rec.priority}
                </span>
                <h4 className="font-semibold">{rec.title}</h4>
              </div>
              <ul className="space-y-1">
                {rec.actions.map((action: string, j: number) => (
                  <li key={j} className="text-sm text-slate-400 flex gap-2">
                    <span className="text-slate-600 flex-shrink-0">→</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
