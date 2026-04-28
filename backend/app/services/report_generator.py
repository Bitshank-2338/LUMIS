"""
LUMIS Report Generator — Professional PDF + Markdown audit reports.

PDF features:
  • Dark branded cover page with risk-level badge
  • 8-tile KPI scorecard
  • Animated fairness-score progress bar
  • Full compliance framework table
  • Per-attribute metric tables with "What It Measures" column
  • Interpretation callout boxes (colour-coded by severity)
  • Intersectional analysis section
  • Proxy feature detection table + warning alert
  • Priority-coded recommendation cards
  • Page footer on every page (page number + branding)
"""
from __future__ import annotations

import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether,
)

# ── Brand palette ──────────────────────────────────────────────────────────────
_C = {
    "dark":        HexColor("#0F172A"),
    "dark2":       HexColor("#1E293B"),
    "dark3":       HexColor("#334155"),
    "accent":      HexColor("#6366F1"),
    "acc_light":   HexColor("#A5B4FC"),
    "success":     HexColor("#16A34A"),
    "suc_bg":      HexColor("#F0FDF4"),
    "danger":      HexColor("#DC2626"),
    "dan_bg":      HexColor("#FEF2F2"),
    "warning":     HexColor("#D97706"),
    "war_bg":      HexColor("#FFFBEB"),
    "orange":      HexColor("#EA580C"),
    "ora_bg":      HexColor("#FFF7ED"),
    "slate50":     HexColor("#F8FAFC"),
    "slate100":    HexColor("#F1F5F9"),
    "slate200":    HexColor("#E2E8F0"),
    "slate300":    HexColor("#CBD5E1"),
    "slate400":    HexColor("#94A3B8"),
    "slate500":    HexColor("#64748B"),
    "slate700":    HexColor("#334155"),
    "white":       white,
}

# Hex strings for use inside Paragraph markup (avoids .hexval() calls)
_H = {
    "CRITICAL":      "#DC2626",
    "HIGH":          "#EA580C",
    "MEDIUM":        "#D97706",
    "LOW":           "#65A30D",
    "OK":            "#16A34A",
    "COMPLIANT":     "#16A34A",
    "NON_COMPLIANT": "#DC2626",
    "accent":        "#6366F1",
    "slate500":      "#64748B",
    "dark3":         "#334155",
    "white":         "#FFFFFF",
    "success":       "#16A34A",
    "danger":        "#DC2626",
    "warning":       "#D97706",
}

SEV_C = {
    "CRITICAL":      _C["danger"],
    "HIGH":          _C["orange"],
    "MEDIUM":        _C["warning"],
    "LOW":           HexColor("#65A30D"),
    "OK":            _C["success"],
    "COMPLIANT":     _C["success"],
    "NON_COMPLIANT": _C["danger"],
}

SEV_BG = {
    "CRITICAL":      _C["dan_bg"],
    "HIGH":          _C["ora_bg"],
    "MEDIUM":        _C["war_bg"],
    "LOW":           HexColor("#F7FEE7"),
    "OK":            _C["suc_bg"],
    "COMPLIANT":     _C["suc_bg"],
    "NON_COMPLIANT": _C["dan_bg"],
}

METRIC_LABEL = {
    "demographic_parity_difference": "Demographic Parity",
    "disparate_impact_ratio":        "Disparate Impact Ratio",
    "chi_squared_test":              "Chi-Squared Test",
    "equalized_odds_difference":     "Equalized Odds",
    "equal_opportunity_difference":  "Equal Opportunity",
}

METRIC_WHAT = {
    "demographic_parity_difference": (
        "Do all groups receive positive outcomes at the same rate? "
        "A value of 0 = perfect parity."
    ),
    "disparate_impact_ratio": (
        "Ratio of acceptance rates (lowest / highest group). "
        "EEOC 4/5ths rule requires ≥0.80."
    ),
    "chi_squared_test": (
        "Is the observed disparity statistically real or just chance? "
        "p>0.05 = could be random."
    ),
    "equalized_odds_difference": (
        "Model must have equal true-positive AND false-positive rates "
        "across all demographic groups."
    ),
    "equal_opportunity_difference": (
        "Qualified individuals must be approved at equal rates regardless "
        "of their demographic group."
    ),
}


# ── Helper builders ────────────────────────────────────────────────────────────

def _p(text: str, **kwargs) -> Paragraph:
    """Shorthand Paragraph with a one-off ParagraphStyle."""
    style = ParagraphStyle("_", **kwargs)
    return Paragraph(text, style)


def _section_band(title: str, cw: float) -> Table:
    """Full-width indigo section header band."""
    t = Table([[_p(title, fontName="Helvetica-Bold", fontSize=13,
                   textColor=_C["white"], leading=16)]],
              colWidths=[cw])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), _C["accent"]),
        ("LEFTPADDING",   (0,0), (-1,-1), 14),
        ("RIGHTPADDING",  (0,0), (-1,-1), 14),
        ("TOPPADDING",    (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
    ]))
    return t


def _attr_band(title: str, cw: float) -> Table:
    """Per-attribute sub-header."""
    t = Table([[_p(f"●  {title}", fontName="Helvetica-Bold", fontSize=11,
                   textColor=_C["accent"], leading=14)]],
              colWidths=[cw])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), _C["slate50"]),
        ("LEFTPADDING",   (0,0), (-1,-1), 12),
        ("TOPPADDING",    (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LINEBELOW",     (0,0), (-1,-1), 2, _C["accent"]),
    ]))
    return t


def _callout(text: str, bg: HexColor, border: HexColor, cw: float) -> Table:
    """Left-bordered callout box."""
    inner = cw - 0.3 * inch
    t = Table([[_p(text, fontSize=8.5, leading=12, textColor=_C["dark3"])]],
              colWidths=[inner])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), bg),
        ("LEFTPADDING",   (0,0), (-1,-1), 12),
        ("RIGHTPADDING",  (0,0), (-1,-1), 10),
        ("TOPPADDING",    (0,0), (-1,-1), 7),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ("LINEBEFORE",    (0,0), (0,-1), 4, border),
    ]))
    return t


def _score_bar(score: float, cw: float) -> Table:
    """Horizontal progress bar for fairness score."""
    bar_c = _C["success"] if score >= 0.8 else _C["warning"] if score >= 0.6 else _C["danger"]
    filled = max(0.5, score * cw)
    empty  = max(0.5, cw - filled)
    t = Table([["", ""]], colWidths=[filled, empty])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (0,0), bar_c),
        ("BACKGROUND",    (1,0), (1,0), _C["slate200"]),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("RIGHTPADDING",  (0,0), (-1,-1), 0),
        ("TOPPADDING",    (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ("ROWHEIGHT",     (0,0), (-1,-1), 14),
    ]))
    return t


def _kpi_row(cards: list[tuple], cw: float) -> Table:
    """
    Render a row of KPI tiles.
    cards = [(label, value, value_hex_colour, bg_HexColor), ...]
    """
    n = len(cards)
    gap = 0.06 * inch
    tile_w = (cw - gap * (n - 1)) / n

    cells = []
    widths = []
    for i, (label, value, val_hex, bg) in enumerate(cards):
        tile = Table(
            [
                [_p(value, fontName="Helvetica-Bold", fontSize=20,
                    textColor=HexColor(val_hex), leading=24)],
                [_p(label, fontSize=7.5, textColor=_C["slate500"], leading=10)],
            ],
            colWidths=[tile_w],
        )
        tile.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), bg),
            ("LEFTPADDING",   (0,0), (-1,-1), 12),
            ("RIGHTPADDING",  (0,0), (-1,-1), 12),
            ("TOPPADDING",    (0,0), (0,0),   14),
            ("BOTTOMPADDING", (0,0), (0,0),   2),
            ("TOPPADDING",    (0,1), (0,1),   3),
            ("BOTTOMPADDING", (0,1), (0,1),   14),
            ("LINEABOVE",     (0,0), (-1,0),  2, HexColor(val_hex)),
        ]))
        cells.append(tile)
        widths.append(tile_w)
        if i < n - 1:
            cells.append(Spacer(gap, 1))
            widths.append(gap)

    row = Table([cells], colWidths=widths)
    row.setStyle(TableStyle([
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("RIGHTPADDING",  (0,0), (-1,-1), 0),
        ("TOPPADDING",    (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
    ]))
    return row


def _fmt_date(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%B %d, %Y  •  %H:%M UTC")
    except Exception:
        return iso


def _draw_footer(canvas, doc):
    """Page footer: branding left, page number right."""
    canvas.saveState()
    canvas.setFillColor(_C["slate400"])
    canvas.setFont("Helvetica", 7)
    canvas.drawString(0.75 * inch, 0.42 * inch,
                      "LUMIS — AI Bias Audit Report  •  CONFIDENTIAL")
    canvas.drawRightString(letter[0] - 0.75 * inch, 0.42 * inch,
                           f"Page {doc.page}")
    canvas.setStrokeColor(_C["slate200"])
    canvas.setLineWidth(0.4)
    canvas.line(0.75 * inch, 0.58 * inch,
                letter[0] - 0.75 * inch, 0.58 * inch)
    canvas.restoreState()


# ── Main class ─────────────────────────────────────────────────────────────────

class ReportGenerator:
    """Generates markdown and PDF compliance audit reports."""

    _PAGE_W, _PAGE_H = letter
    _MARGIN = 0.75 * inch
    _CW = _PAGE_W - 2 * _MARGIN          # content width ≈ 7 in = 504 pt

    # ── Markdown ──────────────────────────────────────────────────────────────

    def to_markdown(self, results: dict) -> str:
        cfg = results["config"]
        summary = results["summary"]
        lines = ["# LUMIS AI Bias Audit Report", ""]
        lines += [
            f"**Audit ID:** `{results['audit_id']}`",
            f"**Domain:** {cfg['domain'].title()}",
            f"**Model Endpoint:** `{cfg.get('model_endpoint', 'N/A')}`",
            f"**Sample Size:** {results['execution']['profiles_generated']:,} synthetic profiles",
            f"**Generated:** {_fmt_date(results['completed_at'])}",
            "", "---", "",
            "## Executive Summary", "",
            f"- **Risk Level:** {summary['risk_level']}",
            f"- **Fairness Score:** {summary['fairness_score']} / 1.000",
            f"- **Metrics Failed:** {summary['metrics_failed']} / {summary['total_metrics_evaluated']}",
            f"- **Critical Findings:** {summary['critical_findings']}",
            f"- **High-Severity Findings:** {summary['high_findings']}",
            f"- **Proxy Features Detected:** {summary['proxies_detected']}", "",
        ]

        lines += ["## Compliance Status", ""]
        for fw_key, fw in results.get("compliance", {}).items():
            badge = "PASS" if fw["status"] == "COMPLIANT" else "FAIL"
            lines += [f"### {fw['framework']}",
                      f"**Status:** {badge} — `{fw['status']}`"]
            if fw["failed_metrics"]:
                lines.append("**Failed metrics:**")
                for fm in fw["failed_metrics"]:
                    lines.append(f"- `{fm['metric']}` on `{fm['attribute']}` (value: {fm['value']})")
            lines.append("")

        lines += ["## Detailed Findings", ""]
        for attr, metrics in results["metrics"].items():
            lines += [f"### Protected Attribute: `{attr}`", "",
                      "| Metric | Value | Threshold | Status | Severity |",
                      "|---|---|---|---|---|"]
            for m in metrics:
                lines.append(f"| {m['metric']} | {m['value']} | {m['threshold']} "
                              f"| {'PASS' if m['passed'] else 'FAIL'} | {m['severity']} |")
            lines.append("")
            for m in metrics:
                lines.append(f"- **{m['metric']}**: {m['interpretation']}")
            lines.append("")

        if results.get("intersectional"):
            lines += ["## Intersectional Analysis", "",
                      results["intersectional"].get("interpretation", ""), ""]

        proxy = results.get("proxy_detection", {})
        if proxy.get("proxies_detected", 0) > 0:
            lines += ["## Proxy Feature Detection", ""]
            for p in proxy["details"]:
                lines.append(f"- **{p['feature']}** ({p['correlation']}) → `{p['proxy_for']}`: "
                              f"{p['interpretation']}")
            lines.append("")

        lines += ["## Recommendations", ""]
        for i, rec in enumerate(results.get("recommendations", []), 1):
            lines += [f"### {i}. [{rec['priority']}] {rec['title']}"]
            for act in rec["actions"]:
                lines.append(f"- {act}")
            lines.append("")

        lines += ["---", "",
                  "*Generated by LUMIS — Large Unified Model Inspection System*",
                  "*Powered by MiroFish synthetic-population simulation engine*"]
        return "\n".join(lines)

    # ── PDF ───────────────────────────────────────────────────────────────────

    def to_pdf(self, results: dict) -> bytes:
        buf = io.BytesIO()
        CW = self._CW

        doc = SimpleDocTemplate(
            buf, pagesize=letter,
            leftMargin=self._MARGIN, rightMargin=self._MARGIN,
            topMargin=self._MARGIN, bottomMargin=self._MARGIN,
        )

        cfg     = results["config"]
        summary = results["summary"]
        story: list = []

        risk     = summary["risk_level"]
        risk_hex = _H.get(risk, "#64748B")
        risk_c   = SEV_C.get(risk, _C["slate500"])
        risk_bg  = SEV_BG.get(risk, _C["slate100"])

        # ── COVER PAGE ────────────────────────────────────────────────────────

        # Dark header block
        cover_header = Table(
            [
                [_p("LUMIS", fontName="Helvetica-Bold", fontSize=12,
                    textColor=_C["acc_light"], leading=16)],
                [_p("AI Bias Audit Report",
                    fontName="Helvetica-Bold", fontSize=34,
                    textColor=_C["white"], leading=40)],
                [_p("Powered by MiroFish Synthetic-Population Simulation Engine",
                    fontSize=10, textColor=_C["slate400"], leading=14)],
                [_p("&nbsp;", fontSize=4)],
            ],
            colWidths=[CW],
        )
        cover_header.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), _C["dark"]),
            ("LEFTPADDING",   (0,0), (-1,-1), 28),
            ("RIGHTPADDING",  (0,0), (-1,-1), 28),
            ("TOPPADDING",    (0,0), (0,0),   28),
            ("TOPPADDING",    (0,1), (0,1),   4),
            ("TOPPADDING",    (0,2), (0,2),   6),
            ("BOTTOMPADDING", (0,-1),(-1,-1), 20),
        ]))
        story.append(cover_header)

        # Risk badge
        risk_badge = Table(
            [[_p(f"&nbsp; RISK LEVEL:  {risk} &nbsp;",
                 fontName="Helvetica-Bold", fontSize=15,
                 textColor=_C["white"], leading=20)]],
            colWidths=[CW],
        )
        risk_badge.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), risk_c),
            ("LEFTPADDING",   (0,0), (-1,-1), 28),
            ("TOPPADDING",    (0,0), (-1,-1), 13),
            ("BOTTOMPADDING", (0,0), (-1,-1), 13),
        ]))
        story.append(risk_badge)

        # Metadata block on dark-2 background
        def _meta_lbl(t): return _p(t, fontSize=7, fontName="Helvetica-Bold",
                                     textColor=_C["slate500"])
        def _meta_val(t, bold=False):
            fn = "Helvetica-Bold" if bold else "Helvetica"
            return _p(t, fontSize=9, fontName=fn, textColor=_C["slate300"])

        meta_rows = [
            [_meta_lbl("AUDIT ID"),    _meta_val(results["audit_id"])],
            [_meta_lbl("DOMAIN"),      _meta_val(cfg["domain"].upper(), bold=True)],
            [_meta_lbl("MODEL"),       _meta_val(str(cfg.get("model_endpoint", "N/A")))],
            [_meta_lbl("POPULATION"),  _meta_val(f"{results['execution']['profiles_generated']:,} synthetic profiles", bold=True)],
            [_meta_lbl("GENERATED"),   _meta_val(_fmt_date(results["completed_at"]))],
        ]
        meta_tbl = Table(meta_rows, colWidths=[1.1 * inch, CW - 1.1 * inch])
        meta_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), _C["dark2"]),
            ("LEFTPADDING",   (0,0), (0,-1),  28),
            ("LEFTPADDING",   (1,0), (1,-1),  14),
            ("RIGHTPADDING",  (0,0), (-1,-1), 28),
            ("TOPPADDING",    (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("LINEBEFORE",    (1,0), (1,-1),  0.5, _C["dark3"]),
            ("LINEBELOW",     (0,-1),(-1,-1), 0.5, _C["dark3"]),
        ]))
        story.append(meta_tbl)
        story.append(PageBreak())

        # ── EXECUTIVE SUMMARY ─────────────────────────────────────────────────
        story.append(_section_band("Executive Summary", CW))
        story.append(Spacer(1, 0.14 * inch))

        score_f     = float(summary["fairness_score"])
        score_pct   = f"{score_f * 100:.0f}%"
        pass_txt    = f"{summary['total_metrics_evaluated'] - summary['metrics_failed']}/{summary['total_metrics_evaluated']}"
        crit_n      = summary["critical_findings"]
        high_n      = summary["high_findings"]
        med_n       = summary.get("medium_findings", 0)
        proxy_n     = summary["proxies_detected"]
        groups_n    = len(results.get("metrics", {}))

        score_hex   = _H["success"] if score_f >= 0.8 else _H["warning"] if score_f >= 0.6 else _H["danger"]
        score_bg    = _C["suc_bg"]  if score_f >= 0.8 else _C["war_bg"]  if score_f >= 0.6 else _C["dan_bg"]

        story.append(_kpi_row([
            ("Overall Risk Level",  risk,       risk_hex,        risk_bg),
            ("Fairness Score",      score_pct,  score_hex,       score_bg),
            ("Metrics Passed",      pass_txt,
             _H["success"] if summary["metrics_failed"] == 0 else _H["warning"],
             _C["suc_bg"] if summary["metrics_failed"] == 0 else _C["war_bg"]),
            ("Critical Issues",     str(crit_n),
             _H["danger"] if crit_n > 0 else _H["success"],
             _C["dan_bg"] if crit_n > 0 else _C["suc_bg"]),
        ], CW))
        story.append(Spacer(1, 0.1 * inch))
        story.append(_kpi_row([
            ("High-Severity Issues", str(high_n),
             _H["HIGH"] if high_n > 0 else _H["success"],
             _C["ora_bg"] if high_n > 0 else _C["suc_bg"]),
            ("Medium Issues",        str(med_n),
             _H["MEDIUM"] if med_n > 0 else _H["success"],
             _C["war_bg"] if med_n > 0 else _C["suc_bg"]),
            ("Proxy Features",       str(proxy_n),
             _H["warning"] if proxy_n > 0 else _H["success"],
             _C["war_bg"] if proxy_n > 0 else _C["suc_bg"]),
            ("Protected Groups",     str(groups_n), _H["accent"], _C["slate100"]),
        ], CW))
        story.append(Spacer(1, 0.18 * inch))

        # Fairness score bar
        story.append(Table(
            [[_p("<b>Fairness Score</b>", fontSize=9, textColor=_C["dark3"]),
              _p(f"{score_f:.3f} / 1.000",  fontSize=9, textColor=_C["slate500"])]],
            colWidths=[2 * inch, CW - 2 * inch],
        ))
        story.append(Spacer(1, 0.04 * inch))
        story.append(_score_bar(score_f, CW))
        story.append(Spacer(1, 0.07 * inch))

        if score_f >= 0.8:
            bar_msg = ("✓  Fairness score is within the acceptable range (≥0.80). "
                       "This model demonstrates equitable decision-making across audited groups.")
            bar_bg, bar_border = _C["suc_bg"], _C["success"]
        elif score_f >= 0.6:
            bar_msg = ("⚠  Fairness score is below the recommended threshold. "
                       "Review all failing metrics and apply corrective measures before deployment.")
            bar_bg, bar_border = _C["war_bg"], _C["warning"]
        else:
            bar_msg = ("✗  Fairness score is critically low. "
                       "Immediate remediation is required. Do NOT deploy this model to production.")
            bar_bg, bar_border = _C["dan_bg"], _C["danger"]
        story.append(_callout(bar_msg, bar_bg, bar_border, CW))
        story.append(Spacer(1, 0.22 * inch))

        # ── COMPLIANCE STATUS ─────────────────────────────────────────────────
        story.append(_section_band("Compliance Status", CW))
        story.append(Spacer(1, 0.12 * inch))
        story.append(_p(
            "The following regulatory frameworks were evaluated against the audit findings.",
            fontSize=9, textColor=_C["slate500"], leading=13,
        ))
        story.append(Spacer(1, 0.1 * inch))

        compliance = results.get("compliance", {})
        if compliance:
            hdr_style = dict(fontName="Helvetica-Bold", fontSize=9,
                             textColor=_C["white"], leading=12)
            comp_rows = [[
                _p("Framework",       **hdr_style),
                _p("Status",          **hdr_style),
                _p("Metrics Checked", **hdr_style),
                _p("Failed",          **hdr_style),
            ]]
            for fw_key, fw in compliance.items():
                sh = _H.get(fw["status"], "#64748B")
                comp_rows.append([
                    _p(fw["framework"], fontSize=8.5, textColor=_C["dark3"]),
                    _p(f'<font color="{sh}"><b>{fw["status"]}</b></font>',
                       fontSize=8.5, textColor=_C["dark3"]),
                    _p(str(len(fw["checked_metrics"])),
                       fontSize=8.5, textColor=_C["slate500"]),
                    _p(str(len(fw["failed_metrics"])),
                       fontSize=8.5,
                       textColor=_C["danger"] if fw["failed_metrics"] else _C["success"]),
                ])
            comp_tbl = Table(comp_rows, colWidths=[3.0*inch, 1.4*inch, 1.3*inch, 1.1*inch])
            comp_style_cmds = [
                ("BACKGROUND",    (0,0), (-1,0),   _C["dark2"]),
                ("GRID",          (0,0), (-1,-1),  0.5, _C["slate200"]),
                ("VALIGN",        (0,0), (-1,-1),  "MIDDLE"),
                ("LEFTPADDING",   (0,0), (-1,-1),  10),
                ("RIGHTPADDING",  (0,0), (-1,-1),  10),
                ("TOPPADDING",    (0,0), (-1,-1),  8),
                ("BOTTOMPADDING", (0,0), (-1,-1),  8),
            ]
            for i, (fw_key, fw) in enumerate(compliance.items(), 1):
                bg = _C["dan_bg"] if fw["status"] == "NON_COMPLIANT" else _C["suc_bg"]
                comp_style_cmds.append(("BACKGROUND", (0,i), (-1,i), bg))
            comp_tbl.setStyle(TableStyle(comp_style_cmds))
            story.append(comp_tbl)

            for fw_key, fw in compliance.items():
                if fw["failed_metrics"]:
                    story.append(Spacer(1, 0.08 * inch))
                    lines = f"<b>{fw['framework']} — Failed Metrics:</b><br/>"
                    for fm in fw["failed_metrics"]:
                        lines += (f"&nbsp;&nbsp;&rarr; <i>{fm['metric']}</i> "
                                  f"on <b>{fm['attribute']}</b> &nbsp;(value: {fm['value']})<br/>")
                    story.append(_callout(lines, _C["dan_bg"], _C["danger"], CW))

        story.append(PageBreak())

        # ── DETAILED FINDINGS ─────────────────────────────────────────────────
        story.append(_section_band("Detailed Findings by Protected Attribute", CW))
        story.append(Spacer(1, 0.06 * inch))
        story.append(_p(
            "Each protected attribute is evaluated against 3–5 fairness metrics. "
            "<b>PASS</b> means the model is within the acceptable threshold for that metric. "
            "<b>FAIL</b> means remediation may be required.",
            fontSize=8.5, textColor=_C["slate500"], leading=13,
        ))
        story.append(Spacer(1, 0.14 * inch))

        attrs = list(results["metrics"].items())
        for idx, (attr, metrics) in enumerate(attrs):
            attr_title = attr.replace("_", " ").title()
            block = [_attr_band(attr_title, CW), Spacer(1, 0.08 * inch)]

            # Metric table
            th = dict(fontName="Helvetica-Bold", fontSize=8.5,
                      textColor=_C["white"], leading=11)
            tbl_rows = [[
                _p("Metric",          **th),
                _p("What It Measures",**th),
                _p("Value",           **th),
                _p("Threshold",       **th),
                _p("Status",          **th),
                _p("Severity",        **th),
            ]]
            tbl_cmds = [
                ("BACKGROUND",    (0,0), (-1,0),  _C["dark2"]),
                ("GRID",          (0,0), (-1,-1), 0.5, _C["slate200"]),
                ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
                ("LEFTPADDING",   (0,0), (-1,-1), 7),
                ("RIGHTPADDING",  (0,0), (-1,-1), 7),
                ("TOPPADDING",    (0,0), (-1,-1), 7),
                ("BOTTOMPADDING", (0,0), (-1,-1), 7),
            ]
            for ri, m in enumerate(metrics, 1):
                sev      = m["severity"]
                sev_h    = _H.get(sev, "#64748B")
                pass_h   = _H["success"] if m["passed"] else _H["danger"]
                pass_txt = "✓ PASS" if m["passed"] else "✗ FAIL"
                row_bg   = _C["white"] if ri % 2 == 1 else _C["slate50"]
                if not m["passed"]:
                    row_bg = SEV_BG.get(sev, _C["slate100"])
                tbl_cmds.append(("BACKGROUND", (0,ri), (-1,ri), row_bg))
                tbl_rows.append([
                    _p(METRIC_LABEL.get(m["metric"],
                       m["metric"].replace("_"," ").title()),
                       fontName="Helvetica-Bold", fontSize=8.5,
                       textColor=_C["dark3"], leading=11),
                    _p(METRIC_WHAT.get(m["metric"], ""),
                       fontSize=7.5, textColor=_C["slate500"], leading=10),
                    _p(str(m["value"]),  fontSize=8.5, textColor=_C["dark3"]),
                    _p(str(m["threshold"]), fontSize=8.5, textColor=_C["slate500"]),
                    _p(f'<font color="{pass_h}"><b>{pass_txt}</b></font>',
                       fontSize=8.5, textColor=_C["dark3"]),
                    _p(f'<font color="{sev_h}"><b>{sev}</b></font>',
                       fontSize=8.5, textColor=_C["dark3"]),
                ])

            col_w = [1.35*inch, 2.15*inch, 0.65*inch, 0.75*inch, 0.72*inch, 0.86*inch]
            tbl = Table(tbl_rows, colWidths=col_w)
            tbl.setStyle(TableStyle(tbl_cmds))
            block.append(tbl)
            block.append(Spacer(1, 0.07 * inch))

            # Interpretation callouts (skip "Insufficient data")
            for m in metrics:
                interp = m.get("interpretation", "").strip()
                if not interp or "Insufficient data" in interp:
                    continue
                sev    = m["severity"]
                cb_bg  = SEV_BG.get(sev, _C["slate50"]) if not m["passed"] else _C["slate50"]
                cb_bdr = SEV_C.get(sev, _C["slate300"]) if not m["passed"] else _C["slate300"]
                label  = METRIC_LABEL.get(m["metric"], m["metric"])
                block.append(_callout(f"<b>{label}:</b> {interp}", cb_bg, cb_bdr, CW))
                block.append(Spacer(1, 0.025 * inch))

            if idx < len(attrs) - 1:
                block.append(Spacer(1, 0.18 * inch))

            story.append(KeepTogether(block[:4]))   # header + table together
            for item in block[4:]:
                story.append(item)

        # ── INTERSECTIONAL ANALYSIS ───────────────────────────────────────────
        inter = results.get("intersectional", {})
        if inter:
            story.append(PageBreak())
            story.append(_section_band("Intersectional Analysis", CW))
            story.append(Spacer(1, 0.12 * inch))
            story.append(_p(
                "Intersectional analysis examines bias at the <b>intersection</b> of multiple "
                "protected attributes (e.g., Black women vs. White men). Aggregate metrics can "
                "mask discrimination that only emerges at intersections.",
                fontSize=9, leading=14, textColor=_C["dark3"],
            ))
            story.append(Spacer(1, 0.1 * inch))

            mg = inter.get("max_gap", {})
            if mg:
                diff = mg.get("difference", 0)
                gap_bg  = _C["war_bg"]   if diff > 0.1 else _C["slate50"]
                gap_bdr = _C["warning"]  if diff > 0.1 else _C["slate300"]
                gap_txt = (
                    f"<b>Most Favored Group:</b> {mg.get('most_favored','')} "
                    f"({mg.get('most_favored_rate', 0):.1%} acceptance)<br/>"
                    f"<b>Least Favored Group:</b> {mg.get('least_favored','')} "
                    f"({mg.get('least_favored_rate', 0):.1%} acceptance)<br/>"
                    f"<b>Gap:</b> {diff:.1%}"
                )
                story.append(_callout(gap_txt, gap_bg, gap_bdr, CW))
            if inter.get("interpretation"):
                story.append(Spacer(1, 0.08 * inch))
                story.append(_p(inter["interpretation"], fontSize=9,
                                leading=13, textColor=_C["dark3"]))

        # ── PROXY FEATURE DETECTION ───────────────────────────────────────────
        proxy = results.get("proxy_detection", {})
        if proxy.get("proxies_detected", 0) > 0:
            story.append(PageBreak())
            story.append(_section_band("Proxy Feature Detection", CW))
            story.append(Spacer(1, 0.1 * inch))
            story.append(_p(
                "Proxy features are input variables that are <b>not</b> protected attributes "
                "themselves, but are highly correlated with them. Using these features can introduce "
                "<b>indirect discrimination</b> that is harder to detect and may still violate "
                "anti-discrimination law (EU AI Act Art. 13, US EEOC Guidelines).",
                fontSize=9, leading=14, textColor=_C["dark3"],
            ))
            story.append(Spacer(1, 0.1 * inch))

            n = proxy["proxies_detected"]
            story.append(_callout(
                f"<b>⚠ {n} Proxy Feature{'s' if n > 1 else ''} Detected</b><br/>"
                f"These features should be reviewed and potentially removed or transformed "
                f"before production deployment.",
                _C["war_bg"], _C["warning"], CW,
            ))
            story.append(Spacer(1, 0.12 * inch))

            ph = dict(fontName="Helvetica-Bold", fontSize=9,
                      textColor=_C["white"], leading=12)
            proxy_rows = [[
                _p("Feature",               **ph),
                _p("Proxies For",           **ph),
                _p("Correlation",           **ph),
                _p("Risk",                  **ph),
                _p("Action Required",       **ph),
            ]]
            for p in proxy["details"]:
                sev   = p["severity"]
                sh    = _H.get(sev, "#64748B")
                corr  = f"{abs(p['correlation']):.0%}"
                proxy_rows.append([
                    _p(f"<b>{p['feature']}</b>", fontSize=8.5, textColor=_C["dark3"]),
                    _p(p["proxy_for"],            fontSize=8.5, textColor=_C["slate700"]),
                    _p(f'<font color="{sh}"><b>{corr}</b></font>', fontSize=8.5,
                       textColor=_C["dark3"]),
                    _p(f'<font color="{sh}"><b>{sev}</b></font>', fontSize=8.5,
                       textColor=_C["dark3"]),
                    _p("Remove or orthogonalize", fontSize=8, textColor=_C["slate500"]),
                ])
            ptbl = Table(proxy_rows,
                         colWidths=[1.5*inch, 1.4*inch, 1.0*inch, 0.9*inch, 1.9*inch])
            ptbl.setStyle(TableStyle([
                ("BACKGROUND",    (0,0), (-1,0),  _C["dark2"]),
                ("GRID",          (0,0), (-1,-1), 0.5, _C["slate200"]),
                ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
                ("LEFTPADDING",   (0,0), (-1,-1), 9),
                ("RIGHTPADDING",  (0,0), (-1,-1), 9),
                ("TOPPADDING",    (0,0), (-1,-1), 8),
                ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ]))
            for ri in range(1, len(proxy_rows)):
                bg = _C["white"] if ri % 2 == 1 else _C["slate50"]
                ptbl.setStyle(TableStyle([("BACKGROUND", (0,ri), (-1,ri), bg)]))
            story.append(ptbl)
            story.append(Spacer(1, 0.12 * inch))

            for p in proxy["details"]:
                sev = p["severity"]
                story.append(_callout(
                    p["interpretation"],
                    SEV_BG.get(sev, _C["slate100"]),
                    SEV_C.get(sev, _C["slate400"]),
                    CW,
                ))
                story.append(Spacer(1, 0.04 * inch))

        # ── RECOMMENDATIONS ───────────────────────────────────────────────────
        recs = results.get("recommendations", [])
        if recs:
            story.append(PageBreak())
            story.append(_section_band("Recommendations & Remediation Plan", CW))
            story.append(Spacer(1, 0.1 * inch))
            story.append(_p(
                "The following corrective actions are ordered by priority. "
                "<b>CRITICAL</b> and <b>HIGH</b> items must be resolved before "
                "production deployment under EU AI Act Art. 9 and EEOC guidelines.",
                fontSize=9, leading=14, textColor=_C["dark3"],
            ))
            story.append(Spacer(1, 0.15 * inch))

            for i, rec in enumerate(recs, 1):
                pri    = rec["priority"]
                pri_h  = _H.get(pri, "#64748B")
                pri_c  = SEV_C.get(pri, _C["slate500"])
                pri_bg = SEV_BG.get(pri, _C["slate100"])

                card_rows = [[
                    _p(f'<font color="{pri_h}">[{pri}]</font>  <b>{rec["title"]}</b>',
                       fontSize=10, leading=14, textColor=_C["dark"])
                ]]
                for action in rec["actions"]:
                    card_rows.append([
                        _p(f"→ {action}",
                           fontSize=8.5, leading=12,
                           textColor=_C["slate700"], leftIndent=10)
                    ])

                card = Table(card_rows, colWidths=[CW])
                card_cmds = [
                    ("BACKGROUND",    (0,0), (-1,-1), pri_bg),
                    ("BACKGROUND",    (0,0), (0,0),   _C["slate50"]),
                    ("LEFTPADDING",   (0,0), (-1,-1), 14),
                    ("RIGHTPADDING",  (0,0), (-1,-1), 14),
                    ("TOPPADDING",    (0,0), (0,0),   12),
                    ("BOTTOMPADDING", (0,0), (0,0),   8),
                    ("TOPPADDING",    (0,1), (-1,-1), 5),
                    ("BOTTOMPADDING", (0,-1),(-1,-1), 12),
                    ("LINEBEFORE",    (0,0), (0,-1),  4, pri_c),
                    ("LINEABOVE",     (0,0), (-1,0),  0.5, _C["slate200"]),
                    ("LINEBELOW",     (0,-1),(-1,-1), 0.5, _C["slate200"]),
                ]
                card.setStyle(TableStyle(card_cmds))
                story.append(KeepTogether([card, Spacer(1, 0.09 * inch)]))

        # ── REPORT FOOTER NOTE ────────────────────────────────────────────────
        story.append(Spacer(1, 0.3 * inch))
        footer_note = Table(
            [[_p(
                "<b>LUMIS</b> — Large Unified Model Inspection System&nbsp;&nbsp;•"
                "&nbsp;&nbsp;Powered by <b>MiroFish</b> Synthetic-Population Simulation Engine<br/>"
                '<font color="#94A3B8" size="7">'
                "This report is generated from fully synthetic data and is intended for AI compliance "
                "auditing purposes only. All profiles are computer-generated and contain no real "
                "personal information. LUMIS does not store or transmit any personally identifiable "
                "data.</font>",
                fontSize=8, leading=13, textColor=_C["slate500"], alignment=1,
            )]],
            colWidths=[CW],
        )
        footer_note.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), _C["slate50"]),
            ("LEFTPADDING",   (0,0), (-1,-1), 16),
            ("RIGHTPADDING",  (0,0), (-1,-1), 16),
            ("TOPPADDING",    (0,0), (-1,-1), 14),
            ("BOTTOMPADDING", (0,0), (-1,-1), 14),
            ("LINEABOVE",     (0,0), (-1,0),  2, _C["accent"]),
        ]))
        story.append(footer_note)

        doc.build(story,
                  onFirstPage=_draw_footer,
                  onLaterPages=_draw_footer)
        buf.seek(0)
        return buf.read()
