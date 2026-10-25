import { Post, ProviderContext } from "../types";

type Channel = Record<string, any>;
const LIST_URL = "https://jjtvxweb.pages.dev/jstr4web.json";
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_HEADERS = {
  "User-Agent": "okhttp/4.9.3",
  Referer: "https://www.jiotv.com/",
  Origin: "https://www.jiotv.com",
  Accept: "application/json",
};
let channelCache: { at: number; list: Channel[] } = { at: 0, list: [] };

function channelsFrom(payload: any): Channel[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ["channels", "data", "result", "results", "items"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}
function idOf(c: Channel): string {
  return String(c.id ?? c.channel_id ?? c.channelId ?? "").trim();
}
function nameOf(c: Channel): string {
  return String(c.name ?? c.title ?? c.channel_name ?? c.channelName ?? "").trim();
}
function logoOf(c: Channel): string {
  const value = String(c.logo ?? c.logoUrl ?? c.logo_url ?? c.image ?? "").trim();
  return /^https?:\/\//i.test(value) ? value : "";
}
async function fetchChannels(ctx: ProviderContext): Promise<Channel[]> {
  if (channelCache.list.length && Date.now() - channelCache.at < CACHE_TTL_MS) return channelCache.list;
  const response = await ctx.axios.get(LIST_URL, {
    headers: { ...ctx.commonHeaders, ...REQUEST_HEADERS },
    timeout: 15000,
  });
  const list = channelsFrom(response.data).filter((c) => idOf(c) && nameOf(c));
  channelCache = { at: Date.now(), list };
  return list;
}

export const getPosts = async function ({
  page,
  providerContext,
}: {
  filter: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  try {
    const all = await fetchChannels(providerContext);
    const safePage = Math.max(1, Number(page) || 1);
    return all.slice((safePage - 1) * 40, safePage * 40).map((c) => ({
      title: nameOf(c),
      link: idOf(c),
      image: logoOf(c),
      provider: "jiotv",
      tag: String(c.language ?? c.lang ?? c.category ?? c.genre ?? "Live TV"),
    }));
  } catch (error) {
    console.warn("[JioTV Live] Could not load the public channel index.", error);
    return [];
  }
};

export const getSearchPosts = async function ({
  searchQuery,
  page,
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
    const all = await fetchChannels(providerContext);
    const found = all.filter((c) =>
      [nameOf(c), String(c.language ?? c.lang ?? ""), String(c.category ?? c.genre ?? "")]
        .some((v) => v.toLowerCase().includes(query)),
    );
    const safePage = Math.max(1, Number(page) || 1);
    return found.slice((safePage - 1) * 40, safePage * 40).map((c) => ({
      title: nameOf(c),
      link: idOf(c),
      image: logoOf(c),
      provider: "jiotv",
      tag: String(c.language ?? c.lang ?? c.category ?? c.genre ?? "Live TV"),
    }));
  } catch (error) {
    console.warn("[JioTV Live] Channel search failed.", error);
    return [];
  }
};
