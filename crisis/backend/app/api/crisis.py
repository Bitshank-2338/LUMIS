"""Crisis reporting and management endpoints."""
from flask import Blueprint, jsonify, request

from app.services.crisis_hub import hub

crisis_bp = Blueprint("crisis", __name__)


@crisis_bp.route("/report", methods=["POST"])
def report_crisis():
    """
    POST /api/crisis/report

    Body:
      {
        "venue_id": "venue_demo",
        "description": "Guest on floor 7 unresponsive, not breathing",
        "location": {"floor": 7, "zone": "floor_7", "coordinates": {...}},
        "reporter": {"type": "GUEST|STAFF|SENSOR", "id": "..."},
        "severity_hint": "CRITICAL",      # optional
        "crisis_type_hint": "MEDICAL"     # optional
      }
    """
    body = request.get_json(force=True) or {}
    if not body.get("venue_id") or not body.get("description"):
        return jsonify({"error": "venue_id and description required"}), 400

    event = hub.report(
        venue_id=body["venue_id"],
        description=body["description"],
        location=body.get("location", {}),
        reporter=body.get("reporter", {"type": "UNKNOWN"}),
        severity_hint=body.get("severity_hint"),
        crisis_type_hint=body.get("crisis_type_hint"),
    )
    return jsonify({"event": event.to_dict(), "notifications_sent": len(event.response_log)}), 201


@crisis_bp.route("/<event_id>", methods=["GET"])
def get_event(event_id: str):
    event = hub.get_event(event_id)
    if not event:
        return jsonify({"error": "not found"}), 404
    return jsonify(event.to_dict())


@crisis_bp.route("/<event_id>/status", methods=["POST"])
def update_status(event_id: str):
    body = request.get_json(force=True) or {}
    status = body.get("status")
    actor = body.get("actor", "unknown")
    note = body.get("note")
    if status not in ("ACTIVE", "RESPONDING", "RESOLVED", "FALSE_ALARM"):
        return jsonify({"error": "invalid status"}), 400
    try:
        hub.update_status(event_id, status, actor, note)
        return jsonify(hub.get_event(event_id).to_dict())
    except KeyError as e:
        return jsonify({"error": str(e)}), 404


@crisis_bp.route("/<event_id>/log", methods=["POST"])
def add_log(event_id: str):
    body = request.get_json(force=True) or {}
    try:
        hub.add_log(event_id, body.get("actor", "unknown"), body.get("note", ""))
        return jsonify(hub.get_event(event_id).to_dict())
    except KeyError as e:
        return jsonify({"error": str(e)}), 404
