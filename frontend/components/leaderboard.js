/**
 * Leaderboard component for TypeTrack Pro
 * Handles real-time leaderboard updates and competitive features
 */

class LeaderboardComponent {
    constructor() {
        this.data = [];
        this.filters = {
            timeframe: 'all',
            difficulty: 'all'
        };
        this.updateInterval = null;
        this.animationQueue = [];
    }

    /**
     * Initialize leaderboard component
     */
    init() {
        this.setupEventListeners();
        this.loadLeaderboardData();
        this.startAutoRefresh();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Filter controls
        document.getElementById('leaderboard-timeframe')?.addEventListener('change', (e) => {
            this.filters.timeframe = e.target.value;
            this.loadLeaderboardData();
        });

        document.getElementById('leaderboard-difficulty')?.addEventListener('change', (e) => {
            this.filters.difficulty = e.target.value;
            this.loadLeaderboardData();
        });

        // Refresh button
        document.getElementById('refresh-leaderboard')?.addEventListener('click', () => {
            this.loadLeaderboardData();
        });

        // WebSocket events for real-time updates
        if (window.app && window.app.socket) {
            window.app.socket.on('leaderboard_update', (data) => {
                this.handleRealtimeUpdate(data);
            });
        }
    }

    /**
     * Load leaderboard data from API
     */
    async loadLeaderboardData() {
        try {
            const params = new URLSearchParams();
            if (this.filters.timeframe !== 'all') params.append('timeframe', this.filters.timeframe);
            if (this.filters.difficulty !== 'all') params.append('difficulty', this.filters.difficulty);

            const response = await window.app.apiCall(`/leaderboard?${params.toString()}`);
            const data = await response.json();

            if (response.ok) {
                this.data = data.leaderboard || [];
                this.renderLeaderboard();
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            this.showError('Failed to load leaderboard data');
        }
    }

    /**
     * Render leaderboard display
     */
    renderLeaderboard() {
        const container = document.getElementById('leaderboard-list');
        if (!container) return;

        if (!this.data || this.data.length === 0) {
            container.innerHTML = `
                <div class="leaderboard-empty">
                    <div class="empty-icon">🏆</div>
                    <h3>No data available</h3>
                    <p>Be the first to set a record!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.data.map((user, index) => this.createLeaderboardItem(user, index)).join('');
        this.addInteractivity();
    }

    /**
     * Create individual leaderboard item
     */
    createLeaderboardItem(user, index) {
        const rankClass = this.getRankClass(index);
        const rankIcon = this.getRankIcon(index);
        const isCurrentUser = window.app.state.currentUser && user.username === window.app.state.currentUser.username;

        return `
            <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''}" data-user="${user.username}">
                <div class="rank ${rankClass}">
                    <span class="rank-icon">${rankIcon}</span>
                    <span class="rank-number">#${user.rank || index + 1}</span>
                </div>
                <div class="user-info">
                    <div class="username">
                        ${user.username}
                        ${isCurrentUser ? '<span class="you-badge">YOU</span>' : ''}
                    </div>
                    <div class="user-stats">
                        ${user.total_tests || 0} tests • Joined ${this.formatDate(user.created_at)}
                    </div>
                </div>
                <div class="performance-metrics">
                    <div class="metric">
                        <div class="metric-value">${user.best_wpm}</div>
                        <div class="metric-label">WPM</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${user.best_accuracy}%</div>
                        <div class="metric-label">Accuracy</div>
                    </div>
                </div>
                <div class="performance-chart">
                    <canvas id="mini-chart-${index}" width="80" height="30"></canvas>
                </div>
                <div class="leaderboard-actions">
                    <button class="btn-small" onclick="leaderboard.viewUserProfile('${user.username}')">
                        View Profile
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Get rank class based on position
     */
    getRankClass(index) {
        if (index === 0) return 'gold';
        if (index === 1) return 'silver';
        if (index === 2) return 'bronze';
        return '';
    }

    /**
     * Get rank icon based on position
     */
    getRankIcon(index) {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return '🏅';
    }

    /**
     * Add interactivity to leaderboard items
     */
    addInteractivity() {
        // Add hover effects and click handlers
        const items = document.querySelectorAll('.leaderboard-item');
        items.forEach((item, index) => {
            // Render mini performance chart
            this.renderMiniChart(index, this.data[index]);

            // Add click handler for detailed view
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.leaderboard-actions')) {
                    this.showUserDetails(this.data[index]);
                }
            });
        });
    }

    /**
     * Render mini performance chart
     */
    renderMiniChart(index, userData) {
        const canvas = document.getElementById(`mini-chart-${index}`);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = this.generateMockProgressData(userData); // In real app, fetch from API

        // Simple line chart
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.beginPath();

        data.forEach((point, i) => {
            const x = (i / (data.length - 1)) * canvas.width;
            const y = canvas.height - (point / Math.max(...data)) * canvas.height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    }

    /**
     * Generate mock progress data (replace with real API call)
     */
    generateMockProgressData(userData) {
        const points = 10;
        const data = [];
        const baseWpm = userData.best_wpm * 0.6;
        
        for (let i = 0; i < points; i++) {
            const progress = i / (points - 1);
            const variation = (Math.random() - 0.5) * 10;
            data.push(baseWpm + (progress * (userData.best_wpm - baseWpm)) + variation);
        }
        
        return data;
    }

    /**
     * Handle real-time leaderboard updates
     */
    handleRealtimeUpdate(data) {
        // Add to animation queue
        this.animationQueue.push({
            type: 'new_record',
            data: data,
            timestamp: Date.now()
        });

        // Process animation queue
        this.processAnimationQueue();

        // Reload leaderboard data
        setTimeout(() => {
            this.loadLeaderboardData();
        }, 2000);
    }

    /**
     * Process animation queue for smooth updates
     */
    processAnimationQueue() {
        if (this.animationQueue.length === 0) return;

        const animation = this.animationQueue.shift();
        
        if (animation.type === 'new_record') {
            this.showNewRecordAnimation(animation.data);
        }

        // Process next animation after current one completes
        setTimeout(() => {
            this.processAnimationQueue();
        }, 3000);
    }

    /**
     * Show new record animation
     */
    showNewRecordAnimation(data) {
        const notification = document.createElement('div');
        notification.className = 'leaderboard-notification';
        notification.innerHTML = `
            <div class="notification-icon">🎉</div>
            <div class="notification-content">
                <strong>${data.user}</strong> achieved ${data.wpm} WPM!
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Animate out
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }, 3000);
    }

    /**
     * Show user details modal
     */
    showUserDetails(userData) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content user-details-modal">
                <div class="modal-header">
                    <h2>${userData.username}'s Profile</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="user-stats-grid">
                        <div class="stat-item">
                            <div class="stat-value">${userData.best_wpm}</div>
                            <div class="stat-label">Best WPM</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${userData.best_accuracy}%</div>
                            <div class="stat-label">Best Accuracy</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${userData.total_tests || 0}</div>
                            <div class="stat-label">Total Tests</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">#${userData.rank}</div>
                            <div class="stat-label">Global Rank</div>
                        </div>
                    </div>
                    <div class="user-chart-container">
                        <canvas id="user-detail-chart" width="400" height="200"></canvas>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Render detailed chart
        this.renderUserDetailChart(userData);
    }

    /**
     * Render detailed user chart
     */
    renderUserDetailChart(userData) {
        const canvas = document.getElementById('user-detail-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = this.generateMockProgressData(userData);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map((_, i) => `Test ${i + 1}`),
                datasets: [{
                    label: 'WPM Progress',
                    data: data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'WPM'
                        }
                    }
                }
            }
        });
    }

    /**
     * View user profile (placeholder for future feature)
     */
    viewUserProfile(username) {
        console.log(`Viewing profile for ${username}`);
        // Future: Navigate to user profile page or show detailed modal
        this.showUserDetails({ username, best_wpm: 0, best_accuracy: 0 });
    }

    /**
     * Start auto-refresh for real-time updates
     */
    startAutoRefresh() {
        this.updateInterval = setInterval(() => {
            this.loadLeaderboardData();
        }, 30000); // Refresh every 30 seconds
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const container = document.getElementById('leaderboard-list');
        if (container) {
            container.innerHTML = `
                <div class="leaderboard-error">
                    <div class="error-icon">⚠️</div>
                    <h3>Error Loading Leaderboard</h3>
                    <p>${message}</p>
                    <button class="btn btn-secondary" onclick="leaderboard.loadLeaderboardData()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short' 
        });
    }

    /**
     * Cleanup component
     */
    destroy() {
        this.stopAutoRefresh();
        this.animationQueue = [];
    }
}

// Initialize leaderboard component
document.addEventListener('DOMContentLoaded', () => {
    window.leaderboard = new LeaderboardComponent();
});

