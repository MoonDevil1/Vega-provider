import { EpisodeLink, ProviderContext } from "../types";

function clean(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getEpisodeNumber(episode: EpisodeLink): number {
  try {
    const match = new URL(episode.link).pathname.match(/\/episode\/(\d+)/i);
    if (match) return Number(match[1]);
  } catch {}
  const match = String(episode.title || "").match(/(?:episode|ep|e)\s*0*(\d+)/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function parseEpisodes(html: string, pageUrl: string, season: string, cheerio: any): EpisodeLink[] {
  const $ = cheerio.load(html);
  let grid = season ? $(`#cinejoy-season-${season}`) : $(".cinejoy-season-grid.active").first();
  if (!grid.length) grid = $(".cinejoy-season-grid.active").first();
  if (!grid.length) grid = $(".cinejoy-season-grid").first();

  const episodes: EpisodeLink[] = [];
  const seen = new Set<string>();
  grid.find(".cinejoy-ep-card").each((_index: number, card: any) => {
    const el = $(card);
    const anchor = el.find("a.cinejoy-ep-thumb-link").first();
    const rawHref = anchor.attr("href") || el.find("a.cinejoy-ep-name").first().attr("href") || "";
    if (!rawHref) return;

    let href = "";
    try { href = new URL(rawHref, pageUrl).toString(); } catch { return; }
    if (seen.has(href)) return;

    const number = clean(el.find(".cinejoy-ep-badge-num").first().text());
    const name = clean(
      el.find(".cinejoy-ep-name").first().text() ||
      el.find(".cinejoy-ep-name").first().attr("title") ||
      anchor.attr("title") ||
      el.find("img").first().attr("alt") ||
      "",
    );
    const title = [number, name].filter(Boolean).join(" ").trim() || `Episode ${episodes.length + 1}`;
    seen.add(href);
    episodes.push({ title, link: href });
  });

  // Fallback for an episode layout without the expected card class.
  if (!episodes.length) {
    $("a[href*='/season/'][href*='/episode/']").each((_index: number, node: any) => {
      const anchor = $(node);
      let href = "";
      try { href = new URL(anchor.attr("href") || "", pageUrl).toString(); } catch { return; }
      if (!href || seen.has(href)) return;
      const title = clean(
        anchor.find(".cinejoy-ep-name").first().text() ||
        anchor.attr("title") ||
        anchor.text() ||
        anchor.find("img").first().attr("alt") ||
        "",
      );
      if (!title) return;
      seen.add(href);
      episodes.push({ title, link: href });
    });
  }

  return episodes;
}

function buildRangeUrl(inputUrl: URL, season: string, range: string, order: string): string {
  const page = new URL(inputUrl.toString());
  page.pathname = page.pathname
    .replace(/\/season\/\d+\/episode\/\d+\/?$/i, "")
    .replace(/\/episode\/\d+\/?$/i, "");
  page.search = "";
  page.searchParams.set("season", season);
  page.searchParams.set("ep_range", range);
  page.searchParams.set("ep_order", order);
  page.hash = "episodes";
  return page.toString();
}

export const getEpisodes = async function ({
  url,
  providerContext,
}: {
  url: string;
  providerContext: ProviderContext;
}): Promise<EpisodeLink[]> {
  const { axios, cheerio, commonHeaders: headers } = providerContext;

  try {
    const inputUrl = new URL(url);
    const baseUrl = inputUrl.origin;
    const requestHeaders = {
      ...headers,
      Referer: baseUrl + "/",
    };
    const response = await axios.get(inputUrl.toString(), {
      headers: requestHeaders,
      timeout: 15000,
      maxRedirects: 5,
    });
    const initialHtml = String(response.data || "");
    const $ = cheerio.load(initialHtml);

    const seasonFromPath = inputUrl.pathname.match(/\/season\/(\d+)/i)?.[1];
    const selectedSeason = clean(
      inputUrl.searchParams.get("season") ||
      seasonFromPath ||
      $(".cinejoy-season-pill-dropdown select[aria-label='Season'] option[selected]").first().attr("value") ||
      $(".cinejoy-season-pill-dropdown select[aria-label='Season']").first().val() ||
      "1",
    );
    const order = inputUrl.searchParams.get("ep_order") || "oldest";

    // The live site paginates long seasons with #episodeRangeSelect and
    // ?season=N&ep_range=FIRST_EP&ep_order=oldest. Fetch each range so Vega
    // receives one complete season list rather than only the visible batch.
    const ranges: string[] = [];
    $("#episodeRangeSelect option").each((_index: number, option: any) => {
      const value = clean($(option).attr("value"));
      if (/^\d+$/.test(value) && !ranges.includes(value)) ranges.push(value);
    });

    const initialRange =
      inputUrl.searchParams.get("ep_range") ||
      clean($("#episodeRangeSelect option[selected]").first().attr("value")) ||
      clean($("#episodeRangeSelect").first().val()) ||
      ranges[0] ||
      "";

    if (!ranges.length) {
      return parseEpisodes(initialHtml, inputUrl.toString(), selectedSeason, cheerio)
        .sort((a, b) => getEpisodeNumber(a) - getEpisodeNumber(b));
    }

    const all: EpisodeLink[] = [];
    const seen = new Set<string>();
    const pageJobs = ranges.map(async (range) => {
      if (range === initialRange) {
        return parseEpisodes(initialHtml, inputUrl.toString(), selectedSeason, cheerio);
      }
      const pageUrl = buildRangeUrl(inputUrl, selectedSeason, range, order);
      try {
        const pageResponse = await axios.get(pageUrl, {
          headers: requestHeaders,
          timeout: 15000,
          maxRedirects: 5,
        });
        return parseEpisodes(String(pageResponse.data || ""), pageUrl, selectedSeason, cheerio);
      } catch (error) {
        console.warn("[MultiMovies] episode range request failed:", pageUrl, error);
        return [];
      }
    });

    const batches = await Promise.all(pageJobs);
    for (const batch of batches) {
      for (const episode of batch) {
        if (seen.has(episode.link)) continue;
        seen.add(episode.link);
        all.push(episode);
      }
    }

    return all.sort((a, b) => getEpisodeNumber(a) - getEpisodeNumber(b));
  } catch (error) {
    console.warn("[MultiMovies] getEpisodes failed:", error);
    return [];
  }
};
