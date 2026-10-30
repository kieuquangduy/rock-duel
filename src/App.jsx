import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { GameEngine } from './game/GameEngine';
import { MultiplayerManager } from './network/MultiplayerManager';
import { HUD } from './components/HUD';
import { Lobby } from './components/Lobby';
import { sounds } from './audio/SoundEffects';

export default function App() {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const networkRef = useRef(null);
  const handshakeInterval = useRef(null);

  // References to avoid stale closures in callbacks
  const isBotModeRef = useRef(true);
  const inGameRef = useRef(false);
  const mapDistanceRef = useRef(35);

  // UI & Match states
  const [inGame, setInGame] = useState(false);
  const [isBotMode, setIsBotMode] = useState(true);
  const [mapDistance, setMapDistance] = useState(35);
  const [scores, setScores] = useState({ player: 0, opponent: 0 });

  // In-game real-time HUD states
  const [isAiming, setIsAiming] = useState(false);
  const [canShoot, setCanShoot] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [muted, setMuted] = useState(false);

  // Round victory/defeat notification
  const [roundStatus, setRoundStatus] = useState(null);
  const [roundMessage, setRoundMessage] = useState('');

  // Multiplayer Lobby states
  const [roomId, setRoomId] = useState('');
  const [isWaitingForPeer, setIsWaitingForPeer] = useState(false);
  const [networkStatus, setNetworkStatus] = useState('');
  const [networkError, setNetworkError] = useState('');

  useEffect(() => {
    isBotModeRef.current = isBotMode;
  }, [isBotMode]);

  useEffect(() => {
    inGameRef.current = inGame;
  }, [inGame]);

  useEffect(() => {
    mapDistanceRef.current = mapDistance;
  }, [mapDistance]);

  // Auto-detect room parameter from URL (?room=duelxxxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      handleJoinRoom(roomParam);
    }
  }, []);

  // Sync loop: send continuous lean & aim to remote player at 60Hz
  useEffect(() => {
    if (!inGame || isBotMode || !networkRef.current) return;

    const interval = setInterval(() => {
      if (engineRef.current && networkRef.current) {
        const offset = engineRef.current.peekOffset;
        const aiming = engineRef.current.isAiming;

        setIsAiming(aiming);

        networkRef.current.send({
          type: 'PEEK',
          peekX: offset.x,
          peekY: offset.y,
          isAiming: aiming,
        });
      }
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [inGame, isBotMode]);

  const clearHandshake = () => {
    if (handshakeInterval.current) {
      clearInterval(handshakeInterval.current);
      handshakeInterval.current = null;
    }
  };

  // Launch the 3D Game Engine
  const startGame = (botMode = true, distance = mapDistanceRef.current) => {
    clearHandshake();
    isBotModeRef.current = botMode;
    inGameRef.current = true;
    mapDistanceRef.current = distance;

    setIsBotMode(botMode);
    setInGame(true);
    setScores({ player: 0, opponent: 0 });
    setRoundStatus(null);
    setIsWaitingForPeer(false);

    setTimeout(() => {
      if (!containerRef.current) return;

      if (engineRef.current) {
        engineRef.current.destroy();
      }

      engineRef.current = new GameEngine(containerRef.current, {
        mapDistance: distance,
        isBotMode: botMode,
        onPointerLockChange: (locked) => {
          setIsLocked(locked);
        },
        onBoltState: (ready) => {
          setCanShoot(ready);
        },
        onShotFired: (shotData) => {
          if (!isBotModeRef.current && networkRef.current) {
            networkRef.current.send({
              type: 'SHOOT',
              ...shotData,
            });
          }
        },
        onKill: (killInfo) => {
          handleRoundWon(killInfo);
        },
        onHit: (hitInfo) => {
          handleRoundLost(hitInfo);
        },
      });
    }, 50);
  };

  // Exit Match and return to Lobby
  const handleExitMatch = () => {
    clearHandshake();
    isBotModeRef.current = true;
    inGameRef.current = false;

    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    if (networkRef.current) {
      networkRef.current.destroy();
      networkRef.current = null;
    }
    setInGame(false);
    setIsWaitingForPeer(false);
    setIsLocked(false);
    setRoomId('');
    setNetworkStatus('');
    setNetworkError('');
  };

  // When Local Player lands a killshot
  const handleRoundWon = (killInfo) => {
    setRoundStatus('WIN');
    const msg = killInfo.isHeadshot
      ? `BẮN TRÚNG ĐẦU! (HEADSHOT • ${killInfo.distance}m)`
      : `Bắn trúng đối thủ • ${killInfo.distance}m`;
    setRoundMessage(msg);

    setScores((prev) => {
      const newScore = prev.player + 1;
      if (newScore >= 3) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
      return { ...prev, player: newScore };
    });

    // Send authoritative HIT_CONFIRMED to remote player
    if (!isBotModeRef.current && networkRef.current) {
      networkRef.current.send({
        type: 'HIT_CONFIRMED',
        killerId: networkRef.current.clientId,
        isHeadshot: killInfo.isHeadshot,
        distance: killInfo.distance,
      });
    }

    setTimeout(() => {
      nextRound();
    }, 2800);
  };

  // When Local Player gets killed
  const handleRoundLost = (hitInfo) => {
    if (engineRef.current) {
      engineRef.current.isAlive = false;
      engineRef.current.canShoot = false;
    }

    setRoundStatus('LOSS');
    setRoundMessage(`${hitInfo.killer || 'Đối thủ'} đã hạ gục bạn!`);
    setScores((prev) => ({ ...prev, opponent: prev.opponent + 1 }));

    setTimeout(() => {
      nextRound();
    }, 2800);
  };

  const nextRound = () => {
    setRoundStatus(null);
    if (engineRef.current) {
      engineRef.current.resetRound();
    }
    if (!isBotModeRef.current && networkRef.current) {
      networkRef.current.send({ type: 'ROUND_RESET' });
    }
  };

  // Multiplayer: Create Room
  const handleCreateRoom = async () => {
    setNetworkError('');
    setIsWaitingForPeer(true);

    const net = new MultiplayerManager({
      onStatus: (msg) => setNetworkStatus(msg),
      onConnected: () => {
        clearHandshake();
        handshakeInterval.current = setInterval(() => {
          net.send({ type: 'START_GAME', distance: mapDistanceRef.current });
        }, 300);

        startGame(false, mapDistanceRef.current);
      },
      onDisconnected: () => {
        setNetworkError('Bạn bè đã ngắt kết nối!');
        handleExitMatch();
      },
      onData: (data) => {
        handleNetworkData(data);
      },
      onError: (err) => {
        setNetworkError('Lỗi kết nối: ' + (err.message || 'Thử lại'));
        setIsWaitingForPeer(false);
      },
    });

    networkRef.current = net;
    try {
      const id = await net.createRoom();
      setRoomId(id);
    } catch (err) {
      setNetworkError('Không thể tạo phòng. Thử lại sau!');
      setIsWaitingForPeer(false);
    }
  };

  // Multiplayer: Join Room
  const handleJoinRoom = async (targetId) => {
    setNetworkError('');
    setIsWaitingForPeer(true);

    const net = new MultiplayerManager({
      onStatus: (msg) => setNetworkStatus(msg),
      onConnected: () => {
        clearHandshake();
        handshakeInterval.current = setInterval(() => {
          net.send({ type: 'CLIENT_HELLO' });
        }, 300);
      },
      onDisconnected: () => {
        setNetworkError('Mất kết nối với chủ phòng!');
        handleExitMatch();
      },
      onData: (data) => {
        handleNetworkData(data);
      },
      onError: () => {
        setNetworkError('Không tìm thấy phòng!');
        setIsWaitingForPeer(false);
      },
    });

    networkRef.current = net;
    try {
      await net.joinRoom(targetId);
      setRoomId(targetId);
    } catch (err) {
      setNetworkError('Không thể kết nối vào phòng!');
      setIsWaitingForPeer(false);
    }
  };

  const handleForceStart = () => {
    clearHandshake();
    if (networkRef.current) {
      networkRef.current.send({ type: 'START_GAME', distance: mapDistanceRef.current });
    }
    startGame(false, mapDistanceRef.current);
  };

  const handleNetworkData = (data) => {
    if (!data) return;

    switch (data.type) {
      case 'CLIENT_HELLO':
        if (networkRef.current?.isHost) {
          networkRef.current.send({ type: 'START_GAME', distance: mapDistanceRef.current });
          if (!inGameRef.current) {
            startGame(false, mapDistanceRef.current);
          }
        }
        break;

      case 'START_GAME':
        clearHandshake();
        if (networkRef.current) {
          networkRef.current.send({ type: 'START_ACK' });
        }
        setMapDistance(data.distance);
        if (!inGameRef.current) {
          startGame(false, data.distance);
        }
        break;

      case 'START_ACK':
        clearHandshake();
        if (!inGameRef.current) {
          startGame(false, mapDistanceRef.current);
        }
        break;

      case 'PEEK':
        if (engineRef.current) {
          engineRef.current.syncRemotePlayer(data);
        }
        break;

      case 'SHOOT':
        if (engineRef.current) {
          engineRef.current.onRemoteShot(data);
        }
        break;

      // Authoritative Kill: Opponent confirmed they shot us!
      case 'HIT_CONFIRMED':
        if (engineRef.current && engineRef.current.isAlive) {
          engineRef.current.isAlive = false;
          engineRef.current.canShoot = false;
          sounds.playDefeat();
          handleRoundLost({
            killer: 'Đối thủ',
            isHeadshot: data.isHeadshot,
            distance: data.distance,
          });
        }
        break;

      case 'ROUND_RESET':
        setRoundStatus(null);
        if (engineRef.current) {
          engineRef.current.resetRound();
        }
        break;

      default:
        break;
    }
  };

  const handleToggleMute = () => {
    sounds.muted = !sounds.muted;
    setMuted(sounds.muted);
  };

  return (
    <div className={`relative w-screen h-screen bg-stone-950 overflow-hidden ${inGame ? 'cursor-none' : ''}`}>
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-none" />

      {/* In-Game Heads-Up Display */}
      {inGame && (
        <HUD
          isAiming={isAiming}
          canShoot={canShoot}
          scores={scores}
          mapDistance={mapDistance}
          roundStatus={roundStatus}
          roundMessage={roundMessage}
          isBotMode={isBotMode}
          isLocked={isLocked}
          muted={muted}
          onToggleMute={handleToggleMute}
          onExitMatch={handleExitMatch}
        />
      )}

      {/* Main Menu & Lobby Overlay */}
      {!inGame && (
        <Lobby
          onStartSolo={() => startGame(true, mapDistance)}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onForceStart={handleForceStart}
          selectedMap={mapDistance}
          onSelectMap={(dist) => {
            setMapDistance(dist);
            mapDistanceRef.current = dist;
            if (networkRef.current?.isHost) {
              networkRef.current.send({ type: 'MAP_SELECT', distance: dist });
            }
          }}
          roomId={roomId}
          isWaitingForPeer={isWaitingForPeer}
          networkStatus={networkStatus}
          error={networkError}
        />
      )}
    </div>
  );
}
