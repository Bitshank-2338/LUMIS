const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5002";

/** Parse error responses — extracts .error field from JSON, else raw text */
async function _err(r: Response): Promise<never> {
  const text = await r.text();
  let msg = text;
  try { msg = JSON.parse(text)?.error ?? text; } catch {}
  throw new Error(msg);
}

export async function startAudit(payload: {
  domain: string;
  model_endpoint?: string;
  sample_size: number;
  protected_attributes: string[];
  compliance_frameworks: string[];
  controlled_pairs?: boolean;
  seed?: number;
  // LLM-as-classifier mode (NVIDIA / OpenAI / Groq / Together / custom)
  llm_provider?: "nvidia" | "openai" | "groq" | "together" | "custom";
  llm_base_url?: string;
  llm_model?: string;
  llm_api_key?: string;
}) {
  const r = await fetch(`${API_BASE}/api/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) return _err(r);
  return r.json();
}

export interface LLMProvider {
  label: string;
  base_url: string;
  models: string[];
}

export async function getLLMProviders(): Promise<{
  providers: Record<string, LLMProvider>;
}> {
  const r = await fetch(`${API_BASE}/api/audit/providers`, {
    cache: "no-store",
  });
  if (!r.ok) return _err(r);
  return r.json();
}

export async function getAuditStatus(auditId: string) {
  const r = await fetch(`${API_BASE}/api/audit/${auditId}/status`, {
    cache: "no-store",
  });
  if (!r.ok) return _err(r);
  return r.json();
}

export async function getAuditResults(auditId: string) {
  const r = await fetch(`${API_BASE}/api/audit/${auditId}/results`, {
    cache: "no-store",
  });
  if (!r.ok && r.status !== 202) throw new Error(await r.text());
  return r.json();
}

export async function listAudits() {
  const r = await fetch(`${API_BASE}/api/audit`, { cache: "no-store" });
  if (!r.ok) return _err(r);
  return r.json();
}

export async function previewPopulation(payload: {
  domain: string;
  size: number;
  controlled?: boolean;
  seed?: number;
}) {
  const r = await fetch(`${API_BASE}/api/population/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) return _err(r);
  return r.json();
}

export function reportPdfUrl(auditId: string) {
  return `${API_BASE}/api/reports/${auditId}/pdf`;
}
export function reportMarkdownUrl(auditId: string) {
  return `${API_BASE}/api/reports/${auditId}/markdown`;
}

export interface AgentProfile {
  profile_id: string;
  name: string;
  gender: string;
  race: string;
  age: number;
  age_group: string;
  zip_code: string;
  decision: number | null;
  score: number | null;
  ground_truth: number | null;
  domain: string | null;
}

export async function listAuditProfiles(
  auditId: string,
  filter?: "rejected" | "accepted" | "",
  limit = 100
): Promise<{ profiles: AgentProfile[]; count: number }> {
  const params = new URLSearchParams();
  if (filter) params.set("filter", filter);
  params.set("limit", String(limit));
  const r = await fetch(
    `${API_BASE}/api/audit/${auditId}/profiles?${params.toString()}`,
    { cache: "no-store" }
  );
  if (!r.ok) return _err(r);
  return r.json();
}

export async function sendAgentMessage(
  auditId: string,
  profileId: string,
  message: string
): Promise<{ reply: string; provider: string; history_length: number }> {
  const r = await fetch(
    `${API_BASE}/api/audit/${auditId}/chat/${profileId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }
  );
  if (!r.ok) return _err(r);
  return r.json();
}

export async function getAgentHistory(
  auditId: string,
  profileId: string
): Promise<{ history: { role: string; content: string }[] }> {
  const r = await fetch(
    `${API_BASE}/api/audit/${auditId}/chat/${profileId}`,
    { cache: "no-store" }
  );
  if (!r.ok) return _err(r);
  return r.json();
}

export interface GraphNode {
  uuid: string;
  name: string;
  labels: string[];
  attributes: Record<string, any>;
  summary?: string;
}

export interface GraphEdge {
  uuid: string;
  source_node_uuid: string;
  target_node_uuid: string;
  name: string;
  fact_type: string;
  fact?: string;
  source_name?: string;
  target_name?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: Record<string, any>;
}

export async function getAuditGraph(
  auditId: string,
  maxNodes = 300,
  colorBy = "decision"
): Promise<GraphData> {
  const r = await fetch(
    `${API_BASE}/api/audit/${auditId}/graph?max_nodes=${maxNodes}&color_by=${colorBy}`,
    { cache: "no-store" }
  );
  // 202 = audit still running; backend returns { error, status } — treat as empty graph
  if (r.status === 202) {
    return { nodes: [], edges: [], stats: {} };
  }
  if (!r.ok) return _err(r);
  return r.json();
}

export async function resetAgentChat(auditId: string, profileId: string) {
  const r = await fetch(
    `${API_BASE}/api/audit/${auditId}/chat/${profileId}`,
    { method: "DELETE" }
  );
  if (!r.ok) return _err(r);
  return r.json();
}
