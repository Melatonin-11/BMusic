export function parsePlaylistIds(input: string): string[] {
  const code = input.trim();
  if (!code) return [];

  if (code.length > 25) {
    try {
      const parsed = JSON.parse(decodeURIComponent(atob(code)));
      if (Array.isArray(parsed)) {
        return unique(parsed.map((item) => String(item?.id ?? '')).filter(isDecimalId));
      }
    } catch {
      // Fall through to compact-code parsing.
    }
  }

  const ids = code.split(/[\s,.;\-]+/).flatMap((part) => {
    const value = part.trim();
    if (!value) return [];
    if (isDecimalId(value)) return [value];
    if (!/^[0-9a-z]+$/i.test(value)) return [];
    const parsed = Number.parseInt(value, 36);
    return Number.isSafeInteger(parsed) && parsed > 0 ? [String(parsed)] : [];
  });
  return unique(ids);
}

function isDecimalId(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
