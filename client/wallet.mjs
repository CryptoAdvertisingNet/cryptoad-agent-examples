// A fetch that pays x402 requirements from an EVM wallet, with two guards:
// it pays only CryptoAd Network's receiving address, and never more than the
// cap you set.
//
// The wallet needs USDC on Base, Polygon or Arbitrum. It needs no ETH: the
// payment is a signed authorization (EIP-3009) and the facilitator pays gas.

import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

/** Where every payment to CryptoAd Network goes, on each EVM network. */
export const PAY_TO = "0x1313c840F693EB2d8FD4Bb3B8Ed9e55B134B47D8";

/** Circle's USDC on the networks the API accepts. */
export const USDC = {
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
  "eip155:137": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Polygon
  "eip155:42161": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum
};

const decode = (header) => JSON.parse(Buffer.from(header, "base64").toString("utf8"));

/**
 * @param {object} options
 * @param {`0x${string}`} options.privateKey  The wallet's key. Read it from the
 *   environment; never put it in a file that is committed.
 * @param {string} [options.network]  The network to pay on. Default: Base.
 * @param {string|number} options.maxUsd  The most one payment may cost.
 */
export function payingFetch({ privateKey, network = "eip155:8453", maxUsd }) {
  if (!USDC[network]) throw new Error(`unsupported network ${network}`);
  const cap = BigInt(Math.round(Number(maxUsd) * 1_000_000));
  if (!(cap > 0n)) throw new Error("maxUsd must be a positive amount");
  const account = privateKeyToAccount(privateKey);
  const pay = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network, client: new ExactEvmScheme(account) }],
    // The x402 client refuses a payment above $1 unless it is told a limit.
    // This is the same cap as the check below.
    spendControls: { maxAmountPerPayment: Number(maxUsd) },
  });

  return async (url, init) => {
    // Ask first, without paying, and read what is being asked for.
    const unpaid = await fetch(url, init);
    if (unpaid.status !== 402) return unpaid;
    const header = unpaid.headers.get("payment-required");
    if (!header) return unpaid;
    const offer = decode(header).accepts.find((entry) => entry.network === network);
    const acceptable =
      offer &&
      offer.scheme === "exact" &&
      offer.asset.toLowerCase() === USDC[network].toLowerCase() &&
      offer.payTo.toLowerCase() === PAY_TO.toLowerCase() &&
      BigInt(offer.amount) > 0n &&
      BigInt(offer.amount) <= cap;
    if (!acceptable) {
      throw new Error(
        offer
          ? `refusing to pay ${Number(offer.amount) / 1e6} USDC to ${offer.payTo} (cap ${maxUsd})`
          : `the server does not accept payment on ${network}`,
      );
    }
    // The same request again; the x402 client signs and attaches the payment.
    return pay(url, init);
  };
}

/** The address of the wallet behind a key, to show before anything is paid. */
export function addressOf(privateKey) {
  return privateKeyToAccount(privateKey).address;
}
