"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  Users,
  MessageSquare,
  Loader2,
} from "lucide-react";
import {
  AgentProfile,
  listAuditProfiles,
  sendAgentMessage,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ProfileWithThought = AgentProfile & {
  thought?: string;
  thinking?: boolean;
};

const GENDER_COLORS: Record<string, string> = {
  male: "#60A5FA",
  female: "#F472B6",
  non_binary: "#A78BFA",
};

const RACE_COLORS: Record<string, string> = {
  white: "#94A3B8",
  black: "#FB923C",
  asian: "#34D399",
  hispanic: "#FBBF24",
  native_american: "#F87171",
  pacific_islander: "#22D3EE",
};

export function AgentSimulationGrid({ auditId }: { auditId: string }) {
  const [profiles, setProfiles] = useState<ProfileWithThought[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "rejected" | "accepted">("all");
  const [genderFilter, setGenderFilter] = useState<string>("");
  const [raceFilter, setRaceFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [colorBy, setColorBy] = useState<"decision" | "gender" | "race">(
    "decision"
  );
  const [hovered, setHovered] = useState<ProfileWithThought | null>(null);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    listAuditProfiles(auditId, "", 1000)
      .then((r) => setProfiles(r.profiles || []))
      .catch((e) => {
        console.error("[AgentSimulationGrid] failed to load profiles", e);
        setLoadError(e?.message || "Failed to load profiles");
        setProfiles([]);
      })
      .finally(() => setLoading(false));
  }, [auditId]);

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (filter === "rejected" && p.decision !== 0) return false;
      if (filter === "accepted" && p.decision !== 1) return false;
      if (genderFilter && p.gender !== genderFilter) return false;
      if (raceFilter && p.race !== raceFilter) return false;
      if (
        search &&
        !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.zip_code.includes(search)
      )
        return false;
      return true;
    });
  }, [profiles, filter, genderFilter, raceFilter, search]);

  const counts = useMemo(() => {
    const accepted = profiles.filter((p) => p.decision === 1).length;
    const rejected = profiles.filter((p) => p.decision === 0).length;
    return { total: profiles.length, accepted, rejected };
  }, [profiles]);

  const colorOf = (p: ProfileWithThought) => {
    if (colorBy === "decision") {
      return p.decision === 1 ? "#10B981" : "#EF4444";
    }
    if (colorBy === "gender") {
      return GENDER_COLORS[p.gender] || "#64748B";
    }
    return RACE_COLORS[p.race] || "#64748B";
  };

  const runWaveSimulation = async () => {
    const targets = filtered.slice(0, 24);
    const ids = new Set(targets.map((t) => t.profile_id));
    setActiveIds(ids);
    setProfiles((ps) =>
      ps.map((p) =>
        ids.has(p.profile_id) ? { ...p, thinking: true, thought: "" } : p
      )
    );

    await Promise.all(
      targets.map(async (p) => {
        try {
          const r = await sendAgentMessage(
            auditId,
            p.profile_id,
            "In one short sentence, how do you feel about the model's decision about you?"
          );
          setProfiles((ps) =>
            ps.map((x) =>
              x.profile_id === p.profile_id
                ? { ...x, thought: r.reply, thinking: false }
                : x
            )
          );
        } catch (e: any) {
          setProfiles((ps) =>
            ps.map((x) =>
              x.profile_id === p.profile_id
                ? { ...x, thought: `[err]`, thinking: false }
                : x
            )
          );
        }
      })
    );
    setActiveIds(new Set());
  };

  const uniqueGenders = Array.from(new Set(profiles.map((p) => p.gender)));
  const uniqueRaces = Array.from(new Set(profiles.map((p) => p.race)));

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-slate-400 py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading synthetic agents…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 rounded-xl border border-severity-critical/30 bg-severity-critical/10 text-severity-critical text-sm">
        Failed to load agents: {loadError}
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-border bg-elevated/30 text-slate-400 text-sm text-center">
        No synthetic agents available yet for this audit.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-elevated/40">
          <Users className="w-3.5 h-3.5 text-accent-glow" />
          <span className="font-mono">
            {filtered.length}{" "}
            <span className="text-slate-500">/ {counts.total}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-severity-ok/30 bg-severity-ok/10 text-severity-ok">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="font-mono">{counts.accepted} accepted</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-severity-critical/30 bg-severity-critical/10 text-severity-critical">
          <XCircle className="w-3.5 h-3.5" />
          <span className="font-mono">{counts.rejected} rejected</span>
        </div>

        <div className="flex-1" />

        <button
          onClick={runWaveSimulation}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-medium flex items-center gap-1.5"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Wave: ask 24 agents
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
          {(["all", "accepted", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2.5 py-1 rounded-md transition",
                filter === f
                  ? "bg-accent-primary/20 text-accent-glow"
                  : "text-slate-400"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="bg-background border border-border rounded-lg px-2 py-1"
        >
          <option value="">all genders</option>
          {uniqueGenders.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={raceFilter}
          onChange={(e) => setRaceFilter(e.target.value)}
          className="bg-background border border-border rounded-lg px-2 py-1"
        >
          <option value="">all races</option>
          {uniqueRaces.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 ml-2">
          <span className="text-slate-500 px-2">color:</span>
          {(["decision", "gender", "race"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setColorBy(c)}
              className={cn(
                "px-2.5 py-1 rounded-md transition",
                colorBy === c
                  ? "bg-accent-primary/20 text-accent-glow"
                  : "text-slate-400"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search name / zip"
            className="pl-7 pr-3 py-1 bg-background border border-border rounded-lg w-44"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading {profiles.length || ""} agents...
        </div>
      ) : (
        <div
          className="grid gap-1 p-3 rounded-xl bg-background/40 border border-border/50 max-h-[420px] overflow-y-auto"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(28px, 1fr))",
          }}
          onMouseLeave={() => setHovered(null)}
        >
          {filtered.map((p) => {
            const c = colorOf(p);
            const dim =
              hovered && hovered.profile_id !== p.profile_id ? 0.3 : 1;
            return (
              <div
                key={p.profile_id}
                onMouseEnter={() => setHovered(p)}
                className={cn(
                  "aspect-square rounded relative cursor-pointer transition-all",
                  activeIds.has(p.profile_id) && "ring-2 ring-accent-glow"
                )}
                style={{
                  backgroundColor: c,
                  opacity: dim,
                  boxShadow: p.thought
                    ? `0 0 8px ${c}`
                    : activeIds.has(p.profile_id)
                    ? `0 0 12px ${c}`
                    : "none",
                }}
                title={`${p.name} · ${p.gender}/${p.race} · ${
                  p.decision === 1 ? "ACCEPT" : "REJECT"
                }`}
              >
                {p.thinking && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-3 h-3 animate-spin text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hovered && (
        <div className="rounded-xl border border-border bg-background/80 p-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">{hovered.name}</div>
              <div className="text-xs text-slate-500">
                {hovered.gender} · {hovered.race} · {hovered.age}y · ZIP{" "}
                {hovered.zip_code} ·{" "}
                <span
                  className={
                    hovered.decision === 1
                      ? "text-severity-ok"
                      : "text-severity-critical"
                  }
                >
                  {hovered.decision === 1 ? "ACCEPTED" : "REJECTED"}
                </span>
                {typeof hovered.score === "number" && (
                  <span className="font-mono ml-1">
                    ({hovered.score.toFixed(2)})
                  </span>
                )}
                {hovered.ground_truth === 1 && (
                  <span className="ml-2 text-severity-high">
                    · objectively qualified
                  </span>
                )}
              </div>
            </div>
          </div>
          {hovered.thought && (
            <div className="mt-3 p-3 rounded-lg bg-elevated border border-border/50 italic text-slate-300">
              "{hovered.thought}"
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
        {colorBy === "decision" && (
          <>
            <Legend color="#10B981" label="accepted" />
            <Legend color="#EF4444" label="rejected" />
          </>
        )}
        {colorBy === "gender" &&
          Object.entries(GENDER_COLORS).map(([k, v]) => (
            <Legend key={k} color={v} label={k} />
          ))}
        {colorBy === "race" &&
          Object.entries(RACE_COLORS).map(([k, v]) => (
            <Legend key={k} color={v} label={k} />
          ))}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-3 h-3 rounded"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span>{label}</span>
    </div>
  );
}
