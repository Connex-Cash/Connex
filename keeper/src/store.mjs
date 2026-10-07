// Writes the agent's log for the site to read (Upstash Redis REST). Every key carries the
// project prefix and an expiry; lists are capped. Without Redis the log is kept in memory only.
import { fetchCapped } from "./http.mjs";

const DAY = 86_400;

export function makeStore(cfg, fetcher = fetchCapped) {
  const mem = new Map();
  const live = Boolean(cfg.redisUrl && cfg.redisToken);
  const k = (key) => `${cfg.prefix}${key}`;
  async function run(cmds) {
    if (!live) return [];
    const r = await fetcher(`${cfg.redisUrl.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.redisToken}`, "content-type": "application/json" },
      body: JSON.stringify(cmds.map((c) => c.map(String))),
    });
    if (!r.ok) throw new Error(`redis ${r.status}`);
    return r.json();
  }
  return {
    live,
    async put(key, value, ttl = 30 * DAY) {
      mem.set(key, value);
      await run([["SET", k(key), JSON.stringify(value), "EX", ttl]]);
    },
    async push(key, value, keep = 200, ttl = 30 * DAY) {
      const list = [value, ...(mem.get(key) ?? [])].slice(0, keep);
      mem.set(key, list);
      await run([["LPUSH", k(key), JSON.stringify(value)], ["LTRIM", k(key), 0, keep - 1], ["EXPIRE", k(key), ttl]]);
    },
    /** Removes every list entry equal to `value` (as stored). */
    async remove(key, value) {
      const raw = JSON.stringify(value);
      mem.set(key, (mem.get(key) ?? []).filter((v) => JSON.stringify(v) !== raw));
      await run([["LREM", k(key), 0, raw]]);
    },
    /** Sets only if the key is free; true when this call set it. Used as a short lock. */
    async setNx(key, value, ttl) {
      if (!live) {
        if (mem.has(key)) return false;
        mem.set(key, value);
        setTimeout(() => mem.delete(key), ttl * 1000).unref?.();
        return true;
      }
      const [res] = await run([["SET", k(key), JSON.stringify(value), "NX", "EX", ttl]]);
      return res?.result === "OK";
    },
    async del(key) {
      mem.delete(key);
      await run([["DEL", k(key)]]);
    },
    async get(key) {
      if (!live) return mem.get(key) ?? null;
      const [res] = await run([["GET", k(key)]]);
      return res?.result ? JSON.parse(res.result) : null;
    },
    async list(key, count = 200) {
      if (!live) return (mem.get(key) ?? []).slice(0, count);
      const [res] = await run([["LRANGE", k(key), 0, count - 1]]);
      return (res?.result ?? []).map((s) => JSON.parse(s));
    },
  };
}
