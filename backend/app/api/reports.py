"""Report generation endpoints — markdown and PDF."""
from flask import Blueprint, jsonify, request, Response, send_file
import io

from app.services.audit_orchestrator import orchestrator
from app.services.report_generator import ReportGenerator

reports_bp = Blueprint("reports", __name__)


@reports_bp.route("/<audit_id>/markdown", methods=["GET"])
def get_markdown(audit_id: str):
    results = orchestrator.get_results(audit_id)
    if not results:
        return jsonify({"error": "audit not complete"}), 404
    md = ReportGenerator().to_markdown(results)
    return Response(md, mimetype="text/markdown")


@reports_bp.route("/<audit_id>/pdf", methods=["GET"])
def get_pdf(audit_id: str):
    results = orchestrator.get_results(audit_id)
    if not results:
        return jsonify({"error": "audit not complete"}), 404
    pdf_bytes = ReportGenerator().to_pdf(results)
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"lumis_audit_{audit_id}.pdf",
    )
