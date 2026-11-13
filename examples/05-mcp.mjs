// The same API as an MCP server (Streamable HTTP, no sign-in).
//
//   node examples/05-mcp.mjs
//
// Plain JSON-RPC over fetch, so you can see every message. An MCP client
// library does the same thing for you.
const MCP = "https://cryptoadvertising.net/mcp";
let id = 0;

async function rpc(method, params = {}) {
  const response = await fetch(MCP, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const { result, error } = await response.json();
  if (error) throw new Error(`${method}: ${error.message}`);
  return result;
}

const server = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "cryptoad-agent-examples", version: "1.0.0" },
});
console.log(`${server.serverInfo.title} (protocol ${server.protocolVersion})`);

const { tools } = await rpc("tools/list");
console.log(`Tools: ${tools.map((tool) => tool.name).join(", ")}`);

// A quote costs nothing.
const quoted = await rpc("tools/call", {
  name: "quote_ad",
  arguments: {
    order: {
      product: "PTC",
      name: "Quoted over MCP",
      landing_url: "https://example.com/",
      ad_title: "Have a look at this page",
      ad_description: "Open the page and look around for ten seconds.",
      product_options: { clicks: 10, duration_seconds: 10 },
    },
  },
});
if (quoted.isError) throw new Error(`quote_ad: ${JSON.stringify(quoted.structuredContent.error)}`);
console.log(`quote_ad: $${quoted.structuredContent.quote.total_usd}`);

// A tool that needs payment answers with the x402 PaymentRequired object.
// Sign it and call the tool again with the payment in _meta["x402/payment"].
const asked = await rpc("tools/call", { name: "buy_ad_credit", arguments: { amount_usd: "5" } });
console.log(`buy_ad_credit without payment: isError=${asked.isError}`);
for (const offer of asked.structuredContent.accepts) {
  console.log(`  pay ${Number(offer.amount) / 1e6} USDC on ${offer.network}`);
}
