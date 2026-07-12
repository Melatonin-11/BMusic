import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PlaylistConfig, Song } from '../types';
import { Play, RotateCw, Trash2, ShieldAlert, Key, HelpCircle, FolderHeart, Plus, CheckCircle2, AlertCircle, Eye, EyeOff, Copy, Check, Edit2, X } from 'lucide-react';
import { encodePlaylistBackup, parsePlaylistBackup } from '../utils/playlistImport';
import { remainingPageBatches } from '../utils/pagination';

interface PlaylistConfigProps {
  playlists: PlaylistConfig[];
  setPlaylists: (playlists: PlaylistConfig[]) => void;
  sessdata: string;
  setSessdata: (sessdata: string) => void;
}

const fetchBilibiliNav = () => invoke<any>('bilibili_nav');

const fetchBilibiliPlaylist = async (
  mediaId: string,
  page: number,
  pageSize: number
) => {
  return invoke<any>('bilibili_playlist', { mediaId, pn: page, ps: pageSize });
};

export default function PlaylistConfigComponent({
  playlists,
  setPlaylists,
  sessdata,
  setSessdata,
}: PlaylistConfigProps) {
  const [newMediaId, setNewMediaId] = useState('');
  const [newCustomName, setNewCustomName] = useState('');
  const [showCookieHelp, setShowCookieHelp] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Record<string, {
    status: 'idle' | 'fetching_page_1' | 'fetching_pages' | 'done' | 'error';
    progress: number;
    total: number;
    loaded: number;
    errorMsg?: string;
  }>>({});
  const [userProfile, setUserProfile] = useState<{ uname?: string; face?: string; isLogin?: boolean } | null>(null);
  const [verifyingCookie, setVerifyingCookie] = useState(false);
  const [hasSavedCredential, setHasSavedCredential] = useState(false);
  const [showSessdata, setShowSessdata] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // Backup & Restore states
  const [isCopied, setIsCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<{ status: 'idle' | 'success' | 'error'; msg?: string }>({ status: 'idle' });

  // Rename states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  // Backup IDs, custom names and active/inactive selection.
  const currentBackupCode = useMemo(() => {
    return encodePlaylistBackup(playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      isActive: playlist.isActive !== false,
    })));
  }, [playlists]);

  const handleCopyBackup = () => {
    if (!currentBackupCode) return;
    navigator.clipboard.writeText(currentBackupCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleImportBackup = () => {
    const code = importText.trim();
    if (!code) {
      setImportStatus({ status: 'error', msg: '请输入备份代码或公开收藏夹ID！' });
      return;
    }
    try {
      const importedItems = parsePlaylistBackup(code);

      if (importedItems.length > 0) {
        // Create new playlist configs for the imported IDs
        // Preserve any existing playlists and merge unique ones
        const existingMap = new Map(playlists.map((playlist, index) => [playlist.id, index]));
        const mergedPlaylists = [...playlists];

        let addedCount = 0;
        importedItems.forEach((item) => {
          const existingIndex = existingMap.get(item.id);
          if (existingIndex === undefined) {
            mergedPlaylists.push({
              id: item.id,
              name: item.name || `已导入收藏夹 (${item.id})`,
              videoCount: 0,
              isLoaded: false,
              isActive: item.isActive !== false,
              songs: [],
            });
            addedCount++;
          } else {
            const existing = mergedPlaylists[existingIndex];
            mergedPlaylists[existingIndex] = {
              ...existing,
              name: item.name || existing.name,
              isActive: item.isActive !== false,
            };
          }
        });

        setPlaylists(mergedPlaylists);
        setImportStatus({
          status: 'success',
          msg: `恢复成功！读取到 ${importedItems.length} 个收藏夹及其命名（其中 ${addedCount} 个为新加入，请点击“同步数据”拉取内容）。`
        });
        setImportText('');
        setTimeout(() => setImportStatus({ status: 'idle' }), 5000);
      } else {
        setImportStatus({ status: 'error', msg: '无法识别的代码格式。请提供纯数字B站收藏夹ID或精简16位短代码。' });
      }
    } catch (err) {
      setImportStatus({ status: 'error', msg: '备份代码还原失败，请确认格式是否正确。' });
    }
  };

  // Verify Bilibili cookie
  const verifyCookie = async () => {
    setVerifyingCookie(true);
    try {
      const data = await fetchBilibiliNav();
      if (data.code === 0 && data.data?.isLogin) {
        setUserProfile({
          uname: data.data.uname,
          face: data.data.face,
          isLogin: true,
        });
      } else {
        setUserProfile({ isLogin: false });
      }
    } catch (e) {
      console.error('Failed to verify B站 cookie:', e);
      setUserProfile(null);
    } finally {
      setVerifyingCookie(false);
    }
  };

  useEffect(() => {
    invoke<boolean>('credential_has_sessdata').then((hasCredential) => {
      setHasSavedCredential(hasCredential);
      if (hasCredential) verifyCookie();
    }).catch(console.error);
  }, []);

  const saveCredential = async () => {
    if (sessdata.trim()) {
      await invoke('credential_save_sessdata', { sessdata: sessdata.trim() });
      setHasSavedCredential(true);
      await verifyCookie();
      setSessdata('');
    }
  };

  const deleteCredential = async () => {
    await invoke('credential_delete_sessdata');
    setSessdata('');
    setHasSavedCredential(false);
    setUserProfile(null);
  };

  const addPlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    const id = newMediaId.trim();
    if (!id) return;

    // Check duplicate
    if (playlists.some((p) => p.id === id)) {
      setAddError('该收藏夹已在列表中！');
      setTimeout(() => setAddError(null), 3000);
      return;
    }

    const newPlaylist: PlaylistConfig = {
      id,
      name: newCustomName.trim() || `未命名收藏夹 (${id})`,
      videoCount: 0,
      isLoaded: false,
      isActive: true,
      songs: [],
    };

    setPlaylists([...playlists, newPlaylist]);
    setNewMediaId('');
    setNewCustomName('');
    setAddError(null);
  };

  const removePlaylist = (id: string) => {
    setPlaylists(playlists.filter((p) => p.id !== id));
    const newLoading = { ...loadingStates };
    delete newLoading[id];
    setLoadingStates(newLoading);
    setConfirmDeleteId(null);
  };

  const togglePlaylistActive = (id: string) => {
    setPlaylists(playlists.map((playlist) => (
      playlist.id === id ? { ...playlist, isActive: playlist.isActive === false } : playlist
    )));
  };

  const handleRename = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    
    setPlaylists(
      playlists.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            name: trimmed,
            songs: p.songs.map((song) => ({
              ...song,
              playlistName: trimmed,
            })),
          };
        }
        return p;
      })
    );
    setEditingId(null);
  };

  // Safe paginated batch loader to prevent B站 API rate limiting
  const syncPlaylist = async (playlistId: string) => {
    setLoadingStates((prev) => ({
      ...prev,
      [playlistId]: { status: 'fetching_page_1', progress: 0, total: 0, loaded: 0 },
    }));

    try {
      // Step 1: Fetch Page 1 to see total count and verify folder name
      const firstPageData = await fetchBilibiliPlaylist(playlistId, 1, 20);

      if (firstPageData.code !== 0) {
        throw new Error(firstPageData.message || `API错误代码: ${firstPageData.code}`);
      }

      const info = firstPageData.data.info;
      const originalName = info?.title || `收藏夹-${playlistId}`;
      const totalVideos = info?.media_count || 0;
      const playlistCover = info?.cover || '';

      const firstPageMedias = firstPageData.data.medias || [];
      let loadedSongs: Song[] = firstPageMedias.map((m: any) => ({
        id: m.id,
        bvid: m.bvid || m.bv_id,
        title: m.title,
        cover: m.cover,
        duration: m.duration,
        author: m.upper?.name || '未知UP主',
        authorId: m.upper?.mid || 0,
        authorFace: m.upper?.face || '',
        favTime: m.fav_time || 0,
        playlistId,
        playlistName: originalName,
        playCount: 0,
      }));

      if (totalVideos <= 20 || loadedSongs.length >= totalVideos) {
        // Only 1 page or already fetched all
        updatePlaylistWithSongs(playlistId, originalName, playlistCover, totalVideos, loadedSongs);
        return;
      }

      // Step 2: Set up batching for remaining pages
      const pageSize = 20;
      const totalPages = Math.ceil(totalVideos / pageSize);
      
      setLoadingStates((prev) => ({
        ...prev,
        [playlistId]: {
          status: 'fetching_pages',
          progress: Math.round((1 / totalPages) * 100),
          total: totalVideos,
          loaded: loadedSongs.length,
        },
      }));

      // Create chunks of page requests to run sequentially with small gaps
      const allSongs: Song[] = [...loadedSongs];
      const concurrencyLimit = 3; // 3 requests at a time
      const delayMs = 300; // 300ms gap between batches to prevent B站 IP blocks

      const fetchPage = async (page: number): Promise<Song[]> => {
        const data = await fetchBilibiliPlaylist(playlistId, page, pageSize);
        if (data.code !== 0) {
          throw new Error(`获取第 ${page} 页失败: ${data.message || '未知API错误'}`);
        }
        const medias = data.data.medias || [];
        return medias.map((m: any) => ({
          id: m.id,
          bvid: m.bvid || m.bv_id,
          title: m.title,
          cover: m.cover,
          duration: m.duration,
          author: m.upper?.name || '未知UP主',
          authorId: m.upper?.mid || 0,
          authorFace: m.upper?.face || '',
          favTime: m.fav_time || 0,
          playlistId,
          playlistName: originalName,
          playCount: 0,
        }));
      };

      // Execute pages in concurrent batches
      for (const batchPages of remainingPageBatches(totalVideos, pageSize, concurrencyLimit)) {
        
        // Wait between batches
        if (batchPages[0] > 2) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        const results = await Promise.all(batchPages.map((page) => fetchPage(page)));
        results.forEach((songs) => {
          allSongs.push(...songs);
        });

        const currentLoaded = allSongs.length;
        setLoadingStates((prev) => ({
          ...prev,
          [playlistId]: {
            ...prev[playlistId],
            progress: Math.round((batchPages[batchPages.length - 1] / totalPages) * 100),
            loaded: currentLoaded,
          },
        }));
      }

      // Deduplicate songs by bvid just in case
      const uniqueSongsMap = new Map<string, Song>();
      allSongs.forEach((song) => {
        if (song.bvid) {
          uniqueSongsMap.set(song.bvid, song);
        }
      });
      const uniqueSongs = Array.from(uniqueSongsMap.values());

      updatePlaylistWithSongs(playlistId, originalName, playlistCover, totalVideos, uniqueSongs);
    } catch (error: any) {
      console.error('Sync playlist failed:', error);
      setLoadingStates((prev) => ({
        ...prev,
        [playlistId]: {
          ...prev[playlistId],
          status: 'error',
          errorMsg: error.message || '获取失败，请检查SESSDATA或网络',
        },
      }));
    }
  };

  const updatePlaylistWithSongs = (
    id: string,
    name: string,
    cover: string,
    count: number,
    songs: Song[]
  ) => {
    setPlaylists(
      playlists.map((p) => {
        if (p.id === id) {
          const finalName = p.name.startsWith('未命名') ? name : p.name;
          const previousCounts = new Map(p.songs.map((song) => [song.bvid, song.playCount || 0]));
          return {
            ...p,
            name: finalName,
            cover: cover || p.cover,
            videoCount: count,
            isLoaded: true,
            songs: songs.map((s) => ({
              ...s,
              playlistName: finalName,
              playCount: previousCounts.get(s.bvid) || 0,
            })),
          };
        }
        return p;
      })
    );

    setLoadingStates((prev) => ({
      ...prev,
      [id]: { status: 'done', progress: 100, total: count, loaded: songs.length },
    }));
  };

  return (
    <div id="playlist-config-container" className="space-y-6">
      {/* Cookie Setup Block */}
      <div id="cookie-config-card" className="bg-[#08080c] border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-cyan-400 to-blue-500"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono uppercase tracking-wider">
              <Key className="w-5 h-5 text-cyan-400" />
              B站凭证配置 (SESSDATA)
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              因为您的收藏夹通常是<strong>私密</strong>状态 (带🔒图标)，必须配置B站网页端的 SESSDATA Cookie 才能成功读取内部歌曲列表。
            </p>
          </div>
          <button
            onClick={() => setShowCookieHelp(!showCookieHelp)}
            className="self-start md:self-auto flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-350 transition-colors py-1.5 px-3 bg-[#050507] border border-white/5 rounded-lg hover:border-white/10 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            如何获取？
          </button>
        </div>

        {showCookieHelp && (
          <div id="cookie-tutorial" className="mt-4 p-4 bg-[#050507] border border-white/5 rounded-xl space-y-3 text-xs text-slate-400">
            <h4 className="font-semibold text-slate-200">🛠️ 获取 SESSDATA 详细步骤：</h4>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-400 leading-relaxed">
              <li>在电脑浏览器中访问并登录 <a href="https://www.bilibili.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline">Bilibili 官网</a>。</li>
              <li>在页面任意位置按下 <kbd className="px-1.5 py-0.5 bg-slate-900 text-slate-100 rounded text-[10px]">F12</kbd> (或右键点击“检查/审查元素”) 打开开发者工具。</li>
              <li>点击上方菜单栏中的 <strong>Application (应用)</strong> 或 <strong>Storage (存储)</strong> 选项卡。</li>
              <li>在左侧展开 <strong>Cookies</strong>，点击 <code>https://www.bilibili.com</code>。</li>
              <li>在右侧列表中找到 <code>SESSDATA</code> 这一项，复制它对应的 Value (一长串字母与数字)。</li>
              <li>粘贴到下方的输入框中即可 (仅保存在您的浏览器本地，不会上传至任何第三方服务器)。</li>
            </ol>
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full">
            <input
              type={showSessdata ? 'text' : 'password'}
              placeholder="请输入 SESSDATA 字符串"
              value={sessdata}
              onChange={(e) => setSessdata(e.target.value)}
              onBlur={() => void saveCredential()}
              onKeyDown={(e) => { if (e.key === 'Enter') void saveCredential(); }}
              className="w-full pl-10 pr-10 py-2 bg-[#050507] border border-white/5 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-400/50 transition-colors"
            />
            <Key className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-550" />
            <button
              type="button"
              onClick={() => setShowSessdata(!showSessdata)}
              className="absolute right-3 top-2.5 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title={showSessdata ? '隐藏 SESSDATA' : '显示 SESSDATA'}
            >
              {showSessdata ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="w-full sm:w-auto flex-shrink-0 flex items-center">
            {verifyingCookie ? (
              <span className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <RotateCw className="w-4 h-4 animate-spin text-cyan-400" />
                VERIFYING...
              </span>
            ) : userProfile?.isLogin ? (
              <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-xl">
                <img
                  src={userProfile.face}
                  alt={userProfile.uname}
                  className="w-5 h-5 rounded-full border border-cyan-400"
                  referrerPolicy="no-referrer"
                />
                <span className="text-xs font-semibold text-cyan-400 truncate max-w-[120px]">
                  {userProfile.uname}
                </span>
                <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              </div>
            ) : sessdata ? (
              <span className="flex items-center gap-1 text-xs text-rose-400 font-mono bg-rose-500/5 px-2.5 py-1 rounded-xl border border-rose-500/10">
                <AlertCircle className="w-4 h-4" />
                VERIFY_FAILED
              </span>
            ) : (
              <span className="text-[10px] text-amber-450 flex items-center gap-1 bg-amber-500/5 px-3 py-1.5 rounded-xl border border-amber-500/10">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                无 Cookie, 只能加载公开收藏夹
              </span>
            )}
          </div>
          {hasSavedCredential && (
            <button
              type="button"
              onClick={() => void deleteCredential()}
              className="text-[10px] text-rose-400 hover:text-rose-300 whitespace-nowrap cursor-pointer"
            >
              清除凭据
            </button>
          )}
        </div>
      </div>

      {/* Add New Playlist Form */}
      <div id="add-playlist-card" className="bg-[#08080c] border border-white/5 rounded-2xl p-6 shadow-xl">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4 font-mono uppercase tracking-wider">
          <FolderHeart className="w-5 h-5 text-cyan-400" />
          添加B站收藏夹
        </h2>
        <form onSubmit={addPlaylist} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">收藏夹 ID (media_id)</label>
            <input
              type="text"
              required
              placeholder="例如 1515234201"
              value={newMediaId}
              onChange={(e) => setNewMediaId(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2 bg-[#050507] border border-white/5 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-400/50 transition-colors"
            />
            <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
              通常在网页端收藏夹链接中，例如：<code>space.bilibili.com/xxxx/favlist?fid=<b>1515234201</b></code> 中的 fid 就是 ID。
            </p>
          </div>

          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">自定义别名 (非必填)</label>
            <input
              type="text"
              placeholder="例如：怀旧金曲歌单一"
              value={newCustomName}
              onChange={(e) => setNewCustomName(e.target.value)}
              className="w-full px-4 py-2 bg-[#050507] border border-white/5 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-400/50 transition-colors"
            />
            <p className="text-[10px] text-slate-500 leading-relaxed mt-1">设置一个便于记忆的名字，多歌单融合时更容易识别。</p>
          </div>

          <div className="flex-shrink-0 self-end">
            <button
              type="submit"
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white border border-cyan-400/30 hover:border-cyan-400/50 font-bold text-xs rounded-xl shadow-md hover:shadow-cyan-500/10 active:scale-95 transition-all cursor-pointer font-mono uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" />
              添加歌单
            </button>
          </div>
        </form>
        {addError && (
          <div className="mt-3 flex items-center gap-2 text-rose-400 text-xs font-semibold bg-rose-500/5 border border-rose-500/10 px-3.5 py-2.5 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{addError}</span>
          </div>
        )}
      </div>

      {/* Playlists Management List */}
      <div id="playlists-list-card" className="bg-[#08080c] border border-white/5 rounded-2xl p-6 shadow-xl">
        <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2 font-mono uppercase tracking-wider border-b border-white/5 pb-3">
          已配置的收藏夹 ({playlists.length} FOLDERS)
        </h3>

        {playlists.length === 0 ? (
          <div id="empty-playlists-notice" className="text-center py-10 border border-white/5 bg-[#050507] rounded-2xl">
            <FolderHeart className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-450 text-xs font-mono">NO CONFIGURED PLAYLISTS</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {playlists.map((playlist) => {
              const loading = loadingStates[playlist.id];
              return (
                <div
                  key={playlist.id}
                  className="bg-[#050507] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative w-12 h-12 rounded-lg bg-[#08080c] flex-shrink-0 overflow-hidden border border-white/5 flex items-center justify-center">
                      {playlist.cover ? (
                        <img
                          src={playlist.cover}
                          alt={playlist.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <FolderHeart className="w-6 h-6 text-slate-600" />
                      )}
                      {playlist.isLoaded && (
                        <span className="absolute bottom-0 right-0 bg-cyan-400 text-[9px] text-slate-950 px-1 font-bold rounded-tl-md font-mono">
                          LOADED
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {editingId === playlist.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleRename(playlist.id, editingName);
                            }}
                            className="flex items-center gap-1 bg-[#08080c] border border-cyan-500/30 rounded-lg px-2 py-1 max-w-full"
                          >
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="bg-transparent text-slate-100 text-xs font-bold outline-none border-none py-0 px-1 w-32 sm:w-48 text-left"
                              autoFocus
                              maxLength={40}
                            />
                            <button
                              type="submit"
                              className="p-1 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                              title="保存"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                              title="取消"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        ) : (
                          <div className="flex items-center gap-2 group max-w-full">
                            <h4 className="font-bold text-slate-200 text-sm truncate">{playlist.name}</h4>
                            <button
                              onClick={() => {
                                setEditingId(playlist.id);
                                setEditingName(playlist.name);
                              }}
                              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-cyan-400 rounded transition-all duration-250 cursor-pointer flex items-center justify-center"
                              title="重命名"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <span className="text-[9px] bg-white/5 border border-white/5 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                          ID: {playlist.id}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-450 mt-1 font-mono">
                        {playlist.isLoaded
                          ? `STATS: ${playlist.songs.length} TRACKS LOADED`
                          : 'STATUS: NOT LOADED - SYNC REQUIRED'}
                      </p>
                    </div>
                  </div>

                  {/* Right Actions & Loading Progress */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 min-w-[200px]">
                    {loading && loading.status !== 'done' && loading.status !== 'error' && (
                      <div className="flex-1 min-w-[120px] space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>
                            {loading.status === 'fetching_page_1'
                              ? 'LOADING HEADER...'
                              : `FETCHED ${loading.loaded}/${loading.total}`}
                          </span>
                          <span className="font-mono text-cyan-400">{loading.progress}%</span>
                        </div>
                        <div className="w-full bg-[#08080c] h-1 rounded-full overflow-hidden border border-white/5">
                          <div
                            className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-300"
                            style={{ width: `${loading.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {loading?.status === 'error' && (
                      <span className="text-[10px] text-rose-450 max-w-[180px] truncate font-mono" title={loading.errorMsg}>
                        ERR: {loading.errorMsg}
                      </span>
                    )}

                    <div className="flex items-center gap-2 justify-end self-end sm:self-auto">
                      <label className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-slate-300 bg-[#08080c] border border-white/5 rounded-lg cursor-pointer select-none whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={playlist.isActive !== false}
                          onChange={() => togglePlaylistActive(playlist.id)}
                          className="accent-cyan-500"
                        />
                        加入融合曲库
                      </label>
                      <button
                        onClick={() => syncPlaylist(playlist.id)}
                        disabled={loading && loading.status !== 'done' && loading.status !== 'error'}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#08080c] hover:bg-slate-900 text-cyan-400 border border-white/5 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${(loading && loading.status !== 'done' && loading.status !== 'error') ? 'animate-spin text-cyan-400' : 'text-cyan-455'}`} />
                        {playlist.isLoaded ? '重新同步' : '同步数据'}
                      </button>

                      {confirmDeleteId === playlist.id ? (
                        <button
                          onClick={() => removePlaylist(playlist.id)}
                          className="px-2.5 py-1.5 text-[10px] font-bold text-rose-450 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-all cursor-pointer font-mono"
                          title="再次点击确认删除此收藏夹"
                        >
                          确认删除？
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setConfirmDeleteId(playlist.id);
                            // Auto-reset after 4 seconds
                            setTimeout(() => setConfirmDeleteId(prev => prev === playlist.id ? null : prev), 4000);
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-450 hover:bg-rose-500/5 rounded-lg transition-colors cursor-pointer"
                          title="删除歌单"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Backup & Restore Section */}
      <div id="backup-restore-section" className="bg-[#08080c] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono uppercase tracking-wider border-b border-white/5 pb-3">
          <FolderHeart className="w-4 h-4 text-cyan-400" />
          曲库配置备份与快速恢复 (防止数据丢失)
        </h3>
        
        <p className="text-xs text-slate-400 leading-relaxed">
          新版备份代码会保存收藏夹 ID、您的自定义命名以及是否加入融合曲库。因为包含名称，代码会比旧版纯 ID 短代码稍长；旧版短代码仍可继续导入。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Column 1: Export */}
          <div className="space-y-3 bg-[#050507] p-4 rounded-xl border border-white/5">
            <h4 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wide flex items-center justify-between">
              <span>📤 曲库配置备份代码</span>
              {currentBackupCode && (
                <button
                  onClick={handleCopyBackup}
                  className="flex items-center gap-1 text-[10px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-2 py-1 rounded cursor-pointer transition-colors"
                >
                  {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {isCopied ? '已复制' : '一键复制'}
                </button>
              )}
            </h4>
            {currentBackupCode ? (
              <textarea
                readOnly
                value={currentBackupCode}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full h-24 p-3 bg-black/40 border border-white/5 rounded-lg text-sm text-center tracking-widest text-cyan-400 font-mono font-bold focus:outline-none resize-none cursor-all"
                placeholder="同步完成后的曲库备份代码"
              />
            ) : (
              <div className="h-24 flex items-center justify-center border border-dashed border-white/5 rounded-lg text-slate-500 text-xs">
                暂无配置，请先添加歌单并同步数据
              </div>
            )}
            <p className="text-[10px] text-slate-500 font-mono">点击文本框可自动全选；包含收藏夹命名和融合曲库开关。</p>
          </div>

          {/* Column 2: Import */}
          <div className="space-y-3 bg-[#050507] p-4 rounded-xl border border-white/5">
            <h4 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wide">📥 快速恢复 (导入数值 / 收藏夹ID)</h4>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full h-24 p-3 bg-black/40 border border-white/5 rounded-lg text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500/30 transition-colors resize-none"
              placeholder="支持以下任意格式：&#10;1. 极简短代码 (如: 5PTSC9-HHP3U)&#10;2. 纯B站收藏夹ID (如: 346165557)&#10;3. 原来的旧版加密长代码"
            />
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] text-slate-500 font-mono">粘贴后点击右侧按钮进行数据还原</span>
              <button
                onClick={handleImportBackup}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-pink-500/10 to-rose-500/10 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                还原曲库
              </button>
            </div>
            
            {/* Status indicators */}
            {importStatus.status === 'success' && (
              <div className="mt-2 flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>{importStatus.msg}</span>
              </div>
            )}
            {importStatus.status === 'error' && (
              <div className="mt-2 flex items-center gap-1.5 text-rose-400 text-[11px] font-semibold bg-rose-500/5 border border-rose-500/10 p-2 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span>{importStatus.msg}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
