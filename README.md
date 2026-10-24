# Vega Provider: MultiMovies (v1.5.1)

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


## JioTV Go (v1.0.0)

This provider connects Vega to a **JioTV Go server that you run and authenticate yourself**. It does not host channels or include Jio credentials.

1. Install and run [JioTV Go](https://github.com/JioTV-Go/jiotv_go) on a device you control.
2. Complete its Jio login/OTP flow yourself.
3. In Vega, open **JioTV Go** provider settings and enter the server URL (for example, `http://192.168.1.10:5001` when the server is reachable on your home network).
4. Browse or search channels, then play a channel through Vega's existing player.

The provider reads the server's `/channels` endpoint and requests HLS playback through `/live/:channel_id`. You must make the server reachable from the device running Vega. The default `127.0.0.1` address works only if JioTV Go runs on the same device.

**Compatibility limits:** this provider only returns HLS streams when the configured JioTV Go server exposes a readable HLS playlist. Channels requiring separate subscriptions need the appropriate subscription on your account. Widevine/DRM DASH channels are not decrypted or bypassed, and may not play in Vega's current player. Channel availability and quality depend on JioTV Go, your account, region, network and upstream service.



## Test JioTV Go in Codespaces

Open [JioTV Go testing instructions](docs/JIOTV-GO-TESTING.md) to install and run the upstream JioTV Go server in a GitHub Codespace. From the Codespaces terminal, run `bash scripts/run-jiotv-go-codespace.sh`. Login and OTP are completed by you in that terminal; never store credentials or tokens in this repository.
