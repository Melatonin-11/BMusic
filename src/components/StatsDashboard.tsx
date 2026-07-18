import React, { useMemo } from 'react';
import { PlaylistConfig, PlaybackHistoryItem } from '../types';
import { BarChart3, Clock, PlayCircle, Library, Award, History, Calendar, CheckSquare } from 'lucide-react';
import { getActiveUniquePlaylists } from '../utils/playback';

interface StatsDashboardProps {
  playlists: PlaylistConfig[];
  history: PlaybackHistoryItem[];
  onPlaySongByBvid: (bvid: string) => void;
  clearHistory: () => void;
}

export default function StatsDashboard({
  playlists,
  history,
  onPlaySongByBvid,
  clearHistory,
}: StatsDashboardProps) {
  // Aggregate stats
  const stats = useMemo(() => {
    let totalSongs = 0;
    let totalSeconds = 0;
    const authorCounts: Record<string, { count: number; avatar?: string }> = {};
    const playlistCounts: Record<string, { count: number; name: string }> = {};

    getActiveUniquePlaylists(playlists).forEach((p) => {
      totalSongs += p.songs.length;
      playlistCounts[p.id] = { count: p.songs.length, name: p.name };

      p.songs.forEach((s) => {
        totalSeconds += s.duration || 0;
        if (s.author) {
          if (!authorCounts[s.author]) {
            authorCounts[s.author] = { count: 0, avatar: s.authorFace };
          }
          authorCounts[s.author].count += 1;
        }
      });
    });

    // Sort authors to get Top 5
    const topAuthors = Object.entries(authorCounts)
      .map(([name, data]) => ({ name, count: data.count, avatar: data.avatar }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalSongs,
      totalDurationHours: Math.round((totalSeconds / 3600) * 10) / 10,
      averageDurationMinutes: totalSongs > 0 ? Math.round((totalSeconds / totalSongs / 60) * 10) / 10 : 0,
      topAuthors,
      playlistCounts: Object.values(playlistCounts),
    };
  }, [playlists]);

  const formatPlayedAt = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div id="stats-dashboard-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Metrics Cards Grid - lg:col-span-12 */}
      <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-[#08080c] border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-md relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 flex-shrink-0">
            <Library className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-wider">总歌曲数 TOTAL_TRACKS</span>
            <span className="text-xl font-black text-slate-100 font-mono mt-0.5 block">
              {stats.totalSongs} <span className="text-[10px] font-normal text-slate-500">PCS</span>
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#08080c] border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-md relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-wider">总时长 TOTAL_HOURS</span>
            <span className="text-xl font-black text-slate-100 font-mono mt-0.5 block">
              {stats.totalDurationHours} <span className="text-[10px] font-normal text-slate-500">HRS</span>
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#08080c] border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-md relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center text-violet-400 flex-shrink-0">
            <PlayCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-wider">平均时长 AVG_DURATION</span>
            <span className="text-xl font-black text-slate-100 font-mono mt-0.5 block">
              {stats.averageDurationMinutes} <span className="text-[10px] font-normal text-slate-500">MIN</span>
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#08080c] border border-white/5 rounded-2xl p-5 flex items-center gap-4 shadow-md relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-mono uppercase tracking-wider">启用收藏夹 ACTIVE_FOLDERS</span>
            <span className="text-xl font-black text-slate-100 font-mono mt-0.5 block">
              {playlists.filter((p) => p.isLoaded).length} <span className="text-[10px] text-slate-550">/ {playlists.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Playlist distribution and Top Uploaders */}
      <div className="lg:col-span-7 space-y-6">
        {/* Playlist Split Distribution Chart */}
        <div className="bg-[#08080c] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 border-b border-white/5 pb-3 font-mono uppercase tracking-wider">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            各收藏夹歌曲分布 (FUSION_SPLIT)
          </h3>
          {stats.totalSongs === 0 ? (
            <p className="text-xs text-slate-550 py-6 text-center font-mono">NO PLAYLIST DATA SYNCED</p>
          ) : (
            <div className="space-y-4 pt-1">
              {stats.playlistCounts.map((pl) => {
                const percent = stats.totalSongs > 0 ? Math.round((pl.count / stats.totalSongs) * 100) : 0;
                return (
                  <div key={pl.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-300 truncate max-w-[70%]">{pl.name}</span>
                      <span className="font-mono text-slate-450 text-[11px]">
                        {pl.count} TRACKS ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#050507] h-2.5 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Uploaders Card */}
        <div className="bg-[#08080c] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 border-b border-white/5 pb-3 font-mono uppercase tracking-wider">
            <Award className="w-5 h-5 text-cyan-400" />
            曲库常客 UP 主排行 (TOP_ARTISTS)
          </h3>
          {stats.topAuthors.length === 0 ? (
            <p className="text-xs text-slate-550 py-6 text-center font-mono">NO ARTISTS FOUND - PLEASE SYNC FOLDERS FIRST</p>
          ) : (
            <div className="divide-y divide-white/5 font-mono">
              {stats.topAuthors.map((author, index) => (
                <div key={author.name} className="flex items-center justify-between py-3 first:pt-1 last:pb-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-650 w-5">
                      [{index + 1}]
                    </span>
                    {author.avatar ? (
                      <img
                        src={author.avatar}
                        alt={author.name}
                        className="w-7 h-7 rounded-full border border-white/5"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#050507] border border-white/5 flex items-center justify-center text-xs font-bold text-cyan-400">
                        {author.name[0]}
                      </div>
                    )}
                    <span className="text-xs text-slate-300 font-sans font-medium">{author.name}</span>
                  </div>
                  <span className="text-[10px] bg-[#050507] text-slate-400 border border-white/5 px-2 py-0.5 rounded-lg">
                    {author.count} SONGS
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Local playback history timeline */}
      <div className="lg:col-span-5">
        <div className="bg-[#08080c] border border-white/5 rounded-2xl p-6 shadow-xl h-full flex flex-col">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono uppercase tracking-wider">
              <History className="w-5 h-5 text-cyan-400" />
              本地播放历史
            </h3>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-[10px] text-rose-450 hover:text-rose-400 cursor-pointer font-mono uppercase tracking-wider"
              >
                [CLEAR_ALL]
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-500">
              <History className="w-10 h-10 text-slate-700 mb-2" />
              <p className="text-xs font-mono">NO PLAYBACK RECORDS DETECTED</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[350px] space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/10">
              {history.map((item, index) => (
                <div
                  key={item.id || index}
                  className="flex gap-3 relative group"
                >
                  {/* Timeline node */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-cyan-400/70 border border-cyan-400 group-hover:scale-125 transition-transform mt-2 z-10"></div>
                    {index < history.length - 1 && (
                      <div className="w-[1px] bg-white/5 absolute top-4 bottom-0 left-1"></div>
                    )}
                  </div>

                  <div className="flex-1 bg-[#050507] hover:bg-[#0a0a0f] border border-white/5 hover:border-cyan-500/20 p-2.5 rounded-xl transition-all flex items-center gap-3">
                    <img
                      src={item.cover}
                      alt={item.title}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/5"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <button
                        onClick={() => onPlaySongByBvid(item.bvid)}
                        className="text-xs font-bold text-slate-200 hover:text-cyan-400 block text-left truncate cursor-pointer w-full"
                        title={item.title}
                      >
                        {item.title}
                      </button>
                      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 font-mono">
                        <span className="truncate max-w-[120px] font-sans">{item.author}</span>
                        <span className="flex items-center gap-1 text-slate-450">
                          <Calendar className="w-2.5 h-2.5" />
                          {formatPlayedAt(item.playedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
