const assert = require("node:assert/strict");
const { getPosts, getSearchPosts } = require("../dist/iptv/posts");
const { getMeta } = require("../dist/iptv/meta");
const { getStream } = require("../dist/iptv/stream");

const playlist = [
  "#EXTM3U",
  '#EXTINF:-1 tvg-id="B4UMovies.in@India",B4U Movies (576p)',
  '#EXTVLCOPT:http-user-agent=Mozilla/5.0 Vega-Test',
  "https://streams.example/b4u/one.m3u8",
  '#EXTINF:-1 tvg-id="B4UMovies.in@India",B4U Movies (1080p)',
  "https://streams.example/b4u/two.m3u8",
  '#EXTINF:-1 tvg-id="Pogo.in@SD",Pogo (576p)',
  "https://streams.example/pogo/index.m3u8",
  '#EXTINF:-1 tvg-id="WOWKidz.in@Hindi",WOW Kidz (720p)',
  "https://streams.example/wow/hindi.m3u8",
  '#EXTINF:-1 tvg-id="WOWKidz.in@Telugu",WOW Kidz Telugu (720p)',
  "https://streams.example/wow/telugu.m3u8",
  '#EXTINF:-1 tvg-id="DangalTV.in@SD",Dangal TV (720p)',
  '#EXTVLCOPT:http-referrer=https://source.example/',
  "https://streams.example/dangal/index.m3u8",
  '#EXTINF:-1 tvg-id="ColorsTamil.in@HD",Colors Tamil HD',
  "https://streams.example/colors-tamil/index.m3u8",
  '#EXTINF:-1 tvg-id="Nickelodeon.in@SD",Nickelodeon [Geo-blocked]',
  "https://streams.example/nick/index.m3u8",
  '#EXTINF:-1 tvg-id="AajTak.in@SD",Aaj Tak',
  "https://streams.example/news/index.m3u8",
].join("\n");

const storage = new Map();
let playlistFetches = 0;
const providerContext = {
  commonHeaders: {},
  axios: { get: async () => { playlistFetches++; return { data: playlist }; } },
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
  assert.equal(kids.length, 2);
  assert.equal(serials.length, 1);
  assert.equal(movies[0].image, "https://dtil.tmsimg.com/assets/s140063_ld_h9_aa.png?lock=720x540");
  assert.equal(kids.some((post) => post.title.includes("Telugu")), false);
  assert.equal((await getSearchPosts({ searchQuery: "dangal", providerContext })).length, 1);
  assert.equal((await getSearchPosts({ searchQuery: "colors", providerContext })).length, 0);
  assert.equal(playlistFetches, 1, "playlist should be scraped once and reused from cache");

  const meta = await getMeta({ link: movies[0].link, providerContext });
  assert.equal(meta.linkList[0].directLinks.length, 2);
  assert.equal(meta.linkList[0].directLinks[1].link, "https://streams.example/b4u/two.m3u8");
  const cachelessMeta = await getMeta({
    link: movies[0].link,
    providerContext: { kvStore: { get: async () => undefined } },
  });
  const fallbackLink = cachelessMeta.linkList[0].directLinks[0].link;
  assert.ok(fallbackLink.includes("#vega_headers="));

  const streams = await getStream({ link: fallbackLink });
  assert.equal(streams[0].type, "m3u8");
  assert.equal(streams[0].link, "https://streams.example/b4u/one.m3u8");
  assert.equal(streams[0].headers["User-Agent"], "Mozilla/5.0 Vega-Test");

  const serialMeta = await getMeta({
    link: "iptv://channel/dangaltv.in",
    providerContext,
  });
  const serialStream = await getStream({ link: serialMeta.linkList[0].directLinks[0].link });
  assert.equal(serialStream[0].headers.Referer, "https://source.example/");
  console.log("Hindi IPTV scraping and playback-header tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
