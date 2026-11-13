#!/usr/bin/env bash
# The API with nothing but curl. None of these requests costs anything.
set -euo pipefail
API=https://cryptoadvertising.net/api/v1

echo "--- what the API is, and which networks it takes payment on"
curl -s "$API" | head -c 600; echo

echo "--- the exact price of an order (creates nothing)"
curl -s "$API/quote" -H 'content-type: application/json' -d '{
  "product": "PTC",
  "name": "Quoted with curl",
  "landing_url": "https://example.com/",
  "ad_title": "Have a look at this page",
  "ad_description": "Open the page and look around for ten seconds.",
  "product_options": { "clicks": 1000, "duration_seconds": 10 }
}' | head -c 400; echo

echo "--- the price of \$5 of ad credit: 402 with the x402 payment requirement"
curl -s -o /dev/null -w 'HTTP %{http_code}\n' -X POST "$API/credits/5"
