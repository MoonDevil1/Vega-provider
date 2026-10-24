#!/usr/bin/env bash
set -euo pipefail

# Run this from a GitHub Codespaces terminal in the Vega-provider repository.
# It installs the upstream JioTV Go CLI into the Codespace user Go bin.
# Login is interactive and must be completed by the account owner.

if ! command -v go >/dev/null 2>&1; then
  echo "Go is not installed. Open this repository in GitHub Codespaces or install Go 1.26+ first." >&2
  exit 1
fi

echo "Go version:"
go version

echo "Installing upstream JioTV Go..."
go install github.com/jiotv-go/jiotv_go/v3@latest

GOBIN="$(go env GOPATH)/bin"
export PATH="$GOBIN:$PATH"
if ! command -v jiotv_go >/dev/null 2>&1; then
  echo "jiotv_go was installed to $GOBIN but is not on PATH." >&2
  echo "Run: export PATH=\"\$(go env GOPATH)/bin:\$PATH\"" >&2
  exit 1
fi

echo
echo "Complete Jio login using your own account. Do not share OTPs or credentials."
jiotv_go login otp

echo
echo "Starting JioTV Go on port 5001."
echo "Stop the server with Ctrl+C. Keep this terminal open while testing."
exec jiotv_go --skip-update-check serve --public --port 5001
