// Creates keys/keeper.key (mode 400) and prints only the address. Run once on the server:
//   docker compose run --rm -v "$PWD/keys:/out" keeper node make-key.mjs
// The address is the OPERATOR the owner puts into the treasury and launcher at deploy time.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const dir = process.env.KEY_DIR || "/out";
const path = `${dir}/keeper.key`;
mkdirSync(dir, { recursive: true });
if (!existsSync(path)) writeFileSync(path, generatePrivateKey() + "\n", { mode: 0o400 });
console.log(privateKeyToAccount(readFileSync(path, "utf8").trim()).address);
