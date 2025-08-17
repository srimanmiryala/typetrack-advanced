

class TypeTrackPro {
    constructor() {
        this.config = {
            apiBase: 'http://localhost:5000/api',
            socketUrl: 'http://localhost:5000',
            updateInterval: 100, // ms
            timeoutDuration: 300000, // 5 minutes
        };
        
        this.state = {
            isConnected: false,
            isAuthenticated: false,
            currentUser: null,
            currentTest: null,
            startTime: null,
            timer: null,
            metrics: {
                wpm: 0,
                accuracy: 100,
                progress: 0,
                errors: 0,
                elapsedTime: 0
            }
        };
        
        this.socket = null;
        this.token = localStorage.getItem('typetrack_token');
        this.chart = null;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.setupEventListeners();
            await this.initializeSocket();
            
            if (this.token) {
                await this.validateToken();
            } else {
                this.showAuthSection();
            }
            
            this.hideLoadingScreen();
        } catch (error) {
            console.error('Initialization failed:', error);
            this.showNotification('Failed to initialize application', 'error');
            this.hideLoadingScreen();
        }
    }

    /**
     * Setup event listeners for the application
     */
    setupEventListeners() {
        // Authentication forms
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });

        // Typing input events
        const typingInput = document.getElementById('typing-input');
        typingInput.addEventListener('input', (e) => this.handleTyping(e.target.value));
        typingInput.addEventListener('paste', (e) => e.preventDefault());
        typingInput.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Configuration changes
        document.getElementById('difficulty').addEventListener('change', this.updateTestConfig.bind(this));
        document.getElementById('category').addEventListener('change', this.updateTestConfig.bind(this));

        // Analytics filters
        document.getElementById('analytics-difficulty').addEventListener('change', this.loadAnalytics.bind(this));

        // Window events
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        window.addEventListener('online', () => this.handleConnectionChange(true));
        window.addEventListener('offline', () => this.handleConnectionChange(false));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'Enter':
                        e.preventDefault();
                        if (!this.state.currentTest) {
                            this.startNewTest();
                        }
                        break;
                    case 'r':
                        e.preventDefault();
                        this.resetTest();
                        break;
                }
            }
        });
    }

    /**
     * Initialize WebSocket connection
     */
    async initializeSocket() {
        try {
            this.socket = io(this.config.socketUrl, {
                timeout: 10000,
                forceNew: true
            });

            this.socket.on('connect', () => {
                console.log('Connected to server');
                this.state.isConnected = true;
                this.updateConnectionStatus(true);
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.state.isConnected = false;
                this.updateConnectionStatus(false);
            });

            this.socket.on('metrics_update', (data) => {
                this.updateMetrics(data);
            });

            this.socket.on('leaderboard_update', (data) => {
                this.handleLeaderboardUpdate(data);
                this.loadLeaderboard();
            });

            this.socket.on('error', (error) => {
                console.error('Socket error:', error);
                this.showNotification('Connection error occurred', 'error');
            });

        } catch (error) {
            console.error('Socket initialization failed:', error);
            this.state.isConnected = false;
            this.updateConnectionStatus(false);
        }
    }

    /**
     * Validate existing token
     */
    async validateToken() {
        try {
            const response = await this.apiCall('/analytics');
            if (response.ok) {
                const userInfo = JSON.parse(localStorage.getItem('user_info'));
                this.state.currentUser = userInfo;
                this.state.isAuthenticated = true;
                this.showMainApp();
                await this.loadInitialData();
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('Token validation failed:', error);
            this.logout();
        }
    }

    /**
     * Load initial application data
     */
    async loadInitialData() {
        await Promise.all([
            this.loadAnalytics(),
            this.loadLeaderboard()
        ]);
    }

    /**
     * User registration
     */
    async register() {
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;

        if (!this.validateRegistrationData(username, email, password)) {
            return;
        }

        try {
            const response = await this.apiCall('/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Registration successful! Please login.', 'success');
                this.showLogin();
                // Clear form
                document.getElementById('register-form').reset();
            } else {
                this.showMessage(data.message || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage('Registration failed. Please try again.', 'error');
        }
    }

    /**
     * User login
     */
    async login() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            this.showMessage('Please enter username and password', 'error');
            return;
        }

        try {
            const response = await this.apiCall('/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.state.currentUser = data.user;
                this.state.isAuthenticated = true;
                
                localStorage.setItem('typetrack_token', this.token);
                localStorage.setItem('user_info', JSON.stringify(data.user));
                
                this.showMainApp();
                await this.loadInitialData();
                
                this.showNotification(`Welcome back, ${data.user.username}!`, 'success');
            } else {
                this.showMessage(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Login failed. Please try again.', 'error');
        }
    }

    /**
     * User logout
     */
    logout() {
        this.state.isAuthenticated = false;
        this.state.currentUser = null;
        this.token = null;
        
        localStorage.removeItem('typetrack_token');
        localStorage.removeItem('user_info');
        
        if (this.state.timer) {
            clearInterval(this.state.timer);
        }
        
        location.reload();
    }

    /**
     * Start a new typing test
     */
    async startNewTest() {
        try {
            const difficulty = document.getElementById('difficulty').value;
            const category = document.getElementById('category').value;
            
            const response = await this.apiCall(`/prompt?difficulty=${difficulty}&category=${category}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load test');
            }

            this.state.currentTest = {
                prompt: data.prompt,
                difficulty: data.difficulty,
                category: data.category,
                wordCount: data.word_count,
                errors: 0,
                startTime: null
            };

            this.setupTest(data.prompt);
            this.showNotification('New test loaded! Start typing to begin.', 'info');
            
        } catch (error) {
            console.error('Start test error:', error);
            this.showNotification('Failed to load test. Please try again.', 'error');
        }
    }

    /**
     * Setup test UI
     */
    setupTest(prompt) {
        document.getElementById('prompt-display').textContent = prompt;
        
        const input = document.getElementById('typing-input');
        input.value = '';
        input.disabled = false;
        input.placeholder = 'Start typing here...';
        input.focus();
        
        document.getElementById('submit-btn').disabled = false;
        document.getElementById('reset-btn').disabled = false;
        document.getElementById('new-test-btn').disabled = true;
        
        this.resetMetrics();
        this.updateTimer('00:00');
    }

    /**
     * Handle typing input
     */
    handleTyping(input) {
        if (!this.state.currentTest) return;

        // Start test on first keystroke
        if (!this.state.currentTest.startTime) {
            this.state.currentTest.startTime = new Date().toISOString();
            this.startTimer();
        }

        // Emit real-time update to server
        if (this.socket && this.state.isConnected) {
            this.socket.emit('typing_update', {
                input: input,
                prompt: this.state.currentTest.prompt,
                start_time: this.state.currentTest.startTime
            });
        }

        // Local metrics calculation for immediate feedback
        this.calculateLocalMetrics(input);

        // Auto-submit when test is complete
        if (input.length >= this.state.currentTest.prompt.length) {
            setTimeout(() => this.submitTest(), 1000);
        }
    }

    /**
     * Handle key down events
     */
    handleKeyDown(event) {
        // Prevent certain keys during test
        if (this.state.currentTest && this.state.currentTest.startTime) {
            if (event.key === 'Tab') {
                event.preventDefault();
            }
        }
    }

    /**
     * Calculate local metrics for immediate feedback
     */
    calculateLocalMetrics(input) {
        if (!this.state.currentTest || !this.state.currentTest.startTime) return;

        const prompt = this.state.currentTest.prompt;
        const startTime = new Date(this.state.currentTest.startTime);
        const elapsedMinutes = (new Date() - startTime) / (1000 * 60);
        
        // WPM calculation
        const words = input.trim().split(/\s+/).length;
        const wpm = elapsedMinutes > 0 ? Math.round(words / elapsedMinutes) : 0;
        
        // Accuracy calculation
        let correctChars = 0;
        for (let i = 0; i < Math.min(input.length, prompt.length); i++) {
            if (input[i] === prompt[i]) correctChars++;
        }
        const accuracy = prompt.length > 0 ? Math.round((correctChars / prompt.length) * 100) : 100;
        
        // Progress calculation
        const progress = Math.min((input.length / prompt.length) * 100, 100);
        
        // Error count
        const errors = input.length - correctChars;
        
        this.state.metrics = {
            wpm: wpm,
            accuracy: accuracy,
            progress: progress,
            errors: errors,
            elapsedTime: elapsedMinutes * 60
        };
        
        this.updateMetricsDisplay(this.state.metrics);
    }

    /**
     * Update metrics from server
     */
    updateMetrics(data) {
        this.state.metrics = { ...this.state.metrics, ...data };
        this.updateMetricsDisplay(this.state.metrics);
    }

    /**
     * Update metrics display
     */
    updateMetricsDisplay(metrics) {
        document.getElementById('current-wpm').textContent = metrics.wpm || 0;
        document.getElementById('current-accuracy').textContent = `${metrics.accuracy || 100}%`;
        document.getElementById('progress').textContent = `${Math.round(metrics.progress || 0)}%`;
        document.getElementById('current-errors').textContent = metrics.errors || 0;
    }

    /**
     * Submit typing test
     */
    async submitTest() {
        if (!this.state.currentTest || !this.state.isAuthenticated) return;

        try {
            const input = document.getElementById('typing-input').value;
            const endTime = new Date();
            const startTime = new Date(this.state.currentTest.startTime);
            const elapsedSeconds = (endTime - startTime) / 1000;
            
            // Final calculations
            const words = input.trim().split(/\s+/).length;
            const wpm = (words / (elapsedSeconds / 60));
            
            let correctChars = 0;
            for (let i = 0; i < Math.min(input.length, this.state.currentTest.prompt.length); i++) {
                if (input[i] === this.state.currentTest.prompt[i]) correctChars++;
            }
            const accuracy = (correctChars / this.state.currentTest.prompt.length) * 100;
            const errors = input.length - correctChars;

            const submissionData = {
                wpm: Math.round(wpm * 100) / 100,
                accuracy: Math.round(accuracy * 100) / 100,
                difficulty: this.state.currentTest.difficulty,
                errors: errors,
                characters_typed: input.length,
                time_taken: elapsedSeconds
            };

            const response = await this.apiCall('/submit', {
                method: 'POST',
                body: JSON.stringify(submissionData)
            });

            if (response.ok) {
                this.showNotification('Test submitted successfully!', 'success');
                this.finishTest();
                await this.loadAnalytics();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Submission failed');
            }
            
        } catch (error) {
            console.error('Submit test error:', error);
            this.showNotification('Failed to submit test. Please try again.', 'error');
        }
    }

    /**
     * Reset current test
     */
    resetTest() {
        if (this.state.timer) {
            clearInterval(this.state.timer);
            this.state.timer = null;
        }

        this.state.currentTest = null;
        
        document.getElementById('prompt-display').textContent = 'Click "Start New Test" to begin your typing challenge...';
        document.getElementById('typing-input').value = '';
        document.getElementById('typing-input').disabled = true;
        document.getElementById('typing-input').placeholder = 'Your typing area will appear here after starting a test...';
        
        document.getElementById('submit-btn').disabled = true;
        document.getElementById('reset-btn').disabled = true;
        document.getElementById('new-test-btn').disabled = false;
        
        this.resetMetrics();
        this.updateTimer('00:00');
    }

    /**
     * Finish current test
     */
    finishTest() {
        if (this.state.timer) {
            clearInterval(this.state.timer);
            this.state.timer = null;
        }

        document.getElementById('typing-input').disabled = true;
        document.getElementById('submit-btn').disabled = true;
        document.getElementById('reset-btn').disabled = false;
        document.getElementById('new-test-btn').disabled = false;
    }

    /**
     * Start test timer
     */
    startTimer() {
        if (this.state.timer) {
            clearInterval(this.state.timer);
        }

        this.state.timer = setInterval(() => {
            if (this.state.currentTest && this.state.currentTest.startTime) {
                const elapsed = new Date() - new Date(this.state.currentTest.startTime);
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                this.updateTimer(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
                
                // Auto-timeout after configured duration
                if (elapsed > this.config.timeoutDuration) {
                    this.submitTest();
                }
            }
        }, 1000);
    }

    /**
     * Update timer display
     */
    updateTimer(timeString) {
        document.getElementById('test-timer').textContent = timeString;
    }

    /**
     * Reset metrics display
     */
    resetMetrics() {
        this.state.metrics = {
            wpm: 0,
            accuracy: 100,
            progress: 0,
            errors: 0,
            elapsedTime: 0
        };
        this.updateMetricsDisplay(this.state.metrics);
    }

    /**
     * Load user analytics
     */
    async loadAnalytics() {
        try {
            const difficulty = document.getElementById('analytics-difficulty').value;
            const url = difficulty ? `/analytics?difficulty=${difficulty}` : '/analytics';
            
            const response = await this.apiCall(url);
            const data = await response.json();

            if (response.ok) {
                this.updateAnalyticsDisplay(data);
                this.createProgressChart(data.history);
            }
        } catch (error) {
            console.error('Load analytics error:', error);
            this.showNotification('Failed to load analytics', 'error');
        }
    }

    /**
     * Update analytics display
     */
    updateAnalyticsDisplay(data) {
        document.getElementById('avg-wpm').textContent = data.average_wpm || 0;
        document.getElementById('best-wpm').textContent = data.best_wpm || 0;
        document.getElementById('avg-accuracy').textContent = `${data.average_accuracy || 0}%`;
        document.getElementById('total-tests').textContent = data.total_sessions || 0;

        // Update recent sessions
        const sessionsList = document.getElementById('sessions-list');
        if (data.history && data.history.length > 0) {
            sessionsList.innerHTML = data.history.slice(0, 5).map(session => `
                <div class="session-item">
                    <div>
                        <strong>${session.wpm} WPM</strong> • 
                        ${session.accuracy}% accuracy • 
                        ${session.difficulty}
                    </div>
                    <div class="session-time">${this.formatDate(session.timestamp)}</div>
                </div>
            `).join('');
        } else {
            sessionsList.innerHTML = '<div class="session-item">No sessions yet. Start your first test!</div>';
        }
    }

    /**
     * Create progress chart
     */
    createProgressChart(history) {
        const ctx = document.getElementById('progress-chart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }

        if (!history || history.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.font = '16px Inter';
            ctx.fillStyle = '#718096';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        const recentHistory = history.slice(-20).reverse();
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: recentHistory.map((_, index) => `Test ${index + 1}`),
                datasets: [{
                    label: 'WPM',
                    data: recentHistory.map(session => session.wpm),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Accuracy (%)',
                    data: recentHistory.map(session => session.accuracy),
                    borderColor: '#48bb78',
                    backgroundColor: 'rgba(72, 187, 120, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 4,
                        hoverRadius: 8
                    }
                }
            }
        });
    }

    /**
     * Load global leaderboard
     */
    async loadLeaderboard() {
        try {
            const response = await this.apiCall('/leaderboard');
            const data = await response.json();

            if (response.ok) {
                this.updateLeaderboardDisplay(data.leaderboard);
            }
        } catch (error) {
            console.error('Load leaderboard error:', error);
            this.showNotification('Failed to load leaderboard', 'error');
        }
    }

    /**
     * Update leaderboard display
     */
    updateLeaderboardDisplay(leaderboard) {
        const leaderboardList = document.getElementById('leaderboard-list');
        
        if (leaderboard && leaderboard.length > 0) {
            leaderboardList.innerHTML = leaderboard.map((user, index) => {
                const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
                return `
                    <div class="leaderboard-item">
                        <div class="rank ${rankClass}">#${user.rank}</div>
                        <div class="username">${user.username}</div>
                        <div class="wpm">${user.best_wpm} WPM</div>
                        <div class="accuracy">${user.best_accuracy}%</div>
                    </div>
                `;
            }).join('');
        } else {
            leaderboardList.innerHTML = '<div class="leaderboard-item">No data available</div>';
        }
    }

    /**
     * Handle leaderboard update from WebSocket
     */
    handleLeaderboardUpdate(data) {
        this.addActivityFeedItem({
            text: `${data.user} achieved ${data.wpm} WPM with ${data.accuracy}% accuracy!`,
            time: new Date().toLocaleTimeString()
        });
    }

    /**
     * Add item to activity feed
     */
    addActivityFeedItem(item) {
        const activityList = document.getElementById('activity-list');
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <span class="activity-text">${item.text}</span>
            <span class="activity-time">${item.time}</span>
        `;
        
        activityList.insertBefore(activityItem, activityList.firstChild);
        
        // Keep only recent 10 items
        while (activityList.children.length > 10) {
            activityList.removeChild(activityList.lastChild);
        }
    }

    /**
     * Update test configuration
     */
    updateTestConfig() {
        if (this.state.currentTest) {
            const confirmReset = confirm('Changing configuration will reset the current test. Continue?');
            if (confirmReset) {
                this.resetTest();
            }
        }
    }

    /**
     * Show main application
     */
    showMainApp() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
        
        if (this.state.currentUser) {
            document.getElementById('username-display').textContent = this.state.currentUser.username;
        }
    }

    /**
     * Show authentication section
     */
    showAuthSection() {
        document.getElementById('main-section').classList.add('hidden');
        document.getElementById('auth-section').classList.remove('hidden');
    }

    /**
     * Show login form
     */
    showLogin() {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.querySelectorAll('.tab-button')[0].classList.add('active');
        document.querySelectorAll('.tab-button')[1].classList.remove('active');
    }

    /**
     * Show register form
     */
    showRegister() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
        document.querySelectorAll('.tab-button')[0].classList.remove('active');
        document.querySelectorAll('.tab-button')[1].classList.add('active');
    }

    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
        }, 300);
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');
        
        if (connected) {
            statusDot.classList.remove('disconnected');
            statusText.textContent = 'Connected';
        } else {
            statusDot.classList.add('disconnected');
            statusText.textContent = 'Disconnected';
        }
    }

    /**
     * Handle connection change
     */
    handleConnectionChange(online) {
        if (online) {
            this.showNotification('Connection restored', 'success');
            this.initializeSocket();
        } else {
            this.showNotification('Connection lost', 'warning');
        }
    }

    /**
     * Handle before unload
     */
    handleBeforeUnload(event) {
        if (this.state.currentTest && this.state.currentTest.startTime) {
            event.preventDefault();
            event.returnValue = 'You have an active test. Are you sure you want to leave?';
            return event.returnValue;
        }
    }

    /**
     * Show authentication message
     */
    showMessage(message, type = 'info') {
        const messageEl = document.getElementById('auth-message');
        messageEl.textContent = message;
        messageEl.className = `message ${type}`;
        
        setTimeout(() => {
            messageEl.textContent = '';
            messageEl.className = 'message';
        }, 5000);
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    /**
     * Validate registration data
     */
    validateRegistrationData(username, email, password) {
        if (!username || username.length < 3) {
            this.showMessage('Username must be at least 3 characters', 'error');
            return false;
        }
        
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            return false;
        }
        
        if (!password || password.length < 6) {
            this.showMessage('Password must be at least 6 characters', 'error');
            return false;
        }
        
        return true;
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Make API call with authentication
     */
    async apiCall(endpoint, options = {}) {
        const url = this.config.apiBase + endpoint;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return fetch(url, {
            ...options,
            headers
        });
    }
}

// Global functions for HTML onclick events
function showLogin() {
    app.showLogin();
}

function showRegister() {
    app.showRegister();
}

function startNewTest() {
    app.startNewTest();
}

function submitTest() {
    app.submitTest();
}

function resetTest() {
    app.resetTest();
}

function loadAnalytics() {
    app.loadAnalytics();
}

function loadLeaderboard() {
    app.loadLeaderboard();
}

function logout() {
    app.logout();
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TypeTrackPro();
});

