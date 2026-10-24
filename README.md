# Vega Providers: MultiMovies

Community provider extension for Vega App.

## MultiMovies
- Browse categories and search titles.
- Read title metadata and season/episode links.
- Return available playback sources to Vega's existing player integration.
- Extract publicly exposed HLS/MP4 URLs and subtitle tracks when the source player exposes them.

## Install in Vega

1. Open Vega's provider/extension settings.
2. Add repository URL: `https://github.com/MoonDevil1/Vega-provider`.
3. Refresh the provider list after the build workflow finishes.
4. Select **MultiMovies**.

## Development

Provider source is in `providers/multi/`; shared stream extractors are in `providers/extractors/`. Build output is generated in `dist/` by `npm run build`. GitHub Actions builds and commits the generated bundles after pushes to `main`.

```sh
npm ci
npm run build
npm test
```

## Notes
- The source website may change its HTML, domains, player markup and server configuration.
- The provider does not replace Vega's player.
- A subtitle track is shown only when its URL and language/label can be read from the source player configuration or markup.
- This implementation does not bypass DRM or authentication.
