"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Send,
  X,
  Users,
  Filter,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  AgentProfile,
  listAuditProfiles,
  sendAgentMessage,
  getAgentHistory,
  resetAgentChat,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type ChatMsg = { role: "user" | "assistant"; content: string };

export function AgentChatPanel({ auditId }: { auditId: string }) {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [filter, setFilter] = useState<"" | "rejected" | "accepted">(
    "rejected"
  );
  const [active, setActive] = useState<AgentProfile | null>(null);
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listAuditProfiles(auditId, filter, 200).then((r) =>
      setProfiles(r.profiles || [])
    );
  }, [open, filter, auditId]);

  useEffect(() => {
    if (!active) return;
    setHistory([]);
    getAgentHistory(auditId, active.profile_id).then((r) => {
      setHistory((r.history || []) as ChatMsg[]);
    });
  }, [active, auditId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history, sending]);

  const send = async () => {
    if (!active || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft("");
    setHistory((h) => [...h, { role: "user", content: text }]);
    setSending(true);
    try {
      const r = await sendAgentMessage(auditId, active.profile_id, text);
      setProvider(r.provider);
      setHistory((h) => [...h, { role: "assistant", content: r.reply }]);
    } catch (e: any) {
      const raw = e?.message || String(e);
      const friendly =
        raw === "profile not found"
          ? "This agent's data is no longer in memory. The backend may have restarted — please run a fresh audit and try again."
          : raw === "audit not found"
          ? "This audit session has expired (server restarted). Start a new audit to chat with agents."
          : `Something went wrong: ${raw}`;
      setHistory((h) => [
        ...h,
        { role: "assistant", content: friendly },
      ]);
    } finally {
      setSending(false);
    }
  };

  const reset = async () => {
    if (!active) return;
    await resetAgentChat(auditId, active.profile_id);
    setHistory([]);
  };

  const suggestions = [
    "Why do you think the model rejected you?",
    "Walk me through your qualifications.",
    "Did you feel the decision was fair?",
    "What would you say to the engineers who built this model?",
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 px-5 py-3 rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-2xl shadow-accent-primary/40 hover:scale-105 transition-transform flex items-center gap-2"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="font-semibold text-sm">Talk to the agents</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch justify-center p-4">
          <div className="bg-elevated border border-border rounded-2xl flex flex-col md:flex-row max-w-6xl w-full overflow-hidden shadow-2xl">
            <div className="md:w-80 border-b md:border-b-0 md:border-r border-border flex flex-col bg-background/40">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent-glow" />
                  <span className="font-semibold text-sm">
                    Synthetic agents
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="md:hidden text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 border-b border-border flex gap-1">
                {(
                  [
                    { key: "rejected", label: "Rejected" },
                    { key: "accepted", label: "Accepted" },
                    { key: "", label: "All" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key || "all"}
                    onClick={() => setFilter(opt.key)}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-lg text-xs transition",
                      filter === opt.key
                        ? "bg-accent-primary/20 text-accent-glow border border-accent-primary/40"
                        : "text-slate-400 hover:bg-elevated/60 border border-transparent"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                {profiles.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Loading profiles...
                  </div>
                ) : (
                  profiles.map((p) => (
                    <button
                      key={p.profile_id}
                      onClick={() => setActive(p)}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-elevated/60 transition",
                        active?.profile_id === p.profile_id &&
                          "bg-accent-primary/10"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">
                          {p.name}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-md",
                            p.decision === 1
                              ? "bg-severity-ok/20 text-severity-ok"
                              : "bg-severity-critical/20 text-severity-critical"
                          )}
                        >
                          {p.decision === 1 ? "ACCEPT" : "REJECT"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {p.gender} · {p.race} · {p.age}y · {p.zip_code}
                      </div>
                      {typeof p.score === "number" && (
                        <div className="text-[10px] text-slate-600 mt-0.5 font-mono">
                          score {p.score.toFixed(2)}
                          {p.ground_truth === 1 && (
                            <span className="text-severity-high ml-1">
                              · qualified
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="min-w-0">
                  {active ? (
                    <>
                      <div className="font-semibold text-sm truncate">
                        {active.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {active.gender} · {active.race} · {active.age}y ·{" "}
                        {active.domain} ·{" "}
                        {active.decision === 1 ? "accepted" : "rejected"}
                        {provider && (
                          <span className="ml-2 text-[10px] uppercase text-accent-glow/70">
                            {provider}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-400">
                      Select a synthetic agent to start chatting
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {active && (
                    <button
                      onClick={reset}
                      title="Reset conversation"
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px]"
              >
                {!active && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center max-w-md">
                      <MessageSquare className="w-10 h-10 text-accent-primary/50 mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">
                        Talk to the people the AI judged
                      </h3>
                      <p className="text-sm text-slate-400">
                        Pick any synthetic agent on the left. Each one was sent
                        through the model and got a real decision. Ask them
                        why, ask them how it felt, ask them what should change.
                      </p>
                    </div>
                  </div>
                )}

                {active && history.length === 0 && (
                  <div className="space-y-3">
                    <div className="text-xs text-slate-400 mb-2">
                      Suggested questions:
                    </div>
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => setDraft(s)}
                        className="block w-full text-left px-4 py-3 rounded-xl border border-border hover:border-accent-primary/50 hover:bg-accent-primary/5 transition text-sm"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {history.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap",
                        m.role === "user"
                          ? "bg-accent-primary text-white rounded-br-md"
                          : "bg-elevated border border-border rounded-bl-md"
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-elevated border border-border rounded-2xl rounded-bl-md px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> thinking...
                    </div>
                  </div>
                )}
              </div>

              {active && (
                <div className="p-4 border-t border-border flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={`Message ${active.name}...`}
                    className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent-primary"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !draft.trim()}
                    className="px-4 py-2.5 rounded-xl bg-accent-primary text-white disabled:opacity-40 hover:bg-accent-primary/90 transition flex items-center gap-1.5 text-sm"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
