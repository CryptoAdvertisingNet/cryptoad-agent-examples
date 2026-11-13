// Buy prepaid ad credit with one x402 payment and get an API key.
//
//   WALLET_PRIVATE_KEY=0x... node examples/02-buy-credit.mjs 5
//   node examples/02-buy-credit.mjs 5 --price     only show the price
//
// The amount is in USD (5 means 5 USDC for $5.00 of credit). The key is
// written to api-key.txt (mode 600, ignored by git) and never printed.
import { writeFileSync } from "node:fs";
import { CryptoAd, ORIGIN } from "../client/cryptoad.mjs";
import { addressOf, payingFetch } from "../client/wallet.mjs";

const amount = process.argv[2] ?? "5";
const network = process.env.X402_NETWORK ?? "eip155:8453";

if (process.argv.includes("--price")) {
  // A request with nothing in it is answered with the price: 402.
  const response = await fetch(`${ORIGIN}/api/v1/credits/${amount}`, { method: "POST" });
  const required = JSON.parse(
    Buffer.from(response.headers.get("payment-required"), "base64").toString("utf8"),
  );
  console.log(`HTTP ${response.status}`);
  for (const offer of required.accepts) {
    console.log(`  ${Number(offer.amount) / 1e6} USDC on ${offer.network} to ${offer.payTo}`);
  }
  process.exit(0);
}

const privateKey = process.env.WALLET_PRIVATE_KEY;
if (!privateKey) throw new Error("set WALLET_PRIVATE_KEY (a wallet holding USDC)");
console.log(`Paying from ${addressOf(privateKey)} on ${network}`);

const api = new CryptoAd({
  fetch: payingFetch({ privateKey, network, maxUsd: amount }),
});
const bought = await api.buyCredit(amount);

writeFileSync("api-key.txt", `${bought.api_key}\n`, { mode: 0o600 });
console.log(`Credit: $${bought.credit_usd}`);
console.log(`Payment: ${bought.payment.status}, transaction ${bought.payment.tx_hash}`);
console.log(`Balance: $${bought.balance.available_usd} available`);
console.log("The API key is in api-key.txt. It is shown once: keep it.");
