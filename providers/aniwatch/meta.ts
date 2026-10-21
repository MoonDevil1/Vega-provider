import { Info, Link, ProviderContext } from "../types";

const HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
};

function abs(value: string, base: string): string {
  try { return new URL(value, base).toString(); } catch { return ""; }
}
function readSkip($: any): { title: string; from: number; to: number }[] {
  const intervals: { title: string; from: number; to: number }[] = [];
  const root = $("body");
  const pairs = [
    ["data-skip-intro-start", "data-skip-intro-end", "Intro"],
    ["data-intro-start", "data-intro-end", "Intro"],
    ["data-skip-outro-start", "data-skip-outro-end", "Outro"],
    ["data-outro-start", "data-outro-end", "Outro"],
  ];
  for (const [startAttr, endAttr, title] of pairs) {
    const from = Number(root.find("[" + startAttr + "]").first().attr(startAttr));
    const to = Number(root.find("[" + endAttr + "]").first().attr(endAttr));
    if (Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to > from) intervals.push({ title, from, to });
  }
  return intervals;
}

export async function getMeta({ link, providerContext }: { link: string; provider?: string; providerContext: ProviderContext; }): Promise<Info> {
  const empty: Info = { title: "", synopsis: "", image: "", imdbId: "", type: "series", linkList: [] };
  try {
    const url = new URL(link);
    if (url.hostname !== "aniwatch.lu" && !url.hostname.endsWith(".aniwatch.lu")) return empty;
    const response = await providerContext.axios.get(url.toString(), { headers: { ...HEADERS, Referer: "https://aniwatch.lu/" }, timeout: 15000, maxRedirects: 5 });
    const $ = providerContext.cheerio.load(response.data);
    const episodePage = /-episode-\d+/i.test(url.pathname) || $("#ani_detail[data-episode-number]").length > 0;
    const title = ($(".anis-watch-detail .anisc-detail h2.film-name a").first().text()
      || $(".anisc-detail h2.film-name").first().text()
      || $(".anisc-detail .film-name").first().text()
      || $("h2.film-name").first().text()
      || $("meta[property='og:title']").attr("content")
      || $("title").text()).replace(/\s+/g, " ").replace(/\s+(English )?Sub\/?Dub.*$/i, "").trim();
    const image = $(".anis-watch-detail .anisc-poster img").first().attr("src")
      || $(".anisc-poster img.film-poster-img").first().attr("src")
      || $("meta[property='og:image']").attr("content") || "";
    const synopsis = $(".film-description .text").first().text().replace(/\s+/g, " ").trim()
      || $(".film-description").first().text().replace(/\s+/g, " ").trim()
      || $("meta[name='description']").attr("content") || "";
    const animeLink = $(".anis-watch-detail .anisc-detail h2.film-name a").first().attr("href")
      || $("a[href*='/anime/']").filter((_i: number, el: any) => /dynamic-name/.test($(el).attr("class") || "")).first().attr("href")
      || link;
    const episodes: Link[] = [];
    const seasonMap = new Map<string, string>();
    $(".detail-seasons .ss-item, .detail-seasons .season-item, .detail-seasons [data-season]").each((_i: number, el: any) => {
      const e = $(el);
      const href = e.attr("href") || e.find("a[href]").first().attr("href") || "";
      const label = (e.text() || e.attr("title") || "").replace(/\s+/g, " ").trim();
      if (href && label) seasonMap.set(label, abs(href, url.origin));
    });
    if (seasonMap.size) {
      seasonMap.forEach((href, label) => episodes.push({ title: label, quality: "", episodesLink: href, directLinks: [] }));
    } else {
      episodes.push({ title: "Episodes", quality: "", episodesLink: episodePage ? url.toString() : abs(animeLink, url.origin), directLinks: [] });
    }
    const explicitSkip = readSkip($);
    if (episodes.length && explicitSkip.length) {
      // Preserve only source-provided timing metadata; never guess timestamps.
      episodes[0].directLinks = [{ title: title || "Episode", link: url.toString(), type: "series", skip: explicitSkip }];
    }
    return {
      title: title || "Aniwatch",
      synopsis,
      image: abs(image, url.origin),
      imdbId: "",
      type: "series",
      linkList: episodes,
      webUrl: abs(animeLink, url.origin),
    };
  } catch (error) {
    console.warn("[Aniwatch] metadata request failed:", error);
    return empty;
  }
}
