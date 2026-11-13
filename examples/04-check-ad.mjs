// The status and the delivery of the account's ads.
//
//   node examples/04-check-ad.mjs            every ad of the key in api-key.txt
//   node examples/04-check-ad.mjs 42         one ad, with its daily series
import { readFileSync } from "node:fs";
import { CryptoAd } from "../client/cryptoad.mjs";

const api = new CryptoAd({ apiKey: readFileSync("api-key.txt", "utf8").trim() });
const id = process.argv[2];

if (id) {
  const { ad } = await api.getAd(id);
  console.log(`Ad ${ad.id} (${ad.product}): ${ad.status}`);
  if (ad.rejection_reason) console.log(`  rejected: ${ad.rejection_reason}`);
  console.log(`  spent $${ad.spent_usd} of $${ad.total_budget_usd}`);
  const stats = await api.adStats(id, { days: 14 });
  console.log(`  totals: ${JSON.stringify(stats.totals)}`);
} else {
  const { ads } = await api.listAds({ limit: 20 });
  for (const ad of ads) {
    console.log(`${String(ad.id).padStart(6)}  ${ad.product.padEnd(18)} ${ad.status.padEnd(10)} $${ad.spent_usd} of $${ad.total_budget_usd}`);
  }
  if (ads.length === 0) console.log("No ads yet.");
}
const { balance } = await api.balance();
console.log(`Balance: $${balance.available_usd} available, $${balance.reserved_usd} reserved`);
