import test from 'node:test';
import assert from 'node:assert/strict';
import { getActiveUniqueSongs, pickNextSong } from '../src/utils/playback.ts';
import { buildPlaybackTrail, findPreviousPlayableSong } from '../src/utils/playbackHistory.ts';
import { encodePlaylistBackup, parsePlaylistBackup, parsePlaylistIds } from '../src/utils/playlistImport.ts';
import { remainingPageBatches } from '../src/utils/pagination.ts';
import { readJsonStorage } from '../src/utils/storage.ts';
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

test('fused library excludes inactive folders and deduplicates BVIDs globally', () => {
  const items = [
    playlist('first', [song('SAME', 'first'), song('FIRST', 'first')]),
    playlist('second', [song('SAME', 'second'), song('SECOND', 'second')]),
    { ...playlist('inactive', [song('HIDDEN', 'inactive')]), isActive: false },
  ];
  assert.deepEqual(getActiveUniqueSongs(items).map((item) => item.bvid), ['SAME', 'FIRST', 'SECOND']);
});

test('pure random always excludes the current song when alternatives exist', () => {
  const items = [playlist('a', [song('CURRENT', 'a'), song('NEXT', 'a')])];
  assert.equal(pickNextSong(items, 'CURRENT', 'pure', () => 0)?.bvid, 'NEXT');
});

test('playback trail can walk backward through more than one song', () => {
  const songs = [song('A', 'p'), song('B', 'p'), song('C', 'p')];
  const history = [...songs].reverse().map((item, index) => ({
    id: String(index), bvid: item.bvid, title: item.title, cover: '', author: '',
    playedAt: index, playlistName: 'p', playlistId: 'p',
  }));
  const trail = buildPlaybackTrail(history, songs[2]);
  const firstPrevious = findPreviousPlayableSong(trail, 2, songs);
  const secondPrevious = findPreviousPlayableSong(trail, firstPrevious?.index ?? -1, songs);
  assert.equal(firstPrevious?.song.bvid, 'B');
  assert.equal(secondPrevious?.song.bvid, 'A');
});

test('invalid local JSON falls back safely and removes the broken value', () => {
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map([['broken', '{not-json']]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
    },
  });
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    assert.deepEqual(readJsonStorage('broken', []), []);
    assert.equal(values.has('broken'), false);
  } finally {
    console.warn = originalWarn;
    if (previousDescriptor) Object.defineProperty(globalThis, 'localStorage', previousDescriptor);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
  }
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
