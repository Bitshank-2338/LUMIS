"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type GroupStats = {
  [attr: string]: {
    [group: string]: {
      group: string;
      n: number;
      positive_rate: number;
      mean_score: number;
    };
  };
};

export function GroupComparison({ groupStats }: { groupStats: GroupStats }) {
  const attrs = Object.keys(groupStats);
  if (attrs.length === 0) return <div className="text-slate-400">No data</div>;

  return (
    <div className="space-y-6">
      {attrs.map((attr) => {
        const groups = Object.values(groupStats[attr]);
        const data = groups.map((g) => ({
          name: g.group,
          rate: Math.round(g.positive_rate * 1000) / 10,
          n: g.n,
        }));

        const max = Math.max(...data.map((d) => d.rate));
        const min = Math.min(...data.map((d) => d.rate));

        return (
          <div key={attr}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium capitalize">
                {attr.replace(/_/g, " ")}
              </h4>
              <span className="text-xs text-slate-500">
                Gap: {(max - min).toFixed(1)}%
              </span>
            </div>
            <div className="h-44">
              <ResponsiveContainer>
                <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid stroke="#262636" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "#94A3B8", fontSize: 11 }}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "#CBD5E1", fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#12121B",
                      border: "1px solid #262636",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any, _: any, p: any) => [
                      `${v}% (n=${p.payload.n})`,
                      "Acceptance",
                    ]}
                  />
                  <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
                    {data.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.rate === max
                            ? "#22C55E"
                            : d.rate === min
                              ? "#EF4444"
                              : "#6366F1"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
