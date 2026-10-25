import { Info, ProviderContext } from "../types";

const LIST_URL = "https://jjtvxweb.pages.dev/jstr4web.json";
function channelsFrom(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ["channels", "data", "result", "results", "items"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  const id = String(link || "").trim();
  let channel: any = {};
  try {
    const response = await providerContext.axios.get(LIST_URL, {
      headers: { ...providerContext.commonHeaders, Accept: "application/json" },
      timeout: 15000,
    });
    channel = channelsFrom(response.data).find((c) => String(c.id ?? c.channel_id ?? c.channelId ?? "") === id) || {};
  } catch (error) {
    console.warn("[JioTV Live] Metadata lookup failed.", error);
  }
  const title = String(channel.name ?? channel.title ?? channel.channel_name ?? "Live TV Channel");
  const image = String(channel.logo ?? channel.logoUrl ?? channel.logo_url ?? channel.image ?? "");
  const directUrl = String(channel.url ?? channel.stream_url ?? channel.streamUrl ?? channel.play_url ?? "");
  return {
    title,
    synopsis: "Live TV channel listed by the configured public channel index. Playback availability depends on the source.",
    image: /^https?:\/\//i.test(image) ? image : "",
    imdbId: "",
    type: "movie",
    tags: ["Live TV"],
    linkList: [{ title: "Live", quality: "Auto", directLinks: [{ title, link: directUrl || id, type: "movie" }] }],
    webUrl: "https://www.jiotv.com/",
  };
};
