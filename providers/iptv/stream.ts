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
  const value = String(link || "");
  if (!(value.startsWith("https://") || value.startsWith("http://"))) return [];
  const lower = value.toLowerCase().split("?")[0];
  const mediaType = lower.endsWith(".mpd") ? "mpd" : lower.endsWith(".mp4") ? "mp4" : "m3u8";
  return [{ server: "IPTV • Direct", link: value, type: mediaType, quality: "Auto" }];
};