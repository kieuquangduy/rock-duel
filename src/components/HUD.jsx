import React from 'react';
import { Shield, ShieldAlert, Crosshair, Award, Volume2, VolumeX } from 'lucide-react';
import { sounds } from '../audio/SoundEffects';

export function HUD({
  isAiming,
  isCovered,
  canShoot,
  peekOffset,
  scores,
  mapDistance,
  roundStatus, // null, 'WIN', 'LOSS'
  roundMessage,
  isHost,
  isBotMode,
  muted,
  onToggleMute,
}) {
  const getMapName = (dist) => {
    if (dist <= 20) return 'GẦN (18m - Cận chiến phản xạ)';
    if (dist <= 40) return 'VỪA (35m - Tiêu chuẩn đấu súng)';
    return 'XA (60m - Đấu súng bắn tỉa)';
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
      {/* 1. TOP BAR: SCORE & MAP INFO */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-20">
        <div className="flex items-center gap-6 bg-stone-900/85 backdrop-blur-md px-6 py-2.5 rounded-full border border-stone-700/60 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold tracking-wider text-sm">BẠN</span>
            <span className="text-2xl font-black text-amber-300 w-6 text-center">{scores.player}</span>
          </div>
          <span className="text-stone-500 font-bold text-lg">:</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-red-400 w-6 text-center">{scores.opponent}</span>
            <span className="text-red-400 font-bold tracking-wider text-sm">
              {isBotMode ? 'BOT AI' : 'ĐỐI THỦ'}
            </span>
          </div>
        </div>

        <div className="text-[11px] tracking-widest uppercase text-stone-400 font-semibold bg-stone-900/60 px-3 py-1 rounded-full border border-stone-800">
          Cự ly: <span className="text-amber-300">{getMapName(mapDistance)}</span>
        </div>
      </div>

      {/* 2. AUDIO TOGGLE BUTTON */}
      <div className="absolute top-4 right-4 pointer-events-auto z-20">
        <button
          onClick={onToggleMute}
          className="p-2.5 bg-stone-900/80 hover:bg-stone-800 rounded-full border border-stone-700/50 text-stone-300 transition-colors"
          title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* 3. ADS SNIPER SCOPE OVERLAY (When right-click aiming) */}
      {isAiming && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          {/* Blacked out vignette ring */}
          <div className="w-[580px] h-[580px] rounded-full scope-ring relative border-2 border-stone-900/80 pointer-events-none">
            {/* Scope crosshair lines */}
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-black/80 -translate-x-1/2" />
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-black/80 -translate-y-1/2" />

            {/* Mil-dot markers */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-red-600/90 shadow-sm" />
            </div>

            {/* Tactical scope markings */}
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-[10px] text-amber-500/80 font-mono tracking-widest">
              RANGE: {mapDistance}m • 6x OPTIC
            </div>
          </div>
        </div>
      )}

      {/* 4. HIPFIRE CROSSHAIR (When not aiming) */}
      {!isAiming && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          <div className="absolute -left-4 w-2.5 h-[1.5px] bg-amber-300/80" />
          <div className="absolute -right-4 w-2.5 h-[1.5px] bg-amber-300/80" />
          <div className="absolute -top-4 h-2.5 w-[1.5px] bg-amber-300/80" />
          <div className="absolute -bottom-4 h-2.5 w-[1.5px] bg-amber-300/80" />
        </div>
      )}

      {/* 5. BOTTOM-LEFT: COVER RADAR & PEEK INDICATOR */}
      <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2">
        <div className="bg-stone-900/90 backdrop-blur-md p-3.5 rounded-2xl border border-stone-700/60 shadow-xl flex items-center gap-4">
          {/* Mini Rock Diagram */}
          <div className="relative w-24 h-24 bg-stone-950/80 rounded-xl border border-stone-800 flex items-center justify-center overflow-hidden">
            {/* The Rock silhouette */}
            <div className="w-14 h-14 bg-stone-700/80 rounded-2xl border-2 border-stone-600/70 rotate-6 shadow-inner" />

            {/* Dynamic Player Head Marker */}
            <div
              className={`absolute w-3.5 h-3.5 rounded-full transition-transform duration-75 shadow-lg border-2 ${
                isCovered
                  ? 'bg-emerald-400 border-emerald-200 shadow-emerald-500/50'
                  : 'bg-red-500 border-red-200 animate-pulse shadow-red-500/80'
              }`}
              style={{
                transform: `translate(${(peekOffset?.x || 0) * 22}px, ${-(peekOffset?.y || 0) * 22}px)`,
              }}
            />

            {/* Crosshair guide center */}
            <div className="absolute w-1 h-1 bg-white/30 rounded-full" />
          </div>

          {/* Cover Status Badge */}
          <div className="flex flex-col">
            <span className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold">
              Trạng thái ẩn nấp
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isCovered ? (
                <>
                  <Shield size={16} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold text-sm tracking-wide">AN TOÀN</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={16} className="text-red-400 animate-bounce" />
                  <span className="text-red-400 font-bold text-sm tracking-wide">ĐANG LỘ ĐẦU!</span>
                </>
              )}
            </div>
            <p className="text-[10px] text-stone-500 mt-1 max-w-[130px] leading-tight">
              Di chuột để thò đầu ra mép đá ngắm bắn
            </p>
          </div>
        </div>
      </div>

      {/* 6. BOTTOM-RIGHT: BOLT RELOAD & CONTROLS HELPER */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2">
        <div className="bg-stone-900/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-stone-700/60 shadow-xl flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
              Khẩu súng bắn tỉa
            </div>
            <div className={`font-bold text-sm tracking-wide ${canShoot ? 'text-amber-400' : 'text-stone-500'}`}>
              {canShoot ? 'SẴN SÀNG BẮN' : 'ĐANG LÊN ĐẠN...'}
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${canShoot ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]' : 'bg-stone-600 animate-pulse'}`} />
        </div>

        {/* Small guide badges */}
        <div className="flex items-center gap-2 text-[10px] text-stone-400 bg-stone-900/60 px-3 py-1.5 rounded-lg border border-stone-800">
          <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-amber-300 font-mono">Chuột Phải</kbd> Ngắm</span>
          <span>•</span>
          <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-amber-300 font-mono">Chuột Trái</kbd> Bắn</span>
        </div>
      </div>

      {/* 7. ROUND END NOTIFICATION BANNER */}
      {roundStatus && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-30 transition-all">
          <div className="text-center p-8 bg-stone-900/95 border border-stone-700 rounded-3xl shadow-2xl max-w-md mx-4 animate-in fade-in zoom-in duration-200">
            {roundStatus === 'WIN' ? (
              <>
                <Award size={56} className="mx-auto text-amber-400 mb-2 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
                <h2 className="text-3xl font-black text-amber-300 tracking-wider">BẠN THẮNG HIỆP NÀY!</h2>
                <p className="text-stone-300 mt-2 text-sm">{roundMessage || 'Bắn hạ đối thủ thành công'}</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-2">💀</div>
                <h2 className="text-3xl font-black text-red-500 tracking-wider">BẠN ĐÃ BỊ HẠ!</h2>
                <p className="text-stone-300 mt-2 text-sm">{roundMessage || 'Đối thủ đã hạ gục bạn'}</p>
              </>
            )}
            <div className="mt-5 text-xs text-stone-400 tracking-widest uppercase animate-pulse">
              Ván tiếp theo sẽ bắt đầu sau giây lát...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
