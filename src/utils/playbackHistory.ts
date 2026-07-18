import type { PlaybackHistoryItem, Song } from '../types';

export interface PlaybackTrailItem {
  bvid: string;
  playlistId?: string;
}

export function buildPlaybackTrail(
  history: PlaybackHistoryItem[],
  currentSong: Song | null,
): PlaybackTrailItem[] {
  if (history.length > 0) {
    return [...history].reverse().map((item) => ({
      bvid: item.bvid,
      playlistId: item.playlistId,
    }));
  }
  return currentSong ? [{ bvid: currentSong.bvid, playlistId: currentSong.playlistId }] : [];
}

export function findPreviousPlayableSong(
  trail: PlaybackTrailItem[],
  currentIndex: number,
  songs: Song[],
): { index: number; song: Song } | null {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const previous = trail[index];
    const song = songs.find((item) => (
      item.bvid === previous.bvid
      && (!previous.playlistId || item.playlistId === previous.playlistId)
    )) || songs.find((item) => item.bvid === previous.bvid);
    if (song) return { index, song };
  }
  return null;
}
