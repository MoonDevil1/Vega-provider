import { Info, ProviderContext } from "../types";

const CACHE_KEY = "iptv-org-in-hindi-v2";

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  provider?: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  let title = "Live TV";
  let image = "";
  let directLinks: { title: string; link: string; type: "movie" }[] = [];
  try {
    const id = decodeURIComponent(String(link || "").replace("iptv://channel/", ""));
    const cached = await providerContext.kvStore.get<{ entries: any[] }>(CACHE_KEY);
    const matches = (cached && Array.isArray(cached.entries) ? cached.entries : [])
      .filter((entry) => entry.id === id);
    if (matches.length) {
      title = matches[0].name || title;
      image = matches[0].logo || "";
      directLinks = matches.map((entry, index) => ({
        title: "Live Stream " + (index + 1),
        link: entry.url,
        type: "movie" as const,
      }));
    }
  } catch {}
  if (!directLinks.length && /^https?:\/\//i.test(String(link || ""))) {
    directLinks = [{ title: "Watch Live", link, type: "movie" }];
    try {
      const hostname = new URL(link).hostname;
      title = decodeURIComponent(hostname.startsWith("www.") ? hostname.slice(4) : hostname);
    } catch {}
  }
  return {
    title,
    synopsis: "Live channel from the public iptv-org playlist. Multiple listed stream mirrors are offered when available; uptime and regional access depend on the broadcaster.",
    image,
    imdbId: "",
    type: "movie",
    linkList: [{ title: "Live", quality: "Auto", directLinks }],
  };
};