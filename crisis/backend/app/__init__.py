"""LUMIS Crisis Flask app."""
from flask import Flask, jsonify
from flask_cors import CORS


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from app.api.crisis import crisis_bp
    from app.api.venue import venue_bp
    from app.api.events import events_bp

    app.register_blueprint(crisis_bp, url_prefix="/api/crisis")
    app.register_blueprint(venue_bp, url_prefix="/api/venue")
    app.register_blueprint(events_bp, url_prefix="/api/events")

    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "service": "lumis-crisis"})

    @app.route("/")
    def root():
        return jsonify({
            "name": "LUMIS Crisis API",
            "tagline": "Coordinated emergency response for hospitality.",
            "endpoints": ["/api/crisis", "/api/venue", "/api/events"],
        })

    return app
