// The paid services the agent thinks with. Each call goes through the budget first.
import { BudgetError } from "./budget.mjs";
import { fetchCapped } from "./http.mjs";

const X_SEARCH_USD = 0.01; // estimate per recent-search call; the X API bills by plan
const IMAGE_USD = 0.04;

export class NotConfigured extends Error {}

export function makeServices(cfg, budget, gate, fetcher = fetchCapped) {
  const cap = { maxBytes: cfg.maxResponseBytes };

  /** Recent posts (last two hours) for a query, ranked by engagement speed. */
  async function searchX(step, query) {
    if (!cfg.xBearer) throw new NotConfigured("X_BEARER_TOKEN");
    budget.charge(step, "X recent search", X_SEARCH_USD);
    const since = new Date(Date.now() - 2 * 3600_000).toISOString();
    const url = `https://api.x.com/2/tweets/search/recent?max_results=50&start_time=${encodeURIComponent(since)}&tweet.fields=public_metrics,created_at,author_id&query=${encodeURIComponent(`${query} -is:retweet -is:reply lang:en`)}`;
    const r = await fetcher(url, { headers: { authorization: `Bearer ${cfg.xBearer}` } }, cap);
    if (!r.ok) {
      budget.fail(step);
      throw new Error(`X search ${r.status}`);
    }
    const rows = r.json().data ?? [];
    return rows
      .map((t) => {
        const m = t.public_metrics ?? {};
        const ageH = Math.max(0.1, (Date.now() - Date.parse(t.created_at)) / 3600_000);
        const weighted = (m.like_count ?? 0) + 2 * (m.retweet_count ?? 0) + 3 * (m.quote_count ?? 0) + (m.reply_count ?? 0);
        return { id: t.id, text: String(t.text ?? "").slice(0, 400), url: `https://x.com/i/web/status/${t.id}`, speed: weighted / ageH, ageH };
      })
      .sort((a, b) => b.speed - a.speed);
  }

  /** One JSON answer from a text model under the price ceiling. Retries once, each try charged. */
  async function askJson(step, model, system, user, maxTokens = 900) {
    if (!cfg.openrouterKey) throw new NotConfigured("OPENROUTER_API_KEY");
    const price = await gate.assertAffordable(model);
    const estimate = (4000 * price.inPerM + maxTokens * price.outPerM) / 1e6;
    let last;
    for (let attempt = 0; attempt < 2; attempt++) {
      budget.charge(step, `Language model (${model})`, estimate);
      try {
        const r = await fetcher(
          `${cfg.openrouterBase}/chat/completions`,
          {
            method: "POST",
            headers: { authorization: `Bearer ${cfg.openrouterKey}`, "content-type": "application/json" },
            body: JSON.stringify({ model, max_tokens: maxTokens, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }], usage: { include: true } }),
          },
          cap,
        );
        if (!r.ok) throw new Error(`model ${r.status}`);
        const body = r.json();
        budget.settle(`Language model (${model})`, estimate, Number(body.usage?.cost));
        const text = body.choices?.[0]?.message?.content ?? "";
        const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        budget.ok(step);
        return json;
      } catch (e) {
        if (e instanceof BudgetError) throw e;
        last = e;
      }
    }
    budget.fail(step);
    throw last;
  }

  /** A PNG logo from the image model, or null. */
  async function drawLogo(step, prompt) {
    if (!cfg.openrouterKey) return null;
    await gate.assertAffordable(cfg.imageModel, { image: true });
    budget.charge(step, `Image model (${cfg.imageModel})`, IMAGE_USD);
    const r = await fetcher(
      `${cfg.openrouterBase}/chat/completions`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${cfg.openrouterKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: cfg.imageModel, modalities: ["image", "text"], messages: [{ role: "user", content: `Square token logo. ${prompt}. Flat shapes, two or three colours, one subject, no text, no real faces, no brand logos.` }] }),
      },
      { maxBytes: 8_000_000 },
    );
    if (!r.ok) {
      budget.fail(step);
      return null;
    }
    const url = r.json().choices?.[0]?.message?.images?.[0]?.image_url?.url ?? "";
    const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(url);
    return m ? Buffer.from(m[2], "base64") : null;
  }

  /** Pins a file on IPFS and returns ipfs://cid, or null when hosting is not configured. */
  async function pin(name, bytes, type) {
    if (!cfg.pinataJwt || !bytes) return null;
    const form = new FormData();
    form.append("file", new Blob([bytes], { type }), name);
    const r = await fetcher("https://api.pinata.cloud/pinning/pinFileToIPFS", { method: "POST", headers: { authorization: `Bearer ${cfg.pinataJwt}` }, body: form }, cap);
    if (!r.ok) return null;
    const cid = r.json().IpfsHash;
    return typeof cid === "string" ? `ipfs://${cid}` : null;
  }

  return { searchX, askJson, drawLogo, pin };
}
