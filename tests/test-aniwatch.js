const assert = require("node:assert/strict");
const cheerio = require("cheerio");
const { getPosts, getSearchPosts } = require("../dist/aniwatch/posts.js");
const { getMeta } = require("../dist/aniwatch/meta.js");
const { getEpisodes } = require("../dist/aniwatch/episodes.js");
const { getStream } = require("../dist/aniwatch/stream.js");

const base = "https://aniwatch.lu";
const episodeUrl = base + "/one-piece-episode-1180/";
const playerUrl = "https://zokoanime.video/stream/mal/21/1180/sub";
const hlsUrl = "https://media.example.test/one-piece/1180/master.m3u8";
const homeHtml = `
<div class="film_list-wrap">
  <div class="flw-item">
    <div class="film-poster"><img class="film-poster-img" data-src="/poster-one.jpg" alt="One Piece"></div>
    <div class="film-detail"><h3 class="film-name"><a href="/one-piece-episode-1180/" title="One Piece">One Piece</a></h3></div>
    <a class="film-poster-ahref" href="/one-piece-episode-1180/"></a>
  </div>
  <div class="flw-item">
    <div class="film-poster"><img class="film-poster-img" src="/poster-one.jpg" alt="One Piece"></div>
    <div class="film-detail"><h3 class="film-name"><a href="/one-piece-episode-1180/" title="One Piece">One Piece</a></h3></div>
    <a class="film-poster-ahref" href="/one-piece-episode-1180/"></a>
  </div>
</div>`;
const episodeHtml = `
<html><head><title>One Piece Episode 1180 English Sub/Dub at Aniwatch</title></head>
<body data-skip-intro-start="12" data-skip-intro-end="40" data-skip-outro-start="1320" data-skip-outro-end="1380">
  <div id="ani_detail" data-anime-id="1963" data-id="99566" data-episode-number="1180">
    <div class="anis-watch-detail">
      <div class="anisc-poster"><img src="/poster-one.jpg" class="film-poster-img" alt="One Piece"></div>
      <div class="anisc-detail"><h2 class="film-name"><a href="/anime/one-piece/">One Piece</a></h2></div>
    </div>
    <div class="film-description"><div class="text">Pirates search for the One Piece.</div></div>
    <div class="player-frame"></div>
    <div class="server-item" data-type="sub" data-server-name="HD-1" data-hash="${Buffer.from(playerUrl).toString("base64")}"><a class="btn active">HD-1</a></div>
    <div id="episodes-content"><div class="ss-list" data-page="12">
      <a title="Episode 1179" class="ssl-item ep-item" data-number="1179" href="/one-piece-episode-1179/"><div class="ep-name">Episode 1179</div></a>
      <a title="Episode 1180" class="ssl-item ep-item active" data-number="1180" href="/one-piece-episode-1180/"><div class="ep-name">Episode 1180</div></a>
    </div></div>
  </div>
</body></html>`;
const playerHtml = `<html><body><video><source src="${hlsUrl}" type="application/x-mpegURL"></video></body></html>`;

const providerContext = {
  cheerio,
  commonHeaders: {},
  axios: {
    get: async (url) => {
      if (String(url).includes("zokoanime.video")) return { data: playerHtml, status: 200 };
      if (String(url).includes("aniwatch.lu")) return { data: homeHtml.includes("film_list-wrap") && !String(url).includes("one-piece-episode-1180") ? homeHtml : episodeHtml, status: 200 };
      throw new Error("Unexpected URL: " + url);
    },
  },
};

(async () => {
  const posts = await getPosts({ filter: "/home/", page: 1, providerContext });
  assert.equal(posts.length, 1, "catalog should deduplicate repeated title links");
  assert.equal(posts[0].title, "One Piece");
  assert.equal(posts[0].image, base + "/poster-one.jpg");

  const search = await getSearchPosts({ searchQuery: "One Piece", page: 1, providerContext });
  assert.equal(search.length, 1, "search should parse result cards");

  const meta = await getMeta({ link: episodeUrl, providerContext });
  assert.match(meta.title, /One Piece/i);
  assert.equal(meta.type, "series");
  assert.ok(meta.linkList.length > 0, "metadata should expose an episode-list entry");

  const episodes = await getEpisodes({ url: episodeUrl, providerContext });
  assert.equal(episodes.length, 2, "episode list should parse available episode cards");
  assert.equal(episodes[1].link, episodeUrl);

  const streams = await getStream({ link: episodeUrl, providerContext });
  assert.ok(streams.some((s) => s.link === hlsUrl && s.type === "m3u8"), "explicit HLS source should be returned");
  const stream = streams.find((s) => s.link === hlsUrl);
  assert.deepEqual(stream.skip.map((s) => [s.title, s.from, s.to]), [["Intro", 12, 40], ["Outro", 1320, 1380]]);

  console.log("Aniwatch provider tests passed: catalog, search, metadata, episodes, HLS and explicit skip ranges.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
