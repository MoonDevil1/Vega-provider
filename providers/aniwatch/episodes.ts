import { EpisodeLink, ProviderContext } from "../types";

const HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
};
function abs(value: string, base: string): string {
  try { return new URL(value, base).toString(); } catch { return ""; }
}
function parseSkip($: any): { title: string; from: number; to: number }[] {
  const out: { title: string; from: number; to: number }[] = [];
  const groups = [
    ["data-skip-intro-start", "data-skip-intro-end", "Intro"],
    ["data-intro-start", "data-intro-end", "Intro"],
    ["data-skip-outro-start", "data-skip-outro-end", "Outro"],
    ["data-outro-start", "data-outro-end", "Outro"],
  ];
  for (const [a, b, title] of groups) {
    const from = Number($("[" + a + "]").first().attr(a));
    const to = Number($("[" + b + "]").first().attr(b));
    if (Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to > from) out.push({ title, from, to });
  }
  return out;
}
export async function getEpisodes({ url, providerContext }: { url: string; providerContext: ProviderContext }): Promise<EpisodeLink[]> {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "aniwatch.lu" && !parsed.hostname.endsWith(".aniwatch.lu")) return [];
    const res = await providerContext.axios.get(parsed.toString(), { headers: { ...HEADERS, Referer: "https://aniwatch.lu/" }, timeout: 15000, maxRedirects: 5 });
    const $ = providerContext.cheerio.load(res.data);
    const episodes: EpisodeLink[] = [];
    const seen = new Set<string>();
    $("#episodes-content .ss-list .ep-item, #episodes-content a.ep-item, .detail-seasons .ep-item").each((_i: number, node: any) => {
      const a = $(node);
      const href = abs(a.attr("href") || "", parsed.origin);
      if (!href || seen.has(href)) return;
      seen.add(href);
      const number = (a.attr("data-number") || a.find(".ssli-order").text() || "").trim();
      const name = (a.find(".ep-name").text() || a.attr("title") || "").replace(/\s+/g, " ").trim();
      const title = name || (number ? "Episode " + number : "Episode");
      const skip = parseSkip($);
      episodes.push({ title, link: href, skip: skip.length ? skip : undefined });
    });
    if (episodes.length) return episodes;

    // Some titles expose only an episode link from their detail page.
    const first = $("a[href*='-episode-']").filter((_i: number, el: any) => {
      const href = $(el).attr("href") || "";
      return /aniwatch\.lu/i.test(href);
    }).first();
    const href = abs(first.attr("href") || "", parsed.origin);
    if (href && href !== parsed.toString()) {
      const label = (first.attr("title") || first.text() || "Episode 1").replace(/\s+/g, " ").trim();
      return [{ title: label, link: href }];
    }
    return [];
  } catch (error) {
    console.warn("[Aniwatch] episode request failed:", error);
    return [];
  }
}
