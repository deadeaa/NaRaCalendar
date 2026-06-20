// Buat file baru sync-manager.js
class SyncManager {
    constructor() {
        this.syncing = false;
        this.init();
    }
    
    init() {
        // Sync setiap 30 detik
        setInterval(() => this.syncAll(), 30000);
        
        // Sync saat halaman visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.syncAll();
            }
        });
    }
    
    async syncAll() {
        if (this.syncing) return;
        this.syncing = true;
        
        try {
            console.log('🔄 [SYNC] Starting global sync...');
            
            // 1. Sync calendar
            if (window.calendar && window.calendar.loadEventsFromDatabase) {
                await window.calendar.loadEventsFromDatabase();
            }
            
            // 2. Sync Nara stats
            if (window.nara && window.nara.loadRecentEvents) {
                await window.nara.loadRecentEvents();
                if (window.nara.updateStats) window.nara.updateStats();
            }
            
            // 3. Sync health insights
            if (window.healthInsights && window.healthInsights.updateWorkloadStats) {
                await window.healthInsights.updateWorkloadStats();
            }
            
            console.log('✅ [SYNC] Global sync completed');
            
        } catch (error) {
            console.error('❌ [SYNC] Error during sync:', error);
        } finally {
            this.syncing = false;
        }
    }
    
    async forceSync() {
        console.log('🔄 [SYNC] Force sync requested');
        await this.syncAll();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    window.syncManager = new SyncManager();
    
    // Global refresh button
    const globalRefreshBtn = document.getElementById('global-refresh');
    if (globalRefreshBtn) {
        globalRefreshBtn.addEventListener('click', () => window.syncManager.forceSync());
    }
});