// Profile Management System
class ProfileManager {
    constructor() {
        this.currentUser = null;
        this.isEditing = false;
        this.init();
    }

    init() {
        this.loadUserProfile();
        this.setupEventListeners();
        this.updateUI();
        console.log('✅ Profile manager initialized');
    }

    // Load user data from localStorage or create default
    loadUserProfile() {
        const savedUser = localStorage.getItem('userProfile');
        
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
        } else {
            // Create default user profile
            this.currentUser = {
                id: this.generateId(),
                email: 'user@example.com',
                username: 'user123',
                fullName: 'User Name',
                bio: 'This is a sample bio. Click edit to update your profile information.',
                phone: '',
                location: '',
                avatar: null,
                memberSince: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                totalActivities: 0,
                preferences: {
                    theme: 'light',
                    notifications: true,
                    language: 'id'
                }
            };
            this.saveUserProfile();
        }
        
        this.updateAvatarDisplay();
    }

    // Save user data to localStorage
    saveUserProfile() {
        localStorage.setItem('userProfile', JSON.stringify(this.currentUser));
        this.updateUI();
        this.updateAvatarDisplay();
    }

    // Setup all event listeners
    setupEventListeners() {
        // Profile form
        document.getElementById('profile-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });

        // Edit profile button
        document.getElementById('edit-profile-btn').addEventListener('click', () => {
            this.toggleEditMode(true);
        });

        // Cancel edit button
        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            this.toggleEditMode(false);
            this.populateForm();
        });

        // Avatar upload
        document.getElementById('change-avatar-btn').addEventListener('click', () => {
            document.getElementById('avatar-upload').click();
        });

        document.getElementById('avatar-upload').addEventListener('change', (e) => {
            this.handleAvatarUpload(e.target.files[0]);
        });

        // Settings button
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showSettingsModal();
        });

        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Quick actions
        this.setupQuickActions();
    }

    // Toggle edit mode
    toggleEditMode(enable) {
        this.isEditing = enable;
        const form = document.getElementById('profile-form');
        const inputs = form.querySelectorAll('input, textarea');
        
        inputs.forEach(input => {
            input.disabled = !enable;
        });

        // Show/hide buttons
        document.getElementById('edit-profile-btn').classList.toggle('hidden', enable);
        document.getElementById('cancel-edit-btn').classList.toggle('hidden', !enable);
        
        // Change submit button text
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = enable ? 'Save Changes' : 'Update Profile';
        
        if (enable) {
            form.querySelector('input').focus();
        }
    }

    // Populate form with current user data
    populateForm() {
        document.getElementById('full-name').value = this.currentUser.fullName || '';
        document.getElementById('username').value = this.currentUser.username || '';
        document.getElementById('email').value = this.currentUser.email || '';
        document.getElementById('bio').value = this.currentUser.bio || '';
        document.getElementById('phone').value = this.currentUser.phone || '';
        document.getElementById('location').value = this.currentUser.location || '';
    }

    // Save profile from form
    saveProfile() {
        const formData = {
            fullName: document.getElementById('full-name').value.trim(),
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim(),
            bio: document.getElementById('bio').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            location: document.getElementById('location').value.trim()
        };

        // Basic validation
        if (!formData.fullName) {
            this.showNotification('Please enter your full name', 'error');
            return;
        }

        if (!formData.email) {
            this.showNotification('Please enter your email', 'error');
            return;
        }

        // Update user data
        this.currentUser = { ...this.currentUser, ...formData };
        this.currentUser.lastActive = new Date().toISOString();
        
        this.saveUserProfile();
        this.toggleEditMode(false);
        this.showNotification('Profile updated successfully!', 'success');
    }

    // Handle avatar upload
    handleAvatarUpload(file) {
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select an image file', 'error');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            this.showNotification('Image size should be less than 2MB', 'error');
            return;
        }

        const reader = new FileReader();
        
        reader.onload = (e) => {
            this.currentUser.avatar = e.target.result;
            this.currentUser.lastActive = new Date().toISOString();
            this.saveUserProfile();
            this.showNotification('Profile picture updated!', 'success');
        };

        reader.onerror = () => {
            this.showNotification('Error reading image file', 'error');
        };

        reader.readAsDataURL(file);
    }

    // Update avatar display across the app
    updateAvatarDisplay() {
        const avatarImg = document.getElementById('avatar-img');
        const avatarFallback = document.getElementById('avatar-fallback');
        const profileAvatarImg = document.getElementById('profile-avatar-img');
        const profileAvatarFallback = document.getElementById('profile-avatar-fallback');
        
        // Header avatar
        if (this.currentUser.avatar) {
            avatarImg.src = this.currentUser.avatar;
            avatarImg.classList.remove('hidden');
            avatarFallback.classList.add('hidden');
        } else {
            avatarImg.classList.add('hidden');
            avatarFallback.classList.remove('hidden');
            avatarFallback.textContent = this.getAvatarFallback();
        }

        // Profile page avatar
        if (this.currentUser.avatar) {
            profileAvatarImg.src = this.currentUser.avatar;
            profileAvatarImg.classList.remove('hidden');
            profileAvatarFallback.classList.add('hidden');
        } else {
            profileAvatarImg.classList.add('hidden');
            profileAvatarFallback.classList.remove('hidden');
            profileAvatarFallback.textContent = this.getAvatarFallback();
        }
    }

    // Get avatar fallback emoji based on username
    getAvatarFallback() {
        if (!this.currentUser.username) return '👤';
        
        const firstChar = this.currentUser.username.charAt(0).toUpperCase();
        if (firstChar >= 'A' && firstChar <= 'Z') {
            return firstChar;
        }
        return '👤';
    }

    // Update UI with current user data
    updateUI() {
        // Profile header
        document.getElementById('profile-name').textContent = this.currentUser.fullName;
        document.getElementById('profile-email').textContent = this.currentUser.email;
        document.getElementById('profile-bio').textContent = this.currentUser.bio;

        // Stats
        document.getElementById('member-since').textContent = this.formatDate(this.currentUser.memberSince);
        document.getElementById('total-activities').textContent = this.currentUser.totalActivities;
        document.getElementById('last-active').textContent = this.formatRelativeTime(this.currentUser.lastActive);

        // Populate form if in edit mode
        if (this.isEditing) {
            this.populateForm();
        }
    }

    // Setup quick actions
    setupQuickActions() {
        const actions = {
            'change-password': () => this.showChangePasswordModal(),
            'notification-settings': () => this.showNotificationSettings(),
            'theme-preferences': () => this.showThemeSettings(),
            'data-privacy': () => this.showDataPrivacy()
        };

        // Add event listeners to quick action buttons
        document.querySelectorAll('.card-box button').forEach(button => {
            const action = button.textContent.toLowerCase();
            Object.keys(actions).forEach(key => {
                if (action.includes(key)) {
                    button.addEventListener('click', actions[key]);
                }
            });
        });
    }

    // Show settings modal
    showSettingsModal() {
        const modalHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
                    <h3 class="text-xl font-semibold text-slate-900 mb-4">Settings</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="flex items-center space-x-3">
                                <input type="checkbox" ${this.currentUser.preferences.notifications ? 'checked' : ''} 
                                       class="rounded border-slate-300 text-primary focus:ring-primary">
                                <span class="text-slate-700">Enable notifications</span>
                            </label>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-2">Theme</label>
                            <select class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                                <option value="light" ${this.currentUser.preferences.theme === 'light' ? 'selected' : ''}>Light</option>
                                <option value="dark" ${this.currentUser.preferences.theme === 'dark' ? 'selected' : ''}>Dark</option>
                                <option value="auto" ${this.currentUser.preferences.theme === 'auto' ? 'selected' : ''}>Auto</option>
                            </select>
                        </div>
                        <div class="flex gap-3 pt-4">
                            <button class="btn bg-gradient-to-r from-primary to-accent text-white px-4 py-2 rounded-xl flex-1">
                                Save
                            </button>
                            <button class="btn secondary bg-white text-primary border border-slate-200 px-4 py-2 rounded-xl flex-1">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.showModal(modalHtml);
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-xl shadow-lg z-50 animate-fade-in ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.innerHTML = `
            <div class="flex items-center gap-2">
                <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <div>${message}</div>
                <button class="ml-2 hover:opacity-70">×</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);

        // Manual close
        notification.querySelector('button').addEventListener('click', () => {
            notification.remove();
        });
    }

    // Show modal
    showModal(html) {
        const modal = document.createElement('div');
        modal.innerHTML = html;
        document.body.appendChild(modal);

        // Close modal on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Close modal on cancel button
        const cancelBtn = modal.querySelector('button:contains("Cancel")');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => modal.remove());
        }
    }

    // Handle logout
    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            // Clear user session
            localStorage.removeItem('userSession');
            
            // Redirect to login page (you can change this to your actual login page)
            this.showNotification('Logged out successfully!', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    }

    // Utility functions
    generateId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return this.formatDate(dateString);
    }

    // Activity tracking
    trackActivity(activityType) {
        this.currentUser.totalActivities++;
        this.currentUser.lastActive = new Date().toISOString();
        this.saveUserProfile();
    }
}

// Placeholder functions for modal content
ProfileManager.prototype.showChangePasswordModal = function() {
    this.showNotification('Change password feature coming soon!', 'info');
};

ProfileManager.prototype.showNotificationSettings = function() {
    this.showNotification('Notification settings feature coming soon!', 'info');
};

ProfileManager.prototype.showThemeSettings = function() {
    this.showNotification('Theme settings feature coming soon!', 'info');
};

ProfileManager.prototype.showDataPrivacy = function() {
    this.showNotification('Data privacy settings feature coming soon!', 'info');
};

// Initialize profile manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.profileManager = new ProfileManager();
});

// Add contains polyfill for older browsers
if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
        if (typeof start !== 'number') {
            start = 0;
        }
        if (start + search.length > this.length) {
            return false;
        }
        return this.indexOf(search, start) !== -1;
    };
}