"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMeta = async function ({ link, providerContext }) {
    let title = "Live TV", image = "", directLinks = [];
    const rawLink = String(link || "");
    const channelPart = rawLink.replace(/^iptv:\/\/channel\//, "").split("?")[0];
    let id = "";
    try { id = decodeURIComponent(channelPart); } catch { id = channelPart; }
    try {
        const cached = await providerContext.kvStore.get("iptv-org-in-hindi-v5");
        const matches = cached && Array.isArray(cached.entries) ? cached.entries.filter((entry) => entry.id === id) : [];
        if (matches.length) {
            title = matches[0].name || title;
            image = matches[0].logo || "";
            directLinks = matches.map((entry, index) => ({ title: "Stream " + (index + 1), link: entry.url, type: "movie" }));
        }
    } catch { }
    if (!directLinks.length) {
        const match = rawLink.match(/[?&]stream=([^&]+)/);
        if (match) try { directLinks = [{ title: "Watch Live", link: decodeURIComponent(match[1]), type: "movie" }]; } catch { }
    }
    if (!directLinks.length && /^https?:\/\//i.test(rawLink)) {
        directLinks = [{ title: "Watch Live", link: rawLink, type: "movie" }];
        try { title = new URL(rawLink).hostname.replace(/^www\./, ""); } catch { }
    }
    if (title === "Live TV" && id) title = id.replace(/\.in$/i, "").replace(/[._-]+/g, " ");
    return { title, synopsis: "Live channel from the public iptv-org India playlist. All distinct listed Hindi-category mirrors are retained. Availability can vary by region.", image, imdbId: "", type: "movie", linkList: [{ title: "Live", quality: "Auto", directLinks }] };
};
