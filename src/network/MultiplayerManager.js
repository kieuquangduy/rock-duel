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

    // Reliable messaging tracking
    this.pendingAcks = new Map(); // msgId -> { timer, retriesLeft, packet }
    this.processedMsgIds = new Set(); // Set of processed msgIds for deduplication
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
      // Connect to high-speed public WSS broker
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

          // Subscribe with QoS 1 for reliable delivery of critical packets
          this.client.subscribe(this.topic, { qos: 1 }, (err) => {
            if (err) {
              this.onError(err);
              reject(err);
              return;
            }

            // Broadcast presence
            this.send({ type: 'PRESENCE', isHost: this.isHost }, 1);
            resolve(this.roomId);
          });
        });

        this.client.on('message', (topic, payload) => {
          try {
            const data = JSON.parse(payload.toString());
            // Ignore messages from self
            if (data.senderId === this.clientId) return;

            // 1. Check if this is an ACK for one of our reliable sent packets
            if (data.type === 'ACK' && data.ackId) {
              if (this.pendingAcks.has(data.ackId)) {
                const entry = this.pendingAcks.get(data.ackId);
                clearInterval(entry.timer);
                this.pendingAcks.delete(data.ackId);
              }
              return;
            }

            // 2. If message requires acknowledgement (has msgId), reply with ACK immediately
            if (data.msgId) {
              this.send({ type: 'ACK', ackId: data.msgId }, 1);

              // Deduplication check: if already processed this exact message, stop here
              if (this.processedMsgIds.has(data.msgId)) {
                return;
              }
              this.processedMsgIds.add(data.msgId);
              // Bounded set to prevent memory growth
              if (this.processedMsgIds.size > 200) {
                const oldest = this.processedMsgIds.values().next().value;
                this.processedMsgIds.delete(oldest);
              }
            }

            // 3. Connection state detection
            if (!this.peerConnected) {
              this.peerConnected = true;
              this.onStatus('Đã kết nối với bạn bè! Đang vào game...');
              this.onConnected({ isHost: this.isHost, roomId: this.roomId });
            }

            // 4. Reply to presence
            if (data.type === 'PRESENCE') {
              this.send({ type: 'PRESENCE_REPLY', isHost: this.isHost }, 1);
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

  /**
   * Standard fire-and-forget send (used for 20Hz PEEK telemetry)
   */
  send(data, qos = 0) {
    if (this.client && this.client.connected && this.topic) {
      try {
        const payload = JSON.stringify({
          senderId: this.clientId,
          ...data,
        });
        this.client.publish(this.topic, payload, { qos });
      } catch (e) {
        console.error('MQTT publish error:', e);
      }
    }
  }

  /**
   * Guaranteed reliable send with auto-retry and ACK verification.
   * Perfect for HIT_CONFIRMED, ROUND_RESET, START_GAME.
   */
  sendReliable(data, maxRetries = 15, retryInterval = 120) {
    if (!this.client || !this.client.connected || !this.topic) return;

    const msgId = `${this.clientId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const packet = {
      senderId: this.clientId,
      ...data,
      msgId,
      timestamp: Date.now(),
    };

    const payload = JSON.stringify(packet);

    // 1. Send first attempt immediately with QoS 1
    this.client.publish(this.topic, payload, { qos: 1 });

    // 2. Set up retry interval until ACK is received or maxRetries reached
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (attempts >= maxRetries || !this.pendingAcks.has(msgId)) {
        clearInterval(timer);
        this.pendingAcks.delete(msgId);
        return;
      }

      if (this.client && this.client.connected && this.topic) {
        this.client.publish(this.topic, payload, { qos: 1 });
      }
    }, retryInterval);

    this.pendingAcks.set(msgId, { timer, packet });
    return msgId;
  }

  clearAllRetries() {
    for (const [msgId, entry] of this.pendingAcks.entries()) {
      clearInterval(entry.timer);
    }
    this.pendingAcks.clear();
  }

  destroy() {
    this.clearAllRetries();
    this.peerConnected = false;
    if (this.client) {
      try {
        this.client.end(true);
      } catch (e) {}
      this.client = null;
    }
  }
}
