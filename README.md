# CryptoAd Network: crypto advertising for AI agents

Examples and a small client for buying advertising from
[CryptoAd Network](https://cryptoadvertising.net/agents) with an AI agent.

CryptoAd Network sells ads that are shown to real crypto users: users of
FaucetPay and visitors of the publisher sites in its network. An agent buys
them over a plain HTTP API or an MCP server and pays in USDC through the
[x402](https://www.x402.org) protocol. There is no account to open, no email
address and no API key to apply for. The smallest order costs $0.05.

| | |
| --- | --- |
| HTTP API | `https://cryptoadvertising.net/api/v1` |
| MCP server | `https://cryptoadvertising.net/mcp` (Streamable HTTP, no sign-in) |
| For a language model | [`/llms.txt`](https://cryptoadvertising.net/llms.txt) |
| OpenAPI 3.1 | [`/openapi.json`](https://cryptoadvertising.net/openapi.json) |
| Formats and prices | [`/api/v1/formats`](https://cryptoadvertising.net/api/v1/formats) |
| Payment | USDC on Base, Polygon or Arbitrum, x402 version 2, scheme `exact` |
| MCP registry name | `net.cryptoadvertising/ads` |

## What an agent can buy

| Format | What is delivered | Price |
| --- | --- | --- |
| PTC (paid-to-click) | A person opens your page and keeps it open for 10 to 120 seconds | From $0.005 per click; smallest order 10 clicks, $0.05 |
| Banner | An image banner (PNG, JPEG or GIF) or a text banner on publisher sites | Bid per click or per thousand impressions; $5 minimum order |
| Native | A text card in native placements on publisher sites | Bid per click or per thousand impressions; $5 minimum order |
| Paid Visits | A rewarded visit of 5 to 120 seconds to your landing page | From $0.01 per completed visit; $5 minimum order |
| Sponsored Listing | A featured row in FaucetPay's faucet list | $200 per week for row 1, $150 per week for rows 2 to 4 |

Prices and limits change in one place only: `GET /api/v1/formats`. Read it
instead of trusting this table.

## Use it as an MCP server

Add the server to any MCP client that supports remote servers:

```json
{ "mcpServers": { "cryptoad-network": { "url": "https://cryptoadvertising.net/mcp" } } }
```

Tools: `list_ad_formats`, `quote_ad`, `create_ad`, `buy_ad_credit`,
`get_ad`, `list_ads`, `get_ad_stats`, `pause_ad`, `resume_ad`, `archive_ad`,
`get_balance`, `upload_image`, `create_account`, `get_service_info`.

A tool that needs payment answers with the x402 `PaymentRequired` object
(`isError: true`, in `structuredContent`). Sign it and call the same tool again
with the payment in `_meta["x402/payment"]`, as the
[x402 transport for MCP](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/mcp.md)
defines it. The first paid call returns an API key; pass it as the `api_key`
argument from then on.

### In ElizaOS

ElizaOS connects to remote MCP servers with its own MCP plugin. Add the server
to the character's settings:

```json
{
  "plugins": ["@elizaos/plugin-mcp"],
  "settings": {
    "mcp": {
      "servers": {
        "cryptoad-network": {
          "type": "streamable-http",
          "url": "https://cryptoadvertising.net/mcp"
        }
      }
    }
  }
}
```

The agent can then list formats, quote orders and follow ads. That plugin does
not sign x402 payments, so give the agent an account that already holds
credit: buy credit once (example 02 below), and have the agent pass the API
key as the `api_key` argument of `create_ad`. Orders are then paid from the
balance.

### In Coinbase AgentKit

[cryptoad-agentkit](https://github.com/CryptoAdvertisingNet/cryptoad-agentkit)
is an action provider that pays from the agent's own wallet.

## Use it over HTTP

```
npm install
```

| Example | What it does | Needs |
| --- | --- | --- |
| `node examples/01-formats-and-quote.mjs` | Lists the formats and quotes two orders | nothing |
| `node examples/02-buy-credit.mjs 5 --price` | Shows the price of $5 of ad credit (the 402 answer) | nothing |
| `node examples/02-buy-credit.mjs 5` | Buys $5 of ad credit and stores the API key | a wallet with USDC |
| `node examples/03-place-ad.mjs https://your-site.example/` | Places the smallest ad ($0.05) | the API key, or a wallet |
| `node examples/04-check-ad.mjs` | Lists your ads and the balance | the API key |
| `node examples/05-mcp.mjs` | Talks to the MCP server with plain JSON-RPC | nothing |
| `bash examples/curl.sh` | The API with nothing but curl | nothing |

The examples that pay read the wallet's key from the environment:

```
WALLET_PRIVATE_KEY=0x... node examples/02-buy-credit.mjs 5
```

The wallet needs USDC on Base (or set `X402_NETWORK=eip155:137` for Polygon,
`eip155:42161` for Arbitrum). It needs no ETH: the payment is a signed
authorization and the facilitator pays the gas. Use a wallet made for this
purpose that holds only what the agent may spend.

### How a purchase works

1. `GET /api/v1/formats`: every format with its fields, limits and prices.
2. `POST /api/v1/quote` with the order: the exact price. Creates nothing.
3. `POST /api/v1/ads` with the same order and an `Idempotency-Key` header (a
   random UUID). The answer is `402 Payment Required` with the price on each
   network.
4. Sign the payment and repeat the same request with the `PAYMENT-SIGNATURE`
   header. The answer is `201` with the ad and an API key.
5. `GET /api/v1/ads/{id}`: the status. Every ad is reviewed before it goes
   live, so it starts as `in_review`.

Or buy credit first, which is one payment and one key:
`POST /api/v1/credits/25` answers `402`; paid, it answers `201` with an API key
holding $25.00. Orders placed with the key are paid from the balance.

### The client

`client/cryptoad.mjs` is a dependency-free wrapper around those endpoints.
`client/wallet.mjs` makes a `fetch` that pays x402 requirements with two
guards: it pays only CryptoAd Network's receiving address, and never more than
the cap you give it.

```js
import { CryptoAd } from "./client/cryptoad.mjs";
import { payingFetch } from "./client/wallet.mjs";

const api = new CryptoAd({
  fetch: payingFetch({ privateKey: process.env.WALLET_PRIVATE_KEY, maxUsd: 5 }),
});
const { api_key, balance } = await api.buyCredit(5);
const { ad } = await api.createAd({
  product: "PTC",
  name: "Launch week",
  landing_url: "https://your-site.example/",
  ad_title: "Try the new wallet",
  ad_description: "Open the page and look around.",
  product_options: { clicks: 100, duration_seconds: 10 },
});
```

## Rules worth knowing

- Nothing is created before a payment is confirmed on chain. A quote and a
  402 answer create nothing.
- Repeating a request with the same `Idempotency-Key` and the same body never
  pays twice and never places a second ad.
- The API key is shown once and cannot be recovered by email, because there
  is no email. Store it. Whoever holds it can spend the balance.
- An ad that is rejected in review returns its whole budget to the balance.
  What an ad has not spent returns when it ends.
- Landing pages must be `https`.
- There are no webhooks: poll for the status.

## Links

- Service page: https://cryptoadvertising.net/agents
- Terms: https://cryptoadvertising.net/terms
- Contact: sales@cryptoadvertising.net

## License

MIT. See [LICENSE](LICENSE).
