import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { GameEngine } from './game/GameEngine';
import { TankGameEngine } from './game/TankGameEngine';
import { MultiplayerManager } from './network/MultiplayerManager';
import { HUD } from './components/HUD';
import { TankHUD } from './components/TankHUD';
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
  const roundStatusRef = useRef(null);
  const selectedGameRef = useRef('rock'); // 'rock' | 'tank'

  // Game Selection: 'rock' (Rock Duel 1v1) or 'tank' (Tank Duel 1v1)
  const [selectedGame, setSelectedGame] = useState('rock');

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

  // Tank-specific states
  const [tankPlayerHp, setTankPlayerHp] = useState(1000);
  const [tankOpponentHp, setTankOpponentHp] = useState(1000);
  const [tankSpeed, setTankSpeed] = useState(0);
  const [tankGear, setTankGear] = useState('N');
  const [tankReloadProgress, setTankReloadProgress] = useState(1.0);

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

  useEffect(() => {
    roundStatusRef.current = roundStatus;
  }, [roundStatus]);

  useEffect(() => {
    selectedGameRef.current = selectedGame;
  }, [selectedGame]);

  // Auto-detect room & game parameters from URL (?room=duelxxxx&game=tank)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gameParam = params.get('game');
    if (gameParam === 'tank' || gameParam === 'rock') {
      setSelectedGame(gameParam);
      selectedGameRef.current = gameParam;
      setMapDistance(gameParam === 'tank' ? 50 : 35);
      mapDistanceRef.current = gameParam === 'tank' ? 50 : 35;
    }

    const roomParam = params.get('room');
    if (roomParam) {
      handleJoinRoom(roomParam);
    }
  }, []);

  // Sync loop: send telemetry to remote player at 20Hz (every 50ms)
  useEffect(() => {
    if (!inGame || isBotMode || !networkRef.current) return;

    const interval = setInterval(() => {
      // Only stream when game is actively running (no round win/loss banner) and player is alive
      if (engineRef.current && networkRef.current && !roundStatusRef.current && engineRef.current.isAlive) {
        if (selectedGameRef.current === 'tank') {
          // Tank Telemetry (Hull pos, rotation, speed, turret yaw, cannon pitch)
          const s = engineRef.current.playerTankState;
          if (s) {
            networkRef.current.send(
              {
                type: 'TANK_TELEMETRY',
                x: Math.round(s.pos.x * 100) / 100,
                z: Math.round(s.pos.z * 100) / 100,
                hullRotY: Math.round(s.hullRotY * 1000) / 1000,
                speed: Math.round(s.speed * 10) / 10,
                turretYaw: Math.round(s.turretYaw * 1000) / 1000,
                cannonPitch: Math.round(s.cannonPitch * 1000) / 1000,
              },
              0
            );
          }
        } else {
          // Rock Duel Telemetry (Lean peek and ADS aim)
          const offset = engineRef.current.peekOffset;
          const aiming = engineRef.current.isAiming;
          networkRef.current.send(
            {
              type: 'PEEK',
              peekX: Math.round(offset.x * 1000) / 1000,
              peekY: Math.round(offset.y * 1000) / 1000,
              isAiming: aiming,
            },
            0
          );
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [inGame, isBotMode]);

  const clearHandshake = () => {
    if (handshakeInterval.current) {
      clearInterval(handshakeInterval.current);
      handshakeInterval.current = null;
    }
  };

  // Launch the 3D Game Engine (Rock Duel or Tank Duel)
  const startGame = (
    botMode = true,
    distance = mapDistanceRef.current,
    gameToStart = selectedGameRef.current
  ) => {
    clearHandshake();
    isBotModeRef.current = botMode;
    inGameRef.current = true;
    mapDistanceRef.current = distance;
    selectedGameRef.current = gameToStart;

    setSelectedGame(gameToStart);
    setIsBotMode(botMode);
    setInGame(true);
    setScores({ player: 0, opponent: 0 });
    setRoundStatus(null);
    roundStatusRef.current = null;
    setIsWaitingForPeer(false);

    // Reset tank states
    setTankPlayerHp(1000);
    setTankOpponentHp(1000);
    setTankSpeed(0);
    setTankGear('N');
    setTankReloadProgress(1.0);
    setCanShoot(true);
    setIsAiming(false);

    setTimeout(() => {
      if (!containerRef.current) return;

      if (engineRef.current) {
        engineRef.current.destroy();
      }

      if (gameToStart === 'tank') {
        // --- 1. TANK DUEL 3D ENGINE ---
        engineRef.current = new TankGameEngine(containerRef.current, {
          mapDistance: distance,
          isBotMode: botMode,
          onPlayerHpChange: (hp) => setTankPlayerHp(hp),
          onOpponentHpChange: (hp) => setTankOpponentHp(hp),
          onReloadState: (ready, progress) => {
            setCanShoot(ready);
            setTankReloadProgress(progress);
          },
          onSpeedChange: (spd, gr) => {
            setTankSpeed(spd);
            setTankGear(gr);
          },
          onAimState: (aiming) => {
            setIsAiming(aiming);
          },
          onPointerLockChange: (locked) => {
            setIsLocked(locked);
          },
          onShotFired: (shotData) => {
            if (!isBotModeRef.current && networkRef.current) {
              networkRef.current.send(
                {
                  type: 'TANK_SHOOT',
                  ...shotData,
                },
                1
              );
            }
          },
          onKill: (killInfo) => {
            handleRoundWon(killInfo);
          },
          onHit: (hitInfo) => {
            handleRoundLost(hitInfo);
          },
        });
      } else {
        // --- 2. ROCK DUEL 3D ENGINE ---
        engineRef.current = new GameEngine(containerRef.current, {
          mapDistance: distance,
          isBotMode: botMode,
          onPointerLockChange: (locked) => {
            setIsLocked(locked);
          },
          onAimChange: (aiming) => {
            setIsAiming(aiming);
          },
          onBoltState: (ready) => {
            setCanShoot(ready);
          },
          onShotFired: (shotData) => {
            if (!isBotModeRef.current && networkRef.current) {
              networkRef.current.send(
                {
                  type: 'SHOOT',
                  ...shotData,
                },
                1
              );
            }
          },
          onKill: (killInfo) => {
            handleRoundWon(killInfo);
          },
          onHit: (hitInfo) => {
            handleRoundLost(hitInfo);
          },
        });
      }
    }, 60);
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
    if (roundStatusRef.current) return;

    setRoundStatus('WIN');
    roundStatusRef.current = 'WIN';

    const isTank = selectedGameRef.current === 'tank';
    const msg = isTank
      ? `BẮN NỔ CHIẾN TĂNG ĐỊCH! (${killInfo.distance || mapDistanceRef.current}m)`
      : killInfo.isHeadshot
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

    // Send authoritative HIT_CONFIRMED to remote player with auto-retry
    if (!isBotModeRef.current && networkRef.current) {
      networkRef.current.sendReliable({
        type: 'HIT_CONFIRMED',
        killerId: networkRef.current.clientId,
        isHeadshot: !!killInfo.isHeadshot,
        distance: killInfo.distance,
      });
    }

    // Winner authoritatively controls the round transition countdown
    setTimeout(() => {
      nextRoundAuthoritative();
    }, 3200);
  };

  // When Local Player gets killed
  const handleRoundLost = (hitInfo) => {
    if (roundStatusRef.current === 'WIN') return;

    if (engineRef.current) {
      engineRef.current.isAlive = false;
      engineRef.current.canShoot = false;
    }

    setRoundStatus('LOSS');
    roundStatusRef.current = 'LOSS';
    setRoundMessage(`${hitInfo.killer || 'Đối thủ'} đã hạ gục bạn!`);
    setScores((prev) => ({ ...prev, opponent: prev.opponent + 1 }));

    // In Bot mode, we reset locally
    if (isBotModeRef.current) {
      setTimeout(() => {
        nextRoundAuthoritative();
      }, 3200);
    } else {
      // Safety fallback: if ROUND_RESET packet from winner doesn't arrive within 4.8s
      setTimeout(() => {
        if (roundStatusRef.current === 'LOSS') {
          nextRoundAuthoritative();
        }
      }, 4800);
    }
  };

  const nextRoundAuthoritative = () => {
    setRoundStatus(null);
    roundStatusRef.current = null;
    if (engineRef.current) {
      engineRef.current.resetRound();
    }
    if (!isBotModeRef.current && networkRef.current) {
      networkRef.current.sendReliable({ type: 'ROUND_RESET' });
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
          net.sendReliable({
            type: 'START_GAME',
            gameType: selectedGameRef.current,
            distance: mapDistanceRef.current,
          });
        }, 350);

        startGame(false, mapDistanceRef.current, selectedGameRef.current);
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
          net.sendReliable({ type: 'CLIENT_HELLO' });
        }, 350);
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
      networkRef.current.sendReliable({
        type: 'START_GAME',
        gameType: selectedGameRef.current,
        distance: mapDistanceRef.current,
      });
    }
    startGame(false, mapDistanceRef.current, selectedGameRef.current);
  };

  const handleNetworkData = (data) => {
    if (!data) return;

    switch (data.type) {
      case 'CLIENT_HELLO':
        if (networkRef.current?.isHost) {
          networkRef.current.sendReliable({
            type: 'START_GAME',
            gameType: selectedGameRef.current,
            distance: mapDistanceRef.current,
          });
          if (!inGameRef.current) {
            startGame(false, mapDistanceRef.current, selectedGameRef.current);
          }
        }
        break;

      case 'START_GAME':
        clearHandshake();
        if (networkRef.current) {
          networkRef.current.sendReliable({ type: 'START_ACK' });
        }
        if (data.gameType) {
          setSelectedGame(data.gameType);
          selectedGameRef.current = data.gameType;
        }
        setMapDistance(data.distance);
        if (!inGameRef.current) {
          startGame(false, data.distance, data.gameType || selectedGameRef.current);
        }
        break;

      case 'START_ACK':
        clearHandshake();
        if (!inGameRef.current) {
          startGame(false, mapDistanceRef.current, selectedGameRef.current);
        }
        break;

      // Rock Duel telemetry
      case 'PEEK':
        if (engineRef.current && selectedGameRef.current === 'rock') {
          engineRef.current.syncRemotePlayer(data);
        }
        break;

      case 'SHOOT':
        if (engineRef.current && selectedGameRef.current === 'rock') {
          engineRef.current.onRemoteShot(data);
        }
        break;

      // Tank Duel telemetry
      case 'TANK_TELEMETRY':
        if (engineRef.current && selectedGameRef.current === 'tank') {
          engineRef.current.syncRemoteTank(data);
        }
        break;

      case 'TANK_SHOOT':
        if (engineRef.current && selectedGameRef.current === 'tank') {
          engineRef.current.onRemoteShot(data);
        }
        break;

      // Authoritative Kill: Opponent confirmed they shot us!
      case 'HIT_CONFIRMED':
        if (roundStatusRef.current !== 'WIN') {
          if (engineRef.current) {
            engineRef.current.isAlive = false;
            engineRef.current.canShoot = false;
          }
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
        roundStatusRef.current = null;
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

      {/* In-Game Heads-Up Display: Rock Duel */}
      {inGame && selectedGame === 'rock' && (
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

      {/* In-Game Heads-Up Display: Tank Duel */}
      {inGame && selectedGame === 'tank' && (
        <TankHUD
          playerHp={tankPlayerHp}
          opponentHp={tankOpponentHp}
          maxHp={1000}
          speed={tankSpeed}
          gear={tankGear}
          isAiming={isAiming}
          canShoot={canShoot}
          reloadProgress={tankReloadProgress}
          scores={scores}
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
          selectedGame={selectedGame}
          onSelectGame={(game) => {
            setSelectedGame(game);
            selectedGameRef.current = game;
            const defaultDist = game === 'tank' ? 50 : 35;
            setMapDistance(defaultDist);
            mapDistanceRef.current = defaultDist;
          }}
          onStartSolo={() => startGame(true, mapDistance, selectedGame)}
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
