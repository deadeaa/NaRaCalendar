// FIXED CALENDAR - INTEGRATED WITH DATABASE
class GoogleCalendar {
    constructor() {
        this.simulationMode = true;
        this.mockEvents = [];
        this.editingEventId = null;
        this.isAuthenticated = true;
        this.isProcessing = false; // ✅ Tambah flag untuk prevent double click
        
        this.init();
    }

    init() {
        console.log('🎯 Calendar Initializing...');
        this.enableSimulationMode();
        this.setupEventListeners();
        this.loadEventsFromDatabase(); // ✅ Load dari database, bukan localStorage
        this.renderMiniCalendar();
        this.setDefaultDate();
        this.updateEventCounters();
        
        setTimeout(() => this.debugDatabase(), 1000);
        
        console.log('✅ Calendar fully initialized');
    }

    enableSimulationMode() {
        const authBtn = document.getElementById('auth-button');
        const signoutBtn = document.getElementById('signout-button');
        const statusEl = document.getElementById('calendar-status');
        
        if (authBtn) authBtn.classList.add('hidden');
        if (signoutBtn) signoutBtn.classList.remove('hidden');
        if (statusEl) {
            statusEl.innerHTML = '🔧 <strong>Local Calendar</strong> - Create unlimited events';
            statusEl.className = 'text-green-600 font-medium text-sm mb-4';
        }
        
        this.updateEventCounters();
    }

    // ✅ FIXED: Update event counters dengan ID yang benar
    updateEventCounters() {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        // Filter events dari database (bukan mockEvents)
        const todayEvents = this.mockEvents.filter(event => {
            try {
                const eventDate = new Date(event.start.dateTime);
                return eventDate.toDateString() === today.toDateString();
            } catch (e) {
                return false;
            }
        });

        const weekEvents = this.mockEvents.filter(event => {
            try {
                const eventDate = new Date(event.start.dateTime);
                return eventDate >= startOfWeek && eventDate <= endOfWeek;
            } catch (e) {
                return false;
            }
        });

        // Update DOM elements
        const todayEl = document.getElementById('today-events');
        const weekEl = document.getElementById('week-events');
        const totalEl = document.getElementById('total-events');

        if (todayEl) todayEl.textContent = todayEvents.length;
        if (weekEl) weekEl.textContent = weekEvents.length;
        if (totalEl) totalEl.textContent = this.mockEvents.length;

        console.log('📊 Calendar Counters:', {
            today: todayEvents.length,
            week: weekEvents.length,
            total: this.mockEvents.length
        });
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        // Event management buttons
        const addEventBtn = document.getElementById('add-event');
        if (addEventBtn) {
            // Hapus event listener lama jika ada
            addEventBtn.removeEventListener('click', this.handleAddEventBound);
            // Buat bound function
            this.handleAddEventBound = this.handleAddEvent.bind(this);
            addEventBtn.addEventListener('click', this.handleAddEventBound);
        }
        
        this.addListener('list-events', 'click', () => this.listUpcomingEvents());
        this.addListener('clear-events', 'click', () => this.clearEventsForm());
        this.addListener('refresh-events', 'click', () => this.listUpcomingEvents());
        
        // Quick date buttons
        this.addListener('today-btn', 'click', () => this.setDate('today'));
        this.addListener('tomorrow-btn', 'click', () => this.setDate('tomorrow'));
        
        // Enter key support untuk form
        const eventTitleInput = document.getElementById('event-title');
        if (eventTitleInput) {
            eventTitleInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !this.isProcessing) {
                    this.handleAddEvent();
                }
            });
        }
        
        console.log('✅ Event listeners setup complete');
    }

    addListener(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`❌ Element with id '${id}' not found`);
        }
    }

    async handleAddEvent() {
        // ✅ PREVENT DOUBLE CLICK
        if (this.isProcessing) {
            console.log('⏳ Already processing, skipping...');
            return;
        }
        
        console.log('🎯 Add Event button clicked');
        
        this.isProcessing = true;
        
        try {
            const eventData = this.getEventFormData();
            if (!eventData.title) {
                this.showNotification('Please enter event title', 'error');
                return;
            }

            console.log('📅 Event data:', eventData);

            if (this.editingEventId) {
                await this.updateEvent(this.editingEventId, eventData);
            } else {
                await this.createEvent(eventData);
            }
        } catch (error) {
            console.error('Error in handleAddEvent:', error);
            this.showNotification('Error processing event: ' + error.message, 'error');
        } finally {
            this.isProcessing = false;
        }
    }

    getEventFormData() {
        const title = document.getElementById('event-title').value.trim();
        const date = document.getElementById('event-date').value;
        const startTime = document.getElementById('event-start').value || '10:00';
        const endTime = document.getElementById('event-end').value || '11:00';
        const description = document.getElementById('event-desc').value.trim();

        console.log('📅 Raw form data:', { date, startTime, endTime });

        // ✅ FIXED: Parse date and time dengan benar
        // Buat date object dari date string
        const [year, month, day] = date.split('-').map(Number);
        
        // Parse start time
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const startDateTime = new Date(year, month - 1, day, startHour, startMinute, 0);
        
        // Parse end time
        const [endHour, endMinute] = endTime.split(':').map(Number);
        let endDateTime = new Date(year, month - 1, day, endHour, endMinute, 0);
        
        console.log('🕐 Parsed times:', {
            start: startDateTime.toString(),
            end: endDateTime.toString(),
            startHour: startDateTime.getHours(),
            endHour: endDateTime.getHours()
        });

        // Handle overnight events
        if (endDateTime <= startDateTime) {
            endDateTime.setDate(endDateTime.getDate() + 1);
            console.log('🌙 Overnight event detected, end date adjusted to next day');
        }

        // ✅ FORMAT UNTUK DATABASE: "YYYY-MM-DD HH:MM:SS"
        const formatForDB = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const h = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            const s = String(date.getSeconds()).padStart(2, '0');
            return `${y}-${m}-${d} ${h}:${min}:${s}`;
        };

        return {
            title,
            description,
            start_time: formatForDB(startDateTime), // ✅ Format database
            end_time: formatForDB(endDateTime),     // ✅ Format database
            startDateTime: startDateTime.toISOString(), // Untuk backward compatibility
            endDateTime: endDateTime.toISOString()      // Untuk backward compatibility
        };
    }

    calculateDuration(start, end) {
        const durationMs = end - start;
        const durationHours = durationMs / (1000 * 60 * 60);
        
        if (durationHours < 24) {
            const hours = Math.floor(durationHours);
            const minutes = Math.round((durationHours - hours) * 60);
            
            if (hours === 0) {
                return `${minutes} menit`;
            } else if (minutes === 0) {
                return `${hours} jam`;
            } else {
                return `${hours} jam ${minutes} menit`;
            }
        } else {
            const days = Math.floor(durationHours / 24);
            const remainingHours = durationHours % 24;
            
            if (remainingHours === 0) {
                return `${days} hari`;
            } else {
                return `${days} hari ${Math.round(remainingHours)} jam`;
            }
        }
    }

    // ✅ FIXED: Create event dan simpan ke database
    async createEvent(eventData) {
        try {
            this.showLoading('Creating event...');
            
            console.log('📤 Sending to database:', {
                title: eventData.title,
                start_time: eventData.start_time,
                end_time: eventData.end_time
            });
            
            // Kirim ke database melalui API
            const response = await fetch('/api/calendar/simulation/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    title: eventData.title,
                    description: eventData.description || '',
                    start_time: eventData.start_time,  // ✅ Format YYYY-MM-DD HH:MM:SS
                    end_time: eventData.end_time        // ✅ Format YYYY-MM-DD HH:MM:SS
                })
            });

            const result = await response.json();
            console.log('📥 Server response:', result);
            
            if (result.success) {
                // Event berhasil dibuat di database, refresh dari database
                await this.loadEventsFromDatabase();
                
                this.hideLoading();
                this.resetForm();
                this.showNotification(`✅ "${eventData.title}" created successfully!`, 'success');
                this.renderEventsList(this.mockEvents);
                this.renderMiniCalendar();
                this.updateEventCounters();
                
                // ✅ Trigger sync ke semua dashboard
                this.triggerDashboardSync();
                
                console.log('🎉 Event created in database:', eventData.title);
            } else {
                throw new Error(result.error || 'Failed to create event');
            }
            
        } catch (error) {
            this.hideLoading();
            console.error('Error creating event:', error);
            this.showNotification('❌ Failed to create event: ' + error.message, 'error');
        }
    }

    async updateEvent(eventId, eventData) {
        try {
            this.showLoading('Updating event...');
            
            // Untuk update, kita delete yang lama dan buat yang baru (simplified)
            // Dalam implementasi real, seharusnya ada endpoint update
            await this.deleteEventFromDatabase(eventId);
            await this.createEvent(eventData);
            
        } catch (error) {
            this.hideLoading();
            console.error('Error updating event:', error);
            this.showNotification('❌ Failed to update event', 'error');
        }
    }

    // ✅ FIXED: Delete event dari database
    async deleteEvent(eventId) {
        if (!confirm('Are you sure you want to delete this event?')) return;

        try {
            this.showLoading('Deleting event...');
            
            await this.deleteEventFromDatabase(eventId);
            await this.loadEventsFromDatabase(); // Refresh dari database
            
            this.hideLoading();
            this.showNotification('🗑️ Event deleted successfully', 'success');
            this.renderEventsList(this.mockEvents);
            this.renderMiniCalendar();
            this.updateEventCounters();
            
            // ✅ Trigger sync ke semua dashboard
            this.triggerDashboardSync();
            
        } catch (error) {
            this.hideLoading();
            console.error('Error deleting event:', error);
            this.showNotification('❌ Failed to delete event', 'error');
        }
    }

    // ✅ FIXED: Load ALL events dari database dengan parsing waktu yang benar
    async loadEventsFromDatabase() {
        try {
            console.log('🔄 Loading ALL events from database...');
            
            // GUNAKAN ENDPOINT YANG MENGAMBIL SEMUA EVENT
            const response = await fetch('/api/calendar/simulation/events', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📅 All events response:', data);
            
            if (data.events && Array.isArray(data.events)) {
                this.mockEvents = data.events.map(event => {
                    // ✅ FIXED: Parse waktu dengan benar untuk database format
                    let startDate, endDate;
                    
                    try {
                        // Debug raw data
                        console.log('🔍 Raw event data:', {
                            id: event.id,
                            title: event.title,
                            raw_start: event.raw_start || event.start_time,
                            raw_end: event.raw_end || event.end_time,
                            formatted_start: event.start_time,
                            formatted_end: event.end_time
                        });
                        
                        // ✅ METHOD 1: Coba parse dari formatted ISO string
                        startDate = new Date(event.start_time);
                        endDate = new Date(event.end_time);
                        
                        // ✅ METHOD 2: Jika tidak valid, parse manual dari raw data
                        if (isNaN(startDate.getTime()) && event.raw_start) {
                            console.log('⚠️ ISO parsing failed, trying manual parse...');
                            startDate = this.parseDatabaseTime(event.raw_start);
                        }
                        if (isNaN(endDate.getTime()) && event.raw_end) {
                            endDate = this.parseDatabaseTime(event.raw_end);
                        }
                        
                        // ✅ METHOD 3: Fallback jika masih tidak valid
                        if (isNaN(startDate.getTime())) {
                            console.warn('Invalid start date, using current time');
                            startDate = new Date();
                        }
                        if (isNaN(endDate.getTime())) {
                            console.warn('Invalid end date, using start + 1 hour');
                            endDate = new Date(startDate.getTime() + 3600000); // +1 jam
                        }
                        
                    } catch (e) {
                        console.warn('Error parsing date:', e, event);
                        // Fallback ke tanggal sekarang
                        startDate = new Date();
                        endDate = new Date(startDate.getTime() + 3600000); // +1 jam
                    }
                    
                    // Debug parsed dates
                    console.log('🔍 Parsed dates:', {
                        title: event.title,
                        start: startDate.toISOString(),
                        end: endDate.toISOString(),
                        startLocal: startDate.toLocaleString(),
                        endLocal: endDate.toLocaleString()
                    });
                    
                    return {
                        id: event.id.toString(),
                        summary: event.title,
                        description: event.description || 'No description',
                        start: { 
                            dateTime: startDate.toISOString(),
                            display: startDate.toLocaleTimeString('id-ID', { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: false 
                            })
                        },
                        end: { 
                            dateTime: endDate.toISOString(),
                            display: endDate.toLocaleTimeString('id-ID', { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: false 
                            })
                        },
                        created: event.created_at,
                        // Tambahan: simpan data asli untuk debug
                        raw_data: event,
                        parsed_start: startDate,
                        parsed_end: endDate
                    };
                });
                
                console.log(`✅ Loaded ${this.mockEvents.length} events from database`);
                
                // Debug: tampilkan semua event yang di-load
                this.mockEvents.forEach((event, index) => {
                    console.log(`Event ${index + 1}: ${event.summary} | Start: ${event.start.display} (${event.parsed_start.toLocaleString()}) | Raw: ${event.raw_data.raw_start || event.raw_data.start_time}`);
                });
                
                // ✅ SIMPAN KE LOCALSTORAGE UNTUK HEALTH INSIGHTS
                this.saveToLocalStorageForHealth();
                
                this.updateEventCounters();
                this.renderEventsList(this.mockEvents);
                this.renderMiniCalendar();
                
                return true;
            } else {
                console.log('No events found or invalid response format');
                this.mockEvents = [];
                this.saveToLocalStorageForHealth();
                this.updateEventCounters();
                this.renderEventsList([]);
                return false;
            }
        } catch (error) {
            console.error('❌ Error loading events from database:', error);
            this.mockEvents = [];
            this.saveToLocalStorageForHealth();
            this.updateEventCounters();
            this.renderEventsList([]);
            return false;
        }
    }

    // ✅ NEW: Helper function untuk parse database time format
    parseDatabaseTime(timeStr) {
        if (!timeStr) return new Date();
        
        try {
            // Format: "2023-12-04 16:00:00"
            if (timeStr.includes(' ')) {
                const [datePart, timePart] = timeStr.split(' ');
                const [year, month, day] = datePart.split('-').map(Number);
                const [hour, minute, second] = timePart.split(':').map(Number);
                
                // Buat Date object dengan komponen
                return new Date(year, month - 1, day, hour, minute, second || 0);
            }
            // Format: "2023-12-04T16:00:00"
            else if (timeStr.includes('T')) {
                return new Date(timeStr);
            }
            // Format lain
            else {
                console.warn('Unknown time format, trying Date constructor:', timeStr);
                return new Date(timeStr);
            }
        } catch (e) {
            console.error('Error in parseDatabaseTime:', e, timeStr);
            return new Date();
        }
    }

    // ✅ Helper: Save data untuk health insights
    saveToLocalStorageForHealth() {
        const today = new Date();
        const todayEvents = this.mockEvents.filter(event => {
            try {
                const eventDate = new Date(event.start.dateTime);
                return eventDate.toDateString() === today.toDateString();
            } catch (e) {
                return false;
            }
        });
        
        // Calculate total hours
        let totalHours = 0;
        todayEvents.forEach(event => {
            try {
                const start = new Date(event.start.dateTime);
                const end = new Date(event.end.dateTime);
                totalHours += (end - start) / (1000 * 60 * 60);
            } catch (e) {
                console.warn('Error calculating event duration:', e);
            }
        });
        
        const healthData = {
            count: todayEvents.length,
            hours: parseFloat(totalHours.toFixed(1)),
            updated: new Date().toISOString(),
            events: todayEvents.map(e => ({
                title: e.summary,
                start: e.start.dateTime,
                end: e.end.dateTime
            }))
        };
        
        localStorage.setItem('calendar-today-events', JSON.stringify(healthData));
        
        console.log('📊 Saved to localStorage for health insights:', healthData);
    }

    // ✅ NEW: Delete event dari database
    async deleteEventFromDatabase(eventId) {
        try {
            console.log(`🗑️ Deleting event ${eventId} from database...`);
            
            const response = await fetch(`/api/calendar/simulation/delete/${eventId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const result = await response.json();
            console.log('Delete response:', result);
            
            if (!result.success) {
                throw new Error(result.error || 'Delete failed');
            }
            
            console.log(`✅ Event ${eventId} deleted from database`);
            return true;
        } catch (error) {
            console.error('Error deleting event from database:', error);
            throw error;
        }
    }

    editEvent(eventId) {
        const event = this.mockEvents.find(e => e.id === eventId);
        if (!event) {
            this.showNotification('Event not found', 'error');
            return;
        }

        try {
            const start = new Date(event.start.dateTime);
            const end = new Date(event.end.dateTime);
            
            console.log('🔍 Editing event:', {
                title: event.summary,
                start: start.toISOString(),
                end: end.toISOString(),
                startLocal: start.toLocaleString(),
                endLocal: end.toLocaleString()
            });
            
            // ✅ FIXED: Format untuk form input
            document.getElementById('event-title').value = event.summary || '';
            document.getElementById('event-date').value = start.toISOString().split('T')[0];
            document.getElementById('event-start').value = this.formatTimeForInput(start);
            document.getElementById('event-end').value = this.formatTimeForInput(end);
            document.getElementById('event-desc').value = event.description || '';
            
            // Update button
            const addBtn = document.getElementById('add-event');
            if (addBtn) {
                addBtn.textContent = 'Update Event';
                addBtn.className = 'btn bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm';
            }
            
            this.editingEventId = eventId;
            this.showNotification(`✏️ Editing: ${event.summary}`, 'info');
        } catch (error) {
            console.error('Error editing event:', error);
            this.showNotification('Error loading event data', 'error');
        }
    }

    // ✅ NEW: Format waktu untuk input type="time"
    formatTimeForInput(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    resetForm() {
        document.getElementById('event-title').value = '';
        document.getElementById('event-desc').value = '';
        document.getElementById('event-start').value = '10:00';
        document.getElementById('event-end').value = '11:00';
        this.setDefaultDate();
        
        // Reset button
        const addBtn = document.getElementById('add-event');
        if (addBtn) {
            addBtn.textContent = 'Add Event';
            addBtn.className = 'btn bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm';
        }
        
        this.editingEventId = null;
    }

    clearEventsForm() {
        this.resetForm();
        this.showNotification('📝 Form cleared', 'info');
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('event-date').value = today;
    }

    setDate(type) {
        const dateInput = document.getElementById('event-date');
        const today = new Date();
        
        if (type === 'today') {
            dateInput.value = today.toISOString().split('T')[0];
            this.showNotification('📅 Date set to today', 'info');
        } else if (type === 'tomorrow') {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateInput.value = tomorrow.toISOString().split('T')[0];
            this.showNotification('📅 Date set to tomorrow', 'info');
        }
    }

    // MINI CALENDAR dengan events
    renderMiniCalendar() {
        const cal = document.getElementById('mini-cal');
        if (!cal) {
            console.warn('❌ Mini calendar element not found');
            return;
        }

        const now = new Date();
        const year = now.getFullYear(), month = now.getMonth();
        const first = new Date(year, month, 1);
        const startDay = first.getDay();
        const days = new Date(year, month + 1, 0).getDate();

        cal.innerHTML = '';

        // Day headers
        ['M', 'S', 'S', 'R', 'K', 'J', 'S'].forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'text-xs text-slate-500 font-medium py-1';
            dayEl.textContent = day;
            cal.appendChild(dayEl);
        });

        // Empty days
        for (let i = 0; i < startDay; i++) {
            cal.appendChild(document.createElement('div'));
        }

        // Days dengan events
        for (let d = 1; d <= days; d++) {
            const dayEl = document.createElement('div');
            const dayDate = new Date(year, month, d);
            const dayEvents = this.getEventsForDate(dayDate);
            const hasEvents = dayEvents.length > 0;
            
            if (d === now.getDate()) {
                dayEl.className = 'h-10 flex flex-col items-center justify-center text-sm relative bg-blue-50 rounded-lg m-1';
                dayEl.innerHTML = `
                    <div class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        ${d}
                    </div>
                    ${hasEvents ? 
                        `<div class="text-[10px] text-blue-600 font-medium mt-1">${dayEvents.length}</div>` : 
                        '<div class="h-3"></div>'
                    }
                `;
            } else {
                dayEl.className = `h-10 flex flex-col items-center justify-center text-sm relative rounded-lg m-1 ${hasEvents ? 'bg-green-50' : ''}`;
                dayEl.innerHTML = `
                    <div class="text-slate-700 ${hasEvents ? 'font-semibold' : ''}">${d}</div>
                    ${hasEvents ? 
                        `<div class="text-[10px] text-green-600 font-medium mt-1">${dayEvents.length}</div>` : 
                        '<div class="h-3"></div>'
                    }
                `;
            }
            
            // Tooltip dengan event titles
            if (hasEvents) {
                dayEl.title = dayEvents.map(e => e.summary).join('\n');
                dayEl.style.cursor = 'pointer';
                dayEl.addEventListener('click', () => {
                    this.showNotification(`Events on ${d}/${month+1}: ${dayEvents.length} events`, 'info');
                });
            }
            
            cal.appendChild(dayEl);
        }
    }

    getEventsForDate(date) {
        return this.mockEvents.filter(event => {
            try {
                const eventDate = new Date(event.start.dateTime);
                return eventDate.toDateString() === date.toDateString();
            } catch (e) {
                return false;
            }
        });
    }

    renderEventsList(events) {
        const eventsList = document.getElementById('events-list');
        if (!eventsList) {
            console.warn('❌ Events list element not found');
            return;
        }
        
        if (!events || events.length === 0) {
            eventsList.innerHTML = `
                <div class="text-center text-slate-500 py-8">
                    <div class="text-4xl mb-2">📅</div>
                    <div class="font-medium">No events yet</div>
                    <div class="text-sm mt-2">Create your first event above!</div>
                </div>
            `;
            return;
        }

        // Sort events by start time
        const sortedEvents = [...events].sort((a, b) => {
            return new Date(a.start.dateTime) - new Date(b.start.dateTime);
        });

        const eventsHtml = sortedEvents.map(event => {
            try {
                const start = new Date(event.start.dateTime);
                const end = new Date(event.end.dateTime);
                const duration = this.calculateDuration(start, end);
                
                // Format tanggal dan waktu yang lebih baik
                const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
                
                // Debug untuk melihat waktu yang ditampilkan
                console.log('🔍 Rendering event:', {
                    title: event.summary,
                    start: start.toLocaleString(),
                    end: end.toLocaleString(),
                    displayStart: start.toLocaleTimeString('id-ID', timeOptions),
                    displayEnd: end.toLocaleTimeString('id-ID', timeOptions)
                });
                
                return `
                    <div class="event-item p-4 bg-white rounded-xl border border-slate-200 mb-3 hover:shadow-lg transition-all duration-300">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="font-bold text-slate-900 mb-2 text-lg">${event.summary}</div>
                                <div class="text-sm text-slate-600 mb-2">
                                    <span class="font-semibold">📅 ${start.toLocaleDateString('id-ID', dateOptions)}</span>
                                </div>
                                <div class="text-sm text-slate-500 mb-2">
                                    <span class="font-medium">🕐 ${start.toLocaleTimeString('id-ID', timeOptions)} - ${end.toLocaleTimeString('id-ID', timeOptions)}</span>
                                    <span class="text-slate-400 ml-2">(${duration})</span>
                                </div>
                                ${event.description && event.description !== 'No description' ? 
                                    `<div class="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg mt-2">${event.description}</div>` : 
                                    ''
                                }
                                <!-- Debug info -->
                                <div class="text-xs text-slate-400 mt-2">
                                    <small>DB: ${event.raw_data.raw_start || event.raw_data.start_time} → ${event.raw_data.raw_end || event.raw_data.end_time}</small>
                                </div>
                            </div>
                            <div class="flex gap-2 ml-4 flex-shrink-0">
                                <button onclick="calendar.editEvent('${event.id}')" 
                                        class="text-xs bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors font-medium">
                                    ✏️ Edit
                                </button>
                                <button onclick="calendar.deleteEvent('${event.id}')" 
                                        class="text-xs bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition-colors font-medium">
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('Error rendering event:', error, event);
                return '';
            }
        }).join('');

        eventsList.innerHTML = eventsHtml;
    }

    async listUpcomingEvents() {
        this.showLoading('Refreshing events...');
        await this.loadEventsFromDatabase(); // ✅ Refresh dari database
        this.renderMiniCalendar();
        this.updateEventCounters();
        this.hideLoading();
        this.showNotification('🔄 Events refreshed', 'success');
    }

    // ✅ NEW: Trigger sync ke dashboard lain
    triggerDashboardSync() {
        console.log('🔄 Triggering dashboard sync...');
        
        // Sync health insights
        if (window.healthInsights && typeof window.healthInsights.syncAllStats === 'function') {
            setTimeout(() => {
                window.healthInsights.syncAllStats();
                console.log('✅ Health insights synced');
            }, 500);
        }
        
        // Sync Nara voice assistant
        if (window.nara && typeof window.nara.loadRecentEvents === 'function') {
            setTimeout(() => {
                window.nara.loadRecentEvents();
                console.log('✅ Nara assistant synced');
            }, 800);
        }
        
        // Sync dashboard jika ada
        if (window.dashboardApp && typeof window.dashboardApp.loadTodaySchedule === 'function') {
            setTimeout(() => {
                window.dashboardApp.loadTodaySchedule();
                console.log('✅ Dashboard synced');
            }, 1000);
        }
    }

    // ✅ NEW: Debug function untuk cek database
    async debugDatabase() {
        try {
            console.log('🐛 DEBUG: Checking database...');
            
            const response = await fetch('/api/debug-database', {
                credentials: 'include'
            });
            
            const data = await response.json();
            console.log('🔍 Database debug:', data);
            
            // Show in notification
            this.showNotification(
                `Database: ${data.events_count} events found`,
                'info'
            );
            
            // Log sample events
            data.sample_events.forEach(event => {
                console.log(`Sample: ${event.title} - ${event.start_time}`);
            });
            
            // Log all events
            console.log('📋 All events in database:');
            data.all_events.forEach((event, index) => {
                console.log(`${index + 1}. ${event.title}: ${event.start_time} - ${event.end_time}`);
            });
            
        } catch (error) {
            console.error('Debug failed:', error);
        }
    }

    // UTILITIES
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showLoading(message = 'Loading...') {
        let loader = document.getElementById('calendar-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'calendar-loader';
            loader.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            loader.innerHTML = `
                <div class="bg-white rounded-xl p-6 flex items-center gap-3 shadow-2xl">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <div class="text-slate-700 font-medium">${message}</div>
                </div>
            `;
            document.body.appendChild(loader);
        }
    }

    hideLoading() {
        const loader = document.getElementById('calendar-loader');
        if (loader) loader.remove();
    }

    showNotification(message, type = 'info') {
        // Remove existing
        const existing = document.getElementById('calendar-notification');
        if (existing) existing.remove();

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
        notification.id = 'calendar-notification';
        notification.className = `fixed top-4 right-4 ${colors[type]} text-white p-4 rounded-xl shadow-2xl z-50 animate-fade-in max-w-md`;
        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-lg">${icons[type]}</span>
                <span class="flex-1 font-medium">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200 text-lg font-bold">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 5000);
    }
}

// Initialize dengan error handling
document.addEventListener('DOMContentLoaded', function() {
    try {
        window.calendar = new GoogleCalendar();
        console.log('🚀 Calendar started successfully');
        
        // Auto-refresh setiap 30 detik
        setInterval(() => {
            if (window.calendar && !window.calendar.isProcessing) {
                window.calendar.loadEventsFromDatabase();
            }
        }, 30000);
    } catch (error) {
        console.error('❌ Failed to initialize calendar:', error);
        alert('Calendar failed to load. Please refresh the page.');
    }
});