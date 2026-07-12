import React, { useState, useEffect, useRef } from 'react';
import { Song, PlaybackHistoryItem } from '../types';
import { Play, Pause, SkipForward, SkipBack, ExternalLink, RefreshCw, Volume2, Clock, Hourglass, Plus, Minus, Info, Music, Tv, Maximize2, Disc3, VideoOff } from 'lucide-react';

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
  audioOnlyMode,
  setAudioOnlyMode,
  isMiniCDMode,
  setIsMiniCDMode,
}: PlayerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(true);

  const [iframeStartAt, setIframeStartAt] = useState<number>(0);
  const [iframeReloadKey, setIframeReloadKey] = useState<number>(0);
  const [showResumeBanner, setShowResumeBanner] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onNextRef = useRef(onNext);

  const handlePointerDown = async (e: React.PointerEvent) => {
    if (!isMiniCDMode) return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().startDragging();
    } catch (error) {
      console.error('Failed to drag mini window:', error);
    }
  };

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
      className={
        isMiniCDMode
          ? "relative flex items-center justify-center w-full h-full bg-transparent overflow-hidden group select-none cursor-grab active:cursor-grabbing"
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
          {/* Outer Circular Ring */}
          <div className="relative z-10 flex flex-col items-center justify-center select-none">
            {/* Spinning CD Cover */}
            <div
              className="relative active:scale-95 transition-transform cursor-grab active:cursor-grabbing"
              title="拖动唱片移动；悬停显示播放控制"
            >
              {/* Spinning full-cover record. Controls live outside this rotating layer. */}
              <div className={`w-44 h-44 rounded-full bg-slate-950 border-[6px] border-slate-900 shadow-[0_10px_28px_rgba(0,0,0,0.65)] relative overflow-hidden ${isTimerActive && timeLeft > 0 ? 'animate-spin [animation-duration:15s]' : ''}`}>
                <img
                  src={currentSong.cover}
                  alt={currentSong.title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full rounded-full object-cover"
                />
                <div className="absolute inset-0 rounded-full bg-black/20 pointer-events-none"></div>
                <div className="absolute inset-0 rounded-full bg-[repeating-radial-gradient(circle,transparent_0,transparent_8px,rgba(0,0,0,0.22)_9px,rgba(255,255,255,0.05)_10px)] pointer-events-none"></div>
              </div>

              {/* Previous / play / next controls stay fixed in the record center. */}
              <div className="absolute inset-0 rounded-full bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity duration-200">
                <button
                  onClick={(e) => { e.stopPropagation(); onPrev(); }}
                  className="w-9 h-9 rounded-full bg-black/65 border border-white/15 text-white/85 hover:text-white hover:bg-black/85 flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-lg"
                  title="上一首"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); togglePlayback(); }}
                  className="w-12 h-12 rounded-full bg-cyan-400 text-slate-950 hover:bg-cyan-300 flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-lg shadow-cyan-500/30"
                  title={isTimerActive ? "暂停" : "播放"}
                >
                  {isTimerActive ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onNext(); }}
                  className="w-9 h-9 rounded-full bg-black/65 border border-white/15 text-white/85 hover:text-white hover:bg-black/85 flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-lg"
                  title="下一首"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
              </div>
            </div>

          </div>

          {/* Back to Large view controller button */}
          <button
            onClick={() => setIsMiniCDMode && setIsMiniCDMode(false)}
            className="absolute top-9 right-9 opacity-0 group-hover:opacity-100 text-slate-200 hover:text-white bg-black/70 hover:bg-black/90 p-2 rounded-full transition-all cursor-pointer shadow-lg border border-white/15 z-20"
            title="返回主窗口"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

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
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {setIsMiniCDMode && (
            <button
              onClick={() => setIsMiniCDMode(true)}
              className="group/cd flex items-center gap-2.5 px-3.5 py-2 bg-gradient-to-r from-cyan-500/15 to-blue-500/10 hover:from-cyan-500/25 hover:to-blue-500/20 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400/55 rounded-xl transition-all cursor-pointer shadow-[0_0_16px_rgba(34,211,238,0.08)]"
              title="将播放器收成桌面悬浮唱片"
            >
              <span className="w-8 h-8 rounded-full bg-cyan-400/15 border border-cyan-400/25 flex items-center justify-center group-hover/cd:rotate-45 transition-transform duration-300">
                <Disc3 className="w-4.5 h-4.5" />
              </span>
              <span className="text-left leading-tight">
                <span className="block text-xs font-bold">极简 CD 悬浮窗</span>
                <span className="block text-[9px] text-cyan-400/65 mt-0.5">收起主界面，仅保留唱片</span>
              </span>
            </button>
          )}
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
            <span>开启视频</span>
          </button>
          <button
            onClick={() => setAudioOnlyMode(true)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              audioOnlyMode
                ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <VideoOff className="w-3.5 h-3.5" />
            <span>关闭视频</span>
          </button>
          </div>
        </div>
      </div>

      {/* Playback Progress Indicator (Local Timer) */}
      <div id="player-countdown-section" className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="flex items-center gap-1.5 text-slate-450">
            <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>播放时间轴 PLAYBACK TIMELINE（拖动对齐 B 站进度）</span>
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

      </>
      )}
    </div>
  );
}
