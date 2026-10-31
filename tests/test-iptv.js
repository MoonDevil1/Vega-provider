const assert = require("node:assert/strict");
const { getPosts, getSearchPosts } = require("../dist/iptv/posts");
const { getMeta } = require("../dist/iptv/meta");
const { getStream } = require("../dist/iptv/stream");

const playlist = [
  "#EXTM3U",
  '#EXTINF:-1 tvg-id="HindiMovie.in",Hindi Movie Channel',
  "https://streams.example/movie/index.m3u8",
  '#EXTINF:-1 tvg-id="HindiKids.in",Hindi Kids Channel',
  "https://streams.example/kids/index.m3u8",
  '#EXTINF:-1 tvg-id="HindiSerial.in",Hindi Serial Channel',
  "https://streams.example/serial/index.m3u8",
  '#EXTINF:-1 tvg-name="Zee Cinema HD",Zee Cinema HD (1080p)',
  "https://streams.example/zeecinema/master.m3u8",
].join("\n");

const channels = [
  { id: "HindiMovie.in", name: "Hindi Movie Channel", logo: "https://logos.example/movie.png", languages: ["hin"], categories: ["movies"] },
  { id: "HindiKids.in", name: "Hindi Kids Channel", logo: "https://logos.example/kids.png", languages: ["hin"], categories: ["kids"] },
  { id: "HindiSerial.in", name: "Hindi Serial Channel", logo: "https://logos.example/serial.png", languages: ["hin"], categories: ["entertainment"] },
];

const storage = new Map();
const providerContext = {
  commonHeaders: {},
  axios: {
    get: async (url) => ({ data: url.includes("channels.json") ? channels : playlist }),
  },
  kvStore: {
    get: async (key) => storage.get(key),
    set: async (key, value) => storage.set(key, value),
  },
};

(async () => {
  const movies = await getPosts({ filter: "movies", providerContext });
  const kids = await getPosts({ filter: "kids", providerContext });
  const serials = await getPosts({ filter: "serials", providerContext });
  assert.equal(movies.length, 2);
  assert.equal(kids.length, 1);
  assert.equal(serials.length, 1);
  assert.equal(movies[0].image, "https://logos.example/movie.png");
  assert.equal((await getSearchPosts({ searchQuery: "serial", providerContext })).length, 1);

  const meta = await getMeta({ link: movies[0].link, providerContext });
  assert.equal(meta.linkList[0].directLinks[0].link, "https://streams.example/movie/index.m3u8");
  const cachelessMeta = await getMeta({
    link: movies[0].link,
    providerContext: { kvStore: { get: async () => undefined } },
  });
  assert.equal(cachelessMeta.linkList[0].directLinks[0].link, "https://streams.example/movie/index.m3u8");

  const streams = await getStream({ link: meta.linkList[0].directLinks[0].link, type: "movie", providerContext });
  assert.equal(streams[0].type, "m3u8");
  assert.equal(streams[0].link, "https://streams.example/movie/index.m3u8");
  console.log("Hindi IPTV provider tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
