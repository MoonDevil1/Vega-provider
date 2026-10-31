"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPosts = getPosts;
exports.getSearchPosts = getSearchPosts;
const STREAMS_URL = "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in.m3u";
const CHANNELS_URL = "https://iptv-org.github.io/api/channels.json";
const CACHE_KEY = "iptv-org-in-hindi-v3";
const CACHE_TTL = 600000;
const HINDI_GENERAL = /\b(zee tv|zee anmol|sony sab|sony entertainment television|sony entertainment|colors( tv)?|star plus|star bharat|dangal tv|&tv|and tv|rishtey|dd national|shemaroo umang|anmol|prag|epic tv)\b/i;
const HINDI_MOVIES = /\b(zee cinema|zee bollywood|sony max|star gold|b4u movies|colors cineplex|&pictures|and pictures|utv movies|goldmines|shemaroo movies|movies now|hindi hits|all time movies|movies ok)\b/i;
const HINDI_KIDS = /\b(pogo|hungama|discovery kids|sony yay|cartoon network|green gold|wow kidz|nick(?!elodeon jr))\b/i;
function attr(line, key) {
    const match = line.match(new RegExp("(?:^|\\s)" + key + "=(?:\"([^\"]*)\"|'([^']*)')", "i"));
    return match ? String(match[1] || match[2] || "").trim() : "";
}
function canonicalId(id) { return String(id || "").trim().split("@")[0].toLowerCase(); }
function slug(value) { return String(value || "channel").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "channel"; }
function parsePlaylist(text, channelMap) {
    const entries = [];
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
        const logo = attr(infoLine, "tvg-logo");
        const group = attr(infoLine, "group-title");
        const language = attr(infoLine, "tvg-language");
        const name = String(tvgName || playlistName).replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+\d{3,4}p$/i, "").trim();
        const id = canonicalId(rawId) || slug(name);
        const info = channelMap[rawId] || channelMap[id] || {};
        if (name && id) entries.push({ id, name, logo: String(logo || info.logo || ""), url: line, group, language, info });
        infoLine = "";
    }
    return entries;
}
async function loadEntries(providerContext) {
    const { axios, kvStore, commonHeaders = {} } = providerContext;
    try {
        const cached = await kvStore.get(CACHE_KEY);
        if (cached && Date.now() - cached.savedAt < CACHE_TTL && Array.isArray(cached.entries) && cached.entries.length) return cached.entries;
    }
    catch { }
    const playlistResponse = await axios.get(STREAMS_URL, {
        headers: { ...commonHeaders, Accept: "text/plain,*/*", "User-Agent": commonHeaders["User-Agent"] || "Mozilla/5.0 Vega-IPTV/1.1" },
        timeout: 25000,
        responseType: "text",
    });
    const playlist = String(playlistResponse.data || "");
    if (!playlist.trim().startsWith("#EXTM3U")) throw new Error("IPTV source did not return an M3U playlist");
    const channelMap = {};
    try {
        const response = await axios.get(CHANNELS_URL, { headers: { ...commonHeaders, Accept: "application/json" }, timeout: 15000 });
        for (const channel of Array.isArray(response.data) ? response.data : []) {
            if (channel && channel.id) {
                channelMap[String(channel.id)] = channel;
                channelMap[canonicalId(String(channel.id))] = channel;
            }
        }
    }
    catch (error) { console.warn("[IPTV] Optional channel metadata unavailable; continuing with M3U data", error); }
    const entries = parsePlaylist(playlist, channelMap);
    if (!entries.length) throw new Error("IPTV India playlist contained no usable channel entries");
    try { await kvStore.set(CACHE_KEY, { savedAt: Date.now(), entries }); }
    catch { }
    return entries;
}
function isHindi(entry) {
    const info = entry.info || {};
    const languages = Array.isArray(info.languages) ? info.languages : [];
    const altNames = Array.isArray(info.alt_names) ? info.alt_names : [];
    const text = [entry.name, ...altNames, entry.group, entry.language, entry.id].join(" ");
    return languages.some((language) => /^(hin|hindi)$/i.test(language)) ||
        /\bhindi\b|@hindi/i.test(text) || HINDI_GENERAL.test(text) || HINDI_MOVIES.test(text) || HINDI_KIDS.test(text) ||
        /^(zeetv|zeeanmol|sonysab|sonyyay|starplus|starbharat|dangaltv|andtv|ddnational|pogo|hungama|discoverykids|greengoldtv|cartoonnetwork|zeecinema|zeebollywood|sonymax|stargold|b4umovies|colorscineplex)\.in$/i.test(entry.id);
}
function matchesCategory(entry, category) {
    const name = [entry.name, ...(entry.info.alt_names || [])].join(" ");
    const cats = Array.isArray(entry.info.categories) ? entry.info.categories : [];
    const group = entry.group.toLowerCase();
    if (category === "movies") return cats.includes("movies") || HINDI_MOVIES.test(name) || /movie|cinema|film|picture/i.test(name) || /movie|cinema/i.test(group);
    if (category === "kids") return cats.includes("kids") || HINDI_KIDS.test(name) || /kids|cartoon|children/i.test(group);
    const excluded = cats.includes("movies") || cats.includes("kids") || HINDI_MOVIES.test(name) || HINDI_KIDS.test(name) || /movie|cinema|film|kids|cartoon|children/i.test(name);
    return !excluded && (cats.includes("entertainment") || cats.includes("general") || HINDI_GENERAL.test(name) || /entertainment|general|serial/i.test(group));
}
function toPost(entry) {
    return { title: entry.name, link: "iptv://channel/" + encodeURIComponent(entry.id) + "?stream=" + encodeURIComponent(entry.url), image: entry.logo, provider: "iptv", tag: "LIVE", cornerTag: "LIVE" };
}
async function getPosts({ filter, providerContext }) {
    const category = String(filter || "movies").toLowerCase();
    if (!["movies", "kids", "serials"].includes(category)) return [];
    const entries = await loadEntries(providerContext);
    const seen = new Set();
    return entries.filter((entry) => {
        if (!isHindi(entry) || !matchesCategory(entry, category) || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
    }).map(toPost);
}
async function getSearchPosts({ searchQuery, providerContext }) {
    const query = String(searchQuery || "").trim().toLowerCase();
    if (!query) return [];
    const entries = await loadEntries(providerContext);
    const seen = new Set();
    return entries.filter((entry) => isHindi(entry) && entry.name.toLowerCase().includes(query))
        .filter((entry) => { if (seen.has(entry.id)) return false; seen.add(entry.id); return true; }).map(toPost);
}
