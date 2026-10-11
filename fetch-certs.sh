#!/usr/bin/env bash
set -euo pipefail

# Hetzner Cloud API token
# Generate at: console.hetzner.cloud → project → Security → API Tokens
HETZNER_TOKEN="nrEsbMaYWGOCQnfeThRkF4o65GYKGsjFCcKx3F6ktnFiUuIcpWxHdZgmSfcsnhXB"

CERT_DIR="$(dirname "$0")/certs"

ACME="${ACME_SH:-$HOME/.acme.sh/acme.sh}"
if [[ ! -x "$ACME" ]]; then
  echo "Error: acme.sh not found. Install it from https://acme.sh" >&2
  exit 1
fi

echo "Issuing/renewing wildcard certificate for *.tfagames.tech..."

HETZNER_TOKEN="$HETZNER_TOKEN" \
"$ACME" --issue \
  --dns dns_hetznercloud \
  -d "tfagames.tech" \
  -d "*.tfagames.tech" \
  --server letsencrypt

echo "Installing certificates to $CERT_DIR..."

mkdir -p "$CERT_DIR"

"$ACME" --install-cert \
  -d "tfagames.tech" \
  --key-file       "$CERT_DIR/privkey.pem" \
  --fullchain-file "$CERT_DIR/fullchain.pem"

echo "Done. Certs written to $CERT_DIR"
