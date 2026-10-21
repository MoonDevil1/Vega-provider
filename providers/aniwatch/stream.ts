import { Stream, ProviderContext, SkipInterval } from "../types";

const HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
};
function decodeBase64(value: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const input = String(value || "").replace(/[^A-Za-z0-9+/=]/g, "");
  let output = "";
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i);
    if (ch === "=") break;
    const idx = chars.indexOf(ch);
    if (idx < 0) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 255);
    }
  }
  try { return decodeURIComponent(escape(output)); } catch { return output; }
}
function absolute(value: string, base: string): string {
  try { return new URL(value, base).toString(); } catch { return ""; }
}
function readSkip($: any): SkipInterval[] {
  const out: SkipInterval[] = [];
  const pairs = [
    ["data-skip-intro-start", "data-skip-intro-end", "Intro"],
    ["data-intro-start", "data-intro-end", "Intro"],
    ["data-skip-outro-start", "data-skip-outro-end", "Outro"],
    ["data-outro-start", "data-outro-end", "Outro"],
  ];
  for (const [a, b, title] of pairs) {
    const from = Number($("[" + a + "]").first().attr(a));
    const to = Number($("[" + b + "]").first().attr(b));
    if (Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to > from) out.push({ title, from, to });
  }
  return out;
}
function directSources($: any, pageUrl: string): Stream[] {
  const out: Stream[] = [];
  const seen = new Set<string>();
  $("video[src], video source[src], source[src]").each((_i: number, node: any) => {
    const raw = $(node).attr("src") || "";
    const link = absolute(raw, pageUrl);
    if (!link || seen.has(link) || !/\.(m3u8|mp4|webm)(?:$|[?#])/i.test(link)) return;
    seen.add(link);
    out.push({ server: "Aniwatch direct", link, type: /\.m3u8(?:$|[?#])/i.test(link) ? "m3u8" : "mp4" });
  });
  // Accept only plainly exposed media URLs in the fetched HTML; don't decode or
  // reverse-engineer obfuscated third-party player scripts.
  const html = $.html();
  const re = /https?:\\?\/\\?\/[^\s"'<>]+?\.(?:m3u8|mp4)(?:\?[^\s"'<>]*)?/ig;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const link = match[0].replace(/\\\//g, "/").replace(/&amp;/g, "&");
    if (seen.has(link)) continue;
    seen.add(link);
    out.push({ server: "Aniwatch media", link, type: /\.m3u8(?:$|[?#])/i.test(link) ? "m3u8" : "mp4" });
  }
  return out;
}
export async function getStream({ link, signal, providerContext }: {
  link: string; type?: string; signal?: AbortSignal; providerContext: ProviderContext; isDownload?: boolean;
}): Promise<Stream[]> {
  try {
    const episodeUrl = new URL(link);
    if (episodeUrl.hostname !== "aniwatch.lu" && !episodeUrl.hostname.endsWith(".aniwatch.lu")) return [];
    const response = await providerContext.axios.get(episodeUrl.toString(), { headers: { ...HEADERS, Referer: "https://aniwatch.lu/" }, signal, timeout: 15000, maxRedirects: 5 });
    const $ = providerContext.cheerio.load(response.data);
    const skip = readSkip($);
    const result: Stream[] = [];
    const seen = new Set<string>();
    const servers: { name: string; url: string }[] = [];
    $(".server-item[data-hash], .server-item[data-url], .server-item a[data-url]").each((_i: number, node: any) => {
      const el = $(node);
      const encoded = el.attr("data-hash") || "";
      const raw = el.attr("data-url") || el.find("[data-url]").attr("data-url") || "";
      const decoded = encoded ? decodeBase64(encoded) : "";
      const serverUrl = absolute(raw || decoded, episodeUrl.origin);
      if (!serverUrl || seen.has(serverUrl)) return;
      seen.add(serverUrl);
      servers.push({ name: (el.attr("data-server-name") || el.text() || "Server").replace(/\s+/g, " ").trim(), url: serverUrl });
    });
    if (!servers.length) {
      const src = $(".player-frame [src]").first().attr("src") || $("iframe[src]").first().attr("src") || "";
      const serverUrl = absolute(src, episodeUrl.origin);
      if (serverUrl) servers.push({ name: "Default server", url: serverUrl });
    }
    for (const server of servers) {
      try {
        const playerResponse = await providerContext.axios.get(server.url, {
          headers: { ...HEADERS, Referer: episodeUrl.toString() }, signal, timeout: 12000, maxRedirects: 5,
        });
        const player$ = providerContext.cheerio.load(playerResponse.data);
        const sources = directSources(player$, server.url);
        if (sources.length) {
          for (const source of sources) result.push({ ...source, server: server.name + " · " + source.server, headers: { Referer: server.url }, skip: skip.length ? skip : undefined });
        } else {
          // Keep the public player page as a fallback; Vega's existing player may
          // not support every embed provider, so this is not guaranteed playable.
          result.push({ server: server.name + " (embed)", link: server.url, type: "embed", headers: { Referer: episodeUrl.toString() }, skip: skip.length ? skip : undefined });
        }
      } catch {
        result.push({ server: server.name + " (embed)", link: server.url, type: "embed", headers: { Referer: episodeUrl.toString() }, skip: skip.length ? skip : undefined });
      }
    }
    return result;
  } catch (error) {
    console.warn("[Aniwatch] stream resolution failed:", error);
    return [];
  }
}
