"""End-to-end SDK example — audit the demo biased model."""
from lumis import LumisAudit


def main():
    auditor = LumisAudit(base_url="http://localhost:5002")

    print("Starting audit of mock biased hiring model...\n")
    report = auditor.audit_endpoint(
        url="http://localhost:6001/predict",
        domain="hiring",
        sample_size=500,
        protected_attributes=["gender", "race", "age_group"],
        compliance_frameworks=["EU_AI_ACT", "EEOC"],
        seed=42,
        on_progress=lambda state, p, msg: print(f"  [{state:11s}] {p*100:5.1f}%  {msg}"),
    )

    print()
    print(report.summary())

    print("\nRecommendations:")
    for rec in report.recommendations()[:5]:
        print(f"  [{rec['priority']:8s}] {rec['title']}")

    report.save_pdf("audit_report.pdf")
    print("\nFull PDF report saved to audit_report.pdf")


if __name__ == "__main__":
    main()
