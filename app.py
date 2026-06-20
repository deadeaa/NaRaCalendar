from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import base64
import numpy as np
import cv2
from werkzeug.security import generate_password_hash, check_password_hash
import os
from datetime import timedelta, datetime
import json
import traceback

from database.db import (
    DB_PATH, ensure_sample_events, init_db, clean_duplicate_emotions, 
    get_emotion_stats, get_user_personality, set_user_personality, 
    migrate_user_personality 
)
from expert_system import EmotionExpertSystem

app = Flask(__name__)
app.secret_key = "super-secret-key-12345-change-this-in-production"
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

# Session configuration
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True

# CORS configuration
CORS(app, supports_credentials=True, origins=["http://localhost:5000", "http://127.0.0.1:5000"])

# Initialize Expert System
expert_system = EmotionExpertSystem(DB_PATH)

# Memory optimization
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'

# Lazy loading
face_recognition = None
deepface = None

def load_face_recognition():
    global face_recognition
    if face_recognition is None:
        import face_recognition
    return face_recognition

def load_deepface():
    global deepface
    if deepface is None:
        from deepface import DeepFace
    return DeepFace

# =========================
# EMOTION DETECTION
# =========================
def get_emotion_icon(emotion):
    """Get emoji icon for emotion"""
    icons = {
        'happy': '😊',
        'neutral': '😐',
        'sad': '😔',
        'angry': '😠',
        'fear': '😨',
        'surprise': '😲',
        'excited': '🤩',
        'relaxed': '😌'
    }
    return icons.get(emotion, '😐')

def get_emotion_display_name(emotion):
    """Get display name for emotion"""
    names = {
        'happy': '😊 Happy',
        'neutral': '😐 Neutral',
        'sad': '😔 Sad',
        'angry': '😠 Angry',
        'fear': '😨 Fear',
        'surprise': '😲 Surprise',
        'excited': '🤩 Excited',
        'relaxed': '😌 Relaxed'
    }
    return names.get(emotion, '😐 Neutral')

def detect_emotion_from_image(image_bytes):
    try:
        DeepFace = load_deepface()
        
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return None, None
            
        img = cv2.resize(img, (224, 224))
        
        analysis = DeepFace.analyze(
            img_path=img,
            actions=['emotion'],
            enforce_detection=False,
            detector_backend='opencv',
            silent=True
        )
        
        if analysis and len(analysis) > 0:
            emotion_data = analysis[0]
            dominant_emotion = emotion_data['dominant_emotion']
            emotion_score = emotion_data['emotion'][dominant_emotion]
            
            print(f"🎭 Emotion detected: {dominant_emotion} ({emotion_score:.2f})")
            
            suggestions = get_emotion_suggestions(dominant_emotion)
            return dominant_emotion, suggestions
        
        return None, None
        
    except Exception as e:
        print(f"❌ Emotion detection error: {e}")
        return None, None

def get_emotion_suggestions(emotion):
    suggestions = {
        'happy': {
            'message': 'You look happy!',
            'calendar_suggestions': [
                'Schedule a fun activity with friends',
                'Plan a creative project'
            ],
            'reminders': [
                'Share your positive energy with others',
                'Document what made you happy today'
            ]
        },
        'sad': {
            'message': 'You look a bit sad',
            'calendar_suggestions': [
                'Schedule some self-care time',
                'Plan a relaxing evening'
            ],
            'reminders': [
                'Be kind to yourself today',
                'Reach out to someone you trust'
            ]
        },
        'angry': {
            'message': 'You seem angry',
            'calendar_suggestions': [
                'Schedule exercise or sports',
                'Plan meditation time'
            ],
            'reminders': [
                'Take deep breaths before reacting',
                'Channel energy into positive action'
            ]
        },
        'neutral': {
            'message': 'You look calm and focused',
            'calendar_suggestions': [
                'Schedule focused work time',
                'Plan learning activities'
            ],
            'reminders': [
                'Stay hydrated throughout the day',
                'Review your weekly goals'
            ]
        },
        'fear': {
            'message': 'You seem worried or anxious',
            'calendar_suggestions': [
                'Schedule calming activities',
                'Plan time for relaxation techniques'
            ],
            'reminders': [
                'Focus on what you can control',
                'Practice mindfulness exercises'
            ]
        },
        'surprise': {
            'message': 'You look surprised!',
            'calendar_suggestions': [
                'Schedule time to process new information',
                'Plan a flexible day'
            ],
            'reminders': [
                'Embrace unexpected opportunities',
                'Stay open to new possibilities'
            ]
        },
        'excited': {
            'message': 'You look excited!',
            'calendar_suggestions': [
                'Channel your energy into productive tasks',
                'Plan something special to celebrate'
            ],
            'reminders': [
                'Enjoy the moment',
                'Share your excitement with others'
            ]
        },
        'relaxed': {
            'message': 'You look relaxed',
            'calendar_suggestions': [
                'Maintain this peaceful state',
                'Schedule light, enjoyable activities'
            ],
            'reminders': [
                'Practice gratitude',
                'Carry this calmness throughout the day'
            ]
        }
    }
    
    return suggestions.get(emotion, {
        'message': 'Nice to see you!',
        'calendar_suggestions': [
            'Schedule some personal time',
            'Plan your upcoming week'
        ],
        'reminders': [
            'Take care of yourself today',
            'Stay positive and productive'
        ]
    })

def update_user_emotion(user_id, emotion):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        c.execute("SELECT emotion_history FROM users WHERE id=?", (user_id,))
        result = c.fetchone()
        
        emotion_history = []
        if result and result[0]:
            try:
                emotion_history = eval(result[0])
            except:
                emotion_history = []
        
        emotion_history.append({
            'emotion': emotion,
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
        
        emotion_history = emotion_history[-10:]
        
        c.execute("UPDATE users SET last_emotion=?, emotion_history=? WHERE id=?", 
                 (emotion, str(emotion_history), user_id))
        conn.commit()
        conn.close()
        
        print(f"📝 Updated emotion history for user {user_id}: {emotion}")
        
    except Exception as e:
        print(f"❌ Error updating emotion: {e}")

# =========================
# FACE RECOGNITION FUNCTIONS
# =========================
def is_valid_google_email(email):
    google_domains = ['gmail.com', 'googlemail.com', 'google.com']
    if not email or '@' not in email:
        return False
    email_domain = email.split('@')[-1].lower()
    return email_domain in google_domains

def verify_google_account(email, password):
    if not email or not password:
        return False, "Email and password are required"
    if not is_valid_google_email(email):
        return False, "Please use a Google account"
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    return True, "Valid Google account"

def encode_face_from_bytes(img_bytes):
    try:
        face_recognition = load_face_recognition()
        
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        rgb_small = cv2.resize(rgb, (0, 0), fx=0.25, fy=0.25)
        
        encodings = face_recognition.face_encodings(rgb_small)
        if len(encodings) == 0:
            return None
        return encodings[0].astype("float64")
    except Exception as e:
        print(f"❌ Error in encode_face_from_bytes: {e}")
        return None

def encode_face_from_base64_string(b64_str):
    if not b64_str:
        return None
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    try:
        img_bytes = base64.b64decode(b64_str)
    except Exception as e:
        print(f"❌ Base64 decode error: {e}")
        return None
    return encode_face_from_bytes(img_bytes)

def get_image_encoding_from_request():
    if request.is_json:
        body = request.get_json(silent=True) or {}
        b64 = body.get("image") or body.get("img") or None
        if b64:
            return encode_face_from_base64_string(b64)
    return None

def store_user(name, email, password, face_encoding):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute(
            "INSERT INTO users (name, email, password, face_encoding, google_verified) VALUES (?,?,?,?,?)",
            (name, email, generate_password_hash(password), face_encoding.tobytes(), True)
        )
        conn.commit()
    except sqlite3.IntegrityError as e:
        raise e
    finally:
        conn.close()

def get_all_users():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute("SELECT id, name, email, password, face_encoding, last_emotion FROM users")
    rows = c.fetchall()
    conn.close()

    users = []
    for row in rows:
        if len(row) >= 5:
            id, name, email, password, face_blob = row[:5]
            last_emotion = row[5] if len(row) > 5 else None
            
            users.append({
                "id": id,
                "name": name,
                "email": email,
                "password": password,
                "face_encoding": np.frombuffer(face_blob, dtype=np.float64),
                "last_emotion": last_emotion
            })
    
    return users

def find_user_by_face(face_encoding):
    users = get_all_users()
    
    if not users:
        return None
    
    face_recognition = load_face_recognition()
    known_face_encodings = [user["face_encoding"] for user in users]
    
    face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
    best_match_index = np.argmin(face_distances)
    best_distance = face_distances[best_match_index]
    
    print(f"👤 Face matching - Best distance: {best_distance}")
    
    if best_distance < 0.6:
        return users[best_match_index]
    else:
        return None

# =========================
# CALENDAR FUNCTIONS
# =========================
def format_event_time(start_time_str, end_time_str):
    try:
        # Parse start time
        if 'T' in start_time_str:
            start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        else:
            start_time = datetime.strptime(start_time_str, '%Y-%m-%d %H:%M:%S')
        
        # Parse end time
        if 'T' in end_time_str:
            end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
        else:
            end_time = datetime.strptime(end_time_str, '%Y-%m-%d %H:%M:%S')
        
        start_str = start_time.strftime("%H:%M")
        end_str = end_time.strftime("%H:%M")
        
        return f"{start_str} - {end_str}"
    except Exception as e:
        print(f"❌ Error formatting event time: {e}")
        return "00:00 - 00:00"

def get_today_schedule_for_user(user_id):
    """Get today's schedule for user"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Get today's date
        today = datetime.now().date()
        today_str = today.strftime('%Y-%m-%d')
        
        print(f"📅 Fetching schedule for user {user_id} on {today_str}")
        
        # Get today's events
        c.execute('''
            SELECT id, title, description, start_time, end_time 
            FROM calendar_events 
            WHERE user_id = ? AND DATE(start_time) = ?
            ORDER BY start_time
        ''', (user_id, today_str))
        
        today_events = c.fetchall()
        conn.close()
        
        print(f"🎯 Found {len(today_events)} events for today")
        
        # Format events
        formatted_schedule = []
        for event in today_events:
            event_id, title, description, start_time, end_time = event
            
            time_display = format_event_time(start_time, end_time)
            event_type = determine_event_type(title, description)
            location = determine_event_location(title, event_type)
            
            formatted_schedule.append({
                'id': event_id,
                'title': title,
                'time': time_display,
                'type': event_type,
                'location': location,
                'description': description or ''
            })
        
        return formatted_schedule
        
    except Exception as e:
        print(f"❌ Error getting today schedule: {e}")
        traceback.print_exc()
        return []

def determine_event_type(title, description):
    title_lower = title.lower()
    desc_lower = (description or "").lower()
    
    if any(word in title_lower for word in ['meeting', 'meet', 'discussion', 'conference']):
        return 'meeting'
    elif any(word in title_lower for word in ['work', 'project', 'task', 'deadline']):
        return 'work'
    elif any(word in title_lower for word in ['lunch', 'dinner', 'breakfast', 'coffee', 'food']):
        return 'personal'
    elif any(word in title_lower for word in ['study', 'learn', 'course', 'class']):
        return 'work'
    elif any(word in title_lower for word in ['exercise', 'gym', 'sport', 'yoga']):
        return 'personal'
    else:
        return 'personal'

def determine_event_location(title, event_type):
    if event_type == 'meeting':
        return 'Conference Room'
    elif event_type == 'work':
        return 'Office'
    elif event_type == 'personal':
        if any(word in title.lower() for word in ['lunch', 'dinner', 'coffee']):
            return 'Restaurant'
        elif any(word in title.lower() for word in ['gym', 'exercise']):
            return 'Gym'
        else:
            return 'Home'
    else:
        return ''

def check_duplicate_emotion(user_id, emotion, note=None, time_window_minutes=5):
    """Check if similar emotion was logged recently"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        time_window = datetime.now() - timedelta(minutes=time_window_minutes)
        time_window_str = time_window.strftime('%Y-%m-%d %H:%M:%S')
        
        if note:
            c.execute('''
                SELECT COUNT(*) FROM emotion_logs 
                WHERE user_id = ? 
                AND emotion = ? 
                AND note = ?
                AND timestamp >= ?
            ''', (user_id, emotion, note, time_window_str))
        else:
            c.execute('''
                SELECT COUNT(*) FROM emotion_logs 
                WHERE user_id = ? 
                AND emotion = ? 
                AND timestamp >= ?
            ''', (user_id, emotion, time_window_str))
        
        count = c.fetchone()[0]
        conn.close()
        
        print(f"🔍 Duplicate check: {count} similar emotions in last {time_window_minutes} minutes")
        return count > 0
        
    except Exception as e:
        print(f"❌ Error checking duplicate emotion: {e}")
        return False

def get_schedule_density(user_id, days=7):
    """Calculate schedule density for stress analysis"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Get events from last X days
        date_limit = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        c.execute('''
            SELECT COUNT(*) as event_count,
                   SUM((julianday(end_time) - julianday(start_time)) * 24) as total_hours
            FROM calendar_events 
            WHERE user_id = ? AND DATE(start_time) >= ?
        ''', (user_id, date_limit))
        
        result = c.fetchone()
        conn.close()
        
        if result and result[0] > 0:
            event_count, total_hours = result
            avg_events_per_day = event_count / days
            
            # Calculate density score (0-1)
            # More than 3 events per day or 8+ hours = high density
            event_density = min(avg_events_per_day / 5, 1.0)  # Cap at 1.0
            hour_density = min((total_hours / days) / 10, 1.0)  # Cap at 1.0
            
            overall_density = (event_density + hour_density) / 2
            
            # Determine density level
            if overall_density > 0.7:
                level = "very_high"
            elif overall_density > 0.5:
                level = "high"
            elif overall_density > 0.3:
                level = "medium"
            else:
                level = "low"
            
            return {
                'event_count': event_count,
                'total_hours': total_hours or 0,
                'avg_events_per_day': round(avg_events_per_day, 1),
                'avg_hours_per_day': round((total_hours or 0) / days, 1),
                'density_score': round(overall_density, 2),
                'density_level': level,
                'message': f"Average {round(avg_events_per_day, 1)} events per day over last {days} days"
            }
        
        return {
            'event_count': 0,
            'total_hours': 0,
            'avg_events_per_day': 0,
            'avg_hours_per_day': 0,
            'density_score': 0,
            'density_level': 'low',
            'message': 'Light schedule detected'
        }
        
    except Exception as e:
        print(f"❌ Error calculating schedule density: {e}")
        return None

# =========================
# EXPERT SYSTEM INTEGRATION
# =========================
def detect_emotion_with_expert_system(image_bytes, user_id):
    """Detect emotion with Expert System analysis"""
    try:
        # Detect emotion as usual
        emotion, _ = detect_emotion_from_image(image_bytes)
        
        if emotion and user_id:
            # Use Expert System for deep analysis
            analysis = expert_system.analyze_emotion_pattern(user_id, emotion)
            recommendations = expert_system.generate_personalized_recommendations(
                user_id, emotion, analysis
            )
            
            return {
                'emotion': emotion,
                'expert_analysis': analysis,
                'personalized_recommendations': recommendations
            }
        
        return {'emotion': emotion}
        
    except Exception as e:
        print(f"❌ Expert emotion detection error: {e}")
        return {'emotion': None}

# =========================
# API ENDPOINTS
# =========================
@app.route("/api/user-data")
def api_user_data():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    return jsonify({
        "user_id": session.get("user_id"),
        "name": session.get("user_name"),
        "email": session.get("user_email"),
        "logged_in": True
    })

@app.route("/api/calendar/simulation/create", methods=["POST"])
def api_calendar_simulation_create():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    data = request.get_json()
    print(f"📥 Received calendar event data: {data}")
    
    if not data or not data.get('title'):
        return jsonify({"error": "Title is required"}), 400
    
    try:
        user_id = session.get("user_id")
        title = data.get('title')
        description = data.get('description', '')
        start_time_raw = data.get('start_time') or data.get('startDateTime')
        end_time_raw = data.get('end_time') or data.get('endDateTime')
        
        print(f"🕒 Raw time inputs - Start: {start_time_raw}, End: {end_time_raw}")
        
        def parse_datetime(dt_str):
            """Parse datetime from various formats"""
            if not dt_str:
                return None
                
            # Remove timezone info if present
            dt_str = dt_str.split('+')[0].split('Z')[0].strip()
            
            # Try different formats
            formats = [
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%dT%H:%M:%S',
                '%Y-%m-%d %H:%M',
                '%Y-%m-%dT%H:%M',
                '%Y-%m-%d',
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(dt_str, fmt)
                except ValueError:
                    continue
            
            return None
        
        # Parse times
        start_dt = parse_datetime(start_time_raw)
        end_dt = parse_datetime(end_time_raw)
        
        if not start_dt or not end_dt:
            print(f"❌ Failed to parse times: start={start_time_raw}, end={end_time_raw}")
            return jsonify({"error": "Invalid time format. Use YYYY-MM-DD HH:MM:SS"}), 400
        
        # If only date is provided, add default time (9 AM)
        if start_dt.hour == 0 and start_dt.minute == 0 and start_dt.second == 0:
            start_dt = start_dt.replace(hour=9, minute=0)
            end_dt = end_dt.replace(hour=10, minute=0)
            print(f"⚠️ No time specified, using default 9 AM")
        
        # Ensure end time is after start time
        if end_dt <= start_dt:
            end_dt = start_dt + timedelta(hours=1)
            print(f"⚠️ End time before start time, adding 1 hour")
        
        print(f"✅ Parsed times - Start: {start_dt}, End: {end_dt}")
        
        # Connect to database
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Insert event
        c.execute('''
            INSERT INTO calendar_events (user_id, title, description, start_time, end_time)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            user_id, 
            title, 
            description, 
            start_dt.strftime('%Y-%m-%d %H:%M:%S'),
            end_dt.strftime('%Y-%m-%d %H:%M:%S')
        ))
        
        event_id = c.lastrowid
        
        conn.commit()
        conn.close()
        
        print(f"✅ Calendar event saved - ID: {event_id}, Title: {title}")
        
        return jsonify({
            "success": True,
            "message": "Event created successfully",
            "event_id": event_id,
            "event": {
                "id": event_id,
                "title": title,
                "description": description,
                "start_time": start_dt.strftime('%Y-%m-%d %H:%M:%S'),
                "end_time": end_dt.strftime('%Y-%m-%d %H:%M:%S'),
                "start_hour": start_dt.hour,
                "end_hour": end_dt.hour
            }
        })
        
    except Exception as e:
        print(f"❌ Error creating calendar event: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to create event: {str(e)}"}), 500

@app.route('/api/save-login-emotion', methods=['POST'])
def api_save_login_emotion():
    """Save emotion detected during login to session"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.json
        emotion = data.get('emotion')
        
        if emotion:
            session['login_emotion'] = emotion
            print(f"✅ Login emotion saved to session: {emotion}")
            
            return jsonify({
                'success': True,
                'message': 'Emotion saved to session'
            })
        
        return jsonify({'error': 'No emotion provided'}), 400
        
    except Exception as e:
        print(f"❌ Error saving login emotion: {e}")
        return jsonify({'error': 'Failed to save emotion'}), 500

@app.route('/api/emotion/history', methods=['GET'])
def api_emotion_history():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        user_id = session.get('user_id')
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Get emotion logs
        c.execute('''
            SELECT id, emotion, note, timestamp, intensity 
            FROM emotion_logs 
            WHERE user_id = ? 
            ORDER BY timestamp DESC
            LIMIT 50
        ''', (user_id,))
        
        rows = c.fetchall()
        conn.close()
        
        print(f"📊 API: Found {len(rows)} emotion logs for user {user_id}")
        
        history = []
        for row in rows:
            id, emotion, note, timestamp_str, intensity = row
            
            # Parse timestamp dengan benar
            try:
                if timestamp_str:
                    if 'T' in timestamp_str:
                        if '.' in timestamp_str:
                            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            timestamp = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S')
                    else:
                        timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                else:
                    timestamp = datetime.now()
            except Exception as e:
                print(f"⚠️ Error parsing timestamp '{timestamp_str}': {e}")
                timestamp = datetime.now()
            
            # Format untuk frontend
            date_str = timestamp.strftime('%Y-%m-%d')
            time_str = timestamp.strftime('%H:%M')
            
            history.append({
                'id': id,
                'emotion': emotion,
                'emotion_name': get_emotion_display_name(emotion),
                'note': note or '',
                'timestamp': timestamp.isoformat(),
                'raw_timestamp': timestamp_str,
                'date': date_str,
                'time': time_str,
                'intensity': intensity or 3
            })
        
        # Get current emotion (most recent)
        current = history[0] if history else None
        
        print(f"📊 Sending {len(history)} emotions to frontend")
        if history:
            print(f"📊 Sample emotion: {history[0]['emotion']} at {history[0]['timestamp']}")
        
        return jsonify({
            'success': True,
            'history': history,
            'current': current,
            'count': len(history)
        })
        
    except Exception as e:
        print(f"❌ Error fetching emotion history: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch emotion history'}), 500

@app.route('/api/emotion/log', methods=['POST'])
def api_emotion_log():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.json
        user_id = session.get('user_id')
        emotion = data.get('emotion')
        note = data.get('note', '')
        intensity = data.get('intensity', 3)
        
        if not emotion:
            return jsonify({'error': 'Emotion is required'}), 400
        
        # Cek duplikat untuk manual emotion logging
        if check_duplicate_emotion(user_id, emotion, note, time_window_minutes=2):
            return jsonify({
                'success': True,
                'message': 'Similar emotion was logged recently. No duplicate saved.',
                'duplicate': True
            })
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Insert emotion log
        c.execute('''
            INSERT INTO emotion_logs (user_id, emotion, note, intensity)
            VALUES (?, ?, ?, ?)
        ''', (user_id, emotion, note, intensity))
        
        emotion_id = c.lastrowid
        
        conn.commit()
        conn.close()
        
        print(f"✅ Emotion logged: ID {emotion_id}, {emotion}, Note: {note}")
        
        return jsonify({
            'success': True,
            'message': 'Emotion logged successfully',
            'emotion_id': emotion_id
        })
        
    except Exception as e:
        print(f"❌ Error logging emotion: {e}")
        return jsonify({'error': 'Failed to log emotion'}), 500

@app.route("/api/emotion/delete/<int:emotion_id>", methods=["DELETE"])
def api_emotion_delete(emotion_id):
    """Delete an emotion log"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        user_id = session.get('user_id')
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if emotion belongs to user
        c.execute('SELECT id FROM emotion_logs WHERE id=? AND user_id=?', (emotion_id, user_id))
        emotion = c.fetchone()
        
        if not emotion:
            conn.close()
            return jsonify({'error': 'Emotion not found'}), 404
        
        # Delete emotion
        c.execute('DELETE FROM emotion_logs WHERE id=?', (emotion_id,))
        conn.commit()
        conn.close()
        
        print(f"✅ Emotion log deleted: ID {emotion_id}")
        
        return jsonify({
            'success': True,
            'message': 'Emotion deleted successfully'
        })
        
    except Exception as e:
        print(f"❌ Error deleting emotion: {e}")
        return jsonify({'error': 'Failed to delete emotion'}), 500

@app.route("/api/emotion/insights", methods=["GET"])
def api_emotion_insights():
    """Get emotion insights and patterns"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        user_id = session.get('user_id')
        stats = get_emotion_stats(user_id)
        
        if not stats or stats['total'] == 0:
            return jsonify({
                'success': True,
                'insights': [],
                'patterns': [],
                'statistics': {
                    'total': 0,
                    'most_common': None,
                    'average_intensity': 0
                }
            })
        
        # Prepare insights
        insights = []
        
        # Insight 1: Most common emotion
        if stats['most_common']:
            insights.append({
                'title': 'Most Common Emotion',
                'description': f'You feel {stats["most_common"]} most frequently ({stats["most_common_count"]} times)',
                'icon': 'fas fa-chart-pie',
                'color': 'var(--primary)'
            })
        
        # Insight 2: Average intensity
        intensity_text = 'moderate'
        if stats['avg_intensity'] >= 4:
            intensity_text = 'high'
        elif stats['avg_intensity'] <= 2:
            intensity_text = 'low'
        
        insights.append({
            'title': 'Emotional Intensity',
            'description': f'Your average emotional intensity is {intensity_text} ({stats["avg_intensity"]}/5)',
            'icon': 'fas fa-fire',
            'color': 'var(--warning)'
        })
        
        # Insight 3: Logging frequency
        if stats['total'] > 0:
            insights.append({
                'title': 'Tracking Activity',
                'description': f'You have logged {stats["total"]} emotions total',
                'icon': 'fas fa-calendar-check',
                'color': 'var(--secondary)'
            })
        
        return jsonify({
            'success': True,
            'insights': insights,
            'patterns': [],
            'statistics': stats
        })
        
    except Exception as e:
        print(f"❌ Error getting emotion insights: {e}")
        return jsonify({'error': 'Failed to get insights'}), 500

@app.route("/api/calendar/events/today", methods=["GET"])
def api_calendar_events_today():
    """Get today's events for the current user"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        user_id = session.get("user_id")
        today = datetime.now().strftime('%Y-%m-%d')
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Get events for today
        c.execute('''
            SELECT id, title, description, start_time, end_time
            FROM calendar_events 
            WHERE user_id = ? 
            AND DATE(start_time) = ?
            ORDER BY start_time
        ''', (user_id, today))
        
        events = c.fetchall()
        conn.close()
        
        # Format response
        formatted_events = []
        for event in events:
            event_id, title, description, start_time, end_time = event
            
            try:
                start_dt = datetime.strptime(start_time, '%Y-%m-%d %H:%M:%S')
                end_dt = datetime.strptime(end_time, '%Y-%m-%d %H:%M:%S')
                
                time_display = f"{start_dt.strftime('%H:%M')} - {end_dt.strftime('%H:%M')}"
                
                duration_minutes = int((end_dt - start_dt).total_seconds() / 60)
                duration_display = f"{duration_minutes} minutes"
                if duration_minutes >= 60:
                    hours = duration_minutes // 60
                    minutes = duration_minutes % 60
                    duration_display = f"{hours} hour{'s' if hours > 1 else ''}"
                    if minutes > 0:
                        duration_display += f" {minutes} minutes"
            except:
                time_display = "Unknown"
                duration_display = "Unknown"
                start_dt = datetime.now()
            
            formatted_events.append({
                "id": event_id,
                "title": title,
                "description": description,
                "start_time": start_time,
                "end_time": end_time,
                "time": time_display,
                "duration": duration_display,
                "start_hour": start_dt.hour,
                "start_minute": start_dt.minute
            })
        
        print(f"📅 Found {len(formatted_events)} events for today")
        
        return jsonify({
            "success": True,
            "count": len(formatted_events),
            "events": formatted_events
        })
        
    except Exception as e:
        print(f"❌ Error fetching today's events: {e}")
        return jsonify({"error": "Failed to fetch events"}), 500

@app.route("/api/calendar/simulation/events", methods=["GET"])
def api_calendar_simulation_events():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        user_id = session.get("user_id")
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        c.execute('''
            SELECT id, title, description, start_time, end_time, created_at
            FROM calendar_events 
            WHERE user_id = ?
            ORDER BY start_time
        ''', (user_id,))
        
        events = c.fetchall()
        conn.close()
        
        formatted_events = []
        for event in events:
            event_id, title, description, start_time, end_time, created_at = event
            
            def format_for_js(time_str):
                """Format database time to ISO string for JavaScript"""
                try:
                    if isinstance(time_str, str):
                        if ' ' in time_str:
                            dt = datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
                            return dt.isoformat()
                        elif 'T' in time_str:
                            return time_str
                    return time_str or datetime.now().isoformat()
                except Exception as e:
                    print(f"Error formatting time {time_str}: {e}")
                    return datetime.now().isoformat()
            
            formatted_events.append({
                "id": event_id,
                "title": title,
                "description": description or "",
                "start_time": format_for_js(start_time),
                "end_time": format_for_js(end_time),
                "created_at": created_at,
            })
        
        return jsonify({"events": formatted_events})
        
    except Exception as e:
        print(f"❌ Error getting calendar events: {e}")
        traceback.print_exc()
        return jsonify({"events": []})

@app.route("/api/calendar/simulation/delete/<int:event_id>", methods=["DELETE"])
def api_calendar_simulation_delete(event_id):
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        user_id = session.get("user_id")
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if event belongs to user
        c.execute('SELECT id FROM calendar_events WHERE id=? AND user_id=?', (event_id, user_id))
        event = c.fetchone()
        
        if not event:
            conn.close()
            return jsonify({"error": "Event not found"}), 404
        
        # Delete event
        c.execute('DELETE FROM calendar_events WHERE id=?', (event_id,))
        conn.commit()
        conn.close()
        
        print(f"✅ Calendar event deleted: ID {event_id}")
        
        return jsonify({
            "success": True,
            "message": "Event deleted successfully"
        })
        
    except Exception as e:
        print(f"❌ Error deleting calendar event: {e}")
        return jsonify({"error": "Failed to delete event"}), 500

@app.route("/api/today-schedule")
def api_today_schedule():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        user_id = session.get("user_id")
        today_schedule = get_today_schedule_for_user(user_id)
        
        return jsonify({
            "success": True,
            "schedule": today_schedule
        })
        
    except Exception as e:
        print(f"❌ Error in today-schedule API: {e}")
        return jsonify({
            "success": False,
            "schedule": []
        })

@app.route("/api/schedule/density", methods=["GET"])
def api_schedule_density():
    """Get schedule density analysis"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        user_id = session.get("user_id")
        density_analysis = get_schedule_density(user_id, days=7)
        
        return jsonify({
            "success": True,
            "density_analysis": density_analysis
        })
        
    except Exception as e:
        print(f"❌ Error getting schedule density: {e}")
        return jsonify({"error": "Failed to analyze schedule density"}), 500

@app.route("/api/debug-database")
def api_debug_database():
    """Debug database content"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    user_id = session.get("user_id")
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Check users
    c.execute("SELECT id, name, email FROM users WHERE id=?", (user_id,))
    user = c.fetchone()
    
    # Check events count
    c.execute("SELECT COUNT(*) FROM calendar_events WHERE user_id=?", (user_id,))
    events_count = c.fetchone()[0]
    
    # Check emotion logs count
    c.execute("SELECT COUNT(*) FROM emotion_logs WHERE user_id=?", (user_id,))
    emotion_count = c.fetchone()[0]
    
    conn.close()
    
    return jsonify({
        "database_file": DB_PATH,
        "user": {
            "id": user[0] if user else None,
            "name": user[1] if user else None,
            "email": user[2] if user else None
        },
        "events_count": events_count,
        "emotion_logs_count": emotion_count
    })

# =========================
# EXPERT SYSTEM ENDPOINTS
# =========================
@app.route('/api/expert/analyze', methods=['POST'])
def api_expert_analyze():
    """Endpoint for Expert System analysis"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.json
        user_id = session.get('user_id')
        emotion = data.get('emotion')
        
        if not emotion:
            return jsonify({'error': 'Emotion is required'}), 400
        
        # Use Expert System
        analysis = expert_system.analyze_emotion_pattern(user_id, emotion)
        recommendations = expert_system.generate_personalized_recommendations(
            user_id, emotion, analysis
        )
        
        return jsonify({
            'success': True,
            'analysis': analysis,
            'recommendations': recommendations,
            'expert_system': {
                'name': 'Emotion Advisor Expert System',
                'version': '1.0',
                'inference_method': 'Forward Chaining with Pattern Matching'
            }
        })
        
    except Exception as e:
        print(f"❌ Expert system error: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Expert system analysis failed'}), 500

@app.route('/api/expert/feedback', methods=['POST'])
def api_expert_feedback():
    """Endpoint to provide feedback to Expert System"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.json
        user_id = session.get('user_id')
        
        feedback = {
            'emotion': data.get('emotion'),
            'recommendation': data.get('recommendation'),
            'was_helpful': data.get('was_helpful', True),
            'feedback': data.get('feedback', '')
        }
        
        # Save feedback for learning
        expert_system.save_knowledge_to_db(user_id, feedback)
        
        return jsonify({
            'success': True,
            'message': 'Thank you for your feedback! The system will learn from this.',
            'learning': 'Knowledge base has been updated'
        })
        
    except Exception as e:
        print(f"❌ Feedback error: {e}")
        return jsonify({'error': 'Failed to save feedback'}), 500

@app.route('/api/expert/schedule-stress', methods=['GET'])
def api_expert_schedule_stress():
    """Analyze schedule-induced stress"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        user_id = session.get('user_id')
        
        # Get schedule density
        density = get_schedule_density(user_id, days=7)
        
        if not density:
            return jsonify({'error': 'Failed to analyze schedule'}), 500
        
        # Get recent emotions
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''
            SELECT emotion, COUNT(*) as count 
            FROM emotion_logs 
            WHERE user_id = ? AND timestamp >= DATE('now', '-7 days')
            GROUP BY emotion
        ''', (user_id,))
        
        emotion_counts = dict(c.fetchall())
        conn.close()
        
        # Calculate stress correlation
        negative_emotions = ['sad', 'angry', 'fear']
        negative_count = sum(emotion_counts.get(emotion, 0) for emotion in negative_emotions)
        total_count = sum(emotion_counts.values())
        
        negative_percentage = negative_count / total_count if total_count > 0 else 0
        
        # Expert analysis
        if density['density_level'] in ['high', 'very_high'] and negative_percentage > 0.5:
            conclusion = 'high_schedule_stress'
            confidence = 0.8
            explanation = f"Your schedule is {density['density_level']} with {negative_percentage*100:.0f}% negative emotions in the last 7 days, indicating potential schedule-induced stress."
            recommendations = [
                "Schedule buffer time between meetings",
                "Block 'focus time' in your calendar",
                "Review and prioritize tasks",
                "Consider delegating some responsibilities"
            ]
        elif density['density_level'] == 'medium' and negative_percentage > 0.3:
            conclusion = 'moderate_schedule_stress'
            confidence = 0.6
            explanation = f"Your schedule is moderately busy with some negative emotions ({negative_percentage*100:.0f}%)."
            recommendations = [
                "Plan breaks throughout the day",
                "Use time blocking technique",
                "Practice stress management techniques"
            ]
        else:
            conclusion = 'low_schedule_stress'
            confidence = 0.7
            explanation = "Your schedule appears manageable with balanced emotions."
            recommendations = [
                "Maintain your current schedule balance",
                "Continue tracking emotions",
                "Plan enjoyable activities"
            ]
        
        return jsonify({
            'success': True,
            'analysis': {
                'schedule_density': density,
                'emotion_distribution': emotion_counts,
                'negative_emotion_percentage': round(negative_percentage, 2),
                'conclusion': conclusion,
                'confidence': confidence,
                'explanation': explanation
            },
            'recommendations': recommendations,
            'suggested_actions': [
                f"Try to keep average events per day below {3 if density['density_level'] in ['high', 'very_high'] else 5}",
                f"Aim for work hours under {8 if density['density_level'] in ['high', 'very_high'] else 10} per day"
            ]
        })
        
    except Exception as e:
        print(f"❌ Schedule stress analysis error: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to analyze schedule stress'}), 500

# =========================
# PERSONALITY API ENDPOINTS
# =========================

@app.route('/api/user/personality', methods=['GET'])
def api_user_personality():
    """Get user's personality type"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        user_id = session.get('user_id')
        personality_data = get_user_personality(user_id)
        
        if personality_data and personality_data.get('has_personality'):
            return jsonify({
                'success': True,
                'personality': personality_data['personality'],
                'confidence': personality_data['confidence'],
                'has_personality': True
            })
        else:
            return jsonify({
                'success': True,
                'personality': None,
                'has_personality': False,
                'message': 'Personality not set yet'
            })
        
    except Exception as e:
        print(f"❌ Error getting personality: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to get personality'}), 500

@app.route('/api/user/set-personality', methods=['POST'])
def api_set_personality():
    """Set user's personality type"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.json
        user_id = session.get('user_id')
        personality = data.get('personality')
        
        if personality not in ['introvert', 'extrovert', 'ambivert']:
            return jsonify({'error': 'Invalid personality type'}), 400
        
        success = set_user_personality(user_id, personality)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Personality saved successfully',
                'personality': personality
            })
        else:
            return jsonify({'error': 'Failed to save personality'}), 500
        
    except Exception as e:
        print(f"❌ Error setting personality: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to save personality'}), 500

@app.route('/api/user/infer-personality', methods=['GET'])
def api_infer_personality():
    """Infer personality from user's activity patterns"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        user_id = session.get('user_id')
        
        # Get user's activities and emotions for analysis
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # 1. Analyze social vs solitary activities (30 hari terakhir)
        c.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN title LIKE '%meeting%' OR title LIKE '%team%' 
                          OR title LIKE '%social%' OR title LIKE '%party%'
                          OR title LIKE '%gathering%' OR title LIKE '%event%'
                     THEN 1 ELSE 0 END) as social_activities,
                SUM(CASE WHEN title LIKE '%alone%' OR title LIKE '%solo%'
                          OR title LIKE '%study%' OR title LIKE '%read%'
                          OR title LIKE '%meditation%' OR title LIKE '%focus%'
                     THEN 1 ELSE 0 END) as solitary_activities
            FROM calendar_events 
            WHERE user_id = ? 
            AND start_time >= DATE('now', '-30 days')
        ''', (user_id,))
        
        activity_result = c.fetchone()
        
        # 2. Analyze emotion patterns
        c.execute('''
            SELECT emotion, COUNT(*) as count
            FROM emotion_logs
            WHERE user_id = ?
            AND timestamp >= DATE('now', '-30 days')
            GROUP BY emotion
            ORDER BY count DESC
        ''', (user_id,))
        
        emotion_results = c.fetchall()
        conn.close()
        
        # Analyze patterns
        if activity_result and activity_result['total'] > 5:
            total_activities = activity_result['total']
            social_activities = activity_result['social_activities'] or 0
            solitary_activities = activity_result['solitary_activities'] or 0
            
            social_ratio = social_activities / total_activities if total_activities > 0 else 0.5
            
            if social_ratio > 0.7:
                personality = 'extrovert'
                confidence = min(0.85, social_ratio)
                suggestion = f"Your schedule shows {social_ratio:.0%} social activities. This suggests you're an extrovert who thrives in social settings."
            elif social_ratio < 0.3:
                personality = 'introvert'
                confidence = min(0.85, 1 - social_ratio)
                suggestion = f"Your schedule shows {social_ratio:.0%} social activities. This suggests you're an introvert who prefers quiet environments."
            else:
                personality = 'ambivert'
                confidence = 0.7
                suggestion = f"Your schedule shows a balanced mix ({social_ratio:.0%} social). This suggests you're an ambivert who adapts well to different situations."
            
            # Adjust based on emotions
            emotion_map = dict(emotion_results)
            if emotion_map.get('happy', 0) > emotion_map.get('sad', 0) * 2:
                # More happy emotions suggests extrovert or balanced
                if personality == 'introvert':
                    confidence *= 0.8  # Lower confidence if introvert but happy
            elif emotion_map.get('sad', 0) > emotion_map.get('happy', 0) * 2:
                # More sad emotions suggests introvert or stressed
                if personality == 'extrovert':
                    confidence *= 0.8  # Lower confidence if extrovert but sad
                    
        else:
            # Not enough data, analyze from emotions only
            emotion_map = dict(emotion_results)
            total_emotions = sum(emotion_map.values())
            
            if total_emotions > 5:
                social_emotions = emotion_map.get('happy', 0) + emotion_map.get('excited', 0)
                social_ratio = social_emotions / total_emotions if total_emotions > 0 else 0.5
                
                if social_ratio > 0.6:
                    personality = 'extrovert'
                    confidence = 0.6
                    suggestion = "Based on your positive emotions, you might be an extrovert who enjoys social interactions."
                elif social_ratio < 0.3:
                    personality = 'introvert'
                    confidence = 0.6
                    suggestion = "Based on your emotion patterns, you might be an introvert who values quiet time."
                else:
                    personality = 'ambivert'
                    confidence = 0.5
                    suggestion = "Based on your emotion patterns, you might be an ambivert with balanced preferences."
            else:
                # Not enough data, default to ambivert
                personality = 'ambivert'
                confidence = 0.3
                suggestion = "We don't have enough data to accurately guess. Based on common patterns, you might be an ambivert."
        
        return jsonify({
            'success': True,
            'inferred_personality': personality,
            'confidence': round(confidence, 2),
            'suggestion': suggestion,
            'source': 'activity_patterns' if activity_result and activity_result['total'] > 5 else 'emotion_patterns'
        })
        
    except Exception as e:
        print(f"❌ Error inferring personality: {e}")
        traceback.print_exc()
        # Default fallback
        return jsonify({
            'success': True,
            'inferred_personality': 'ambivert',
            'confidence': 0.3,
            'suggestion': 'Based on common patterns, you might be an ambivert.',
            'source': 'default_fallback'
        })

@app.route('/api/admin/migrate-personality', methods=['POST'])
def api_admin_migrate_personality():
    """Admin endpoint to migrate existing users (run once)"""
    try:
        # Simple password protection
        data = request.json
        admin_key = data.get('admin_key', '')
        
        if admin_key != 'migrate123':  # Change this in production
            return jsonify({'error': 'Unauthorized'}), 401
        
        migrated_count = migrate_user_personality()
        
        return jsonify({
            'success': True,
            'message': f'Migration complete! Migrated {migrated_count} users.',
            'migrated_count': migrated_count
        })
        
    except Exception as e:
        print(f"❌ Migration error: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Migration failed'}), 500
    
# =========================
# ROUTES
# =========================
@app.route("/")
def landing():
    if "user_id" in session:
        return redirect(url_for("dashboard"))
    return render_template("landing.html")

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if "user_id" in session:
        return redirect(url_for("dashboard"))
        
    if request.method == "POST":
        name = request.form.get("name")
        email = request.form.get("email")
        password = request.form.get("password")
        confirm_password = request.form.get("confirm_password")

        if not (name and email and password and confirm_password):
            flash("All fields are required.", "error")
            return redirect(url_for("signup"))

        if password != confirm_password:
            flash("Passwords do not match.", "error")
            return redirect(url_for("signup"))

        is_valid, message = verify_google_account(email, password)
        if not is_valid:
            flash(message, "error")
            return redirect(url_for("signup"))

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE email=?", (email,))
        if c.fetchone():
            flash("Email already registered. Please login instead.", "error")
            conn.close()
            return redirect(url_for("login"))
        conn.close()

        session.permanent = True
        session['signup_data'] = {
            'name': name, 
            'email': email, 
            'password': password
        }
        
        print(f"Session saved for: {email}")
        
        return redirect(url_for("signup_face"))
    
    return render_template("signup.html")

@app.route("/signup-face")
def signup_face():
    if "user_id" in session:
        return redirect(url_for("dashboard"))
        
    signup_data = session.get('signup_data')
    print(f"Checking session in signup-face: {signup_data}")
    
    if not signup_data:
        flash("Session expired. Please complete the signup form again.", "error")
        return redirect(url_for("signup"))
    
    return render_template("signup_face.html", email=signup_data['email'])

@app.route("/login")
def login():
    if "user_id" in session:
        return redirect(url_for("dashboard"))
    return render_template("login.html")

@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        print("No user_id in session, redirecting to login")
        return redirect(url_for("login"))
    
    user_id = session.get("user_id")
    
    # AUTO-CREATE SAMPLE EVENTS IF EMPTY
    ensure_sample_events(user_id)
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Get user data
    c.execute("SELECT name, email, last_emotion, emotion_history FROM users WHERE id=?", (user_id,))
    result = c.fetchone()
    
    # Get personality data
    personality_data = get_user_personality(user_id)
    personality = personality_data.get('personality') if personality_data else None
    
    # Get today's schedule
    today_schedule = get_today_schedule_for_user(user_id)
    
    # Get schedule density for dashboard display
    schedule_density = get_schedule_density(user_id, days=7)
    
    conn.close()
    
    name = result[0] if result else session.get("user_name", "User")
    email = result[1] if result else session.get("user_email", "")
    last_emotion = result[2] if result else None
    emotion_history = eval(result[3]) if result and result[3] else []
    
    print(f"=== DASHBOARD DEBUG ===")
    print(f"User: {name} (ID: {user_id})")
    print(f"Personality: {personality}")
    print(f"Today schedule count: {len(today_schedule)}")
    print(f"Schedule density: {schedule_density['density_level'] if schedule_density else 'unknown'}")
    print(f"=======================")
    
    return render_template("dashboard.html", 
                         name=name,
                         email=email,
                         last_emotion=last_emotion,
                         emotion_history=emotion_history[-5:],
                         today_schedule=today_schedule,
                         schedule_density=schedule_density,
                         personality=personality,  # <-- Tambah ini
                         google_connected=True)           

@app.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out successfully.", "success")
    return redirect(url_for("landing"))

@app.route("/api/signup-face", methods=["POST"])
def api_signup_face():
    try:
        print("API Signup-face - Raw request data received")
        
        if not request.is_json:
            return jsonify({"success": False, "error": "invalid_request"}), 400
            
        data = request.get_json()
        
        name = data.get('name')
        email = data.get('email') 
        password = data.get('password')
        image_data = data.get('image')
        
        if not all([name, email, password, image_data]):
            return jsonify({"success": False, "error": "missing_data"}), 400

        if not is_valid_google_email(email):
            return jsonify({"success": False, "error": "invalid_google_email"}), 400

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE email=?", (email,))
        if c.fetchone():
            conn.close()
            return jsonify({"success": False, "error": "email_exists"}), 400
        conn.close()

        enc = encode_face_from_base64_string(image_data)
        if enc is None:
            return jsonify({"success": False, "error": "no_face_detected"}), 400

        try:
            store_user(name, email, password, enc)
            print(f"User stored in database: {email}")
            
        except sqlite3.IntegrityError:
            return jsonify({"success": False, "error": "email_exists"}), 400

        user = find_user_by_face(enc)
        if user:
            session.permanent = True
            session["user_id"] = user["id"]
            session["user_name"] = user["name"] 
            session["user_email"] = user["email"]
            
            print(f"SIGNUP SUCCESS: {email}")
            
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "error": "auto_login_failed"}), 500

    except Exception as e:
        print(f"API Signup-face error: {e}")
        return jsonify({"success": False, "error": "server_error"}), 500

@app.route("/api/login-face", methods=["POST", "OPTIONS"])
def api_login_face():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    print("FACE-ONLY LOGIN: Scanning face...")
    
    enc = get_image_encoding_from_request()
    if enc is None:
        return jsonify({"match": False, "error": "no_face_detected"}), 400

    user = find_user_by_face(enc)
    
    if user:
        emotion = None
        suggestions = None
        
        if request.is_json:
            body = request.get_json(silent=True) or {}
            image_data = body.get("image")
            if image_data and "," in image_data:
                image_data = image_data.split(",", 1)[1]
                try:
                    img_bytes = base64.b64decode(image_data)
                    emotion, suggestions = detect_emotion_from_image(img_bytes)
                    
                    if emotion:
                        # Update user's last emotion (tabel users saja)
                        update_user_emotion(user["id"], emotion)
                        
                        # SIMPAN DI SESSION SAJA
                        # Database insert akan dilakukan di /emotion route dengan cek duplikat
                        session['login_emotion'] = emotion
                        session['login_emotion_detected'] = True
                        session['login_emotion_time'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        
                        print(f"✅ Emotion detected for login: {emotion} (saved to session only)")
                        
                except Exception as e:
                    print(f"DeepFace emotion detection failed: {e}")
        
        session.permanent = True
        session["user_id"] = user["id"]
        session["user_name"] = user["name"]
        session["user_email"] = user["email"]
        
        print(f"FACE LOGIN SUCCESS: {user['email']} - Emotion: {emotion}")
        
        response = jsonify({
            "match": True, 
            "user": {
                "name": user["name"], 
                "email": user["email"]
            },
            "emotion": emotion,
            "suggestions": suggestions,
            "message": "Login successful. Emotion will be saved on emotion page."
        })
        
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        
        return response
    else:
        print("FACE LOGIN FAILED: No matching face found")
        response = jsonify({"match": False, "error": "face_not_recognized"})
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@app.route("/emotion")
def emotion():
    try:
        if "user_id" not in session:
            return redirect(url_for("login"))
        
        user_id = session.get('user_id')
        
        # Get user data
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT name, email FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        
        if not user:
            conn.close()
            flash("User not found", "error")
            return redirect(url_for("login"))
        
        # Check and process emotion from login (ONLY IF NOT ALREADY EXISTS)
        emotion_from_login = session.pop('login_emotion', None)
        login_emotion_detected = session.pop('login_emotion_detected', False)
        login_emotion_time = session.pop('login_emotion_time', None)
        
        if emotion_from_login and login_emotion_detected:
            # Check if similar emotion already exists today
            today = datetime.now().strftime('%Y-%m-%d')
            
            c.execute('''
                SELECT COUNT(*) FROM emotion_logs 
                WHERE user_id = ? 
                AND emotion = ? 
                AND note = 'Auto-detected during login'
                AND DATE(timestamp) = ?
            ''', (user_id, emotion_from_login, today))
            
            duplicate_count = c.fetchone()[0]
            
            if duplicate_count == 0:
                # Insert emotion from login to database
                note = "Auto-detected during login"
                current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                
                c.execute('''
                    INSERT INTO emotion_logs (user_id, emotion, note, intensity, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                ''', (user_id, emotion_from_login, note, 3, current_time))
                
                emotion_id = c.lastrowid
                conn.commit()
                
                print(f"✅ Login emotion saved to database: {emotion_from_login} (ID: {emotion_id})")
            else:
                print(f"⚠️ Duplicate login emotion detected today, not saving: {emotion_from_login}")
        
        # Get emotion history from database
        c.execute('''
            SELECT id, emotion, note, timestamp, intensity 
            FROM emotion_logs 
            WHERE user_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 50
        ''', (user_id,))
        emotion_rows = c.fetchall()
        
        conn.close()
        
        print(f"📊 Fetched {len(emotion_rows)} emotion logs for user {user_id}")
        
        # Format emotion history
        emotion_history = []
        for row in emotion_rows:
            try:
                timestamp = row[3]
                if timestamp:
                    if 'T' in timestamp:
                        date_obj = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    else:
                        date_obj = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                    date_str = date_obj.strftime('%Y-%m-%d')
                    time_str = date_obj.strftime('%H:%M')
                else:
                    date_str = ''
                    time_str = ''
            except Exception as e:
                print(f"Error parsing timestamp {row[3]}: {e}")
                date_str = ''
                time_str = ''
            
            emotion_history.append({
                'id': row[0],
                'emotion': row[1],
                'emotion_name': get_emotion_display_name(row[1]),
                'note': row[2],
                'timestamp': timestamp,
                'date': date_str,
                'time': time_str,
                'intensity': row[4] or 3,
                'is_from_login': row[2] == 'Auto-detected during login'
            })
        
        # Get current emotion (most recent)
        current_emotion = emotion_history[0] if emotion_history else None
        
        # Get schedule density for context
        schedule_density = get_schedule_density(user_id, days=7)
        
        # Debug info
        print(f"🎯 Current emotion: {current_emotion}")
        print(f"📈 Total emotions in history: {len(emotion_history)}")
        print(f"📅 Schedule density: {schedule_density['density_level'] if schedule_density else 'unknown'}")
        
        return render_template('emotion_history.html',
                             user_name=user[0] if user else 'User',
                             user_email=user[1] if user else '',
                             emotion_history=emotion_history,
                             current_emotion=current_emotion,
                             schedule_density=schedule_density,
                             get_emotion_icon=get_emotion_icon,
                             get_emotion_display_name=get_emotion_display_name)
    
    except Exception as e:
        print(f"❌ Error in /emotion route: {e}")
        traceback.print_exc()
        flash(f"Error loading emotion page: {str(e)}", "error")
        return redirect(url_for("dashboard"))

# Other routes...
@app.route("/chat")
def chat():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("health_history.html")

@app.route("/speak")
def speak():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("speak_nara.html")

@app.route("/calendar")
def calendar():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("calendar.html")

@app.route("/health")
def health():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("health.html")

@app.route("/profile")
def profile():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("profile.html")

@app.route("/settings")
def settings():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("settings.html")

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

# Error handlers
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500

@app.route('/clean-duplicates')
def clean_duplicates():
    """Clean duplicate emotions (admin function)"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    deleted = clean_duplicate_emotions()
    return jsonify({
        "success": True,
        "message": f"Cleaned {deleted} duplicate emotions"
    })

if __name__ == "__main__":
    print("🚀 Starting Flask app...")
    print(f"📁 Using database: {DB_PATH}")
    
    # Initialize database
    init_db()
    
    # Clean duplicates on startup
    deleted = clean_duplicate_emotions()
    if deleted > 0:
        print(f"🧹 Cleaned {deleted} duplicate emotions on startup")
    
    app.run(debug=True, port=5000, threaded=True)