"""
Model Connector.

Adapter that routes synthetic profiles through the target AI model.
Supports multiple integration modes:
- HTTP REST endpoint (any model with a JSON API)
- Python callable (in-process for SDK use)
- Batch with concurrent workers
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field, asdict
from typing import Any, Callable
import requests


@dataclass
class ModelDecision:
    profile_id: str
    decision: int  # 0/1
    score: float   # confidence/probability
    latency_ms: float
    raw_response: dict | None = None
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


class ModelConnector:
    """
    Routes profiles through an external or in-process model.

    Required model contract:
      Input: JSON object representing applicant/candidate
      Output: { "decision": 0|1, "score": 0.0..1.0 }

    The connector is permissive: it tries common output keys
    (decision/approved/hire/recommend; score/probability/confidence).
    """

    DECISION_KEYS = ("decision", "approved", "hire", "recommend", "outcome", "result", "approve", "high_priority")
    SCORE_KEYS = ("score", "probability", "confidence", "p", "prob")

    def __init__(
        self,
        endpoint: str | None = None,
        callable_fn: Callable[[dict], dict] | None = None,
        headers: dict | None = None,
        timeout: int = 30,
        max_workers: int = 10,
    ):
        if not endpoint and not callable_fn:
            raise ValueError("Either endpoint or callable_fn required")
        self.endpoint = endpoint
        self.callable_fn = callable_fn
        self.headers = headers or {"Content-Type": "application/json"}
        self.timeout = timeout
        self.max_workers = max_workers

    def predict_one(self, profile_input: dict) -> ModelDecision:
        profile_id = profile_input.get("applicant_id") or profile_input.get("id") or "unknown"
        start = time.time()
        try:
            if self.callable_fn:
                raw = self.callable_fn(profile_input)
            else:
                resp = requests.post(self.endpoint, json=profile_input, headers=self.headers, timeout=self.timeout)
                resp.raise_for_status()
                raw = resp.json()

            decision = self._extract_decision(raw)
            score = self._extract_score(raw)

            return ModelDecision(
                profile_id=profile_id,
                decision=decision,
                score=score,
                latency_ms=round((time.time() - start) * 1000, 2),
                raw_response=raw if isinstance(raw, dict) else {"value": raw},
            )
        except Exception as e:
            return ModelDecision(
                profile_id=profile_id,
                decision=0,
                score=0.0,
                latency_ms=round((time.time() - start) * 1000, 2),
                error=str(e),
            )

    def predict_batch(
        self,
        profile_inputs: list[dict],
        progress_callback: Callable[[int, int], None] | None = None,
        decision_callback: Callable[["ModelDecision"], None] | None = None,
    ) -> list[ModelDecision]:
        results: list[ModelDecision] = []
        completed = 0
        total = len(profile_inputs)

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(self.predict_one, p): p for p in profile_inputs}
            for future in as_completed(futures):
                d = future.result()
                results.append(d)
                if decision_callback:
                    try:
                        decision_callback(d)
                    except Exception:
                        pass
                completed += 1
                if progress_callback and completed % max(1, total // 20) == 0:
                    progress_callback(completed, total)
        if progress_callback:
            progress_callback(total, total)
        return results

    def _extract_decision(self, raw: Any) -> int:
        if isinstance(raw, (int, float, bool)):
            return int(bool(raw))
        if isinstance(raw, str):
            return 1 if raw.lower() in ("yes", "true", "approve", "hire", "accept", "1") else 0
        if isinstance(raw, dict):
            for k in self.DECISION_KEYS:
                if k in raw:
                    v = raw[k]
                    if isinstance(v, bool):
                        return int(v)
                    if isinstance(v, (int, float)):
                        return int(v >= 0.5)
                    if isinstance(v, str):
                        return 1 if v.lower() in ("yes", "true", "approve", "hire", "accept", "1") else 0
            for k in self.SCORE_KEYS:
                if k in raw:
                    return int(float(raw[k]) >= 0.5)
        return 0

    def _extract_score(self, raw: Any) -> float:
        if isinstance(raw, (int, float)):
            return float(raw)
        if isinstance(raw, dict):
            for k in self.SCORE_KEYS:
                if k in raw:
                    try:
                        return float(raw[k])
                    except (TypeError, ValueError):
                        pass
            for k in self.DECISION_KEYS:
                if k in raw and isinstance(raw[k], (int, float, bool)):
                    return float(raw[k])
        return 0.0
