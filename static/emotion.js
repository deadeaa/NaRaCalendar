class EmotionHistory {
    constructor() {
        this.currentEmotion = null;
        this.emotionHistory = [];
        this.selectedEmotion = null;
        this.chart = null;
        this.currentFilter = 'week';
        
        this.init();
    }

    async init() {
        console.log('🎭 Emotion History Initializing...');
        
        this.setupEventListeners();
        this.updateCurrentDate();
        await this.loadEmotionData(); // ✅ Hanya load dari API
        this.renderStats();
        this.setupChart();
        this.renderTimeline();
        this.generateInsights();
        
        console.log('✅ Emotion History initialized');
    }

    setupEventListeners() {
        // Filter buttons
        document.getElementById('filter-today').addEventListener('click', () => this.filterByDay('today'));
        document.getElementById('filter-week').addEventListener('click', () => this.filterByDay('week'));
        document.getElementById('filter-month').addEventListener('click', () => this.filterByDay('month'));
        
        // Emotion options
        document.querySelectorAll('.emotion-option').forEach(option => {
            option.addEventListener('click', () => {
                const emotion = option.getAttribute('onclick').match(/'([^']+)'/)[1];
                this.selectEmotion(emotion);
            });
        });
        
        // Note input
        document.getElementById('emotion-note').addEventListener('input', () => {
            this.updateSaveButton();
        });
    }

    updateCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options);
    }

    async loadEmotionData() {
        try {
            console.log('🔄 Loading emotion data from API...');
            
            // HAPUS SEMUA DATA LOKAL YANG LAMA
            localStorage.removeItem('emotion-history-mock');
            localStorage.removeItem('emotion-history-real');
            localStorage.removeItem('current-emotion-real');
            
            // ONLY LOAD FROM API - no fallback to mock data
            const response = await fetch('/api/emotion/history', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📊 API response:', data);
            
            if (data.success) {
                this.emotionHistory = this.formatEmotionData(data.history || []);
                this.currentEmotion = data.current ? this.formatEmotionData([data.current])[0] : null;
                
                console.log(`✅ Loaded ${this.emotionHistory.length} REAL emotion records from API`);
                
                // ✅ TIDAK PERLU SIMPAN KE localStorage
                // Biarkan semua data berasal dari database saja
            } else {
                throw new Error('API returned unsuccessful');
            }
            
            this.updateCurrentEmotionDisplay();
            this.updateEmotionCount();
            
        } catch (error) {
            console.error('❌ Error loading emotion data:', error);
            
            // ✅ JANGAN LOAD MOCK DATA SAMA SEKALI
            this.emotionHistory = [];
            this.currentEmotion = null;
            
            // Show empty state
            this.updateCurrentEmotionDisplay();
            this.updateEmotionCount();
            
            // Show error notification
            this.showNotification('❌ Failed to load emotion data. Please try again.', 'error');
        }
    }

    // Helper: Format emotion data consistently
    formatEmotionData(emotions) {
        return emotions.map(emotion => {
            const emotionNames = {
                'happy': '😊 Happy',
                'neutral': '😐 Neutral', 
                'sad': '😔 Sad',
                'angry': '😠 Angry',
                'excited': '🤩 Excited',
                'relaxed': '😌 Relaxed',
                'fear': '😨 Fear',
                'surprise': '😲 Surprise'
            };
            
            let timestamp;
            try {
                // ✅ FIXED: Handle different timestamp formats
                if (emotion.timestamp) {
                    if (typeof emotion.timestamp === 'string') {
                        // Try ISO format first
                        if (emotion.timestamp.includes('T')) {
                            timestamp = new Date(emotion.timestamp);
                        } else {
                            // Try parsing as "YYYY-MM-DD HH:MM:SS"
                            const [datePart, timePart] = emotion.timestamp.split(' ');
                            if (datePart && timePart) {
                                const [year, month, day] = datePart.split('-').map(Number);
                                const [hour, minute, second] = timePart.split(':').map(Number);
                                timestamp = new Date(year, month - 1, day, hour, minute, second || 0);
                            } else {
                                timestamp = new Date();
                            }
                        }
                    } else {
                        timestamp = new Date();
                    }
                } else {
                    timestamp = new Date();
                }
            } catch (e) {
                console.warn('Error parsing timestamp:', e, emotion.timestamp);
                timestamp = new Date();
            }
            
            // Format untuk display
            const dateStr = timestamp.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            const timeStr = timestamp.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            return {
                id: emotion.id || `emotion_${Date.now()}_${Math.random()}`,
                emotion: emotion.emotion || 'neutral',
                emotion_name: emotionNames[emotion.emotion] || emotion.emotion_name || '😐 Neutral',
                note: emotion.note || '',
                timestamp: timestamp.toISOString(), // Simpan sebagai ISO untuk konsistensi
                raw_timestamp: emotion.timestamp, // Simpan original untuk debug
                date: emotion.date || dateStr,
                time: emotion.time || timeStr,
                intensity: emotion.intensity || 3
            };
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort descending
    }

    updateCurrentEmotionDisplay() {
        const container = document.getElementById('current-emotion-display');
        
        if (!this.currentEmotion && this.emotionHistory.length > 0) {
            // Use most recent if no current
            this.currentEmotion = this.emotionHistory[0];
        }
        
        if (!this.currentEmotion) {
            container.innerHTML = `
                <div class="text-center">
                    <div class="text-5xl mb-4">🤔</div>
                    <h4 class="text-lg font-semibold text-slate-700 mb-2">No emotion detected yet</h4>
                    <p class="text-slate-500 mb-4">Log your first emotion to start tracking!</p>
                    <button onclick="emotionHistory.showEmotionInput()" 
                            class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium">
                        Log First Emotion
                    </button>
                </div>
            `;
            return;
        }
        
        const emotionColors = {
            'happy': 'emotion-happy',
            'neutral': 'emotion-neutral',
            'sad': 'emotion-sad',
            'angry': 'emotion-angry',
            'excited': 'emotion-excited',
            'relaxed': 'emotion-relaxed',
            'fear': 'emotion-fear',
            'surprise': 'emotion-surprise'
        };
        
        const emotionIcons = {
            'happy': '😊',
            'neutral': '😐',
            'sad': '😔',
            'angry': '😠',
            'excited': '🤩',
            'relaxed': '😌',
            'fear': '😨',
            'surprise': '😲'
        };
        
        const emotionClass = emotionColors[this.currentEmotion.emotion] || 'emotion-neutral';
        const emotionIcon = emotionIcons[this.currentEmotion.emotion] || '😐';
        
        container.innerHTML = `
            <div class="flex flex-col md:flex-row items-center justify-between gap-6">
                <div class="flex-1">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="${emotionClass} w-20 h-20 rounded-2xl flex items-center justify-center text-4xl pulse-animation">
                            ${emotionIcon}
                        </div>
                        <div>
                            <h4 class="text-2xl font-bold text-slate-800 mb-1">${this.currentEmotion.emotion_name}</h4>
                            <div class="text-sm text-slate-500">
                                <i class="fas fa-clock mr-1"></i>
                                ${this.currentEmotion.date} at ${this.currentEmotion.time}
                            </div>
                            <div class="flex items-center gap-2 mt-2">
                                <div class="text-sm font-medium text-slate-700">Intensity:</div>
                                <div class="flex gap-1">
                                    ${Array(5).fill().map((_, i) => `
                                        <div class="w-3 h-3 rounded-full ${i < this.currentEmotion.intensity ? 'bg-blue-500' : 'bg-slate-200'}"></div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    ${this.currentEmotion.note ? `
                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div class="text-sm text-slate-600">"${this.currentEmotion.note}"</div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="bg-slate-50 p-4 rounded-xl">
                    <h5 class="text-sm font-medium text-slate-700 mb-2">Quick Actions</h5>
                    <div class="space-y-2">
                        <button onclick="emotionHistory.showEmotionInput()" 
                                class="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
                            <i class="fas fa-edit mr-2"></i>Log New Emotion
                        </button>
                        <button onclick="emotionHistory.updateCurrentEmotion()" 
                                class="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium">
                            <i class="fas fa-sync mr-2"></i>Refresh Data
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    updateEmotionCount() {
        const countElement = document.getElementById('emotion-count');
        if (countElement) {
            countElement.textContent = `${this.emotionHistory.length} emotions logged`;
        }
    }

    renderStats() {
        if (this.emotionHistory.length === 0) return;
        
        // Calculate most frequent emotion
        const emotionCounts = {};
        this.emotionHistory.forEach(record => {
            emotionCounts[record.emotion] = (emotionCounts[record.emotion] || 0) + 1;
        });
        
        let mostFrequent = Object.keys(emotionCounts)[0];
        let maxCount = 0;
        
        Object.entries(emotionCounts).forEach(([emotion, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostFrequent = emotion;
            }
        });
        
        const emotionNames = {
            'happy': '😊 Happy',
            'neutral': '😐 Neutral',
            'sad': '😔 Sad',
            'angry': '😠 Angry',
            'excited': '🤩 Excited',
            'relaxed': '😌 Relaxed',
            'fear': '😨 Fear',
            'surprise': '😲 Surprise'
        };
        
        document.getElementById('most-frequent-emotion').textContent = emotionNames[mostFrequent] || mostFrequent;
        const frequentPercent = (maxCount / this.emotionHistory.length) * 100;
        document.getElementById('frequent-bar').style.width = `${frequentPercent}%`;
        document.getElementById('frequent-bar').style.backgroundColor = this.getEmotionColor(mostFrequent);
        
        // Calculate average mood score (1-5 scale from intensity)
        const totalIntensity = this.emotionHistory.reduce((sum, record) => sum + (record.intensity || 3), 0);
        const avgIntensity = totalIntensity / this.emotionHistory.length;
        document.getElementById('avg-mood-score').textContent = avgIntensity.toFixed(1);
        document.getElementById('mood-score-bar').style.width = `${(avgIntensity / 5) * 100}%`;
        document.getElementById('mood-score-bar').style.backgroundColor = avgIntensity >= 3 ? '#10b981' : '#f59e0b';
        
        // Calculate positive days (happy, excited, relaxed)
        const positiveEmotions = ['happy', 'excited', 'relaxed', 'surprise'];
        const positiveCount = this.emotionHistory.filter(record => 
            positiveEmotions.includes(record.emotion)
        ).length;
        const positivePercent = (positiveCount / this.emotionHistory.length) * 100;
        document.getElementById('positive-days').textContent = `${positiveCount} (${positivePercent.toFixed(0)}%)`;
        document.getElementById('positive-bar').style.width = `${positivePercent}%`;
        document.getElementById('positive-bar').style.backgroundColor = '#10b981';
    }

    getEmotionColor(emotion) {
        const colors = {
            'happy': '#10b981',
            'neutral': '#3b82f6',
            'sad': '#f59e0b',
            'angry': '#ef4444',
            'excited': '#eab308',
            'relaxed': '#06b6d4',
            'fear': '#8b5cf6',
            'surprise': '#ec4899'
        };
        return colors[emotion] || '#6b7280';
    }

    setupChart() {
        const ctx = document.getElementById('emotion-chart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        if (this.emotionHistory.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            // Draw "no data" message
            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No emotion data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }
        
        // Group emotions by day for last 7 days
        const last7Days = this.getLast7Days();
        const emotionData = {};
        
        // Initialize data structure
        const emotions = ['happy', 'neutral', 'sad', 'angry', 'excited', 'relaxed', 'fear', 'surprise'];
        emotions.forEach(emotion => {
            emotionData[emotion] = Array(7).fill(0);
        });
        
        // Count emotions per day
        this.emotionHistory.forEach(record => {
            const recordDate = new Date(record.timestamp).toDateString();
            
            last7Days.forEach((day, index) => {
                if (day.dateString === recordDate) {
                    emotionData[record.emotion][index]++;
                }
            });
        });
        
        // Create chart
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: last7Days.map(day => day.label),
                datasets: emotions.map((emotion, index) => ({
                    label: this.capitalizeFirstLetter(emotion),
                    data: emotionData[emotion],
                    backgroundColor: this.getEmotionColor(emotion),
                    borderColor: this.getEmotionColor(emotion),
                    borderWidth: 1,
                    borderRadius: 4
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#1e293b',
                        bodyColor: '#475569',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: {
                        stacked: false,
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    },
                    y: {
                        stacked: false,
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        },
                        grid: {
                            color: 'rgba(226, 232, 240, 0.5)'
                        }
                    }
                }
            }
        });
    }

    getLast7Days() {
        const days = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            days.push({
                date: date,
                dateString: date.toDateString(),
                label: date.toLocaleDateString('en-US', { weekday: 'short' })
            });
        }
        
        return days;
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    renderTimeline() {
        const container = document.getElementById('emotion-timeline');
        if (!container) return;
        
        let filteredHistory = this.emotionHistory;
        
        // Apply filter
        const now = new Date();
        switch(this.currentFilter) {
            case 'today':
                const today = now.toDateString();
                filteredHistory = this.emotionHistory.filter(record => 
                    new Date(record.timestamp).toDateString() === today
                );
                break;
            case 'month':
                const thisMonth = now.getMonth();
                const thisYear = now.getFullYear();
                filteredHistory = this.emotionHistory.filter(record => {
                    const recordDate = new Date(record.timestamp);
                    return recordDate.getMonth() === thisMonth && 
                           recordDate.getFullYear() === thisYear;
                });
                break;
            // 'week' is default
        }
        
        if (filteredHistory.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-500">
                    <div class="text-4xl mb-3">📝</div>
                    <p class="text-sm font-medium mb-1">No emotions found for this period</p>
                    <p class="text-xs text-slate-400">Log an emotion to see it here!</p>
                </div>
            `;
            return;
        }
        
        // Group by date
        const groupedByDate = {};
        filteredHistory.forEach(record => {
            const dateKey = new Date(record.timestamp).toDateString();
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = [];
            }
            groupedByDate[dateKey].push(record);
        });
        
        // Sort dates (newest first)
        const sortedDates = Object.keys(groupedByDate).sort((a, b) => 
            new Date(b) - new Date(a)
        );
        
        const timelineHTML = sortedDates.map(dateKey => {
            const date = new Date(dateKey);
            const records = groupedByDate[dateKey].sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
            );
            
            const formattedDate = date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            });
            
            const isToday = date.toDateString() === new Date().toDateString();
            
            return `
                <div class="timeline-day bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div class="bg-slate-50 px-4 py-3 border-b border-slate-200">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-semibold text-slate-700">${formattedDate}</span>
                                ${isToday ? 
                                    '<span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Today</span>' : 
                                    ''
                                }
                            </div>
                            <span class="text-xs text-slate-500">${records.length} emotion${records.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    
                    <div class="divide-y divide-slate-100">
                        ${records.map(record => `
                            <div class="p-4 hover:bg-slate-50 transition-colors">
                                <div class="flex items-start gap-3">
                                    <div class="flex-shrink-0">
                                        <div class="w-10 h-10 rounded-full flex items-center justify-center ${this.getEmotionBgClass(record.emotion)} text-white">
                                            ${this.getEmotionIcon(record.emotion)}
                                        </div>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center justify-between mb-1">
                                            <h5 class="font-medium text-slate-800 truncate">${record.emotion_name}</h5>
                                            <span class="text-xs text-slate-500">${record.time}</span>
                                        </div>
                                        ${record.note ? `
                                        <p class="text-sm text-slate-600 mt-1">${record.note}</p>
                                        ` : ''}
                                        <div class="flex items-center gap-3 mt-2">
                                            <span class="inline-flex items-center gap-1 text-xs text-slate-500">
                                                <i class="fas fa-bolt"></i>
                                                Intensity: ${record.intensity || 3}/5
                                            </span>
                                            <span class="inline-flex items-center gap-1 text-xs text-slate-500">
                                                <i class="fas fa-database"></i>
                                                ID: ${record.id}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = timelineHTML;
    }

    getEmotionBgClass(emotion) {
        const classes = {
            'happy': 'bg-emerald-500',
            'neutral': 'bg-blue-500',
            'sad': 'bg-amber-500',
            'angry': 'bg-red-500',
            'excited': 'bg-yellow-500',
            'relaxed': 'bg-cyan-500',
            'fear': 'bg-purple-500',
            'surprise': 'bg-pink-500'
        };
        return classes[emotion] || 'bg-gray-500';
    }

    getEmotionIcon(emotion) {
        const icons = {
            'happy': '😊',
            'neutral': '😐',
            'sad': '😔',
            'angry': '😠',
            'excited': '🤩',
            'relaxed': '😌',
            'fear': '😨',
            'surprise': '😲'
        };
        return icons[emotion] || '😐';
    }

    generateInsights() {
        const container = document.getElementById('emotion-insights');
        if (!container || this.emotionHistory.length === 0) return;
        
        // Analyze patterns
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        const recentEmotions = this.emotionHistory.filter(record => 
            new Date(record.timestamp) >= lastWeek
        );
        
        if (recentEmotions.length < 2) {
            container.innerHTML = `
                <div class="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div class="flex items-center gap-3 mb-2">
                        <i class="fas fa-chart-line text-blue-500 text-lg"></i>
                        <h4 class="font-medium text-blue-800">More Data Needed</h4>
                    </div>
                    <p class="text-sm text-blue-700">Log more emotions to see personalized insights!</p>
                </div>
            `;
            return;
        }
        
        // Calculate emotional patterns
        const morningEmotions = recentEmotions.filter(record => {
            const hour = new Date(record.timestamp).getHours();
            return hour >= 6 && hour < 12;
        });
        
        const afternoonEmotions = recentEmotions.filter(record => {
            const hour = new Date(record.timestamp).getHours();
            return hour >= 12 && hour < 18;
        });
        
        const eveningEmotions = recentEmotions.filter(record => {
            const hour = new Date(record.timestamp).getHours();
            return hour >= 18;
        });
        
        // Find most common time for each emotion
        const emotionByTime = {};
        recentEmotions.forEach(record => {
            const hour = new Date(record.timestamp).getHours();
            const timeOfDay = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
            
            if (!emotionByTime[record.emotion]) {
                emotionByTime[record.emotion] = { Morning: 0, Afternoon: 0, Evening: 0 };
            }
            emotionByTime[record.emotion][timeOfDay]++;
        });
        
        // Generate insights
        const insights = [];
        
        // Mood trend
        const positiveEmotions = ['happy', 'excited', 'relaxed', 'surprise'];
        const positiveCount = recentEmotions.filter(r => positiveEmotions.includes(r.emotion)).length;
        const positivityRate = (positiveCount / recentEmotions.length) * 100;
        
        if (positivityRate > 70) {
            insights.push({
                icon: '💪',
                title: 'Positive Trend',
                message: `You've been positive ${positivityRate.toFixed(0)}% of the time this week!`,
                color: 'emerald'
            });
        } else if (positivityRate < 30) {
            insights.push({
                icon: '💭',
                title: 'Reflection Time',
                message: 'Consider activities that boost your mood this week.',
                color: 'amber'
            });
        }
        
        // Time-based patterns
        for (const [emotion, times] of Object.entries(emotionByTime)) {
            const maxTime = Object.entries(times).reduce((a, b) => a[1] > b[1] ? a : b)[0];
            if (times[maxTime] >= 2) {
                insights.push({
                    icon: '⏰',
                    title: 'Pattern Detected',
                    message: `You often feel ${emotion} in the ${maxTime.toLowerCase()}`,
                    color: 'blue'
                });
                break;
            }
        }
        
        // Recent change
        if (recentEmotions.length >= 2) {
            const latest = recentEmotions[0];
            const previous = recentEmotions[1];
            
            if (latest.intensity > previous.intensity) {
                insights.push({
                    icon: '📈',
                    title: 'Increasing Energy',
                    message: 'Your emotional intensity has been increasing recently',
                    color: 'purple'
                });
            }
        }
        
        // Render insights
        const insightsHTML = insights.map(insight => `
            <div class="p-4 bg-${insight.color}-50 rounded-xl border border-${insight.color}-100">
                <div class="flex items-center gap-3 mb-2">
                    <span class="text-lg">${insight.icon}</span>
                    <h4 class="font-medium text-${insight.color}-800">${insight.title}</h4>
                </div>
                <p class="text-sm text-${insight.color}-700">${insight.message}</p>
            </div>
        `).join('');
        
        container.innerHTML = insightsHTML || `
            <div class="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div class="flex items-center gap-3 mb-2">
                    <i class="fas fa-chart-line text-blue-500 text-lg"></i>
                    <h4 class="font-medium text-blue-800">Regular Patterns</h4>
                </div>
                <p class="text-sm text-blue-700">Your emotional patterns appear balanced and regular.</p>
            </div>
        `;
    }

    filterByDay(period) {
        this.currentFilter = period;
        
        // Update active button
        document.querySelectorAll('[id^="filter-"]').forEach(btn => {
            btn.classList.remove('bg-blue-50', 'text-blue-600');
            btn.classList.add('hover:bg-slate-100');
        });
        
        const activeBtn = document.getElementById(`filter-${period}`);
        activeBtn.classList.add('bg-blue-50', 'text-blue-600');
        activeBtn.classList.remove('hover:bg-slate-100');
        
        this.renderTimeline();
    }

    showEmotionInput() {
        document.getElementById('emotion-input-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Reset selection
        this.selectedEmotion = null;
        document.querySelectorAll('.emotion-option').forEach(option => {
            option.style.transform = 'scale(1)';
            option.style.boxShadow = 'none';
        });
        
        document.getElementById('emotion-note').value = '';
        this.updateSaveButton();
    }

    hideEmotionInput() {
        document.getElementById('emotion-input-modal').classList.add('hidden');
        document.body.style.overflow = '';
    }

    selectEmotion(emotion) {
        this.selectedEmotion = emotion;
        
        // Visual feedback
        document.querySelectorAll('.emotion-option').forEach(option => {
            const optionEmotion = option.getAttribute('onclick').match(/'([^']+)'/)[1];
            if (optionEmotion === emotion) {
                option.style.transform = 'scale(1.05)';
                option.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
            } else {
                option.style.transform = 'scale(1)';
                option.style.boxShadow = 'none';
            }
        });
        
        this.updateSaveButton();
    }

    updateSaveButton() {
        const saveBtn = document.getElementById('save-emotion-btn');
        if (this.selectedEmotion) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            saveBtn.classList.add('cursor-pointer');
        } else {
            saveBtn.disabled = true;
            saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
            saveBtn.classList.remove('cursor-pointer');
        }
    }

    async saveEmotion() {
        if (!this.selectedEmotion) return;
        
        const note = document.getElementById('emotion-note').value.trim();
        const addToCalendar = document.getElementById('emotion-share-calendar').checked;
        const intensity = document.getElementById('emotion-intensity') ? 
            parseInt(document.getElementById('emotion-intensity').value) : 3;
        
        try {
            // Save to API
            const response = await fetch('/api/emotion/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    emotion: this.selectedEmotion,
                    note: note,
                    intensity: intensity
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Reload data from API
                await this.loadEmotionData();
                
                // Update UI
                this.hideEmotionInput();
                
                // Show success message
                this.showNotification(`✅ Emotion logged successfully!`, 'success');
            } else {
                throw new Error(result.error || 'Failed to save emotion');
            }
            
        } catch (error) {
            console.error('❌ Error saving emotion:', error);
            this.showNotification('❌ Failed to save emotion. Please try again.', 'error');
        }
    }

    async updateCurrentEmotion() {
        await this.loadEmotionData();
        this.showNotification('🔄 Emotion data refreshed', 'info');
    }

    showNotification(message, type = 'info') {
        // Remove existing
        const existing = document.querySelectorAll('.emotion-notification');
        existing.forEach(notif => notif.remove());

        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500', 
            info: 'bg-blue-500',
            warning: 'bg-yellow-500'
        };

        const icons = {
            success: '✅',
            error: '❌',
            info: '💡', 
            warning: '⚠️'
        };

        const notification = document.createElement('div');
        notification.className = `emotion-notification fixed top-4 right-4 ${colors[type]} text-white p-4 rounded-xl shadow-2xl z-50 animate-fade-in max-w-md`;
        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-lg">${icons[type]}</span>
                <span class="flex-1 font-medium">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200 text-lg font-bold">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 3000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.emotionHistory = new EmotionHistory();
});