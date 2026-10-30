import Peer from 'peerjs';

export class MultiplayerManager {
  constructor(options = {}) {
    this.onConnected = options.onConnected || (() => {});
    this.onDisconnected = options.onDisconnected || (() => {});
    this.onData = options.onData || (() => {});
    this.onError = options.onError || (() => {});
    this.onStatus = options.onStatus || (() => {});

    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.roomId = null;
  }

  generateRoomId() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = 'duel';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Full STUN + Free Public TURN Relay for 100% NAT/CGNAT Traversal
  getIceConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        // OpenRelay Project Free TURN Servers (Traverses 4G, Mobile, CGNAT)
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
    };
  }

  createRoom(customRoomId = null) {
    this.isHost = true;
    this.roomId = (customRoomId || this.generateRoomId()).toLowerCase().trim();

    return new Promise((resolve, reject) => {
      try {
        this.onStatus('Đang đăng ký phòng...');
        this.peer = new Peer(this.roomId, {
          debug: 1,
          config: this.getIceConfig(),
        });

        this.peer.on('open', (id) => {
          this.roomId = id;
          this.onStatus('Phòng sẵn sàng. Đang chờ bạn bè kết nối...');
          resolve(id);
        });

        this.peer.on('connection', (connection) => {
          this.conn = connection;
          this.onStatus('Phát hiện bạn bè! Đang vào trận ngay...');
          this.setupConnection();
        });

        this.peer.on('error', (err) => {
          if (err.type === 'unavailable-id') {
            const fallbackId = this.generateRoomId() + Math.floor(Math.random() * 10);
            this.createRoom(fallbackId).then(resolve).catch(reject);
            return;
          }
          this.onError(err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  joinRoom(targetRoomId) {
    this.isHost = false;
    this.roomId = targetRoomId.toLowerCase().trim();

    return new Promise((resolve, reject) => {
      try {
        this.onStatus('Đang kết nối tới phòng...');
        this.peer = new Peer({
          debug: 1,
          config: this.getIceConfig(),
        });

        this.peer.on('open', () => {
          this.onStatus(`Đang vào phòng ${this.roomId}...`);
          // Note: DO NOT pass { reliable: true } which is deprecated and causes stalls!
          this.conn = this.peer.connect(this.roomId);
          this.setupConnection();
          resolve(this.roomId);
        });

        this.peer.on('error', (err) => {
          this.onError(err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  setupConnection() {
    if (!this.conn) return;

    let hasConnected = false;

    const handleConnected = () => {
      if (hasConnected) return;
      hasConnected = true;
      this.onStatus('Kết nối thành công! Đang vào game...');
      this.onConnected({ isHost: this.isHost, roomId: this.roomId });
    };

    // If channel is already open
    if (this.conn.open) {
      handleConnected();
    } else {
      this.conn.on('open', handleConnected);
    }

    // Direct RTCPeerConnection monitoring in case 'open' event is delayed
    if (this.conn.peerConnection) {
      this.conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
        const state = this.conn?.peerConnection?.iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          handleConnected();
        }
      });
    }

    // Receiving any data proves connection is live!
    this.conn.on('data', (data) => {
      handleConnected();
      this.onData(data);
    });

    this.conn.on('close', () => {
      this.onDisconnected();
    });

    this.conn.on('error', (err) => {
      this.onError(err);
    });
  }

  send(data) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(data);
      } catch (e) {
        console.error('Send error:', e);
      }
    }
  }

  destroy() {
    if (this.conn) {
      try {
        this.conn.close();
      } catch (e) {}
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
  }
}
