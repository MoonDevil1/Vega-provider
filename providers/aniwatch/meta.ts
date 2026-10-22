import { Info, Link, ProviderContext } from "../types";

const HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
};

function abs(value: string, base: string): string {
  try { return new URL(value, base).toString(); } catch { return ""; }
}
function clean(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export async function getMeta({ link, providerContext }: {
  link: string; provider?: string; providerContext: ProviderContext;
}): Promise<Info> {
  const empty: Info = { title: "", synopsis: "", image: "", imdbId: "", type: "series", linkList: [] };
  try {
    const url = new URL(link);
    if (url.hostname !== "aniwatch.lu" && !url.hostname.endsWith(".aniwatch.lu")) return empty;

    const response = await providerContext.axios.get(url.toString(), {
      headers: { ...HEADERS, Referer: "https://aniwatch.lu/" },
      timeout: 15000,
      maxRedirects: 5,
    });
    const $ = providerContext.cheerio.load(response.data);
    const episodePage = /-episode-\d+/i.test(url.pathname) || $("#ani_detail[data-episode-number]").length > 0;

    const title = clean(
      $(".anis-watch-detail .anisc-detail h2.film-name a").first().text() ||
      $(".anisc-detail h2.film-name").first().text() ||
      $(".anisc-detail .film-name").first().text() ||
      $("h2.film-name").first().text() ||
      $(".breadcrumb .breadcrumb-item.active").last().attr("data-jname") ||
      $("meta[property='og:title']").attr("content") ||
      $("title").text()
    ).replace(/\s+(English )?Sub\/?Dub.*$/i, "");

    const style = $(".anis-cover").first().attr("style") || "";
    const coverImage = style.match(/url\(['"]?(.*?)['"]?\)/i)?.[1] || "";
    const image = $(".anis-watch-detail .anisc-poster img").first().attr("src") ||
      $(".anisc-poster img.film-poster-img").first().attr("src") ||
      coverImage ||
      $("meta[property='og:image']").attr("content") || "";

    const synopsis = clean($(".film-description .text").first().text() ||
      $(".film-description").first().text() ||
      $("meta[name='description']").attr("content") || "");

    const animeLink = $(".anis-watch-detail .anisc-detail h2.film-name a").first().attr("href") ||
      $(".breadcrumb .breadcrumb-item a[href*='/anime/']").last().attr("href") ||
      $("a[href*='/anime/']").filter((_i: number, el: any) => /dynamic-name/.test($(el).attr("class") || "")).first().attr("href") ||
      link;

    const linkList: Link[] = [];
    const seasonSeen = new Set<string>();
    $(".detail-seasons .ss-item, .detail-seasons .season-item, .detail-seasons [data-season], .season-list a, .seasons-list a").each((_i: number, el: any) => {
      const item = $(el);
      const href = abs(item.attr("href") || item.find("a[href]").first().attr("href") || "", url.origin);
      const label = clean(item.attr("title") || item.text() || item.attr("data-season") || "");
      if (!href || !label || /episode|^eps?\s*:?\s*\d/i.test(label) || /-episode-\d+/i.test(new URL(href).pathname)) return;
      if (seasonSeen.has(href)) return;
      seasonSeen.add(href);
      linkList.push({ title: label, quality: "", episodesLink: href, directLinks: [] });
    });

    // The site uses episode-range pagination for long series; those are batches,
    // not seasons. Give Vega the actual page with the episode-list markup.
    if (!linkList.length) {
      linkList.push({
        title: "Episodes",
        quality: "",
        episodesLink: episodePage ? url.toString() : abs(animeLink, url.origin),
        directLinks: [],
      });
    }

    return {
      title: title || "Aniwatch",
      synopsis,
      image: abs(image, url.origin),
      imdbId: "",
      type: "series",
      linkList,
      webUrl: abs(animeLink, url.origin),
    };
  } catch (error) {
    console.warn("[Aniwatch] metadata request failed:", error);
    return empty;
  }
}
