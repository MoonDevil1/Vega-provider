import { Post, ProviderContext } from "../types";

const STREAMS_URL = "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in.m3u";
const CHANNELS_URL = "https://iptv-org.github.io/api/channels.json";
const CACHE_KEY = "iptv-org-in-hindi-v1";
const CACHE_TTL = 10 * 60 * 1000;

type ChannelInfo = {
  id?: string; name?: string; logo?: string; country?: string;
  languages?: string[]; categories?: string[];
};
type ChannelEntry = {
  id: string; name: string; logo: string; url: string; group: string; info: ChannelInfo;
};

function attr(line: string, key: string): string {
  const match = line.match(new RegExp("(?:^|\\s)" + key + '="([^"]*)"', "i"));
  return match ? match[1].trim() : "";
}

function parsePlaylist(text: string, channelMap: Record<string, ChannelInfo>): ChannelEntry[] {
  const rows = text.split("\n");
  const entries: ChannelEntry[] = [];
  let infoLine = "";
  for (const raw of rows) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) { infoLine = line; continue; }
    if (line.startsWith("#") || !(line.startsWith("http://") || line.startsWith("https://")) || !infoLine) continue;
    const comma = infoLine.lastIndexOf(",");
    const name = (comma >= 0 ? infoLine.slice(comma + 1) : "").trim();
    const id = attr(infoLine, "tvg-id");
    const logo = attr(infoLine, "tvg-logo");
    const group = attr(infoLine, "group-title");
    if (name && id) {
      const info = channelMap[id] || {};
      entries.push({
        id,
        name: String(info.name || attr(infoLine, "tvg-name") || name).replace(/\s*\([^)]*\)\s*$/, "").trim(),
        logo: String(info.logo || logo || ""),
        url: line,
        group,
        info,
      });
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
  const playlistResponse = await axios.get(STREAMS_URL, {
    headers: { Accept: "text/plain", "User-Agent": "Vega-IPTV/1.0" }, timeout: 20000,
  });
  const playlist = String(playlistResponse.data || "");
  if (!playlist.startsWith("#EXTM3U")) throw new Error("IPTV playlist is not a valid M3U file");
  const channelMap: Record<string, ChannelInfo> = {};
  try {
    const response = await axios.get(CHANNELS_URL, {
      headers: { Accept: "application/json", "User-Agent": "Vega-IPTV/1.0" }, timeout: 20000,
    });
    const channels = Array.isArray(response.data) ? response.data : [];
    for (const channel of channels) if (channel && channel.id) channelMap[String(channel.id)] = channel;
  } catch (error) {
    console.warn("[IPTV] Channel metadata unavailable; using playlist logos and name matching", error);
  }
  const entries = parsePlaylist(playlist, channelMap);
  try { await kvStore.set(CACHE_KEY, { savedAt: Date.now(), entries }); } catch {}
  return entries;
}

function isHindi(entry: ChannelEntry): boolean {
  const languages = Array.isArray(entry.info.languages) ? entry.info.languages : [];
  return languages.includes("hin") || /\b(hindi|hin)\b/i.test(entry.name + " " + entry.group);
}

function matchesCategory(entry: ChannelEntry, category: string): boolean {
  const name = entry.name.toLowerCase();
  const cats = Array.isArray(entry.info.categories) ? entry.info.categories : [];
  const group = entry.group.toLowerCase();
  if (category === "movies") {
    return cats.includes("movies") || /movie|cinema|film|picture|b4u movies|zee cinema|star gold|sony max|colors cineplex/i.test(name) || /movie|cinema/i.test(group);
  }
  if (category === "kids") {
    return cats.includes("kids") || /kids|cartoon|pogo|nick|disney|hungama|sonic|discovery kids|green gold|wow kidz/i.test(name) || /kids|cartoon/i.test(group);
  }
  const excluded = cats.includes("movies") || cats.includes("kids") || /movie|cinema|film|kids|cartoon|pogo|nick|disney|hungama|sonic/i.test(name);
  const serialBrands = /zee tv|zee anmol|sony sab|sony entertainment|colors(?! cineplex)|star plus|star bharat|dangal|&tv|and tv|rishtey|dd national|sheemaroo umang|anmol|prag|epic tv/i.test(name);
  return !excluded && (cats.includes("entertainment") || serialBrands || /entertainment|general/i.test(group));
}

export const getPosts = async function ({
  filter, providerContext,
}: {
  filter: string; page?: number; providerValue?: string; signal?: AbortSignal; providerContext: ProviderContext;
}): Promise<Post[]> {
  const category = String(filter || "movies").toLowerCase();
  if (!["movies", "kids", "serials"].includes(category)) return [];
  const entries = await loadEntries(providerContext);
  const seen = new Set<string>();
  const posts: Post[] = [];
  for (const entry of entries) {
    if (!isHindi(entry) || !matchesCategory(entry, category) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    posts.push({ title: entry.name, link: entry.url, image: entry.logo, provider: "iptv", tag: "LIVE", cornerTag: "LIVE" });
  }
  return posts;
};

export const getSearchPosts = async function ({
  searchQuery, providerContext,
}: {
  searchQuery: string; page?: number; providerValue?: string; signal?: AbortSignal; providerContext: ProviderContext;
}): Promise<Post[]> {
  const query = String(searchQuery || "").trim().toLowerCase();
  if (!query) return [];
  const entries = await loadEntries(providerContext);
  const seen = new Set<string>();
  return entries
    .filter((entry) => isHindi(entry) && entry.name.toLowerCase().includes(query))
    .filter((entry) => { if (seen.has(entry.id)) return false; seen.add(entry.id); return true; })
    .map((entry) => ({ title: entry.name, link: entry.url, image: entry.logo, provider: "iptv", tag: "LIVE", cornerTag: "LIVE" }));
};