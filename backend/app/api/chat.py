"""
Agent Chat API — converse with the 1000 synthetic agents that were
audited. The MiroFish-style "talk to the people the AI rejected" UX.
"""
from flask import Blueprint, jsonify, request

from app.services.audit_orchestrator import orchestrator
from app.services.agent_chat import (
    chat_with_agent,
    get_chat_history,
    reset_chat,
)

chat_bp = Blueprint("chat", __name__)


@chat_bp.route("/<audit_id>/profiles", methods=["GET"])
def list_profiles(audit_id: str):
    """
    List the synthetic profiles for this audit.
    Query params:
      filter: "rejected" | "accepted" | "" (default all)
      limit:  int (default 100)
    """
    decision_filter = request.args.get("filter") or None
    try:
        limit = int(request.args.get("limit", 100))
    except (TypeError, ValueError):
        limit = 100

    profiles = orchestrator.get_profiles(audit_id, decision_filter=decision_filter, limit=limit)
    if not profiles:
        status = orchestrator.get_status(audit_id)
        if status and status["state"] != "COMPLETED":
            return jsonify({"error": "audit not completed", "status": status}), 202
        return jsonify({"profiles": [], "count": 0})

    summary = [
        {
            "profile_id": p["profile_id"],
            "name": p["name"],
            "gender": p["gender"],
            "race": p["race"],
            "age": p["age"],
            "age_group": p["age_group"],
            "zip_code": p["zip_code"],
            "decision": p["decision"],
            "score": p["score"],
            "ground_truth": p["ground_truth"],
            "domain": p["domain"],
        }
        for p in profiles
    ]
    return jsonify({"profiles": summary, "count": len(summary)})


@chat_bp.route("/<audit_id>/profiles/<profile_id>", methods=["GET"])
def get_profile(audit_id: str, profile_id: str):
    profile = orchestrator.get_profile(audit_id, profile_id)
    if not profile:
        return jsonify({"error": "profile not found"}), 404
    return jsonify(profile)


@chat_bp.route("/<audit_id>/chat/<profile_id>", methods=["POST"])
def send_message(audit_id: str, profile_id: str):
    body = request.get_json(force=True) or {}
    message = (body.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400
    result = chat_with_agent(audit_id, profile_id, message)
    if "error" in result:
        return jsonify(result), 404
    return jsonify(result)


@chat_bp.route("/<audit_id>/chat/<profile_id>", methods=["GET"])
def chat_history(audit_id: str, profile_id: str):
    history = get_chat_history(audit_id, profile_id)
    return jsonify({"history": history})


@chat_bp.route("/<audit_id>/chat/<profile_id>", methods=["DELETE"])
def reset(audit_id: str, profile_id: str):
    reset_chat(audit_id, profile_id)
    return jsonify({"ok": True})
