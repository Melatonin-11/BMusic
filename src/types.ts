export interface Song {
  id: number;
  bvid: string;
  title: string;
  cover: string;
  duration: number;
  author: string;
  authorId: number;
  authorFace: string;
  favTime: number;
  playlistId: string;
  playlistName: string;
  playCount: number;
}

export interface PlaylistConfig {
  id: string;
  name: string;
  cover?: string;
  videoCount: number;
  isLoaded: boolean;
  isActive?: boolean;
  songs: Song[];
}

export interface PlaybackHistoryItem {
  id: string;
  bvid: string;
  title: string;
  cover: string;
  author: string;
  playedAt: number;
  playlistName: string;
  playlistId?: string;
}
