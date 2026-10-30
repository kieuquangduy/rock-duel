import React from 'react';
import { Award, Volume2, VolumeX, LogOut, MousePointer } from 'lucide-react';

export function HUD({
  isAiming,
  canShoot,
  scores,
  mapDistance,
  roundStatus,
  roundMessage,
  isBotMode,
  isLocked,
  muted,
  onToggleMute,
  onExitMatch,
}) {
  const getMapName = (dist) => {
    if (dist <= 20) return 'GẦN (18m)';
    if (dist <= 40) return 'VỪA (35m)';
    return 'XA (60m)';
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
      {/* 1. TOP-LEFT: EXIT MATCH BUTTON */}
      <div className="absolute top-4 left-4 pointer-events-auto z-20">
        <button
          onClick={onExitMatch}
          className="flex items-center gap-2 px-3.5 py-2 bg-stone-900/80 hover:bg-red-950/80 text-stone-300 hover:text-red-300 rounded-full border border-stone-700/60 transition-all text-xs font-semibold shadow-lg backdrop-blur-md"
          title="Rời trận đấu về sảnh"
        >
          <LogOut size={15} />
          <span>Rời Trận</span>
        </button>
      </div>

      {/* 2. TOP CENTER: SCOREBOARD */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-20">
        <div className="flex items-center gap-6 bg-stone-900/85 backdrop-blur-md px-6 py-2 rounded-full border border-stone-700/60 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold tracking-wider text-xs">BẠN</span>
            <span className="text-xl font-black text-amber-300 w-5 text-center">{scores.player}</span>
          </div>
          <span className="text-stone-500 font-bold text-base">:</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-red-400 w-5 text-center">{scores.opponent}</span>
            <span className="text-red-400 font-bold tracking-wider text-xs">
              {isBotMode ? 'BOT AI' : 'ĐỐI THỦ'}
            </span>
          </div>
        </div>

        <div className="text-[10px] tracking-widest uppercase text-stone-400 font-semibold bg-stone-900/60 px-3 py-0.5 rounded-full border border-stone-800">
          Cự ly: <span className="text-amber-300">{getMapName(mapDistance)}</span>
        </div>
      </div>

      {/* 3. TOP-RIGHT: MUTE TOGGLE */}
      <div className="absolute top-4 right-4 pointer-events-auto z-20">
        <button
          onClick={onToggleMute}
          className="p-2 bg-stone-900/80 hover:bg-stone-800 rounded-full border border-stone-700/50 text-stone-300 transition-colors shadow-md backdrop-blur-md"
          title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      {/* 4. POINTER LOCK PROMPT (When mouse is not locked) */}
      {!isLocked && !roundStatus && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="flex items-center gap-2 bg-stone-900/90 border border-amber-500/50 text-amber-300 px-4 py-2 rounded-full text-xs font-semibold shadow-xl animate-pulse backdrop-blur-md">
            <MousePointer size={14} className="text-amber-400" />
            <span>Nhấp vào màn hình để khóa chuột ngắm bắn • Bấm <kbd className="px-1.5 py-0.5 bg-stone-800 rounded font-mono text-white text-[11px]">Ctrl + Alt</kbd> để thoát chuột</span>
          </div>
        </div>
      )}

      {/* 5. ADS SNIPER SCOPE (When right-click aiming) */}
      {isAiming && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-[560px] h-[560px] rounded-full scope-ring relative border-2 border-stone-900/90 pointer-events-none">
            {/* Scope crosshairs */}
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-black/85 -translate-x-1/2" />
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-black/85 -translate-y-1/2" />

            {/* Red center dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-red-600/90 shadow-[0_0_4px_rgba(239,68,68,0.8)]" />
            </div>

            {/* Tactical markings */}
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-[10px] text-amber-500/90 font-mono tracking-widest">
              RANGE: {mapDistance}m • 6x OPTIC
            </div>
          </div>
        </div>
      )}

      {/* 6. HIPFIRE CROSSHAIR (When not aiming) */}
      {!isAiming && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
          <div className="absolute -left-3.5 w-2 h-[1.5px] bg-amber-300/80" />
          <div className="absolute -right-3.5 w-2 h-[1.5px] bg-amber-300/80" />
          <div className="absolute -top-3.5 h-2 w-[1.5px] bg-amber-300/80" />
          <div className="absolute -bottom-3.5 h-2 w-[1.5px] bg-amber-300/80" />
        </div>
      )}

      {/* 7. BOTTOM-RIGHT: BOLT RELOAD & NEW KEYBOARD/MOUSE CONTROLS */}
      <div className="absolute bottom-5 right-5 z-20 flex flex-col items-end gap-2">
        <div className="bg-stone-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-stone-700/60 shadow-xl flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
              Khẩu súng
            </div>
            <div className={`font-bold text-xs tracking-wide ${canShoot ? 'text-amber-400' : 'text-stone-500'}`}>
              {canShoot ? 'SẴN SÀNG BẮN' : 'ĐANG LÊN ĐẠN...'}
            </div>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full ${canShoot ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]' : 'bg-stone-600 animate-pulse'}`} />
        </div>

        {/* Clear Key Mapping */}
        <div className="flex flex-col items-end gap-1 text-[11px] text-stone-300 bg-stone-900/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-stone-700/60 shadow-lg">
          <div className="flex items-center gap-2">
            <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-amber-300 font-mono font-bold">A</kbd> / <kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-amber-300 font-mono font-bold">D</kbd>: Ngó Trái / Phải</span>
            <span>•</span>
            <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-amber-300 font-mono font-bold">W</kbd>: Nhổm lên ngó</span>
            <span>•</span>
            <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-amber-300 font-mono font-bold">S</kbd>: Nấp</span>
          </div>
          <div className="flex items-center gap-2 text-stone-400 text-[10px]">
            <span><kbd className="px-1 py-0.5 bg-stone-800 rounded text-stone-300">Chuột</kbd>: Ngắm tự do</span>
            <span>•</span>
            <span><kbd className="px-1 py-0.5 bg-stone-800 rounded text-stone-300">Chuột Phải</kbd>: Zoom ngắm</span>
            <span>•</span>
            <span><kbd className="px-1 py-0.5 bg-stone-800 rounded text-stone-300">Chuột Trái</kbd>: Bắn</span>
          </div>
        </div>
      </div>

      {/* 8. ROUND END NOTIFICATION BANNER */}
      {roundStatus && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-30 transition-all">
          <div className="text-center p-8 bg-stone-900/95 border border-stone-700 rounded-3xl shadow-2xl max-w-sm mx-4 animate-in fade-in zoom-in duration-200">
            {roundStatus === 'WIN' ? (
              <>
                <Award size={52} className="mx-auto text-amber-400 mb-2 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
                <h2 className="text-2xl font-black text-amber-300 tracking-wider">BẠN THẮNG!</h2>
                <p className="text-stone-300 mt-2 text-xs">{roundMessage || 'Bắn hạ đối thủ thành công'}</p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-2">💀</div>
                <h2 className="text-2xl font-black text-red-500 tracking-wider">BẠN ĐÃ BỊ HẠ!</h2>
                <p className="text-stone-300 mt-2 text-xs">{roundMessage || 'Đối thủ đã hạ gục bạn'}</p>
              </>
            )}
            <div className="mt-4 text-[10px] text-stone-400 tracking-widest uppercase animate-pulse">
              Ván tiếp theo sẽ bắt đầu sau giây lát...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
