"""Venue endpoints."""
from flask import Blueprint, jsonify

from app.services.crisis_hub import hub

venue_bp = Blueprint("venue", __name__)


@venue_bp.route("", methods=["GET"])
def list_venues():
    return jsonify({"venues": hub.list_venues()})


@venue_bp.route("/<venue_id>", methods=["GET"])
def get_venue(venue_id: str):
    venue = hub.get_venue(venue_id)
    if not venue:
        return jsonify({"error": "not found"}), 404
    return jsonify(venue)


@venue_bp.route("/<venue_id>/stats", methods=["GET"])
def venue_stats(venue_id: str):
    return jsonify(hub.stats(venue_id))
