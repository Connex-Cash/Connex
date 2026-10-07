import { BRAND, CHAIN } from "@/config/brand";

/** Questions answered on the docs page (with FAQPage data) and, shorter, on the home page. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: `What is ${BRAND.name}?`,
    a: `${BRAND.name} is an AI launch agent on ${CHAIN.name}. Twice an hour it reads what people are talking about on X, picks the one topic a skeptical trader would actually buy, gives it a name, has a logo drawn and lists it as a new token on the Pons launchpad. Not one unit of its launches stays with it; the creator share of trading fees is its whole income, split 50/50 between buying back ${BRAND.symbol} and paying for the next launch.`,
  },
  {
    q: `How does ${BRAND.name} work?`,
    a: `Every round starts at :00 or :30 UTC and runs nine steps: read the trend, run the skeptical trader check, write a name and ticker, draw a logo, choose the pair, launch on Pons, announce, collect and split fees, then review the results and rewrite the playbook. A round that finds nothing scoring 8 out of 10 with the trader check launches nothing. The current round page shows every step as it happens.`,
  },
  {
    q: `How do I buy ${BRAND.symbol}?`,
    a: `${BRAND.symbol} has not launched yet. When it does, its contract address is published on this site (the header, the footer and the token page) and the token page lets you swap ETH for it from your own wallet on ${CHAIN.name}. Until then, ignore any ${BRAND.symbol} address you see elsewhere.`,
  },
  {
    q: `Which network is ${BRAND.name} on?`,
    a: `${CHAIN.name} (chain id ${CHAIN.id}), the Ethereum-compatible network where Pons runs. Gas is paid in ETH. Connect any EVM wallet and the site adds the network for you.`,
  },
  {
    q: "Does the dev really hold zero?",
    a: "The launcher contract makes it checkable. It creates each token with no opening buy, so the whole supply starts on the bonding curve, and it has no function that can buy, transfer or approve a launched token; anything sent to it can only be burned. The treasury that receives the fees has no such function either. What a contract cannot stop is the agent's own wallet buying on the open market like anyone else, so the site reads that wallet's balance of every launch and shows it next to the token.",
  },
  {
    q: "Where do the trading fees go?",
    a: `Pons pays each token's creator share of the trading fee to the ${BRAND.name} treasury contract. The treasury splits every fee as it arrives: half is saved to buy back ${BRAND.symbol} and burn it, half covers Pons' launch charge plus a small fixed amount per launch for the agent's gas and tools. The split is fixed in the contract and has no owner who could change it.`,
  },
  {
    q: "Can a launch trade against a stock token?",
    a: `Yes, when it fits the story. Pons accepts ETH, USDG and a list of Robinhood stock tokens as pairs; the site re-reads that list from the Pons contract. The agent pairs with a stock only when the company is plainly the joke, and identifies stock tokens by contract address, never by ticker, because many unrelated tokens on ${CHAIN.name} reuse stock tickers.`,
  },
  {
    q: `Is ${BRAND.name} live?`,
    a: `Not yet. The contracts are written and tested against ${CHAIN.name} mainnet state but not deployed, and the agent is not running, so the rounds and launches you see are samples and say so. Once the launcher is deployed, the launch list comes straight from the chain.`,
  },
];
