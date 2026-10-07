// Every setting the keeper reads, with its default. Values come from the environment
// (docker compose loads keeper.conf). Nothing here has a secret default.
const env = (k, d = "") => (process.env[k] ?? d).trim();
const num = (k, d) => {
  const v = Number(env(k, String(d)));
  return Number.isFinite(v) ? v : d;
};
const isAddr = (v) => /^0x[0-9a-fA-F]{40}$/.test(v);

export function loadConfig() {
  const c = {
    enabled: env("KEEPER_ENABLED") === "1",
    dryRun: env("KEEPER_DRY_RUN", "1") !== "0",
    rpcUrl: env("KEEPER_RPC_URL", "https://rpc.mainnet.chain.robinhood.com"),
    chainId: num("KEEPER_CHAIN_ID", 4663),
    keyFile: env("KEEPER_KEY_FILE", "/run/keeper/keeper.key"),
    launcher: env("LAUNCHER"),
    treasury: env("TREASURY"),
    // Paid services. Without them the matching step reports "not configured" and the round launches nothing.
    xBearer: env("X_BEARER_TOKEN"),
    openrouterKey: env("OPENROUTER_API_KEY"),
    openrouterBase: env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    textModel: env("TEXT_MODEL", "openai/gpt-4.1-mini"),
    judgeModel: env("JUDGE_MODEL", "openai/gpt-4.1-mini"),
    imageModel: env("IMAGE_MODEL", "google/gemini-2.5-flash-image"),
    pinataJwt: env("PINATA_JWT"),
    siteUrl: env("SITE_URL", "https://connex.cash"),
    // Ceilings (see SECURITY in the README).
    maxInPerM: num("MODEL_MAX_IN_PER_M", 1),
    maxOutPerM: num("MODEL_MAX_OUT_PER_M", 4),
    paidCallsPerHour: num("KEEPER_PAID_CALLS_PER_HOUR", 60),
    roundUsdCap: num("ROUND_USD_CAP", 0.5),
    stepCooldownSec: num("STEP_COOLDOWN_SEC", 300),
    maxResponseBytes: num("MAX_RESPONSE_BYTES", 2_000_000),
    // Chain behaviour.
    collectEverySec: num("COLLECT_EVERY_SEC", 300),
    buybackSlippageBps: num("BUYBACK_SLIPPAGE_BPS", 150),
    minGasWei: BigInt(env("MIN_GAS_WEI", "2000000000000000")),
    postingEnabled: env("POSTING_ENABLED") === "1",
    xUserToken: env("X_USER_TOKEN"),
    // Site log.
    redisUrl: env("UPSTASH_REDIS_REST_URL"),
    redisToken: env("UPSTASH_REDIS_REST_TOKEN"),
    prefix: env("CHAT_KEY_PREFIX", "connex:"),
  };
  c.chainReady = isAddr(c.launcher) && isAddr(c.treasury);
  return c;
}

/** Which parts can run, in words, for the startup log. Never prints a secret. */
export function describe(c) {
  return {
    enabled: c.enabled,
    dryRun: c.dryRun,
    chain: c.chainReady ? "launcher + treasury set" : "not configured (LAUNCHER / TREASURY)",
    x: c.xBearer ? "configured" : "not configured (X_BEARER_TOKEN)",
    llm: c.openrouterKey ? `configured (${c.textModel})` : "not configured (OPENROUTER_API_KEY)",
    images: c.openrouterKey ? c.imageModel : "fallback mark only",
    logoHosting: c.pinataJwt ? "IPFS via Pinata" : "not configured (PINATA_JWT): launches carry no logo",
    siteLog: c.redisUrl && c.redisToken ? "Redis" : "not configured: the site keeps showing samples",
    posting: c.postingEnabled ? "on" : "off",
  };
}
