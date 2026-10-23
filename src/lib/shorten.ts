/**
 * Short publish links. A published app lives entirely inside its URL
 * (#app=<snapshot>), which makes the raw link thousands of characters —
 * too long to print as a QR code and easy for chat apps to truncate.
 * The radical fix is a real short link: the snapshot URL is registered
 * with is.gd (through the site proxy; is.gd sends no CORS headers) and
 * the short URL becomes the primary link everywhere. Verified: is.gd's
 * 301 Location preserves the #app= fragment, so the app opens intact.
 * Results are cached per link so re-publishing the same version is
 * instant and does not burn shortener calls. Any failure returns null
 * and the caller falls back to the full link.
 */
const CACHE_KEY = 's2ui.shortlinks.v1';

function hashOf(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function cacheGet(key: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') as Record<string, string>;
    return typeof map[key] === 'string' ? map[key] : null;
  } catch { return null; }
}

function cacheSet(key: string, value: string): void {
  try {
    const map = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') as Record<string, string>;
    map[key] = value;
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch { /* storage unavailable — the short link still works this session */ }
}

export async function shortenUrl(longUrl: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const key = hashOf(longUrl);
  const hit = cacheGet(key);
  if (hit) return hit;
  try {
    const api = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`;
    const res = await fetchImpl(`/api/proxy?url=${encodeURIComponent(api)}`);
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!/^https:\/\/is\.gd\/[A-Za-z0-9]+$/.test(text)) return null;
    cacheSet(key, text);
    return text;
  } catch { return null; }
}
