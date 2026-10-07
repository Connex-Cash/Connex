# CONNEX — Every 30 minutes, AI launches a token from trending topics. Dev holds zero. Earns only from fees.

**AI Launches. Trends Convert. Dev Holds Zero.** CONNEX is an AI launch agent on Robinhood Chain. Website: https://connex.cash · X: https://x.com/connex

## The problem

Memecoin launches are fast, noisy and full of insiders. The dev usually keeps a slice of the supply, the "dev holds 0%" claim is a promise nobody can check, and fee income disappears into a wallet with no rules attached to it.

## The solution

CONNEX moves the parts that need trust into small contracts with no owner:

- A **launcher** creates every token on the Pons launchpad with **no opening buy** and has no function that can buy, transfer or approve a launched token.
- A **treasury** is the Pons creator fee recipient of every launch and splits each fee **50/50**: one half buys back `$CONNEX` and burns it, the other half pays for the next launches. The split is fixed at deploy.
- The site reads the launcher's, the treasury's and the agent wallet's balance of every launch and prints the sum next to the token.

The agent itself (trend research, scoring, naming, logos, posting) is an off-chain keeper, open source in `keeper/`.

## How it works

Rounds start at :00 and :30 UTC and run nine steps: read the trend on X, a skeptical-trader check (8/10 or the round launches nothing), name and ticker, logo, pair (ETH by default, a Robinhood stock token only when the company is the joke), launch on Pons through the launcher, announce, collect and split fees, review and adjust the playbook. Fees are also collected every five minutes.

Buybacks are small and spaced (at most 0.05 ETH, at least an hour apart) and use a price floor taken from the keeper's own earlier quotes, because the Pons curve and pool have no price oracle and a buy at the price of the moment can be sandwiched.

## What you can try

- **Live now:** the site with live chain data (block, gas, ETH price), the pairs Pons accepts read from the Pons contract, the newest launches on Pons read from its factory events, connect wallet (EIP-6963, adds Robinhood Chain), Copy CA.
- **Coming later:** real rounds and launches (once the contracts are deployed and the keeper runs), the `$CONNEX` swap on `/token` (switches on when the contract address is published). Until then every round, launch, cost and claim on the site is a sample and is tagged as one.

## Run it locally

Download ZIP or fork this repository, then:

```bash
npm install
npm run build
npm start            # http://localhost:4950
npm test             # unit tests
npx tsc --noEmit && npx eslint
```

Node 20 or newer. Every environment variable is optional (see `.env.example`); put them in `.env.local` locally or in the Vercel project settings:

| Variable | What it is for |
| --- | --- |
| `ROBINHOOD_RPC_URL`, `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Private RPC (e.g. Alchemy). Empty = public RPC. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project id from cloud.reown.com. Empty = WalletConnect shows "Not configured". |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (or `KV_REDIS_URL`) | The Redis the keeper writes its log to. Empty = the site shows samples. |
| `CHAT_KEY_PREFIX` | Redis key prefix, default `connex:`. |

### Contracts

```bash
cd contracts && ./setup.sh             # fetches forge-std and OpenZeppelin into lib/
forge build && forge test --no-match-path 'test/*.fork.t.sol'
forge test --match-path test/Connex.fork.t.sol --fork-url https://robinhood.drpc.org --evm-version cancun
```

### Verify a deployment

```bash
(cd contracts && forge build)
npm run verify-deployment -- <address> [deploy tx]
```

It checks the creation transaction, the runtime code and every constructor value against this build and follows the treasury's launcher and buyback. To match the source on Blockscout use solc 0.8.26, via-IR, optimizer 200 runs, EVM cancun, no metadata hash.

### Keeper (the agent)

```bash
cd keeper && npm ci && npm test
cp keeper.conf.example keeper.conf    # fill it on the server; never commit it
docker compose run --rm -v "$PWD/keys:/out" keeper node make-key.mjs   # prints the operator address
docker compose up -d
```

Off unless `KEEPER_ENABLED=1`; a dry run (every transaction simulated, nothing sent) unless `KEEPER_DRY_RUN=0`. It needs paid services: `X_BEARER_TOKEN` (X API), `OPENROUTER_API_KEY` (language and image models), `PINATA_JWT` (logo hosting), plus the Redis above. Spending is bounded by `KEEPER_PAID_CALLS_PER_HOUR`, `ROUND_USD_CAP`, a model price ceiling (`MODEL_MAX_IN_PER_M`, `MODEL_MAX_OUT_PER_M`, checked against the live catalogue, fail closed) and per-step cooldowns. Owner tools for the playbook: `node playbook-admin.mjs list`, `approve <id> <code>`, `rollback <version> <version>` (wording changes proposed by the review only apply through these).

## Network in your wallet

Robinhood Chain · chain id 4663 (0x1237) · ETH · RPC https://rpc.mainnet.chain.robinhood.com · explorer https://robinhoodchain.blockscout.com. The site adds it for you on connect.

## Project layout

```
src/app/            pages: /, /round, /launches, /earnings, /spend, /playbook, /docs, /contracts, /token, /terms, /deploy
src/config/         brand.ts (name, CA), contracts.ts (addresses, deploy values), pairs.ts, wallets.ts
src/lib/agent/      data sources (chain, keeper log, samples)
src/lib/onchain/    contract reads, deploy encoding, generated bytecode
contracts/          Foundry: ConnexLauncher, ConnexTreasury, ConnexBuyback, tests
keeper/             the agent: rounds, fee collection, buybacks, spending guards
scripts/            verify-deployment, bytecode generation
```

## Contracts and token

| Contract | Address | Deploy |
| --- | --- | --- |
| ConnexTreasury | not deployed yet | before `$CONNEX` |
| ConnexLauncher | not deployed yet | before `$CONNEX` |
| ConnexBuyback | not deployed yet | after `$CONNEX` exists |

`$CONNEX` contract address: published on https://connex.cash when it launches. Only trust the address shown there.

## Security and status

- The contracts have no owner, no admin key, no proxy and no pause; every parameter is fixed in the constructor. Two one-time wiring calls (`wire`, `setBuyback`) are limited to the treasury's deployer.
- The agent's hot wallet can launch at most once every 10 minutes and can buy back only in capped, spaced batches.
- Pons itself has owner powers over its launches (fee policy for new launches, a timelocked override of a creator fee recipient). They apply to every token on Pons, including these.
- Tests: unit, fuzz and invariant tests for every money path, mainnet-fork tests against Pons, Uniswap and NVDA, and end-to-end runs on a local fork of Robinhood Chain.
- Status: contracts written and tested, not deployed. The agent is not running. Memecoins can go to zero; nothing here is financial advice.

## Contributing

Issues and pull requests are welcome. Run `npm test`, `npx tsc --noEmit`, `npx eslint` and the Foundry tests before opening one.

## License

MIT, see `LICENSE`.
