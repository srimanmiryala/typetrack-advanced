/**
 * Analytics component for TypeTrack Pro
 * Handles advanced analytics and data visualization
 */

class AnalyticsComponent {
    constructor() {
        this.charts = {};
        this.data = {};
        this.filters = {
            difficulty: '',
            timeRange: '30d',
            metric: 'wpm'
        };
        this.exportFormats = ['csv', 'json', 'pdf'];
    }

    /**
     * Initialize analytics component
     */
    init() {
        this.setupEventListeners();
        this.loadAnalyticsData();
        this.initializeAdvancedFeatures();
    }

    /**
     * Setup event listeners for analytics
     */
    setupEventListeners() {
        // Filter changes
        const difficultyFilter = document.getElementById('analytics-difficulty');
        if (difficultyFilter) {
            difficultyFilter.addEventListener('change', (e) => {
                this.filters.difficulty = e.target.value;
                this.loadAnalyticsData();
            });
        }

        // Time range selector
        const timeRangeSelector = document.getElementById('time-range');
        if (timeRangeSelector) {
            timeRangeSelector.addEventListener('change', (e) => {
                this.filters.timeRange = e.target.value;
                this.loadAnalyticsData();
            });
        }

        // Metric selector
        const metricSelector = document.getElementById('metric-selector');
        if (metricSelector) {
            metricSelector.addEventListener('change', (e) => {
                this.filters.metric = e.target.value;
                this.updateCharts();
            });
        }

        // Export buttons
        this.setupExportListeners();

        // Refresh button
        const refreshBtn = document.getElementById('refresh-analytics');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadAnalyticsData());
        }

        // Chart type toggle
        const chartTypeToggles = document.querySelectorAll('.chart-type-toggle');
        chartTypeToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const chartType = e.target.dataset.chartType;
                this.switchChartType(chartType);
            });
        });
    }

    /**
     * Setup export listeners
     */
    setupExportListeners() {
        this.exportFormats.forEach(format => {
            const btn = document.getElementById(`export-${format}`);
            if (btn) {
                btn.addEventListener('click', () => this.exportData(format));
            }
        });
    }

    /**
     * Initialize advanced features
     */
    initializeAdvancedFeatures() {
        this.initializeHeatmap();
        this.initializeProgressIndicators();
        this.initializeComparisonTools();
    }

    /**
     * Load analytics data from API
     */
    async loadAnalyticsData() {
        try {
            this.showLoadingState();

            const params = new URLSearchParams();
            if (this.filters.difficulty) params.append('difficulty', this.filters.difficulty);
            if (this.filters.timeRange) params.append('timeRange', this.filters.timeRange);

            const response = await window.app.apiCall(`/analytics?${params.toString()}`);
            const data = await response.json();

            if (response.ok) {
                this.data = data;
                this.updateAnalyticsDisplay();
                this.createAdvancedCharts();
                this.calculateAdvancedMetrics();
            } else {
                throw new Error(data.message || 'Failed to load analytics');
            }
        } catch (error) {
            console.error('Failed to load analytics:', error);
            this.showErrorState(error.message);
        } finally {
            this.hideLoadingState();
        }
    }

    /**
     * Update analytics display with latest data
     */
    updateAnalyticsDisplay() {
        if (!this.data) return;

        // Update basic stats
        this.updateStatCard('avg-wpm', this.data.average_wpm, this.calculateChange('wpm'));
        this.updateStatCard('best-wpm', this.data.best_wpm);
        this.updateStatCard('avg-accuracy', `${this.data.average_accuracy}%`, this.calculateChange('accuracy'));
        this.updateStatCard('total-tests', this.data.total_sessions);

        // Update improvement rate
        if (this.data.improvement_rate !== undefined) {
            const improvementElement = document.getElementById('improvement-rate');
            if (improvementElement) {
                const rate = this.data.improvement_rate;
                improvementElement.textContent = `${rate > 0 ? '+' : ''}${rate}%`;
                improvementElement.className = `stat-change ${rate > 0 ? 'positive' : rate < 0 ? 'negative' : 'neutral'}`;
            }
        }

        // Update detailed statistics
        this.updateDetailedStats();
        this.updateSessionsList();
        this.updatePerformanceInsights();
    }

    /**
     * Update individual stat card
     */
    updateStatCard(elementId, value, change = null) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value || 0;
            
            // Add animation for value changes
            element.classList.add('stat-updated');
            setTimeout(() => {
                element.classList.remove('stat-updated');
            }, 500);
        }

        if (change !== null) {
            const changeElement = document.getElementById(`${elementId.replace(/^(avg-|best-)/, '')}-change`);
            if (changeElement) {
                changeElement.textContent = `${change > 0 ? '+' : ''}${change}%`;
                changeElement.className = `stat-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'}`;
            }
        }
    }

    /**
     * Calculate improvement/change percentage
     */
    calculateChange(metric) {
        if (!this.data.history || this.data.history.length < 10) return 0;

        const recent = this.data.history.slice(0, 5);
        const older = this.data.history.slice(-5);

        const recentAvg = recent.reduce((sum, session) => sum + session[metric], 0) / recent.length;
        const olderAvg = older.reduce((sum, session) => sum + session[metric], 0) / older.length;

        return olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;
    }

    /**
     * Update detailed statistics
     */
    updateDetailedStats() {
        if (!this.data.history) return;

        const sessions = this.data.history;
        
        // Calculate additional metrics
        const avgErrorRate = sessions.reduce((sum, s) => sum + (s.errors || 0), 0) / sessions.length;
        const avgTestTime = sessions.reduce((sum, s) => sum + (s.time_taken || 0), 0) / sessions.length;
        
        // Consistency score (lower variance = higher consistency)
        const wpmValues = sessions.map(s => s.wpm);
        const variance = this.calculateVariance(wpmValues);
        const consistencyScore = Math.max(0, 100 - (variance / 10));

        // Peak performance analysis
        const peakWpm = Math.max(...wpmValues);
        const peakAccuracy = Math.max(...sessions.map(s => s.accuracy));
        
        // Difficulty distribution
        const difficultyStats = this.calculateDifficultyStats(sessions);

        // Update display elements
        this.updateStatDisplay('avg-error-rate', avgErrorRate.toFixed(1));
        this.updateStatDisplay('avg-test-time', this.formatTime(avgTestTime));
        this.updateStatDisplay('consistency-score', `${consistencyScore.toFixed(1)}%`);
        this.updateStatDisplay('peak-wpm', peakWpm.toFixed(1));
        this.updateStatDisplay('peak-accuracy', `${peakAccuracy.toFixed(1)}%`);
        
        // Update difficulty breakdown
        this.updateDifficultyBreakdown(difficultyStats);
    }

    /**
     * Calculate variance for consistency score
     */
    calculateVariance(values) {
        if (values.length === 0) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    }

    /**
     * Calculate difficulty statistics
     */
    calculateDifficultyStats(sessions) {
        const stats = { easy: [], medium: [], hard: [] };
        
        sessions.forEach(session => {
            const difficulty = session.difficulty || 'medium';
            if (stats[difficulty]) {
                stats[difficulty].push(session);
            }
        });

        return Object.keys(stats).map(difficulty => ({
            difficulty,
            count: stats[difficulty].length,
            avgWpm: stats[difficulty].length > 0 
                ? stats[difficulty].reduce((sum, s) => sum + s.wpm, 0) / stats[difficulty].length 
                : 0,
            avgAccuracy: stats[difficulty].length > 0 
                ? stats[difficulty].reduce((sum, s) => sum + s.accuracy, 0) / stats[difficulty].length 
                : 0
        }));
    }

    /**
     * Update difficulty breakdown display
     */
    updateDifficultyBreakdown(difficultyStats) {
        const container = document.getElementById('difficulty-breakdown');
        if (!container) return;

        container.innerHTML = difficultyStats.map(stat => `
            <div class="difficulty-stat">
                <div class="difficulty-label">${stat.difficulty.charAt(0).toUpperCase() + stat.difficulty.slice(1)}</div>
                <div class="difficulty-metrics">
                    <span class="metric">${stat.count} tests</span>
                    <span class="metric">${stat.avgWpm.toFixed(1)} WPM</span>
                    <span class="metric">${stat.avgAccuracy.toFixed(1)}%</span>
                </div>
            </div>
        `).join('');
    }

    /**
     * Calculate advanced metrics
     */
    calculateAdvancedMetrics() {
        if (!this.data.history) return;

        // Learning curve analysis
        this.calculateLearningCurve();
        
        // Performance patterns
        this.analyzePerformancePatterns();
        
        // Goal tracking
        this.updateGoalProgress();
    }

    /**
     * Calculate learning curve
     */
    calculateLearningCurve() {
        const sessions = this.data.history;
        if (sessions.length < 5) return;

        const recentSessions = sessions.slice(0, 10);
        const olderSessions = sessions.slice(-10);

        const recentAvg = recentSessions.reduce((sum, s) => sum + s.wpm, 0) / recentSessions.length;
        const olderAvg = olderSessions.reduce((sum, s) => sum + s.wpm, 0) / olderSessions.length;

        const learningRate = ((recentAvg - olderAvg) / olderAvg) * 100;
        
        this.updateStatDisplay('learning-rate', `${learningRate > 0 ? '+' : ''}${learningRate.toFixed(1)}%`);
    }

    /**
     * Analyze performance patterns
     */
    analyzePerformancePatterns() {
        // Time-based analysis
        const timePatterns = this.analyzeTimePatterns();
        this.updateTimePatterns(timePatterns);

        // Error pattern analysis
        const errorPatterns = this.analyzeErrorPatterns();
        this.updateErrorPatterns(errorPatterns);
    }

    /**
     * Analyze time-based patterns
     */
    analyzeTimePatterns() {
        const sessions = this.data.history;
        const hourlyPerformance = {};

        sessions.forEach(session => {
            const hour = new Date(session.timestamp).getHours();
            if (!hourlyPerformance[hour]) {
                hourlyPerformance[hour] = { total: 0, count: 0, accuracy: 0 };
            }
            hourlyPerformance[hour].total += session.wpm;
            hourlyPerformance[hour].accuracy += session.accuracy;
            hourlyPerformance[hour].count++;
        });

        // Find best performing hours
        let bestHour = 0;
        let bestWpm = 0;

        Object.keys(hourlyPerformance).forEach(hour => {
            const avgWpm = hourlyPerformance[hour].total / hourlyPerformance[hour].count;
            if (avgWpm > bestWpm) {
                bestWpm = avgWpm;
                bestHour = hour;
            }
        });

        return { bestHour, bestWpm, hourlyData: hourlyPerformance };
    }

    /**
     * Update time patterns display
     */
    updateTimePatterns(patterns) {
        const container = document.getElementById('time-patterns');
        if (!container) return;

        container.innerHTML = `
            <div class="pattern-insight">
                <h4>🕐 Best Performance Time</h4>
                <p>You perform best at <strong>${patterns.bestHour}:00</strong> with an average of <strong>${patterns.bestWpm.toFixed(1)} WPM</strong></p>
            </div>
        `;
    }

    /**
     * Create advanced charts
     */
    createAdvancedCharts() {
        this.createProgressChart();
        this.createDistributionChart();
        this.createHeatmapChart();
        this.createPerformanceRadar();
        this.createTrendAnalysis();
    }

    /**
     * Create main progress chart
     */
    createProgressChart() {
        const ctx = document.getElementById('progress-chart')?.getContext('2d');
        if (!ctx || !this.data.history) return;

        if (this.charts.progress) {
            this.charts.progress.destroy();
        }

        const history = this.data.history.slice(-20).reverse();
        
        this.charts.progress = new Chart(ctx, {
            type: 'line',
            data: {
                labels: history.map((_, index) => `Test ${index + 1}`),
                datasets: [{
                    label: 'WPM',
                    data: history.map(session => session.wpm),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                }, {
                    label: 'Accuracy (%)',
                    data: history.map(session => session.accuracy),
                    borderColor: '#48bb78',
                    backgroundColor: 'rgba(72, 187, 120, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            afterBody: (context) => {
                                const sessionIndex = context[0].dataIndex;
                                const session = history[sessionIndex];
                                return [
                                    `Difficulty: ${session.difficulty}`,
                                    `Errors: ${session.errors || 0}`,
                                    `Time: ${this.formatTime(session.time_taken || 0)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'WPM'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Accuracy (%)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    }

    /**
     * Create distribution chart
     */
    createDistributionChart() {
        const ctx = document.getElementById('distribution-chart')?.getContext('2d');
        if (!ctx || !this.data.history) return;

        if (this.charts.distribution) {
            this.charts.distribution.destroy();
        }

        const wpmValues = this.data.history.map(s => s.wpm);
        const bins = this.createHistogramBins(wpmValues, 10);

        this.charts.distribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: bins.map(bin => `${bin.min}-${bin.max}`),
                datasets: [{
                    label: 'Frequency',
                    data: bins.map(bin => bin.count),
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: '#667eea',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'WPM Distribution'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Tests'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'WPM Range'
                        }
                    }
                }
            }
        });
    }

    /**
     * Create performance radar chart
     */
    createPerformanceRadar() {
        const ctx = document.getElementById('radar-chart')?.getContext('2d');
        if (!ctx || !this.data.history) return;

        if (this.charts.radar) {
            this.charts.radar.destroy();
        }

        // Calculate normalized scores for different aspects
        const scores = this.calculateRadarScores();

        this.charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Speed', 'Accuracy', 'Consistency', 'Endurance', 'Improvement'],
                datasets: [{
                    label: 'Your Performance',
                    data: scores,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#667eea'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    /**
     * Calculate scores for radar chart
     */
    calculateRadarScores() {
        const sessions = this.data.history;
        if (!sessions || sessions.length === 0) return [0, 0, 0, 0, 0];

        // Speed score (based on average WPM vs target of 70)
        const avgWpm = sessions.reduce((sum, s) => sum + s.wpm, 0) / sessions.length;
        const speedScore = Math.min((avgWpm / 70) * 100, 100);

        // Accuracy score
        const avgAccuracy = sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length;
        const accuracyScore = avgAccuracy;

        // Consistency score (inverse of variance)
        const wpmValues = sessions.map(s => s.wpm);
        const variance = this.calculateVariance(wpmValues);
        const consistencyScore = Math.max(0, 100 - (variance / 10));

        // Endurance score (based on test length performance)
        const enduranceScore = this.calculateEnduranceScore(sessions);

        // Improvement score
        const improvementScore = Math.max(0, Math.min(100, this.data.improvement_rate + 50));

        return [speedScore, accuracyScore, consistencyScore, enduranceScore, improvementScore];
    }

    /**
     * Calculate endurance score
     */
    calculateEnduranceScore(sessions) {
        const longSessions = sessions.filter(s => (s.time_taken || 0) > 120); // > 2 minutes
        if (longSessions.length === 0) return 50;

        const avgPerformance = longSessions.reduce((sum, s) => sum + s.wpm, 0) / longSessions.length;
        const overallAvg = sessions.reduce((sum, s) => sum + s.wpm, 0) / sessions.length;

        return Math.min(100, (avgPerformance / overallAvg) * 100);
    }

    /**
     * Create heatmap chart for typing patterns
     */
    createHeatmapChart() {
        const canvas = document.getElementById('heatmap-chart');
        if (!canvas || !this.data.history) return;

        const heatmapData = this.prepareHeatmapData();
        this.renderHeatmap(canvas, heatmapData);
    }

    /**
     * Create trend analysis chart
     */
    createTrendAnalysis() {
        const ctx = document.getElementById('trend-chart')?.getContext('2d');
        if (!ctx || !this.data.history) return;

        if (this.charts.trend) {
            this.charts.trend.destroy();
        }

        const trendData = this.calculateTrendData();

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendData.labels,
                datasets: [{
                    label: 'Moving Average (7 days)',
                    data: trendData.movingAverage,
                    borderColor: '#9f7aea',
                    backgroundColor: 'rgba(159, 122, 234, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Trend Line',
                    data: trendData.trendLine,
                    borderColor: '#ed8936',
                    borderDash: [5, 5],
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }

    /**
     * Calculate trend data
     */
    calculateTrendData() {
        const sessions = this.data.history.slice(-30); // Last 30 sessions
        const labels = sessions.map((_, i) => `Session ${i + 1}`);
        
        // Calculate moving average
        const movingAverage = [];
        const windowSize = 7;

        for (let i = 0; i < sessions.length; i++) {
            const start = Math.max(0, i - windowSize + 1);
            const window = sessions.slice(start, i + 1);
            const avg = window.reduce((sum, s) => sum + s.wpm, 0) / window.length;
            movingAverage.push(avg);
        }

        // Calculate trend line using linear regression
        const trendLine = this.calculateLinearRegression(sessions.map(s => s.wpm));

        return { labels, movingAverage, trendLine };
    }

    /**
     * Calculate linear regression for trend line
     */
    calculateLinearRegression(values) {
        const n = values.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = values;

        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = y.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        return x.map(val => slope * val + intercept);
    }

    /**
     * Create histogram bins for distribution chart
     */
    createHistogramBins(values, binCount) {
        if (values.length === 0) return [];

        const min = Math.min(...values);
        const max = Math.max(...values);
        const binWidth = (max - min) / binCount;

        const bins = [];
        for (let i = 0; i < binCount; i++) {
            const binMin = Math.round(min + i * binWidth);
            const binMax = Math.round(min + (i + 1) * binWidth);
            const count = values.filter(v => v >= binMin && v < binMax).length;
            
            bins.push({
                min: binMin,
                max: binMax,
                count: count
            });
        }

        return bins;
    }

    /**
     * Prepare data for heatmap visualization
     */
    prepareHeatmapData() {
        const data = {};
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // Initialize data structure
        days.forEach(day => {
            data[day] = {};
            for (let hour = 0; hour < 24; hour++) {
                data[day][hour] = { count: 0, avgWpm: 0, totalWpm: 0 };
            }
        });

        // Populate data from sessions
        this.data.history.forEach(session => {
            const date = new Date(session.timestamp);
            const day = days[date.getDay()];
            const hour = date.getHours();

            if (data[day] && data[day][hour]) {
                data[day][hour].count++;
                data[day][hour].totalWpm += session.wpm;
                data[day][hour].avgWpm = data[day][hour].totalWpm / data[day][hour].count;
            }
        });

        return data;
    }

    /**
     * Render custom heatmap
     */
    renderHeatmap(canvas, data) {
        const ctx = canvas.getContext('2d');
        const cellWidth = canvas.width / 24;
        const cellHeight = canvas.height / 7;
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let maxValue = 0;
        Object.values(data).forEach(dayData => {
            Object.values(dayData).forEach(hourData => {
                if (hourData.count > maxValue) maxValue = hourData.count;
            });
        });

        days.forEach((day, dayIndex) => {
            for (let hour = 0; hour < 24; hour++) {
                const cellData = data[day][hour];
                const intensity = maxValue > 0 ? cellData.count / maxValue : 0;
                const alpha = Math.max(0.1, intensity);

                ctx.fillStyle = `rgba(102, 126, 234, ${alpha})`;
                ctx.fillRect(hour * cellWidth, dayIndex * cellHeight, cellWidth, cellHeight);

                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.strokeRect(hour * cellWidth, dayIndex * cellHeight, cellWidth, cellHeight);
            }
        });

        // Draw labels
        ctx.fillStyle = '#2d3748';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';

        for (let hour = 0; hour < 24; hour++) {
            ctx.fillText(hour.toString(), hour * cellWidth + cellWidth / 2, canvas.height + 15);
        }

        ctx.textAlign = 'right';
        days.forEach((day, index) => {
            ctx.fillText(day, -5, index * cellHeight + cellHeight / 2 + 4);
        });
    }

    /**
     * Update sessions list
     */
    updateSessionsList() {
        const container = document.getElementById('sessions-list');
        if (!container || !this.data.history) return;

        const recentSessions = this.data.history.slice(0, 10);
        
        container.innerHTML = recentSessions.map(session => `
            <div class="session-item" data-session-id="${session.id || 'unknown'}">
                <div class="session-metrics">
                    <span class="wpm-badge">${session.wpm} WPM</span>
                    <span class="accuracy-badge">${session.accuracy}%</span>
                    <span class="difficulty-badge difficulty-${session.difficulty || 'medium'}">${session.difficulty || 'Medium'}</span>
                </div>
                <div class="session-details">
                    <span class="session-time">${this.formatDate(session.timestamp)}</span>
                    <span class="session-errors">${session.errors || 0} errors</span>
                    <span class="session-duration">${this.formatTime(session.time_taken || 0)}</span>
                </div>
                <div class="session-actions">
                    <button class="btn-small" onclick="analytics.viewSessionDetails('${session.id || 'unknown'}')">
                        View Details
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * View session details
     */
    viewSessionDetails(sessionId) {
        const session = this.data.history.find(s => s.id === sessionId);
        if (!session) return;

        // Create modal with session details
        const modal = this.createSessionModal(session);
        document.body.appendChild(modal);
    }

    /**
     * Create session details modal
     */
    createSessionModal(session) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content session-details-modal">
                <div class="modal-header">
                    <h2>Session Details</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="session-overview">
                        <div class="metric-card">
                            <div class="metric-value">${session.wpm}</div>
                            <div class="metric-label">WPM</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">${session.accuracy}%</div>
                            <div class="metric-label">Accuracy</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">${session.errors || 0}</div>
                            <div class="metric-label">Errors</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">${this.formatTime(session.time_taken || 0)}</div>
                            <div class="metric-label">Duration</div>
                        </div>
                    </div>
                    <div class="session-metadata">
                        <p><strong>Date:</strong> ${this.formatDate(session.timestamp)}</p>
                        <p><strong>Difficulty:</strong> ${session.difficulty || 'Medium'}</p>
                        <p><strong>Characters Typed:</strong> ${session.characters_typed || 'N/A'}</p>
                    </div>
                </div>
            </div>
        `;

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        return modal;
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        const containers = ['progress-chart', 'distribution-chart', 'sessions-list'];
        containers.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = '<div class="loading-spinner">Loading...</div>';
            }
        });
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        // Loading is hidden when content is updated
    }

    /**
     * Show error state
     */
    showErrorState(message) {
        const containers = ['progress-chart', 'distribution-chart', 'sessions-list'];
        containers.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = `
                    <div class="error-state">
                        <div class="error-icon">⚠️</div>
                        <h3>Error Loading Data</h3>
                        <p>${message}</p>
                        <button class="btn btn-secondary" onclick="analytics.loadAnalyticsData()">
                            Try Again
                        </button>
                    </div>
                `;
            }
        });
    }

    /**
     * Switch chart type
     */
    switchChartType(chartType) {
        const currentChart = this.charts.progress;
        if (!currentChart) return;

        // Update chart type while preserving data
        const newConfig = { ...currentChart.config };
        newConfig.type = chartType;

        currentChart.destroy();
        const ctx = document.getElementById('progress-chart').getContext('2d');
        this.charts.progress = new Chart(ctx, newConfig);
    }

    /**
     * Export analytics data
     */
    exportData(format = 'csv') {
        if (!this.data.history) {
            window.app.showNotification('No data to export', 'warning');
            return;
        }

        const data = this.data.history.map(session => ({
            timestamp: session.timestamp,
            wpm: session.wpm,
            accuracy: session.accuracy,
            difficulty: session.difficulty,
            errors: session.errors || 0,
            time_taken: session.time_taken || 0,
            characters_typed: session.characters_typed || 0
        }));

        switch (format) {
            case 'csv':
                this.exportToCSV(data);
                break;
            case 'json':
                this.exportToJSON(data);
                break;
            case 'pdf':
                this.exportToPDF(data);
                break;
        }
    }

    /**
     * Export to CSV format
     */
    exportToCSV(data) {
        const headers = ['Timestamp', 'WPM', 'Accuracy', 'Difficulty', 'Errors', 'Time Taken', 'Characters Typed'];
        const csvContent = [
            headers.join(','),
            ...data.map(row => [
                row.timestamp,
                row.wpm,
                row.accuracy,
                row.difficulty,
                row.errors,
                row.time_taken,
                row.characters_typed
            ].join(','))
        ].join('\n');

        this.downloadFile(csvContent, 'text/csv', 'csv');
    }

    /**
     * Export to JSON format
     */
    exportToJSON(data) {
        const jsonContent = JSON.stringify({
            exported_at: new Date().toISOString(),
            total_sessions: data.length,
            data: data
        }, null, 2);

        this.downloadFile(jsonContent, 'application/json', 'json');
    }

    /**
     * Export to PDF format (basic implementation)
     */
    exportToPDF(data) {
        // This would require a PDF library like jsPDF
        // For now, we'll create a formatted text version
        const content = `
TypeTrack Analytics Report
Generated: ${new Date().toLocaleString()}

Summary:
- Total Sessions: ${data.length}
- Average WPM: ${this.data.average_wpm}
- Best WPM: ${this.data.best_wpm}
- Average Accuracy: ${this.data.average_accuracy}%

Session Details:
${data.map(session => 
    `${session.timestamp}: ${session.wpm} WPM, ${session.accuracy}% accuracy, ${session.difficulty} difficulty`
).join('\n')}
        `.trim();

        this.downloadFile(content, 'text/plain', 'txt');
    }

    /**
     * Download file helper
     */
    downloadFile(content, mimeType, extension) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `typetrack-analytics-${new Date().toISOString().split('T')[0]}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        window.app.showNotification(`Analytics exported as ${extension.toUpperCase()}`, 'success');
    }

    /**
     * Update stat display helper
     */
    updateStatDisplay(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Format time duration
     */
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    /**
     * Cleanup component
     */
    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }
}

// Initialize analytics component when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.analytics = new AnalyticsComponent();
    if (window.app && window.app.state.isAuthenticated) {
        window.analytics.init();
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnalyticsComponent;
}

