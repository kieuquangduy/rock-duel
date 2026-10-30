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

  // UI & Match states
  const [inGame, setInGame] = useState(false);
  const [isBotMode, setIsBotMode] = useState(true);
  const [mapDistance, setMapDistance] = useState(35); // Default 35m (Vừa)
  const [scores, setScores] = useState({ player: 0, opponent: 0 });

  // In-game real-time HUD states
  const [isAiming, setIsAiming] = useState(false);
  const [isCovered, setIsCovered] = useState(true);
  const [canShoot, setCanShoot] = useState(true);
  const [peekOffset, setPeekOffset] = useState({ x: 0, y: 0 });
  const [muted, setMuted] = useState(false);

  // Round victory/defeat notification
  const [roundStatus, setRoundStatus] = useState(null); // 'WIN' | 'LOSS' | null
  const [roundMessage, setRoundMessage] = useState('');

  // Multiplayer Lobby states
  const [roomId, setRoomId] = useState('');
  const [isWaitingForPeer, setIsWaitingForPeer] = useState(false);
  const [networkError, setNetworkError] = useState('');

  // Auto-detect room parameter from URL (?room=DUEL-XXXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      handleJoinRoom(roomParam);
    }
  }, []);

  // Sync loop: send continuous peek & aim to remote player at 60Hz
  useEffect(() => {
    if (!inGame || isBotMode || !networkRef.current) return;

    const interval = setInterval(() => {
      if (engineRef.current && networkRef.current) {
        const offset = engineRef.current.peekOffset;
        const aiming = engineRef.current.isAiming;

        setPeekOffset({ x: offset.x, y: offset.y });
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

  // Launch the 3D Game Engine
  const startGame = (botMode = true, distance = mapDistance) => {
    setIsBotMode(botMode);
    setInGame(true);
    setScores({ player: 0, opponent: 0 });
    setRoundStatus(null);

    setTimeout(() => {
      if (!containerRef.current) return;

      if (engineRef.current) {
        engineRef.current.destroy();
      }

      engineRef.current = new GameEngine(containerRef.current, {
        mapDistance: distance,
        isBotMode: botMode,
        onCoverChange: (covered) => {
          setIsCovered(covered);
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

  // When local player scores a kill
  const handleRoundWon = (killInfo) => {
    setRoundStatus('WIN');
    const msg = killInfo.isHeadshot
      ? `BẮN TRÚNG ĐẦU! (HEADSHOT • ${killInfo.distance}m)`
      : `Bắn trúng đối thủ • ${killInfo.distance}m`;
    setRoundMessage(msg);

    setScores((prev) => {
      const newPlayerScore = prev.player + 1;
      if (newPlayerScore >= 3) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
      return { ...prev, player: newPlayerScore };
    });

    if (!isBotMode && networkRef.current) {
      networkRef.current.send({
        type: 'HIT',
        isHeadshot: killInfo.isHeadshot,
        distance: killInfo.distance,
      });
    }

    // Auto next round after 2.8s
    setTimeout(() => {
      nextRound();
    }, 2800);
  };

  // When local player gets hit
  const handleRoundLost = (hitInfo) => {
    setRoundStatus('LOSS');
    setRoundMessage(`${hitInfo.killer || 'Đối thủ'} đã hạ gục bạn!`);

    setScores((prev) => ({ ...prev, opponent: prev.opponent + 1 }));

    // Auto next round after 2.8s
    setTimeout(() => {
      nextRound();
    }, 2800);
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
      onConnected: () => {
        setIsWaitingForPeer(false);
        // Both players start game on current map distance
        net.send({ type: 'START_GAME', distance: mapDistance });
        startGame(false, mapDistance);
      },
      onDisconnected: () => {
        setNetworkError('Bạn bè đã ngắt kết nối!');
        setInGame(false);
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
      setNetworkError('Không thể tạo phòng. Vui lòng thử lại!');
      setIsWaitingForPeer(false);
    }
  };

  // Multiplayer: Join Room
  const handleJoinRoom = async (targetId) => {
    setNetworkError('');
    setIsWaitingForPeer(true);

    const net = new MultiplayerManager({
      onConnected: () => {
        setIsWaitingForPeer(false);
      },
      onDisconnected: () => {
        setNetworkError('Mất kết nối với chủ phòng!');
        setInGame(false);
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

  // Receive network packets from peer
  const handleNetworkData = (data) => {
    if (!data) return;

    switch (data.type) {
      case 'START_GAME':
        setMapDistance(data.distance);
        startGame(false, data.distance);
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
        // Opponent says they hit us
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
    <div className="relative w-screen h-screen bg-stone-950 overflow-hidden cursor-crosshair">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* In-Game Heads-Up Display */}
      {inGame && (
        <HUD
          isAiming={isAiming}
          isCovered={isCovered}
          canShoot={canShoot}
          peekOffset={peekOffset}
          scores={scores}
          mapDistance={mapDistance}
          roundStatus={roundStatus}
          roundMessage={roundMessage}
          isHost={networkRef.current?.isHost}
          isBotMode={isBotMode}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Main Menu & Lobby Overlay */}
      {!inGame && (
        <Lobby
          onStartSolo={() => startGame(true, mapDistance)}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          selectedMap={mapDistance}
          onSelectMap={(dist) => {
            setMapDistance(dist);
            if (networkRef.current?.isHost) {
              networkRef.current.send({ type: 'MAP_SELECT', distance: dist });
            }
          }}
          roomId={roomId}
          isWaitingForPeer={isWaitingForPeer}
          error={networkError}
        />
      )}
    </div>
  );
}
