"""LUMIS Flask application factory."""
from flask import Flask, jsonify
from flask_cors import CORS


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from app.api.audit import audit_bp
    from app.api.population import population_bp
    from app.api.reports import reports_bp
    from app.api.chat import chat_bp

    app.register_blueprint(audit_bp, url_prefix="/api/audit")
    app.register_blueprint(population_bp, url_prefix="/api/population")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(chat_bp, url_prefix="/api/audit")

    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "service": "lumis-audit", "version": "0.1.0"})

    @app.route("/")
    def root():
        return jsonify({
            "name": "LUMIS Audit API",
            "tagline": "Every AI decision that affects a human life deserves an audit.",
            "docs": "/api/docs",
            "endpoints": {
                "audit": "/api/audit",
                "population": "/api/population",
                "reports": "/api/reports",
            },
        })

    return app
