export interface Song {
  id: number;
  bvid: string;
  title: string;
  cover: string;
  duration: number; // in seconds
  author: string;
  authorId: number;
  authorFace: string;
  favTime: number; // timestamp
  playlistId: string;
  playlistName: string;
  playCount: number; // local statistics
}

export interface PlaylistConfig {
  id: string; // media_id
  name: string; // custom name or B站 fetched name
  cover?: string;
  videoCount: number;
  isLoaded: boolean;
  isActive?: boolean; // included in the current fused library; defaults to true
  songs: Song[];
}

export interface PlaybackHistoryItem {
  id: string; // unique history entry id
  bvid: string;
  title: string;
  cover: string;
  author: string;
  playedAt: number; // timestamp
  playlistName: string;
}

export interface PlayerSettings {
  sessdata: string; // B站 cookie SESSDATA
  autoNext: boolean; // whether to auto-trigger next song when duration expires
  countdownBuffer: number; // buffer in seconds to wait after duration before playing next
  hideDanmaku: boolean; // whether to disable danmaku in iframe
  highQuality: boolean; // whether to request high quality in iframe
  shuffleMode: 'pure' | 'balanced'; // 'pure' is completely random, 'balanced' avoids repeating same playlist if possible
}
