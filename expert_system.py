# expert_system.py
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import numpy as np

class EmotionExpertSystem:
    """Expert System for emotion analysis and recommendations"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.knowledge_base = self._load_knowledge_base()
        self.inference_rules = self._load_inference_rules()
        
    def _load_knowledge_base(self) -> Dict:
        """Load knowledge base from file or create default"""
        try:
            with open('knowledge_base.json', 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return self._create_default_knowledge_base()
    
    def _create_default_knowledge_base(self) -> Dict:
        """Create default knowledge base with more rules"""
        kb = {
            "emotion_patterns": {
                "morning_sadness": {
                    "conditions": ["time=morning", "emotion=sad", "energy_level=low"],
                    "conclusion": "possible_sleep_issue",
                    "confidence": 0.7,
                    "explanation": "Morning sadness is often related to poor sleep quality"
                },
                "afternoon_stress": {
                    "conditions": ["time=afternoon", "emotion=angry", "workload=high"],
                    "conclusion": "work_burnout",
                    "confidence": 0.8,
                    "explanation": "Anger in the afternoon with high workload indicates burnout"
                },
                "weekend_happy": {
                    "conditions": ["day=weekend", "emotion=happy", "social_activity=yes"],
                    "conclusion": "social_wellbeing",
                    "confidence": 0.9,
                    "explanation": "Happiness on weekends with social activities shows good social wellbeing"
                },
                "schedule_induced_stress": {
                    "conditions": ["schedule_density=high", "emotion=angry", "time=afternoon"],
                    "conclusion": "overwhelmed_schedule",
                    "confidence": 0.85,
                    "explanation": "Anger with a dense schedule indicates being overwhelmed"
                },
                "work_life_imbalance": {
                    "conditions": ["work_hours=high", "personal_time=low", "emotion=sad"],
                    "conclusion": "imbalance_detected",
                    "confidence": 0.75,
                    "explanation": "Sadness with high work hours and low personal time suggests imbalance"
                }
            },
            
            "recommendation_rules": {
                "happy": {
                    "productivity": "high",
                    "social_boost": True,
                    "learning_opportunity": "excellent",
                    "suggestions": [
                        {"action": "tackle_challenging_tasks", "priority": 1},
                        {"action": "socialize_and_network", "priority": 2},
                        {"action": "learn_new_skill", "priority": 3}
                    ]
                },
                "sad": {
                    "productivity": "low",
                    "needs_self_care": True,
                    "social_support_needed": True,
                    "suggestions": [
                        {"action": "gentle_exercise", "priority": 1},
                        {"action": "talk_to_friend", "priority": 2},
                        {"action": "creative_expression", "priority": 3}
                    ]
                },
                "angry": {
                    "energy_level": "high",
                    "needs_outlet": True,
                    "conflict_risk": "medium",
                    "suggestions": [
                        {"action": "physical_activity", "priority": 1},
                        {"action": "mindfulness_practice", "priority": 2},
                        {"action": "problem_solving", "priority": 3}
                    ]
                },
                "neutral": {
                    "productivity": "moderate",
                    "focus_level": "high",
                    "decision_making": "good",
                    "suggestions": [
                        {"action": "deep_work", "priority": 1},
                        {"action": "strategic_planning", "priority": 2},
                        {"action": "skill_practice", "priority": 3}
                    ]
                },
                "fear": {
                    "productivity": "low",
                    "needs_reassurance": True,
                    "risk_aversion": "high",
                    "suggestions": [
                        {"action": "break_down_tasks", "priority": 1},
                        {"action": "seek_support", "priority": 2},
                        {"action": "gradual_exposure", "priority": 3}
                    ]
                },
                "excited": {
                    "productivity": "high",
                    "creativity": "high",
                    "distraction_risk": "medium",
                    "suggestions": [
                        {"action": "channel_energy", "priority": 1},
                        {"action": "start_new_project", "priority": 2},
                        {"action": "share_excitement", "priority": 3}
                    ]
                }
            },
            
            "context_factors": {
                "time_of_day_impact": {
                    "morning": {"productivity": 0.8, "mood_volatility": 0.3},
                    "afternoon": {"productivity": 0.6, "mood_volatility": 0.5},
                    "evening": {"productivity": 0.4, "mood_volatility": 0.7},
                    "night": {"productivity": 0.3, "mood_volatility": 0.8}
                },
                "day_type_impact": {
                    "weekday": {"stress_level": 0.7, "social_opportunity": 0.3},
                    "weekend": {"stress_level": 0.2, "social_opportunity": 0.8}
                },
                "schedule_density_impact": {
                    "low": {"stress_risk": 0.2, "free_time": 0.8},
                    "medium": {"stress_risk": 0.5, "free_time": 0.5},
                    "high": {"stress_risk": 0.8, "free_time": 0.2},
                    "very_high": {"stress_risk": 0.9, "free_time": 0.1}
                }
            },
            
            "user_profiles": {
                "introvert": {
                    "recharge_method": "solitude",
                    "social_limit": 3,
                    "preferred_activities": ["reading", "writing", "individual_sports", "meditation"],
                    "stress_response": "withdraw"
                },
                "extrovert": {
                    "recharge_method": "socializing",
                    "social_limit": 8,
                    "preferred_activities": ["group_activities", "parties", "team_sports", "networking"],
                    "stress_response": "seek_company"
                },
                "ambivert": {
                    "recharge_method": "balanced",
                    "social_limit": 5,
                    "preferred_activities": ["small_groups", "varied_activities", "casual_socializing"],
                    "stress_response": "mixed"
                }
            },
            
            "schedule_recommendations": {
                "high_density": {
                    "immediate": [
                        "Schedule 15-minute breaks between meetings",
                        "Block 1-hour focus time daily",
                        "Prioritize top 3 tasks only"
                    ],
                    "long_term": [
                        "Delegate lower-priority tasks",
                        "Learn to say no to non-essential meetings",
                        "Implement time blocking system"
                    ]
                },
                "work_life_balance": {
                    "work_hours_high": [
                        "Set strict work end time",
                        "Schedule personal time in calendar",
                        "Turn off work notifications after hours"
                    ],
                    "no_personal_time": [
                        "Block personal time first",
                        "Schedule hobbies as appointments",
                        "Practice digital detox on weekends"
                    ]
                },
                "stress_management": {
                    "preventive": [
                        "Morning meditation routine",
                        "Weekly review of commitments",
                        "Regular exercise schedule"
                    ],
                    "reactive": [
                        "5-minute breathing exercises",
                        "Quick walk outside",
                        "Listen to calming music"
                    ]
                }
            }
        }
        
        # Save to file
        with open('knowledge_base.json', 'w') as f:
            json.dump(kb, f, indent=2)
        
        return kb
    
    def _load_inference_rules(self) -> List[Dict]:
        """Rules for inference engine"""
        return [
            # Rule 1: Sleep quality inference
            {
                "name": "sleep_quality_inference",
                "conditions": [
                    "emotion_history.contains(morning_sadness, 3)",
                    "emotion=sad",
                    "time=morning"
                ],
                "action": "infer_sleep_issue",
                "confidence": 0.75
            },
            
            # Rule 2: Work-life balance inference
            {
                "name": "work_life_balance",
                "conditions": [
                    "emotion_history.weekday_negative_percentage > 0.7",
                    "emotion_history.weekend_positive_percentage > 0.8",
                    "schedule_density=high"
                ],
                "action": "infer_work_stress",
                "confidence": 0.85
            },
            
            # Rule 3: Social wellbeing inference
            {
                "name": "social_wellbeing",
                "conditions": [
                    "emotion=happy",
                    "social_interaction_recent=true",
                    "day=weekend"
                ],
                "action": "infer_social_benefit",
                "confidence": 0.9
            },
            
            # Rule 4: Stress buildup detection
            {
                "name": "stress_buildup",
                "conditions": [
                    "emotion_history.angry_increase_last_3_days > 0.3",
                    "schedule_density=high",
                    "productivity_trend=decreasing"
                ],
                "action": "alert_stress_buildup",
                "confidence": 0.8
            },
            
            # Rule 5: Schedule-induced stress
            {
                "name": "schedule_induced_stress",
                "conditions": [
                    "schedule_density in [high, very_high]",
                    "emotion in [angry, sad, fear]",
                    "time=afternoon"
                ],
                "action": "infer_schedule_stress",
                "confidence": 0.85
            },
            
            # Rule 6: Burnout risk
            {
                "name": "burnout_risk",
                "conditions": [
                    "schedule_density=very_high",
                    "emotion_history.negative_streak > 5",
                    "sleep_quality=poor"
                ],
                "action": "alert_burnout_risk",
                "confidence": 0.9
            },
            
            # Rule 7: Need for breaks
            {
                "name": "need_for_breaks",
                "conditions": [
                    "consecutive_work_hours > 6",
                    "emotion=angry",
                    "focus_level=low"
                ],
                "action": "suggest_breaks",
                "confidence": 0.8
            }
        ]
    
    def get_context_factors(self) -> Dict:
        """Get contextual factors (time, day, etc)"""
        now = datetime.now()
        
        # Determine time of day
        hour = now.hour
        if 5 <= hour < 12:
            time_of_day = "morning"
        elif 12 <= hour < 17:
            time_of_day = "afternoon"
        elif 17 <= hour < 22:
            time_of_day = "evening"
        else:
            time_of_day = "night"
        
        # Determine day type
        weekday = now.weekday()  # 0 = Monday, 6 = Sunday
        day_type = "weekend" if weekday >= 5 else "weekday"
        day_name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][weekday]
        
        # In Indonesia, we have 2 seasons: dry and rainy
        month = now.month
        # Dry season: April-September, Rainy season: October-March
        season = "dry" if 4 <= month <= 9 else "rainy"
        
        return {
            "time_of_day": time_of_day,
            "day_type": day_type,
            "day_name": day_name,
            "season": season,
            "hour": hour,
            "weekday": weekday,
            "date": now.strftime("%Y-%m-%d"),
            "timestamp": now.isoformat()
        }
    
    def get_schedule_context(self, user_id: int) -> Dict:
        """Get schedule-related context"""
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            
            # Get today's events count
            today = datetime.now().strftime('%Y-%m-%d')
            c.execute('''
                SELECT COUNT(*) FROM calendar_events 
                WHERE user_id = ? AND DATE(start_time) = ?
            ''', (user_id, today))
            today_events = c.fetchone()[0]
            
            # Get consecutive work hours (simplified)
            c.execute('''
                SELECT start_time, end_time FROM calendar_events 
                WHERE user_id = ? AND DATE(start_time) = ?
                ORDER BY start_time
            ''', (user_id, today))
            
            events = c.fetchall()
            consecutive_hours = 0
            if events:
                # Simple calculation: assume events are work-related
                work_hours = len(events) * 1.5  # Average 1.5 hours per event
                consecutive_hours = min(work_hours, 8)
            
            # Check if has personal time today
            c.execute('''
                SELECT COUNT(*) FROM calendar_events 
                WHERE user_id = ? AND DATE(start_time) = ?
                AND (title LIKE '%lunch%' OR title LIKE '%break%' OR title LIKE '%personal%' 
                     OR title LIKE '%exercise%' OR title LIKE '%relax%')
            ''', (user_id, today))
            personal_events = c.fetchone()[0]
            
            conn.close()
            
            return {
                "today_events": today_events,
                "consecutive_work_hours": consecutive_hours,
                "has_personal_time": personal_events > 0,
                "personal_events_count": personal_events,
                "work_life_balance_today": "good" if personal_events >= 2 else "poor" if personal_events == 0 else "fair"
            }
            
        except Exception as e:
            print(f"❌ Error getting schedule context: {e}")
            return {
                "today_events": 0,
                "consecutive_work_hours": 0,
                "has_personal_time": False,
                "personal_events_count": 0,
                "work_life_balance_today": "unknown"
            }
    
    def analyze_emotion_pattern(self, user_id: int, current_emotion: str) -> Dict:
        """Analyze emotion patterns with forward chaining"""
        
        # Get user history
        history = self._get_emotion_history(user_id)
        context = self.get_context_factors()
        schedule_context = self.get_schedule_context(user_id)
        
        # Get schedule density from database
        schedule_density = self._get_schedule_density(user_id)
        
        # Collect facts
        facts = {
            "emotion": current_emotion,
            "time": context["time_of_day"],
            "day": context["day_type"],
            "day_name": context["day_name"],
            "season": context["season"],
            "history_length": len(history),
            "recent_emotions": [h["emotion"] for h in history[-5:]] if history else [],
            "today_events": schedule_context["today_events"],
            "consecutive_work_hours": schedule_context["consecutive_work_hours"],
            "has_personal_time": schedule_context["has_personal_time"],
            "work_life_balance": schedule_context["work_life_balance_today"],
            "schedule_density": schedule_density.get("density_level", "low") if schedule_density else "low"
        }
        
        # Add calculated facts
        facts.update(self._calculate_pattern_facts(history))
        
        # Add schedule facts
        facts.update(self._calculate_schedule_facts(user_id))
        
        # Forward chaining inference
        conclusions = []
        explanations = []
        
        # Apply inference rules
        for rule in self.inference_rules:
            if self._evaluate_conditions(rule["conditions"], facts):
                conclusion = {
                    "type": rule["action"],
                    "confidence": rule["confidence"],
                    "rule": rule["name"]
                }
                conclusions.append(conclusion)
                
                # Generate explanation
                explanation = self._generate_explanation(rule, facts)
                explanations.append(explanation)
        
        # Check knowledge base patterns
        pattern_results = self._check_knowledge_base_patterns(facts)
        
        return {
            "facts": facts,
            "conclusions": conclusions,
            "explanations": explanations,
            "patterns": pattern_results,
            "context": context,
            "schedule_context": schedule_context,
            "schedule_density": schedule_density
        }
    
    def _get_emotion_history(self, user_id: int) -> List[Dict]:
        """Get emotion history from database"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        c.execute('''
            SELECT emotion, timestamp, note, intensity 
            FROM emotion_logs 
            WHERE user_id = ? 
            ORDER BY timestamp DESC
            LIMIT 50
        ''', (user_id,))
        
        rows = c.fetchall()
        conn.close()
        
        history = []
        for row in rows:
            emotion, timestamp, note, intensity = row
            history.append({
                "emotion": emotion,
                "timestamp": timestamp,
                "note": note,
                "intensity": intensity
            })
        
        return history
    
    def _get_schedule_density(self, user_id: int) -> Dict:
        """Get schedule density analysis"""
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            
            # Get events from last 7 days
            date_limit = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
            
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
                avg_events_per_day = event_count / 7
                
                # Calculate density score (0-1)
                event_density = min(avg_events_per_day / 5, 1.0)
                hour_density = min((total_hours / 7) / 10, 1.0)
                
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
                    'avg_hours_per_day': round((total_hours or 0) / 7, 1),
                    'density_score': round(overall_density, 2),
                    'density_level': level
                }
            
            return {
                'event_count': 0,
                'total_hours': 0,
                'avg_events_per_day': 0,
                'avg_hours_per_day': 0,
                'density_score': 0,
                'density_level': 'low'
            }
            
        except Exception as e:
            print(f"❌ Error getting schedule density: {e}")
            return {
                'event_count': 0,
                'total_hours': 0,
                'avg_events_per_day': 0,
                'avg_hours_per_day': 0,
                'density_score': 0,
                'density_level': 'low'
            }
    
    def _calculate_pattern_facts(self, history: List[Dict]) -> Dict:
        """Calculate statistical facts from history"""
        if not history:
            return {}
        
        emotions = [h["emotion"] for h in history]
        intensities = [h.get("intensity", 3) for h in history]
        
        # Calculate emotion frequency
        from collections import Counter
        emotion_counts = Counter(emotions)
        
        # Calculate trends
        if len(emotions) >= 3:
            recent = emotions[:3]
            older = emotions[-3:] if len(emotions) >= 6 else emotions[3:6]
            
            # Simple trend analysis
            positive_emotions = ["happy", "excited", "relaxed"]
            negative_emotions = ["sad", "angry", "fear"]
            
            recent_pos = sum(1 for e in recent if e in positive_emotions)
            older_pos = sum(1 for e in older if e in positive_emotions)
            trend = "improving" if recent_pos > older_pos else "declining" if recent_pos < older_pos else "stable"
            
            # Negative streak
            negative_streak = 0
            for emotion in emotions[:5]:  # Check last 5
                if emotion in negative_emotions:
                    negative_streak += 1
                else:
                    break
        else:
            trend = "insufficient_data"
            negative_streak = 0
        
        # Calculate weekday vs weekend patterns (simplified)
        weekday_negative = 0
        weekend_negative = 0
        # Note: This would need actual date parsing for accurate calculation
        
        return {
            "total_entries": len(history),
            "most_common_emotion": emotion_counts.most_common(1)[0][0] if emotion_counts else None,
            "most_common_count": emotion_counts.most_common(1)[0][1] if emotion_counts else 0,
            "average_intensity": np.mean(intensities) if intensities else 0,
            "emotion_variety": len(set(emotions)),
            "trend": trend,
            "negative_streak": negative_streak,
            "emotion_counts": dict(emotion_counts),
            "positive_count": sum(1 for e in emotions if e in ["happy", "excited", "relaxed"]),
            "negative_count": sum(1 for e in emotions if e in ["sad", "angry", "fear"]),
            "neutral_count": sum(1 for e in emotions if e == "neutral")
        }
    
    def _calculate_schedule_facts(self, user_id: int) -> Dict:
        """Calculate schedule-related facts"""
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            
            # Get work vs personal events ratio
            today = datetime.now().strftime('%Y-%m-%d')
            c.execute('''
                SELECT 
                    SUM(CASE WHEN title LIKE '%meeting%' OR title LIKE '%work%' 
                              OR title LIKE '%project%' OR description LIKE '%work%' THEN 1 ELSE 0 END) as work_events,
                    SUM(CASE WHEN title LIKE '%lunch%' OR title LIKE '%break%' 
                              OR title LIKE '%personal%' OR title LIKE '%exercise%' 
                              OR title LIKE '%relax%' THEN 1 ELSE 0 END) as personal_events
                FROM calendar_events 
                WHERE user_id = ? AND DATE(start_time) = ?
            ''', (user_id, today))
            
            result = c.fetchone()
            work_events = result[0] if result else 0
            personal_events = result[1] if result else 0
            
            # Calculate work-life balance score
            total_events = work_events + personal_events
            if total_events > 0:
                work_life_ratio = personal_events / total_events
                if work_life_ratio > 0.3:
                    balance = "good"
                elif work_life_ratio > 0.1:
                    balance = "fair"
                else:
                    balance = "poor"
            else:
                balance = "no_events"
            
            conn.close()
            
            return {
                "work_events_today": work_events,
                "personal_events_today": personal_events,
                "work_life_ratio_today": work_life_ratio if total_events > 0 else 0,
                "work_life_balance_today": balance
            }
            
        except Exception as e:
            print(f"❌ Error calculating schedule facts: {e}")
            return {
                "work_events_today": 0,
                "personal_events_today": 0,
                "work_life_ratio_today": 0,
                "work_life_balance_today": "unknown"
            }
    
    def _evaluate_conditions(self, conditions: List[str], facts: Dict) -> bool:
        """Evaluate rule conditions (simplified)"""
        for condition in conditions:
            if "=" in condition:
                key, expected = condition.split("=")
                if key not in facts:
                    return False
                if isinstance(facts[key], list):
                    if expected not in facts[key]:
                        return False
                elif str(facts[key]) != expected:
                    return False
            elif ">" in condition:
                # Simple comparison handling
                if ">" in condition:
                    key, value = condition.split(">")
                    if key not in facts:
                        return False
                    try:
                        if not (float(facts[key]) > float(value)):
                            return False
                    except:
                        return False
            elif " in " in condition:
                # Handle "value in list" conditions
                key, list_str = condition.split(" in ")
                list_str = list_str.strip("[]")
                expected_values = [v.strip() for v in list_str.split(",")]
                if key not in facts:
                    return False
                if facts[key] not in expected_values:
                    return False
        
        return True
    
    def _check_knowledge_base_patterns(self, facts: Dict) -> List[Dict]:
        """Check patterns in knowledge base"""
        patterns = []
        
        for pattern_name, pattern_data in self.knowledge_base["emotion_patterns"].items():
            # Check if all conditions match
            conditions_met = all(
                self._check_condition(cond, facts) 
                for cond in pattern_data["conditions"]
            )
            
            if conditions_met:
                patterns.append({
                    "name": pattern_name,
                    "conclusion": pattern_data["conclusion"],
                    "confidence": pattern_data["confidence"],
                    "explanation": pattern_data["explanation"]
                })
        
        return patterns
    
    def _check_condition(self, condition: str, facts: Dict) -> bool:
        """Check single condition"""
        if "=" in condition:
            key, expected = condition.split("=")
            return key in facts and str(facts[key]) == expected
        return False
    
    def _generate_explanation(self, rule: Dict, facts: Dict) -> str:
        """Generate explanation for conclusion"""
        explanations = {
            "infer_sleep_issue": 
                f"Based on pattern: feeling {facts.get('emotion')} in the {facts.get('time')} "
                f"multiple times suggests possible sleep issues.",
            
            "infer_work_stress":
                f"Your schedule density is {facts.get('schedule_density')} with "
                f"{facts.get('work_events_today', 0)} work events today, "
                "indicating potential work-related stress.",
            
            "infer_social_benefit":
                f"Happiness appears more frequently on {facts.get('day_name')} "
                "suggesting social activities benefit your wellbeing.",
            
            "alert_stress_buildup":
                f"Increase in negative emotions with {facts.get('schedule_density')} schedule density "
                "indicates stress buildup.",
            
            "infer_schedule_stress":
                f"Feeling {facts.get('emotion')} in the {facts.get('time')} with "
                f"{facts.get('schedule_density')} schedule suggests schedule-induced stress. "
                f"Consider: {facts.get('today_events', 0)} events today.",
            
            "alert_burnout_risk":
                f"Very high schedule density with {facts.get('negative_streak', 0)} "
                "consecutive negative emotions indicates burnout risk.",
            
            "suggest_breaks":
                f"After {facts.get('consecutive_work_hours', 0)} hours of work feeling "
                f"{facts.get('emotion')} suggests need for breaks."
        }
        
        return explanations.get(rule["action"], "The system detected certain patterns in your emotions and schedule.")
    
    def generate_personalized_recommendations(self, user_id: int, 
                                            current_emotion: str,
                                            analysis_results: Dict = None) -> Dict:
        """Generate personalized recommendations"""
        
        if analysis_results is None:
            analysis_results = self.analyze_emotion_pattern(user_id, current_emotion)
        
        # Get user profile (simplified - could be from database)
        user_profile = self._get_user_profile(user_id)
        
        # Base recommendations from knowledge base
        emotion_rules = self.knowledge_base["recommendation_rules"].get(
            current_emotion, 
            self.knowledge_base["recommendation_rules"]["neutral"]
        )
        
        # Adapt based on context
        context = analysis_results["context"]
        time_impact = self.knowledge_base["context_factors"]["time_of_day_impact"][context["time_of_day"]]
        day_impact = self.knowledge_base["context_factors"]["day_type_impact"][context["day_type"]]
        
        # Get schedule density impact
        schedule_density = analysis_results.get("schedule_density", {})
        density_level = schedule_density.get("density_level", "low")
        density_impact = self.knowledge_base["context_factors"]["schedule_density_impact"][density_level]
        
        # Personalize based on profile
        if user_profile["personality"] == "introvert":
            # Adjust social suggestions for introverts
            base_suggestions = emotion_rules["suggestions"]
            personalized_suggestions = []
            
            for suggestion in base_suggestions:
                action = suggestion["action"]
                if any(social_word in action for social_word in ["social", "network", "party"]) \
                   and user_profile["social_battery"] < 30:
                    # Replace social activities with alternatives for introverts
                    alt_action = "solitary_" + action
                    personalized_suggestions.append({
                        **suggestion,
                        "action": alt_action,
                        "personalized_reason": "Adjusted for introvert preferences"
                    })
                else:
                    personalized_suggestions.append(suggestion)
        else:
            personalized_suggestions = emotion_rules["suggestions"]
        
        # Add schedule-based recommendations
        schedule_recommendations = []
        schedule_context = analysis_results.get("schedule_context", {})
        
        if density_level in ["high", "very_high"]:
            schedule_recommendations.extend(
                self.knowledge_base["schedule_recommendations"]["high_density"]["immediate"]
            )
        
        if schedule_context.get("work_life_balance_today") == "poor":
            schedule_recommendations.extend(
                self.knowledge_base["schedule_recommendations"]["work_life_balance"]["no_personal_time"]
            )
        
        if analysis_results.get("facts", {}).get("consecutive_work_hours", 0) > 4:
            schedule_recommendations.extend(
                self.knowledge_base["schedule_recommendations"]["stress_management"]["reactive"]
            )
        
        # Add recommendations based on detected patterns
        pattern_recommendations = []
        for pattern in analysis_results.get("patterns", []):
            if pattern["conclusion"] == "possible_sleep_issue":
                pattern_recommendations.append({
                    "category": "sleep_improvement",
                    "actions": [
                        "Turn off devices 1 hour before bed",
                        "Maintain consistent sleep schedule",
                        "Reduce caffeine after 3 PM",
                        "Create relaxing bedtime routine"
                    ],
                    "priority": 1,
                    "reason": pattern["explanation"]
                })
            elif pattern["conclusion"] == "work_burnout":
                pattern_recommendations.append({
                    "category": "burnout_prevention",
                    "actions": [
                        "Take 5-minute breaks every 25 minutes (Pomodoro)",
                        "Schedule 'me time' in calendar",
                        "Discuss workload with supervisor",
                        "Practice stress-relief techniques"
                    ],
                    "priority": 1,
                    "reason": pattern["explanation"]
                })
            elif pattern["conclusion"] == "overwhelmed_schedule":
                pattern_recommendations.append({
                    "category": "schedule_management",
                    "actions": [
                        "Review and cancel non-essential meetings",
                        "Batch similar tasks together",
                        "Use time blocking technique",
                        "Delegate when possible"
                    ],
                    "priority": 1,
                    "reason": pattern["explanation"]
                })
        
        # Generate certainty factors
        certainty_factors = {
            "emotion_certainty": 0.85,  # from DeepFace confidence
            "pattern_certainty": analysis_results["patterns"][0]["confidence"] 
                                if analysis_results["patterns"] else 0.5,
            "schedule_analysis_certainty": 0.8 if schedule_density else 0.5,
            "personalization_fit": self._calculate_recommendation_fit(
                personalized_suggestions, user_profile
            )
        }
        
        overall_confidence = np.mean(list(certainty_factors.values()))
        
        # Season-specific suggestions for Indonesia
        season_suggestions = []
        if context["season"] == "rainy":
            season_suggestions = [
                "Rainy season might affect mood - try indoor activities",
                "Consider vitamin D supplements during prolonged cloudy days",
                "Rain sounds can be relaxing for meditation"
            ]
        elif context["season"] == "dry":
            season_suggestions = [
                "Dry season is great for outdoor activities",
                "Stay hydrated in the heat",
                "Morning is the best time for outdoor exercises"
            ]
        
        return {
            "emotion": current_emotion,
            "base_recommendations": personalized_suggestions,
            "schedule_recommendations": schedule_recommendations,
            "pattern_based_recommendations": pattern_recommendations,
            "season_suggestions": season_suggestions,
            "certainty_factors": certainty_factors,
            "overall_confidence": round(overall_confidence, 2),
            "context_adaptations": {
                "time_of_day": time_impact,
                "day_type": day_impact,
                "schedule_density": density_impact
            },
            "explanations": analysis_results.get("explanations", []),
            "personalization_note": f"Adjusted for {user_profile['personality']} "
                                  f"with social battery {user_profile['social_battery']}%",
            "schedule_insight": f"Schedule density: {density_level.upper()} "
                              f"({schedule_density.get('avg_events_per_day', 0)} events/day)"
        }
    
    def _get_user_profile(self, user_id: int) -> Dict:
        """Get user profile (simulation - could be from database)"""
        # This is a simple example, could be extended
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        c.execute("SELECT name FROM users WHERE id=?", (user_id,))
        result = c.fetchone()
        conn.close()
        
        # Simple personality detection based on name length (example only)
        name = result[0] if result else "User"
        name_len = len(name)
        
        if name_len < 5:
            personality = "extrovert"
            social_battery = 80
        elif name_len < 8:
            personality = "ambivert"
            social_battery = 50
        else:
            personality = "introvert"
            social_battery = 30
        
        return {
            "personality": personality,
            "social_battery": social_battery,
            "preferred_activities": 
                self.knowledge_base["user_profiles"][personality]["preferred_activities"],
            "stress_response": 
                self.knowledge_base["user_profiles"][personality]["stress_response"]
        }
    
    def _calculate_recommendation_fit(self, recommendations: List, profile: Dict) -> float:
        """Calculate how well recommendations fit user profile"""
        if not recommendations:
            return 0.5
        
        fit_scores = []
        for rec in recommendations:
            action = rec.get("action", "")
            
            # Check if activity matches preferences
            if any(pref in action for pref in profile["preferred_activities"]):
                fit_scores.append(0.9)
            elif any(social_word in action for social_word in ["social", "network"]) \
                 and profile["social_battery"] > 60:
                fit_scores.append(0.8)
            elif any(solitary_word in action for solitary_word in ["solitary", "alone", "meditation"]) \
                 and profile["social_battery"] < 40:
                fit_scores.append(0.85)
            else:
                fit_scores.append(0.6)
        
        return np.mean(fit_scores) if fit_scores else 0.5
    
    def save_knowledge_to_db(self, user_id: int, feedback: Dict):
        """Save feedback for knowledge base improvement (learning)"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS system_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                emotion TEXT,
                recommendation TEXT,
                was_helpful BOOLEAN,
                feedback TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        c.execute('''
            INSERT INTO system_feedback 
            (user_id, emotion, recommendation, was_helpful, feedback)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            user_id,
            feedback.get("emotion"),
            feedback.get("recommendation"),
            feedback.get("was_helpful", True),
            feedback.get("feedback", "")
        ))
        
        conn.commit()
        conn.close()
        
        # Update knowledge base based on feedback
        self._update_knowledge_from_feedback(feedback)
    
    def _update_knowledge_from_feedback(self, feedback: Dict):
        """Update knowledge base based on feedback"""
        emotion = feedback.get("emotion")
        recommendation = feedback.get("recommendation")
        was_helpful = feedback.get("was_helpful", True)
        
        if emotion and recommendation and emotion in self.knowledge_base["recommendation_rules"]:
            rules = self.knowledge_base["recommendation_rules"][emotion]
            
            if was_helpful:
                # Increase priority of this recommendation
                for suggestion in rules["suggestions"]:
                    if suggestion["action"] == recommendation:
                        suggestion["priority"] = max(1, suggestion.get("priority", 1) - 1)
            else:
                # Decrease priority
                for suggestion in rules["suggestions"]:
                    if suggestion["action"] == recommendation:
                        suggestion["priority"] = min(5, suggestion.get("priority", 1) + 1)
            
            # Save updated knowledge base
            with open('knowledge_base.json', 'w') as f:
                json.dump(self.knowledge_base, f, indent=2)