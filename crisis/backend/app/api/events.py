"""Event listing and notification endpoints."""
from flask import Blueprint, jsonify, request

from app.services.crisis_hub import hub

events_bp = Blueprint("events", __name__)


@events_bp.route("", methods=["GET"])
def list_events():
    venue_id = request.args.get("venue_id")
    limit = int(request.args.get("limit", 50))
    events = hub.list_events(venue_id=venue_id, limit=limit)
    return jsonify({"events": [e.to_dict() for e in events]})


@events_bp.route("/notifications", methods=["GET"])
def list_notifications():
    limit = int(request.args.get("limit", 50))
    return jsonify({"notifications": hub.router.get_recent(limit)})
