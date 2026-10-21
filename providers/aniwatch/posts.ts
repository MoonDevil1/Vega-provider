import { Post, ProviderContext } from "../types";

const BASE = "https://aniwatch.lu";
const HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  Referer: BASE + "/",
};

function absolute(href: string, base: string): string {
  try { return new URL(href, base).toString(); } catch { return ""; }
}
function cleanTitle(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}
function canonical(href: string): string {
  try {
    const u = new URL(href);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    u.searchParams.sort();
    return u.toString();
  } catch { return href.trim(); }
}
function getPostsFromHtml(html: string, cheerio: any, baseUrl: string): Post[] {
  const $ = cheerio.load(html);
  const result: Post[] = [];
  const seen = new Set<string>();
  $(".film_list-wrap .flw-item, .block_area-content .flw-item, .film_list .flw-item").each((_i: number, node: any) => {
    const card = $(node);
    const titleLink = card.find(".film-detail .film-name a, .film-name a").first();
    const posterLink = card.find("a.film-poster-ahref, .film-poster a[href]").first();
    const href = titleLink.attr("href") || posterLink.attr("href") || "";
    const link = absolute(href, baseUrl);
    const title = cleanTitle(titleLink.attr("title") || titleLink.attr("data-en") || titleLink.text() || card.find("img").first().attr("alt") || "");
    if (!link || !title || !/aniwatch\.lu$/i.test(new URL(link).hostname)) return;
    if (/\/(?:genre|type|home|most-popular|top-airing|subbed-anime|dubbed-anime)\/?$/i.test(new URL(link).pathname)) return;
    const key = canonical(link);
    if (seen.has(key)) return;
    seen.add(key);
    const img = card.find("img.film-poster-img, .film-poster img").first();
    const image = absolute(img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src") || "", baseUrl);
    result.push({ title, link, image });
  });
  if (result.length) return result;

  // Hero/spotlight cards use explicit Detail or Watch Now links.
  $(".deslide-item, .swiper-slide, .deslide-wrap").each((_i: number, node: any) => {
    const card = $(node);
    const a = card.find('a[href*="/anime/"], a[href*="-episode-"]').first();
    const link = absolute(a.attr("href") || "", baseUrl);
    const title = cleanTitle(card.find(".desi-head-title, h2, h3").first().text() || a.attr("title") || "");
    if (!link || !title || seen.has(canonical(link))) return;
    seen.add(canonical(link));
    const img = card.find("img").first();
    result.push({ title, link, image: absolute(img.attr("data-src") || img.attr("src") || "", baseUrl) });
  });
  return result;
}

export async function getPosts({ filter, page = 1, signal, providerContext }: {
  filter?: string; page?: number; signal?: AbortSignal; providerValue?: string; providerContext: ProviderContext;
}): Promise<Post[]> {
  const route = String(filter || "/home/").trim();
  const safePage = Math.max(1, Number(page) || 1);
  let url: URL;
  try { url = new URL(route, BASE); } catch { url = new URL("/home/", BASE); }
  if (url.origin !== BASE) url = new URL("/home/", BASE);
  if (safePage > 1) {
    if (url.searchParams.has("s")) url.searchParams.set("paged", String(safePage));
    else url.pathname = url.pathname.replace(/\/+$/, "") + "/page/" + safePage + "/";
  }
  try {
    const res = await providerContext.axios.get(url.toString(), { headers: HEADERS, signal, timeout: 15000, maxRedirects: 5 });
    return getPostsFromHtml(String(res.data || ""), providerContext.cheerio, url.toString());
  } catch (error) {
    console.warn("[Aniwatch] catalog request failed:", error);
    return [];
  }
}

export async function getSearchPosts({ searchQuery, page = 1, signal, providerContext }: {
  searchQuery: string; page?: number; providerValue?: string; signal?: AbortSignal; providerContext: ProviderContext;
}): Promise<Post[]> {
  const url = new URL("/", BASE);
  url.searchParams.set("s", String(searchQuery || "").trim());
  if (Number(page) > 1) url.searchParams.set("paged", String(Math.max(1, Number(page) || 1)));
  try {
    const res = await providerContext.axios.get(url.toString(), { headers: HEADERS, signal, timeout: 15000, maxRedirects: 5 });
    return getPostsFromHtml(String(res.data || ""), providerContext.cheerio, url.toString());
  } catch (error) {
    console.warn("[Aniwatch] search request failed:", error);
    return [];
  }
}
