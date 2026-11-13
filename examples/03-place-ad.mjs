// Place an ad.
//
// With an API key whose balance covers the price (from example 02):
//   node examples/03-place-ad.mjs https://your-site.example/
//
// Without a key, paying for exactly this order in the same exchange:
//   WALLET_PRIVATE_KEY=0x... node examples/03-place-ad.mjs https://your-site.example/
//
// Add --quote to see the price and stop.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CryptoAd } from "../client/cryptoad.mjs";
import { payingFetch } from "../client/wallet.mjs";

const landingUrl = process.argv[2];
if (!landingUrl?.startsWith("https://")) {
  throw new Error("usage: node examples/03-place-ad.mjs https://your-site.example/ [--quote]");
}

// Ten paid-to-click views: people open the page and keep it open 10 seconds.
const order = {
  product: "PTC",
  name: "Placed by an agent",
  landing_url: landingUrl,
  ad_title: "Have a look at this page",
  ad_description: "Open the page and look around for ten seconds.",
  product_options: { clicks: 10, duration_seconds: 10 },
};

const apiKey = existsSync("api-key.txt") ? readFileSync("api-key.txt", "utf8").trim() : undefined;
const { quote } = await new CryptoAd().quote(order);
console.log(`Price: $${quote.total_usd}`);
if (process.argv.includes("--quote")) process.exit(0);

const privateKey = process.env.WALLET_PRIVATE_KEY;
if (!apiKey && !privateKey) {
  throw new Error("run example 02 first (api-key.txt), or set WALLET_PRIVATE_KEY");
}
const api = new CryptoAd({
  apiKey,
  // Only used when the balance does not cover the order.
  fetch: privateKey
    ? payingFetch({ privateKey, network: process.env.X402_NETWORK, maxUsd: quote.total_usd })
    : undefined,
});

const placed = await api.createAd(order);
if (placed.api_key) writeFileSync("api-key.txt", `${placed.api_key}\n`, { mode: 0o600 });
console.log(`Ad ${placed.ad.id}: ${placed.ad.status}`);
if (placed.balance) console.log(`Balance: $${placed.balance.available_usd} available`);
console.log("Every ad is reviewed before it goes live. Check it with example 04.");
