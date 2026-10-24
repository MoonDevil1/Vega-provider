const assert = require("node:assert/strict");
const catalog = require("../dist/jiotv/catalog.js").catalog;
const { getPosts, getSearchPosts } = require("../dist/jiotv/posts.js");

const channels = {
  code: 200,
  message: "OK",
  result: [
    { channel_id: 101, channel_name: "Hindi News", channelCategoryId: 12, channelLanguageId: 1, logoUrl: "https://example.test/news.png" },
    { channel_id: 102, channel_name: "Tamil Sports", channelCategoryId: 8, channelLanguageId: 8, logoUrl: "https://example.test/sports.png" },
    { channel_id: 103, channel_name: "Kids Hindi", channelCategoryId: 7, channelLanguageId: 1, logoUrl: "https://example.test/kids.png" },
  ],
};
const ctx = {
  axios: { get: async (url) => ({ data: channels, url }) },
  commonHeaders: {},
  kvStore: { get: async (key) => key === "jiotvBaseUrl" ? "http://127.0.0.1:5001" : undefined },
};
(async () => {
  assert.ok(catalog.length >= 20, "catalog categories should be present");
  const all = await getPosts({ filter: "all", page: 1, providerValue: "jiotv", signal: new AbortController().signal, providerContext: ctx });
  assert.equal(all.length, 3, "all channels should parse from JioTV Go { result: [...] }");
  assert.equal(all[0].image, "https://example.test/news.png", "logoUrl should be recognized");
  assert.equal((await getPosts({ filter: "genre/News", page: 1, providerValue: "jiotv", signal: new AbortController().signal, providerContext: ctx })).length, 1, "numeric category ID should map to News");
  assert.equal((await getPosts({ filter: "language/Tamil", page: 1, providerValue: "jiotv", signal: new AbortController().signal, providerContext: ctx })).length, 1, "numeric language ID should map to Tamil");
  assert.equal((await getPosts({ filter: "genre/Kids", page: 1, providerValue: "jiotv", signal: new AbortController().signal, providerContext: ctx })).length, 1, "numeric category ID should map to Kids");
  assert.equal((await getSearchPosts({ searchQuery: "Hindi", page: 1, providerValue: "jiotv", signal: new AbortController().signal, providerContext: ctx })).length, 2, "search should include channel language");
  console.log("PASS: JioTV Go categories, channel response parsing, logos, and search");
})().catch((err) => { console.error(err); process.exitCode = 1; });
