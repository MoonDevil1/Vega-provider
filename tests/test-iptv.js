const assert = require("node:assert/strict");
const { getPosts, getSearchPosts } = require("../dist/iptv/posts");
const { getMeta } = require("../dist/iptv/meta");
const { getStream } = require("../dist/iptv/stream");

const playlist = [
  "#EXTM3U",
  '#EXTINF:-1 tvg-id="B4UMovies.in@India",B4U Movies (576p)',
  "https://streams.example/b4u/one.m3u8",
  '#EXTINF:-1 tvg-id="B4UMovies.in@India",B4U Movies (1080p)',
  "https://streams.example/b4u/two.m3u8",
  '#EXTINF:-1 tvg-id="Pogo.in@SD",Pogo (576p)',
  "https://streams.example/pogo/index.m3u8",
  '#EXTINF:-1 tvg-id="DangalTV.in@SD",Dangal TV (720p)',
  "https://streams.example/dangal/index.m3u8",
  '#EXTINF:-1 tvg-id="ColorsTamil.in@HD",Colors Tamil HD',
  "https://streams.example/colors-tamil/index.m3u8",
  '#EXTINF:-1 tvg-id="AajTak.in@SD",Aaj Tak',
  "https://streams.example/news/index.m3u8",
].join("\n");

const channels = [
  { id: "B4UMovies.in", name: "B4U Movies", categories: ["movies"] },
  { id: "Pogo.in", name: "Pogo", categories: ["kids"] },
  { id: "DangalTV.in", name: "Dangal TV", categories: ["general"] },
  { id: "ColorsTamil.in", name: "Colors Tamil", categories: ["entertainment"] },
  { id: "AajTak.in", name: "Aaj Tak", categories: ["news"] },
];
const logos = [
  { channel: "B4UMovies.in", url: "https://logos.example/b4u.svg", in_use: true, format: "SVG", width: 200 },
  { channel: "Pogo.in", url: "https://logos.example/pogo.png", in_use: true, format: "PNG", width: 200 },
  { channel: "DangalTV.in", url: "https://logos.example/dangal.png", in_use: true, format: "PNG", width: 200 },
];

const storage = new Map();
const providerContext = {
  commonHeaders: {},
  axios: {
    get: async (url) => ({
      data: url.includes("logos.json") ? logos : url.includes("channels.json") ? channels : playlist,
    }),
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
  assert.equal(movies.length, 1);
  assert.equal(kids.length, 1);
  assert.equal(serials.length, 1);
  assert.equal(movies[0].image, "https://logos.example/b4u.svg");
  assert.equal(kids[0].title, "Pogo");
  assert.equal(serials[0].title, "Dangal TV");
  assert.equal((await getSearchPosts({ searchQuery: "dangal", providerContext })).length, 1);
  assert.equal((await getSearchPosts({ searchQuery: "colors", providerContext })).length, 0);

  const meta = await getMeta({ link: movies[0].link, providerContext });
  assert.equal(meta.linkList[0].directLinks.length, 2);
  assert.equal(meta.linkList[0].directLinks[1].link, "https://streams.example/b4u/two.m3u8");
  const cachelessMeta = await getMeta({
    link: movies[0].link,
    providerContext: { kvStore: { get: async () => undefined } },
  });
  assert.equal(cachelessMeta.linkList[0].directLinks[0].link, "https://streams.example/b4u/one.m3u8");

  const streams = await getStream({ link: meta.linkList[0].directLinks[0].link });
  assert.equal(streams[0].type, "m3u8");
  assert.equal(streams[0].link, "https://streams.example/b4u/one.m3u8");
  console.log("Hindi IPTV provider tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
