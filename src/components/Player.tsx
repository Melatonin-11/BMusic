import React, { useState, useEffect, useRef } from 'react';
import { Song, PlaybackHistoryItem } from '../types';
import { Play, Pause, SkipForward, SkipBack, ExternalLink, RefreshCw, Volume2, Clock, Hourglass, Plus, Minus, Info, Music, Tv, HelpCircle, Minimize2, Pin } from 'lucide-react';

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
  isMiniCDMode?: boolean;
  setIsMiniCDMode?: (val: boolean) => void;
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
  isMiniCDMode,
  setIsMiniCDMode,
}: PlayerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(true);
  const [isTauri, setIsTauri] = useState<boolean>(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined) {
      setIsTauri(true);
    }
  }, []);

  const toggleAlwaysOnTop = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const nextState = !isAlwaysOnTop;
        await win.setAlwaysOnTop(nextState);
        setIsAlwaysOnTop(nextState);
      } catch (err) {
        console.error('Failed to set always on top:', err);
      }
    }
  };

  const [iframeStartAt, setIframeStartAt] = useState<number>(0);
  const [iframeReloadKey, setIframeReloadKey] = useState<number>(0);
  const [showResumeBanner, setShowResumeBanner] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onNextRef = useRef(onNext);

  // Draggable state for Mini CD Mode
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isMiniCDMode) return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
    isDraggingRef.current = true;
    startPosRef.current = { x: e.clientX - dragPos.x, y: e.clientY - dragPos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const newX = e.clientX - startPosRef.current.x;
    const newY = e.clientY - startPosRef.current.y;
    setDragPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignored
    }
  };

  useEffect(() => {
    if (!isMiniCDMode) {
      setDragPos({ x: 0, y: 0 });
    }
  }, [isMiniCDMode]);

  // Background state keepers
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasHiddenSwitchRef = useRef<boolean>(false);

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  // Keep a tiny looping silent audio stream playing when active.
  // This registers the tab as "actively playing media" in Chrome/Safari/Firefox,
  // preventing the browser from putting the tab into deep sleep or heavily throttling timers in the background.
  useEffect(() => {
    if (isTimerActive && currentSong) {
      if (!silentAudioRef.current) {
        // Simple 1-second completely silent WAV file encoded in base64
        const silentUri = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";
        const audio = new Audio(silentUri);
        audio.loop = true;
        audio.volume = 0.001; // extremely low to prevent any hardware hiss
        silentAudioRef.current = audio;
      }
      silentAudioRef.current.play().catch((err) => {
        console.log("Background audio loop start allowed on user interaction:", err);
      });
    } else {
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
      }
    }

    return () => {
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
      }
    };
  }, [isTimerActive, currentSong]);

  // When song changes, reset timer
  useEffect(() => {
    if (currentSong) {
      // Set timer to song duration + buffer
      setTimeLeft(currentSong.duration + countdownBuffer);
      setIsTimerActive(autoNext); // Follow settings by default
      setIframeStartAt(0);
      incrementPlayCount(currentSong.bvid);

      // If the song changed while the browser tab was hidden/backgrounded,
      // flag it so we reload the iframe to force autoplay the moment the user brings it to foreground
      if (document.hidden) {
        hasHiddenSwitchRef.current = true;
      }
    } else {
      setTimeLeft(0);
    }
  }, [currentSong, countdownBuffer]);

  // Listen to tab focus/visibility change.
  // If a song changed while in background, show an overlay to bypass browser autoplay safety with a user gesture.
  useEffect(() => {
    const handleGestureResume = () => {
      setIframeReloadKey((prev) => prev + 1);
      setShowResumeBanner(false);
      hasHiddenSwitchRef.current = false;
      document.removeEventListener('click', handleGestureResume);
      document.removeEventListener('pointerdown', handleGestureResume);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (hasHiddenSwitchRef.current) {
          setShowResumeBanner(true);
          // Register user gesture listeners to instantly play once clicked anywhere
          document.addEventListener('click', handleGestureResume);
          document.addEventListener('pointerdown', handleGestureResume);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleGestureResume);
      document.removeEventListener('pointerdown', handleGestureResume);
    };
  }, []);

  // Handle countdown logic
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (currentSong && isTimerActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimeout(() => {
              onNextRef.current();
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
  }, [currentSong, isTimerActive]);

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
    
    // Keep this URL stable while the local timer ticks. Changing `t` every
    // second reloads the cross-origin iframe and makes the audio stutter.
    // `iframeStartAt` changes only when a paused player is resumed.
    const timeParam = iframeStartAt > 1 ? `&t=${Math.floor(iframeStartAt)}` : '';
    
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

  const togglePlayback = () => {
    if (isTimerActive) {
      setIsTimerActive(false);
      return;
    }

    setIframeStartAt(Math.max(0, totalSeconds - timeLeft));
    setIsTimerActive(true);
  };

  const commitSeek = (elapsed: number) => {
    const target = Math.max(0, Math.min(currentSong.duration, elapsed));
    setTimeLeft(Math.max(0, totalSeconds - target));
    setIframeStartAt(target);
    // Force exactly one iframe remount, including when seeking to the same
    // timestamp used by a previous seek.
    setIframeReloadKey((prev) => prev + 1);
  };

  return (
    <div
      id="active-player-card"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={
        isMiniCDMode
          ? {
              transform: `translate(${dragPos.x}px, ${dragPos.y}px)`,
              touchAction: 'none',
            }
          : {}
      }
      className={
        isMiniCDMode
          ? "relative flex flex-col items-center justify-center p-6 bg-[#09090e]/85 backdrop-blur-xl border border-white/10 rounded-[32px] shadow-2xl w-full max-w-[320px] aspect-square mx-auto overflow-hidden group select-none transition-shadow hover:shadow-cyan-500/10 duration-300 cursor-grab active:cursor-grabbing"
          : "bg-[#08080c] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6"
      }
    >
      {/* 1. Persistent Bilibili iframe Container (Always rendered, never unmounted!) */}
      <div
        key="persistent-iframe-container"
        className={
          isMiniCDMode
            ? "absolute pointer-events-none opacity-[0.01] w-1 h-1 z-0"
            : "relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/5 shadow-inner"
        }
      >
        <div className={!isMiniCDMode && audioOnlyMode ? "absolute inset-0 pointer-events-none opacity-[0.01] z-0" : "w-full h-full relative z-10"}>
          {isTimerActive ? (
            <iframe
              key={`${currentSong.bvid}-${iframeReloadKey}`}
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

        {/* Ambient Cover View (Pure Audio Mode) inside normal layout */}
        {!isMiniCDMode && audioOnlyMode && isTimerActive && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#020204] z-10">
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

        {/* Paused State Overlay inside normal layout */}
        {!isMiniCDMode && !isTimerActive && (
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

        {/* Background Playback Gesture Overlay inside normal layout */}
        {!isMiniCDMode && showResumeBanner && (
          <div className="absolute inset-0 bg-[#08080c]/95 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center animate-pulse">
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/20 to-pink-950/20 pointer-events-none"></div>
            <div className="relative w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4 text-cyan-400 border border-cyan-500/20 shadow-lg shadow-cyan-500/10">
              <Music className="w-8 h-8 animate-bounce [animation-duration:2s]" />
            </div>
            <h4 className="text-xs font-bold text-slate-100 tracking-wider">
              点击屏幕任意位置恢复声音 / CLICK TO RESUME
            </h4>
            <p className="mt-2 text-[11px] text-slate-400 max-w-xs leading-relaxed">
              由于浏览器媒体播放安全策略，在后台切歌后需要点击一次来恢复声音。轻点网页任意位置即可瞬间启动！
            </p>
            <p className="mt-2 text-[10px] text-cyan-400 max-w-xs font-semibold bg-cyan-500/5 px-2.5 py-1.5 rounded-lg border border-cyan-500/15">
              💡 提示：点击上方的【进入极简 CD 挂机模式】，在当前页面变身为精美旋转 CD，极致纯粹，连续自动播放不卡顿！
            </p>
            <div className="mt-4 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-400 rounded-full font-mono">
              BACKGROUND_AUTOPLAY_ACTIVE
            </div>
          </div>
        )}
      </div>

      {isMiniCDMode ? (
        /* MINI CD MODE DESIGN */
        <>
          {/* Ambient subtle glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-pink-500/10 pointer-events-none opacity-40"></div>

          {/* Outer Circular Ring */}
          <div className="relative z-10 flex flex-col items-center justify-center select-none">
            {/* Spinning CD Cover */}
            <button
              onClick={togglePlayback}
              className="relative focus:outline-none focus:ring-0 active:scale-95 transition-transform cursor-pointer"
              title={isTimerActive ? "点击暂停" : "点击播放"}
            >
              {/* Spinning Vinyl CD */}
              <div className={`w-44 h-44 rounded-full bg-slate-950 border-[6px] border-slate-900 shadow-2xl relative flex items-center justify-center overflow-hidden ${isTimerActive && timeLeft > 0 ? 'animate-spin [animation-duration:15s]' : ''}`}>
                <div className="absolute inset-0 border-[10px] border-black/40 rounded-full"></div>
                {/* CD Cover Image in Center */}
                <img
                  src={currentSong.cover}
                  alt={currentSong.title}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 rounded-full object-cover border-4 border-slate-900"
                />
                {/* Vinyl grooves */}
                <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_45%,rgba(255,255,255,0.03)_46%,transparent_47%,rgba(255,255,255,0.03)_50%,transparent_51%)] pointer-events-none"></div>
                
                {/* Play/Pause overlay icon on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                  <div className="w-12 h-12 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg">
                    {isTimerActive ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                  </div>
                </div>
              </div>
            </button>

            {/* Mini Playback Status Floating Pill */}
            <div className="absolute -bottom-2 px-3 py-1 bg-slate-950/95 border border-white/5 text-[10px] text-slate-300 rounded-full shadow-lg font-mono flex items-center gap-1.5 backdrop-blur max-w-[200px]">
              <span className={`w-1.5 h-1.5 rounded-full ${isTimerActive ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`}></span>
              <span className="truncate max-w-[120px]">{currentSong.title}</span>
            </div>
          </div>

          {/* Always on Top toggle for Mini CD Mode under Tauri */}
          {isTauri && (
            <button
              onClick={toggleAlwaysOnTop}
              className={`absolute top-4 left-4 p-2 rounded-full transition-all cursor-pointer shadow-lg border ${
                isAlwaysOnTop
                  ? 'text-pink-400 bg-pink-500/10 border-pink-500/25 shadow-pink-500/5'
                  : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border-white/5'
              }`}
              title={isAlwaysOnTop ? "取消窗口置顶" : "窗口置顶"}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}

          {/* Back to Large view controller button */}
          <button
            onClick={() => setIsMiniCDMode && setIsMiniCDMode(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all cursor-pointer shadow-lg border border-white/5"
            title="返回大窗口"
          >
            <Minimize2 className="w-4 h-4 rotate-180" />
          </button>

          {/* Quick controls underneath */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-all active:scale-90"
              title="上一首"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); togglePlayback(); }}
              className="text-slate-950 bg-cyan-400 hover:bg-cyan-300 p-2 rounded-full cursor-pointer transition-all active:scale-90 shadow-lg shadow-cyan-400/10"
              title={isTimerActive ? "暂停" : "播放"}
            >
              {isTimerActive ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-all active:scale-90"
              title="下一首"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Background Playback Gesture Overlay inside Mini View */}
          {showResumeBanner && (
            <button
              onClick={() => {
                setIframeReloadKey((prev) => prev + 1);
                setShowResumeBanner(false);
              }}
              className="absolute inset-0 bg-[#08080c]/95 backdrop-blur-md z-30 flex flex-col items-center justify-center p-4 text-center cursor-pointer active:scale-95 transition-transform rounded-[32px]"
            >
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center mb-3 text-cyan-400 border border-cyan-500/20 shadow-lg animate-bounce">
                <Music className="w-6 h-6" />
              </div>
              <h4 className="text-[10px] font-bold text-slate-100 tracking-wider">
                点击屏幕恢复声音
              </h4>
              <p className="mt-1 text-[9px] text-slate-400 max-w-[180px] leading-relaxed">
                因浏览器安全限制，后台切歌需点击任意位置即可恢复
              </p>
            </button>
          )}
        </>
      ) : (
        /* NORMAL LARGE MODE HEADER */
        <>
      {/* Player Header with Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase">
            NOW PLAYING / 正在播放
          </span>
          {setIsMiniCDMode && (
            <button
              onClick={() => setIsMiniCDMode(true)}
              className="flex items-center gap-1.5 text-[10px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded transition-all cursor-pointer font-bold"
              title="极简 CD 挂机模式：在当前页面变身为精美旋转 CD 播放器，极度简洁，杜绝干扰！"
            >
              <Minimize2 className="w-3 h-3" />
              <span>进入极简 CD 挂机模式</span>
            </button>
          )}
          {isTauri && (
            <button
              onClick={toggleAlwaysOnTop}
              className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded transition-all cursor-pointer font-bold ${
                isAlwaysOnTop
                  ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40 shadow-[0_0_8px_rgba(236,72,153,0.2)]'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
              }`}
              title="窗口置顶：将播放器窗口保持在所有其他窗口的最前端，方便在做其他事时看歌单！"
            >
              <Pin className="w-3 h-3" />
              <span>{isAlwaysOnTop ? '已置顶' : '窗口置顶'}</span>
            </button>
          )}
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
            onPointerUp={(e) => commitSeek(Number(e.currentTarget.value))}
            onKeyUp={(e) => commitSeek(Number(e.currentTarget.value))}
            className="w-full h-2 rounded-full appearance-none bg-slate-900 border border-white/10 cursor-pointer focus:outline-none accent-cyan-400 hover:accent-pink-500 transition-all"
            style={{
              background: `linear-gradient(to right, #22d3ee 0%, #ec4899 ${progressPercent}%, #090d16 ${progressPercent}%, #090d16 100%)`
            }}
            title="拖动时预览时间，松开后让B站播放器跳转到对应位置"
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
            onClick={togglePlayback}
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

      {/* Background Playback Notice / Guide */}
      <div className="border-t border-white/5 pt-4">
        <div className="bg-cyan-950/10 border border-cyan-500/15 rounded-2xl p-4 flex gap-3 items-start">
          <HelpCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-slate-200 flex items-center gap-1">
              <span>💡 浏览器后台完美播放/切歌技巧</span>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-mono px-1.5 py-0.5 rounded uppercase">Recommended / 推荐</span>
            </h4>
            <p className="text-slate-400 leading-relaxed">
              现代浏览器（如 Chrome, Edge, Safari）有严格的媒体安全策略：当网页在后台（切到其他标签页或最小化）时，会禁止新加载的 B 站播放器自动播放声音，从而导致切歌时卡住。
            </p>
            <div className="pt-1.5 text-slate-300 flex flex-col gap-1">
              <p className="font-semibold text-cyan-450">
                只需简单一步即可彻底解决后台自动连续播放：
              </p>
              <div className="pl-4 border-l border-cyan-500/30 space-y-1 font-mono text-slate-300 text-[11px]">
                <div>1. 点击浏览器地址栏左侧的 <strong className="text-cyan-400">“锁头 / 调节”</strong> 图标；</div>
                <div>2. 点击 <strong className="text-cyan-400">“网站设置 (Site Settings)”</strong>；</div>
                <div>3. 找到 <strong className="text-cyan-400">“声音 (Sound)”</strong> 权限，将其修改为 <strong className="text-cyan-400">“允许 (Allow)”</strong>；</div>
                <div>4. 返回此页面刷新即可。即使切换标签或最小化，系统也能完美连续播歌！</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
