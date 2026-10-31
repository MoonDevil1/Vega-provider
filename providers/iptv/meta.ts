import { Info, ProviderContext } from "../types";

export const getMeta = async function ({
  link,
}: {
  link: string;
  provider?: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  let title = "Live TV";
  try {
    const hostname = new URL(link).hostname;
    title = decodeURIComponent(hostname.startsWith("www.") ? hostname.slice(4) : hostname);
  } catch {}
  return {
    title,
    synopsis: "Live television stream from the public iptv-org playlist. Channel availability depends on the broadcaster and region.",
    image: "",
    imdbId: "",
    type: "movie",
    linkList: [{ title: "Live", quality: "Auto", directLinks: [{ title: "Watch Live", link, type: "movie" }] }],
  };
};