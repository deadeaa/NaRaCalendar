
class DashboardApp {
    constructor() {
        this.todayScheduleData = null;
        this.init();
    }

    init() {
        console.log("🚀 Initializing Dashboard...");
        
        // Debug: Check if data exists in global scope
        if (typeof todayScheduleData !== 'undefined') {
            console.log("📅 Today schedule data available:", todayScheduleData);
            this.todayScheduleData = todayScheduleData;
        }
        
        this.initClock();
        this.initLogoutHandler();
        this.initNavigation();
        this.initAnimations();
        this.loadUserData();
        this.loadTodaySchedule();
        
        // Auto-refresh schedule every 30 seconds
        setInterval(() => this.loadTodaySchedule(), 30000);
    }

    // Load Today's Schedule - FIXED VERSION WITH TIME SYNC
    async loadTodaySchedule() {
        console.log("🔄 Loading today schedule...");
        const container = document.getElementById('today-schedule-container');
        if (!container) {
            console.error('❌ Schedule container not found');
            return;
        }

        try {
            let scheduleData = null;
            
            // Method 1: Check if data is passed directly from Flask template
            if (this.todayScheduleData && this.todayScheduleData.length > 0) {
                console.log('✅ Using todayScheduleData from template:', this.todayScheduleData);
                scheduleData = this.todayScheduleData;
            } else {
                // Method 2: Fallback to API call
                console.log('🔄 Falling back to API call...');
                scheduleData = await this.fetchScheduleFromAPI();
            }

            // Method 3: Get from calendar if available
            if ((!scheduleData || scheduleData.length === 0) && window.calendar) {
                console.log('🔄 Getting schedule from calendar...');
                scheduleData = await this.getScheduleFromCalendar();
            }

            if (scheduleData && scheduleData.length > 0) {
                // Sort by time before rendering
                const sortedSchedule = this.sortScheduleByTime(scheduleData);
                this.renderSchedule(container, sortedSchedule);
            } else {
                this.renderNoSchedule(container);
            }
            
        } catch (error) {
            console.error('❌ Schedule loading failed:', error);
            this.renderError(container, 'Failed to load schedule');
        }
    }

    // Fetch schedule from API
    async fetchScheduleFromAPI() {
        try {
            const response = await fetch('/api/today-schedule', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📅 API schedule data:', data);
            
            if (data.success && data.schedule && data.schedule.length > 0) {
                return data.schedule;
            }
        } catch (error) {
            console.log('API fetch failed, trying fallback:', error);
        }
        return null;
    }

    // Get schedule from calendar
    async getScheduleFromCalendar() {
        try {
            if (window.calendar && window.calendar.mockEvents) {
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];
                
                const todayEvents = window.calendar.mockEvents.filter(event => {
                    try {
                        if (!event.start || !event.start.dateTime) return false;
                        const eventDate = new Date(event.start.dateTime);
                        const eventDateStr = eventDate.toISOString().split('T')[0];
                        return eventDateStr === todayStr;
                    } catch (error) {
                        return false;
                    }
                });

                // Convert calendar format to schedule format
                return todayEvents.map(event => {
                    const start = new Date(event.start.dateTime);
                    const end = new Date(event.end.dateTime);
                    
                    return {
                        id: event.id,
                        title: event.summary || 'Untitled Event',
                        time: this.formatEventTime(start, end),
                        location: this.getEventLocation(event),
                        description: event.description || '',
                        type: this.detectEventType(event),
                        start_time: event.start.dateTime,
                        end_time: event.end.dateTime
                    };
                });
            }
        } catch (error) {
            console.log('Calendar data fetch failed:', error);
        }
        return null;
    }

    // Get event location
    getEventLocation(event) {
        const description = event.description || '';
        const title = event.summary || event.title || '';
        
        // Determine type first
        const type = this.detectEventType(event);
        
        // 🎯 STUDY selalu di rumah
        if (type === 'study') {
            return 'Home';
        }
        
        // 💼 WORK selalu di kantor
        if (type === 'work') {
            return 'Office';
        }
        
        // 👥 MEETING di meeting room
        if (type === 'meeting') {
            return 'Meeting Room';
        }
        
        // 👤 PERSONAL di restaurant
        if (type === 'personal') {
            return 'Restaurant';
        }
        
        // Check description for location
        if (description.includes('Office') || description.includes('Kantor')) return 'Office';
        if (description.includes('Home') || description.includes('Rumah')) return 'Home';
        if (description.includes('Restaurant') || description.includes('Cafe')) return 'Restaurant';
        if (description.includes('Meeting Room') || description.includes('Conference')) return 'Meeting Room';
        
        // Check title for location hints
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('home') || lowerTitle.includes('rumah')) return 'Home';
        if (lowerTitle.includes('office') || lowerTitle.includes('kantor')) return 'Office';
        if (lowerTitle.includes('cafe') || lowerTitle.includes('restaurant')) return 'Restaurant';
        
        // Default based on type
        return type === 'study' ? 'Home' : 'Office';
    }

    // Sort schedule by time
    sortScheduleByTime(schedule) {
        return schedule.sort((a, b) => {
            // Try to parse times for sorting
            const timeA = this.extractTimeValue(a.time || a.start_time);
            const timeB = this.extractTimeValue(b.time || b.start_time);
            return timeA - timeB;
        });
    }

    // Extract time value for sorting
    extractTimeValue(timeString) {
        if (!timeString) return 0;
        
        try {
            // If it's an ISO string
            if (timeString.includes('T')) {
                return new Date(timeString).getTime();
            }
            
            // If it's in format "HH:MM - HH:MM"
            const timeMatch = timeString.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                const hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                return hours * 60 + minutes;
            }
        } catch (error) {
            console.log('Time extraction failed:', error);
        }
        return 0;
    }

    // Format event time for display
    formatEventTime(start, end) {
        try {
            const startDate = new Date(start);
            const endDate = new Date(end);
            
            const formatTime = (date) => {
                return date.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            };
            
            return `${formatTime(startDate)} - ${formatTime(endDate)}`;
        } catch (error) {
            console.log('Time formatting failed:', error);
            return 'All day';
        }
    }

    // Detect event type from title and description
    detectEventType(event) {
        const title = event.summary || event.title || '';
        const description = event.description || '';
        const combined = (title + ' ' + description).toLowerCase();
        
        console.log('🔍 Detecting event type:', { title, combined });
        
        // 🎯 STUDY (tempat: rumah) - PRIORITY FIRST
        if (combined.includes('study') || 
            combined.includes('belajar') || 
            combined.includes('kuliah') ||
            combined.includes('materi') ||
            combined.includes('tugas') ||
            combined.includes('tutorial') ||
            combined.includes('reading') ||
            combined.includes('learn') ||
            combined.includes('homework') ||
            combined.includes('assignment') ||
            combined.includes('studi') ||
            combined.includes('pelajaran') ||
            combined.includes('exam') ||
            combined.includes('ujian') ||
            combined.includes('quiz') ||
            combined.includes('test') ||
            combined.includes('matematika') ||
            combined.includes('fisika') ||
            combined.includes('kimia') ||
            combined.includes('bahasa')) {
            console.log('✅ Detected as: STUDY');
            return 'study';
        }
        
        // 👥 MEETING (tempat: meeting room)
        if (combined.includes('meeting') || 
            combined.includes('rapat') || 
            combined.includes('presentasi') ||
            combined.includes('briefing') ||
            combined.includes('conference') ||
            combined.includes('team') ||
            combined.includes('discussion') ||
            combined.includes('diskusi')) {
            console.log('✅ Detected as: MEETING');
            return 'meeting';
        }
        
        // 👤 PERSONAL (tempat: restaurant/cafe)
        if (combined.includes('lunch') || 
            combined.includes('dinner') || 
            combined.includes('makan') ||
            combined.includes('coffee') ||
            combined.includes('kopi') ||
            combined.includes('breakfast') ||
            combined.includes('sarapan') ||
            combined.includes('personal') ||
            combined.includes('friends') ||
            combined.includes('teman') ||
            combined.includes('family') ||
            combined.includes('keluarga') ||
            combined.includes('date') ||
            combined.includes('kencan') ||
            combined.includes('movie') ||
            combined.includes('film')) {
            console.log('✅ Detected as: PERSONAL');
            return 'personal';
        }
        
        // 💼 WORK (tempat: kantor) - HANYA jika benar-benar work related
        if (combined.includes('work') || 
            combined.includes('kerja') || 
            combined.includes('project') ||
            combined.includes('deadline') ||
            combined.includes('task') ||
            combined.includes('office') ||
            combined.includes('kantor') ||
            combined.includes('client') ||
            combined.includes('klien') ||
            combined.includes('report') ||
            combined.includes('laporan') ||
            combined.includes('business') ||
            combined.includes('bisnis')) {
            // Pastikan bukan study
            if (!combined.includes('study') && 
                !combined.includes('learn') && 
                !combined.includes('belajar')) {
                console.log('✅ Detected as: WORK');
                return 'work';
            }
        }
        
        // 🚨 URGENT
        if (combined.includes('urgent') || 
            combined.includes('penting') || 
            combined.includes('important') ||
            combined.includes('asap')) {
            console.log('✅ Detected as: URGENT');
            return 'urgent';
        }
        
        console.log('⚠️ Default event type');
        return 'default';
    }

    // Render Schedule Items - SIMPLIFIED VERSION (NO EDIT/DELETE)
    renderSchedule(container, schedule) {
        console.log('🎨 Rendering schedule:', schedule);
        
        if (!schedule || schedule.length === 0) {
            this.renderNoSchedule(container);
            return;
        }

        const scheduleHTML = schedule.map((event, index) => {
            // Parse and format time properly
            let displayTime = event.time || 'All day';
            let locationIcon = '🏢';
            let locationText = this.getEventLocation(event);
            
            // Set location icon based on location
            switch(locationText) {
                case 'Home': locationIcon = '🏠'; break;
                case 'Office': locationIcon = '🏢'; break;
                case 'Meeting Room': locationIcon = '👥'; break;
                case 'Restaurant': locationIcon = '🍽️'; break;
                default: locationIcon = '📍';
            }
            
            // Determine event type
            const eventType = this.detectEventType(event);
            
            // If we have start_time and end_time, format them
            if (event.start_time && event.end_time) {
                try {
                    const start = new Date(event.start_time);
                    const end = new Date(event.end_time);
                    displayTime = this.formatEventTime(start, end);
                    
                    // Add duration
                    const durationMs = end - start;
                    const durationHours = durationMs / (1000 * 60 * 60);
                    const durationText = durationHours >= 1 ? 
                        `${Math.round(durationHours)} jam` : 
                        `${Math.round(durationHours * 60)} menit`;
                    displayTime = `${displayTime} (${durationText})`;
                } catch (error) {
                    console.log('Error formatting event time:', error);
                }
            }
            
            // Get current time to highlight upcoming events
            const now = new Date();
            const eventStart = event.start_time ? new Date(event.start_time) : null;
            const eventEnd = event.end_time ? new Date(event.end_time) : null;
            const isCurrent = eventStart && eventEnd && 
                              eventStart <= now && now <= eventEnd;
            const isUpcoming = eventStart && eventStart > now;
            
            // Add status indicator
            let statusBadge = '';
            let statusClass = '';
            if (isCurrent) {
                statusBadge = '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200"><span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Sedang berlangsung</span>';
                statusClass = 'border-blue-300 bg-blue-50/30';
            } else if (isUpcoming) {
                statusBadge = '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200"><span class="w-2 h-2 rounded-full bg-green-500"></span> Akan datang</span>';
                statusClass = 'border-green-200 bg-green-50/30';
            }
            
            // Format date
            const eventDate = event.start_time ? new Date(event.start_time) : new Date();
            const formattedDate = eventDate.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
            
            return `
            <div class="schedule-item bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-all duration-300 mb-4 ${statusClass}" 
                 style="border-left: 4px solid ${this.getEventColor(eventType)}; animation-delay: ${index * 0.1}s">
                <div class="flex items-start">
                    <div class="flex-1">
                        <div class="flex items-start justify-between mb-3">
                            <div>
                                <h5 class="font-bold text-gray-900 text-base mb-1">${this.escapeHtml(event.title)}</h5>
                                ${statusBadge}
                            </div>
                            <div class="${this.getEventTypeClass(eventType)} px-3 py-1.5 rounded-lg">
                                <div class="flex items-center gap-2">
                                    <span class="text-sm">${this.getEventTypeIcon(eventType)}</span>
                                    <span class="text-xs font-bold">${this.formatEventType(eventType)}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-4 text-sm text-gray-700 mb-3">
                            <div class="flex items-center gap-1">
                                <span class="text-gray-500">⏰ ${displayTime}</span>
                            </div>
                            <div class="flex items-center gap-1">
                                <span class="text-gray-500">${locationIcon}</span>
                                <span>${locationText}</span>
                            </div>
                        </div>
                        
                        ${event.description && event.description !== 'No description' && event.description !== 'Added via voice:' ? `
                        <div class="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <p class="text-sm text-gray-600">${this.escapeHtml(event.description)}</p>
                        </div>
                        ` : ''}
                        
                        <div class="mt-3 text-xs text-gray-500">
                            <span>📅 ${formattedDate}</span>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
        
        container.innerHTML = scheduleHTML;
        console.log(`✅ Rendered ${schedule.length} schedule items`);
    }

    // Helper: Get event color based on type
    getEventColor(type) {
        const colors = {
            'study': '#4f46e5',    // Indigo
            'work': '#7c3aed',     // Purple
            'meeting': '#0ea5e9',  // Sky blue
            'personal': '#10b981', // Emerald
            'urgent': '#ef4444',   // Red
            'default': '#6b7280'   // Gray
        };
        return colors[type] || colors.default;
    }

    // Render No Schedule State
    renderNoSchedule(container) {
        console.log('📭 Rendering no schedule state');
        container.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <div class="text-6xl mb-4">📅</div>
                <p class="text-lg font-medium mb-2">Tidak ada jadwal hari ini</p>
                <p class="text-sm text-gray-400 mb-6">Yuk buat jadwal untuk hari ini!</p>
                <div class="flex flex-col gap-3 max-w-xs mx-auto">
                    <a href="/calendar" 
                       class="px-5 py-3 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
                        <i class="fas fa-calendar-plus"></i>
                        Buka Kalender
                    </a>
                    <button onclick="if (window.nara) { window.nara.showQuickAddModal(); } else { location.href='/speak'; }" 
                            class="px-5 py-3 bg-green-500 text-white text-sm rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2">
                        <i class="fas fa-microphone"></i>
                        Tambah dengan Voice
                    </button>
                </div>
            </div>
        `;
    }

    // Render Error State
    renderError(container, message) {
        console.log('❌ Rendering error state:', message);
        container.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <div class="text-6xl mb-4">⚠️</div>
                <p class="text-lg font-medium mb-2">Gagal memuat jadwal</p>
                <p class="text-sm text-gray-400 mb-6">${message}</p>
                <div class="flex gap-3 justify-center">
                    <button onclick="dashboardApp.loadTodaySchedule()" 
                            class="px-5 py-2.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2">
                        <i class="fas fa-redo"></i>
                        Coba Lagi
                    </button>
                    <a href="/calendar" 
                       class="px-5 py-2.5 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2">
                        <i class="fas fa-calendar"></i>
                        Buka Kalender
                    </a>
                </div>
            </div>
        `;
    }

    // Helper: Get Event Type CSS Class
    getEventTypeClass(type) {
        const typeClasses = {
            'study': 'bg-indigo-100 text-indigo-700 border border-indigo-200',
            'work': 'bg-purple-100 text-purple-700 border border-purple-200',
            'meeting': 'bg-sky-100 text-sky-700 border border-sky-200',
            'personal': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
            'urgent': 'bg-red-100 text-red-700 border border-red-200',
            'default': 'bg-gray-100 text-gray-700 border border-gray-200'
        };
        return typeClasses[type] || typeClasses.default;
    }

    // Helper: Get Event Type Icon
    getEventTypeIcon(type) {
        const typeIcons = {
            'study': '🎯',    // STUDY
            'work': '💼',     // WORK  
            'meeting': '👥',  // MEETING
            'personal': '👤', // PERSONAL
            'urgent': '🚨',   // URGENT
            'default': '📌'
        };
        return typeIcons[type] || typeIcons.default;
    }

    // Helper: Format Event Type
    formatEventType(type) {
        const typeMap = {
            'study': 'Study',
            'work': 'Work',
            'meeting': 'Meeting',
            'personal': 'Personal',
            'urgent': 'Urgent',
            'default': 'Event'
        };
        return typeMap[type] || 'Event';
    }

    // Helper: Escape HTML to prevent XSS
    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Real-time Clock
    initClock() {
        const updateClock = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('id-ID', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            const dateString = now.toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            const clockElement = document.getElementById('clock');
            if (clockElement) {
                clockElement.textContent = `${dateString} • ${timeString}`;
            }
        };

        updateClock();
        setInterval(updateClock, 1000);
    }

    // Logout Handler
    initLogoutHandler() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Yakin ingin logout?')) {
                    window.location.href = '/logout';
                }
            });
        }
    }

    // Navigation Handler
    initNavigation() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('nav a');
        
        navLinks.forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            }
        });
    }

    // Animation Effects
    initAnimations() {
        // Add animation classes to schedule items
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-in-up');
                }
            });
        }, {
            threshold: 0.1
        });

        // Observe all schedule items
        document.querySelectorAll('.schedule-item').forEach(item => {
            observer.observe(item);
        });
    }

    // Load User Data
    async loadUserData() {
        try {
            const response = await fetch('/api/user-data', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const userData = await response.json();
                this.updateUIWithUserData(userData);
            }
        } catch (error) {
            console.log('User data loading skipped:', error);
        }
    }

    // Update UI with user data
    updateUIWithUserData(userData) {
        console.log('👤 User data loaded:', userData);
        const userNameElement = document.getElementById('user-name');
        if (userNameElement && userData.name) {
            userNameElement.textContent = userData.name;
        }
    }

    // Public method to refresh schedule
    refreshSchedule() {
        this.loadTodaySchedule();
    }
    
    // Method untuk update dari calendar event
    onCalendarUpdate() {
        console.log('📢 Calendar update received, refreshing dashboard...');
        this.loadTodaySchedule();
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("📄 DOM Content Loaded");
    window.dashboardApp = new DashboardApp();
    
    // Listen for calendar updates
    window.addEventListener('calendar:updated', () => {
        if (window.dashboardApp && window.dashboardApp.refreshSchedule) {
            window.dashboardApp.refreshSchedule();
        }
    });
});

// Make it globally available
window.DashboardApp = DashboardApp;