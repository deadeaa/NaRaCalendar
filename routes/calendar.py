from flask import Blueprint, render_template

calendar_bp = Blueprint('calendar', __name__)

@calendar_bp.route("/calendar")
def calendar_page():
    return render_template("calendar.html")