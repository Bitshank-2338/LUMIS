"""
Audit Orchestrator.

End-to-end pipeline:
  1. Generate synthetic population (PopulationGenerator)
  2. Route through target model (ModelConnector)
  3. Detect bias (BiasEngine)
  4. Generate report (AuditReporter)

Audits run async with status tracking — frontend polls for progress.
"""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Callable
import pandas as pd

from app.services.population_generator import PopulationGenerator, SyntheticProfile
from app.services.model_connector import ModelConnector, ModelDecision
from app.services.bias_engine import BiasEngine
from app.config import COMPLIANCE_FRAMEWORKS


@dataclass
class AuditConfig:
    audit_id: str
    domain: str  # hiring | lending | medical | housing | insurance
    model_endpoint: str | None = None
    model_headers: dict = field(default_factory=dict)
    sample_size: int = 1000
    protected_attributes: list[str] = field(default_factory=lambda: ["gender", "race", "age_group"])
    compliance_frameworks: list[str] = field(default_factory=lambda: ["EU_AI_ACT", "EEOC"])
    controlled_pairs: bool = False
    seed: int | None = None


@dataclass
class AuditStatus:
    audit_id: str
    state: str  # PENDING | GENERATING | RUNNING | ANALYZING | COMPLETED | FAILED
    progress: float  # 0.0 to 1.0
    message: str
    started_at: str
    completed_at: str | None = None
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


class AuditOrchestrator:
    """In-memory audit registry. Production should use Supabase / Postgres."""

    def __init__(self):
        self._audits: dict[str, dict[str, Any]] = {}
        self._statuses: dict[str, AuditStatus] = {}
        self._lock = threading.Lock()

    def create_audit(self, config: dict) -> str:
        audit_id = config.get("audit_id") or str(uuid.uuid4())
        cfg = AuditConfig(audit_id=audit_id, **{k: v for k, v in config.items() if k != "audit_id"})
        status = AuditStatus(
            audit_id=audit_id,
            state="PENDING",
            progress=0.0,
            message="Audit queued",
            started_at=datetime.now(timezone.utc).isoformat(),
        )
        with self._lock:
            self._audits[audit_id] = {"config": cfg, "results": None}
            self._statuses[audit_id] = status
        return audit_id

    def run_audit_async(self, audit_id: str, model_callable: Callable | None = None):
        thread = threading.Thread(target=self._run, args=(audit_id, model_callable), daemon=True)
        thread.start()

    def _run(self, audit_id: str, model_callable: Callable | None = None):
        try:
            cfg: AuditConfig = self._audits[audit_id]["config"]

            # Initialize empty profile registry IMMEDIATELY so the live graph endpoint
            # has somewhere to read partial data from.
            with self._lock:
                self._audits[audit_id]["profiles"] = {}

            self._update(audit_id, "GENERATING", 0.05, f"Generating {cfg.sample_size} synthetic profiles...")
            generator = PopulationGenerator(seed=cfg.seed)
            profiles = generator.generate(
                domain=cfg.domain,
                size=cfg.sample_size,
                controlled=cfg.controlled_pairs,
            )

            # Pre-populate profiles with no decisions yet — graph can render them as PENDING nodes.
            with self._lock:
                store = self._audits[audit_id]["profiles"]
                for p in profiles:
                    store[p.profile_id] = {
                        "profile_id": p.profile_id,
                        "name": p.name,
                        "gender": p.gender,
                        "race": p.race,
                        "age": p.age,
                        "age_group": p.age_group,
                        "disability": p.disability,
                        "nationality_origin": p.nationality_origin,
                        "zip_code": p.zip_code,
                        "features": p.features,
                        "domain": p.domain if hasattr(p, "domain") else None,
                        "ground_truth": p.ground_truth,
                        "decision": None,  # PENDING — not yet evaluated
                        "score": None,
                        "model_error": None,
                    }

            self._update(audit_id, "GENERATING", 0.20, f"Generated {len(profiles)} profiles")

            self._update(audit_id, "RUNNING", 0.25, f"Routing profiles through target model...")
            connector = ModelConnector(
                endpoint=cfg.model_endpoint,
                callable_fn=model_callable,
                headers=cfg.model_headers,
            )

            def progress_cb(done: int, total: int):
                pct = 0.25 + (done / total) * 0.55
                self._update(audit_id, "RUNNING", pct, f"Model evaluated {done}/{total} profiles")

            # Stream individual decisions back into the profile registry as they arrive.
            def decision_cb(d: ModelDecision):
                with self._lock:
                    store = self._audits[audit_id].get("profiles", {})
                    rec = store.get(d.profile_id)
                    if rec is not None:
                        rec["decision"] = d.decision
                        rec["score"] = d.score
                        rec["model_error"] = d.error

            decisions = connector.predict_batch(
                [p.to_model_input() for p in profiles],
                progress_callback=progress_cb,
                decision_callback=decision_cb,
            )

            self._update(audit_id, "ANALYZING", 0.85, "Computing fairness metrics...")
            df = self._build_dataframe(profiles, decisions)

            engine = BiasEngine()
            analysis = engine.analyze(
                df=df,
                protected_attrs=cfg.protected_attributes,
                decision_col="decision",
                score_col="score",
                ground_truth_col="ground_truth",
            )

            self._update(audit_id, "ANALYZING", 0.95, "Building compliance report...")
            compliance = self._evaluate_compliance(analysis, cfg.compliance_frameworks)

            n_errors = sum(1 for d in decisions if d.error)
            avg_latency = sum(d.latency_ms for d in decisions) / max(1, len(decisions))
            results = {
                "audit_id": audit_id,
                "config": asdict(cfg),
                "summary": analysis["summary"],
                "metrics": analysis["metrics"],
                "group_stats": analysis["group_stats"],
                "intersectional": analysis["intersectional"],
                "proxy_detection": analysis["proxy_detection"],
                "compliance": compliance,
                "execution": {
                    "profiles_generated": len(profiles),
                    "decisions_received": len(decisions),
                    "errors": n_errors,
                    "avg_model_latency_ms": round(avg_latency, 2),
                },
                "recommendations": self._generate_recommendations(analysis),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }

            profile_records = self._build_profile_records(profiles, decisions)

            with self._lock:
                self._audits[audit_id]["results"] = results
                self._audits[audit_id]["profiles"] = profile_records
            self._update(audit_id, "COMPLETED", 1.0, "Audit complete")

        except Exception as e:
            import traceback
            traceback.print_exc()
            self._update(audit_id, "FAILED", 0.0, f"Audit failed: {e}", error=str(e))

    def _build_profile_records(
        self, profiles: list[SyntheticProfile], decisions: list[ModelDecision]
    ) -> dict[str, dict]:
        """Per-profile records used for the agent-chat feature."""
        decision_map = {d.profile_id: d for d in decisions}
        out: dict[str, dict] = {}
        for p in profiles:
            d = decision_map.get(p.profile_id)
            out[p.profile_id] = {
                "profile_id": p.profile_id,
                "name": p.name,
                "gender": p.gender,
                "race": p.race,
                "age": p.age,
                "age_group": p.age_group,
                "disability": p.disability,
                "nationality_origin": p.nationality_origin,
                "zip_code": p.zip_code,
                "features": p.features,
                "domain": p.domain if hasattr(p, "domain") else None,
                "ground_truth": p.ground_truth,
                "decision": d.decision if d else None,
                "score": d.score if d else None,
                "model_error": d.error if d else None,
            }
        return out

    def get_profiles(self, audit_id: str, decision_filter: str | None = None, limit: int = 100) -> list[dict]:
        with self._lock:
            entry = self._audits.get(audit_id)
            if not entry or "profiles" not in entry:
                return []
            records = list(entry["profiles"].values())
        if decision_filter == "rejected":
            records = [r for r in records if r.get("decision") == 0]
        elif decision_filter == "accepted":
            records = [r for r in records if r.get("decision") == 1]
        elif decision_filter == "pending":
            records = [r for r in records if r.get("decision") is None]
        return records[:limit]

    def get_profile(self, audit_id: str, profile_id: str) -> dict | None:
        with self._lock:
            entry = self._audits.get(audit_id)
            if not entry or "profiles" not in entry:
                return None
            return entry["profiles"].get(profile_id)

    def _build_dataframe(
        self, profiles: list[SyntheticProfile], decisions: list[ModelDecision]
    ) -> pd.DataFrame:
        decision_map = {d.profile_id: d for d in decisions}
        rows = []
        for p in profiles:
            d = decision_map.get(p.profile_id)
            if not d:
                continue
            row = {
                "profile_id": p.profile_id,
                "gender": p.gender,
                "race": p.race,
                "age_group": p.age_group,
                "age": p.age,
                "disability": p.disability,
                "nationality_origin": p.nationality_origin,
                "zip_code": p.zip_code,
                "decision": d.decision,
                "score": d.score,
                "ground_truth": p.ground_truth if p.ground_truth is not None else 0,
                **{f"feat_{k}": v for k, v in p.features.items()},
            }
            rows.append(row)
        return pd.DataFrame(rows)

    def _evaluate_compliance(self, analysis: dict, frameworks: list[str]) -> dict:
        results = {}
        for fw_key in frameworks:
            fw = COMPLIANCE_FRAMEWORKS.get(fw_key)
            if not fw:
                continue
            failed_metrics = []
            checked_metrics = []
            for attr, metrics in analysis["metrics"].items():
                for m in metrics:
                    metric_root = m["metric"].replace("_difference", "").replace("_ratio", "")
                    if any(metric_root in fm or fm in metric_root for fm in fw["metrics"]):
                        checked_metrics.append(m["metric"])
                        if not m["passed"]:
                            failed_metrics.append({"attribute": attr, "metric": m["metric"], "value": m["value"]})

            status = "COMPLIANT" if not failed_metrics else "NON_COMPLIANT"
            results[fw_key] = {
                "framework": fw["name"],
                "status": status,
                "checked_metrics": list(set(checked_metrics)),
                "failed_metrics": failed_metrics,
            }
        return results

    def _generate_recommendations(self, analysis: dict) -> list[dict]:
        recs = []
        for attr, metrics in analysis["metrics"].items():
            for m in metrics:
                if m["passed"] or m["severity"] == "OK":
                    continue
                metric = m["metric"]
                if "demographic_parity" in metric:
                    recs.append({
                        "priority": m["severity"],
                        "title": f"Address demographic parity gap in '{attr}'",
                        "actions": [
                            "Apply post-processing fairness constraints (e.g., calibrated equalized odds)",
                            "Retrain with reweighted samples to balance acceptance rates",
                            f"Audit training data for under-representation of '{attr}' subgroups",
                        ],
                    })
                elif "disparate_impact" in metric:
                    recs.append({
                        "priority": m["severity"],
                        "title": f"Resolve disparate impact violation in '{attr}'",
                        "actions": [
                            "FAILS EEOC 4/5ths rule — immediate remediation required",
                            "Apply adversarial debiasing during training",
                            "Consider removing or transforming features correlated with the protected attribute",
                            "Document business necessity if disparity is unavoidable",
                        ],
                    })
                elif "equalized_odds" in metric or "equal_opportunity" in metric:
                    recs.append({
                        "priority": m["severity"],
                        "title": f"Fix unequal error rates across '{attr}' groups",
                        "actions": [
                            "Apply equalized-odds post-processing (Hardt et al.)",
                            "Re-balance training set to ensure each group has similar TPR/FPR",
                            "Analyze why qualified individuals from some groups are rejected more often",
                        ],
                    })
                elif "chi_squared" in metric:
                    recs.append({
                        "priority": m["severity"],
                        "title": f"Statistically significant bias in '{attr}'",
                        "actions": [
                            "Disparities are not random — bias is real and reproducible",
                            "File for compliance review before production deployment",
                        ],
                    })

        if analysis["proxy_detection"]["proxies_detected"] > 0:
            for proxy in analysis["proxy_detection"]["details"]:
                recs.append({
                    "priority": proxy["severity"],
                    "title": f"Proxy feature detected: '{proxy['feature']}' correlates with '{proxy['proxy_for']}'",
                    "actions": [
                        f"Feature has {abs(proxy['correlation']):.0%} correlation with protected attribute",
                        "Remove the feature or apply orthogonalization",
                        "Use causal-fairness techniques to break the indirect path",
                    ],
                })

        seen = set()
        unique = []
        for r in recs:
            if r["title"] not in seen:
                unique.append(r)
                seen.add(r["title"])
        priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "OK": 4}
        unique.sort(key=lambda r: priority_order.get(r["priority"], 99))
        return unique

    def _update(self, audit_id: str, state: str, progress: float, message: str, error: str | None = None):
        with self._lock:
            status = self._statuses.get(audit_id)
            if not status:
                return
            status.state = state
            status.progress = progress
            status.message = message
            if state == "COMPLETED":
                status.completed_at = datetime.now(timezone.utc).isoformat()
            if error:
                status.error = error

    def get_status(self, audit_id: str) -> dict | None:
        with self._lock:
            s = self._statuses.get(audit_id)
            return s.to_dict() if s else None

    def get_results(self, audit_id: str) -> dict | None:
        with self._lock:
            entry = self._audits.get(audit_id)
            return entry["results"] if entry else None

    def list_audits(self) -> list[dict]:
        with self._lock:
            return [s.to_dict() for s in self._statuses.values()]


orchestrator = AuditOrchestrator()
