import { PlaylistConfig, Song } from '../types';

export function pickNextSong(
  playlists: PlaylistConfig[],
  currentBvid: string | undefined,
  mode: 'pure' | 'balanced',
  random: () => number = Math.random,
): Song | null {
  const active = playlists.filter((playlist) => playlist.isLoaded && playlist.songs.length > 0);
  const allSongs = active.flatMap((playlist) => playlist.songs);
  if (allSongs.length === 0) return null;
  if (allSongs.length === 1) return allSongs[0];

  let candidate: Song;
  let attempts = 0;
  do {
    if (mode === 'balanced' && active.length > 1) {
      const playlist = active[Math.floor(random() * active.length)];
      candidate = playlist.songs[Math.floor(random() * playlist.songs.length)];
    } else {
      candidate = allSongs[Math.floor(random() * allSongs.length)];
    }
    attempts += 1;
  } while (candidate.bvid === currentBvid && attempts < 15);
  return candidate;
}
