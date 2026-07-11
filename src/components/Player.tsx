import React, { useState, useEffect, useRef } from 'react';
import { Song, PlaybackHistoryItem } from '../types';
import { Play, Pause, SkipForward, SkipBack, ExternalLink, RefreshCw, Volume2, Clock, Hourglass, Plus, Minus, Info, Music, Tv } from 'lucide-react';

interface PlayerProps {
  currentSong: Song | null;
  onNext: () => void;
  onPrev: () => void;
  history: PlaybackHistoryItem[];
  autoNext: boolean;
  setAutoNext: (val: boolean) => void;
  countdownBuffer: number;
  setCountdownBuffer: (val: number) => void;
  hideDanmaku: boolean;
  setHideDanmaku: (val: boolean) => void;
  highQuality: boolean;
  setHighQuality: (val: boolean) => void;
  incrementPlayCount: (bvid: string) => void;
  audioOnlyMode: boolean;
  setAudioOnlyMode: (val: boolean) => void;
}

export default function Player({
  currentSong,
  onNext,
  onPrev,
  history,
  autoNext,
  setAutoNext,
  countdownBuffer,
  setCountdownBuffer,
  hideDanmaku,
  setHideDanmaku,
  highQuality,
  setHighQuality,
  incrementPlayCount,
  audioOnlyMode,
  setAudioOnlyMode,
}: PlayerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // When song changes, reset timer
  useEffect(() => {
    if (currentSong) {
      // Set timer to song duration + buffer
      setTimeLeft(currentSong.duration + countdownBuffer);
      setIsTimerActive(autoNext); // Follow settings by default
      incrementPlayCount(currentSong.bvid);
    } else {
      setTimeLeft(0);
    }
  }, [currentSong, countdownBuffer]);

  // Handle countdown logic
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (currentSong && isTimerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimeout(() => {
              onNext();
            }, 500); // slight buffer for a smoother transition
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentSong, isTimerActive, timeLeft, onNext]);

  // Helper to format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Adjust timer manually (buffer or buffering)
  const adjustTimer = (seconds: number) => {
    setTimeLeft((prev) => Math.max(0, prev + seconds));
  };

  const getBilibiliEmbedUrl = () => {
    if (!currentSong) return '';
    if (!isTimerActive) return ''; // Blank out/unload iframe when paused to stop sound completely!
    
    const bvid = currentSong.bvid;
    const danmakuParam = hideDanmaku ? '0' : '1';
    const hqParam = highQuality ? '1' : '0';
    
    // Calculate elapsed time (how many seconds have played)
    // timeLeft starts at (duration + buffer) and counts down to 0
    const elapsed = Math.max(0, Math.floor(totalSeconds - timeLeft));
    
    // Only pass t parameter if they have played at least 1 second
    const timeParam = elapsed > 1 ? `&t=${elapsed}` : '';
    
    return `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=1&danmaku=${danmakuParam}&high_quality=${hqParam}&page=1${timeParam}`;
  };

  if (!currentSong) {
    return (
      <div id="player-empty-state" className="bg-[#08080c] border border-white/5 rounded-3xl p-10 shadow-xl flex flex-col items-center justify-center text-center h-[450px]">
        <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4">
          <Volume2 className="w-8 h-8 text-cyan-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-200 font-mono tracking-wider uppercase">NO ACTIVE TRACK</h3>
        <p className="text-slate-400 max-w-sm mt-3 text-xs leading-relaxed">
          当前未加载播放曲目。请先在 <strong>歌单管理</strong> 中同步您的 B 站公开收藏夹，随后点击融合曲库内任意歌曲开始享受无损、无上限随机体验。
        </p>
      </div>
    );
  }

  // Calculate percentage for visual timer bar
  const totalSeconds = currentSong.duration + countdownBuffer;
  const progressPercent = totalSeconds > 0 ? Math.round(((totalSeconds - timeLeft) / totalSeconds) * 100) : 0;

  return (
    <div id="active-player-card" className="bg-[#08080c] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Player Header with Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase">
            NOW PLAYING / 正在播放
          </span>
        </div>
        <div className="flex items-center bg-[#050507] border border-white/5 rounded-xl p-1 relative">
          <button
            onClick={() => setAudioOnlyMode(false)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !audioOnlyMode
                ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>原画视频模式</span>
          </button>
          <button
            onClick={() => setAudioOnlyMode(true)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              audioOnlyMode
                ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>精致听歌模式 (纯音频)</span>
          </button>
        </div>
      </div>

      {/* Upper part: Video player iframe or Ambient vinyl CD */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/5 shadow-inner">
        {/* The iframe is ALWAYS kept in the DOM to prevent reloads/pauses, but conditionally styled as hidden */}
        <div className={audioOnlyMode ? "absolute pointer-events-none opacity-0 w-1 h-1 -top-10 -left-10" : "w-full h-full"}>
          {isTimerActive ? (
            <iframe
              id="bilibili-player-iframe"
              src={getBilibiliEmbedUrl()}
              scrolling="no"
              border="0"
              frameBorder="no"
              framespacing="0"
              allowFullScreen={true}
              allow="autoplay; encrypted-media; fullscreen"
              className="absolute top-0 left-0 w-full h-full"
              referrerPolicy="no-referrer"
            ></iframe>
          ) : (
            <div className="w-full h-full bg-slate-950 flex items-center justify-center">
              <span className="text-xs text-slate-500 font-mono">PLAYER SLEEPING</span>
            </div>
          )}
        </div>

        {/* Ambient Cover View (Pure Audio Mode) */}
        {audioOnlyMode && isTimerActive && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#020204]">
            {/* Blurred backdrop cover */}
            <img
              src={currentSong.cover}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-20 scale-125 select-none pointer-events-none"
              referrerPolicy="no-referrer"
            />
            {/* Dark vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#020204]/85"></div>
            
            {/* Visualizer disc / art */}
            <div className="relative flex flex-col items-center justify-center space-y-4 z-10 p-4">
              <div className="relative group">
                {/* Glowing neon halo */}
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full blur opacity-30 group-hover:opacity-55 transition duration-1000 animate-pulse"></div>
                <img
                  src={currentSong.cover}
                  alt={currentSong.title}
                  className={`relative w-32 h-32 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-full object-cover border-2 border-white/10 shadow-2xl ${isTimerActive ? 'animate-spin [animation-duration:20s]' : ''}`}
                  referrerPolicy="no-referrer"
                />
                
                {/* Center hole to make it look like a CD vinyl */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#020204] border-2 border-white/10 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>
                </div>
                
                {/* Audio active pulse indicator */}
                {isTimerActive && (
                  <div className="absolute -bottom-1 -right-1 bg-cyan-500 text-slate-950 p-1 rounded-full shadow-lg border border-cyan-400">
                    <Music className="w-3.5 h-3.5 text-slate-950" />
                  </div>
                )}
              </div>
              <div className="text-center space-y-1">
                <span className="inline-block text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider">
                  PURE_AUDIO_ACTIVE
                </span>
                <p className="text-[11px] text-slate-400 font-mono tracking-widest uppercase animate-pulse">
                  Now playing in audio-only mode
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Paused State Overlay */}
        {!isTimerActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-10 p-6 text-center transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/20 to-pink-950/20 pointer-events-none"></div>
            <button
              onClick={() => setIsTimerActive(true)}
              className="relative group w-16 h-16 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center cursor-pointer shadow-lg hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all transform hover:scale-105"
            >
              <Play className="w-8 h-8 text-white fill-white translate-x-0.5 group-hover:scale-110 transition-transform" />
              <div className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping [animation-duration:1.5s]"></div>
            </button>
            <h4 className="mt-4 text-xs font-bold text-slate-200 tracking-wider font-mono uppercase">
              播放器已暂停休眠 / TIMER PAUSED
            </h4>
            <p className="mt-2 text-[11px] text-slate-400 max-w-sm leading-relaxed">
              由于浏览器跨域安全策略，暂停时已自动卸载并静音后台视频。点击上方按钮可<strong>对齐时间并断点续播</strong>。
            </p>
            <div className="mt-3 flex items-center gap-4 text-[10px] bg-white/5 border border-white/5 text-slate-400 font-mono px-4 py-1.5 rounded-full">
              <span>已播放时间: <strong className="text-cyan-400">{formatTime(totalSeconds - timeLeft)}</strong></span>
              <span className="w-px h-3 bg-white/10"></span>
              <span>剩余倒计时: <strong className="text-pink-400">{formatTime(timeLeft)}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Playback Progress Indicator (Local Timer) */}
      <div id="player-countdown-section" className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="flex items-center gap-1.5 text-slate-450">
            <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>PLAYBACK TIMELINE (SLIDE TO ALIGN / 拖动对齐B站进度)</span>
          </span>
          <span className="text-slate-300 font-semibold flex items-center gap-1">
            <Hourglass className="w-3.5 h-3.5 text-pink-400" />
            {formatTime(totalSeconds - timeLeft)} / {formatTime(totalSeconds)} (含 {countdownBuffer}s 缓冲)
          </span>
        </div>
        <div className="relative group w-full flex items-center">
          <input
            type="range"
            min="0"
            max={totalSeconds}
            value={totalSeconds - timeLeft}
            onChange={(e) => {
              const elapsed = Number(e.target.value);
              setTimeLeft(totalSeconds - elapsed);
            }}
            className="w-full h-2 rounded-full appearance-none bg-slate-900 border border-white/10 cursor-pointer focus:outline-none accent-cyan-400 hover:accent-pink-500 transition-all"
            style={{
              background: `linear-gradient(to right, #22d3ee 0%, #ec4899 ${progressPercent}%, #090d16 ${progressPercent}%, #090d16 100%)`
            }}
            title="拖动或点击以校准倒计时与B站播放器画面的时间进度"
          />
        </div>
      </div>

      {/* Meta Information and Control Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Track info */}
        <div className="md:col-span-6 flex items-center gap-4 min-w-0">
          <img
            src={currentSong.cover}
            alt={currentSong.title}
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-white/5"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 space-y-1">
            <h3 className="font-bold text-slate-100 text-base leading-snug truncate" title={currentSong.title}>
              {currentSong.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                UP主: <span className="text-slate-200 font-semibold">{currentSong.author}</span>
              </span>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-450 border border-cyan-500/20 px-2 py-0.5 rounded-full font-mono">
                {currentSong.playlistName}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              BVID: {currentSong.bvid}
            </p>
          </div>
        </div>

        {/* Custom Timer adjust and standard next actions */}
        <div className="md:col-span-6 flex flex-wrap items-center justify-end gap-3">
          {/* Manual Timer Adjust */}
          <div className="flex items-center bg-[#050507] border border-white/5 rounded-xl p-1">
            <button
              onClick={() => adjustTimer(-30)}
              className="p-1.5 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
              title="倒计时快进 30s"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-slate-300 font-bold px-2">
              微调计时
            </span>
            <button
              onClick={() => adjustTimer(30)}
              className="p-1.5 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
              title="倒计时延时 30s"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Pause Timer */}
          <button
            onClick={() => setIsTimerActive(!isTimerActive)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              isTimerActive
                ? 'bg-cyan-500/5 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/15'
                : 'bg-amber-500/5 border-amber-500/20 text-amber-400 hover:bg-amber-500/15'
            }`}
            title={isTimerActive ? '暂停倒计时 (保持播放此曲)' : '恢复倒计时 (启用自动切歌)'}
          >
            {isTimerActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1.5 bg-[#050507] border border-white/5 rounded-xl p-1">
            <button
              onClick={onPrev}
              disabled={history.length <= 1}
              className="p-2 text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
              title="上一首 (历史)"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={onNext}
              className="p-2 text-cyan-450 hover:text-cyan-300 transition-colors cursor-pointer"
              title="随机下一首"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Open B站 External Link */}
          <a
            href={`https://www.bilibili.com/video/${currentSong.bvid}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#050507] hover:bg-slate-900 border border-white/5 hover:border-white/10 text-slate-300 hover:text-slate-100 text-xs font-bold rounded-xl transition-all"
            title="去B站观看"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>去B站</span>
          </a>
        </div>
      </div>

      {/* Advanced Player Controls & Iframe Settings */}
      <div id="player-iframe-settings" className="border-t border-white/5 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="space-y-2">
          <label className="text-slate-455 font-bold block font-mono tracking-wider">播放器设置</label>
          <div className="flex flex-col gap-2 text-slate-300">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer hover:text-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={hideDanmaku}
                  onChange={(e) => setHideDanmaku(e.target.checked)}
                  className="accent-cyan-500 rounded"
                />
                <span>屏蔽弹幕 (精简听感)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={highQuality}
                  onChange={(e) => setHighQuality(e.target.checked)}
                  className="accent-cyan-500 rounded"
                />
                <span>请求高画质</span>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-slate-455 font-bold block flex items-center gap-1 font-mono tracking-wider">
            <span>倒计时自动切歌</span>
            <input
              type="checkbox"
              checked={autoNext}
              onChange={(e) => setAutoNext(e.target.checked)}
              className="accent-cyan-500 rounded ml-1"
            />
          </label>
          <div className="flex items-center gap-3">
            <span className="text-slate-400">切歌延时缓冲:</span>
            <div className="flex items-center bg-[#050507] border border-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setCountdownBuffer(Math.max(0, countdownBuffer - 1))}
                className="px-2 py-0.5 text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                -
              </button>
              <span className="font-mono px-2 text-slate-200 font-bold">{countdownBuffer}秒</span>
              <button
                onClick={() => setCountdownBuffer(countdownBuffer + 1)}
                className="px-2 py-0.5 text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                +
              </button>
            </div>
            <span className="text-slate-500 scale-90" title="防止视频缓冲导致视频未播完即切歌">
              <Info className="w-3.5 h-3.5 inline text-cyan-400" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
