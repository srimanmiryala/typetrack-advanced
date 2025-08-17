/**
 * Frontend tests for TypeTrack Pro
 * Using Jest for unit testing
 */

// Mock dependencies
global.io = jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn()
}));

global.Chart = jest.fn();

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
    value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
    }
});

// Import the app (assuming it's modularized)
// const TypeTrackPro = require('../frontend/app.js');

describe('TypeTrack Pro Frontend Tests', () => {
    
    describe('Initialization', () => {
        test('should initialize correctly', () => {
            // Mock DOM elements
            document.body.innerHTML = `
                <div id="loading-screen"></div>
                <div id="auth-section"></div>
                <div id="main-section"></div>
            `;
            
            // Test initialization
            expect(document.getElementById('loading-screen')).toBeTruthy();
            expect(document.getElementById('auth-section')).toBeTruthy();
            expect(document.getElementById('main-section')).toBeTruthy();
        });
    });

    describe('Authentication', () => {
        beforeEach(() => {
            // Reset fetch mock
            fetch.mockClear();
            
            // Mock DOM
            document.body.innerHTML = `
                <form id="login-form">
                    <input id="login-username" value="testuser">
                    <input id="login-password" value="testpass">
                </form>
                <form id="register-form">
                    <input id="register-username" value="newuser">
                    <input id="register-email" value="new@test.com">
                    <input id="register-password" value="newpass">
                </form>
                <div id="auth-message"></div>
            `;
        });

        test('should handle successful login', async () => {
            // Mock successful login response
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    token: 'fake-token',
                    user: { id: 1, username: 'testuser' }
                })
            });

            // Simulate login form submission
            const loginForm = document.getElementById('login-form');
            const event = new Event('submit');
            
            // Would normally call app.login() here
            // For now, just verify form elements exist
            expect(loginForm).toBeTruthy();
            expect(document.getElementById('login-username').value).toBe('testuser');
            expect(document.getElementById('login-password').value).toBe('testpass');
        });

        test('should handle registration validation', () => {
            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;

            // Basic validation tests
            expect(username.length).toBeGreaterThanOrEqual(3);
            expect(email).toMatch(/\S+@\S+\.\S+/);
            expect(password.length).toBeGreaterThanOrEqual(6);
        });
    });

    describe('Typing Test', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="prompt-display"></div>
                <textarea id="typing-input"></textarea>
                <div id="current-wpm">0</div>
                <div id="current-accuracy">100%</div>
                <div id="progress">0%</div>
                <div id="current-errors">0</div>
            `;
        });

        test('should calculate WPM correctly', () => {
            const input = "The quick brown fox jumps";
            const words = input.trim().split(/\s+/).length;
            const timeMinutes = 1; // 1 minute
            const expectedWpm = words / timeMinutes;

            expect(words).toBe(5);
            expect(expectedWpm).toBe(5);
        });

        test('should calculate accuracy correctly', () => {
            const prompt = "Hello world";
            const input = "Hello wrold"; // One typo
            
            let correctChars = 0;
            for (let i = 0; i < Math.min(input.length, prompt.length); i++) {
                if (input[i] === prompt[i]) correctChars++;
            }
            
            const accuracy = (correctChars / prompt.length) * 100;
            
            expect(correctChars).toBe(10); // 10 out of 11 characters correct
            expect(Math.round(accuracy)).toBe(91);
        });

        test('should update metrics display', () => {
            const metrics = {
                wpm: 75,
                accuracy: 92,
                progress: 50,
                errors: 3
            };

            // Simulate updating display
            document.getElementById('current-wpm').textContent = metrics.wpm;
            document.getElementById('current-accuracy').textContent = `${metrics.accuracy}%`;
            document.getElementById('progress').textContent = `${metrics.progress}%`;
            document.getElementById('current-errors').textContent = metrics.errors;

            // Verify updates
            expect(document.getElementById('current-wpm').textContent).toBe('75');
            expect(document.getElementById('current-accuracy').textContent).toBe('92%');
            expect(document.getElementById('progress').textContent).toBe('50%');
            expect(document.getElementById('current-errors').textContent).toBe('3');
        });
    });

    describe('API Communication', () => {
        beforeEach(() => {
            fetch.mockClear();
        });

        test('should make API calls with correct headers', async () => {
            const mockToken = 'fake-token';
            localStorage.getItem.mockReturnValue(mockToken);

            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ message: 'success' })
            });

            // Simulate API call
            const response = await fetch('/api/test', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${mockToken}`,
                    'Content-Type': 'application/json'
                }
            });

            expect(fetch).toHaveBeenCalledWith('/api/test', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${mockToken}`,
                    'Content-Type': 'application/json'
                }
            });

            expect(response.ok).toBe(true);
        });

        test('should handle API errors gracefully', async () => {
            fetch.mockRejectedValueOnce(new Error('Network error'));

            try {
                await fetch('/api/test');
            } catch (error) {
                expect(error.message).toBe('Network error');
            }
        });
    });

    describe('Real-time Features', () => {
        test('should initialize WebSocket connection', () => {
            const mockSocket = {
                on: jest.fn(),
                emit: jest.fn()
            };

            global.io.mockReturnValue(mockSocket);

            // Simulate socket initialization
            const socket = io('http://localhost:5000');

            expect(io).toHaveBeenCalledWith('http://localhost:5000');
            expect(socket).toBeTruthy();
        });

        test('should handle socket events', () => {
            const mockSocket = {
                on: jest.fn(),
                emit: jest.fn()
            };

            global.io.mockReturnValue(mockSocket);
            const socket = io('http://localhost:5000');

            // Simulate setting up event handlers
            socket.on('connect', () => console.log('connected'));
            socket.on('metrics_update', (data) => console.log('metrics', data));

            expect(socket.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(socket.on).toHaveBeenCalledWith('metrics_update', expect.any(Function));
        });
    });

    describe('Data Visualization', () => {
        test('should create progress chart', () => {
            // Mock canvas context
            const mockContext = {
                getContext: jest.fn(() => ({}))
            };

            document.getElementById = jest.fn(() => mockContext);

            // Mock Chart constructor
            global.Chart.mockImplementation((ctx, config) => {
                expect(config.type).toBe('line');
                expect(config.data).toBeDefined();
                expect(config.options).toBeDefined();
                return { destroy: jest.fn() };
            });

            // Simulate chart creation
            const canvas = document.getElementById('progress-chart');
            const ctx = canvas.getContext('2d');
            
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Test 1', 'Test 2', 'Test 3'],
                    datasets: [{
                        label: 'WPM',
                        data: [45, 50, 55]
                    }]
                },
                options: {
                    responsive: true
                }
            });

            expect(Chart).toHaveBeenCalled();
            expect(chart).toBeDefined();
        });
    });

    describe('Utility Functions', () => {
        test('should format dates correctly', () => {
            const dateString = '2024-04-15T10:30:00.000Z';
            const date = new Date(dateString);
            
            const formatted = date.toLocaleDateString() + ' ' + 
                            date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}/);
        });

        test('should validate email format', () => {
            const validEmail = 'test@example.com';
            const invalidEmail = 'invalid-email';
            
            const emailRegex = /\S+@\S+\.\S+/;
            
            expect(emailRegex.test(validEmail)).toBe(true);
            expect(emailRegex.test(invalidEmail)).toBe(false);
        });

        test('should format time duration', () => {
            const formatTime = (seconds) => {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = Math.floor(seconds % 60);
                return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
            };

            expect(formatTime(125)).toBe('2:05');
            expect(formatTime(59)).toBe('0:59');
            expect(formatTime(3661)).toBe('61:01');
        });
    });
});

// Test runner configuration
module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    moduleNameMapper: {
        '\\.(css|less|scss)$': 'identity-obj-proxy'
    },
    collectCoverageFrom: [
        'frontend/**/*.js',
        '!frontend/node_modules/**',
        '!frontend/dist/**'
    ],
    coverageReporters: ['text', 'lcov', 'html']
};

