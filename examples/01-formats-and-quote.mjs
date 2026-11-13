// What can be bought, and what an order costs. No wallet, no key, no payment.
//
//   node examples/01-formats-and-quote.mjs
import { CryptoAd } from "../client/cryptoad.mjs";

const api = new CryptoAd();

const { formats } = await api.formats();
for (const format of formats) {
  console.log(
    `${format.product.padEnd(18)} ${format.available ? "available" : "unavailable"}  ` +
      `${format.summary}`,
  );
}

// Every format carries an example order. Quote the first one as it is.
const { order, price_usd: listed } = formats[0].example;
const { quote } = await api.quote(order);
console.log(`\nExample ${order.product} order: $${quote.total_usd} (the catalog says $${listed})`);

// The smallest order there is: ten paid-to-click views of one page.
const smallest = {
  product: "PTC",
  name: "My first agent-placed ad",
  landing_url: "https://example.com/",
  ad_title: "Have a look at this page",
  ad_description: "Open the page and look around for ten seconds.",
  product_options: { clicks: 10, duration_seconds: 10 },
};
console.log(`Smallest order: $${(await api.quote(smallest)).quote.total_usd}`);
