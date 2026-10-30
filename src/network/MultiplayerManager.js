import mqtt from 'mqtt';

export class MultiplayerManager {
  constructor(options = {}) {
    this.onConnected = options.onConnected || (() => {});
    this.onDisconnected = options.onDisconnected || (() => {});
    this.onData = options.onData || (() => {});
    this.onError = options.onError || (() => {});
    this.onStatus = options.onStatus || (() => {});

    this.clientId = 'p_' + Math.random().toString(36).substring(2, 9);
    this.client = null;
    this.roomId = null;
    this.isHost = false;
    this.topic = null;
    this.peerConnected = false;
  }

  generateRoomId() {
    const chars = '23456789abcdefghjkmnpqrstuvwxyz';
    let code = 'duel';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  createRoom(customRoomId = null) {
    this.isHost = true;
    this.roomId = (customRoomId || this.generateRoomId()).toLowerCase().trim();
    return this.connect();
  }

  joinRoom(targetRoomId) {
    this.isHost = false;
    this.roomId = targetRoomId.toLowerCase().trim();
    return this.connect();
  }

  connect() {
    this.topic = `rockduel/room/${this.roomId}`;
    this.onStatus('Đang kết nối tới máy chủ phòng...');

    return new Promise((resolve, reject) => {
      // Connect to high-speed public WSS broker (Zero port blocks, works across all 4G/WiFi)
      const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';

      try {
        this.client = mqtt.connect(brokerUrl, {
          clientId: this.clientId,
          clean: true,
          connectTimeout: 10000,
          reconnectPeriod: 2500,
        });

        this.client.on('connect', () => {
          this.onStatus(this.isHost ? 'Phòng đã mở! Đang chờ bạn bè kết nối...' : `Đang vào phòng ${this.roomId}...`);

          this.client.subscribe(this.topic, { qos: 0 }, (err) => {
            if (err) {
              this.onError(err);
              reject(err);
              return;
            }

            // Broadcast presence
            this.send({ type: 'PRESENCE', isHost: this.isHost });
            resolve(this.roomId);
          });
        });

        this.client.on('message', (topic, payload) => {
          try {
            const data = JSON.parse(payload.toString());
            // Ignore messages from self
            if (data.senderId === this.clientId) return;

            // When receiving any message from peer, mark peer as connected
            if (!this.peerConnected) {
              this.peerConnected = true;
              this.onStatus('Đã kết nối với bạn bè! Đang vào game...');
              this.onConnected({ isHost: this.isHost, roomId: this.roomId });
            }

            // If peer announced presence, reply so they know we are ready
            if (data.type === 'PRESENCE') {
              this.send({ type: 'PRESENCE_REPLY', isHost: this.isHost });
            }

            this.onData(data);
          } catch (e) {
            console.error('Error processing network packet:', e);
          }
        });

        this.client.on('error', (err) => {
          this.onError(err);
        });
      } catch (err) {
        this.onError(err);
        reject(err);
      }
    });
  }

  send(data) {
    if (this.client && this.client.connected && this.topic) {
      try {
        const payload = JSON.stringify({
          senderId: this.clientId,
          ...data,
        });
        this.client.publish(this.topic, payload, { qos: 0 });
      } catch (e) {
        console.error('MQTT publish error:', e);
      }
    }
  }

  destroy() {
    this.peerConnected = false;
    if (this.client) {
      try {
        this.client.end(true);
      } catch (e) {}
      this.client = null;
    }
  }
}
