# Vega Providers: MultiMovies + Aniwatch

Community provider extensions for Vega App.

## Providers

### MultiMovies
- Browse categories and search titles.
- Read title metadata and season/episode links.
- Return available playback sources to Vega's existing player integration.

### Aniwatch
- Browse home, popular, top-airing, subbed, dubbed, movie, TV and genre lists.
- Search anime titles.
- Parse title metadata and episode links from Aniwatch pages.
- Read publicly exposed server/embed URLs and use direct HLS/MP4 sources only when they are explicitly present in the returned player HTML.
- Carry intro/outro skip ranges only when the source page exposes explicit timestamp metadata. The current Aniwatch episode HTML inspected for this provider showed an Auto Skip Intro toggle but did not expose actual intro/outro timestamps, so no timing values are guessed.

## Install in Vega

1. Open Vega's provider/extension settings.
2. Add repository URL: `https://github.com/MoonDevil1/Vega-provider`.
3. Refresh the provider list after the build workflow finishes.
4. Select **Aniwatch** or **MultiMovies**.

## Development

Provider source is in `providers/aniwatch/` and `providers/multi/`. Build output is generated in `dist/` by `npm run build`. GitHub Actions builds and commits the generated bundles after pushes to `main`.

For local development:

```sh
npm ci
npm run build
npm test
```

## Notes

- Both source websites may change their HTML, domains, player markup and server configuration. Catalog, episode and playback behavior can stop working when upstream markup changes.
- The provider does not replace Vega's player.
- A source being returned does not guarantee that it will play on every device or network. Some Aniwatch servers expose only an embed player, which Vega's native player may not support.
- This implementation does not bypass DRM, authentication, or obfuscated third-party player code.
