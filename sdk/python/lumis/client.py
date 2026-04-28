"""LUMIS SDK — Audit client."""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any
import requests


DEFAULT_BASE_URL = "http://localhost:5002"


class LumisError(Exception):
    pass


@dataclass
class AuditReport:
    """Wrapper around an audit's full results dict."""
    audit_id: str
    data: dict[str, Any]
    base_url: str
    api_key: str | None = None

    @property
    def risk_level(self) -> str:
        return self.data.get("summary", {}).get("risk_level", "UNKNOWN")

    @property
    def fairness_score(self) -> float:
        return self.data.get("summary", {}).get("fairness_score", 0.0)

    @property
    def passed(self) -> bool:
        return self.risk_level in ("OK", "COMPLIANT", "LOW")

    def summary(self) -> str:
        s = self.data.get("summary", {})
        lines = [
            f"LUMIS Audit Report — {self.audit_id}",
            f"  Risk Level:        {s.get('risk_level')}",
            f"  Fairness Score:    {s.get('fairness_score')} / 1.000",
            f"  Metrics Failed:    {s.get('metrics_failed')} / {s.get('total_metrics_evaluated')}",
            f"  Critical Findings: {s.get('critical_findings')}",
            f"  High Findings:     {s.get('high_findings')}",
            f"  Proxies Detected:  {s.get('proxies_detected')}",
        ]
        compliance = self.data.get("compliance", {})
        if compliance:
            lines.append("\n  Compliance:")
            for fw_key, fw in compliance.items():
                marker = "PASS" if fw["status"] == "COMPLIANT" else "FAIL"
                lines.append(f"    [{marker}] {fw['framework']}: {fw['status']}")
        return "\n".join(lines)

    def metrics(self, attribute: str | None = None) -> list[dict]:
        all_metrics = self.data.get("metrics", {})
        if attribute:
            return all_metrics.get(attribute, [])
        flat = []
        for attr, ms in all_metrics.items():
            for m in ms:
                flat.append({**m, "attribute": attr})
        return flat

    def recommendations(self) -> list[dict]:
        return self.data.get("recommendations", [])

    def save_pdf(self, path: str) -> None:
        url = f"{self.base_url}/api/reports/{self.audit_id}/pdf"
        resp = requests.get(url, headers=self._headers(), timeout=60)
        resp.raise_for_status()
        with open(path, "wb") as f:
            f.write(resp.content)

    def save_markdown(self, path: str) -> None:
        url = f"{self.base_url}/api/reports/{self.audit_id}/markdown"
        resp = requests.get(url, headers=self._headers(), timeout=60)
        resp.raise_for_status()
        with open(path, "w", encoding="utf-8") as f:
            f.write(resp.text)

    def _headers(self) -> dict:
        h = {}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h


class LumisAudit:
    """LUMIS audit client. Plug your AI model in and get a fairness audit."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: int = 600,
        poll_interval: float = 1.5,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.poll_interval = poll_interval

    def audit_endpoint(
        self,
        url: str,
        domain: str = "hiring",
        sample_size: int = 1000,
        protected_attributes: list[str] | None = None,
        compliance_frameworks: list[str] | None = None,
        controlled_pairs: bool = False,
        seed: int | None = 42,
        headers: dict | None = None,
        on_progress: callable = None,
    ) -> AuditReport:
        """
        Audit an HTTP model endpoint.

        Args:
            url: model endpoint that accepts POST with JSON applicant data
            domain: hiring | lending | medical | housing | insurance
            sample_size: number of synthetic profiles to generate
            protected_attributes: defaults to ['gender', 'race', 'age_group']
            compliance_frameworks: defaults to ['EU_AI_ACT', 'EEOC']
            controlled_pairs: if True, generate counterfactual matched pairs
            seed: random seed for reproducibility
            headers: optional auth headers passed to the model endpoint
            on_progress: callback(state, progress, message)

        Returns:
            AuditReport with all results and helpers.
        """
        body = {
            "domain": domain,
            "model_endpoint": url,
            "model_headers": headers or {},
            "sample_size": sample_size,
            "protected_attributes": protected_attributes or ["gender", "race", "age_group"],
            "compliance_frameworks": compliance_frameworks or ["EU_AI_ACT", "EEOC"],
            "controlled_pairs": controlled_pairs,
            "seed": seed,
        }

        resp = requests.post(
            f"{self.base_url}/api/audit",
            json=body,
            headers=self._auth_headers(),
            timeout=30,
        )
        if resp.status_code >= 400:
            raise LumisError(f"Failed to start audit: {resp.status_code} {resp.text}")

        audit_id = resp.json()["audit_id"]
        self._wait_for_completion(audit_id, on_progress=on_progress)

        results_resp = requests.get(
            f"{self.base_url}/api/audit/{audit_id}/results",
            headers=self._auth_headers(),
            timeout=30,
        )
        results_resp.raise_for_status()

        return AuditReport(
            audit_id=audit_id,
            data=results_resp.json(),
            base_url=self.base_url,
            api_key=self.api_key,
        )

    def get_report(self, audit_id: str) -> AuditReport:
        resp = requests.get(
            f"{self.base_url}/api/audit/{audit_id}/results",
            headers=self._auth_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        return AuditReport(audit_id=audit_id, data=resp.json(), base_url=self.base_url, api_key=self.api_key)

    def list_audits(self) -> list[dict]:
        resp = requests.get(
            f"{self.base_url}/api/audit",
            headers=self._auth_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("audits", [])

    def _wait_for_completion(self, audit_id: str, on_progress: callable | None = None):
        start = time.time()
        last_state = None
        while True:
            if time.time() - start > self.timeout:
                raise LumisError(f"Audit {audit_id} timed out after {self.timeout}s")

            resp = requests.get(
                f"{self.base_url}/api/audit/{audit_id}/status",
                headers=self._auth_headers(),
                timeout=30,
            )
            resp.raise_for_status()
            status = resp.json()
            state = status["state"]

            if on_progress and (state != last_state or state in ("RUNNING", "GENERATING", "ANALYZING")):
                on_progress(state, status["progress"], status["message"])
            last_state = state

            if state == "COMPLETED":
                return
            if state == "FAILED":
                raise LumisError(f"Audit failed: {status.get('error', 'unknown')}")

            time.sleep(self.poll_interval)

    def _auth_headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h
