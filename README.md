# Vega MultiMovies Provider

A provider extension for Vega App, based on the public Vega provider template and the MultiMovies reference implementation.

## Features
- Browse the MultiMovies catalog and categories.
- Search for titles.
- Read title metadata and discover season links.
- Fetch episode lists through the provider's `getEpisodes` export.
- Return available playback sources to Vega's existing player integration.

## Install in Vega
1. Open Vega's provider/extension settings.
2. Add the repository URL: `https://github.com/MoonDevil1/Vega-provider`.
3. Refresh the provider list after the build workflow finishes.

## Development
The provider source is in `providers/multi/`. Build output is generated in `dist/multi/` by `npm run build`. The GitHub Actions workflow builds and commits the generated output after pushes to `main`.

For local development:
```sh
npm ci
npm run build
npm test
```

## Notes
- The source website can change its HTML, domains, and server configuration. Catalog, episode, and playback behavior can therefore stop working when the upstream site changes.
- The provider does not replace Vega's player.
- A successful source extraction does not guarantee that every source will play on every device or network.
