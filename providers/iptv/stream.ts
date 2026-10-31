import { Stream, ProviderContext } from "../types";

export const getStream = async function ({
  link,
}: {
  link: string;
  type: string;
  signal?: AbortSignal;
  providerContext: ProviderContext;
  isDownload?: boolean;
}): Promise<Stream[]> {
  const raw = String(link || "");
  const marker = "#vega_headers=";
  const markerIndex = raw.lastIndexOf(marker);
  let value = raw;
  let headers: Record<string, string> = {};

  if (markerIndex >= 0) {
    value = raw.slice(0, markerIndex);
    try {
      const parsed = JSON.parse(decodeURIComponent(raw.slice(markerIndex + marker.length)));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        headers = Object.fromEntries(Object.entries(parsed).filter(([key, val]) => typeof key === "string" && typeof val === "string"));
      }
    } catch {}
  }

  if (!(value.startsWith("https://") || value.startsWith("http://"))) return [];
  const lower = value.toLowerCase().split(/[?#]/)[0];
  const mediaType = lower.endsWith(".mpd") ? "mpd" : lower.endsWith(".mp4") ? "mp4" : "m3u8";
  return [{
    server: "IPTV • Direct",
    link: value,
    type: mediaType,
    quality: "Auto",
    ...(Object.keys(headers).length ? { headers } : {}),
  }];
};
