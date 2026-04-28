"""
Crisis Hub — Central coordination service.

Real-time crisis event store with:
- Pub/Sub-style event broadcasting (in-memory, swappable for Google Pub/Sub)
- Crisis classification (Vertex AI in production, rules-based fallback)
- Notification routing (Firebase FCM in production, in-memory for demo)
- Severity-based escalation
"""
from __future__ import annotations

import os
import threading
import uuid
from collections import deque
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Callable


CRISIS_TYPES = ["FIRE", "MEDICAL", "SECURITY", "NATURAL_DISASTER", "OTHER"]
SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]

KEYWORD_RULES = {
    "FIRE": ["fire", "smoke", "burning", "flames", "alarm"],
    "MEDICAL": ["unresponsive", "breathing", "heart", "blood", "collapsed", "seizure", "unconscious", "injured", "bleeding"],
    "SECURITY": ["weapon", "gun", "knife", "attack", "threat", "intruder", "fight", "assault", "robbery"],
    "NATURAL_DISASTER": ["earthquake", "flood", "tornado", "hurricane"],
}


@dataclass
class CrisisEvent:
    event_id: str
    venue_id: str
    crisis_type: str
    severity: str
    location: dict
    reporter: dict
    description: str
    timestamp: str
    media_urls: list[str] = field(default_factory=list)
    status: str = "ACTIVE"  # ACTIVE | RESPONDING | RESOLVED | FALSE_ALARM
    classification_confidence: float = 1.0
    response_log: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


class CrisisClassifier:
    """
    Crisis classifier — Vertex AI Gemini when GOOGLE_CLOUD_PROJECT is set,
    keyword heuristics otherwise.
    """

    def __init__(self):
        self._vertex = None
        if os.getenv("GOOGLE_CLOUD_PROJECT") and os.getenv("USE_VERTEX_AI", "true").lower() == "true":
            try:
                import vertexai
                from vertexai.generative_models import GenerativeModel
                vertexai.init(
                    project=os.getenv("GOOGLE_CLOUD_PROJECT"),
                    location=os.getenv("VERTEX_LOCATION", "us-central1"),
                )
                self._vertex = GenerativeModel(os.getenv("VERTEX_MODEL", "gemini-1.5-flash"))
                print("[CrisisClassifier] Vertex AI Gemini connected")
            except Exception as e:
                print(f"[CrisisClassifier] Vertex init failed: {e} — using keywords")

    def classify(self, description: str, severity_hint: str | None = None) -> dict:
        if self._vertex:
            try:
                return self._classify_vertex(description, severity_hint)
            except Exception as e:
                print(f"[CrisisClassifier] Vertex classify failed: {e}, falling back")
        return self._classify_keywords(description, severity_hint)

    def _classify_vertex(self, description: str, severity_hint: str | None) -> dict:
        import json
        prompt = (
            "You are a crisis-classification system for a hospitality safety platform.\n"
            "Given a free-text incident report, output a STRICT JSON object with three keys:\n"
            "  crisis_type: one of FIRE | MEDICAL | SECURITY | NATURAL_DISASTER | OTHER\n"
            "  severity: one of CRITICAL | HIGH | MEDIUM | LOW\n"
            "  confidence: float 0..1\n"
            f"INCIDENT: {description!r}\n"
            f"SEVERITY HINT (use only if reasonable): {severity_hint!r}\n"
            "Return ONLY JSON, no prose."
        )
        resp = self._vertex.generate_content(
            prompt,
            generation_config={"temperature": 0.1, "max_output_tokens": 200},
        )
        text = (resp.text or "").strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        data = json.loads(text)
        crisis_type = data.get("crisis_type", "OTHER")
        if crisis_type not in CRISIS_TYPES:
            crisis_type = "OTHER"
        severity = data.get("severity", severity_hint or "MEDIUM")
        if severity not in SEVERITIES:
            severity = "MEDIUM"
        try:
            confidence = float(data.get("confidence", 0.85))
        except (TypeError, ValueError):
            confidence = 0.85
        return {
            "crisis_type": crisis_type,
            "severity": severity,
            "confidence": round(min(max(confidence, 0.0), 1.0), 3),
            "classifier": "vertex_gemini",
        }

    def _classify_keywords(self, description: str, severity_hint: str | None = None) -> dict:
        text = (description or "").lower()
        scores: dict[str, int] = {}
        for crisis_type, keywords in KEYWORD_RULES.items():
            scores[crisis_type] = sum(1 for kw in keywords if kw in text)

        best_type = max(scores, key=scores.get)
        max_score = scores[best_type]
        if max_score == 0:
            best_type = "OTHER"
            confidence = 0.4
        else:
            confidence = min(0.95, 0.5 + 0.15 * max_score)

        if severity_hint and severity_hint in SEVERITIES:
            severity = severity_hint
        else:
            critical_keywords = ["unresponsive", "weapon", "fire", "blood", "collapsed", "gun"]
            if any(k in text for k in critical_keywords):
                severity = "CRITICAL"
            elif best_type in ("FIRE", "SECURITY"):
                severity = "HIGH"
            elif best_type == "MEDICAL":
                severity = "HIGH"
            else:
                severity = "MEDIUM"

        return {
            "crisis_type": best_type,
            "severity": severity,
            "confidence": round(confidence, 3),
            "classifier": "keywords",
        }


class NotificationRouter:
    """
    Routes notifications based on severity. In production: Firebase FCM.
    For demo: tracks notifications in-memory.
    """

    SEVERITY_TARGETS = {
        "CRITICAL": ["all_staff", "managers", "emergency_services", "all_guests"],
        "HIGH": ["relevant_staff", "managers", "nearby_guests"],
        "MEDIUM": ["duty_manager", "relevant_staff"],
        "LOW": ["duty_manager"],
    }

    def __init__(self):
        self._sent: list[dict] = []
        self._publisher = None
        self._topic_path = None
        if os.getenv("GOOGLE_CLOUD_PROJECT") and os.getenv("USE_PUBSUB", "true").lower() == "true":
            try:
                from google.cloud import pubsub_v1
                self._publisher = pubsub_v1.PublisherClient()
                project = os.getenv("GOOGLE_CLOUD_PROJECT")
                topic = os.getenv("PUBSUB_TOPIC", "lumis-crisis-events")
                self._topic_path = self._publisher.topic_path(project, topic)
                print(f"[NotificationRouter] Pub/Sub publisher -> {self._topic_path}")
            except Exception as e:
                print(f"[NotificationRouter] Pub/Sub init failed: {e}")
                self._publisher = None

    def route(self, event: CrisisEvent) -> list[dict]:
        targets = self.SEVERITY_TARGETS.get(event.severity, ["duty_manager"])
        notifications = []
        for target in targets:
            n = {
                "id": str(uuid.uuid4()),
                "event_id": event.event_id,
                "target": target,
                "channel": self._channel_for(target),
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "message": self._format_message(event, target),
            }
            notifications.append(n)
            self._sent.append(n)
            self._publish_pubsub(n, event)
        return notifications

    def _publish_pubsub(self, notification: dict, event: CrisisEvent):
        if not self._publisher or not self._topic_path:
            return
        try:
            import json
            payload = json.dumps({
                "notification": notification,
                "event": {
                    "event_id": event.event_id,
                    "venue_id": event.venue_id,
                    "crisis_type": event.crisis_type,
                    "severity": event.severity,
                },
            }).encode("utf-8")
            future = self._publisher.publish(
                self._topic_path,
                payload,
                target=notification["target"],
                severity=event.severity,
                crisis_type=event.crisis_type,
            )
            future.add_done_callback(lambda f: None)
        except Exception as e:
            print(f"[NotificationRouter] Pub/Sub publish failed: {e}")

    def _channel_for(self, target: str) -> str:
        if target == "emergency_services":
            return "PSTN_911"
        if "guest" in target:
            return "FCM_PUSH"
        return "FCM_PUSH"

    def _format_message(self, event: CrisisEvent, target: str) -> str:
        base = f"[{event.severity}] {event.crisis_type} at {event.location.get('zone', 'unknown')}"
        if target == "emergency_services":
            return f"{base}. Address: venue {event.venue_id}. {event.description}"
        if "guest" in target:
            if event.crisis_type == "FIRE":
                return "Emergency: please follow staff instructions and proceed to nearest exit."
            return f"Notice: {event.crisis_type.lower()} situation. Please follow staff instructions."
        return f"{base}. Description: {event.description}. Respond immediately."

    def get_recent(self, limit: int = 50) -> list[dict]:
        return self._sent[-limit:][::-1]


class CrisisHub:
    """Central crisis coordination service."""

    def __init__(self):
        self._events: dict[str, CrisisEvent] = {}
        self._timeline: deque[str] = deque(maxlen=500)
        self._venues: dict[str, dict] = {}
        self._lock = threading.Lock()
        self._subscribers: list[Callable] = []
        self.classifier = CrisisClassifier()
        self.router = NotificationRouter()
        self._seed_demo_venue()

    def _seed_demo_venue(self):
        self._venues["venue_demo"] = {
            "venue_id": "venue_demo",
            "name": "Lumis Grand Hotel",
            "address": "1 Demo Way, San Francisco, CA",
            "floors": 12,
            "rooms": 240,
            "staff_count": 45,
            "coordinates": {"lat": 37.7749, "lng": -122.4194},
            "zones": [
                {"id": "lobby", "name": "Lobby", "floor": 1},
                {"id": "pool", "name": "Pool Deck", "floor": 1},
                {"id": "kitchen", "name": "Main Kitchen", "floor": 1},
                {"id": "floor_3", "name": "Floor 3 Hallway", "floor": 3},
                {"id": "floor_7", "name": "Floor 7 Hallway", "floor": 7},
                {"id": "floor_12", "name": "Penthouse", "floor": 12},
                {"id": "parking", "name": "Underground Parking", "floor": -1},
            ],
        }

    def report(
        self,
        venue_id: str,
        description: str,
        location: dict,
        reporter: dict,
        severity_hint: str | None = None,
        crisis_type_hint: str | None = None,
    ) -> CrisisEvent:
        if crisis_type_hint and crisis_type_hint in CRISIS_TYPES:
            classification = {
                "crisis_type": crisis_type_hint,
                "severity": severity_hint or "HIGH",
                "confidence": 1.0,
            }
        else:
            classification = self.classifier.classify(description, severity_hint)

        event = CrisisEvent(
            event_id=str(uuid.uuid4()),
            venue_id=venue_id,
            crisis_type=classification["crisis_type"],
            severity=classification["severity"],
            location=location,
            reporter=reporter,
            description=description,
            timestamp=datetime.now(timezone.utc).isoformat(),
            classification_confidence=classification["confidence"],
        )

        notifications = self.router.route(event)
        event.response_log.append({
            "timestamp": event.timestamp,
            "actor": "LUMIS",
            "action": f"Crisis classified as {event.crisis_type} / {event.severity}. "
                      f"{len(notifications)} notifications dispatched.",
        })

        with self._lock:
            self._events[event.event_id] = event
            self._timeline.appendleft(event.event_id)

        for sub in list(self._subscribers):
            try:
                sub(event)
            except Exception:
                pass

        return event

    def update_status(self, event_id: str, status: str, actor: str, note: str | None = None):
        with self._lock:
            event = self._events.get(event_id)
            if not event:
                raise KeyError(f"Event {event_id} not found")
            event.status = status
            event.response_log.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "actor": actor,
                "action": f"Status -> {status}" + (f": {note}" if note else ""),
            })

    def add_log(self, event_id: str, actor: str, note: str):
        with self._lock:
            event = self._events.get(event_id)
            if not event:
                raise KeyError(f"Event {event_id} not found")
            event.response_log.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "actor": actor,
                "action": note,
            })

    def get_event(self, event_id: str) -> CrisisEvent | None:
        with self._lock:
            return self._events.get(event_id)

    def list_events(self, venue_id: str | None = None, limit: int = 50) -> list[CrisisEvent]:
        with self._lock:
            ids = list(self._timeline)
            events = [self._events[i] for i in ids if i in self._events]
        if venue_id:
            events = [e for e in events if e.venue_id == venue_id]
        return events[:limit]

    def list_venues(self) -> list[dict]:
        with self._lock:
            return list(self._venues.values())

    def get_venue(self, venue_id: str) -> dict | None:
        return self._venues.get(venue_id)

    def stats(self, venue_id: str | None = None) -> dict:
        events = self.list_events(venue_id, limit=500)
        active = [e for e in events if e.status == "ACTIVE"]
        responding = [e for e in events if e.status == "RESPONDING"]
        resolved = [e for e in events if e.status == "RESOLVED"]

        by_type: dict[str, int] = {}
        by_severity: dict[str, int] = {}
        for e in events:
            by_type[e.crisis_type] = by_type.get(e.crisis_type, 0) + 1
            by_severity[e.severity] = by_severity.get(e.severity, 0) + 1

        return {
            "total": len(events),
            "active": len(active),
            "responding": len(responding),
            "resolved": len(resolved),
            "by_type": by_type,
            "by_severity": by_severity,
        }


hub = CrisisHub()
