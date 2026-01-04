// WebSocket and RTC Manager for Bingo Game - FIXED PASSWORD ISSUE
class ConnectionManager {
    constructor() {
        this.ws = null;
        this.rtcConnections = new Map();
        this.peerConnectionConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.userId = this.generateUserId();
        this.username = 'Player_' + Math.random().toString(36).substr(2, 9);
        this.wsUrl = 'wss://ameng-gogs-ass9-01-30.deno.dev/';
        
        // Admin state (NO PASSWORD STORED HERE)
        this.isAdmin = false;
        this.adminToken = null;
    }

    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.setupRTCListeners();
        
        // Check for admin parameter in URL
        this.checkAdminAccess();
    }

    connectWebSocket() {
        // Use the provided WebSocket URL directly
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to server at:', this.wsUrl);
            this.reconnectAttempts = 0;
            
            // Send join message to register with server
            this.sendMessage({
                type: 'user_join',
                userId: this.userId,
                username: this.username
            });
            
            // Check if we need to show admin login
            if (this.shouldShowAdminLogin()) {
                this.showAdminLoginModal();
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('Disconnected from server');
            this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    checkAdminAccess() {
        // Check URL for admin parameter
        const urlParams = new URLSearchParams(window.location.search);
        const adminParam = urlParams.get('admin');
        
        if (adminParam === 'true' || adminParam === '1') {
            // Set flag to show admin login when connected
            this.needsAdminLogin = true;
        }
    }

    shouldShowAdminLogin() {
        return this.needsAdminLogin && !this.isAdmin;
    }

    showAdminLoginModal() {
        // Create admin login modal (password NOT stored in frontend)
        const modal = document.createElement('div');
        modal.id = 'adminLoginModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 999999;
            font-family: Arial, sans-serif;
        `;
        
        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #0d47a1 0%, #1a237e 100%);
                padding: 40px 30px;
                border-radius: 15px;
                text-align: center;
                width: 90%;
                max-width: 400px;
                border: 3px solid #ffd700;
                box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
                color: white;
            ">
                <h2 style="color: #ffd700; margin-bottom: 10px; font-size: 24px;">🔐 Admin Access</h2>
                <p style="margin-bottom: 25px; color: #ccc; font-size: 14px;">
                    Enter admin password to access controls
                </p>
                <input type="password" id="adminPasswordInput" 
                       placeholder="Password" 
                       style="
                            width: 100%;
                            padding: 15px;
                            margin: 15px 0;
                            border: 2px solid #28a745;
                            border-radius: 8px;
                            font-size: 16px;
                            background: white;
                            color: #333;
                            text-align: center;
                            letter-spacing: 2px;
                       "
                       autocomplete="off">
                <div id="adminLoginError" style="
                    color: #ff6b6b;
                    margin: 10px 0;
                    min-height: 20px;
                    font-size: 14px;
                "></div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button onclick="window.connectionManager.submitAdminLogin()" style="
                        flex: 1;
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 15px;
                        border-radius: 8px;
                        font-size: 16px;
                        cursor: pointer;
                        font-weight: bold;
                        border: 2px solid #000;
                    ">Login</button>
                    <button onclick="window.connectionManager.closeAdminLogin()" style="
                        flex: 1;
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 15px;
                        border-radius: 8px;
                        font-size: 16px;
                        cursor: pointer;
                        border: 2px solid #000;
                    ">Cancel</button>
                </div>
                <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2);">
                    <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;">
                        Forgot password? Contact system administrator
                    </div>
                    <div style="font-size: 10px; color: #888;">
                        Password is verified by server only
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus on input and handle Enter key
        setTimeout(() => {
            const input = document.getElementById('adminPasswordInput');
            input.focus();
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.submitAdminLogin();
                }
            });
        }, 100);
    }

    submitAdminLogin() {
        const passwordInput = document.getElementById('adminPasswordInput');
        const errorEl = document.getElementById('adminLoginError');
        
        if (!passwordInput) return;
        
        const password = passwordInput.value;
        
        if (!password) {
            errorEl.textContent = 'Please enter password';
            return;
        }
        
        // Clear password from input immediately (security)
        passwordInput.value = '';
        
        // Show verifying message
        errorEl.style.color = '#28a745';
        errorEl.textContent = 'Verifying with server...';
        
        // Send password to BACKEND for verification
        // NOTE: Password is sent to backend but NOT stored in frontend
        this.sendMessage({
            type: 'admin_auth',
            password: password,
            timestamp: Date.now()
        });
        
        // Clear password from memory (security)
        setTimeout(() => {
            if (errorEl.textContent === 'Verifying with server...') {
                errorEl.style.color = '#ff6b6b';
                errorEl.textContent = 'Server timeout. Try again.';
            }
        }, 5000);
    }

    closeAdminLogin() {
        const modal = document.getElementById('adminLoginModal');
        if (modal) {
            modal.remove();
        }
        // Remove admin parameter from URL without refresh
        const url = new URL(window.location);
        url.searchParams.delete('admin');
        window.history.replaceState({}, '', url);
    }

    handleMessage(data) {
        console.log('Received from server:', data);
        
        switch(data.type) {
            case 'welcome':
                console.log('Server welcome:', data.message);
                break;
                
            case 'user_list':
                this.updateUserList(data.users);
                break;
                
            case 'game_state':
                this.updateGameState(data.state);
                break;
                
            case 'number_called':
                this.handleNumberCalled(data.number);
                break;
                
            case 'winner_announced':
                this.handleWinnerAnnouncement(data.winner);
                break;
                
            case 'rtc_offer':
                this.handleRTCOffer(data);
                break;
                
            case 'rtc_answer':
                this.handleRTCAnswer(data);
                break;
                
            case 'ice_candidate':
                this.handleICECandidate(data);
                break;
                
            case 'broadcast':
                this.showBroadcast(data.message);
                break;
                
            case 'admin_command':
                this.handleAdminCommand(data.command);
                break;
                
            case 'auth_response':
                this.handleAuthResponse(data);
                break;
        }
    }

    handleAuthResponse(data) {
        const errorEl = document.getElementById('adminLoginError');
        
        if (data.success) {
            console.log('✅ Admin authentication successful');
            this.isAdmin = true;
            this.adminToken = data.token;
            
            // Hide login modal
            this.closeAdminLogin();
            
            // Show admin interface
            this.showAdminInterface();
            
            // Success message
            this.showNotification('Admin access granted!', 'success');
            
        } else {
            console.error('❌ Admin authentication failed:', data.message);
            
            if (errorEl) {
                errorEl.style.color = '#ff6b6b';
                errorEl.textContent = data.message || 'Invalid password';
            }
            
            // Re-focus on password input
            setTimeout(() => {
                const input = document.getElementById('adminPasswordInput');
                if (input) {
                    input.focus();
                    input.value = '';
                }
            }, 100);
        }
    }

    showAdminInterface() {
        // Create admin control panel
        const adminPanel = document.createElement('div');
        adminPanel.id = 'adminControlPanel';
        adminPanel.style.cssText = `
            position: fixed;
            top: 70px;
            right: 10px;
            background: rgba(13, 71, 161, 0.95);
            border: 3px solid #28a745;
            border-radius: 12px;
            padding: 20px;
            z-index: 9999;
            color: white;
            min-width: 320px;
            max-width: 90vw;
            max-height: 80vh;
            overflow-y: auto;
            font-family: Arial, sans-serif;
            box-shadow: 0 0 30px rgba(40, 167, 69, 0.5);
        `;
        
        adminPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: #ffd700; margin: 0; font-size: 18px;">🎮 Admin Dashboard</h3>
                <button onclick="window.connectionManager.logoutAdmin()" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    border: 2px solid #000;
                ">Logout</button>
            </div>
            
            <div style="margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px;">
                    <div style="text-align: center;">
                        <div style="font-size: 12px; color: #ccc;">Online Users</div>
                        <div id="adminUserCount" style="font-size: 24px; font-weight: bold; color: #28a745;">0</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 12px; color: #ccc;">Game Status</div>
                        <div id="adminGameStatus" style="font-size: 24px; font-weight: bold; color: #ffd700;">Idle</div>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="color: #ffd700; margin-bottom: 10px; font-size: 14px;">Game Controls</h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                    <button onclick="window.connectionManager.sendAdminCommand('start_game')" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 10px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        border: 2px solid #000;
                    ">▶ Start Game</button>
                    <button onclick="window.connectionManager.sendAdminCommand('pause_game')" style="
                        background: #ffc107;
                        color: #000;
                        border: none;
                        padding: 10px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        border: 2px solid #000;
                    ">⏸ Pause Game</button>
                    <button onclick="window.connectionManager.sendAdminCommand('reset_game')" style="
                        background: #dc3545;
                        color: white;
                        border: none;
                        padding: 10px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        border: 2px solid #000;
                    ">🔄 Reset Game</button>
                    <button onclick="window.connectionManager.sendAdminCommand('announce_winner')" style="
                        background: #17a2b8;
                        color: white;
                        border: none;
                        padding: 10px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        border: 2px solid #000;
                    ">🏆 Announce Winner</button>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="color: #ffd700; margin-bottom: 10px; font-size: 14px;">Broadcast Message</h4>
                <textarea id="broadcastMessage" placeholder="Type broadcast message..." style="
                    width: 100%;
                    padding: 10px;
                    border-radius: 6px;
                    border: 2px solid #000;
                    background: white;
                    color: #333;
                    font-size: 13px;
                    margin-bottom: 10px;
                    min-height: 60px;
                    resize: vertical;
                "></textarea>
                <button onclick="window.connectionManager.sendBroadcast()" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 10px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    width: 100%;
                    border: 2px solid #000;
                ">📢 Send Broadcast</button>
            </div>
            
            <div>
                <h4 style="color: #ffd700; margin-bottom: 10px; font-size: 14px;">Connected Users</h4>
                <div id="adminUsersList" style="
                    max-height: 150px;
                    overflow-y: auto;
                    background: rgba(0,0,0,0.3);
                    padding: 10px;
                    border-radius: 6px;
                    font-size: 12px;
                ">
                    <div style="color: #888; text-align: center;">No users connected</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(adminPanel);
    }

    sendAdminCommand(command, data = {}) {
        if (!this.isAdmin || !this.adminToken) {
            this.showNotification('Not authenticated as admin', 'error');
            return;
        }
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showNotification('Not connected to server', 'error');
            return;
        }
        
        this.sendMessage({
            type: 'admin_command',
            command: command,
            token: this.adminToken,
            data: data,
            timestamp: Date.now()
        });
        
        console.log(`Admin command sent: ${command}`);
    }

    sendBroadcast() {
        const messageInput = document.getElementById('broadcastMessage');
        if (!messageInput) return;
        
        const message = messageInput.value.trim();
        if (!message) {
            this.showNotification('Please enter a message', 'error');
            return;
        }
        
        this.sendAdminCommand('broadcast_message', { message: message });
        messageInput.value = '';
    }

    logoutAdmin() {
        this.isAdmin = false;
        this.adminToken = null;
        
        const adminPanel = document.getElementById('adminControlPanel');
        if (adminPanel) {
            adminPanel.remove();
        }
        
        this.showNotification('Logged out from admin', 'info');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            animation: slideDown 0.3s ease;
            font-family: Arial, sans-serif;
            min-width: 300px;
            text-align: center;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Rest of the existing methods remain the same...
    updateUserList(users) {
        const userList = document.getElementById('userList');
        if (userList) {
            userList.innerHTML = users.map(user => `
                <div class="user-item" data-user-id="${user.id}">
                    <span>${user.username}</span>
                    <span class="status ${user.status}">${user.status}</span>
                </div>
            `).join('');
        }
        
        // Update admin panel if exists
        const adminUserCount = document.getElementById('adminUserCount');
        if (adminUserCount && users) {
            adminUserCount.textContent = users.length;
        }
        
        const adminUsersList = document.getElementById('adminUsersList');
        if (adminUsersList && users) {
            adminUsersList.innerHTML = users.map(user => `
                <div style="padding: 5px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: ${user.isAdmin ? '#ffd700' : 'white'}">${user.username}</span>
                        <span style="color: #ccc; font-size: 11px;">${user.ip}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    // ... Rest of the existing methods (updateGameState, handleNumberCalled, etc.)
    // Keep all your existing methods here, I'm just showing the critical changes

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, delay);
        }
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            message.timestamp = Date.now();
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not open. Message not sent:', message.type);
        }
    }

    // Setup event listeners
    setupEventListeners() {
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    setupRTCListeners() {
        // Your existing RTC setup code
    }

    cleanup() {
        // Cleanup connections
        if (this.ws) {
            this.ws.close();
        }
        this.cleanupRTCConnections();
    }

    cleanupRTCConnections() {
        this.rtcConnections.forEach((connection, userId) => {
            if (connection.pc) {
                connection.pc.close();
            }
            if (connection.stream) {
                connection.stream.getTracks().forEach(track => track.stop());
            }
        });
        this.rtcConnections.clear();
    }
}

// Initialize connection manager
const connectionManager = new ConnectionManager();
window.connectionManager = connectionManager;

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Start when page loads
window.addEventListener('DOMContentLoaded', () => {
    connectionManager.init();
    
    // Add admin login shortcut (Ctrl+Alt+A)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.key === 'a') {
            e.preventDefault();
            connectionManager.showAdminLoginModal();
        }
    });
    
    console.log('ConnectionManager initialized with URL:', connectionManager.wsUrl);
    console.log('Admin access: Add ?admin=true to URL or press Ctrl+Alt+A');
});
