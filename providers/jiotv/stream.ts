import { Stream, ProviderContext } from "../types";

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
  const { axios } = providerContext;
  const configuredBase = String((await providerContext.kvStore.get<string>("jiotvBaseUrl")) || "http://127.0.0.1:5001").trim().replace(/\/+$/, "");
  const quality = String((await providerContext.kvStore.get<string>("jiotvQuality")) || "auto").toLowerCase();
  let target = String(link || "").trim();
  try {
    const u = new URL(target);
    // Only accept streams routed through the configured JioTV Go server.
    const configured = new URL(configuredBase);
    if (u.origin !== configured.origin) {
      const idMatch = u.pathname.match(/\/live\/(?:high\/|medium\/|low\/)?([^/?#]+)/i);
      if (!idMatch) return [];
      target = configuredBase + "/live/" + (quality === "auto" ? "" : quality + "/") + encodeURIComponent(decodeURIComponent(idMatch[1]));
    } else if (/\/live\/mpd\//i.test(u.pathname) || /\.mpd(?:$|\?)/i.test(target)) {
      // Vega's current provider contract does not provide a Widevine DRM license
      // session. Never attempt to extract or bypass DRM-protected channels.
      return [];
    } else if (/\/live\//i.test(u.pathname) && quality !== "auto" && !/\/live\/(?:high|medium|low)\//i.test(u.pathname)) {
      const idMatch = u.pathname.match(/\/live\/([^/?#]+)/i);
      if (idMatch) target = configuredBase + "/live/" + quality + "/" + encodeURIComponent(decodeURIComponent(idMatch[1]));
    }
  } catch {
    return [];
  }

  try {
    const response = await axios.get(target, {
      headers: { ...providerContext.commonHeaders, Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*" },
      timeout: 12000,
      signal,
      responseType: "text",
    });
    const body = String(response.data || "");
    if (!body.trimStart().startsWith("#EXTM3U")) return [];
    return [{
      server: "JioTV Go",
      link: target,
      type: "m3u8",
      quality: quality === "high" ? "1080" : quality === "medium" ? "720" : quality === "low" ? "480" : "auto",
      headers: { Referer: configuredBase + "/" },
    }];
  } catch (error) {
    console.warn("[JioTV] Stream check failed. Channel may require a separate subscription, be offline, or use DRM.", error);
    return [];
  }
};
