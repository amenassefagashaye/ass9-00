// WebSocket and RTC Manager for Bingo Game - UPDATED WITH PROVIDED URL
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
        this.wsUrl = 'wss://ameng-gogs-ass9-01-30.deno.dev/'; // Your provided WebSocket URL
    }

    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.setupRTCListeners();
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
            
            // If it's admin page, automatically try to authenticate
            if (window.location.pathname.includes('/admin')) {
                this.handleAdminAutoAuth();
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

    // Handle admin auto-authentication if on admin page
    handleAdminAutoAuth() {
        // Check if we have a saved token or need to prompt for password
        const savedToken = localStorage.getItem('admin_token');
        if (savedToken) {
            // Verify token is still valid
            const tokenData = JSON.parse(localStorage.getItem('admin_token_data') || '{}');
            if (tokenData.expires > Date.now()) {
                this.sendMessage({
                    type: 'admin_auth',
                    token: savedToken,
                    timestamp: Date.now()
                });
                return;
            }
        }
        
        // If no valid token, check if password is in URL or show prompt
        const urlParams = new URLSearchParams(window.location.search);
        const password = urlParams.get('password');
        
        if (password) {
            this.sendMessage({
                type: 'admin_auth',
                password: password,
                timestamp: Date.now()
            });
        } else {
            // Show password prompt
            const adminPassword = prompt('Enter admin password:');
            if (adminPassword) {
                this.sendMessage({
                    type: 'admin_auth',
                    password: adminPassword,
                    timestamp: Date.now()
                });
            }
        }
    }

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
            console.warn('WebSocket not open. Message not sent:', message);
            // Queue message for when connection re-establishes
            setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify(message));
                }
            }, 1000);
        }
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
        if (data.success) {
            console.log('Authentication successful');
            if (data.token) {
                // Save token for future sessions
                localStorage.setItem('admin_token', data.token);
                localStorage.setItem('admin_token_data', JSON.stringify({
                    expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
                }));
            }
            
            // If we're on admin page, show admin interface
            if (window.location.pathname.includes('/admin')) {
                this.showAdminInterface();
            }
        } else {
            console.error('Authentication failed:', data.message);
            // Show error on admin page
            if (window.location.pathname.includes('/admin')) {
                alert('Authentication failed: ' + (data.message || 'Invalid password'));
                this.handleAdminAutoAuth(); // Retry
            }
        }
    }

    showAdminInterface() {
        // This function would show the admin dashboard
        console.log('Showing admin interface');
        // You can implement this based on your HTML structure
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
        });
    }

    updateUserList(users) {
        // Update UI with connected users
        const userList = document.getElementById('userList');
        if (userList) {
            userList.innerHTML = users.map(user => `
                <div class="user-item" data-user-id="${user.id}">
                    <span>${user.username}</span>
                    <span class="status ${user.status}">${user.status}</span>
                    <button onclick="connectionManager.initiateRTC('${user.id}')">Video Call</button>
                </div>
            `).join('');
        }
    }

    updateGameState(state) {
        // Update game state in UI
        window.gameState = { ...window.gameState, ...state };
        this.updateUI();
    }

    handleNumberCalled(number) {
        // Mark number on bingo card
        const cell = document.querySelector(`[data-number="${number}"]`);
        if (cell && !cell.classList.contains('marked')) {
            cell.classList.add('marked');
            this.checkForWin();
        }
        
        // Also update called numbers display
        const calledNumbersBar = document.getElementById('calledNumbersBar');
        if (calledNumbersBar) {
            const numberSpan = document.createElement('span');
            numberSpan.className = 'called-number';
            numberSpan.textContent = number;
            calledNumbersBar.prepend(numberSpan);
            
            // Keep only last 8 numbers
            while (calledNumbersBar.children.length > 8) {
                calledNumbersBar.removeChild(calledNumbersBar.lastChild);
            }
        }
    }

    handleWinnerAnnouncement(winner) {
        // Show winner notification
        alert(`🎉 Winner: ${winner.name} with ${winner.pattern}`);
    }

    // RTC Functions
    setupRTCListeners() {
        window.addEventListener('beforeunload', () => {
            this.cleanupRTCConnections();
            this.sendMessage({
                type: 'user_leave',
                userId: this.userId
            });
        });
    }

    async initiateRTC(targetUserId) {
        try {
            const peerConnection = new RTCPeerConnection(this.peerConnectionConfig);
            
            // Add local stream if available
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                
                stream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, stream);
                });
            } catch (mediaError) {
                console.warn('Could not get media devices:', mediaError);
            }
            
            // Store connection
            this.rtcConnections.set(targetUserId, {
                pc: peerConnection,
                stream: stream
            });
            
            // Create offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            // Send offer to target user via WebSocket
            this.sendMessage({
                type: 'rtc_offer',
                targetUserId: targetUserId,
                offer: offer,
                fromUserId: this.userId
            });
            
            // Setup ICE candidate handling
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.sendMessage({
                        type: 'ice_candidate',
                        targetUserId: targetUserId,
                        candidate: event.candidate,
                        fromUserId: this.userId
                    });
                }
            };
            
            // Handle incoming stream
            peerConnection.ontrack = (event) => {
                const remoteVideo = document.createElement('video');
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.autoplay = true;
                remoteVideo.controls = true;
                remoteVideo.style.width = '200px';
                remoteVideo.style.margin = '10px';
                
                const videoContainer = document.getElementById('videoContainer') || (() => {
                    const container = document.createElement('div');
                    container.id = 'videoContainer';
                    container.style.position = 'fixed';
                    container.style.bottom = '20px';
                    container.style.right = '20px';
                    container.style.zIndex = '1000';
                    document.body.appendChild(container);
                    return container;
                })();
                
                videoContainer.appendChild(remoteVideo);
            };
            
        } catch (error) {
            console.error('Error initiating RTC:', error);
        }
    }

    async handleRTCOffer(data) {
        try {
            const peerConnection = new RTCPeerConnection(this.peerConnectionConfig);
            
            // Add local stream if available
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                
                stream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, stream);
                });
            } catch (mediaError) {
                console.warn('Could not get media devices:', mediaError);
            }
            
            // Store connection
            this.rtcConnections.set(data.fromUserId, {
                pc: peerConnection,
                stream: stream
            });
            
            // Set remote description
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            // Create answer
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            // Send answer
            this.sendMessage({
                type: 'rtc_answer',
                targetUserId: data.fromUserId,
                answer: answer,
                fromUserId: this.userId
            });
            
            // Setup ICE candidate handling
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.sendMessage({
                        type: 'ice_candidate',
                        targetUserId: data.fromUserId,
                        candidate: event.candidate,
                        fromUserId: this.userId
                    });
                }
            };
            
            // Handle incoming stream
            peerConnection.ontrack = (event) => {
                const remoteVideo = document.createElement('video');
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.autoplay = true;
                remoteVideo.controls = true;
                remoteVideo.style.width = '200px';
                remoteVideo.style.margin = '10px';
                
                const videoContainer = document.getElementById('videoContainer') || (() => {
                    const container = document.createElement('div');
                    container.id = 'videoContainer';
                    container.style.position = 'fixed';
                    container.style.bottom = '20px';
                    container.style.right = '20px';
                    container.style.zIndex = '1000';
                    document.body.appendChild(container);
                    return container;
                })();
                
                videoContainer.appendChild(remoteVideo);
            };
            
        } catch (error) {
            console.error('Error handling RTC offer:', error);
        }
    }

    async handleRTCAnswer(data) {
        const connection = this.rtcConnections.get(data.fromUserId);
        if (connection && connection.pc) {
            await connection.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    }

    async handleICECandidate(data) {
        const connection = this.rtcConnections.get(data.fromUserId);
        if (connection && connection.pc) {
            try {
                await connection.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
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

    showBroadcast(message) {
        const notification = document.createElement('div');
        notification.className = 'broadcast-notification';
        notification.innerHTML = `
            <strong>📢 Broadcast:</strong> ${message}
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255,215,0,0.95);
            color: #333;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 2000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            animation: slideDown 0.3s ease;
        `;
        
        // Add CSS animation if not present
        if (!document.querySelector('#broadcast-animation')) {
            const style = document.createElement('style');
            style.id = 'broadcast-animation';
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
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    handleAdminCommand(command) {
        // Handle admin commands
        console.log('Admin command received:', command);
        
        switch(command) {
            case 'start_game':
                if (window.startNewGame) window.startNewGame();
                break;
            case 'pause_game':
                if (window.stopCalling) window.stopCalling();
                break;
            case 'reset_game':
                if (window.resetGame) window.resetGame();
                break;
            case 'announce_winner':
                if (window.announceWin) window.announceWin();
                break;
        }
    }

    checkForWin() {
        // Check bingo patterns
        // Implementation depends on your bingo game logic
        if (window.checkWinCondition) {
            return window.checkWinCondition();
        }
        return false;
    }

    updateUI() {
        // Update game UI based on state
        if (window.updateGameUI) {
            window.updateGameUI();
        }
    }
    
    // Helper method for admin authentication
    adminAuthenticate(password) {
        this.sendMessage({
            type: 'admin_auth',
            password: password,
            timestamp: Date.now()
        });
    }
}

// Initialize connection manager
const connectionManager = new ConnectionManager();
window.connectionManager = connectionManager;

// Start when page loads
window.addEventListener('DOMContentLoaded', () => {
    connectionManager.init();
    
    // Add global helper functions for bingo game integration
    window.connectToServer = () => connectionManager.connectWebSocket();
    window.sendGameMessage = (type, data) => connectionManager.sendMessage({ type, ...data });
    window.getConnectionStatus = () => connectionManager.ws ? connectionManager.ws.readyState : 'not_connected';
    
    console.log('ConnectionManager initialized with URL:', connectionManager.wsUrl);
});
