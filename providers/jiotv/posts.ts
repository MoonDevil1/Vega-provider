import { Post, ProviderContext } from "../types";

type Channel = Record<string, any>;

function baseUrlFrom(ctx: ProviderContext): Promise<string> {
  return ctx.kvStore.get<string>("jiotvBaseUrl").then((v) => {
    const value = String(v || "http://127.0.0.1:5001").trim();
    return value.replace(/\/+$/, "");
  });
}

function channelList(payload: any): Channel[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ["channels", "data", "results", "items"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
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
function getLanguage(c: Channel): string {
  return String(c.language ?? c.lang ?? "").trim();
}
function getGenre(c: Channel): string {
  return String(c.genre ?? c.category ?? c.group ?? c.type ?? "").trim();
}
function getLogo(c: Channel): string {
  return String(c.logo ?? c.logo_url ?? c.image ?? c.icon ?? "").trim();
}
function matchesFilter(c: Channel, filter: string): boolean {
  const f = String(filter || "all");
  if (f === "all") return true;
  const [kind, ...rest] = f.split("/");
  const wanted = rest.join("/").toLowerCase();
  if (!wanted) return true;
  if (kind === "language") return getLanguage(c).toLowerCase().includes(wanted);
  if (kind === "genre") return getGenre(c).toLowerCase().includes(wanted);
  return true;
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
  return { base, channels: channelList(response.data) };
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
    return channels.filter((c) => matchesFilter(c, filter)).map((c) => toPost(c, base)).filter((p): p is Post => Boolean(p));
  } catch (error) {
    console.warn("[JioTV] Unable to load channels. Check the JioTV Go server URL and login.", error);
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
