from flask import Blueprint, render_template

health_bp = Blueprint('health', __name__)

@health_bp.route("/health")
def health():
    return render_template("health.html")