class ScientificHealthInsights {
    constructor() {
        this.healthData = {};
        this.calendarData = [];
        this.today = this.getCurrentDateString();
        this.lastCheckedDate = null;
        this.autoRefreshInterval = null;
        this.init();
    }

    async init() {
        this.loadStoredData();
        this.checkForNewDay();
        await this.loadCalendarData();
        this.setupEventListeners();
        this.updateDisplay();
        this.updateDateDisplay();
        
        // Auto-perform analysis jika ada data health untuk hari ini
        if (this.healthData[this.today]) {
            setTimeout(() => this.performAnalysis(), 2000);
        }
    }

    async syncAllStats() {
        console.log('🔄 Syncing all statistics...');
        
        try {
            // 1. Update workload stats dari database
            await this.updateWorkloadStats();
            
            // 2. Update calendar counters jika calendar ada
            if (window.calendar && typeof window.calendar.loadEventsFromDatabase === 'function') {
                await window.calendar.loadEventsFromDatabase();
                window.calendar.updateEventCounters();
            }
            
            // 3. Update Nara stats jika nara ada
            if (window.nara && typeof window.nara.loadRecentEvents === 'function') {
                await window.nara.loadRecentEvents();
                window.nara.updateStats();
            }
            
            // 4. Update display
            this.updateDisplay();
            this.updateDateDisplay();
            
            console.log('✅ All statistics synced');
            
        } catch (error) {
            console.error('Error syncing stats:', error);
        }
    }

// Panggil syncAllStats() setelah save event atau refresh
    getCurrentDateString() {
        const now = new Date();
        return now.toISOString().split('T')[0]; // Format YYYY-MM-DD
    }

    checkForNewDay() {
        const lastChecked = localStorage.getItem('lastCheckedDate');
        
        // Reset form input setiap hari baru
        if (lastChecked !== this.today) {
            console.log("🔔 New day detected! Resetting health check form.");
            localStorage.setItem('lastCheckedDate', this.today);
            
            // Reset modal form untuk hari baru
            this.resetModalForm();
            
            // Clear pengaturan Sleep Quality kembali ke default
            this.setSleepQuality(3);
        }
    }

    resetModalForm() {
        // Reset semua input form ke nilai default
        document.getElementById('sleep-hours').value = '';
        document.getElementById('bed-time').value = '22:30';
        document.getElementById('wake-time').value = '06:30';
        this.setSleepQuality(3);
        document.getElementById('stress-scale').value = 5;
        this.updateStressDisplay(5);
        this.updateSliderGradient(5);
        
        // Reset semua checkbox stress symptoms
        document.querySelectorAll('.stress-symptom').forEach(checkbox => {
            checkbox.checked = false;
        });
    }

    loadStoredData() {
        const stored = localStorage.getItem('scientificHealthData');
        if (stored) {
            this.healthData = JSON.parse(stored);
        }
        
        // Load last checked date
        this.lastCheckedDate = localStorage.getItem('lastCheckedDate');
    }

    saveStoredData() {
        localStorage.setItem('scientificHealthData', JSON.stringify(this.healthData));
    }

    async loadCalendarData() {
        try {
            console.log('🔄 Loading calendar data from database...');
            
            // Simulasi mengambil data dari database
            const today = new Date();
            const mockEvents = [
                {
                    id: 1,
                    summary: "Morning Meeting",
                    start: { dateTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).toISOString() },
                    end: { dateTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0).toISOString() }
                },
                {
                    id: 2,
                    summary: "Project Work",
                    start: { dateTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30).toISOString() },
                    end: { dateTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 30).toISOString() }
                },
                {
                    id: 3,
                    summary: "Lunch Break",
                    start: { dateTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 30).toISOString() },
                    end: { dateTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30).toISOString() }
                },
                {
                    id: 4,
                    summary: "Client Call",
                    start: { dateTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString() },
                    end: { dateTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0).toISOString() }
                }
            ];
            
            this.calendarData = mockEvents;
            console.log(`✅ Loaded ${this.calendarData.length} events`);
            
        } catch (error) {
            console.error('❌ Error loading calendar data:', error);
            this.calendarData = [];
        }
    }

    setupEventListeners() {
        document.getElementById('open-input-modal').addEventListener('click', () => this.showInputModal());
        document.getElementById('open-input-btn').addEventListener('click', () => this.showInputModal());
        document.getElementById('close-modal').addEventListener('click', () => this.hideInputModal());
        document.getElementById('cancel-input').addEventListener('click', () => this.hideInputModal());
        document.getElementById('save-health-data').addEventListener('click', () => this.saveHealthData());

        document.querySelectorAll('.sleep-quality').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const quality = parseInt(e.target.closest('button').dataset.quality);
                this.setSleepQuality(quality);
            });
        });

        const stressSlider = document.getElementById('stress-scale');
        stressSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.updateStressDisplay(value);
            this.updateSliderGradient(value);
        });

        this.updateSliderGradient(5);

        document.getElementById('refresh-analysis').addEventListener('click', () => this.performAnalysis());
        document.getElementById('emergency-break').addEventListener('click', () => this.suggestEmergencyBreak());
        document.getElementById('sleep-plan').addEventListener('click', () => this.generateSleepPlan());
        document.getElementById('stress-management').addEventListener('click', () => this.generateStressPlan());

        document.getElementById('input-modal').addEventListener('click', (e) => {
            if (e.target.id === 'input-modal') {
                this.hideInputModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('input-modal').classList.contains('hidden')) {
                this.hideInputModal();
            }
        });
    }

    updateSliderGradient(value) {
        const slider = document.getElementById('stress-scale');
        const percentage = ((value - 1) / 9) * 100;
        
        let gradient;
        if (value <= 3) {
            gradient = `linear-gradient(to right, #10b981 0%, #10b981 ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`;
        } else if (value <= 6) {
            gradient = `linear-gradient(to right, #10b981 0%, #f59e0b 33%, #f59e0b ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`;
        } else {
            gradient = `linear-gradient(to right, #10b981 0%, #f59e0b 33%, #ef4444 66%, #ef4444 ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`;
        }
        
        slider.style.background = gradient;
    }

    updateDateDisplay() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const formattedDate = now.toLocaleDateString('en-US', options);
        
        document.getElementById('today-date').textContent = `Today: ${formattedDate}`;
        document.getElementById('today-modal-date').textContent = `Today: ${formattedDate}`;
        
        // Update daily status
        const dailyStatus = document.getElementById('daily-status');
        if (this.healthData[this.today]) {
            dailyStatus.textContent = "✓ Checked today";
            dailyStatus.classList.add('bg-green-500/30', 'text-green-200');
            dailyStatus.classList.remove('bg-white/20', 'text-white/80');
        } else {
            dailyStatus.textContent = "Not checked today";
            dailyStatus.classList.remove('bg-green-500/30', 'text-green-200');
            dailyStatus.classList.add('bg-white/20', 'text-white/80');
        }
    }

    showInputModal() {
        document.getElementById('input-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Reset form untuk hari baru atau jika belum ada input hari ini
        if (!this.healthData[this.today]) {
            this.resetModalForm();
        } else {
            // Load data existing untuk hari ini
            const todayData = this.healthData[this.today];
            if (todayData.sleep) {
                document.getElementById('sleep-hours').value = todayData.sleep.duration || '';
                document.getElementById('bed-time').value = todayData.sleep.bedTime || '22:30';
                document.getElementById('wake-time').value = todayData.sleep.wakeTime || '06:30';
                this.setSleepQuality(todayData.sleep.quality || 3);
            }
            
            if (todayData.stress) {
                document.getElementById('stress-scale').value = todayData.stress.scale || 5;
                this.updateStressDisplay(todayData.stress.scale || 5);
                this.updateSliderGradient(todayData.stress.scale || 5);
                
                // Set stress symptoms
                document.querySelectorAll('.stress-symptom').forEach(checkbox => {
                    checkbox.checked = (todayData.stress.symptoms || []).includes(checkbox.value);
                });
            }
        }
    }

    hideInputModal() {
        document.getElementById('input-modal').classList.add('hidden');
        document.body.style.overflow = '';
    }

    setSleepQuality(quality) {
        document.querySelectorAll('.sleep-quality').forEach((btn, index) => {
            const btnQuality = index + 1;
            if (btnQuality === quality) {
                btn.style.opacity = '1';
                btn.style.transform = 'scale(1.2)';
            } else {
                btn.style.opacity = '0.3';
                btn.style.transform = 'scale(1)';
            }
        });
    }

    updateStressDisplay(value) {
        let category = 'Low Stress';
        let color = '#10b981';
        
        if (value >= 8) {
            category = 'Severe Stress';
            color = '#ef4444';
        } else if (value >= 6) {
            category = 'High Stress';
            color = '#f59e0b';
        } else if (value >= 4) {
            category = 'Moderate Stress';
            color = '#3b82f6';
        }
        
        document.getElementById('stress-value-display').textContent = `${value}/10 - ${category}`;
        document.getElementById('stress-value-display').style.color = color;
    }

    saveHealthData() {
        const sleepHours = parseFloat(document.getElementById('sleep-hours').value);
        const bedTime = document.getElementById('bed-time').value;
        const wakeTime = document.getElementById('wake-time').value;
        
        let sleepQuality = 3;
        document.querySelectorAll('.sleep-quality').forEach((btn, index) => {
            if (btn.style.opacity === '1') {
                sleepQuality = index + 1;
            }
        });

        const stressScale = parseInt(document.getElementById('stress-scale').value);
        const stressSymptoms = Array.from(document.querySelectorAll('.stress-symptom:checked'))
                                    .map(cb => cb.value);

        if (!sleepHours || sleepHours < 0 || sleepHours > 12) {
            this.showNotification('Please enter valid sleep duration (0-12 hours)', 'error');
            return;
        }

        const sleepScore = this.calculateSleepScore(sleepHours, sleepQuality, bedTime, wakeTime);
        const stressLevel = this.calculateStressLevel(stressScale, stressSymptoms);

        // Save data specifically for today's date
        this.healthData[this.today] = {
            sleep: {
                duration: sleepHours,
                bedTime: bedTime,
                wakeTime: wakeTime,
                quality: sleepQuality,
                score: sleepScore
            },
            stress: {
                scale: stressScale,
                symptoms: stressSymptoms,
                category: this.getStressCategory(stressLevel),
                level: stressLevel
            },
            lastUpdated: new Date().toISOString()
        };

        this.saveStoredData();
        this.hideInputModal();
        this.updateDateDisplay();
        this.performAnalysis();
        
        this.showNotification('Daily health data saved successfully! Analysis updated.', 'success');
    }

    calculateSleepScore(duration, quality, bedTime, wakeTime) {
        let score = 5;
        
        if (duration >= 7 && duration <= 9) score += 3;
        else if (duration >= 6 && duration < 7) score += 1;
        else if (duration > 9 && duration <= 10) score += 1;
        else if (duration < 6) score -= 2;
        else if (duration > 10) score -= 1;
        
        score += (quality - 3);
        
        if (bedTime && wakeTime) {
            const bed = new Date(`2000-01-01T${bedTime}`);
            const wake = new Date(`2000-01-01T${wakeTime}`);
            
            const idealBedStart = new Date('2000-01-01T22:00');
            const idealBedEnd = new Date('2000-01-01T23:30');
            const idealWakeStart = new Date('2000-01-01T06:00');
            const idealWakeEnd = new Date('2000-01-01T08:00');
            
            if (bed >= idealBedStart && bed <= idealBedEnd) score += 1;
            if (wake >= idealWakeStart && wake <= idealWakeEnd) score += 1;
        }
        
        return Math.max(1, Math.min(10, Math.round(score)));
    }

    calculateStressLevel(scale, symptoms) {
        let level = scale;
        level += symptoms.length * 0.5;
        
        const criticalSymptoms = ['anxiety', 'overwhelm', 'sleep_issues'];
        const criticalCount = symptoms.filter(s => criticalSymptoms.includes(s)).length;
        level += criticalCount * 0.5;
        
        return Math.min(10, level);
    }

    getStressCategory(level) {
        if (level >= 8) return 'severe';
        if (level >= 6) return 'high';
        if (level >= 4) return 'moderate';
        return 'low';
    }

    updateDisplay() {
        const todayData = this.healthData[this.today];
        
        if (todayData && todayData.sleep) {
            document.getElementById('sleep-score').textContent = `${todayData.sleep.score}/10`;
            document.getElementById('sleep-score-bar').style.width = `${todayData.sleep.score * 10}%`;
            document.getElementById('sleep-duration').textContent = `${todayData.sleep.duration} hrs`;
            document.getElementById('sleep-quality-text').textContent = this.getSleepQualityText(todayData.sleep.quality);
            
            const sleepBar = document.getElementById('sleep-score-bar');
            if (todayData.sleep.score >= 8) sleepBar.style.backgroundColor = '#10b981';
            else if (todayData.sleep.score >= 6) sleepBar.style.backgroundColor = '#f59e0b';
            else sleepBar.style.backgroundColor = '#ef4444';
        } else {
            document.getElementById('sleep-score').textContent = '-';
            document.getElementById('sleep-score-bar').style.width = '0%';
            document.getElementById('sleep-duration').textContent = '- hrs';
            document.getElementById('sleep-quality-text').textContent = '-';
        }

        if (todayData && todayData.stress) {
            document.getElementById('stress-level').textContent = `${todayData.stress.level.toFixed(1)}/10`;
            document.getElementById('stress-bar').style.width = `${todayData.stress.level * 10}%`;
            document.getElementById('stress-symptoms').textContent = `${todayData.stress.symptoms.length} symptoms`;
            document.getElementById('stress-category').textContent = todayData.stress.category;
            
            const stressBar = document.getElementById('stress-bar');
            if (todayData.stress.level >= 8) {
                stressBar.style.backgroundColor = '#ef4444';
                stressBar.classList.add('stress-critical');
            } else if (todayData.stress.level >= 6) {
                stressBar.style.backgroundColor = '#f59e0b';
                stressBar.classList.remove('stress-critical');
            } else {
                stressBar.style.backgroundColor = '#10b981';
                stressBar.classList.remove('stress-critical');
            }
        } else {
            document.getElementById('stress-level').textContent = '-';
            document.getElementById('stress-bar').style.width = '0%';
            document.getElementById('stress-symptoms').textContent = '0 symptoms';
            document.getElementById('stress-category').textContent = '-';
        }

        this.updateWorkloadStats();
    }

    getSleepQualityText(quality) {
        const texts = ['Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'];
        return texts[quality - 1] || 'Unknown';
    }

    async updateWorkloadStats() {
        try {
            console.log('🔄 [HEALTH] SIMPLE UPDATE START');
            
            // OPTION 1: Get from calendar directly
            let todayEventsCount = 0;
            let totalWorkHours = 0;
            
            if (window.calendar && window.calendar.mockEvents) {
                console.log('[HEALTH] Using window.calendar.mockEvents');
                
                const today = new Date();
                const todayEvents = window.calendar.mockEvents.filter(event => {
                    try {
                        if (!event.start || !event.start.dateTime) return false;
                        const eventDate = new Date(event.start.dateTime);
                        return eventDate.toDateString() === today.toDateString();
                    } catch (error) {
                        return false;
                    }
                });
                
                todayEventsCount = todayEvents.length;
                
                // Calculate hours
                todayEvents.forEach(event => {
                    if (event.start && event.start.dateTime && event.end && event.end.dateTime) {
                        const start = new Date(event.start.dateTime);
                        const end = new Date(event.end.dateTime);
                        const hours = (end - start) / (1000 * 60 * 60);
                        totalWorkHours += hours;
                    }
                });
                
                console.log('[HEALTH] From calendar:', {
                    events: todayEventsCount,
                    hours: totalWorkHours
                });
            }
            
            // OPTION 2: If calendar not available, use local storage
            if (todayEventsCount === 0) {
                console.log('[HEALTH] Calendar not available, checking localStorage');
                const saved = localStorage.getItem('calendar-today-events');
                if (saved) {
                    const data = JSON.parse(saved);
                    todayEventsCount = data.count || 0;
                    totalWorkHours = data.hours || 0;
                    console.log('[HEALTH] From localStorage:', { events: todayEventsCount, hours: totalWorkHours });
                }
            }
            
            // OPTION 3: Get from database or API
            if (todayEventsCount === 0) {
                try {
                    const response = await fetch('/api/today-schedule', {
                        method: 'GET',
                        credentials: 'include'
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.schedule) {
                            todayEventsCount = data.schedule.length;
                            console.log('[HEALTH] From API:', { events: todayEventsCount });
                        }
                    }
                } catch (apiError) {
                    console.log('[HEALTH] API call failed:', apiError);
                }
            }
            
            // Update UI - PERBAIKAN DI SINI: Menggunakan ID yang benar
            const totalEventsElement = document.getElementById('health-total-events');
            const workHoursElement = document.getElementById('health-work-hours');
            
            if (totalEventsElement) {
                totalEventsElement.textContent = todayEventsCount;
            } else {
                console.error('[HEALTH] Element health-total-events not found');
            }
            
            if (workHoursElement) {
                workHoursElement.textContent = `${totalWorkHours.toFixed(1)}h`;
            } else {
                console.error('[HEALTH] Element health-work-hours not found');
            }
            
            console.log('[HEALTH] UI Updated:', {
                'total-events': todayEventsCount,
                'work-hours': totalWorkHours
            });
            
            // Update burnout risk - PERBAIKAN DI SINI: Menggunakan ID yang benar
            const todayData = this.healthData[this.today];
            const burnoutRisk = this.calculateBurnoutRisk(totalWorkHours, todayEventsCount, todayData);
            const burnoutElement = document.getElementById('health-burnout-risk');
            
            if (burnoutElement) {
                burnoutElement.textContent = burnoutRisk.level;
                burnoutElement.className = `text-lg font-semibold ${burnoutRisk.color}`;
                console.log('[HEALTH] Burnout risk updated:', burnoutRisk);
            } else {
                console.error('[HEALTH] Element health-burnout-risk not found. Looking for alternatives...');
                
                // Coba cari element lain
                const possibleIds = ['burnout-risk', 'burnout', 'risk-level'];
                for (const id of possibleIds) {
                    const el = document.getElementById(id);
                    if (el) {
                        el.textContent = burnoutRisk.level;
                        el.className = `text-lg font-semibold ${burnoutRisk.color}`;
                        console.log(`[HEALTH] Found and updated ${id}`);
                        break;
                    }
                }
            }
            
        } catch (error) {
            console.error('[HEALTH] Error in updateWorkloadStats:', error);
            
            // Set default values
            const totalEventsElement = document.getElementById('health-total-events');
            const workHoursElement = document.getElementById('health-work-hours');
            const burnoutElement = document.getElementById('health-burnout-risk');
            
            if (totalEventsElement) totalEventsElement.textContent = '0';
            if (workHoursElement) workHoursElement.textContent = '0h';
            if (burnoutElement) {
                burnoutElement.textContent = 'Low';
                burnoutElement.className = 'text-lg font-semibold text-green-600';
            }
        }
    }

    calculateBurnoutRisk(workHours, events, todayData) {
        let riskScore = 0;
        
        console.log('[HEALTH] Calculating burnout risk:', { workHours, events, todayData });
        
        if (workHours > 10) riskScore += 3;
        else if (workHours > 8) riskScore += 2;
        else if (workHours > 6) riskScore += 1;
        
        // Karena events adalah number, kita perlu periksa untuk event larut malam
        // Ini adalah simulasi sederhana
        if (workHours > 8 && todayData) {
            const hasEveningWork = workHours > 8;
            if (hasEveningWork) riskScore += 2;
            
            const hasLateNightWork = false; // Simulasi
            if (hasLateNightWork) riskScore += 3;
        }
        
        if (events > 6) riskScore += 2; // Jika banyak event
        else if (events > 3) riskScore += 1;
        
        const breaksTaken = 0; // Simulasi - asumsikan tidak ada break
        if (breaksTaken === 0 && events >= 3) riskScore += 2;
        
        if (todayData && todayData.stress && todayData.stress.level >= 7) riskScore += 2;
        if (todayData && todayData.sleep && todayData.sleep.score <= 5) riskScore += 1;
        
        console.log('[HEALTH] Burnout risk score:', riskScore);
        
        if (riskScore >= 6) return { level: 'High', color: 'text-red-600' };
        if (riskScore >= 4) return { level: 'Medium', color: 'text-amber-600' };
        return { level: 'Low', color: 'text-green-600' };
    }

    async performAnalysis() {
        this.updateDisplay();
        
        if (!this.healthData[this.today]) {
            this.showNotification('Please complete your daily health check first', 'info');
            return;
        }

        this.showLoadingState();
        
        try {
            await this.loadCalendarData();
            
            const recommendations = await this.generateRecommendations();
            const wellnessScore = this.calculateWellnessScore();
            
            this.updateWellnessScore(wellnessScore);
            this.displayRecommendations(recommendations);
            this.updateRecoveryNeed();
            
            this.hideLoadingState();
            this.showNotification('Analysis refreshed successfully!', 'success');
            
        } catch (error) {
            console.error('Error during analysis:', error);
            this.hideLoadingState();
            this.showNotification('Analysis completed with some issues', 'info');
        }
    }

    calculateWellnessScore() {
        const todayData = this.healthData[this.today];
        if (!todayData) return 5;
        
        let score = 6;
        const sleepContribution = (todayData.sleep.score / 10) * 4;
        const stressContribution = ((10 - todayData.stress.level) / 10) * 3;
        const workloadScore = this.calculateWorkloadScore();
        const workloadContribution = (workloadScore / 10) * 3;
        
        score = sleepContribution + stressContribution + workloadContribution;
        
        return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
    }

    calculateWorkloadScore() {
        const today = new Date();
        const todayEvents = this.calendarData.filter(event => {
            const eventDate = new Date(event.start.dateTime);
            return eventDate.toDateString() === today.toDateString();
        });

        let score = 7;
        
        if (todayEvents.length > 8) score -= 3;
        else if (todayEvents.length > 5) score -= 2;
        else if (todayEvents.length > 3) score -= 1;
        
        const longestBlock = this.calculateLongestWorkBlock(todayEvents);
        if (longestBlock >= 6) score -= 3;
        else if (longestBlock >= 4) score -= 2;
        else if (longestBlock >= 3) score -= 1;
        
        const breaksTaken = todayEvents.filter(event => 
            event.summary?.toLowerCase().includes('break') ||
            event.summary?.toLowerCase().includes('lunch')
        ).length;
        if (breaksTaken >= 2) score += 1;
        
        return Math.max(1, Math.min(10, score));
    }

    calculateLongestWorkBlock(events) {
        if (!events || events.length === 0) return 0;
        
        const workBlocks = [];
        let currentBlock = { start: null, end: null };
        
        const validEvents = events
            .filter(event => {
                try {
                    return event.start && event.start.dateTime && 
                            event.end && event.end.dateTime &&
                            !isNaN(new Date(event.start.dateTime).getTime()) &&
                            !isNaN(new Date(event.end.dateTime).getTime());
                } catch (error) {
                    return false;
                }
            })
            .sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));
        
        validEvents.forEach(event => {
            try {
                const start = new Date(event.start.dateTime);
                const end = new Date(event.end.dateTime);
                
                if (!currentBlock.start) {
                    currentBlock = { start, end };
                } else if (start - currentBlock.end <= 30 * 60 * 1000) {
                    currentBlock.end = end;
                } else {
                    workBlocks.push(currentBlock);
                    currentBlock = { start, end };
                }
            } catch (error) {
                console.warn('Error processing event block:', error);
            }
        });
        
        if (currentBlock.start) {
            workBlocks.push(currentBlock);
        }
        
        const longestBlock = workBlocks.reduce((longest, block) => {
            try {
                const duration = (block.end - block.start) / (60 * 60 * 1000);
                return duration > longest ? duration : longest;
            } catch (error) {
                return longest;
            }
        }, 0);
        
        return longestBlock;
    }

    async generateRecommendations() {
        const recommendations = [];
        const todayData = this.healthData[this.today];
        
        if (!todayData) return recommendations;
        
        if (todayData.sleep && todayData.sleep.score <= 6) {
            if (todayData.sleep.duration < 6) {
                recommendations.push({
                    title: '🚨 SLEEP DEPRIVATION DETECTED',
                    message: `You only slept ${todayData.sleep.duration} hours. Adults need 7-9 hours for optimal health.`,
                    priority: 'high',
                    actions: [
                        'Aim for 7+ hours tonight',
                        'Avoid caffeine after 2 PM',
                        'Create a dark, cool sleep environment'
                    ],
                    ruleId: 'SLEEP_DEPRIVATION'
                });
            }
        }
        
        if (todayData.stress && todayData.stress.level >= 7) {
            recommendations.push({
                title: '🧠 HIGH STRESS ALERT',
                message: `Your stress level is ${todayData.stress.level?.toFixed(1) || 'unknown'}/10.`,
                priority: 'high',
                actions: [
                    'Take 5-min breathing breaks every hour',
                    'Practice progressive muscle relaxation',
                    'Consider talking to a professional'
                ],
                ruleId: 'HIGH_STRESS'
            });
        }
        
        const todayEvents = this.calendarData.filter(event => {
            try {
                const eventDate = new Date(event.start.dateTime);
                return eventDate.toDateString() === new Date().toDateString();
            } catch (error) {
                return false;
            }
        });
        
        const longestBlock = this.calculateLongestWorkBlock(todayEvents);
        if (longestBlock >= 6) {
            recommendations.push({
                title: '⏰ EXTREME WORK DURATION',
                message: `You worked ${longestBlock.toFixed(1)} hours straight. This exceeds healthy limits.`,
                priority: 'high',
                actions: [
                    'Schedule mandatory 15-min breaks every 2 hours',
                    'Use Pomodoro technique (25 work/5 break)',
                    'Stand up and stretch every 30 minutes'
                ],
                ruleId: 'EXTREME_WORK'
            });
        }
        
        return recommendations;
    }

    updateWellnessScore(score) {
        document.getElementById('wellness-score').textContent = score;
        
        const circumference = 2 * Math.PI * 54;
        const offset = circumference - (score / 10) * circumference;
        document.getElementById('wellness-progress').style.strokeDashoffset = offset;
        
        const statusElement = document.getElementById('wellness-status');
        if (score >= 8) {
            statusElement.textContent = 'Optimal Wellness';
            statusElement.className = 'text-sm text-green-600 mb-2';
        } else if (score >= 6) {
            statusElement.textContent = 'Good Balance';
            statusElement.className = 'text-sm text-blue-600 mb-2';
        } else if (score >= 4) {
            statusElement.textContent = 'Needs Attention';
            statusElement.className = 'text-sm text-amber-600 mb-2';
        } else {
            statusElement.textContent = 'Critical - Immediate Action Needed';
            statusElement.className = 'text-sm text-red-600 mb-2 stress-critical';
        }
    }

    updateRecoveryNeed() {
        const todayData = this.healthData[this.today];
        if (!todayData) return;
        
        let recoveryScore = 5;
        let message = 'Moderate recovery needed';
        let color = '#f59e0b';
        
        if (todayData.sleep.score <= 5) recoveryScore += 2;
        if (todayData.stress.level >= 7) recoveryScore += 2;
        
        const workloadScore = this.calculateWorkloadScore();
        if (workloadScore <= 5) recoveryScore += 1;
        
        if (recoveryScore >= 8) {
            message = 'High recovery priority';
            color = '#ef4444';
        } else if (recoveryScore >= 6) {
            message = 'Moderate recovery needed';
            color = '#f59e0b';
        } else {
            message = 'Low recovery need';
            color = '#10b981';
        }
        
        document.getElementById('recovery-need').textContent = message;
        document.getElementById('recovery-bar').style.width = `${recoveryScore * 10}%`;
        document.getElementById('recovery-bar').style.backgroundColor = color;
        document.getElementById('recovery-message').textContent = this.getRecoveryMessage(recoveryScore);
    }

    getRecoveryMessage(score) {
        if (score >= 8) return '🚨 Prioritize rest and stress reduction immediately';
        if (score >= 6) return '⚠️ Schedule recovery activities this week';
        return '✅ Maintain current healthy habits';
    }

    displayRecommendations(recommendations) {
        const container = document.getElementById('recommendations-container');
        
        if (!recommendations || recommendations.length === 0) {
            const todayData = this.healthData[this.today];
            
            if (todayData) {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <div class="text-green-500 mb-2">
                            <i class="fas fa-check-circle text-4xl"></i>
                        </div>
                        <div class="text-slate-600 font-medium">Excellent health balance today!</div>
                        <div class="text-slate-500 text-sm mt-1">Continue maintaining your healthy habits.</div>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <div class="text-slate-400 mb-2">
                            <i class="fas fa-clipboard-list text-4xl"></i>
                        </div>
                        <div class="text-slate-500">Complete your daily health check to get personalized recommendations</div>
                        <button id="open-input-btn-2" class="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-lg hover:shadow-xl">
                            <i class="fas fa-edit mr-2"></i>
                            Daily Health Check
                        </button>
                    </div>
                `;
                document.getElementById('open-input-btn-2').addEventListener('click', () => this.showInputModal());
            }
            return;
        }
        
        container.innerHTML = recommendations.map(rec => `
            <div class="p-4 rounded-xl border-2 ${
                rec.priority === 'high' ? 'border-red-200 bg-red-50 stress-critical' : 
                'border-amber-200 bg-amber-50'
            }">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <span class="text-lg">
                            ${rec.priority === 'high' ? '🚨' : '⚠️'}
                        </span>
                        <h4 class="font-semibold ${
                            rec.priority === 'high' ? 'text-red-800' : 'text-amber-800'
                        }">${rec.title}</h4>
                    </div>
                </div>
                <p class="text-slate-700 mb-3 text-sm">${rec.message}</p>
                <div class="space-y-2">
                    ${rec.actions.map(action => `
                        <div class="flex items-center gap-2 text-sm">
                            <i class="fas fa-check-circle text-green-500 text-xs"></i>
                            <span class="text-slate-600">${action}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    generateSleepPlan() {
        const todayData = this.healthData[this.today];
        if (!todayData) {
            this.showNotification('Please complete your daily health check first', 'info');
            return;
        }
        
        const plan = this.createSleepPlan();
        this.showCustomNotification('Sleep Improvement Plan', plan, 'purple');
    }

    generateStressPlan() {
        const todayData = this.healthData[this.today];
        if (!todayData) {
            this.showNotification('Please complete your daily health check first', 'info');
            return;
        }
        
        const plan = this.createStressPlan();
        this.showCustomNotification('Stress Management Plan', plan, 'blue');
    }

    createSleepPlan() {
        const todayData = this.healthData[this.today];
        const duration = todayData.sleep.duration;
        const quality = todayData.sleep.quality;
        
        let plan = `<div class="space-y-3 text-sm"><h4 class="font-semibold text-lg mb-2 text-blue-900">🌙 Personalized Sleep Plan</h4>`;
        
        if (duration < 7) {
            plan += `<p>• <strong class="text-blue-800">Priority:</strong> Increase sleep to 7-8 hours</p>`;
            plan += `<p>• <strong class="text-blue-800">Action:</strong> Go to bed 1 hour earlier starting tonight</p>`;
        }
        
        if (quality <= 3) {
            plan += `<p>• <strong class="text-blue-800">Priority:</strong> Improve sleep quality</p>`;
            plan += `<p>• <strong class="text-blue-800">Action:</strong> Create bedtime routine (read book, no screens)</p>`;
        }
        
        plan += `<p>• <strong class="text-blue-800">Maintenance:</strong> Keep consistent sleep schedule</p>`;
        plan += `<p>• <strong class="text-blue-800">Environment:</strong> Cool, dark, quiet bedroom</p>`;
        plan += `</div>`;
        
        return plan;
    }

    createStressPlan() {
        const todayData = this.healthData[this.today];
        const level = todayData.stress.level;
        const symptoms = todayData.stress.symptoms;
        
        let plan = `<div class="space-y-3 text-sm"><h4 class="font-semibold text-lg mb-2 text-purple-900">🧘 Personalized Stress Plan</h4>`;
        
        if (level >= 7) {
            plan += `<p>• <strong class="text-purple-900">Priority:</strong> Immediate stress reduction</p>`;
            plan += `<p>• <strong class="text-purple-900">Action:</strong> 5-min breathing exercises 3x daily</p>`;
        }
        
        if (symptoms.includes('anxiety')) {
            plan += `<p>• <strong class="text-purple-900">For Anxiety:</strong> Practice grounding techniques</p>`;
        }
        
        if (symptoms.includes('muscle_tension')) {
            plan += `<p>• <strong class="text-purple-900">For Tension:</strong> Daily stretching routine</p>`;
        }
        
        plan += `<p>• <strong class="text-purple-900">Maintenance:</strong> Regular physical activity</p>`;
        plan += `<p>• <strong class="text-purple-900">Support:</strong> Talk to friends/family daily</p>`;
        plan += `</div>`;
        
        return plan;
    }

    suggestEmergencyBreak() {
        const actions = [
            '🛑 STOP all work immediately',
            '💧 Drink a full glass of water',
            '🌬️ 2-minute deep breathing exercise',
            '🚶 5-minute walk away from screens',
            '🎧 Listen to calming music',
            '📵 Turn off notifications for 1 hour'
        ];

        const selectedActions = actions.sort(() => 0.5 - Math.random()).slice(0, 4);
        
        const emergencyPlan = `
            <div class="space-y-3 text-sm">
                <h4 class="font-semibold text-lg text-black">🚨 EMERGENCY RECOVERY PROTOCOL</h4>
                <p class="text-black font-medium">Follow these steps immediately:</p>
                ${selectedActions.map(action => `
                    <div class="flex items-center gap-2">
                        <i class="fas fa-exclamation-circle text-white-900"></i>
                        <span class="font-medium">${action}</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        this.showCustomNotification('Emergency Protocol Activated', emergencyPlan, 'red');
    }

    showLoadingState() {
        const container = document.getElementById('recommendations-container');
        container.innerHTML = `
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-2"></div>
                <div class="text-slate-600">Analyzing your daily health data...</div>
            </div>
        `;
    }

    hideLoadingState() {}

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            'bg-blue-500'
        } text-white p-4 rounded-xl shadow-2xl z-50 max-w-sm`;
        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-lg">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : '💡'}
                </span>
                <span class="flex-1 font-medium">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showCustomNotification(title, content, color = 'blue') {
        const bgColor = color === 'red' ? 'bg-red-500' : 
                        color === 'purple' ? 'bg-purple-500' : 'bg-blue-500';
        
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 ${bgColor} text-white p-4 rounded-xl shadow-2xl z-50 max-w-sm`;
        notification.innerHTML = `
            <div class="flex items-start gap-3">
                <span class="text-lg mt-1">
                    ${color === 'red' ? '🚨' : color === 'purple' ? '🌙' : '🧠'}
                </span>
                <div class="flex-1">
                    <h4 class="font-semibold mb-2">${title}</h4>
                    <div class="text-sm opacity-90">${content}</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200 mt-1">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 8000);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.healthInsights = new ScientificHealthInsights();
});