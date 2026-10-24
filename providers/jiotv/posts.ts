import { Post, ProviderContext } from "../types";

type Channel = Record<string, any>;

const CATEGORY_NAMES: Record<string, string> = {
  "0": "All Categories", "5": "Entertainment", "6": "Movies",
  "7": "Kids", "8": "Sports", "9": "Lifestyle", "10": "Infotainment",
  "12": "News", "13": "Music", "15": "Devotional", "16": "Business",
  "17": "Educational", "18": "Shopping", "19": "JioDarshan",
};
const LANGUAGE_NAMES: Record<string, string> = {
  "0": "All Languages", "1": "Hindi", "2": "Marathi", "3": "Punjabi",
  "4": "Urdu", "5": "Bengali", "6": "English", "7": "Malayalam",
  "8": "Tamil", "9": "Gujarati", "10": "Odia", "11": "Telugu",
  "12": "Bhojpuri", "13": "Kannada", "14": "Assamese", "15": "Nepali",
  "16": "French", "18": "Other",
};

function baseUrlFrom(ctx: ProviderContext): Promise<string> {
  return ctx.kvStore.get<string>("jiotvBaseUrl").then((v) =>
    String(v || "http://127.0.0.1:5001").trim().replace(/\/+$/, ""),
  );
}
function channelList(payload: any): Channel[] {
  if (Array.isArray(payload)) return payload;
  // JioTV Go's documented ChannelsResponse is { code, message, result: [...] }.
  for (const key of ["result", "channels", "data", "results", "items"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.[key]?.result)) return payload[key].result;
    if (Array.isArray(payload?.[key]?.channels)) return payload[key].channels;
  }
  return [];
}
function getId(c: Channel): string {
  return String(c.id ?? c.channel_id ?? c.channelId ?? c.channelID ?? "").trim();
}
function getName(c: Channel): string {
  return String(c.name ?? c.channel_name ?? c.channelName ?? c.title ?? "").trim();
}
function mapped(value: any, names: Record<string, string>): string {
  const raw = String(value ?? "").trim();
  return names[raw] || raw;
}
function getLanguage(c: Channel): string {
  return mapped(c.language ?? c.channelLanguageId ?? c.language_id ?? c.lang, LANGUAGE_NAMES);
}
function getGenre(c: Channel): string {
  return mapped(c.genre ?? c.channelCategoryId ?? c.category_id ?? c.category ?? c.group ?? c.type, CATEGORY_NAMES);
}
function getLogo(c: Channel): string {
  return String(c.logo ?? c.logo_url ?? c.logoUrl ?? c.image ?? c.icon ?? "").trim();
}
function matchesFilter(c: Channel, filter: string): boolean {
  const f = String(filter || "all");
  if (f === "all") return true;
  const [kind, ...rest] = f.split("/");
  const wanted = rest.join("/").trim().toLowerCase();
  if (!wanted) return true;
  if (kind === "language") return getLanguage(c).toLowerCase() === wanted;
  if (kind === "genre") return getGenre(c).toLowerCase() === wanted;
  return false;
}
function toPost(c: Channel, base: string): Post | null {
  const id = getId(c);
  const title = getName(c);
  if (!id || !title) return null;
  const logo = getLogo(c);
  return {
    title,
    link: base + "/live/" + encodeURIComponent(id),
    image: /^https?:\/\//i.test(logo) ? logo : "",
    provider: "jiotv",
    tag: [getLanguage(c), getGenre(c)].filter(Boolean).join(" · "),
  };
}
async function fetchChannels(ctx: ProviderContext): Promise<{ base: string; channels: Channel[] }> {
  const base = await baseUrlFrom(ctx);
  const response = await ctx.axios.get(base + "/channels", {
    headers: { ...ctx.commonHeaders, Accept: "application/json" },
    timeout: 12000,
  });
  const channels = channelList(response.data);
  if (!channels.length) {
    throw new Error("JioTV Go /channels returned no channel array (expected { result: [...] }). Check server version and login.");
  }
  return { base, channels };
}

export const getPosts = async function ({
  filter,
  providerContext,
}: {
  filter: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  try {
    const { base, channels } = await fetchChannels(providerContext);
    return channels
      .filter((c) => matchesFilter(c, filter))
      .map((c) => toPost(c, base))
      .filter((p): p is Post => Boolean(p));
  } catch (error) {
    console.warn("[JioTV] Category load failed. Verify the server URL and /channels response.", error);
    return [];
  }
};

export const getSearchPosts = async function ({
  searchQuery,
  providerContext,
}: {
  searchQuery: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const query = String(searchQuery || "").trim().toLowerCase();
  if (!query) return [];
  try {
    const { base, channels } = await fetchChannels(providerContext);
    return channels
      .filter((c) => [getName(c), getLanguage(c), getGenre(c)].some((v) => v.toLowerCase().includes(query)))
      .map((c) => toPost(c, base))
      .filter((p): p is Post => Boolean(p));
  } catch (error) {
    console.warn("[JioTV] Search failed. Check the JioTV Go server URL and login.", error);
    return [];
  }
};
