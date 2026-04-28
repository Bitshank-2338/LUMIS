"""Population generation endpoints."""
from flask import Blueprint, jsonify, request

from app.services.population_generator import PopulationGenerator, DOMAIN_TEMPLATES, DEMOGRAPHICS

population_bp = Blueprint("population", __name__)


@population_bp.route("/preview", methods=["POST"])
def preview_population():
    """
    Generate a small preview (N <= 50) for the dashboard preview pane.

    Body:
      { "domain": "hiring", "size": 20, "controlled": false, "seed": 42 }
    """
    body = request.get_json(force=True) or {}
    size = min(50, int(body.get("size", 20)))
    domain = body.get("domain", "hiring")
    controlled = bool(body.get("controlled", False))
    seed = body.get("seed")

    generator = PopulationGenerator(seed=seed)
    profiles = generator.generate(domain=domain, size=size, controlled=controlled)
    return jsonify({"profiles": [p.to_dict() for p in profiles], "size": len(profiles)})


@population_bp.route("/domains", methods=["GET"])
def list_domains():
    return jsonify({"domains": DOMAIN_TEMPLATES, "demographics": DEMOGRAPHICS})
