from flask import Blueprint, render_template, request, jsonify
from flask_cors import CORS
from deepface import DeepFace
import numpy as np
import json
import cv2
import io
from database.db import get_db

auth_bp = Blueprint("auth", __name__)
CORS(auth_bp)

# PRELOAD MODEL
print(">>> Building Facenet model (this may take some seconds and/or download weights)...")
FACENET_MODEL = DeepFace.build_model("Facenet")
print(">>> Facenet model ready.")

# ROUTES (HTML endpoints - placeholders, templates optional)
@auth_bp.route("/")
def landing():
    # If we have templates, render them; else simple text.
    try:
        return render_template("landing.html")
    except Exception:
        return "<h1>Landing</h1><a href='/signin'>Sign in</a>"

@auth_bp.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@auth_bp.route("/signin")
def signin():
    try:
        return render_template("signin.html")
    except Exception:
        return "<h1>Sign In</h1><a href='/facerec'>Face Login</a>"

@auth_bp.route("/facerec")
def face_rec():
    try:
        return render_template("face_recognition.html")
    except Exception:
        return "<h1>Face Recognition</h1><p>Use POST /api/login-face</p>"

@auth_bp.route("/register-face")
def register_face_page():
    try:
        return render_template("register_face.html")
    except Exception:
        return "<h1>Register Face</h1><p>POST to /api/register-face</p>"

# UTIL: convert uploaded file -> BGR image (cv2)
def file_to_bgr_image(file_storage):
    # file_storage: werkzeug FileStorage
    data = file_storage.read()
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img

# API: register face
@auth_bp.route("/api/register-face", methods=["POST"])
def api_register_face():
    """
    Accepts multipart/form-data:
    - file: image (required)
    - username or user_id (optional). If username exists, updates its face_vector.
    Returns JSON.
    """
    file = request.files.get("file")
    username = request.form.get("username") or request.form.get("user_id") or request.form.get("email")

    if not file:
        return jsonify({"status": "error", "msg": "Image 'file' missing"}), 400

    try:
        # convert to image (BGR)
        img = file_to_bgr_image(file)
        if img is None:
            return jsonify({"status": "error", "msg": "Cannot decode image"}), 400

        # get embedding (pass model to avoid rebuild)
        rep = DeepFace.represent(img_path = img, model_name="Facenet", model=FACENET_MODEL)
        if not rep or len(rep) == 0:
            return jsonify({"status": "error", "msg": "No face detected"}), 400

        embedding = rep[0]["embedding"]  # list of floats

        # save to DB (sqlite)
        conn = get_db()
        cur = conn.cursor()

        if username:
            # insert or update by username
            # Try update first
            cur.execute("SELECT id FROM users WHERE username = ?", (username,))
            row = cur.fetchone()
            if row:
                cur.execute("UPDATE users SET face_vector = ? WHERE id = ?", (json.dumps(embedding), row["id"]))
            else:
                cur.execute("INSERT INTO users (username, face_vector) VALUES (?, ?)", (username, json.dumps(embedding)))
        else:
            # create new anonymous user
            cur.execute("INSERT INTO users (face_vector) VALUES (?)", (json.dumps(embedding),))

        conn.commit()
        return jsonify({"status": "success", "msg": "Face registered"})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500

# API: login-face
@auth_bp.route("/api/login-face", methods=["POST"])
def api_login_face():
    """
    Accepts multipart/form-data:
    - file: image (required)
    Returns JSON { match: True/False, user_id?, username? }
    """
    file = request.files.get("file")
    if not file:
        return jsonify({"match": False, "msg": "Image missing"}), 400

    try:
        img = file_to_bgr_image(file)
        if img is None:
            return jsonify({"match": False, "msg": "Cannot decode image"}), 400

        rep = DeepFace.represent(img_path = img, model_name="Facenet", model=FACENET_MODEL)
        if not rep or len(rep) == 0:
            return jsonify({"match": False, "msg": "No face detected"}), 400

        input_embedding = np.array(rep[0]["embedding"])

        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, username, face_vector FROM users WHERE face_vector IS NOT NULL")
        rows = cur.fetchall()

        THRESHOLD = 8.0  # tuned for Facenet; we can adjust

        for row in rows:
            uid = row["id"]
            username = row["username"]
            fv_text = row["face_vector"]
            try:
                saved = np.array(json.loads(fv_text))
            except Exception:
                continue

            distance = np.linalg.norm(saved - input_embedding)

            if distance < THRESHOLD:
                return jsonify({"match": True, "user_id": uid, "username": username})

        return jsonify({"match": False})
    except Exception as e:
        return jsonify({"match": False, "msg": str(e)}), 500

# small health check
@auth_bp.route("/health")
def health():
    return jsonify({"status": "ok"})
