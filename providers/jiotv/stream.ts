import { Stream, ProviderContext } from "../types";

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
function idOf(c: any): string {
  return String(c?.id ?? c?.channel_id ?? c?.channelId ?? "").trim();
}
async function fetchChannels(ctx: ProviderContext, signal?: AbortSignal): Promise<any[]> {
  if (channelCache.list.length && Date.now() - channelCache.at < CACHE_TTL_MS) return channelCache.list;
  const response = await ctx.axios.get(LIST_URL, {
    headers: { ...ctx.commonHeaders, ...REQUEST_HEADERS },
    timeout: 15000,
    signal,
  });
  const list = channelsFrom(response.data);
  channelCache = { at: Date.now(), list };
  return list;
}
function directMediaType(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (/\.mpd$/i.test(u.pathname)) return "mpd";
    if (/\.m3u8?$/i.test(u.pathname)) return "m3u8";
    if (/\.mp4$/i.test(u.pathname)) return "mp4";
    return null;
  } catch {
    return null;
  }
}

export const getStream = async function ({
  link,
  providerContext,
  signal,
}: {
  link: string;
  type: string;
  signal?: AbortSignal;
  providerContext: ProviderContext;
  isDownload?: boolean;
}): Promise<Stream[]> {
  const id = String(link || "").trim();
  if (!id) return [];
  try {
    const channel = (await fetchChannels(providerContext, signal)).find((c) => idOf(c) === id);
    if (!channel) return [];

    // Only use direct URLs published in the public channel record. No cookie/token
    // endpoint or ClearKey values are fetched or passed to the player.
    const url = String(channel.url ?? channel.stream_url ?? channel.streamUrl ?? channel.play_url ?? "").trim();
    const mediaType = directMediaType(url);
    if (!mediaType) {
      console.warn("[JioTV Live] No supported direct HLS, MP4, or DASH URL was published for this channel.");
      return [];
    }
    return [{
      server: "Public channel source",
      link: url,
      type: mediaType,
      quality: String(channel.quality ?? "auto"),
      headers: {
        "User-Agent": "okhttp/4.9.3",
        Referer: "https://www.jiotv.com/",
        Origin: "https://www.jiotv.com",
        ...(channel.headers && typeof channel.headers === "object" ? channel.headers : {}),
      },
    }];
  } catch (error) {
    console.warn("[JioTV Live] Stream lookup failed.", error);
    return [];
  }
};
