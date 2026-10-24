import { Info, ProviderContext } from "../types";

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  const { axios } = providerContext;
  const base = String((await providerContext.kvStore.get<string>("jiotvBaseUrl")) || "http://127.0.0.1:5001").trim().replace(/\/+$/, "");
  const id = decodeURIComponent(String(link).split("/").pop() || "");
  let title = "JioTV Channel " + id;
  let image = "";
  let synopsis = "Live TV channel provided by your authenticated JioTV Go instance.";
  try {
    const response = await axios.get(base + "/channels", {
      headers: { ...providerContext.commonHeaders, Accept: "application/json" },
      timeout: 12000,
    });
    const payload: any = response.data;
    const channels: any[] = Array.isArray(payload) ? payload : (payload?.channels || payload?.data || payload?.results || []);
    const channel = channels.find((c) => String(c.id ?? c.channel_id ?? c.channelId ?? c.channelID ?? "") === id);
    if (channel) {
      title = String(channel.name ?? channel.channel_name ?? channel.channelName ?? channel.title ?? title);
      image = String(channel.logo ?? channel.logo_url ?? channel.image ?? channel.icon ?? "");
      const language = String(channel.language ?? channel.lang ?? "");
      const genre = String(channel.genre ?? channel.category ?? channel.group ?? "");
      synopsis = [language, genre].filter(Boolean).join(" · ") || synopsis;
    }
  } catch (error) {
    console.warn("[JioTV] Metadata lookup failed:", error);
  }
  const streamUrl = base + "/live/" + encodeURIComponent(id);
  return {
    title,
    synopsis,
    image: /^https?:\/\//i.test(image) ? image : "",
    imdbId: "",
    type: "movie",
    tags: ["Live TV"],
    linkList: [{
      title: "Live",
      quality: "Auto",
      directLinks: [{ title, link: streamUrl, type: "movie" }],
    }],
    webUrl: base,
  };
};
