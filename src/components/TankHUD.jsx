import React from 'react';
import { Award, Volume2, VolumeX, LogOut, MousePointer, Shield, Gauge, Crosshair } from 'lucide-react';

export function TankHUD({
  playerHp,
  opponentHp,
  maxHp = 1000,
  speed = 0,
  gear = 'N',
  isAiming = false,
  canShoot = true,
  reloadProgress = 1.0,
  scores,
  roundStatus,
  roundMessage,
  isBotMode,
  isLocked,
  muted,
  onToggleMute,
  onExitMatch,
}) {
  const playerHpPercent = Math.max(0, Math.min(100, (playerHp / maxHp) * 100));
  const opponentHpPercent = Math.max(0, Math.min(100, (opponentHp / maxHp) * 100));

  const getHpColor = (percent) => {
    if (percent > 60) return 'bg-emerald-500';
    if (percent > 30) return 'bg-amber-500';
    return 'bg-red-500 animate-pulse';
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

      {/* 2. TOP CENTER: SCORES & OPPONENT TANK HEALTH */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20 w-80 sm:w-96">
        {/* Scoreboard Pill */}
        <div className="flex items-center gap-6 bg-stone-900/90 backdrop-blur-md px-6 py-1.5 rounded-full border border-stone-700/60 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold tracking-wider text-xs">BẠN</span>
            <span className="text-xl font-black text-amber-300 w-5 text-center">{scores.player}</span>
          </div>
          <span className="text-stone-500 font-bold text-base">:</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-red-400 w-5 text-center">{scores.opponent}</span>
            <span className="text-red-400 font-bold tracking-wider text-xs">
              {isBotMode ? 'BOT TĂNG' : 'ĐỐI THỦ'}
            </span>
          </div>
        </div>

        {/* Opponent Tank HP Bar */}
        <div className="w-full bg-stone-900/85 backdrop-blur-md px-4 py-2 rounded-2xl border border-stone-700/50 shadow-xl flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-red-400 flex items-center gap-1">
              <Shield size={13} /> {isBotMode ? 'CHIẾN TĂNG BOT AI' : 'XE TĂNG ĐỐI THỦ'}
            </span>
            <span className="text-stone-300 font-mono">
              {opponentHp} / {maxHp} HP
            </span>
          </div>
          <div className="w-full h-2.5 bg-stone-950/80 rounded-full overflow-hidden border border-stone-800">
            <div
              className={`h-full transition-all duration-300 ${getHpColor(opponentHpPercent)}`}
              style={{ width: `${opponentHpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. TOP-RIGHT: MUTE BUTTON */}
      <div className="absolute top-4 right-4 pointer-events-auto z-20">
        <button
          onClick={onToggleMute}
          className="p-2 bg-stone-900/80 hover:bg-stone-800 rounded-full border border-stone-700/50 text-stone-300 transition-colors shadow-md backdrop-blur-md"
          title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      {/* 4. POINTER LOCK HINT */}
      {!isLocked && !roundStatus && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="flex items-center gap-2 bg-stone-900/90 border border-amber-500/50 text-amber-300 px-4 py-2 rounded-full text-xs font-semibold shadow-xl animate-pulse backdrop-blur-md">
            <MousePointer size={14} className="text-amber-400" />
            <span>Nhấp vào màn hình để khóa chuột lái tháp pháo • Bấm <kbd className="px-1.5 py-0.5 bg-stone-800 rounded font-mono text-white text-[11px]">Ctrl + Alt</kbd> để thoát chuột</span>
          </div>
        </div>
      )}

      {/* 5. FIRST-PERSON GUNNER SIGHT (ADS - Right Click) */}
      {isAiming && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-[620px] h-[620px] rounded-full scope-ring relative border-2 border-emerald-500/80">
            {/* Sight Reticle Grid */}
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-emerald-500/70 -translate-x-1/2" />
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-emerald-500/70 -translate-y-1/2" />

            {/* Range Elevation Hash Marks */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 mt-2">
              <div className="w-8 h-[1px] bg-emerald-400/80 text-[8px] font-mono text-emerald-400 pl-10 -mt-2">200m</div>
              <div className="w-6 h-[1px] bg-emerald-400/80 text-[8px] font-mono text-emerald-400 pl-8 -mt-2">400m</div>
              <div className="w-10 h-[1px] bg-emerald-400/80 text-[8px] font-mono text-emerald-400 pl-12 -mt-2">600m</div>
            </div>

            {/* Center Aiming Chevron */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400 rotate-45 mb-1" />
            </div>

            {/* Ballistic Optic Status */}
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-[10px] text-emerald-400 font-mono tracking-widest bg-stone-950/80 px-3 py-0.5 rounded-full border border-emerald-500/40">
              120mm APFSDS • OPTIC 6X • LASER READY
            </div>
          </div>
        </div>
      )}

      {/* 6. THIRD PERSON CROSSHAIR */}
      {!isAiming && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 border border-amber-400/60 rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
          </div>
          <div className="absolute -left-6 w-3 h-[1.5px] bg-amber-300/80" />
          <div className="absolute -right-6 w-3 h-[1.5px] bg-amber-300/80" />
          <div className="absolute -top-6 h-3 w-[1.5px] bg-amber-300/80" />
        </div>
      )}

      {/* 7. BOTTOM-LEFT: PLAYER TANK DASHBOARD & SPEEDOMETER */}
      <div className="absolute bottom-5 left-5 z-20 flex flex-col gap-2.5 w-72 sm:w-80">
        {/* Speedometer & Gear */}
        <div className="bg-stone-900/90 backdrop-blur-md p-3.5 rounded-2xl border border-stone-700/60 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-stone-800 rounded-xl text-amber-400">
              <Gauge size={22} />
            </div>
            <div>
              <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Tốc Độ Xe</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-amber-300 font-mono">{speed}</span>
                <span className="text-xs text-stone-400 font-bold">KM/H</span>
              </div>
            </div>
          </div>

          {/* Gear Display */}
          <div className="flex flex-col items-center justify-center px-4 py-1.5 bg-stone-950/80 border border-stone-800 rounded-xl">
            <span className="text-[9px] text-stone-400 uppercase font-bold tracking-wider">Hộp Số</span>
            <span className={`text-xl font-black font-mono ${gear === 'R' ? 'text-red-400' : 'text-emerald-400'}`}>
              {gear}
            </span>
          </div>
        </div>

        {/* Player Tank HP Bar */}
        <div className="bg-stone-900/90 backdrop-blur-md p-3.5 rounded-2xl border border-stone-700/60 shadow-xl flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-amber-400 flex items-center gap-1.5">
              <Shield size={14} /> GIÁP XE TĂNG CỦA BẠN
            </span>
            <span className="text-stone-200 font-mono">
              {playerHp} / {maxHp} HP
            </span>
          </div>
          <div className="w-full h-3 bg-stone-950/80 rounded-full overflow-hidden border border-stone-800">
            <div
              className={`h-full transition-all duration-300 ${getHpColor(playerHpPercent)}`}
              style={{ width: `${playerHpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 8. BOTTOM-RIGHT: CANNON RELOAD & CONTROL TIPS */}
      <div className="absolute bottom-5 right-5 z-20 flex flex-col items-end gap-2.5">
        {/* Cannon Reload Progress Bar */}
        <div className="bg-stone-900/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-stone-700/60 shadow-xl flex flex-col gap-1.5 w-64">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-stone-300 flex items-center gap-1.5">
              <Crosshair size={14} className="text-amber-400" /> PHÁO CHÍNH 120mm
            </span>
            <span className={`text-[11px] font-mono ${canShoot ? 'text-amber-400' : 'text-stone-400'}`}>
              {canShoot ? 'SẴN SÀNG' : `${Math.round(reloadProgress * 100)}%`}
            </span>
          </div>
          <div className="w-full h-2 bg-stone-950/80 rounded-full overflow-hidden border border-stone-800">
            <div
              className={`h-full transition-all ${canShoot ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]' : 'bg-amber-600'}`}
              style={{ width: `${reloadProgress * 100}%` }}
            />
          </div>
        </div>

        {/* Driving Controls Guide */}
        <div className="flex flex-col items-end gap-1 text-[11px] text-stone-300 bg-stone-900/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-stone-700/60 shadow-lg">
          <div className="flex items-center gap-2">
            <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-amber-300 font-mono font-bold">W</kbd> / <kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-amber-300 font-mono font-bold">S</kbd>: Tiến / Lùi</span>
            <span>•</span>
            <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-amber-300 font-mono font-bold">A</kbd> / <kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-amber-300 font-mono font-bold">D</kbd>: Đánh lái thân xe</span>
          </div>
          <div className="flex items-center gap-2 text-stone-400 text-[10px]">
            <span><kbd className="px-1 py-0.5 bg-stone-800 rounded text-stone-300">Chuột</kbd>: Xoay tháp pháo</span>
            <span>•</span>
            <span><kbd className="px-1 py-0.5 bg-stone-800 rounded text-stone-300">Chuột Phải</kbd>: Ngắm quang học</span>
            <span>•</span>
            <span><kbd className="px-1 py-0.5 bg-stone-800 rounded text-stone-300">Chuột Trái</kbd>: Bắn</span>
          </div>
        </div>
      </div>

      {/* 9. ROUND END NOTIFICATION BANNER */}
      {roundStatus && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-30 transition-all">
          <div className="text-center p-8 bg-stone-900/95 border border-stone-700 rounded-3xl shadow-2xl max-w-sm mx-4 animate-in fade-in zoom-in duration-200">
            {roundStatus === 'WIN' ? (
              <>
                <Award size={52} className="mx-auto text-amber-400 mb-2 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
                <h2 className="text-2xl font-black text-amber-300 tracking-wider">BẠN ĐÃ BẮN HẠ XE TĂNG ĐỊCH!</h2>
                <p className="text-stone-300 mt-2 text-xs">{roundMessage || 'Chiến thắng oanh liệt!'}</p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-2">💥</div>
                <h2 className="text-2xl font-black text-red-500 tracking-wider">XE TĂNG CỦA BẠN ĐÃ NỔ TUNG!</h2>
                <p className="text-stone-300 mt-2 text-xs">{roundMessage || 'Xe tăng của bạn đã bị tiêu diệt!'}</p>
              </>
            )}
            <div className="mt-4 text-[10px] text-stone-400 tracking-widest uppercase animate-pulse">
              Ván đấu tiếp theo sẽ bắt đầu sau giây lát...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
