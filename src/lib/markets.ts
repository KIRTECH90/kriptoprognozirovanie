export type Asset = {
  id: string;
  name: string;
  quotes: string[];
  keywords: string[];
};

export const QUOTES: { id: string; label: string; hint: string }[] = [
  { id: "USDT", label: "USDT", hint: "доллар" },
  { id: "USDC", label: "USDC", hint: "доллар" },
  { id: "FDUSD", label: "FDUSD", hint: "доллар" },
  { id: "EUR", label: "EUR", hint: "евро" },
  { id: "TRY", label: "TRY", hint: "лира" },
  { id: "BTC", label: "BTC", hint: "биткоин" },
];

export const ASSETS: Asset[] = [
  { id: "BTC", name: "Bitcoin", quotes: ["USDT", "USDC", "FDUSD", "EUR", "TRY"], keywords: ["bitcoin", "btc"] },
  { id: "ETH", name: "Ethereum", quotes: ["USDT", "USDC", "FDUSD", "EUR", "TRY", "BTC"], keywords: ["ethereum", "eth"] },
  { id: "SOL", name: "Solana", quotes: ["USDT", "USDC", "FDUSD", "EUR", "BTC"], keywords: ["solana", "$sol"] },
  { id: "BNB", name: "BNB", quotes: ["USDT", "USDC", "FDUSD", "EUR", "BTC"], keywords: ["bnb", "binance coin"] },
  { id: "XRP", name: "XRP", quotes: ["USDT", "USDC", "EUR", "BTC"], keywords: ["xrp", "ripple"] },
  { id: "DOGE", name: "Dogecoin", quotes: ["USDT", "USDC", "EUR", "BTC"], keywords: ["doge", "dogecoin"] },
  { id: "TON", name: "Toncoin", quotes: ["USDT", "USDC"], keywords: ["toncoin", "$ton"] },
  { id: "ADA", name: "Cardano", quotes: ["USDT", "USDC", "EUR", "BTC"], keywords: ["ada", "cardano"] },
  { id: "AVAX", name: "Avalanche", quotes: ["USDT", "USDC", "BTC"], keywords: ["avax", "avalanche"] },
  { id: "LINK", name: "Chainlink", quotes: ["USDT", "USDC", "EUR", "BTC"], keywords: ["link", "chainlink"] },
  { id: "DOT", name: "Polkadot", quotes: ["USDT", "EUR", "BTC"], keywords: ["dot", "polkadot"] },
  { id: "LTC", name: "Litecoin", quotes: ["USDT", "USDC", "EUR", "BTC"], keywords: ["ltc", "litecoin"] },
  { id: "TRX", name: "TRON", quotes: ["USDT", "USDC", "EUR", "BTC"], keywords: ["trx", "tron"] },
  { id: "SUI", name: "Sui", quotes: ["USDT", "USDC", "BTC"], keywords: ["sui network", "$sui"] },
  { id: "ATOM", name: "Cosmos", quotes: ["USDT", "BTC"], keywords: ["atom", "cosmos"] },
  { id: "NEAR", name: "NEAR", quotes: ["USDT", "BTC"], keywords: ["near protocol", "$near"] },
  { id: "APT", name: "Aptos", quotes: ["USDT", "BTC"], keywords: ["apt", "aptos"] },
  { id: "ARB", name: "Arbitrum", quotes: ["USDT", "BTC"], keywords: ["arb", "arbitrum"] },
  { id: "OP", name: "Optimism", quotes: ["USDT", "BTC"], keywords: ["optimism", "$op"] },
  { id: "INJ", name: "Injective", quotes: ["USDT", "BTC"], keywords: ["inj", "injective"] },
  { id: "FIL", name: "Filecoin", quotes: ["USDT", "BTC"], keywords: ["fil", "filecoin"] },
  { id: "UNI", name: "Uniswap", quotes: ["USDT", "BTC"], keywords: ["uniswap", "$uni"] },
  { id: "AAVE", name: "Aave", quotes: ["USDT", "BTC"], keywords: ["aave"] },
  { id: "PEPE", name: "Pepe", quotes: ["USDT", "USDC"], keywords: ["pepe"] },
  { id: "SHIB", name: "Shiba Inu", quotes: ["USDT", "USDC"], keywords: ["shib", "shiba"] },
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-token match so "ton" does not hit telegram and "sol" does not hit sold. */
export function matchesKeywords(text: string, keywords: string[]): boolean {
  const hay = text.toLowerCase();
  return keywords.some((kw) => {
    const k = kw.toLowerCase().trim();
    if (!k) return false;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(k)}($|[^\\p{L}\\p{N}])`, "iu");
    return re.test(hay);
  });
}

export function getAsset(id: string): Asset {
  return ASSETS.find((a) => a.id === id) ?? ASSETS[0]!;
}

export function getQuote(id: string) {
  return QUOTES.find((q) => q.id === id) ?? QUOTES[0]!;
}

export function normalizePair(assetRaw: string, quoteRaw: string): { asset: string; quote: string; symbol: string } {
  const asset = getAsset(assetRaw.toUpperCase()).id;
  const allowed = getAsset(asset).quotes;
  const q = quoteRaw.toUpperCase();
  const quote = allowed.includes(q) ? q : allowed[0]!;
  return { asset, quote, symbol: `${asset}${quote}` };
}

export function quotesFor(assetId: string) {
  const allowed = getAsset(assetId).quotes;
  return QUOTES.filter((q) => allowed.includes(q.id));
}

export function isKnownSymbol(symbol: string): boolean {
  const u = symbol.toUpperCase();
  return ASSETS.some((a) => a.quotes.some((q) => `${a.id}${q}` === u));
}

export function parseSymbol(symbol: string): { asset: string; quote: string } {
  const u = symbol.toUpperCase();
  for (const q of [...QUOTES.map((x) => x.id)].sort((a, b) => b.length - a.length)) {
    if (u.endsWith(q)) {
      const asset = u.slice(0, -q.length);
      if (ASSETS.some((a) => a.id === asset)) return { asset, quote: q };
    }
  }
  return { asset: "BTC", quote: "USDT" };
}

export function pairTier(assetId: string): "core" | "major" | "meme" {
  const a = assetId.toUpperCase();
  if (a === "BTC" || a === "ETH") return "core";
  if (a === "PEPE" || a === "SHIB") return "meme";
  return "major";
}

export function widthCapMult(assetId: string): number {
  const tier = pairTier(assetId);
  if (tier === "core") return 1;
  if (tier === "meme") return 2.2;
  if (assetId.toUpperCase() === "DOGE") return 1.7;
  return 1.35;
}
