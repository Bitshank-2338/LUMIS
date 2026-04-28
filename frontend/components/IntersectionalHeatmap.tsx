"use client";

export function IntersectionalHeatmap({ data }: { data: any }) {
  if (!data?.groups?.length) return null;

  const groups = data.groups
    .slice()
    .sort((a: any, b: any) => b.acceptance_rate - a.acceptance_rate);

  const max = Math.max(...groups.map((g: any) => g.acceptance_rate));
  const min = Math.min(...groups.map((g: any) => g.acceptance_rate));

  return (
    <div>
      <p className="text-sm text-slate-400 mb-4">{data.interpretation}</p>
      <div className="space-y-1">
        {groups.map((g: any, i: number) => {
          const pct = g.acceptance_rate * 100;
          const intensity = (g.acceptance_rate - min) / Math.max(0.01, max - min);
          const hue = Math.round(intensity * 120);
          return (
            <div key={i} className="flex items-center gap-3 text-sm">
              <div className="w-44 flex-shrink-0 truncate text-slate-300">
                {g.group}
              </div>
              <div className="flex-1 h-6 bg-elevated rounded-md overflow-hidden relative">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: `hsl(${hue}, 70%, 45%)`,
                  }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                  {pct.toFixed(1)}% (n={g.n})
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
