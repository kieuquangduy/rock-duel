import React, { useState } from 'react';
import { Play, Users, Bot, Copy, Check, Target, Compass, Shield, Zap, Gauge } from 'lucide-react';

export function Lobby({
  selectedGame = 'rock',
  onSelectGame,
  onStartSolo,
  onCreateRoom,
  onJoinRoom,
  onForceStart,
  selectedMap,
  onSelectMap,
  roomId,
  isWaitingForPeer,
  networkStatus,
  error,
}) {
  const [inputRoomId, setInputRoomId] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('online');

  // Maps for Rock Duel
  const rockMaps = [
    {
      id: 18,
      name: 'Cự Ly Gần (18m)',
      desc: 'Phản xạ chớp nhoáng, mục tiêu lớn, đấu súng tốc độ cao',
      badge: 'Cận chiến',
    },
    {
      id: 35,
      name: 'Cự Ly Vừa (35m)',
      desc: 'Khoảng cách tiêu chuẩn, cân bằng giữa ẩn nấp và ngắm tỉa',
      badge: 'Tiêu chuẩn',
    },
    {
      id: 60,
      name: 'Cự Ly Xa (60m)',
      desc: 'Thử thách bắn tỉa cự ly xa, mục tiêu nhỏ, cần kiên nhẫn',
      badge: 'Bắn tỉa',
    },
  ];

  // Maps for Tank Duel
  const tankMaps = [
    {
      id: 35,
      name: 'Chiến Trường Hẹp (35m)',
      desc: 'Giao tranh tốc độ cao, né vật cản chớp nhoáng và đọ pháo',
      badge: 'Tốc chiến',
    },
    {
      id: 50,
      name: 'Chiến Trường Sa Mạc (50m)',
      desc: 'Địa hình cân bằng với chướng ngại vật bê tông và đá tự nhiên',
      badge: 'Tiêu chuẩn',
    },
    {
      id: 75,
      name: 'Bình Nguyên Rộng (75m)',
      desc: 'Khoảng cách lớn, cơ động đánh bọc sườn và ngắm bắn từ xa',
      badge: 'Chiến thuật',
    },
  ];

  const currentMaps = selectedGame === 'tank' ? tankMaps : rockMaps;

  const handleCopyLink = () => {
    if (!roomId) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPeerDetected =
    networkStatus.includes('Phát hiện') ||
    networkStatus.includes('kết nối') ||
    networkStatus.includes('thành công');

  return (
    <div className="fixed inset-0 bg-stone-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-xl bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-5 text-stone-200">
        
        {/* GAME SELECTOR HEADER TAB */}
        <div className="grid grid-cols-2 p-1.5 bg-stone-950 rounded-2xl border border-stone-800">
          <button
            onClick={() => {
              onSelectGame('rock');
              onSelectMap(35);
            }}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
              selectedGame === 'rock'
                ? 'bg-amber-500 text-stone-950 font-black shadow-lg shadow-amber-500/20'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Target size={18} />
            <span className="text-xs sm:text-sm uppercase tracking-wider">Đấu Súng Nấp Đá</span>
          </button>

          <button
            onClick={() => {
              onSelectGame('tank');
              onSelectMap(50);
            }}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
              selectedGame === 'tank'
                ? 'bg-amber-500 text-stone-950 font-black shadow-lg shadow-amber-500/20'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Shield size={18} />
            <span className="text-xs sm:text-sm uppercase tracking-wider">Đấu Xe Tăng 1v1</span>
          </button>
        </div>

        {/* Title Description */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
            {selectedGame === 'tank' ? (
              <>
                <Shield size={14} /> Chiến Đấu Xe Tăng 1v1 Thực Địa
              </>
            ) : (
              <>
                <Target size={14} /> Đấu Súng 1v1 Ẩn Nấp Sau Đá
              </>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-amber-300 tracking-wider">
            {selectedGame === 'tank' ? 'TANK DUEL' : 'ROCK DUEL'}
          </h1>
          <p className="text-stone-400 text-xs sm:text-sm mt-1">
            {selectedGame === 'tank'
              ? 'Lái xe tăng di chuyển thực địa • Xoay tháp pháo 360° ngắm bắn phá giáp đối thủ'
              : 'Phím A / D / W để ngó đầu ra khỏi đá • Chuột ngắm bắn tỉa đối thủ (1-hit 1-kill)'}
          </p>
        </div>

        {/* Online / Bot Mode Switcher */}
        <div className="grid grid-cols-2 p-1 bg-stone-950/80 rounded-2xl border border-stone-800 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('online')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
              activeTab === 'online'
                ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Users size={16} /> Đấu Online (2 Người)
          </button>
          <button
            onClick={() => setActiveTab('bot')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
              activeTab === 'bot'
                ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Bot size={16} /> Luyện Tập (Với Bot)
          </button>
        </div>

        {/* Map Selection */}
        <div>
          <label className="text-xs uppercase tracking-wider font-bold text-stone-400 mb-2 block">
            {selectedGame === 'tank' ? 'Chọn quy mô chiến trường xe tăng:' : 'Chọn cự ly giữa 2 tảng đá:'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {currentMaps.map((m) => (
              <button
                key={m.id}
                onClick={() => onSelectMap(m.id)}
                className={`p-3 rounded-2xl border text-left transition-all relative ${
                  selectedMap === m.id
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg'
                    : 'bg-stone-950/50 border-stone-800 text-stone-400 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-amber-300">{m.badge}</span>
                  <span className="text-[10px] text-stone-500 font-mono">{m.id}m</span>
                </div>
                <div className="text-xs font-semibold text-stone-200">{m.name}</div>
                <div className="text-[10px] text-stone-400 mt-1 line-clamp-2 leading-tight">
                  {m.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content: Online Mode */}
        {activeTab === 'online' && (
          <div className="flex flex-col gap-3">
            {!roomId && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onCreateRoom}
                  className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-amber-500/20"
                >
                  <Users size={18} /> Tạo Phòng Đấu Mới
                </button>
              </div>
            )}

            {roomId && isWaitingForPeer && (
              <div className="p-4 bg-stone-950/80 border border-amber-500/40 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">
                      Mã Phòng:
                    </div>
                    <div className="text-2xl font-black text-amber-300 font-mono tracking-widest">
                      {roomId}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-xs text-amber-300 font-medium">
                      {networkStatus || 'Đang đợi bạn kết nối...'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCopyLink}
                  className="w-full py-2.5 px-4 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-stone-700 transition-colors"
                >
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  {copied ? 'Đã sao chép link mời!' : 'Sao chép link gửi cho bạn bè'}
                </button>

                {isPeerDetected && (
                  <button
                    onClick={onForceStart}
                    className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all animate-bounce mt-1"
                  >
                    <Zap size={16} fill="currentColor" /> Vào Trận Ngay Lập Tức
                  </button>
                )}
              </div>
            )}

            {!roomId && (
              <div className="pt-2 border-t border-stone-800 flex flex-col gap-2">
                <label className="text-xs text-stone-400 font-semibold">
                  Hoặc nhập mã phòng để vào đấu:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputRoomId}
                    onChange={(e) => setInputRoomId(e.target.value.toLowerCase())}
                    placeholder="VD: duel4k8b"
                    className="flex-1 px-4 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-200 text-sm font-mono tracking-wider focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => onJoinRoom(inputRoomId)}
                    disabled={!inputRoomId.trim()}
                    className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-200 font-bold text-sm rounded-xl transition-colors"
                  >
                    Vào Phòng
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-800 p-2.5 rounded-xl text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Bot Mode */}
        {activeTab === 'bot' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-stone-950/60 rounded-2xl border border-stone-800 text-xs text-stone-400 leading-relaxed">
              {selectedGame === 'tank' ? (
                <>
                  Bạn sẽ lái chiến tăng đối đầu với <b>Chiến Tăng Bot AI</b> trên thực địa. Dùng phím <b>W / S</b> để lái tiến/lùi, <b>A / D</b> đánh lái thân xe, và lia chuột xoay tháp pháo ngắm bắn phá nổ xe địch!
                </>
              ) : (
                <>
                  Bạn sẽ đấu với <b>Bot Tinh Anh</b> nấp sau tảng đá đối diện. Dùng phím <b>A / D / W</b> để ngó ra và lia chuột ngắm bắn tỉa vào đối thủ!
                </>
              )}
            </div>
            <button
              onClick={onStartSolo}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-amber-500/20 text-sm"
            >
              <Play size={18} fill="currentColor" /> Bắt Đầu Chơi Với Bot Ngay
            </button>
          </div>
        )}

        {/* Controls Guide Footer */}
        <div className="pt-3 border-t border-stone-800/80 flex flex-wrap items-center justify-between text-[11px] text-stone-400 gap-2">
          {selectedGame === 'tank' ? (
            <>
              <div className="flex items-center gap-1.5">
                <Gauge size={13} className="text-amber-400" />
                <span>W/S/A/D: Lái xe tăng</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Compass size={13} className="text-amber-400" />
                <span>Chuột: Xoay tháp pháo (Chuột Phải: ADS)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield size={13} className="text-amber-400" />
                <span>Chuột Trái: Bắn pháo 120mm</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <Compass size={13} className="text-amber-400" />
                <span>Phím A/D/W: Ngó Trái / Phải / Lên</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target size={13} className="text-amber-400" />
                <span>Chuột: Ngắm tự do (Chuột Phải: ADS)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield size={13} className="text-amber-400" />
                <span>Chuột Trái: Bắn</span>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
