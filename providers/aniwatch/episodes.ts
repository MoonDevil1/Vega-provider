import { EpisodeLink, ProviderContext } from "../types";

const HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
};

function absolute(value: string, base: string): string {
  try { return new URL(value, base).toString(); } catch { return ""; }
}
function clean(value: string): string {
  return String(value || "").replace(/\\s+/g, " ").trim();
}
function episodeNumber(value: string): number {
  const match = String(value || "").match(/(?:episode|ep)?\\s*0*(\\d+(?:\\.\\d+)?)/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export async function getEpisodes({ url, providerContext }: {
  url: string; providerContext: ProviderContext;
}): Promise<EpisodeLink[]> {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "aniwatch.lu" && !parsed.hostname.endsWith(".aniwatch.lu")) return [];

    const response = await providerContext.axios.get(parsed.toString(), {
      headers: { ...HEADERS, Referer: "https://aniwatch.lu/" },
      timeout: 15000,
      maxRedirects: 5,
    });
    const $ = providerContext.cheerio.load(response.data);
    const episodes: EpisodeLink[] = [];
    const seen = new Set<string>();

    // Aniwatch currently renders large series in several hidden .ss-list
    // containers (for example EPS 001-100, EPS 101-200, etc.). Parse every
    // page container, not only the visible/current batch.
    const selectors = [
      "#episodes-content .ss-list a.ep-item",
      "#episodes-content a.ep-item",
      "#episodes-content a[href*='-episode-']",
      ".detail-seasons a[href*='-episode-']",
      "a.ep-item[href*='-episode-']",
    ];

    for (const selector of selectors) {
      $(selector).each((_i: number, node: any) => {
        const a = $(node);
        const href = absolute(a.attr("href") || "", parsed.origin);
        if (!href || seen.has(href) || !/-episode-[^/]+\\/?(?:[?#].*)?$/i.test(new URL(href).pathname + new URL(href).search)) return;

        const number = clean(a.attr("data-number") || a.find(".ssli-order").attr("title") || a.find(".ssli-order").text() || "");
        const name = clean(
          a.find(".ep-name").attr("title") ||
          a.find(".ep-name").text() ||
          a.attr("title") ||
          ""
        );
        const title = name || (number ? "Episode " + number : "Episode " + (episodes.length + 1));
        seen.add(href);
        episodes.push({ title, link: href });
      });
    }

    // Some versions render the active episode separately from the paginated
    // list, or omit the ep-item class. Keep the fallback broad but URL-specific.
    if (!episodes.length) {
      $("a[href*='-episode-']").each((_i: number, node: any) => {
        const a = $(node);
        const href = absolute(a.attr("href") || "", parsed.origin);
        if (!href || seen.has(href)) return;
        let target: URL;
        try { target = new URL(href); } catch { return; }
        if (target.hostname !== parsed.hostname || !/-episode-[^/]+\\/?$/i.test(target.pathname)) return;
        const title = clean(a.find(".ep-name").text() || a.attr("title") || a.text()) || "Episode " + (episodes.length + 1);
        seen.add(href);
        episodes.push({ title, link: href });
      });
    }

    episodes.sort((a, b) => episodeNumber(a.title) - episodeNumber(b.title));
    return episodes;
  } catch (error) {
    console.warn("[Aniwatch] episode request failed:", error);
    return [];
  }
}
