# lumis-audit

> The plug-and-play AI bias auditing SDK.

## Install

```bash
pip install lumis-audit
```

## Quick start

```python
from lumis import LumisAudit

auditor = LumisAudit(api_key="lm_sk_...", base_url="http://localhost:5002")

report = auditor.audit_endpoint(
    url="https://your-ai.com/predict",
    domain="hiring",
    sample_size=1000,
    protected_attributes=["gender", "race", "age_group"],
    compliance_frameworks=["EU_AI_ACT", "EEOC"],
    on_progress=lambda state, p, msg: print(f"[{state}] {p:.0%} {msg}"),
)

print(report.summary())

if not report.passed:
    print("\nRECOMMENDATIONS:")
    for rec in report.recommendations():
        print(f"  [{rec['priority']}] {rec['title']}")

report.save_pdf("audit_report.pdf")
```

## Audit your own callable

```python
def my_hiring_model(applicant: dict) -> dict:
    return {"decision": 1, "score": 0.87}

# Wrap with monitor decorator (continuous monitoring)
from lumis import monitor
@monitor(auditor)
def my_hiring_model(applicant): ...
```

## Domains supported

- `hiring` — job applicant screening
- `lending` — loan / credit approval
- `medical` — patient triage
- `housing` — rental approval
- `insurance` — insurance pricing

## Compliance frameworks

- `EU_AI_ACT` — EU AI Act Article 10 / 13
- `EEOC` — US EEOC 4/5ths rule
- `ECOA` — Equal Credit Opportunity Act
- `GDPR` — Article 22 (automated decisions)
