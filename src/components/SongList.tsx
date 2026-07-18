import React, { useState, useMemo } from 'react';
import { Song } from '../types';
import { Play, Search, Folder, User, Music, ArrowUpDown, Shuffle } from 'lucide-react';

interface SongListProps {
  playlists: { id: string; name: string; songs: Song[] }[];
  onPlaySong: (song: Song) => void;
  currentSong: Song | null;
}

export default function SongList({ playlists, onPlaySong, currentSong }: SongListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'duration' | 'favTime' | 'playCount'>('favTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const itemsPerPage = 50;

  // Flatten all songs from active playlists
  const allSongs = useMemo(() => {
    const list: Song[] = [];
    playlists.forEach((p) => {
      list.push(...p.songs);
    });
    return list;
  }, [playlists]);

  // Handle filtering
  const filteredSongs = useMemo(() => {
    let result = [...allSongs];

    // Filter by Playlist
    if (selectedPlaylistId !== 'all') {
      result = result.filter((song) => song.playlistId === selectedPlaylistId);
    }

    // Filter by Search Query (Title, Uploader)
    const query = searchTerm.toLowerCase().trim();
    if (query) {
      result = result.filter(
        (song) =>
          song.title.toLowerCase().includes(query) ||
          song.author.toLowerCase().includes(query) ||
          song.bvid.toLowerCase().includes(query)
      );
    }

    // Sort songs
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortBy === 'author') {
        comparison = a.author.localeCompare(b.author);
      } else if (sortBy === 'duration') {
        comparison = a.duration - b.duration;
      } else if (sortBy === 'favTime') {
        comparison = a.favTime - b.favTime;
      } else if (sortBy === 'playCount') {
        comparison = (a.playCount || 0) - (b.playCount || 0);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [allSongs, searchTerm, selectedPlaylistId, sortBy, sortOrder]);

  // Handle pagination
  const paginatedSongs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSongs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSongs, currentPage]);

  const totalPages = Math.ceil(filteredSongs.length / itemsPerPage);

  // Quick random select from filtered list
  const playRandomFromFiltered = () => {
    if (filteredSongs.length === 0) return;
    const randomIndex = Math.floor(Math.random() * filteredSongs.length);
    onPlaySong(filteredSongs[randomIndex]);
  };

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1); // Reset page on sort
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return '-';
    const date = new Date(ts * 1000);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const element = document.getElementById('song-list-top');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div id="song-list-top" className="bg-[#08080c] border border-white/5 rounded-3xl p-6 shadow-xl space-y-6">
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-mono uppercase tracking-wider">
            <Music className="w-5 h-5 text-cyan-400 animate-pulse" />
            融合曲库 ({allSongs.length} TRACKS)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            已融合 {playlists.length} 个收藏夹的歌曲视频，支持跨歌单检索与无缝随机播放。
          </p>
        </div>

        {filteredSongs.length > 0 && (
          <button
            onClick={playRandomFromFiltered}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-pink-500/20 text-white border border-cyan-400/30 hover:border-cyan-400/50 font-bold text-xs rounded-xl shadow-md hover:shadow-cyan-500/10 active:scale-95 transition-all cursor-pointer font-mono uppercase tracking-wider"
          >
            <Shuffle className="w-4 h-4 text-cyan-455" />
            <span>在当前筛选中随机挑选</span>
          </button>
        )}
      </div>

      {/* Search and Filters panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Search Input */}
        <div className="md:col-span-6 relative">
          <input
            type="text"
            placeholder="搜索歌曲标题、UP主、BVID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-[#050507] border border-white/5 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
          />
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-550" />
        </div>

        {/* Playlist Selector Filter */}
        <div className="md:col-span-6 flex gap-2">
          <div className="relative flex-1">
            <select
              value={selectedPlaylistId}
              onChange={(e) => {
                setSelectedPlaylistId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none px-4 py-2 bg-[#050507] border border-white/5 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors cursor-pointer"
            >
              <option value="all">📁 所有收藏夹</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  📁 {p.name} ({p.songs.length}首)
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* Main Songs Table */}
      {filteredSongs.length === 0 ? (
        <div id="no-filtered-songs" className="text-center py-16 border border-white/5 bg-[#050507] rounded-2xl">
          <Search className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">没有找到符合条件的歌曲</p>
          <p className="text-slate-500 text-xs mt-1">请尝试修改搜索词或添加更多收藏夹</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#050507]">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 text-xs font-bold uppercase tracking-widest bg-[#08080c]/60 font-mono">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-3">
                    <button
                      onClick={() => toggleSort('title')}
                      className="flex items-center gap-1 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      歌曲标题
                      <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                    </button>
                  </th>
                  <th className="py-3.5 px-3 w-40">
                    <button
                      onClick={() => toggleSort('author')}
                      className="flex items-center gap-1 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      UP主
                      <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                    </button>
                  </th>
                  <th className="py-3.5 px-3 w-36">所属文件夹</th>
                  <th className="py-3.5 px-3 w-20 text-right">
                    <button
                      onClick={() => toggleSort('duration')}
                      className="flex items-center gap-1 ml-auto hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      时长
                      <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                    </button>
                  </th>
                  <th className="py-3.5 px-3 w-32 text-right">
                    <button
                      onClick={() => toggleSort('favTime')}
                      className="flex items-center gap-1 ml-auto hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      收藏时间
                      <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                    </button>
                  </th>
                  <th className="py-3.5 px-3 w-20 text-right">
                    <button
                      onClick={() => toggleSort('playCount')}
                      className="flex items-center gap-1 ml-auto hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      播放数
                      <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedSongs.map((song, idx) => {
                  const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                  const isPlaying = currentSong?.bvid === song.bvid;

                  return (
                    <tr
                      key={song.id}
                      className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group ${
                        isPlaying ? 'bg-cyan-500/[0.04]' : ''
                      }`}
                    >
                      <td className="py-2 px-4 text-center text-xs font-mono text-slate-500">
                        {isPlaying ? (
                          <div className="flex items-center justify-center gap-0.5 h-3">
                            <span className="w-0.5 h-3 bg-cyan-400 animate-pulse"></span>
                            <span className="w-0.5 h-2 bg-cyan-400 animate-pulse delay-75"></span>
                            <span className="w-0.5 h-3.5 bg-cyan-400 animate-pulse delay-150"></span>
                          </div>
                        ) : (
                          globalIdx
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded bg-[#08080c] overflow-hidden flex-shrink-0 border border-white/5">
                            <img
                              src={song.cover}
                              alt={song.title}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              onClick={() => onPlaySong(song)}
                              className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <Play className="w-4 h-4 text-cyan-455 fill-cyan-455" />
                            </button>
                          </div>
                          <div className="min-w-0">
                            <button
                              onClick={() => onPlaySong(song)}
                              className={`font-medium text-sm hover:text-cyan-400 transition-colors text-left block truncate max-w-[320px] cursor-pointer ${
                                isPlaying ? 'text-cyan-400 font-bold' : 'text-slate-250'
                              }`}
                            >
                              {song.title}
                            </button>
                            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                              {song.bvid}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-xs truncate max-w-[120px]">
                        <span className="flex items-center gap-1" title={song.author}>
                          <User className="w-3 h-3 text-slate-650" />
                          {song.author}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-xs truncate max-w-[120px]">
                        <span className="flex items-center gap-1" title={song.playlistName}>
                          <Folder className="w-3 h-3 text-slate-650" />
                          {song.playlistName}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs text-slate-450">
                        {formatDuration(song.duration)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs text-slate-500">
                        {formatTimestamp(song.favTime)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs font-semibold text-cyan-450">
                        {song.playCount || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div id="song-list-pagination" className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <span className="text-xs text-slate-500 font-mono">
                SHOWING {(currentPage - 1) * itemsPerPage + 1} -{' '}
                {Math.min(currentPage * itemsPerPage, filteredSongs.length)} OF{' '}
                {filteredSongs.length} RECORDS
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#08080c] hover:bg-slate-900 border border-white/5 text-slate-300 rounded-lg disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  上一页
                </button>

                <div className="flex items-center gap-1 max-w-[180px] overflow-x-auto px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                    .map((p, idx, arr) => {
                      const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && <span className="text-slate-700 px-1 text-xs">...</span>}
                          <button
                            onClick={() => handlePageChange(p)}
                            className={`w-7 h-7 text-xs font-bold rounded-lg transition-colors flex items-center justify-center cursor-pointer ${
                              currentPage === p
                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 text-white shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                                : 'bg-[#08080c] hover:bg-slate-900 border border-white/5 text-slate-400'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#08080c] hover:bg-slate-900 border border-white/5 text-slate-300 rounded-lg disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
