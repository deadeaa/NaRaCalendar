class NaraVoiceAssistant {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.isProcessing = false;
        this.transcript = '';
        this.commandHistory = [];
        this.successCount = 0;
        this.totalAttempts = 0;
        
        this.userId = null;
        this.userName = null;
        
        // Fast processing timeout
        this.processingTimeout = null;
        
        // Debug mode
        this.debugMode = false;
        
        // User's timezone
        this.userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Day names mapping
        this.daysOfWeek = {
            'sunday': 0, 'sun': 0, 'minggu': 0,
            'monday': 1, 'mon': 1, 'senin': 1,
            'tuesday': 2, 'tue': 2, 'tues': 2, 'selasa': 2,
            'wednesday': 3, 'wed': 3, 'rabu': 3,
            'thursday': 4, 'thu': 4, 'thurs': 4, 'kamis': 4,
            'friday': 5, 'fri': 5, 'jumat': 5,
            'saturday': 6, 'sat': 6, 'sabtu': 6
        };
        
        this.dayNames = [
            'Sunday', 'Monday', 'Tuesday', 'Wednesday', 
            'Thursday', 'Friday', 'Saturday'
        ];
        
        this.init();
    }

    async init() {
        console.log('🚀 Nara Assistant Initializing...');
        
        // Get user data
        await this.loadUserData();
        
        // Setup recognition
        this.setupSpeechRecognition();
        this.setupEventListeners();
        
        // Load initial data
        this.loadCommandHistory();
        this.loadRecentEvents();
        
        // Show welcome
        this.showResponse("🎯 <strong>Nara Ready!</strong> I'm your smart calendar assistant. Try saying 'Add meeting on Friday at 3 PM'");
        
        console.log('✅ Nara initialized successfully');
        
        // Toggle debug panel with Ctrl+D
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.toggleDebugPanel();
            }
        });
    }

    async loadUserData() {
        try {
            const response = await fetch('/api/user-data', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.userId = data.user_id;
                this.userName = data.name;
                this.debugLog('User loaded:', data);
            }
        } catch (error) {
            console.warn('Could not load user data:', error);
        }
    }

    setupSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            this.showResponse("❌ Your browser doesn't support speech recognition. Please use Chrome or Edge.", 'error');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            this.isListening = true;
            this.updateUI();
            
            // Add active class to mic button
            const micButton = document.getElementById('mic-button');
            if (micButton) {
                micButton.classList.add('mic-active');
            }
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    // Show interim results
                    this.updateTranscript(transcript, false);
                }
            }

            if (finalTranscript) {
                this.transcript = finalTranscript;
                this.updateTranscript(finalTranscript, true);
                this.addToCommandHistory(finalTranscript);
                this.processCommandFast(finalTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('🎤 Recognition error:', event.error);
            this.debugLog('Recognition error:', event.error);
            this.stopListening();
        };

        this.recognition.onend = () => {
            console.log('🎤 Speech recognition ended');
            this.isListening = false;
            this.updateUI();
            
            // Remove active class from mic button
            const micButton = document.getElementById('mic-button');
            if (micButton) {
                micButton.classList.remove('mic-active');
            }
        };
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        // ========== FIXED MICROPHONE BUTTON ==========
        const micButton = document.getElementById('mic-button');
        if (micButton) {
            console.log('✅ Found mic button, attaching listener');
            
            // Remove existing event listeners by cloning
            const newMicButton = micButton.cloneNode(true);
            micButton.parentNode.replaceChild(newMicButton, micButton);
            
            // Get the new button
            const currentMicButton = document.getElementById('mic-button');
            
            // Add click event
            currentMicButton.addEventListener('click', (e) => {
                console.log('🖱️ Mic button CLICKED');
                e.preventDefault();
                e.stopPropagation();
                
                if (this.isListening) {
                    this.stopListening();
                } else {
                    this.startListening();
                }
            });
            
            // Add touch event for mobile
            currentMicButton.addEventListener('touchend', (e) => {
                console.log('📱 Mic button TOUCHED');
                e.preventDefault();
                e.stopPropagation();
                
                if (this.isListening) {
                    this.stopListening();
                } else {
                    this.startListening();
                }
            });
        } else {
            console.error('❌ Mic button not found! Check HTML ID');
        }
        
        // ========== KEYBOARD SHORTCUTS ==========
        document.addEventListener('keydown', (e) => {
            // Space to toggle listening
            if (e.code === 'Space' && !e.target.matches('input, textarea, select, button')) {
                e.preventDefault();
                console.log('⌨️ Space key pressed');
                
                if (!this.isListening) {
                    this.startListening();
                } else {
                    this.stopListening();
                }
            }
            
            // Escape to stop listening
            if (e.code === 'Escape' && this.isListening) {
                e.preventDefault();
                console.log('⌨️ Escape key pressed');
                this.stopListening();
            }
        });
        
        // ========== OTHER BUTTONS ==========
        // Clear transcript button
        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearTranscript();
            });
        }
        
        // Test add event button
        const testBtn = document.getElementById('test-add');
        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                await this.testAddEvent();
            });
        }
        
        // Quick add button
        const quickAddBtn = document.getElementById('quick-add');
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', () => {
                this.showQuickAddModal();
            });
        }
        
        // Modal close buttons
        const closeQuickAdd = document.getElementById('close-quick-add');
        if (closeQuickAdd) {
            closeQuickAdd.addEventListener('click', () => {
                this.hideQuickAddModal();
            });
        }
        
        const cancelQuickAdd = document.getElementById('cancel-quick-add');
        if (cancelQuickAdd) {
            cancelQuickAdd.addEventListener('click', () => {
                this.hideQuickAddModal();
            });
        }
        
        const saveQuickAdd = document.getElementById('save-quick-add');
        if (saveQuickAdd) {
            saveQuickAdd.addEventListener('click', async () => {
                await this.saveQuickAddEvent();
            });
        }
        
        // Refresh events button
        const refreshBtn = document.getElementById('refresh-events');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadRecentEvents();
            });
        }
        
        console.log('✅ All event listeners attached');
    }

    startListening() {
        console.log('🎤 Attempting to start listening...');
        
        if (!this.recognition) {
            console.error('❌ Speech recognition not initialized');
            this.showResponse("❌ Speech recognition not available", 'error');
            return;
        }

        if (this.isListening) {
            console.warn('⚠️ Already listening');
            return;
        }

        if (this.isProcessing) {
            console.warn('⚠️ Currently processing previous command');
            return;
        }

        // Clear previous transcript
        this.transcript = '';
        this.updateTranscript('', true);
        
        // Visual feedback
        this.animateMicButton();
        
        try {
            this.recognition.start();
            console.log('✅ Speech recognition started successfully');
        } catch (error) {
            console.error('❌ Error starting speech recognition:', error);
            this.showResponse("❌ Could not access microphone. Please check permissions.", 'error');
            
            // Reset state
            this.isListening = false;
            this.updateUI();
        }
    }

    stopListening() {
        console.log('🛑 Stopping listening...');
        
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
                console.log('✅ Speech recognition stopped');
            } catch (error) {
                console.error('❌ Error stopping speech recognition:', error);
            }
        }
        
        // Ensure UI updates
        this.isListening = false;
        this.updateUI();
    }

    animateMicButton() {
        const micButton = document.getElementById('mic-button');
        if (micButton) {
            // Add pulse animation
            micButton.classList.add('animate-pulse');
            
            // Remove animation after 3 seconds
            setTimeout(() => {
                micButton.classList.remove('animate-pulse');
            }, 3000);
        }
    }

    updateUI() {
        console.log('🔄 Updating UI, isListening:', this.isListening, 'isProcessing:', this.isProcessing);
        
        const micIcon = document.getElementById('mic-icon');
        const statusText = document.getElementById('status-text');
        
        if (!micIcon || !statusText) {
            console.error('❌ UI elements not found');
            return;
        }
        
        if (this.isProcessing) {
            micIcon.className = 'fas fa-spinner fa-spin text-3xl text-white';
            statusText.innerHTML = '<span class="status-dot status-processing"></span>Processing command...';
        } else if (this.isListening) {
            micIcon.className = 'fas fa-stop text-3xl text-white';
            statusText.innerHTML = '<span class="status-dot status-listening"></span>Listening... Speak now';
        } else {
            micIcon.className = 'fas fa-microphone text-3xl text-white';
            statusText.innerHTML = '<span class="status-dot status-ready"></span>Ready to listen';
        }
    }

    updateTranscript(text, isFinal = false) {
        const transcriptEl = document.getElementById('transcript');
        if (!transcriptEl) {
            console.error('❌ Transcript element not found');
            return;
        }

        if (!text && isFinal) {
            transcriptEl.innerHTML = '<div class="text-slate-400 italic">Speak to see your command here...</div>';
            return;
        }

        if (isFinal) {
            transcriptEl.innerHTML = `<div class="text-slate-800 font-medium fade-in">"${text}"</div>`;
        } else {
            transcriptEl.innerHTML = `<div class="text-slate-600 fade-in">"${text}"</div>`;
        }
    }

    clearTranscript() {
        this.transcript = '';
        this.updateTranscript('', true);
    }

    processCommandFast(command) {
        console.log('⚡ Processing command:', command);
        
        this.isProcessing = true;
        this.updateUI();
        
        // Clear any existing timeout
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
        }
        
        // Process immediately (no artificial delay)
        this.processingTimeout = setTimeout(async () => {
            try {
                this.totalAttempts++;
                
                // Simple command detection
                const lowerCommand = command.toLowerCase();
                
                if (this.isAddCommand(lowerCommand)) {
                    await this.handleAddEventFast(command);
                } 
                else if (this.isShowCommand(lowerCommand)) {
                    await this.handleShowEvents();
                }
                else if (this.isDeleteCommand(lowerCommand)) {
                    await this.handleDeleteEvent(command);
                }
                else if (this.isGreeting(lowerCommand)) {
                    this.showResponse(`👋 Hello${this.userName ? ' ' + this.userName : ''}! How can I help you with your calendar?`);
                }
                else {
                    this.showResponse(`I heard: "${command}"<br>Try saying: "Add [event] on [day] at [time]"`, 'info');
                }
                
            } catch (error) {
                console.error('Command processing error:', error);
                this.showResponse("❌ Sorry, there was an error processing your command", 'error');
            } finally {
                this.isProcessing = false;
                this.updateUI();
                this.updateStats();
            }
        }, 300);
    }

    async handleAddEventFast(command) {
        console.log('⚡ Fast add event:', command);
        
        // Extract event details with SMART DAY DETECTION
        const eventData = this.extractEventDetailsWithDay(command);
        
        if (!eventData.title) {
            this.showResponse("What should I call this event? Please include a title.", 'info');
            return;
        }
        
        // Show immediate confirmation
        this.showResponse(`✅ Adding: <strong>${eventData.title}</strong> on ${eventData.dayDisplay} at ${eventData.timeDisplay}...`);
        
        // Save to database
        const success = await this.saveEventToDatabaseFixed(eventData);
        
        if (success) {
            this.successCount++;
            this.showResponse(`🎉 <strong>${eventData.title}</strong> added successfully!<br>${eventData.dayDisplay} at ${eventData.timeDisplay} (${eventData.duration})`);
            
            // Sinkronkan semua statistik
            await this.loadRecentEvents();
            this.updateStats();
            
            // Update calendar jika open
            if (window.calendar && typeof window.calendar.listUpcomingEvents === 'function') {
                setTimeout(() => window.calendar.listUpcomingEvents(), 500);
            }
            
            // Trigger sync di health insights
            if (window.healthInsights && typeof window.healthInsights.syncAllStats === 'function') {
                setTimeout(() => window.healthInsights.syncAllStats(), 1000);
            }
        } else {
            this.showResponse(`❌ Couldn't add "${eventData.title}". Please try again or use Quick Add.`, 'error');
        }
    }

    // ========== SMART DAY DETECTION ==========
    extractEventDetailsWithDay(command) {
        console.log('🔍 Extracting from command:', command);
        
        const result = {
            title: '',
            start: null,
            end: null,
            duration: '1 hour',
            timeDisplay: '',
            dayDisplay: '',
            targetDay: null,
            dayOffset: 0
        };
        
        const lowerCommand = command.toLowerCase();
        
        // 1. DETECT DAY OF WEEK
        const today = new Date();
        const todayDay = today.getDay(); // 0=Sunday, 1=Monday, etc
        
        // Check for specific day names
        let targetDay = null;
        let dayKeyword = 'today';
        
        // Check all possible day names
        for (const [dayName, dayNumber] of Object.entries(this.daysOfWeek)) {
            if (lowerCommand.includes(dayName)) {
                targetDay = dayNumber;
                dayKeyword = this.dayNames[dayNumber];
                console.log(`📅 Detected day: ${dayKeyword} (number: ${dayNumber})`);
                break;
            }
        }
        
        // Check for "tomorrow"
        if (lowerCommand.includes('tomorrow')) {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            targetDay = tomorrow.getDay();
            dayKeyword = 'tomorrow';
            console.log(`📅 Detected: Tomorrow (${this.dayNames[targetDay]})`);
        }
        
        // Check for "next week" or "next monday/tuesday/etc"
        let isNextWeek = false;
        if (lowerCommand.includes('next week') || lowerCommand.includes('next ')) {
            isNextWeek = true;
            console.log('📅 Detected: Next week');
        }
        
        // 2. DETECT TIME
        const timeData = this.extractTimeFromCommand(command);
        
        // 3. DETECT TITLE
        let title = this.extractTitleFromCommand(command, dayKeyword, timeData.timeWords);
        
        // 4. CALCULATE TARGET DATE
        const eventDate = this.calculateTargetDate(today, todayDay, targetDay, dayKeyword, isNextWeek);
        
        // Set time pada eventDate
        eventDate.setHours(timeData.hours, timeData.minutes, 0, 0);
        
        console.log('🎯 Calculated event date:', {
            original: command,
            targetDay: targetDay !== null ? this.dayNames[targetDay] : 'today',
            dayKeyword: dayKeyword,
            eventDate: eventDate.toString(),
            time: `${timeData.hours}:${timeData.minutes}`,
            title: title
        });
        
        // 5. FORMAT FOR DATABASE
        const year = eventDate.getFullYear();
        const month = String(eventDate.getMonth() + 1).padStart(2, '0');
        const day = String(eventDate.getDate()).padStart(2, '0');
        const hours = String(eventDate.getHours()).padStart(2, '0');
        const minutes = String(eventDate.getMinutes()).padStart(2, '0');
        
        result.start = `${year}-${month}-${day} ${hours}:${minutes}:00`;
        
        // End time: 1 hour later
        const endDate = new Date(eventDate.getTime() + (60 * 60 * 1000));
        const endHours = String(endDate.getHours()).padStart(2, '0');
        const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
        result.end = `${year}-${month}-${day} ${endHours}:${endMinutes}:00`;
        
        // Format display
        const displayTime = eventDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        const displayDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
        
        result.title = title;
        result.timeDisplay = displayTime;
        result.dayDisplay = displayDate;
        result.targetDay = targetDay;
        
        // Calculate day offset
        const diffTime = eventDate - today;
        result.dayOffset = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        console.log('✅ Final event details:', result);
        
        return result;
    }

    // Helper: Calculate target date based on day detection
    calculateTargetDate(today, todayDay, targetDay, dayKeyword, isNextWeek) {
        const eventDate = new Date(today);
        
        if (dayKeyword === 'tomorrow') {
            // Tomorrow
            eventDate.setDate(eventDate.getDate() + 1);
            return eventDate;
        }
        
        if (targetDay !== null) {
            // Specific day detected
            let daysToAdd = targetDay - todayDay;
            
            if (daysToAdd < 0) {
                // If the day is earlier in the week (e.g., today is Friday, user says Wednesday)
                // Go to next week
                daysToAdd += 7;
            } else if (daysToAdd === 0) {
                // Same day as today
                if (isNextWeek) {
                    // User explicitly said "next Monday" (when today is Monday)
                    daysToAdd = 7;
                } else {
                    // Today is the target day, check if it makes sense
                    // If user says "Monday" on Monday, they probably mean today
                    // Unless they specify "next Monday"
                    // We'll keep it as today for now
                    console.log('📅 Same day detected, keeping today');
                }
            }
            
            // Add "next week" offset if specified
            if (isNextWeek) {
                daysToAdd += 7;
            }
            
            eventDate.setDate(eventDate.getDate() + daysToAdd);
            return eventDate;
        }
        
        // No specific day detected, return today
        return eventDate;
    }

    // Helper: Extract time from command
    extractTimeFromCommand(command) {
        const lowerCommand = command.toLowerCase();
        
        // Default time: 2 PM
        let hours = 14;
        let minutes = 0;
        let timeWords = [];
        
        // Pattern untuk waktu
        const timePatterns = [
            /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
            /(\d{1,2})\s*(am|pm)/i,
            /at\s+(\d{1,2})(?::(\d{2}))?/i,
            /(\d{1,2}):(\d{2})/i,
            /(\d{1,2})\s+o'clock/i
        ];
        
        for (const pattern of timePatterns) {
            const match = command.match(pattern);
            if (match) {
                hours = parseInt(match[1]);
                minutes = match[2] ? parseInt(match[2]) : 0;
                
                // Handle AM/PM
                if (match[3]) {
                    const period = match[3].toLowerCase();
                    if (period === 'pm' && hours < 12) {
                        hours += 12;
                    } else if (period === 'am' && hours === 12) {
                        hours = 0;
                    }
                }
                
                // Extract time words for title cleaning
                timeWords = match[0].split(/\s+/);
                break;
            }
        }
        
        // Check for time-related keywords
        if (lowerCommand.includes('morning')) {
            hours = 9; // 9 AM
        } else if (lowerCommand.includes('afternoon')) {
            hours = 14; // 2 PM
        } else if (lowerCommand.includes('evening') || lowerCommand.includes('night')) {
            hours = 19; // 7 PM
        } else if (lowerCommand.includes('noon') || lowerCommand.includes('lunch')) {
            hours = 12; // 12 PM
        } else if (lowerCommand.includes('midnight')) {
            hours = 0; // 12 AM
        }
        
        // Validate hours
        if (hours < 0 || hours > 23) hours = 14;
        if (minutes < 0 || minutes > 59) minutes = 0;
        
        return { hours, minutes, timeWords };
    }

    // Helper: Extract title from command
    extractTitleFromCommand(command, dayKeyword, timeWords) {
        let title = command;
        
        // Remove command words
        title = title.replace(/^(add|create|schedule|make|set up|book|i need|i want)\s+/i, '');
        
        // Remove day keywords
        for (const dayName of Object.keys(this.daysOfWeek)) {
            const regex = new RegExp(`\\b${dayName}\\b`, 'gi');
            title = title.replace(regex, '');
        }
        
        // Remove "tomorrow", "today", "next week"
        title = title.replace(/\b(tomorrow|today|next week|next)\b/gi, '');
        
        // Remove time words
        for (const timeWord of timeWords) {
            const regex = new RegExp(`\\b${timeWord}\\b`, 'gi');
            title = title.replace(regex, '');
        }
        
        // Remove time indicators
        title = title.replace(/\b(at|@|on|for|from|to|until)\b/gi, '');
        
        // Clean up extra spaces and punctuation
        title = title
            .replace(/\s+/g, ' ')
            .replace(/^\s+|\s+$/g, '')
            .replace(/[.,!?;:]$/, '');
        
        // If title is empty after cleaning, use generic title
        if (!title || title.length < 2) {
            title = 'Calendar Event';
        }
        
        return title.charAt(0).toUpperCase() + title.slice(1);
    }

    // ========== DATABASE SAVE FUNCTION ==========
    async saveEventToDatabaseFixed(eventData) {
        try {
            console.log('💾 Saving event to database:', eventData);
            
            const eventPayload = {
                title: eventData.title,
                description: `Added via voice: ${eventData.dayDisplay} at ${eventData.timeDisplay}`,
                start_time: eventData.start,
                end_time: eventData.end
            };
            
            console.log('📤 Sending payload to server:', eventPayload);
            
            const response = await fetch('/api/calendar/simulation/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(eventPayload)
            });
            
            console.log('📥 Server response status:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Event saved successfully:', result);
                return true;
            } else {
                const errorText = await response.text();
                console.error('❌ Save failed:', response.status, errorText);
                return false;
            }
        } catch (error) {
            console.error('❌ Network error:', error);
            return false;
        }
    }

    // Command detection helpers
    isAddCommand(command) {
        return /^(add|create|schedule|make|set up|book|i need|i want)/i.test(command) || 
                command.includes(' add ') ||
                command.includes(' create ') ||
                command.includes(' schedule ');
    }

    isShowCommand(command) {
        return /^(show|list|view|display|what|tell me|do i have)/i.test(command) ||
                command.includes(' my schedule') ||
                command.includes(' my events') ||
                command.includes(' my calendar');
    }

    isDeleteCommand(command) {
        return /^(delete|remove|cancel|clear|drop)/i.test(command) ||
                command.includes(' delete ') ||
                command.includes(' remove ') ||
                command.includes(' cancel ');
    }

    isGreeting(command) {
        return /^(hello|hi|hey|greetings|good morning|good afternoon|good evening|nara)/i.test(command);
    }

    async handleShowEvents() {
        try {
            const response = await fetch('/api/today-schedule', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.schedule && data.schedule.length > 0) {
                    let html = `<strong>Today's Schedule (${data.schedule.length} events):</strong><br><br>`;
                    data.schedule.forEach(event => {
                        html += `• ${event.title} <span class="text-slate-500">(${event.time})</span><br>`;
                    });
                    this.showResponse(html);
                } else {
                    this.showResponse("📅 Your calendar is empty today. Add some events!");
                }
            }
        } catch (error) {
            this.showResponse("Couldn't load events. Please try again.", 'error');
        }
    }

    async handleDeleteEvent(command) {
        this.showResponse("To delete events, please use the calendar page for now.", 'info');
    }

    // UI Methods
    showResponse(message, type = 'info') {
        const responseEl = document.getElementById('response');
        if (!responseEl) return;
        
        const colors = {
            info: 'text-indigo-800',
            success: 'text-green-600',
            error: 'text-red-600',
            warning: 'text-amber-600'
        };
        
        responseEl.innerHTML = `<div class="${colors[type] || colors.info} fade-in">${message}</div>`;
        responseEl.scrollTop = responseEl.scrollHeight;
    }

    async loadRecentEvents() {
        try {
            console.log('🔄 [NARA] loadRecentEvents() called');
            
            let todayEvents = [];
            let todayCount = 0;
            
            // OPTION 1: Get from calendar
            if (window.calendar && window.calendar.mockEvents) {
                console.log('[NARA] Using calendar.mockEvents');
                
                const today = new Date();
                const todayDateStr = today.toDateString();
                
                todayEvents = window.calendar.mockEvents.filter(event => {
                    try {
                        if (!event.start || !event.start.dateTime) return false;
                        const eventDate = new Date(event.start.dateTime);
                        return eventDate.toDateString() === todayDateStr;
                    } catch (error) {
                        console.warn('[NARA] Error filtering event:', error);
                        return false;
                    }
                });
                
                todayCount = todayEvents.length;
                console.log('[NARA] Found in calendar:', todayCount, 'events');
                
                // Convert calendar format to Nara format
                todayEvents = todayEvents.map(event => ({
                    id: event.id,
                    title: event.summary,
                    start_time: event.start.dateTime
                }));
            }
            
            // OPTION 2: Get from localStorage (fallback)
            if (todayCount === 0) {
                console.log('[NARA] Calendar empty, checking localStorage');
                const saved = localStorage.getItem('calendar-today-events');
                if (saved) {
                    const data = JSON.parse(saved);
                    todayCount = data.count || 0;
                    todayEvents = Array(todayCount).fill({ 
                        id: Date.now().toString(),
                        title: 'Calendar Event',
                        start_time: new Date().toISOString()
                    });
                    console.log('[NARA] Found in localStorage:', todayCount, 'events');
                }
            }
            
            console.log('[NARA] Final today events count:', todayCount);
            
            // Update Today's Events counter
            const possibleIds = ['speak-today-count', 'today-count', 'today-events'];
            let updated = false;
            
            for (const id of possibleIds) {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = todayCount;
                    console.log(`[NARA] Updated ${id}:`, todayCount);
                    updated = true;
                    break;
                }
            }
            
            if (!updated) {
                console.error('[NARA] Could not find today events element. Tried IDs:', possibleIds);
            }
            
            // Display recent events
            this.displayRecentEvents(todayEvents.slice(0, 5));
            
        } catch (error) {
            console.error('[NARA] Error in loadRecentEvents:', error);
        }
    }

    updateStats() {
        try {
            console.log('[NARA] updateStats() called');
            
            // 1. Hitung command hari ini
            const today = new Date();
            const todayStr = this.getDateString(today);
            
            console.log('[NARA] Today string for filtering:', todayStr);
            console.log('[NARA] Full command history length:', this.commandHistory.length);
            
            if (this.commandHistory.length === 0) {
                console.log('[NARA] Command history is EMPTY - showing 0');
                
                // Update Today's Commands ke 0
                this.updateTodayCommandsCount(0);
                this.updateSuccessRate();
                return;
            }
            
            // Filter commands untuk hari ini
            const todayCommands = this.commandHistory.filter(cmd => {
                if (!cmd || !cmd.date) return false;
                return cmd.date === todayStr;
            });
            
            console.log('[NARA] Today commands found:', todayCommands.length);
            
            // Update Today's Commands
            this.updateTodayCommandsCount(todayCommands.length);
            
            // 2. Hitung success rate
            this.updateSuccessRate();
            
        } catch (error) {
            console.error('[NARA] Error in updateStats:', error);
            this.updateTodayCommandsCount(0);
        }
    }

    updateTodayCommandsCount(count) {
        const possibleIds = ['command-count', 'today-commands', 'commands-today'];
        
        for (const id of possibleIds) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = count;
                console.log(`[NARA] Updated ${id}:`, count);
                return;
            }
        }
    }

    updateSuccessRate() {
        const totalAttempts = this.totalAttempts || 0;
        const successCount = this.successCount || 0;
        const successRate = totalAttempts > 0 
            ? Math.round((successCount / totalAttempts) * 100)
            : 100;
        
        const successRateElement = document.getElementById('success-rate');
        if (successRateElement) {
            successRateElement.textContent = `${successRate}%`;
            console.log('[NARA] Updated success-rate:', successRate + '%');
        } else {
            console.error('[NARA] Element success-rate not found');
        }
    }

    getDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    addToCommandHistory(command) {
        try {
            const now = new Date();
            
            const dateStr = this.getDateString(now);
            const timeStr = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
            
            console.log('[NARA] Adding command:', {
                command: command,
                date: dateStr,
                time: timeStr
            });
            
            const commandObj = {
                command: command,
                timestamp: timeStr,
                date: dateStr
            };
            
            this.commandHistory.unshift(commandObj);
            
            // Keep only recent commands (max 100)
            if (this.commandHistory.length > 100) {
                this.commandHistory = this.commandHistory.slice(0, 50);
            }
            
            // Save to localStorage
            localStorage.setItem('nara-commands', JSON.stringify(this.commandHistory));
            
            // Update stats immediately
            this.updateStats();
            
        } catch (error) {
            console.error('[NARA] Error adding command to history:', error);
        }
    }

    loadCommandHistory() {
        try {
            const saved = localStorage.getItem('nara-commands');
            if (saved) {
                const parsed = JSON.parse(saved);
                
                // Konversi format tanggal lama ke format baru jika diperlukan
                this.commandHistory = parsed.map(item => {
                    if (!item.date) return item;
                    
                    if (item.date.includes('/')) {
                        const parts = item.date.split('/');
                        if (parts.length === 3) {
                            const month = parts[0].padStart(2, '0');
                            const day = parts[1].padStart(2, '0');
                            const year = parts[2];
                            item.date = `${year}-${month}-${day}`;
                        }
                    }
                    return item;
                });
                
                console.log('[NARA] Loaded command history:', this.commandHistory.length, 'items');
                
                // Update stats setelah load
                this.updateStats();
                
                // Jika kosong, tambah beberapa contoh untuk testing
                if (this.commandHistory.length === 0) {
                    const todayStr = this.getDateString(new Date());
                    this.commandHistory = [
                        { command: 'Add study session on Friday at 4 PM', timestamp: '14:30', date: todayStr },
                        { command: 'Show my events', timestamp: '15:45', date: todayStr }
                    ];
                    localStorage.setItem('nara-commands', JSON.stringify(this.commandHistory));
                    console.log('[NARA] Added sample commands for today');
                    this.updateStats();
                }
                
            } else {
                console.log('[NARA] No saved command history found');
                
                // Initialize with empty array
                this.commandHistory = [];
                localStorage.setItem('nara-commands', JSON.stringify([]));
            }
        } catch (error) {
            console.warn('Could not load command history:', error);
            this.commandHistory = [];
        }
    }

    displayRecentEvents(events) {
        const container = document.getElementById('recent-events');
        if (!container) return;
        
        if (!events || events.length === 0) {
            container.innerHTML = '<div class="text-center py-4 text-slate-400">No events added yet</div>';
            return;
        }
        
        container.innerHTML = events.map(event => {
            const date = new Date(event.start_time);
            const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const day = date.toLocaleDateString([], { weekday: 'short' });
            const tagType = this.getEventTag(event.title);
            
            return `
                <div class="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <span class="event-tag ${tagType}">${this.getEventType(event.title)}</span>
                        <div>
                            <div class="font-medium text-slate-800">${event.title}</div>
                            <div class="text-xs text-slate-500">${day} ${time}</div>
                        </div>
                    </div>
                    <button onclick="nara.deleteEvent('${event.id}')" 
                            class="text-xs text-red-500 hover:text-red-700">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    getEventTag(title) {
        const lower = title.toLowerCase();
        if (lower.includes('study') || lower.includes('learn') || lower.includes('read')) return 'tag-study';
        if (lower.includes('meeting') || lower.includes('meet')) return 'tag-meeting';
        if (lower.includes('work') || lower.includes('project') || lower.includes('task')) return 'tag-work';
        if (lower.includes('lunch') || lower.includes('dinner') || lower.includes('food') || lower.includes('coffee')) return 'tag-personal';
        if (lower.includes('game') || lower.includes('gaming') || lower.includes('play')) return 'tag-other';
        return 'tag-other';
    }

    getEventType(title) {
        const lower = title.toLowerCase();
        if (lower.includes('study')) return 'Study';
        if (lower.includes('meeting')) return 'Meeting';
        if (lower.includes('work')) return 'Work';
        if (lower.includes('lunch') || lower.includes('dinner')) return 'Meal';
        if (lower.includes('game')) return 'Game';
        return 'Event';
    }

    // Quick Add Modal
    showQuickAddModal() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('quick-date').value = today;
        document.getElementById('quick-time').value = '14:00';
        document.getElementById('quick-title').value = '';
        
        document.getElementById('quick-add-modal').classList.remove('hidden');
        document.getElementById('quick-title').focus();
    }

    hideQuickAddModal() {
        document.getElementById('quick-add-modal').classList.add('hidden');
    }

    async saveQuickAddEvent() {
        const title = document.getElementById('quick-title').value.trim();
        const date = document.getElementById('quick-date').value;
        const time = document.getElementById('quick-time').value;
        
        if (!title) {
            this.showResponse("Please enter a title", 'error');
            return;
        }
        
        // Format untuk database: "YYYY-MM-DD HH:MM:SS"
        const startDateTime = `${date} ${time}:00`;
        
        // Calculate end time (1 hour later)
        const [hours, minutes] = time.split(':').map(Number);
        const startDate = new Date(`${date}T${time}:00`);
        const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
        
        const endHours = String(endDate.getHours()).padStart(2, '0');
        const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
        const endDateTime = `${date} ${endHours}:${endMinutes}:00`;
        
        const eventData = {
            title: title,
            start: startDateTime,
            end: endDateTime,
            timeDisplay: `${date} ${time}`
        };
        
        const success = await this.saveEventToDatabaseFixed(eventData);
        
        if (success) {
            this.showResponse(`✅ "${title}" added successfully!`, 'success');
            this.hideQuickAddModal();
            await this.loadRecentEvents();
        } else {
            this.showResponse("❌ Failed to add event", 'error');
        }
    }

    quickAddEvent(duration) {
        const title = document.getElementById('quick-title').value.trim();
        if (!title) {
            document.getElementById('quick-title').focus();
            return;
        }
        
        this.saveQuickAddEvent();
    }

    // Test method
    async testAddEvent() {
        const testEvents = [
            "Add study session on Friday at 4 PM",
            "Team meeting next Monday at 10 AM",
            "Lunch with friends on Wednesday at 1 PM",
            "Work on project tomorrow at 3 PM",
            "Gaming session on Saturday at 8 PM"
        ];
        
        const randomEvent = testEvents[Math.floor(Math.random() * testEvents.length)];
        
        // Tambah ke command history dulu
        this.addToCommandHistory(randomEvent);
        
        // Update transcript
        this.updateTranscript(randomEvent, true);
        
        // Process command
        await this.handleAddEventFast(randomEvent);
    }

    // Debug methods
    debugLog(...args) {
        if (this.debugMode) {
            console.log('[NARA]', ...args);
            
            const debugEl = document.getElementById('debug-content');
            if (debugEl) {
                const time = new Date().toLocaleTimeString();
                debugEl.innerHTML = `[${time}] ${args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg) : arg
                ).join(' ')}<br>` + debugEl.innerHTML.substring(0, 1000);
            }
        }
    }

    toggleDebugPanel() {
        const panel = document.getElementById('debug-panel');
        panel.classList.toggle('hidden');
        this.debugMode = !this.debugMode;
        this.debugLog('Debug mode:', this.debugMode ? 'ON' : 'OFF');
    }

    // Public methods for UI
    async deleteEvent(eventId) {
        if (!confirm('Delete this event?')) return;
        
        try {
            const response = await fetch(`/api/calendar/simulation/delete/${eventId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (response.ok) {
                this.showResponse('Event deleted', 'success');
                await this.loadRecentEvents();
            }
        } catch (error) {
            this.showResponse('Delete failed', 'error');
        }
    }
}

// Initialize dengan delay untuk memastikan DOM siap
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM Content Loaded - Starting Nara...');
    
    // Tunggu 500ms untuk memastikan semua elemen sudah render
    setTimeout(() => {
        try {
            window.nara = new NaraVoiceAssistant();
            console.log('🎤 Nara Assistant loaded successfully!');
            
            // Manual backup event listener (safety net)
            const micButton = document.getElementById('mic-button');
            if (micButton) {
                console.log('🔧 Adding manual backup listener');
                micButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ BACKUP: Mic button clicked');
                    
                    if (window.nara) {
                        if (window.nara.isListening) {
                            window.nara.stopListening();
                        } else {
                            window.nara.startListening();
                        }
                    }
                });
            }
            
            // Show welcome message
            setTimeout(() => {
                if (window.nara) {
                    window.nara.showResponse("🎯 <strong>Ready!</strong> Click the microphone or press Space to start speaking");
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ Failed to initialize Nara:', error);
        }
    }, 500);
});