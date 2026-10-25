import { Info, ProviderContext } from "../types";

const LIST_URL = "https://jjtvxweb.pages.dev/jstr4web.json";
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_HEADERS = {
  "User-Agent": "okhttp/4.9.3",
  Referer: "https://www.jiotv.com/",
  Origin: "https://www.jiotv.com",
  Accept: "application/json",
};
let channelCache: { at: number; list: any[] } = { at: 0, list: [] };

function channelsFrom(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ["channels", "data", "result", "results", "items"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}
async function fetchChannels(ctx: ProviderContext): Promise<any[]> {
  if (channelCache.list.length && Date.now() - channelCache.at < CACHE_TTL_MS) return channelCache.list;
  const response = await ctx.axios.get(LIST_URL, {
    headers: { ...ctx.commonHeaders, ...REQUEST_HEADERS },
    timeout: 15000,
  });
  const list = channelsFrom(response.data);
  channelCache = { at: Date.now(), list };
  return list;
}

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  const id = String(link || "").trim();
  let channel: any = {};
  try {
    channel = (await fetchChannels(providerContext)).find((c) => String(c.id ?? c.channel_id ?? c.channelId ?? "").trim() === id) || {};
  } catch (error) {
    console.warn("[JioTV Live] Metadata lookup failed.", error);
  }
  const title = String(channel.name ?? channel.title ?? channel.channel_name ?? "Live TV Channel");
  const image = String(channel.logo ?? channel.logoUrl ?? channel.logo_url ?? channel.image ?? "");
  const directUrl = String(channel.url ?? channel.stream_url ?? channel.streamUrl ?? channel.play_url ?? "");
  return {
    title,
    synopsis: "Live TV channel listed by the configured public channel index. Playback availability depends on the source.",
    image: /^https?:\/\//i.test(image) ? image : "",
    imdbId: "",
    type: "movie",
    tags: ["Live TV"],
    linkList: [{ title: "Live", quality: "Auto", directLinks: [{ title, link: directUrl || id, type: "movie" }] }],
    webUrl: "https://www.jiotv.com/",
  };
};
