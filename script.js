// WebSocket and RTC Manager for Bingo Game
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
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to server');
            this.reconnectAttempts = 0;
            this.sendMessage({
                type: 'user_join',
                userId: this.userId,
                username: this.username
            });
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
        }
    }

    handleMessage(data) {
        console.log('Received:', data);
        
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
        }
    }

    updateUserList(users) {
        // Update UI with connected users
        const userList = document.getElementById('userList');
        if (userList) {
            userList.innerHTML = users.map(user => `
                <div class="user-item" data-user-id="${user.id}">
                    <span>${user.username}</span>
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
    }

    handleWinnerAnnouncement(winner) {
        // Show winner notification
        alert(`Winner: ${winner.name} with ${winner.pattern}`);
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
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            stream.getTracks().forEach(track => {
                peerConnection.addTrack(track, stream);
            });
            
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
                document.getElementById('videoContainer').appendChild(remoteVideo);
            };
            
        } catch (error) {
            console.error('Error initiating RTC:', error);
        }
    }

    async handleRTCOffer(data) {
        try {
            const peerConnection = new RTCPeerConnection(this.peerConnectionConfig);
            
            // Add local stream if available
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            stream.getTracks().forEach(track => {
                peerConnection.addTrack(track, stream);
            });
            
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
                document.getElementById('videoContainer').appendChild(remoteVideo);
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
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    handleAdminCommand(command) {
        // Handle admin commands
        switch(command) {
            case 'start_game':
                console.log('Admin started new game');
                break;
            case 'pause_game':
                console.log('Admin paused game');
                break;
            case 'reset_game':
                console.log('Admin reset game');
                break;
        }
    }

    checkForWin() {
        // Check bingo patterns
        // Implementation depends on your bingo game logic
    }

    updateUI() {
        // Update game UI based on state
    }
}

// Initialize connection manager
const connectionManager = new ConnectionManager();
window.connectionManager = connectionManager;

// Start when page loads
window.addEventListener('DOMContentLoaded', () => {
    connectionManager.init();
});