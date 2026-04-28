"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Flame,
  Heart,
  ShieldAlert,
  Wind,
  HelpCircle,
  Bell,
  Users,
  Building2,
  Clock,
  CheckCircle2,
  PlayCircle,
  Zap,
} from "lucide-react";
import {
  listCrisisEvents,
  listNotifications,
  reportCrisis,
  updateCrisisStatus,
  getVenue,
  getVenueStats,
} from "@/lib/crisis-api";
import { cn, SEVERITY_COLORS } from "@/lib/utils";
import { VenueMap } from "@/components/VenueMap";

const VENUE_ID = "venue_demo";

const TYPE_ICON: Record<string, any> = {
  FIRE: Flame,
  MEDICAL: Heart,
  SECURITY: ShieldAlert,
  NATURAL_DISASTER: Wind,
  OTHER: HelpCircle,
};

const TYPE_COLOR: Record<string, string> = {
  FIRE: "#F97316",
  MEDICAL: "#EF4444",
  SECURITY: "#A855F7",
  NATURAL_DISASTER: "#06B6D4",
  OTHER: "#94A3B8",
};

const DEMO_SCENARIOS = [
  {
    label: "Medical — Floor 7",
    payload: {
      description: "Guest on floor 7 unresponsive, not breathing, please send paramedics immediately",
      location: { floor: 7, zone: "floor_7" },
      reporter: { type: "GUEST", id: "guest_room_712" },
      severity_hint: "CRITICAL",
    },
    icon: Heart,
    color: "#EF4444",
  },
  {
    label: "Fire — Kitchen",
    payload: {
      description: "Fire alarm triggered in main kitchen, smoke visible",
      location: { floor: 1, zone: "kitchen" },
      reporter: { type: "SENSOR", id: "smoke_kitchen_01" },
      severity_hint: "CRITICAL",
    },
    icon: Flame,
    color: "#F97316",
  },
  {
    label: "Security — Lobby",
    payload: {
      description: "Suspicious individual with possible weapon in lobby",
      location: { floor: 1, zone: "lobby" },
      reporter: { type: "STAFF", id: "concierge_01" },
      severity_hint: "CRITICAL",
    },
    icon: ShieldAlert,
    color: "#A855F7",
  },
];

export default function CrisisCommandCenter() {
  const [events, setEvents] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [venue, setVenue] = useState<any>(null);
  const [reporting, setReporting] = useState(false);
  const [pulse, setPulse] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [e, n, s, v] = await Promise.all([
        listCrisisEvents(VENUE_ID),
        listNotifications(),
        getVenueStats(VENUE_ID),
        venue ? Promise.resolve(venue) : getVenue(VENUE_ID),
      ]);
      setEvents(e.events || []);
      setNotifications(n.notifications || []);
      setStats(s);
      if (!venue) setVenue(v);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, []);

  const triggerScenario = async (s: any) => {
    setReporting(true);
    try {
      const r = await reportCrisis({ venue_id: VENUE_ID, ...s.payload });
      setPulse(r.event.event_id);
      setTimeout(() => setPulse(null), 2500);
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setReporting(false);
    }
  };

  const updateStatus = async (eventId: string, status: string) => {
    await updateCrisisStatus(eventId, status, "command_center", `Marked ${status}`);
    await refresh();
  };

  const activeEvents = events.filter((e) => e.status === "ACTIVE" || e.status === "RESPONDING");

  return (
    <main className="min-h-screen">
      <nav className="border-b border-border/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-severity-critical to-severity-high flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">LUMIS Crisis</span>
            <span className="text-xs text-slate-500">/ Command Center</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">{venue?.name ?? "Loading..."}</span>
            </div>
            <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border border-severity-critical/30 bg-severity-critical/10">
              <span className="w-2 h-2 rounded-full bg-severity-critical animate-pulse" />
              <span className="text-severity-critical font-medium">{stats.active ?? 0} active</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Stat label="Total Events" value={stats.total ?? 0} icon={Bell} tone="OK" />
          <Stat label="Active" value={stats.active ?? 0} icon={AlertTriangle} tone="CRITICAL" />
          <Stat label="Responding" value={stats.responding ?? 0} icon={PlayCircle} tone="HIGH" />
          <Stat label="Resolved" value={stats.resolved ?? 0} icon={CheckCircle2} tone="OK" />
          <Stat label="Notifications" value={notifications.length} icon={Zap} tone="MEDIUM" />
        </div>

        <div className="glow-card rounded-2xl p-6 mb-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-accent-glow" />
            Demo: Trigger a Crisis
          </h2>
          <div className="grid md:grid-cols-3 gap-3">
            {DEMO_SCENARIOS.map((s) => (
              <button
                key={s.label}
                disabled={reporting}
                onClick={() => triggerScenario(s)}
                className="p-4 rounded-xl border border-border bg-elevated/30 hover:bg-elevated/60 disabled:opacity-50 transition text-left"
              >
                <s.icon className="w-5 h-5 mb-2" style={{ color: s.color }} />
                <div className="font-medium text-sm">{s.label}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Severity: CRITICAL
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-severity-critical" />
              Active Incidents
              {activeEvents.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-severity-critical/15 text-severity-critical">
                  {activeEvents.length}
                </span>
              )}
            </h2>
            {activeEvents.length === 0 && events.length === 0 ? (
              <div className="glow-card rounded-2xl p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-severity-ok mx-auto mb-3 opacity-50" />
                <h3 className="font-semibold mb-1">All clear</h3>
                <p className="text-sm text-slate-400">
                  No active incidents. Trigger a scenario above to test the response system.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((e) => (
                  <EventCard
                    key={e.event_id}
                    event={e}
                    pulse={pulse === e.event_id}
                    onStatusChange={updateStatus}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-accent-glow" />
              Venue Map
            </h2>
            <div className="glow-card rounded-2xl p-3 mb-4">
              <VenueMap venue={venue} events={events} />
            </div>

            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-accent-glow" />
              Live Notifications
            </h2>
            <div className="glow-card rounded-2xl p-2 max-h-[600px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-sm text-slate-500 text-center">
                  No notifications yet
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.slice(0, 30).map((n) => (
                    <div key={n.id} className="p-3 hover:bg-elevated/30 transition">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-accent-glow">
                          {n.target.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(n.sent_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{n.message}</p>
                      <div className="text-[10px] text-slate-500 mt-1">
                        via {n.channel}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: any;
  icon: any;
  tone: string;
}) {
  return (
    <div className="glow-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400 uppercase tracking-wide">
          {label}
        </span>
        <Icon className={cn("w-4 h-4", `text-severity-${tone.toLowerCase()}`)} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function EventCard({
  event,
  pulse,
  onStatusChange,
}: {
  event: any;
  pulse: boolean;
  onStatusChange: (id: string, status: string) => void;
}) {
  const Icon = TYPE_ICON[event.crisis_type] || HelpCircle;
  const color = TYPE_COLOR[event.crisis_type] || "#94A3B8";
  const isResolved = event.status === "RESOLVED" || event.status === "FALSE_ALARM";

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-5 transition-all",
        SEVERITY_COLORS[event.severity] || "",
        pulse && "animate-pulse-glow scale-[1.01]",
        isResolved && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}25` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold">{event.crisis_type}</span>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-md border font-semibold",
                SEVERITY_COLORS[event.severity] || ""
              )}
            >
              {event.severity}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-elevated/60 border border-border text-slate-300">
              {event.status}
            </span>
            <span className="text-xs text-slate-500 ml-auto">
              <Clock className="w-3 h-3 inline mr-1" />
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-sm text-slate-200 mb-2">{event.description}</p>
          <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
            <span>
              <Building2 className="w-3 h-3 inline mr-1" />
              {event.location?.zone ?? "unknown"}
            </span>
            <span>
              <Users className="w-3 h-3 inline mr-1" />
              {event.reporter?.type ?? "unknown"}
            </span>
            <span className="text-slate-500">
              confidence {(event.classification_confidence * 100).toFixed(0)}%
            </span>
          </div>

          <div className="border-t border-border/50 pt-3 mt-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
              Response Log
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {event.response_log.map((log: any, i: number) => (
                <div key={i} className="text-xs text-slate-400 flex gap-2">
                  <span className="text-slate-600">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-slate-500">{log.actor}</span>
                  <span className="text-slate-300">{log.action}</span>
                </div>
              ))}
            </div>
          </div>

          {!isResolved && (
            <div className="flex gap-2 mt-3">
              {event.status === "ACTIVE" && (
                <button
                  onClick={() => onStatusChange(event.event_id, "RESPONDING")}
                  className="px-3 py-1.5 rounded-md bg-severity-high/20 text-severity-high text-xs font-medium hover:bg-severity-high/30 transition"
                >
                  Mark Responding
                </button>
              )}
              <button
                onClick={() => onStatusChange(event.event_id, "RESOLVED")}
                className="px-3 py-1.5 rounded-md bg-severity-ok/20 text-severity-ok text-xs font-medium hover:bg-severity-ok/30 transition"
              >
                Resolve
              </button>
              <button
                onClick={() => onStatusChange(event.event_id, "FALSE_ALARM")}
                className="px-3 py-1.5 rounded-md bg-elevated text-slate-400 text-xs font-medium hover:bg-elevated/80 transition"
              >
                False Alarm
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
