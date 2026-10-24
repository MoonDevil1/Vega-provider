# Test JioTV Go with Vega-provider in GitHub Codespaces

This guide runs the upstream JioTV Go server in a Codespace for local testing. It does **not** put Jio credentials in the repository or GitHub Actions.

## Start the server

1. Open this repository: https://github.com/MoonDevil1/Vega-provider
2. Select **Code → Codespaces** and create/open a Codespace on `main`.
3. In the Codespaces terminal, run:

   ```bash
   chmod +x scripts/run-jiotv-go-codespace.sh
   ./scripts/run-jiotv-go-codespace.sh
   ```

4. Complete the OTP login yourself when prompted. Do not paste your OTP or credentials into issues, commits, or chat.
5. The script starts JioTV Go on port 5001. In the Codespaces **Ports** tab, confirm port 5001 is forwarded. Keep the server terminal running.

## Connect Vega

Use the forwarded HTTPS URL for port 5001 as the provider's server URL if Vega can reach the Codespace from the device where it is running. A Codespace's `127.0.0.1` is not your phone or desktop; do not use it as the remote server address.

## Important current limitation

The Vega provider integration is an initial adapter. The upstream JioTV Go API/route format must be confirmed against the version installed, and live channel listing/playback has **not** yet been verified end-to-end. If channel listing fails, capture the non-sensitive server log/error and we can align the adapter to the actual upstream API. Do not share OTPs, session files, or tokens.

GitHub Codespaces is temporary and may stop when idle. It is a test environment, not a permanent public IPTV host. Use only channels and access authorized for your account; DRM-protected streams are not decrypted or bypassed.
