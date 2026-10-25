import { Stream, ProviderContext } from "../types";

const LIST_URL = "https://jjtvxweb.pages.dev/jstr4web.json";

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
function isAllowedDirectMedia(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    // Do not attempt DRM/DASH playback or handle supplied decryption keys/tokens.
    if (/\.mpd$/i.test(u.pathname)) return false;
    return /\.m3u8?$/i.test(u.pathname) || /\.mp4$/i.test(u.pathname);
  } catch {
    return false;
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
    const response = await providerContext.axios.get(LIST_URL, {
      headers: { ...providerContext.commonHeaders, Accept: "application/json" },
      timeout: 15000,
      signal,
    });
    const channel = channelsFrom(response.data).find((c) => idOf(c) === id);
    if (!channel) return [];

    // Use only a direct, non-DRM HLS/MP4 URL already published in the channel record.
    // No external cookie/token endpoint or ClearKey/DRM material is requested or used.
    const url = String(channel.url ?? channel.stream_url ?? channel.streamUrl ?? channel.play_url ?? "").trim();
    if (!isAllowedDirectMedia(url)) {
      console.warn("[JioTV Live] This channel has no supported direct HLS/MP4 URL; DRM/DASH streams are not handled.");
      return [];
    }
    return [{
      server: "Public channel source",
      link: url,
      type: /\.mp4(?:$|\?)/i.test(url) ? "mp4" : "m3u8",
      quality: String(channel.quality ?? "auto"),
      headers: { Referer: "https://www.jiotv.com/" },
    }];
  } catch (error) {
    console.warn("[JioTV Live] Stream lookup failed.", error);
    return [];
  }
};
