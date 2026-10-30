const assert = require("node:assert/strict");
const cheerio = require("cheerio");
const { getMeta } = require("../dist/multi/meta.js");
const { getEpisodes } = require("../dist/multi/episodes.js");

const base = "https://m1.multimovies.courses";
const seriesUrl = base + "/series/test-show";

function episodeCard(number, name) {
  return '<div class="cinejoy-ep-card" id="ep-item-1-' + number + '">' +
    '<a class="cinejoy-ep-thumb-link" href="' + seriesUrl + '/season/1/episode/' + number + '">' +
    '<span class="cinejoy-ep-badge-num">E' + number + '</span></a>' +
    '<a class="cinejoy-ep-name" title="' + name + '" href="' + seriesUrl + '/season/1/episode/' + number + '">' + name + '</a></div>';
}

function seasonPage(options) {
  const season = options.season || 1;
  const episodes = options.episodes || [];
  const ranges = options.ranges || [];
  const rangeSelect = ranges.length
    ? '<select id="episodeRangeSelect" class="cinejoy-season-select episode-range-select">' +
      ranges.map((range) => '<option value="' + range + '"' + (range === (episodes[0] ? episodes[0].number : ranges[0]) ? ' selected=""' : '') + '>Episodes ' + range + '</option>').join("") +
      '</select>'
    : "";
  return '<html><body>' +
    '<div class="cinejoy-detail-title">Test Show</div>' +
    '<div id="cinejoyOverview">A test synopsis.</div>' +
    '<div class="watch-bg"><img src="/poster.jpg"></div>' +
    '<section class="cinejoy-episodes-section">' + rangeSelect +
    '<div class="cinejoy-season-pill-dropdown"><select class="cinejoy-season-select" aria-label="Season">' +
    '<option value="1"' + (season === 1 ? ' selected=""' : '') + '>Season 1 · 3 episodes</option>' +
    '<option value="2"' + (season === 2 ? ' selected=""' : '') + '>Season 2 · 1 episode</option>' +
    '</select></div><div class="cinejoy-season-grid active" id="cinejoy-season-' + season + '">' +
    episodes.map((episode) => episodeCard(episode.number, episode.name)).join("") +
    '</div></section></body></html>';
}

const firstRange = seasonPage({
  season: 1,
  episodes: [{ number: 1, name: "Pilot" }, { number: 2, name: "Second" }],
  ranges: [1, 3],
});
const secondRange = seasonPage({
  season: 1,
  episodes: [{ number: 3, name: "Third" }],
  ranges: [1, 3],
});
const secondSeason = seasonPage({
  season: 2,
  episodes: [{ number: 4, name: "Season Two Premiere" }],
});

const legacyDownloadLinksPage =
  '<html><body><div class="entry-content">' +
  '<h5>Episode 1: Pilot</h5>' +
  '<div class="downloads-btns-div"><a href="/hubcloud/episode-1" style="background: linear-gradient(135deg,#e629d0,#007bff);">HubCloud</a></div>' +
  '</div></body></html>';

const episodeRequests = [];
const platformUserAgent = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36";

const providerContext = {
  cheerio,
  commonHeaders: { "User-Agent": platformUserAgent },
  axios: {
    get: async (url, config = {}) => {
      episodeRequests.push({ url, headers: config.headers || {} });
      const parsed = new URL(url);
      const season = parsed.searchParams.get("season") || "1";
      const range = parsed.searchParams.get("ep_range");
      if (parsed.pathname === "/series/test-show" && !range && season === "1") return { data: firstRange, status: 200 };
      if (parsed.pathname === "/series/test-show" && range === "1" && season === "1") return { data: firstRange, status: 200 };
      if (parsed.pathname === "/series/test-show" && range === "3" && season === "1") return { data: secondRange, status: 200 };
      if (parsed.pathname === "/series/test-show" && season === "2") return { data: secondSeason, status: 200 };
      if (parsed.pathname === "/series/test-show" && season === "3") return { data: legacyDownloadLinksPage, status: 200 };
      throw new Error("Unexpected URL: " + url);
    },
  },
};

(async () => {
  const meta = await getMeta({ link: seriesUrl, providerContext });
  assert.equal(meta.title, "Test Show");
  assert.equal(meta.type, "series");
  assert.equal(meta.linkList.length, 2, "episode-range choices must not be reported as seasons");
  assert.deepEqual(meta.linkList.map((entry) => entry.title), [
    "Season 1 · 3 episodes",
    "Season 2 · 1 episode",
  ]);
  assert.ok(meta.linkList.every((entry) => entry.episodesLink));

  const episodeRequestStart = episodeRequests.length;
  const seasonOne = await getEpisodes({ url: seriesUrl + "?season=1", providerContext });
  assert.equal(seasonOne.length, 3, "all episode ranges should be combined into one season");
  const seasonOneRequests = episodeRequests.slice(episodeRequestStart);
  assert.ok(seasonOneRequests.length > 0, "episode requests should be made");
  assert.ok(seasonOneRequests.every(({ headers }) => headers["User-Agent"] === platformUserAgent), "episode requests must preserve Vega platform User-Agent");
  assert.ok(seasonOneRequests.every(({ headers }) => headers.Referer === base), "episode requests must use the provider site as Referer");
  assert.deepEqual(seasonOne.map((episode) => episode.link), [
    seriesUrl + "/season/1/episode/1",
    seriesUrl + "/season/1/episode/2",
    seriesUrl + "/season/1/episode/3",
  ]);

  const seasonTwo = await getEpisodes({ url: seriesUrl + "?season=2", providerContext });
  assert.equal(seasonTwo.length, 1);
  assert.match(seasonTwo[0].title, /Season Two Premiere/);

  const legacySeason = await getEpisodes({ url: seriesUrl + "?season=3", providerContext });
  assert.equal(legacySeason.length, 1, "legacy h5 + HubCloud episode lists should be supported");
  assert.equal(legacySeason[0].title, "Episode 1: Pilot");
  assert.equal(legacySeason[0].link, base + "/hubcloud/episode-1");

  console.log("MultiMovies regression tests passed: season parsing and complete episode-range pagination.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
