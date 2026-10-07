// Owner tools for the playbook, run on the keeper server:
//   node playbook-admin.mjs list                       proposals (id + full value) and version history
//   node playbook-admin.mjs approve <id>               shows exactly what would change, and the confirm code
//   node playbook-admin.mjs approve <id> <code>        applies it (code = first 6 chars of the value hash)
//   node playbook-admin.mjs rollback <version>         shows the target; add the version again to confirm:
//   node playbook-admin.mjs rollback <version> <version>
// Proposals are looked up by a stable id (hash of field + value), never by position, so a proposal
// pushed by the running keeper meanwhile cannot take the place of the one you read. Every write
// takes the shared playbook lock and aborts if the version moved since this command started.
// Wording changes reach the agent only through this tool; the automated review can only queue them.
import { createHash } from "node:crypto";
import { loadConfig } from "./src/config.mjs";
import { DEFAULT_PLAYBOOK, PROPOSAL_FIELDS, copyOf, printableDeep, proposalId, withPlaybookLock } from "./src/playbook.mjs";
import { makeStore } from "./src/store.mjs";

/** Every character outside printable ASCII shown as a visible \\uXXXX escape; nothing is dropped. */
export const show = (text) =>
  String(text).replace(/[^\x20-\x7E]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);

export const confirmCode = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 6);

export async function admin(store, argv, out = console.log) {
  const [cmd, arg, confirm] = argv;
  const start = (await store.get("agent:playbook")) ?? copyOf(DEFAULT_PLAYBOOK);
  const commit = (mutate) =>
    withPlaybookLock(store, async () => {
      const now = (await store.get("agent:playbook")) ?? copyOf(DEFAULT_PLAYBOOK);
      if (now.version !== start.version) throw new Error(`playbook moved from v${start.version} to v${now.version} meanwhile; run the command again`);
      await store.push("agent:playbook:history", copyOf(now), 50, 365 * 86_400);
      const next = mutate(copyOf(now));
      await store.put("agent:playbook", next, 365 * 86_400);
      return next;
    });

  if (cmd === "list") {
    for (const p of await store.list("agent:playbook:proposals", 50)) {
      out(`${show(p.id)}  ${show(p.field)}  ${new Date(Number(p.at) || 0).toISOString()}  confirm code ${confirmCode(p.value)}`);
      out(`  value:  ${show(JSON.stringify(p.value))}`);
      out(`  reason: ${show(p.reason)}`);
    }
    const hist = await store.list("agent:playbook:history", 50);
    out(`current v${start.version}; history: ${hist.map((h) => `v${h.version}`).join(", ") || "none"}`);
    return "listed";
  }
  if (cmd === "approve") {
    const p = (await store.list("agent:playbook:proposals", 50)).find((x) => x.id === arg);
    if (!p) throw new Error("no proposal with that id");
    if (!PROPOSAL_FIELDS.includes(p.field) || proposalId(p.field, p.value) !== p.id) throw new Error("proposal is malformed; refusing");
    if (!printableDeep(p.value) || !printableDeep(String(p.reason ?? ""))) throw new Error("proposal contains characters outside printable ASCII; refusing");
    const code = confirmCode(p.value);
    out(`will set ${p.field} to:`);
    for (const l of JSON.stringify(p.value, null, 2).split("\n")) out(`  ${show(l)}`);
    out(`reason: ${show(p.reason)}`);
    if (confirm !== code) {
      out(`to apply, run: node playbook-admin.mjs approve ${p.id} ${code}`);
      return "needs-confirm";
    }
    const next = await commit((b) => {
      b[p.field] = p.value;
      b.version += 1;
      b.updatedAt = Date.now();
      b.log = [{ at: Date.now(), title: `Owner approved a ${p.field} change`, change: JSON.stringify(p.value).slice(0, 300), reason: p.reason, evidence: `proposal ${p.id}` }, ...b.log].slice(0, 100);
      return b;
    });
    await store.remove("agent:playbook:proposals", p);
    out(`applied as v${next.version}.`);
    return "applied";
  }
  if (cmd === "rollback") {
    const old = (await store.list("agent:playbook:history", 50)).find((h) => h.version === Number(arg));
    if (!old) throw new Error("no such version");
    out(`will restore v${old.version}: weights ${show(JSON.stringify(old.weights))}, rules ${show(JSON.stringify(old.rules))}, searches ${show(JSON.stringify(old.searches))}, naming ${show(JSON.stringify(old.naming))}`);
    if (confirm !== arg) {
      out(`to apply, run: node playbook-admin.mjs rollback ${arg} ${arg}`);
      return "needs-confirm";
    }
    const next = await commit((b) => ({ ...old, version: b.version + 1, updatedAt: Date.now(), log: [{ at: Date.now(), title: `Rolled back to v${old.version}`, change: "", reason: "owner rollback", evidence: "" }, ...b.log].slice(0, 100) }));
    out(`restored v${old.version} as v${next.version}.`);
    return "applied";
  }
  out("usage: node playbook-admin.mjs list | approve <id> [code] | rollback <version> [version]");
  return "usage";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await admin(makeStore(loadConfig()), process.argv.slice(2));
}
