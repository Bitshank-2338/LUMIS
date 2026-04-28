"""Audit API endpoints."""
from __future__ import annotations
import random
import uuid as _uuid
from flask import Blueprint, jsonify, request

from app.services.audit_orchestrator import orchestrator
from app.services.llm_decision_adapter import (
    LLMDecisionAdapter,
    PROVIDER_PRESETS,
)

# ── Built-in biased demo model (callable — no HTTP server needed) ─────────────
_MINORITY_ZIPS = {"30310", "60619", "21217", "20019", "90022", "78228", "33125", "10032"}

def _demo_model(profile: dict) -> dict:
    """
    Intentionally biased hiring model used for demos.
    Encodes gender bias (-15), zip-code proxy bias (-10), age bias (-8).
    """
    skills    = float(profile.get("skills_score", 50))
    education = float(profile.get("education_level", 2))
    years_exp = float(profile.get("years_experience", 0))
    prior     = float(profile.get("previous_roles", 0))
    uni       = float(profile.get("university_tier", 2))

    score = skills * 0.50 + education * 5.0 + years_exp * 1.5 + prior * 1.5 + (4 - uni) * 4.0

    if str(profile.get("gender", "")).lower() in ("female", "non_binary"):
        score -= 15.0
    if str(profile.get("zip_code", "")) in _MINORITY_ZIPS:
        score -= 10.0
    if float(profile.get("age", 30)) >= 50:
        score -= 8.0

    score += random.gauss(0, 2.0)
    probability = max(0.0, min(1.0, score / 100.0))
    return {"decision": 1 if probability >= 0.5 else 0, "score": round(probability, 4)}

_DEMO_ENDPOINTS = {"http://localhost:6001/predict", "http://localhost:6001", "demo", "demo://biased-hiring"}

audit_bp = Blueprint("audit", __name__)


@audit_bp.route("/providers", methods=["GET"])
def get_providers():
    """List the LLM providers users can audit out-of-the-box."""
    return jsonify({"providers": PROVIDER_PRESETS})


@audit_bp.route("", methods=["POST"])
def create_audit():
    """
    Start a new audit.

    Body:
      {
        "domain": "hiring|lending|medical|housing|insurance",
        "model_endpoint": "https://your-ai.com/predict",
        "model_headers": { "Authorization": "Bearer ..." },  # optional
        "sample_size": 1000,
        "protected_attributes": ["gender", "race", "age_group"],
        "compliance_frameworks": ["EU_AI_ACT", "EEOC"],
        "controlled_pairs": false,
        "seed": 42
      }
    """
    body = request.get_json(force=True) or {}

    if not body.get("domain"):
        return jsonify({"error": "domain is required"}), 400

    # New: support LLM-as-a-classifier (any OpenAI-compatible endpoint).
    # Body shape:
    #   { "llm_provider": "nvidia|openai|groq|together|custom",
    #     "llm_base_url": "https://...",   (only when "custom")
    #     "llm_model":    "meta/llama-3.3-70b-instruct",
    #     "llm_api_key":  "nvapi-..." }
    llm_provider = body.pop("llm_provider", None)
    llm_model    = body.pop("llm_model", None)
    llm_api_key  = body.pop("llm_api_key", None)
    llm_base_url = body.pop("llm_base_url", None)

    model_callable = None
    if llm_provider:
        if llm_provider != "custom":
            preset = PROVIDER_PRESETS.get(llm_provider)
            if not preset:
                return jsonify({"error": f"unknown provider {llm_provider}"}), 400
            llm_base_url = preset["base_url"]
        if not (llm_base_url and llm_model and llm_api_key):
            return jsonify({"error": "llm_base_url, llm_model, llm_api_key required"}), 400
        adapter = LLMDecisionAdapter(
            base_url=llm_base_url,
            api_key=llm_api_key,
            model=llm_model,
            domain=body["domain"],
        )
        model_callable = adapter
        body["model_endpoint"] = f"{llm_provider}://{llm_model}"
    elif body.get("model_endpoint") in _DEMO_ENDPOINTS:
        # Use built-in biased demo model — no external HTTP call needed
        model_callable = _demo_model
        body["model_endpoint"] = "demo://biased-hiring-model"
    elif not body.get("model_endpoint"):
        return jsonify({"error": "model_endpoint or llm_provider is required"}), 400

    audit_id = orchestrator.create_audit(body)
    orchestrator.run_audit_async(audit_id, model_callable=model_callable)

    return jsonify({
        "audit_id": audit_id,
        "status_url": f"/api/audit/{audit_id}/status",
        "results_url": f"/api/audit/{audit_id}/results",
    }), 202


@audit_bp.route("/<audit_id>/status", methods=["GET"])
def get_status(audit_id: str):
    status = orchestrator.get_status(audit_id)
    if not status:
        return jsonify({"error": "audit not found"}), 404
    return jsonify(status)


@audit_bp.route("/<audit_id>/results", methods=["GET"])
def get_results(audit_id: str):
    results = orchestrator.get_results(audit_id)
    if results is None:
        status = orchestrator.get_status(audit_id)
        if status and status["state"] != "COMPLETED":
            return jsonify({"error": "audit still in progress", "status": status}), 202
        return jsonify({"error": "audit not found or not yet complete"}), 404
    return jsonify(results)


@audit_bp.route("", methods=["GET"])
def list_audits():
    return jsonify({"audits": orchestrator.list_audits()})


@audit_bp.route("/<audit_id>/graph", methods=["GET"])
def get_graph(audit_id: str):
    """
    Return D3-compatible graph data: nodes + edges.
    nodes = synthetic agents  (colored by decision / demographics)
    edges = demographic relationships between agents
    Query params:
      max_nodes: int (default 300) – cap for performance
      color_by:  decision | race | gender (default decision)
    """
    try:
        max_nodes = int(request.args.get("max_nodes", 300))
    except (TypeError, ValueError):
        max_nodes = 300
    color_by = request.args.get("color_by", "decision")

    profiles = orchestrator.get_profiles(audit_id, limit=max_nodes)
    if not profiles:
        status = orchestrator.get_status(audit_id)
        if status and status["state"] != "COMPLETED":
            return jsonify({"error": "audit not completed", "status": status}), 202
        return jsonify({"nodes": [], "edges": [], "stats": {}})

    results = orchestrator.get_results(audit_id)
    summary = results.get("summary", {}) if results else {}

    # ── Build nodes ──────────────────────────────────────────────────────────
    DECISION_LABEL = {1: "ACCEPTED", 0: "REJECTED", None: "PENDING"}
    nodes = []
    for p in profiles:
        decision = p.get("decision")
        label = DECISION_LABEL.get(decision, "PENDING")
        nodes.append({
            "uuid": p["profile_id"],
            "name": p["name"],
            "labels": [label, p["race"].title(), p["gender"].title()],
            "attributes": {
                "gender": p["gender"],
                "race": p["race"],
                "age": p["age"],
                "age_group": p["age_group"],
                "zip_code": p["zip_code"],
                "disability": p["disability"],
                "domain": p.get("domain", ""),
                "decision": label,
                "score": round(p["score"], 3) if isinstance(p["score"], float) else p["score"],
                "ground_truth": "qualified" if p.get("ground_truth") == 1 else "not qualified",
                **{k: v for k, v in (p.get("features") or {}).items()},
            },
            "summary": (
                f"{p['name']} ({p['gender']}, {p['race']}, {p['age']}y, ZIP {p['zip_code']}) "
                f"was {label.lower()} by the model "
                f"with score {p['score']:.2f}." if isinstance(p.get('score'), float)
                else f"{p['name']} was {label.lower()} by the model."
            ),
        })

    # ── Build edges (demographic relationships) ───────────────────────────────
    rng = random.Random(42)
    profile_by_id = {p["profile_id"]: p for p in profiles}
    node_ids = [p["profile_id"] for p in profiles]

    EDGE_TYPES = {
        "race": ("SAME_ETHNICITY", "Shares racial/ethnic background"),
        "gender": ("SAME_GENDER", "Shares gender identity"),
        "age_group": ("SAME_AGE_COHORT", "In the same age cohort"),
        "zip_code": ("SAME_NEIGHBORHOOD", "From the same ZIP code area"),
        "decision": ("SAME_OUTCOME", "Received the same model decision"),
    }

    edges = []
    seen_pairs: set[frozenset] = set()

    # Same-race edges (sparse – MiroFish style)
    for attr, (ename, efact) in EDGE_TYPES.items():
        buckets: dict = {}
        for p in profiles:
            val = p.get(attr) or p.get("attributes", {}).get(attr)
            if val:
                buckets.setdefault(val, []).append(p["profile_id"])

        for val, bucket in buckets.items():
            # Each node: connect to ~2 peers in same bucket (sparse)
            for nid in bucket:
                peers = [x for x in bucket if x != nid]
                if not peers:
                    continue
                n_edges = 2 if attr in ("race", "decision") else 1
                chosen = rng.sample(peers, min(n_edges, len(peers)))
                for pid in chosen:
                    pair = frozenset([nid, pid])
                    if pair in seen_pairs:
                        continue
                    seen_pairs.add(pair)
                    src_name = profile_by_id[nid]["name"]
                    tgt_name = profile_by_id[pid]["name"]
                    edges.append({
                        "uuid": str(_uuid.uuid4()),
                        "source_node_uuid": nid,
                        "target_node_uuid": pid,
                        "name": ename,
                        "fact_type": attr.upper(),
                        "fact": f"{efact}: {val}",
                        "source_name": src_name,
                        "target_name": tgt_name,
                    })

    # Cap edges for performance
    if len(edges) > max_nodes * 2:
        edges = rng.sample(edges, max_nodes * 2)

    stats = {
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "accepted": sum(1 for p in profiles if p.get("decision") == 1),
        "rejected": sum(1 for p in profiles if p.get("decision") == 0),
        "pending":  sum(1 for p in profiles if p.get("decision") is None),
        "fairness_score": summary.get("fairness_score"),
        "risk_level": summary.get("risk_level"),
    }

    return jsonify({"nodes": nodes, "edges": edges, "stats": stats})
