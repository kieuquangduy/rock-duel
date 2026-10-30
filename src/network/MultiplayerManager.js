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
    this.handshakeInterval = null;
  }

  // Generate a clean lowercase 6-character room code (e.g. duel4k8b)
  generateRoomId() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = 'duel';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  getIceConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ]
    };
  }

  // Create Room as Host
  createRoom(customRoomId = null) {
    this.isHost = true;
    this.roomId = (customRoomId || this.generateRoomId()).toLowerCase().trim();

    return new Promise((resolve, reject) => {
      try {
        this.onStatus('Đang đăng ký phòng với máy chủ...');
        this.peer = new Peer(this.roomId, {
          debug: 1,
          config: this.getIceConfig()
        });

        this.peer.on('open', (id) => {
          this.roomId = id;
          this.onStatus('Phòng sẵn sàng. Đang đợi bạn bè kết nối...');
          resolve(id);
        });

        this.peer.on('connection', (connection) => {
          this.conn = connection;
          this.onStatus('Phát hiện kết nối từ bạn bè! Đang bắt tay...');
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

  // Join Room as Client
  joinRoom(targetRoomId) {
    this.isHost = false;
    this.roomId = targetRoomId.toLowerCase().trim();

    return new Promise((resolve, reject) => {
      try {
        this.onStatus('Đang khởi tạo kết nối P2P...');
        this.peer = new Peer({
          debug: 1,
          config: this.getIceConfig()
        });

        this.peer.on('open', () => {
          this.onStatus(`Đang kết nối vào phòng ${this.roomId}...`);
          this.conn = this.peer.connect(this.roomId, {
            reliable: true,
          });
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
      this.onStatus('Kết nối thành công! Đang vào trận...');
      this.onConnected({ isHost: this.isHost, roomId: this.roomId });

      // If client, start periodic handshake ping until host responds with START_GAME
      if (!this.isHost) {
        this.send({ type: 'CLIENT_HELLO' });
        this.handshakeInterval = setInterval(() => {
          this.send({ type: 'CLIENT_HELLO' });
        }, 400);
      }
    };

    // Check if data channel is already open or wait for 'open' event
    if (this.conn.open) {
      handleConnected();
    } else {
      this.conn.on('open', handleConnected);
    }

    this.conn.on('data', (data) => {
      // Clear client handshake interval when host responds
      if (this.handshakeInterval && (data.type === 'START_GAME' || data.type === 'HOST_READY')) {
        clearInterval(this.handshakeInterval);
        this.handshakeInterval = null;
      }
      this.onData(data);
    });

    this.conn.on('close', () => {
      this.stopHandshake();
      this.onDisconnected();
    });

    this.conn.on('error', (err) => {
      this.stopHandshake();
      this.onError(err);
    });
  }

  stopHandshake() {
    if (this.handshakeInterval) {
      clearInterval(this.handshakeInterval);
      this.handshakeInterval = null;
    }
  }

  send(data) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(data);
      } catch (e) {
        console.error('Error sending data:', e);
      }
    }
  }

  destroy() {
    this.stopHandshake();
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
