export interface PlaylistBackupItem {
  id: string;
  name?: string;
  isActive?: boolean;
}

export function encodePlaylistBackup(items: PlaylistBackupItem[]): string {
  if (items.length === 0) return '';
  const compact = items.map(({ id, name, isActive }) => [id, name || '', isActive !== false]);
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `B2.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
}

export function parsePlaylistBackup(input: string): PlaylistBackupItem[] {
  const code = input.trim();
  if (!code) return [];

  if (code.startsWith('B2.')) {
    try {
      const encoded = code.slice(3).replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='));
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const parsed = JSON.parse(new TextDecoder().decode(bytes));
      if (Array.isArray(parsed)) {
        return unique(parsed.flatMap((item) => {
          if (!Array.isArray(item) || !isDecimalId(String(item[0] ?? ''))) return [];
          return [{ id: String(item[0]), name: String(item[1] || ''), isActive: item[2] !== false }];
        }));
      }
    } catch {
      return [];
    }
  }

  // Legacy full Base64 JSON backup.
  if (code.length > 25) {
    try {
      const parsed = JSON.parse(decodeURIComponent(atob(code)));
      if (Array.isArray(parsed)) {
        return unique(parsed.flatMap((item) => {
          const id = String(item?.id ?? '');
          return isDecimalId(id) ? [{ id, name: item?.name, isActive: item?.isActive !== false }] : [];
        }));
      }
    } catch {
      // Fall through to legacy compact-code parsing.
    }
  }

  return unique(code.split(/[\s,.;\-]+/).flatMap((part) => {
    const value = part.trim();
    if (!value) return [];
    if (isDecimalId(value)) return [{ id: value }];
    if (!/^[0-9a-z]+$/i.test(value)) return [];
    const parsed = Number.parseInt(value, 36);
    return Number.isSafeInteger(parsed) && parsed > 0 ? [{ id: String(parsed) }] : [];
  }));
}

export function parsePlaylistIds(input: string): string[] {
  return parsePlaylistBackup(input).map((item) => item.id);
}

function isDecimalId(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function unique(values: PlaylistBackupItem[]): PlaylistBackupItem[] {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}
