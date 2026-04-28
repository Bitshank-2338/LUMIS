"""
LUMIS Bias Detection Engine.

Implements regulatory-grade fairness metrics used by EU AI Act, EEOC, ECOA, GDPR.
Each metric returns a value, threshold, pass/fail status, and plain-English interpretation.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict, field
from typing import Any
from collections import defaultdict
import numpy as np
import pandas as pd
from scipy import stats


def _sanitize(obj: Any) -> Any:
    """Recursively convert numpy scalars to native Python types for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(i) for i in obj]
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


@dataclass
class MetricResult:
    metric: str
    value: float
    threshold: float
    passed: bool
    severity: str  # CRITICAL | HIGH | MEDIUM | LOW | OK
    interpretation: str
    affected_groups: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return _sanitize(asdict(self))


@dataclass
class GroupStats:
    group: str
    n: int
    positive_rate: float
    mean_score: float
    std_score: float
    tpr: float | None = None
    fpr: float | None = None

    def to_dict(self) -> dict:
        return _sanitize(asdict(self))


class BiasEngine:
    """Computes fairness metrics across protected attributes."""

    def __init__(self, fairness_threshold: float = 0.05, dir_threshold: float = 0.80):
        self.fairness_threshold = fairness_threshold
        self.dir_threshold = dir_threshold

    def analyze(
        self,
        df: pd.DataFrame,
        protected_attrs: list[str],
        decision_col: str = "decision",
        score_col: str = "score",
        ground_truth_col: str | None = None,
    ) -> dict[str, Any]:
        """
        Run the full bias audit.

        df columns expected:
          - decision_col: 0/1 (rejected/accepted) or similar
          - score_col: continuous score (0..1)
          - protected_attrs: demographic columns
          - ground_truth_col (optional): true label for equalized odds
        """
        results = {
            "summary": {},
            "group_stats": {},
            "metrics": {},
            "intersectional": {},
            "proxy_detection": {},
        }

        for attr in protected_attrs:
            if attr not in df.columns:
                continue

            group_stats = self._compute_group_stats(df, attr, decision_col, score_col, ground_truth_col)
            results["group_stats"][attr] = {g.group: g.to_dict() for g in group_stats}

            attr_metrics = []
            attr_metrics.append(self._demographic_parity(group_stats))
            attr_metrics.append(self._disparate_impact_ratio(group_stats))
            attr_metrics.append(self._statistical_significance(df, attr, decision_col))

            if ground_truth_col and ground_truth_col in df.columns:
                attr_metrics.append(self._equalized_odds(group_stats))
                attr_metrics.append(self._equal_opportunity(group_stats))

            results["metrics"][attr] = [m.to_dict() for m in attr_metrics]

        if len(protected_attrs) >= 2:
            results["intersectional"] = self._intersectional_analysis(df, protected_attrs, decision_col)

        results["proxy_detection"] = self._detect_proxies(df, protected_attrs, decision_col)
        results["summary"] = self._summarize(results)
        return _sanitize(results)

    def _compute_group_stats(
        self,
        df: pd.DataFrame,
        attr: str,
        decision_col: str,
        score_col: str,
        ground_truth_col: str | None,
    ) -> list[GroupStats]:
        stats_list = []
        for group, sub in df.groupby(attr):
            positive_rate = float(sub[decision_col].mean()) if decision_col in sub else 0.0
            mean_score = float(sub[score_col].mean()) if score_col in sub else 0.0
            std_score = float(sub[score_col].std()) if score_col in sub else 0.0
            tpr = fpr = None
            if ground_truth_col and ground_truth_col in sub.columns:
                gt = sub[ground_truth_col]
                pred = sub[decision_col]
                pos_mask = gt == 1
                neg_mask = gt == 0
                tpr = float(pred[pos_mask].mean()) if pos_mask.sum() > 0 else None
                fpr = float(pred[neg_mask].mean()) if neg_mask.sum() > 0 else None
            stats_list.append(GroupStats(
                group=str(group),
                n=int(len(sub)),
                positive_rate=positive_rate,
                mean_score=mean_score,
                std_score=std_score,
                tpr=tpr,
                fpr=fpr,
            ))
        return stats_list

    def _demographic_parity(self, groups: list[GroupStats]) -> MetricResult:
        """Max difference in positive rate across groups. EU AI Act Art. 10."""
        if not groups:
            return MetricResult("demographic_parity_difference", 0.0, self.fairness_threshold, True, "OK", "No groups")
        rates = [g.positive_rate for g in groups]
        diff = max(rates) - min(rates)
        passed = diff <= self.fairness_threshold
        severity = self._severity(diff, self.fairness_threshold, [0.05, 0.10, 0.20])
        max_g = max(groups, key=lambda g: g.positive_rate)
        min_g = min(groups, key=lambda g: g.positive_rate)
        return MetricResult(
            metric="demographic_parity_difference",
            value=round(diff, 4),
            threshold=self.fairness_threshold,
            passed=passed,
            severity=severity,
            interpretation=(
                f"Acceptance rate differs by {diff:.1%} between '{max_g.group}' "
                f"({max_g.positive_rate:.1%}) and '{min_g.group}' ({min_g.positive_rate:.1%}). "
                + ("Within acceptable threshold." if passed else "Exceeds fairness threshold.")
            ),
            affected_groups=[min_g.group] if not passed else [],
            details={"max_group": max_g.group, "min_group": min_g.group, "group_rates": [g.to_dict() for g in groups]},
        )

    def _disparate_impact_ratio(self, groups: list[GroupStats]) -> MetricResult:
        """EEOC 4/5ths rule. Ratio of disadvantaged group's selection rate to advantaged."""
        rates = [(g.group, g.positive_rate) for g in groups if g.positive_rate > 0]
        if len(rates) < 2:
            return MetricResult("disparate_impact_ratio", 1.0, self.dir_threshold, True, "OK", "Insufficient data")
        max_rate = max(r for _, r in rates)
        min_group, min_rate = min(rates, key=lambda x: x[1])
        ratio = min_rate / max_rate if max_rate > 0 else 1.0
        passed = ratio >= self.dir_threshold
        if ratio >= 0.80:
            severity = "OK"
        elif ratio >= 0.70:
            severity = "MEDIUM"
        elif ratio >= 0.50:
            severity = "HIGH"
        else:
            severity = "CRITICAL"
        return MetricResult(
            metric="disparate_impact_ratio",
            value=round(ratio, 4),
            threshold=self.dir_threshold,
            passed=passed,
            severity=severity,
            interpretation=(
                f"Disparate Impact Ratio = {ratio:.2f}. "
                f"Group '{min_group}' is selected at {ratio:.0%} the rate of the most-favored group. "
                + ("Satisfies EEOC 4/5ths rule." if passed else f"FAILS EEOC 4/5ths rule (threshold: {self.dir_threshold:.0%}).")
            ),
            affected_groups=[min_group] if not passed else [],
            details={"disadvantaged_group": min_group, "disadvantaged_rate": min_rate, "max_rate": max_rate},
        )

    def _equalized_odds(self, groups: list[GroupStats]) -> MetricResult:
        """Max difference in TPR and FPR across groups."""
        with_odds = [g for g in groups if g.tpr is not None and g.fpr is not None]
        if len(with_odds) < 2:
            return MetricResult("equalized_odds_difference", 0.0, self.fairness_threshold, True, "OK", "Need ground truth")
        tpr_diff = max(g.tpr for g in with_odds) - min(g.tpr for g in with_odds)
        fpr_diff = max(g.fpr for g in with_odds) - min(g.fpr for g in with_odds)
        diff = max(tpr_diff, fpr_diff)
        passed = diff <= self.fairness_threshold
        severity = self._severity(diff, self.fairness_threshold, [0.05, 0.10, 0.20])
        return MetricResult(
            metric="equalized_odds_difference",
            value=round(diff, 4),
            threshold=self.fairness_threshold,
            passed=passed,
            severity=severity,
            interpretation=(
                f"TPR differs by {tpr_diff:.1%}, FPR by {fpr_diff:.1%}. "
                + ("Equal error rates across groups." if passed else "Unequal error rates — some groups misclassified more.")
            ),
            details={"tpr_difference": tpr_diff, "fpr_difference": fpr_diff},
        )

    def _equal_opportunity(self, groups: list[GroupStats]) -> MetricResult:
        """TPR equality — qualified individuals get equal positive prediction rates."""
        with_tpr = [g for g in groups if g.tpr is not None]
        if len(with_tpr) < 2:
            return MetricResult("equal_opportunity_difference", 0.0, self.fairness_threshold, True, "OK", "Need ground truth")
        diff = max(g.tpr for g in with_tpr) - min(g.tpr for g in with_tpr)
        passed = diff <= self.fairness_threshold
        severity = self._severity(diff, self.fairness_threshold, [0.05, 0.10, 0.20])
        return MetricResult(
            metric="equal_opportunity_difference",
            value=round(diff, 4),
            threshold=self.fairness_threshold,
            passed=passed,
            severity=severity,
            interpretation=(
                f"Qualified-individual acceptance varies by {diff:.1%} across groups. "
                + ("Equal opportunity for qualified individuals." if passed else "Qualified individuals in some groups are under-selected.")
            ),
        )

    def _statistical_significance(self, df: pd.DataFrame, attr: str, decision_col: str) -> MetricResult:
        """Chi-squared test — is the bias statistically significant or chance?"""
        try:
            contingency = pd.crosstab(df[attr], df[decision_col])
            if contingency.shape[0] < 2 or contingency.shape[1] < 2:
                return MetricResult("chi_squared_test", 1.0, 0.05, True, "OK", "Insufficient data")
            chi2, p_value, dof, _ = stats.chi2_contingency(contingency)
            passed = p_value > 0.05
            severity = "OK" if passed else ("CRITICAL" if p_value < 0.001 else "HIGH")
            return MetricResult(
                metric="chi_squared_test",
                value=round(float(p_value), 6),
                threshold=0.05,
                passed=passed,
                severity=severity,
                interpretation=(
                    f"Chi² = {chi2:.2f}, p = {p_value:.4f}. "
                    + ("Differences could be due to chance (not statistically significant)." if passed
                       else f"Differences are statistically significant (p<{p_value:.4f}). Bias is real, not random.")
                ),
                details={"chi_squared": float(chi2), "p_value": float(p_value), "degrees_of_freedom": int(dof)},
            )
        except Exception as e:
            return MetricResult("chi_squared_test", 1.0, 0.05, True, "OK", f"Could not compute: {e}")

    def _intersectional_analysis(
        self, df: pd.DataFrame, protected_attrs: list[str], decision_col: str
    ) -> dict[str, Any]:
        """Look at intersections: e.g., Black women vs White men."""
        if len(protected_attrs) < 2:
            return {}
        combos = protected_attrs[:2]  # Pairwise for performance
        df["_intersect"] = df[combos[0]].astype(str) + "/" + df[combos[1]].astype(str)
        group_rates = df.groupby("_intersect")[decision_col].agg(["mean", "count"]).reset_index()
        group_rates.columns = ["group", "acceptance_rate", "n"]

        max_row = group_rates.loc[group_rates["acceptance_rate"].idxmax()]
        min_row = group_rates.loc[group_rates["acceptance_rate"].idxmin()]
        diff = float(max_row["acceptance_rate"] - min_row["acceptance_rate"])
        df.drop(columns=["_intersect"], inplace=True)

        return {
            "dimensions": combos,
            "groups": group_rates.to_dict(orient="records"),
            "max_gap": {
                "difference": round(diff, 4),
                "most_favored": str(max_row["group"]),
                "most_favored_rate": float(max_row["acceptance_rate"]),
                "least_favored": str(min_row["group"]),
                "least_favored_rate": float(min_row["acceptance_rate"]),
            },
            "interpretation": (
                f"Intersectional gap: '{max_row['group']}' accepted at {max_row['acceptance_rate']:.1%} "
                f"vs '{min_row['group']}' at {min_row['acceptance_rate']:.1%} (gap: {diff:.1%}). "
                "Intersectional bias often hides behind aggregate metrics."
            ),
        }

    def _detect_proxies(
        self, df: pd.DataFrame, protected_attrs: list[str], decision_col: str
    ) -> dict[str, Any]:
        """Detect features correlated with protected attributes (proxies for race/gender)."""
        proxies = []
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        numeric_cols = [c for c in numeric_cols if c not in (decision_col, "score")]

        for attr in protected_attrs:
            if attr not in df.columns:
                continue
            encoded = pd.Categorical(df[attr]).codes
            for col in numeric_cols:
                try:
                    corr, _ = stats.spearmanr(encoded, df[col])
                    if abs(corr) > 0.5:
                        proxies.append({
                            "feature": col,
                            "proxy_for": attr,
                            "correlation": round(float(corr), 3),
                            "severity": "HIGH" if abs(corr) > 0.7 else "MEDIUM",
                            "interpretation": (
                                f"Feature '{col}' has {abs(corr):.0%} correlation with '{attr}'. "
                                "Using this feature may act as a proxy for protected attribute."
                            ),
                        })
                except Exception:
                    continue

        return {
            "proxies_detected": len(proxies),
            "details": proxies,
            "recommendation": (
                "Remove or transform high-correlation features, or apply fairness-aware learning."
                if proxies else "No obvious proxy features detected."
            ),
        }

    def _summarize(self, results: dict) -> dict:
        total_metrics = 0
        failed = 0
        critical = 0
        high = 0
        medium = 0

        for attr, metrics in results["metrics"].items():
            for m in metrics:
                total_metrics += 1
                if not m["passed"]:
                    failed += 1
                sev = m["severity"]
                if sev == "CRITICAL":
                    critical += 1
                elif sev == "HIGH":
                    high += 1
                elif sev == "MEDIUM":
                    medium += 1

        if critical > 0:
            risk_level = "CRITICAL"
        elif high > 0:
            risk_level = "HIGH"
        elif medium > 0:
            risk_level = "MEDIUM"
        elif failed > 0:
            risk_level = "LOW"
        else:
            risk_level = "COMPLIANT"

        return {
            "risk_level": risk_level,
            "total_metrics_evaluated": total_metrics,
            "metrics_failed": failed,
            "critical_findings": critical,
            "high_findings": high,
            "medium_findings": medium,
            "proxies_detected": results.get("proxy_detection", {}).get("proxies_detected", 0),
            "fairness_score": round(max(0.0, 1.0 - (critical * 0.3 + high * 0.15 + medium * 0.05)), 3),
        }

    @staticmethod
    def _severity(value: float, threshold: float, bins: list[float]) -> str:
        if value <= bins[0]:
            return "OK"
        if value <= bins[1]:
            return "MEDIUM"
        if value <= bins[2]:
            return "HIGH"
        return "CRITICAL"
