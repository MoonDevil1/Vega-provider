import { Post, ProviderContext } from "../types";

type Channel = Record<string, any>;
const LIST_URL = "https://jjtvxweb.pages.dev/jstr4web.json";

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
  const response = await ctx.axios.get(LIST_URL, {
    headers: { ...ctx.commonHeaders, Accept: "application/json" },
    timeout: 15000,
  });
  return channelsFrom(response.data).filter((c) => idOf(c) && nameOf(c));
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
