// A small client for the CryptoAd Network agent API.
//
// No dependencies. Payments are made by whatever `fetch` you pass in: wrap
// the global fetch with an x402 client (see `payingFetch` in ./wallet.mjs)
// and every `402 Payment Required` answer is paid and the request repeated.
//
// Reference: https://cryptoadvertising.net/llms.txt
//            https://cryptoadvertising.net/openapi.json

import { randomUUID } from "node:crypto";

export const ORIGIN = "https://cryptoadvertising.net";

/** An answer of the API that is not a success. `code` is the API's error code. */
export class CryptoAdError extends Error {
  constructor(status, body) {
    const error = body?.error ?? {};
    super(`${status} ${error.code ?? "error"}: ${error.message ?? "request failed"}`);
    this.name = "CryptoAdError";
    this.status = status;
    this.code = error.code ?? null;
    this.field = error.field ?? null;
    this.body = body;
  }
}

export class CryptoAd {
  /**
   * @param {object} [options]
   * @param {string} [options.apiKey]  A key of an account (`can_live_...`). The
   *   first paid request made without one returns one: keep it.
   * @param {typeof fetch} [options.fetch]  A fetch that pays x402 requirements.
   *   Without it a request that needs payment throws `payment_required`.
   * @param {string} [options.origin]
   */
  constructor({ apiKey, fetch: fetchImpl, origin } = {}) {
    this.apiKey = apiKey ?? null;
    this.fetch = fetchImpl ?? globalThis.fetch;
    this.base = `${origin ?? ORIGIN}/api/v1`;
  }

  async #call(method, path, { body, idempotencyKey } = {}) {
    const headers = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
    const response = await this.fetch(`${this.base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new CryptoAdError(response.status, json);
    // A key is returned once, by the first paid request made without one.
    if (typeof json.api_key === "string") this.apiKey = json.api_key;
    return json;
  }

  /** Every format with its fields, limits, prices and an example order. Free. */
  formats() {
    return this.#call("GET", "/formats");
  }

  /** The exact price of an order. Creates nothing and costs nothing. */
  quote(order) {
    return this.#call("POST", "/quote", { body: order });
  }

  /**
   * Buys prepaid ad credit: `amountUsd` in USDC, 1 USDC = $1.00 of credit.
   * Without an API key the answer carries the key of a new account that
   * holds the credit. With one, the credit is added to that account.
   *
   * @param {string|number} amountUsd  Whole dollars or two decimals: 5, "25.00".
   * @param {string} [idempotencyKey]  Pass the same value to repeat a call
   *   whose answer was lost. It is a secret: do not log it.
   */
  buyCredit(amountUsd, idempotencyKey = randomUUID()) {
    return this.#call("POST", `/credits/${amountUsd}`, { idempotencyKey });
  }

  /**
   * Places an ad. Paid from the key's balance when it covers the price,
   * otherwise with an x402 payment made by `fetch`.
   *
   * @param {object} order  The same object `quote` takes.
   * @param {string} [idempotencyKey]  Pass the same value to repeat a call.
   */
  createAd(order, idempotencyKey = randomUUID()) {
    return this.#call("POST", "/ads", { body: order, idempotencyKey });
  }

  /** One ad: its status, what it spent and what remains. */
  getAd(id) {
    return this.#call("GET", `/ads/${id}`);
  }

  /** The account's ads, newest first. */
  listAds({ limit } = {}) {
    return this.#call("GET", `/ads${limit ? `?limit=${limit}` : ""}`);
  }

  /** Delivery of one ad: totals and a daily series. */
  adStats(id, { days } = {}) {
    return this.#call("GET", `/ads/${id}/stats${days ? `?days=${days}` : ""}`);
  }

  pauseAd(id) {
    return this.#call("POST", `/ads/${id}/pause`);
  }

  resumeAd(id) {
    return this.#call("POST", `/ads/${id}/resume`);
  }

  /** Ends an ad for good. What it has not spent returns to the balance. */
  archiveAd(id) {
    return this.#call("POST", `/ads/${id}/archive`);
  }

  /** Available, reserved and total, in USD. */
  balance() {
    return this.#call("GET", "/balance");
  }
}
