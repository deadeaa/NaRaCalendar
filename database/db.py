import sqlite3
import os
import json
from datetime import datetime

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "instance", "database.db")

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database with all required tables"""
    print(f"🔄 Initializing database: {DB_PATH}")
    
    # Ensure instance directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            face_encoding BLOB NOT NULL,
            google_verified BOOLEAN DEFAULT FALSE,
            last_emotion TEXT,
            emotion_history TEXT DEFAULT '[]',
            google_calendar_enabled BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # NEW: User settings table for personality
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            personality_type TEXT CHECK(personality_type IN ('introvert', 'extrovert', 'ambivert')),
            confidence REAL DEFAULT 0.5,
            notification_enabled BOOLEAN DEFAULT 1,
            theme TEXT DEFAULT 'light',
            language TEXT DEFAULT 'en',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # Calendar events table
    c.execute('''
        CREATE TABLE IF NOT EXISTS calendar_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Emotion logs table
    c.execute('''
        CREATE TABLE IF NOT EXISTS emotion_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            emotion TEXT NOT NULL,
            note TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            intensity INTEGER DEFAULT 3,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # NEW: Personality recommendations table
    c.execute('''
        CREATE TABLE IF NOT EXISTS personality_recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            recommendation_type TEXT,
            content TEXT NOT NULL,
            relevance_score REAL DEFAULT 0.5,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # Create indexes for better performance
    c.execute('''
        CREATE INDEX IF NOT EXISTS idx_user_settings_user_id 
        ON user_settings(user_id)
    ''')
    
    c.execute('''
        CREATE INDEX IF NOT EXISTS idx_emotion_logs_user_id 
        ON emotion_logs(user_id)
    ''')
    
    c.execute('''
        CREATE INDEX IF NOT EXISTS idx_emotion_logs_timestamp 
        ON emotion_logs(timestamp)
    ''')
    
    c.execute('''
        CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id 
        ON calendar_events(user_id)
    ''')
    
    c.execute('''
        CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time 
        ON calendar_events(start_time)
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Database initialized successfully")

def migrate_user_personality():
    """Migrate existing users to have personality data"""
    print("🚀 Migrating existing users for personality system...")
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Get all existing users
    c.execute('SELECT id, name, email FROM users')
    all_users = c.fetchall()
    
    print(f"📊 Found {len(all_users)} total users")
    
    # Get users without personality settings
    c.execute('''
        SELECT u.id, u.name, u.email 
        FROM users u 
        LEFT JOIN user_settings us ON u.id = us.user_id 
        WHERE us.user_id IS NULL
    ''')
    users_to_migrate = c.fetchall()
    
    print(f"🔄 {len(users_to_migrate)} users need personality migration")
    
    migrated_count = 0
    
    for user_id, name, email in users_to_migrate:
        try:
            # Determine default personality based on email pattern (simple heuristic)
            default_personality = determine_default_personality(email, name)
            
            # Insert default personality settings
            c.execute('''
                INSERT INTO user_settings (user_id, personality_type, confidence)
                VALUES (?, ?, ?)
            ''', (user_id, default_personality, 0.3))  # Low confidence karena guessed
            
            migrated_count += 1
            
            if migrated_count % 10 == 0:
                print(f"  ✅ Migrated {migrated_count} users...")
                
        except Exception as e:
            print(f"  ❌ Error migrating user {user_id}: {e}")
    
    conn.commit()
    
    # Update statistics
    c.execute('SELECT COUNT(*) FROM user_settings')
    total_with_personality = c.fetchone()[0]
    
    print("\n" + "="*50)
    print(f"✅ Migration complete!")
    print(f"   Total users in system: {len(all_users)}")
    print(f"   Users with personality: {total_with_personality}")
    print(f"   Migrated: {migrated_count}")
    print("="*50 + "\n")
    
    conn.close()
    return migrated_count

def determine_default_personality(email, name):
    """Simple heuristic to determine default personality"""
    # Based on email domain patterns
    email_lower = email.lower()
    
    # Extrovert patterns: often in sales, marketing, social domains
    extrovert_domains = ['sales', 'market', 'social', 'media', 'party', 'event']
    if any(domain in email_lower for domain in extrovert_domains):
        return 'extrovert'
    
    # Introvert patterns: often in tech, research, academic domains
    introvert_domains = ['tech', 'research', 'study', 'academic', 'lab', 'dev', 'engineer']
    if any(domain in email_lower for domain in introvert_domains):
        return 'introvert'
    
    # Based on name length (simple heuristic)
    name_len = len(name.replace(" ", ""))
    if name_len < 5:
        return 'extrovert'
    elif name_len < 10:
        return 'ambivert'
    else:
        return 'introvert'

def get_user_personality(user_id):
    """Get user's personality type"""
    try:
        conn = get_db()
        c = conn.cursor()
        
        c.execute('''
            SELECT personality_type, confidence 
            FROM user_settings 
            WHERE user_id = ?
        ''', (user_id,))
        
        result = c.fetchone()
        conn.close()
        
        if result:
            return {
                'personality': result[0],
                'confidence': result[1],
                'has_personality': True
            }
        else:
            return {
                'personality': None,
                'confidence': 0,
                'has_personality': False
            }
        
    except Exception as e:
        print(f"❌ Error getting personality: {e}")
        return None

def set_user_personality(user_id, personality_type):
    """Set user's personality type"""
    try:
        if personality_type not in ['introvert', 'extrovert', 'ambivert']:
            raise ValueError("Invalid personality type")
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if already exists
        c.execute('SELECT id FROM user_settings WHERE user_id = ?', (user_id,))
        exists = c.fetchone()
        
        if exists:
            # Update existing
            c.execute('''
                UPDATE user_settings 
                SET personality_type = ?, confidence = 0.9, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            ''', (personality_type, user_id))
        else:
            # Insert new
            c.execute('''
                INSERT INTO user_settings (user_id, personality_type, confidence)
                VALUES (?, ?, ?)
            ''', (user_id, personality_type, 0.9))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Personality set for user {user_id}: {personality_type}")
        return True
        
    except Exception as e:
        print(f"❌ Error setting personality: {e}")
        return False

def ensure_sample_events(user_id):
    """Create sample events if user has no events"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if user has any events
        c.execute('SELECT COUNT(*) FROM calendar_events WHERE user_id=?', (user_id,))
        count = c.fetchone()[0]
        
        print(f"📊 User {user_id} has {count} events")
        
        if count == 0:
            print(f"📝 Creating sample events for user {user_id}")
            
            today = datetime.now().date()
            
            sample_events = [
                {
                    'title': 'Morning Team Meeting',
                    'description': 'Daily standup with development team',
                    'start_time': f"{today} 09:00:00",
                    'end_time': f"{today} 10:00:00"
                },
                {
                    'title': 'Project Work Session',
                    'description': 'Focus on main project deliverables',
                    'start_time': f"{today} 11:00:00",
                    'end_time': f"{today} 13:00:00"
                },
                {
                    'title': 'Lunch Break',
                    'description': 'Lunch with colleagues',
                    'start_time': f"{today} 13:00:00",
                    'end_time': f"{today} 14:00:00"
                },
                {
                    'title': 'Client Presentation',
                    'description': 'Demo new features to client',
                    'start_time': f"{today} 15:00:00",
                    'end_time': f"{today} 16:30:00"
                }
            ]
            
            for event in sample_events:
                c.execute('''
                    INSERT INTO calendar_events 
                    (user_id, title, description, start_time, end_time)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    user_id, 
                    event['title'],
                    event['description'],
                    event['start_time'],
                    event['end_time']
                ))
                print(f"✅ Created: {event['title']}")
            
            conn.commit()
            print(f"🎉 Created {len(sample_events)} sample events")
        else:
            print(f"✅ User {user_id} already has events")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error ensuring sample events: {e}")
        import traceback
        traceback.print_exc()

def clean_duplicate_emotions():
    """Clean duplicate emotion logs from database"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        print("🧹 Cleaning duplicate emotion logs...")
        
        # Delete duplicates based on user_id, emotion, and timestamp (within 5 minutes)
        c.execute('''
            DELETE FROM emotion_logs 
            WHERE id NOT IN (
                SELECT MIN(id) 
                FROM emotion_logs 
                GROUP BY user_id, emotion, 
                strftime('%Y-%m-%d %H:%M', datetime(timestamp, '-5 minutes'))
            )
        ''')
        
        deleted_count = conn.total_changes
        conn.commit()
        conn.close()
        
        print(f"✅ Removed {deleted_count} duplicate emotion logs")
        return deleted_count
        
    except Exception as e:
        print(f"❌ Error cleaning duplicate emotions: {e}")
        return 0

def get_emotion_stats(user_id):
    """Get emotion statistics for a user"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Get total count
        c.execute('SELECT COUNT(*) FROM emotion_logs WHERE user_id=?', (user_id,))
        total = c.fetchone()[0]
        
        # Get most common emotion
        c.execute('''
            SELECT emotion, COUNT(*) as count 
            FROM emotion_logs 
            WHERE user_id=? 
            GROUP BY emotion 
            ORDER BY count DESC 
            LIMIT 1
        ''', (user_id,))
        most_common = c.fetchone()
        
        # Get average intensity
        c.execute('SELECT AVG(intensity) FROM emotion_logs WHERE user_id=?', (user_id,))
        avg_intensity = c.fetchone()[0]
        
        conn.close()
        
        return {
            'total': total,
            'most_common': most_common[0] if most_common else None,
            'most_common_count': most_common[1] if most_common else 0,
            'avg_intensity': round(avg_intensity or 3, 1)
        }
        
    except Exception as e:
        print(f"❌ Error getting emotion stats: {e}")
        return None

# Initialize database when imported
if __name__ == "__main__":
    init_db()
    migrated = migrate_user_personality()
    clean_duplicate_emotions()
    print(f"🚀 Database ready! Migrated {migrated} users.")
else:
    init_db()