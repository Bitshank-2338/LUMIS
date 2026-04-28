"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

type RadarDatum = {
  metric: string;
  attribute: string;
  value: number;
  passed: boolean;
};

export function FairnessRadar({ data }: { data: RadarDatum[] }) {
  const byAttr: Record<string, any[]> = {};
  data.forEach((d) => {
    if (!byAttr[d.attribute]) byAttr[d.attribute] = [];
    byAttr[d.attribute].push(d);
  });

  const allMetrics = Array.from(new Set(data.map((d) => d.metric)));
  const chartData = allMetrics.map((m) => {
    const row: any = { metric: m };
    Object.entries(byAttr).forEach(([attr, ms]) => {
      const found = ms.find((x) => x.metric === m);
      row[attr] = found ? Math.min(1, Math.abs(found.value)) : 0;
    });
    return row;
  });

  const colors = ["#6366F1", "#A78BFA", "#F472B6", "#FBBF24", "#34D399"];

  return (
    <div className="w-full h-80">
      <ResponsiveContainer>
        <RadarChart data={chartData}>
          <PolarGrid stroke="#262636" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: "#94A3B8", fontSize: 10 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 1]}
            tick={{ fill: "#475569", fontSize: 9 }}
          />
          {Object.keys(byAttr).map((attr, i) => (
            <Radar
              key={attr}
              name={attr}
              dataKey={attr}
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.25}
            />
          ))}
          <Legend wrapperStyle={{ fontSize: 11, color: "#CBD5E1" }} />
          <Tooltip
            contentStyle={{
              background: "#12121B",
              border: "1px solid #262636",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
