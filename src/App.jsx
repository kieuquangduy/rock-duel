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

  // UI & Match states
  const [inGame, setInGame] = useState(false);
  const [isBotMode, setIsBotMode] = useState(true);
  const [mapDistance, setMapDistance] = useState(35); // Default 35m (Vừa)
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
  const startGame = (botMode = true, distance = mapDistance) => {
    clearHandshake();
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
          if (!botMode && networkRef.current) {
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

    if (!isBotMode && networkRef.current) {
      networkRef.current.send({
        type: 'HIT',
        isHeadshot: killInfo.isHeadshot,
        distance: killInfo.distance,
      });
    }

    setTimeout(() => {
      nextRound();
    }, 2600);
  };

  const handleRoundLost = (hitInfo) => {
    setRoundStatus('LOSS');
    setRoundMessage(`${hitInfo.killer || 'Đối thủ'} đã hạ gục bạn!`);
    setScores((prev) => ({ ...prev, opponent: prev.opponent + 1 }));

    setTimeout(() => {
      nextRound();
    }, 2600);
  };

  const nextRound = () => {
    setRoundStatus(null);
    if (engineRef.current) {
      engineRef.current.resetRound();
    }
    if (!isBotMode && networkRef.current) {
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
        // Host sends START_GAME periodically every 300ms until match starts
        clearHandshake();
        handshakeInterval.current = setInterval(() => {
          net.send({ type: 'START_GAME', distance: mapDistance });
        }, 300);

        startGame(false, mapDistance);
      },
      onDisconnected: () => {
        setNetworkError('Bạn bè đã ngắt kết nối!');
        handleExitMatch();
      },
      onData: (data) => {
        handleNetworkData(data);
      },
      onError: (err) => {
        setNetworkError('Lỗi kết nối phòng: ' + (err.message || 'Thử lại'));
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
        // Client sends CLIENT_HELLO every 300ms until START_GAME arrives
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
        setNetworkError('Không tìm thấy phòng hoặc mã phòng sai!');
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

  // Manual Force Start button if user doesn't want to wait
  const handleForceStart = () => {
    clearHandshake();
    if (networkRef.current) {
      networkRef.current.send({ type: 'START_GAME', distance: mapDistance });
    }
    startGame(false, mapDistance);
  };

  const handleNetworkData = (data) => {
    if (!data) return;

    switch (data.type) {
      case 'CLIENT_HELLO':
        if (networkRef.current?.isHost) {
          networkRef.current.send({ type: 'START_GAME', distance: mapDistance });
          if (!inGame) {
            startGame(false, mapDistance);
          }
        }
        break;

      case 'START_GAME':
        clearHandshake();
        if (networkRef.current) {
          networkRef.current.send({ type: 'START_ACK' });
        }
        setMapDistance(data.distance);
        if (!inGame) {
          startGame(false, data.distance);
        }
        break;

      case 'START_ACK':
        clearHandshake();
        if (!inGame) {
          startGame(false, mapDistance);
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

      case 'HIT':
        if (engineRef.current && engineRef.current.isAlive) {
          engineRef.current.isAlive = false;
          sounds.playDefeat();
          handleRoundLost({ killer: 'Đối thủ' });
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
