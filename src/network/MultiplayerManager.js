import Peer from 'peerjs';

export class MultiplayerManager {
  constructor(options = {}) {
    this.onConnected = options.onConnected || (() => {});
    this.onDisconnected = options.onDisconnected || (() => {});
    this.onData = options.onData || (() => {});
    this.onError = options.onError || (() => {});

    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.roomId = null;
  }

  // Generate a friendly 5-character room code (e.g., DUEL-4K9B)
  generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'DUEL-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Create Room as Host
  createRoom(customRoomId = null) {
    this.isHost = true;
    this.roomId = customRoomId || this.generateRoomId();

    return new Promise((resolve, reject) => {
      try {
        // Use PeerJS free public cloud broker
        this.peer = new Peer(this.roomId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          this.roomId = id;
          resolve(id);
        });

        this.peer.on('connection', (connection) => {
          this.conn = connection;
          this.setupConnection();
        });

        this.peer.on('error', (err) => {
          // If room ID is taken, fallback to auto generated
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
    this.roomId = targetRoomId.toUpperCase().trim();

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer({
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });

        this.peer.on('open', () => {
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

    this.conn.on('open', () => {
      this.onConnected({ isHost: this.isHost, roomId: this.roomId });
    });

    this.conn.on('data', (data) => {
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
      this.conn.send(data);
    }
  }

  destroy() {
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
