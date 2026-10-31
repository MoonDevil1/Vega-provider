import { Post, ProviderContext } from "../types";

const STREAMS_URL = "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in.m3u";
const CHANNELS_URL = "https://iptv-org.github.io/api/channels.json";
const LOGOS_URL = "https://iptv-org.github.io/api/logos.json";
const CACHE_KEY = "iptv-org-in-hindi-v4";
const CACHE_TTL = 10 * 60 * 1000;

type ChannelInfo = { id?: string; name?: string; alt_names?: string[]; categories?: string[] };
type ChannelLogo = { channel?: string; url?: string; in_use?: boolean; format?: string; width?: number; height?: number };
type ChannelEntry = { id: string; name: string; logo: string; url: string; group: string; language: string; info: ChannelInfo };

const CATEGORY_IDS: Record<string, Set<string>> = {
  movies: new Set([
    "b4umovies.in", "goldmines.in", "goldmines2.in", "goldminesaction.in",
    "goldminesbollywood.in", "goldminesmovies.in", "zeecinema.in", "colorscineplex.in",
  ]),
  kids: new Set([
    "wowkidz.in", "epickids.in", "nickelodeon.in", "superhungama.in", "sonyyay.in",
    "disneychannel.in", "hungamatv.in", "disneyjunior.in", "pogo.in",
    "cartoonnetwork.in", "cartoonnetworkhdplus.in", "discoverykids.in", "greengoldtv.in",
  ]),
  serials: new Set([
    "dangaltv.in", "dangal2.in", "ddnational.in", "epictv.in", "pasandtv.in",
    "shemarooumang.in", "sonyentertainmenttelevision.in", "colors.in", "sonysab.in", "anmoltv.in",
  ]),
};

function attr(line: string, key: string): string {
  const match = line.match(new RegExp("(?:^|\\s)" + key + "=(?:\"([^\"]*)\"|'([^']*)')", "i"));
  return match ? String(match[1] || match[2] || "").trim() : "";
}
function canonicalId(id: string): string {
  return String(id || "").trim().split("@")[0].toLowerCase();
}
function slug(value: string): string {
  return String(value || "channel").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "channel";
}
function parsePlaylist(text: string, channelMap: Record<string, ChannelInfo>, logoMap: Record<string, string>): ChannelEntry[] {
  const entries: ChannelEntry[] = [];
  let infoLine = "";
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) { infoLine = line; continue; }
    if (line.startsWith("#") || !/^https?:\/\//i.test(line) || !infoLine) continue;
    const comma = infoLine.lastIndexOf(",");
    const playlistName = (comma >= 0 ? infoLine.slice(comma + 1) : "").trim();
    const rawId = attr(infoLine, "tvg-id");
    const tvgName = attr(infoLine, "tvg-name");
    const id = canonicalId(rawId) || slug(tvgName || playlistName);
    const info = channelMap[id] || {};
    const name = String(tvgName || info.name || playlistName).replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+\d{3,4}p$/i, "").trim();
    if (name && id) {
      const url = line;
      // Keep every distinct source URL for a channel; getMeta exposes these as
      // alternate streams instead of silently throwing away mirrors/qualities.
      if (!entries.some((entry) => entry.id === id && entry.url === url)) {
        entries.push({ id, name, logo: attr(infoLine, "tvg-logo") || logoMap[id] || "", url, group: attr(infoLine, "group-title"), language: attr(infoLine, "tvg-language"), info });
      }
    }
    infoLine = "";
  }
  return entries;
}
async function loadEntries(providerContext: ProviderContext): Promise<ChannelEntry[]> {
  const { axios, kvStore, commonHeaders = {} } = providerContext;
  try {
    const cached = await kvStore.get<{ savedAt: number; entries: ChannelEntry[] }>(CACHE_KEY);
    if (cached && Date.now() - cached.savedAt < CACHE_TTL && Array.isArray(cached.entries) && cached.entries.length) return cached.entries;
  } catch {}

  const headers = { ...commonHeaders, "User-Agent": commonHeaders["User-Agent"] || "Mozilla/5.0 Vega-IPTV/1.2" };
  const playlistResponse = await axios.get(STREAMS_URL, { headers: { ...headers, Accept: "text/plain,*/*" }, timeout: 30000, responseType: "text" });
  const playlist = String(playlistResponse.data || "");
  if (!playlist.trim().startsWith("#EXTM3U")) throw new Error("IPTV source did not return an M3U playlist");

  const channelMap: Record<string, ChannelInfo> = {};
  try {
    const response = await axios.get(CHANNELS_URL, { headers: { ...headers, Accept: "application/json" }, timeout: 20000 });
    for (const channel of Array.isArray(response.data) ? response.data : []) {
      if (channel && channel.id) channelMap[String(channel.id).toLowerCase()] = channel;
    }
  } catch (error) {
    console.warn("[IPTV] Channel metadata unavailable; using curated channel IDs", error);
  }

  const logoMap: Record<string, string> = {};
  try {
    const response = await axios.get(LOGOS_URL, { headers: { ...headers, Accept: "application/json" }, timeout: 20000 });
    const logos = Array.isArray(response.data) ? response.data as ChannelLogo[] : [];
    for (const logo of logos) {
      const id = String(logo.channel || "").toLowerCase();
      if (!id || !logo.url || logo.in_use === false) continue;
      const previous = logoMap[id];
      if (!previous || (logo.format === "SVG") || (logo.width || 0) >= 100) logoMap[id] = logo.url;
    }
  } catch (error) {
    console.warn("[IPTV] Optional logo metadata unavailable; continuing without logos", error);
  }

  const entries = parsePlaylist(playlist, channelMap, logoMap);
  if (!entries.length) throw new Error("IPTV India playlist contained no usable channel entries");
  try { await kvStore.set(CACHE_KEY, { savedAt: Date.now(), entries }); } catch {}
  return entries;
}
function toPost(entry: ChannelEntry): Post {
  return {
    title: entry.name,
    link: "iptv://channel/" + encodeURIComponent(entry.id) + "?stream=" + encodeURIComponent(entry.url),
    image: entry.logo,
    provider: "iptv",
    tag: "LIVE",
    cornerTag: "LIVE",
  };
}
export const getPosts = async function ({ filter, providerContext }: { filter: string; page?: number; providerValue?: string; signal?: AbortSignal; providerContext: ProviderContext }): Promise<Post[]> {
  const category = String(filter || "").toLowerCase();
  const allowed = CATEGORY_IDS[category];
  if (!allowed) return [];
  const entries = await loadEntries(providerContext);
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (!allowed.has(entry.id) || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).map(toPost);
};
export const getSearchPosts = async function ({ searchQuery, providerContext }: { searchQuery: string; page?: number; providerValue?: string; signal?: AbortSignal; providerContext: ProviderContext }): Promise<Post[]> {
  const query = String(searchQuery || "").trim().toLowerCase();
  if (!query) return [];
  const entries = await loadEntries(providerContext);
  const seen = new Set<string>();
  return entries.filter((entry) => Object.values(CATEGORY_IDS).some((ids) => ids.has(entry.id)) && entry.name.toLowerCase().includes(query))
    .filter((entry) => { if (seen.has(entry.id)) return false; seen.add(entry.id); return true; }).map(toPost);
};
