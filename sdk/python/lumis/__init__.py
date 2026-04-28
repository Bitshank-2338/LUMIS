"""
LUMIS Audit SDK.

The plug-and-play AI bias auditing SDK. Audit any AI model with a few lines of code.

Quick start:
    from lumis import LumisAudit

    auditor = LumisAudit(api_key="lm_sk_...")
    report = auditor.audit_endpoint(
        url="https://your-ai.com/predict",
        domain="hiring",
        sample_size=1000,
    )
    report.save_pdf("audit.pdf")
    print(report.summary())
"""
from .client import LumisAudit, AuditReport
from .wrappers import monitor

__version__ = "0.1.0"
__all__ = ["LumisAudit", "AuditReport", "monitor"]
