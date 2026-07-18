import { PlaylistConfig, Song } from '../types';

export function getActiveUniquePlaylists(playlists: PlaylistConfig[]): PlaylistConfig[] {
  const seenBvids = new Set<string>();
  return playlists.flatMap((playlist) => {
    if (playlist.isActive === false || !playlist.isLoaded || playlist.songs.length === 0) return [];
    const songs = playlist.songs.filter((song) => {
      if (!song.bvid || seenBvids.has(song.bvid)) return false;
      seenBvids.add(song.bvid);
      return true;
    });
    return songs.length > 0 ? [{ ...playlist, songs }] : [];
  });
}

export function getActiveUniqueSongs(playlists: PlaylistConfig[]): Song[] {
  return getActiveUniquePlaylists(playlists).flatMap((playlist) => playlist.songs);
}

export function pickNextSong(
  playlists: PlaylistConfig[],
  currentBvid: string | undefined,
  mode: 'pure' | 'balanced',
  random: () => number = Math.random,
): Song | null {
  const active = getActiveUniquePlaylists(playlists);
  const allSongs = active.flatMap((playlist) => playlist.songs);
  if (allSongs.length === 0) return null;
  if (allSongs.length === 1) return allSongs[0];

  if (mode === 'balanced' && active.length > 1) {
    const eligiblePlaylists = active
      .map((playlist) => ({
        ...playlist,
        songs: playlist.songs.filter((song) => song.bvid !== currentBvid),
      }))
      .filter((playlist) => playlist.songs.length > 0);
    const playlist = eligiblePlaylists[Math.floor(random() * eligiblePlaylists.length)];
    return playlist.songs[Math.floor(random() * playlist.songs.length)];
  }

  const eligibleSongs = allSongs.filter((song) => song.bvid !== currentBvid);
  return eligibleSongs[Math.floor(random() * eligibleSongs.length)];
}
