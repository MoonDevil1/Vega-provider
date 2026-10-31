import { Post, ProviderContext } from "../types";

const STREAMS_URL = "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in.m3u";
const CHANNELS_URL = "https://iptv-org.github.io/api/channels.json";
const CACHE_KEY = "iptv-org-in-hindi-v2";
const CACHE_TTL = 10 * 60 * 1000;

type ChannelInfo = { id?: string; name?: string; logo?: string; country?: string; languages?: string[]; categories?: string[] };
type ChannelEntry = { id: string; name: string; logo: string; url: string; group: string; language: string; info: ChannelInfo };

const HINDI_GENERAL = /^(zee tv|zee anmol|sony sab|sony entertainment television|sony entertainment|colors|star plus|star bharat|dangal tv|&tv|and tv|rishtey|dd national|shemaroo umang|anmol|prag|epic tv)$/i;
const HINDI_MOVIES = /zee cinema|sony max|star gold|b4u movies|colors cineplex|&pictures|and pictures|utv movies|goldmines|shemaroo movies|movies now|hindi hits|all time movies/i;
const HINDI_KIDS = /pogo|hungama|discovery kids|sony yay|cartoon network|green gold|wow kidz|nick(?!elodeon jr)/i;

function attr(line: string, key: string): string {
  const match = line.match(new RegExp("(?:^|\\s)" + key + '="([^"]*)"', "i"));
  return match ? match[1].trim() : "";
}
function canonicalId(id: string): string {
  return String(id || "").trim().split("@")[0].toLowerCase();
}
function parsePlaylist(text: string, channelMap: Record<string, ChannelInfo>): ChannelEntry[] {
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
    const id = canonicalId(rawId);
    const tvgName = attr(infoLine, "tvg-name");
    const logo = attr(infoLine, "tvg-logo");
    const group = attr(infoLine, "group-title");
    const language = attr(infoLine, "tvg-language");
    const info = channelMap[rawId] || channelMap[id] || {};
    if (playlistName && id) {
      const name = String(tvgName || playlistName).replace(/\s*\([^)]*\)\s*$/, "").trim();
      entries.push({ id, name, logo: String(logo || info.logo || ""), url: line, group, language, info });
    }
    infoLine = "";
  }
  return entries;
}
async function loadEntries(providerContext: ProviderContext): Promise<ChannelEntry[]> {
  const { axios, kvStore } = providerContext;
  try {
    const cached = await kvStore.get<{ savedAt: number; entries: ChannelEntry[] }>(CACHE_KEY);
    if (cached && Date.now() - cached.savedAt < CACHE_TTL && Array.isArray(cached.entries)) return cached.entries;
  } catch {}
  const playlistResponse = await axios.get(STREAMS_URL, { headers: { Accept: "text/plain", "User-Agent": "Vega-IPTV/1.0" }, timeout: 20000 });
  const playlist = String(playlistResponse.data || "");
  if (!playlist.trim().startsWith("#EXTM3U")) throw new Error("IPTV playlist is not a valid M3U file");
  const channelMap: Record<string, ChannelInfo> = {};
  try {
    const response = await axios.get(CHANNELS_URL, { headers: { Accept: "application/json", "User-Agent": "Vega-IPTV/1.0" }, timeout: 20000 });
    for (const channel of Array.isArray(response.data) ? response.data : []) {
      if (channel && channel.id) {
        channelMap[String(channel.id)] = channel;
        channelMap[canonicalId(String(channel.id))] = channel;
      }
    }
  } catch (error) {
    console.warn("[IPTV] Channel metadata unavailable; using playlist metadata", error);
  }
  const entries = parsePlaylist(playlist, channelMap);
  if (!entries.length) throw new Error("The India IPTV playlist returned no valid channel entries");
  try { await kvStore.set(CACHE_KEY, { savedAt: Date.now(), entries }); } catch {}
  return entries;
}
function isHindi(entry: ChannelEntry): boolean {
  const languages = Array.isArray(entry.info.languages) ? entry.info.languages : [];
  const text = [entry.name, entry.group, entry.language, entry.id].join(" ");
  return languages.some((language) => /^(hin|hindi)$/i.test(language)) ||
    /\bhindi\b|@hindi/i.test(text) ||
    HINDI_GENERAL.test(entry.name) || HINDI_MOVIES.test(entry.name) || HINDI_KIDS.test(entry.name) ||
    /^(zeetv|zeeanmol|sonysab|sonyyay|colors|starplus|starbharat|dangaltv|andtv|ddnational|pogo|hungama|discoverykids|greengoldtv|cartoonnetwork|zeecinema|sonymax|stargold|b4umovies|colorscineplex)\.in$/i.test(entry.id);
}
function matchesCategory(entry: ChannelEntry, category: string): boolean {
  const name = entry.name.toLowerCase();
  const cats = Array.isArray(entry.info.categories) ? entry.info.categories : [];
  const group = entry.group.toLowerCase();
  if (category === "movies") return cats.includes("movies") || HINDI_MOVIES.test(name) || /movie|cinema|film|picture/i.test(name) || /movie|cinema/i.test(group);
  if (category === "kids") return cats.includes("kids") || HINDI_KIDS.test(name) || /kids|cartoon/i.test(group);
  const excluded = cats.includes("movies") || cats.includes("kids") || HINDI_MOVIES.test(name) || HINDI_KIDS.test(name) || /movie|cinema|film|kids|cartoon/i.test(name);
  return !excluded && (cats.includes("entertainment") || HINDI_GENERAL.test(name) || /entertainment|general/i.test(group));
}
function toPost(entry: ChannelEntry): Post {
  return { title: entry.name, link: "iptv://channel/" + encodeURIComponent(entry.id), image: entry.logo, provider: "iptv", tag: "LIVE", cornerTag: "LIVE" };
}
export const getPosts = async function ({ filter, providerContext }: { filter: string; page?: number; providerValue?: string; signal?: AbortSignal; providerContext: ProviderContext }): Promise<Post[]> {
  const category = String(filter || "movies").toLowerCase();
  if (!["movies", "kids", "serials"].includes(category)) return [];
  const entries = await loadEntries(providerContext);
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (!isHindi(entry) || !matchesCategory(entry, category) || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).map(toPost);
};
export const getSearchPosts = async function ({ searchQuery, providerContext }: { searchQuery: string; page?: number; providerValue?: string; signal?: AbortSignal; providerContext: ProviderContext }): Promise<Post[]> {
  const query = String(searchQuery || "").trim().toLowerCase();
  if (!query) return [];
  const entries = await loadEntries(providerContext);
  const seen = new Set<string>();
  return entries.filter((entry) => isHindi(entry) && entry.name.toLowerCase().includes(query))
    .filter((entry) => { if (seen.has(entry.id)) return false; seen.add(entry.id); return true; }).map(toPost);
};
