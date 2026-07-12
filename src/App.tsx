import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import PlaylistConfigComponent from './components/PlaylistConfig';
import Player from './components/Player';
import SongList from './components/SongList';
import StatsDashboard from './components/StatsDashboard';
import { PlaylistConfig, Song, PlaybackHistoryItem } from './types';
import { Music, FolderHeart, BarChart3, Radio, HelpCircle, AlertCircle, Shuffle } from 'lucide-react';

export default function App() {
  const [isMiniCDMode, setIsMiniCDMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'player' | 'songlist' | 'playlists' | 'stats'>('player');
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Core state loaded from LocalStorage
  const [playlists, setPlaylists] = useState<PlaylistConfig[]>(() => {
    const saved = localStorage.getItem('bili_playlists');
    return saved ? JSON.parse(saved) : [];
  });

  const [sessdata, setSessdata] = useState<string>(() => {
    return localStorage.getItem('bili_sessdata') || '';
  });

  const [history, setHistory] = useState<PlaybackHistoryItem[]>(() => {
    const saved = localStorage.getItem('bili_player_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Player Settings
  const [autoNext, setAutoNext] = useState<boolean>(() => {
    const saved = localStorage.getItem('bili_setting_auto_next');
    return saved !== 'false'; // default true
  });

  const [countdownBuffer, setCountdownBuffer] = useState<number>(() => {
    const saved = localStorage.getItem('bili_setting_buffer');
    return saved ? parseInt(saved, 10) : 3; // default 3s buffer
  });

  const [hideDanmaku, setHideDanmaku] = useState<boolean>(() => {
    const saved = localStorage.getItem('bili_setting_hide_danmaku');
    return saved === 'true'; // default false
  });

  const [highQuality, setHighQuality] = useState<boolean>(() => {
    const saved = localStorage.getItem('bili_setting_hq');
    return saved === 'true'; // default false
  });

  const [audioOnlyMode, setAudioOnlyMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('bili_setting_audio_only');
    return saved === 'true'; // default false
  });

  const [shuffleMode, setShuffleMode] = useState<'pure' | 'balanced'>(() => {
    const saved = localStorage.getItem('bili_setting_shuffle');
    return (saved as 'pure' | 'balanced') || 'pure';
  });

  const [currentSong, setCurrentSong] = useState<Song | null>(() => {
    const saved = localStorage.getItem('bili_current_song');
    return saved ? JSON.parse(saved) : null;
  });

  // Save states to LocalStorage
  useEffect(() => {
    localStorage.setItem('bili_playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem('bili_sessdata', sessdata);
  }, [sessdata]);

  useEffect(() => {
    localStorage.setItem('bili_player_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('bili_current_song', currentSong ? JSON.stringify(currentSong) : '');
  }, [currentSong]);

  useEffect(() => {
    localStorage.setItem('bili_setting_auto_next', String(autoNext));
  }, [autoNext]);

  useEffect(() => {
    localStorage.setItem('bili_setting_buffer', String(countdownBuffer));
  }, [countdownBuffer]);

  useEffect(() => {
    localStorage.setItem('bili_setting_hide_danmaku', String(hideDanmaku));
  }, [hideDanmaku]);

  useEffect(() => {
    localStorage.setItem('bili_setting_hq', String(highQuality));
  }, [highQuality]);

  useEffect(() => {
    localStorage.setItem('bili_setting_audio_only', String(audioOnlyMode));
  }, [audioOnlyMode]);

  useEffect(() => {
    localStorage.setItem('bili_setting_shuffle', shuffleMode);
  }, [shuffleMode]);

  // Handle active tab switching when mini mode triggers
  useEffect(() => {
    if (isMiniCDMode) {
      setActiveTab('player');
    }
  }, [isMiniCDMode]);



  // Hide opening logo splash screen after 2.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Combined active songs pool
  const allActiveSongs = useMemo(() => {
    const songs: Song[] = [];
    playlists.forEach((p) => {
      if (p.isLoaded && p.songs.length > 0) {
        songs.push(...p.songs);
      }
    });
    return songs;
  }, [playlists]);

  // Track uploader play counts or local counts
  const incrementPlayCount = (bvid: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => ({
        ...pl,
        songs: pl.songs.map((song) => {
          if (song.bvid === bvid) {
            return { ...song, playCount: (song.playCount || 0) + 1 };
          }
          return song;
        }),
      }))
    );
  };

  // Play a specific song
  const handlePlaySong = (song: Song) => {
    setCurrentSong(song);
    
    // Add to History
    const historyItem: PlaybackHistoryItem = {
      id: `${song.bvid}-${Date.now()}`,
      bvid: song.bvid,
      title: song.title,
      cover: song.cover,
      author: song.author,
      playedAt: Date.now(),
      playlistName: song.playlistName,
    };
    
    setHistory((prev) => [historyItem, ...prev.slice(0, 49)]); // Keep top 50 history
    setActiveTab('player'); // automatic switch to player view
  };

  // Play a song by BVID (helper for history)
  const handlePlaySongByBvid = (bvid: string) => {
    const song = allActiveSongs.find((s) => s.bvid === bvid);
    if (song) {
      handlePlaySong(song);
    }
  };

  // Core random playback logic: Random cross-playlist switching
  const playNextSong = () => {
    if (allActiveSongs.length === 0) {
      return;
    }

    if (allActiveSongs.length === 1) {
      handlePlaySong(allActiveSongs[0]);
      return;
    }

    let nextSong: Song | null = null;

    if (shuffleMode === 'pure' || playlists.filter(p => p.isLoaded && p.songs.length > 0).length <= 1) {
      // Pure Random Mode
      let attempts = 0;
      do {
        const randomIndex = Math.floor(Math.random() * allActiveSongs.length);
        nextSong = allActiveSongs[randomIndex];
        attempts++;
      } while (nextSong.bvid === currentSong?.bvid && attempts < 15);
    } else {
      // Balanced Random Mode: First pick a random loaded playlist, then pick a random song inside it.
      // This ensures folder-level balancing (prevents folders with 990 songs from totally overwhelming folders with 50 songs)
      const activePlaylists = playlists.filter((p) => p.isLoaded && p.songs.length > 0);
      let attempts = 0;
      do {
        const randomPl = activePlaylists[Math.floor(Math.random() * activePlaylists.length)];
        const randomSong = randomPl.songs[Math.floor(Math.random() * randomPl.songs.length)];
        nextSong = randomSong;
        attempts++;
      } while (nextSong.bvid === currentSong?.bvid && attempts < 15);
    }

    if (nextSong) {
      handlePlaySong(nextSong);
    }
  };

  // Previous song logic (based on local playback history stack)
  const playPrevSong = () => {
    if (history.length <= 1) return;

    // The first item in history is the currently playing song
    // We want to find the second item and play it
    const previousBvid = history[1]?.bvid;
    const song = allActiveSongs.find((s) => s.bvid === previousBvid);
    
    if (song) {
      // Remove current song from history top to avoid duplicate pushing
      setHistory((prev) => prev.slice(1));
      setCurrentSong(song);
      incrementPlayCount(song.bvid);
    } else {
      // If song is not loaded anymore, skip it
      setHistory((prev) => prev.slice(1));
    }
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <div id="root-app-container" className="min-h-screen bg-[#050507] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Opening Logo Splash screen */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="fixed inset-0 bg-[#020204] z-[9999] flex flex-col items-center justify-center text-center overflow-hidden"
          >
            {/* Background ambient light */}
            <div className="absolute w-[450px] h-[450px] bg-cyan-500/10 blur-[120px] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute w-[300px] h-[300px] bg-pink-500/10 blur-[100px] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
            
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.05, opacity: 0 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="relative flex flex-col items-center space-y-6 max-w-md px-6"
            >
              {/* Glowing Logo Icon */}
              <div className="relative">
                {/* Animated vinyl groove halo */}
                <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl animate-pulse"></div>
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-[#08080c] to-[#12121e] border-2 border-cyan-500/30 flex items-center justify-center shadow-2xl">
                  <Music className="w-10 h-10 text-cyan-400 animate-bounce" />
                  <div className="absolute inset-2 border border-dashed border-pink-500/20 rounded-full animate-spin [animation-duration:12s]"></div>
                </div>
              </div>

              {/* Dynamic Typographic Title */}
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-black font-sans tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-pink-400 uppercase">
                  BILI RANDOM MUSIC
                </h1>
                <p className="text-xs font-mono tracking-[0.4em] text-slate-450 uppercase">
                  哔哩哔哩 随心听歌房
                </p>
              </div>

              {/* Loading Progress Line */}
              <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2.2, ease: 'easeInOut' }}
                  className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-pink-500"
                ></motion.div>
              </div>

              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest animate-pulse">
                Initializing Engine...
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Upper Navigation Header bar */}
      {!isMiniCDMode && (
        <header id="app-header-navigation" className="bg-[#0a0a0f] border-b border-white/5 sticky top-0 z-50 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Logo brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-pink-500 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Radio className="w-5 h-5 text-slate-950 font-black animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-[0.15em] text-white font-mono uppercase">
                    BILI-RANDOMIZER
                  </h1>
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded font-mono text-cyan-400">v1.05</span>
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
                  突破单收藏夹 1000 上限 · 跨歌单无缝随机
                </p>
              </div>
            </div>

            {/* Tab buttons */}
            <nav className="flex items-center bg-[#050507] border border-white/5 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('player')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'player'
                    ? 'bg-gradient-to-r from-cyan-500/10 to-pink-500/10 text-white border border-cyan-400/20 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Radio className="w-4 h-4" />
                <span>播放器</span>
                {currentSong && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('songlist')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'songlist'
                    ? 'bg-gradient-to-r from-cyan-500/10 to-pink-500/10 text-white border border-cyan-400/20 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Music className="w-4 h-4" />
                <span>融合曲库 ({allActiveSongs.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('playlists')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'playlists'
                    ? 'bg-gradient-to-r from-cyan-500/10 to-pink-500/10 text-white border border-cyan-400/20 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <FolderHeart className="w-4 h-4" />
                <span>歌单管理 ({playlists.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('stats')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'stats'
                    ? 'bg-gradient-to-r from-cyan-500/10 to-pink-500/10 text-white border border-cyan-400/20 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>曲库统计</span>
              </button>
            </nav>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main id="app-main-content" className={isMiniCDMode ? "flex-1 flex flex-col justify-center items-center p-4 relative" : "flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative"}>
        
        {/* Quick reminder when no folders are loaded */}
        {playlists.length === 0 && activeTab !== 'playlists' && (
          <div className="bg-amber-500/5 border border-amber-500/20 text-amber-400 rounded-2xl p-4 flex items-start gap-3 mb-6 max-w-2xl mx-auto">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h5 className="font-bold">您还没有配置任何 B 站收藏夹！</h5>
              <p className="opacity-90">
                请先前往 <strong>“歌单管理”</strong> 页面，添加您的收藏夹 ID (可以添加多个 1000 首极限歌单)，然后进行数据同步。
              </p>
              <button
                onClick={() => setActiveTab('playlists')}
                className="text-amber-300 hover:text-amber-200 font-bold underline block pt-1 cursor-pointer"
              >
                立即去配置收藏夹 &gt;&gt;
              </button>
            </div>
          </div>
        )}

        {/* Tab display views: Player View container */}
        <div className={isMiniCDMode ? "w-full max-w-sm flex justify-center animate-in fade-in zoom-in duration-300" : (activeTab === 'player' ? "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" : "hidden")}>
          
          {/* Embedded Active Player */}
          <div className={isMiniCDMode ? "w-full" : "lg:col-span-8"}>
            <Player
              currentSong={currentSong}
              onNext={playNextSong}
              onPrev={playPrevSong}
              history={history}
              autoNext={autoNext}
              setAutoNext={setAutoNext}
              countdownBuffer={countdownBuffer}
              setCountdownBuffer={setCountdownBuffer}
              hideDanmaku={hideDanmaku}
              setHideDanmaku={setHideDanmaku}
              highQuality={highQuality}
              setHighQuality={setHighQuality}
              incrementPlayCount={incrementPlayCount}
              audioOnlyMode={audioOnlyMode}
              setAudioOnlyMode={setAudioOnlyMode}
              isMiniCDMode={isMiniCDMode}
              setIsMiniCDMode={setIsMiniCDMode}
            />
          </div>

          {/* Config & Shuffle Controller (Right-side col-span-4) */}
          <div className={(!isMiniCDMode && activeTab === 'player') ? "lg:col-span-4 space-y-6" : "hidden"}>
              
              {/* Randomization Modes Controller */}
              <div className="bg-[#08080c] border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
                <h3 className="font-bold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-[0.2em] border-b border-white/5 pb-3 font-mono">
                  <Shuffle className="w-4 h-4 text-cyan-400" />
                  随机算法配置
                </h3>

                <div className="space-y-3">
                  <button
                    onClick={() => setShuffleMode('pure')}
                    className={`w-full p-4 rounded-xl text-left border transition-all cursor-pointer block ${
                      shuffleMode === 'pure'
                        ? 'bg-cyan-500/5 border-cyan-500/30 text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.1)]'
                        : 'bg-[#050507] border-white/5 hover:border-white/10 text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5 font-mono uppercase tracking-wider">
                      <span>🎲 纯净全曲库随机 (Pure)</span>
                      {shuffleMode === 'pure' && (
                        <span className="text-[9px] bg-cyan-400 text-slate-950 px-1 rounded font-bold">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-75 mt-2 leading-relaxed">
                      将所有收藏夹的视频统一合并，在总曲库里完全等概率挑选下一首。
                    </p>
                  </button>

                  <button
                    onClick={() => setShuffleMode('balanced')}
                    className={`w-full p-4 rounded-xl text-left border transition-all cursor-pointer block ${
                      shuffleMode === 'balanced'
                        ? 'bg-pink-500/5 border-pink-500/30 text-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.1)]'
                        : 'bg-[#050507] border-white/5 hover:border-white/10 text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5 font-mono uppercase tracking-wider">
                      <span>⚖️ 文件夹均衡随机 (Balanced)</span>
                      {shuffleMode === 'balanced' && (
                        <span className="text-[9px] bg-pink-400 text-slate-950 px-1 rounded font-bold">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-75 mt-2 leading-relaxed">
                      先随机抽选一个歌单文件夹，再在其中随机抽歌曲。避免巨型文件夹淹没小文件夹。
                    </p>
                  </button>
                </div>
              </div>

              {/* Launcher Info */}
              <div className="bg-[#08080c] border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
                <h3 className="font-bold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-[0.2em] border-b border-white/5 pb-3 font-mono">
                  <HelpCircle className="w-4 h-4 text-cyan-400" />
                  使用指南与帮助
                </h3>
                <ul className="space-y-2 text-xs text-slate-450 leading-relaxed list-disc list-inside">
                  <li><strong>关于跨域</strong>: B站限制了网页直接调用 API，本工具通过后端代理服务进行加载，保证 100% 数据成功拉取。</li>
                  <li><strong>关于多歌单</strong>: 添加完毕后，可自由进行“同步数据”。同步后的歌曲会保存在您浏览器本地缓存中。</li>
                  <li><strong>切歌倒计时</strong>: 由于无法跨域读取B站视频结束事件，本工具获取视频的时长数据并进行实时秒数计时，结束后自动随机下一首！</li>
                  <li><strong>缓冲补偿</strong>: 如果发现视频缓冲较慢，可在设置中调大切歌延时缓冲(例如 3~5 秒)或者使用微调计时按钮。</li>
                </ul>
              </div>

            </div>
        </div>

        {activeTab === 'songlist' && (
          <SongList
            playlists={playlists.filter((p) => p.isLoaded)}
            onPlaySong={handlePlaySong}
            currentSong={currentSong}
          />
        )}

        {activeTab === 'playlists' && (
          <PlaylistConfigComponent
            playlists={playlists}
            setPlaylists={setPlaylists}
            sessdata={sessdata}
            setSessdata={setSessdata}
          />
        )}

        {activeTab === 'stats' && (
          <StatsDashboard
            playlists={playlists}
            history={history}
            onPlaySongByBvid={handlePlaySongByBvid}
            clearHistory={clearHistory}
          />
        )}

      </main>

      {/* Footer bar */}
      <footer id="app-footer" className="bg-[#0a0a0f] border-t border-white/5 py-6 text-center text-xs text-slate-500 font-mono">
        <p>© 2026 B站收藏夹融合随机播放器. All media streams processed locally. Designed with Immersive UI.</p>
      </footer>
    </div>
  );
}
