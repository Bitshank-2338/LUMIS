const CRISIS_BASE = process.env.NEXT_PUBLIC_CRISIS_BASE || "http://localhost:5003";

export async function reportCrisis(payload: {
  venue_id: string;
  description: string;
  location: any;
  reporter: { type: string; id: string };
  severity_hint?: string;
  crisis_type_hint?: string;
}) {
  const r = await fetch(`${CRISIS_BASE}/api/crisis/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listCrisisEvents(venueId?: string) {
  const url = new URL(`${CRISIS_BASE}/api/events`);
  if (venueId) url.searchParams.set("venue_id", venueId);
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listNotifications() {
  const r = await fetch(`${CRISIS_BASE}/api/events/notifications`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateCrisisStatus(eventId: string, status: string, actor: string, note?: string) {
  const r = await fetch(`${CRISIS_BASE}/api/crisis/${eventId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, actor, note }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getVenue(venueId: string) {
  const r = await fetch(`${CRISIS_BASE}/api/venue/${venueId}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getVenueStats(venueId: string) {
  const r = await fetch(`${CRISIS_BASE}/api/venue/${venueId}/stats`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
