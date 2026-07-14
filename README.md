# 🧠 Emotion-Based Intelligent Scheduling System (Nara Calendar)

Nara Calendar is a smart Flask web application designed to help users manage their daily tasks while maintaining their mental well-being. By combining face authentication, real-time emotion detection, and a rule-based expert system, it provides personalized schedule recommendations to prevent burnout.

## ✨ Features
* 🔐 **Face Login** – Secure, passwordless authentication using a webcam and dlib ResNet face encodings.
* 🎭 **Real-Time Emotion Tracking** – Detects 8 emotion categories (Happy, Sad, Angry, etc.) using DeepFace (VGG-Face).
* 📅 **Intelligent Web Calendar** – A built-in local interactive calendar to log tasks and calculate schedule density.
* 🧠 **Expert System Engine** – Uses a forward-chaining engine with 127+ rules to give daily tips and schedule adjustments based on your mood, workload, and personality.

## 🛠️ Tech Stack
* **Backend:** Python, Flask, SQLite
* **AI & Computer Vision:** OpenCV, DeepFace, face_recognition (dlib ResNet model)
* **Frontend:** HTML5, CSS3, JavaScript (Webcam API)

## 👤 My Role: Lead Backend & AI Developer
* Built the Python AI pipelines for face login and emotion tracking using DeepFace and OpenCV.
* Wrote the forward-chaining expert system engine and mapped out the 127+ JSON rules.
* Developed the Flask backend MVC structure and managed the SQLite database tables.
* Designed the local interactive calendar logic to track task density and trigger mood-based advice.

## 🚀 Quick Start
1. Clone the repo: `git clone https://github.com/deadeaa/emotion-scheduling-system.git`
2. Install dependencies: `pip install -r requirements.txt`
3. Initialize the database: `python init_db.py`
4. Run the app: `python app.py` and open `http://localhost:5000`.