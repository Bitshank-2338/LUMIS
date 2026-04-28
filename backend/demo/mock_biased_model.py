"""
Mock Biased Hiring Model — Demo Target.

Standalone Flask service that exposes a "real-world" biased AI model
for LUMIS to audit during demos. Encodes 3 realistic bias patterns:

  1. Gender bias:    female / non-binary applicants get a -15 score penalty
  2. Racial proxy:   zip codes from minority neighborhoods get -10 penalty
                     (no explicit race feature — bias hides in the proxy)
  3. Age bias:       50+ applicants get -8 score penalty

Run:  python -m demo.mock_biased_model
Port: 6001
"""
from __future__ import annotations

import os
import random
from flask import Flask, request, jsonify

app = Flask(__name__)

MINORITY_ZIPS = {
    "30310", "60619", "21217", "20019",
    "90022", "78228", "33125", "10032",
}


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "mock-biased-hiring", "port": 6001})


@app.route("/predict", methods=["POST"])
def predict():
    """
    POST /predict
    Body: { name, age, gender, race, zip_code, years_experience, education_level,
            skills_score, previous_roles, university_tier, ... }
    Returns: { decision, score, reasons }
    """
    body = request.get_json(force=True) or {}

    skills = float(body.get("skills_score", 50))
    education = float(body.get("education_level", 2))
    years_exp = float(body.get("years_experience", 0))
    prior_roles = float(body.get("previous_roles", 0))
    uni_tier = float(body.get("university_tier", 2))

    base_score = (
        skills * 0.50
        + education * 5.0
        + years_exp * 1.5
        + prior_roles * 1.5
        + (4 - uni_tier) * 4.0
    )

    reasons = []

    gender = body.get("gender", "").lower()
    if gender in ("female", "non_binary"):
        base_score -= 15.0
        reasons.append("gender_penalty:-15")

    zip_code = str(body.get("zip_code", ""))
    if zip_code in MINORITY_ZIPS:
        base_score -= 10.0
        reasons.append("zip_penalty:-10")

    age = float(body.get("age", 30))
    if age >= 50:
        base_score -= 8.0
        reasons.append("age_penalty:-8")

    base_score += random.gauss(0, 2.0)
    score = max(0.0, min(100.0, base_score))
    probability = score / 100.0
    decision = 1 if probability >= 0.50 else 0

    return jsonify({
        "applicant_id": body.get("applicant_id"),
        "decision": decision,
        "score": round(probability, 4),
        "raw_score": round(score, 2),
        "reasons": reasons,
    })


@app.route("/")
def root():
    return jsonify({
        "name": "Mock Biased Hiring Model",
        "warning": "DEMO ONLY — intentionally encodes bias for LUMIS audit demonstrations",
        "endpoint": "POST /predict",
        "biases_encoded": [
            "Gender: female/non_binary applicants penalized 15 points",
            "Racial proxy: minority-area zip codes penalized 10 points",
            "Age: applicants 50+ penalized 8 points",
        ],
    })


if __name__ == "__main__":
    port = int(os.getenv("MOCK_MODEL_PORT", "6001"))
    print(f"\n[MOCK BIASED MODEL] running on http://0.0.0.0:{port}")
    print("WARNING: this model intentionally encodes bias for demo purposes.\n")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
