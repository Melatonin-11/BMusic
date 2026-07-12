import test from 'node:test';
import assert from 'node:assert/strict';
import { pickNextSong } from '../src/utils/playback.ts';
import { encodePlaylistBackup, parsePlaylistBackup, parsePlaylistIds } from '../src/utils/playlistImport.ts';
import { remainingPageBatches } from '../src/utils/pagination.ts';
import type { PlaylistConfig, Song } from '../src/types.ts';

const song = (bvid: string, playlistId: string): Song => ({
  id: 1, bvid, title: bvid, cover: '', duration: 60, author: '', authorId: 0,
  authorFace: '', favTime: 0, playlistId, playlistName: playlistId, playCount: 0,
});
const playlist = (id: string, songs: Song[]): PlaylistConfig => ({
  id, name: id, videoCount: songs.length, isLoaded: true, songs,
});

test('pure random avoids the current song when another song is available', () => {
  const items = [playlist('a', [song('BV1', 'a'), song('BV2', 'a')])];
  const values = [0, 0.9];
  assert.equal(pickNextSong(items, 'BV1', 'pure', () => values.shift() ?? 0.9)?.bvid, 'BV2');
});

test('balanced random chooses a playlist before choosing its song', () => {
  const items = [
    playlist('small', [song('SMALL', 'small')]),
    playlist('large', [song('L1', 'large'), song('L2', 'large')]),
  ];
  const values = [0.1, 0];
  assert.equal(pickNextSong(items, undefined, 'balanced', () => values.shift() ?? 0)?.bvid, 'SMALL');
});

test('playlist import parses decimal/base36 IDs and removes duplicates', () => {
  assert.deepEqual(parsePlaylistIds('123-3G-123'), ['123', String(Number.parseInt('3G', 36))]);
});

test('playlist import restores legacy base64 JSON', () => {
  const backup = btoa(encodeURIComponent(JSON.stringify([{ id: '123' }, { id: 456 }])));
  assert.deepEqual(parsePlaylistIds(backup), ['123', '456']);
});

test('new backup preserves custom names and active selection', () => {
  const code = encodePlaylistBackup([
    { id: '123', name: '通勤歌单', isActive: true },
    { id: '456', name: '周末再听', isActive: false },
  ]);
  assert.deepEqual(parsePlaylistBackup(code), [
    { id: '123', name: '通勤歌单', isActive: true },
    { id: '456', name: '周末再听', isActive: false },
  ]);
});

test('pagination batches pages after the first page', () => {
  assert.deepEqual(remainingPageBatches(61, 20, 3), [[2, 3, 4]]);
  assert.deepEqual(remainingPageBatches(20, 20, 3), []);
});
