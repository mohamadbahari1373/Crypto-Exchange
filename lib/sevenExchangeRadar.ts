const CACHE_TTL_MS = 60_000;
const SUPPLY_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const SUPPLY_CACHE_KEY = 'seven-exchange-radar-supply-v1';
const REQUEST_TIMEOUT_MS = 8_000;
const KLINE_BATCH_SIZE = 5;

type JsonRecord = Record<string, unknown>;

interface MarketData {
  volumeUsd: number;
  changePct: number;
}

interface SupplyData {
  circulatingSupply: number;
  marketCap: number;
}

interface MarketFallbackContext {
  averageChangePct: number;
  changeStdDevPct: number;
  averageVolumeToMarketCap: number;
}

interface ExchangeSnapshot {
  name: string;
  symbols: Set<string>;
  markets: Map<string, MarketData>;
  binanceSymbols?: Map<string, string>;
  pairs?: Map<string, string>;
}

export interface WallexRadarCoin {
  symbol: string;
  priceChange24h: number;
  volume24hUsd: number;
}

export interface SevenExchangeRadarCoin {
  symbol: string;
  circulatingSupply: number;
  marketCap: number;
  priceUsd: number;
  exchangeVolumeUsd: number;
  netFlow1h: number;
  globalNetFlow1h: number;
  zScore: number;
  zScoreLatest: number;
  zScoreLast2h: number;
  beta: number;
  predictedUsdtPct: number;
  predictedTmnPct: number;
  usdtTmnMomentumPct: number;
  timeframe: string | null;
  confidence: number;
  alignedExchanges: number;
  flowEstimateAvailable: boolean;
  hasSignal: boolean;
  isWallexFallback?: boolean;
  buyVolumeToman?: number;
  sellVolumeToman?: number;
  lastPriceToman?: number;
  priceChange24h?: number;
  usdtPriceToman?: number;
}

export interface WallexRadarFallbackInput {
  symbol: string;
  buyVolumeToman: number;
  sellVolumeToman: number;
  netFlowToman: number;
  lastPriceToman: number;
  priceChange24h: number;
  usdtPriceToman: number;
  usdtTmnMomentumPct: number;
}

export interface SevenExchangeRadarResponse {
  timestamp: number;
  commonCoins: number;
  activeSignals: number;
  availableExchanges: string[];
  usdtTmnRate: number;
  usdtTmnVolume: number;
  usdtTmnMomentumPct: number;
  exchangeStatus: Record<string, boolean>;
  coins: SevenExchangeRadarCoin[];
}

let radarCache: { timestamp: number; inputKey: string; data: SevenExchangeRadarResponse } | null = null;
let inFlightRequest: { inputKey: string; promise: Promise<SevenExchangeRadarResponse> } | null = null;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeSevenExchangeSymbol(value: unknown): string {
  let symbol = String(value ?? '').trim().toUpperCase();
  symbol = symbol
    .replace(/[-_/](USDT|TMN|IRT|USD)$/, '')
    .replace(/(USDT|TMN|IRT)$/, '')
    .replace(/^1000(?=[A-Z0-9])/, '');
  if (symbol === 'XBT' || symbol === 'XXBT') return 'BTC';
  if (symbol === 'XDG') return 'DOGE';
  if (symbol === 'XETH') return 'ETH';
  if (symbol === 'TON' || symbol === 'TONCOIN') return 'GRAM';
  return symbol;
}

export function createWallexRadarFallbackCoin(
  input: WallexRadarFallbackInput,
): SevenExchangeRadarCoin {
  const nonNegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
  const usdtPriceToman = nonNegative(input.usdtPriceToman);
  const buyVolumeToman = nonNegative(input.buyVolumeToman);
  const sellVolumeToman = nonNegative(input.sellVolumeToman);
  const netFlowToman = Number.isFinite(input.netFlowToman)
    ? input.netFlowToman
    : buyVolumeToman - sellVolumeToman;
  const netFlowUsd24h = usdtPriceToman > 0 ? netFlowToman / usdtPriceToman : 0;
  const hourlyFlowUsd = netFlowUsd24h / 24;
  const usdtTmnMomentumPct = Number.isFinite(input.usdtTmnMomentumPct)
    ? input.usdtTmnMomentumPct
    : 0;
  const priceChange24h = Number.isFinite(input.priceChange24h) ? input.priceChange24h : 0;
  const lastPriceToman = nonNegative(input.lastPriceToman);

  return {
    symbol: normalizeSevenExchangeSymbol(input.symbol),
    circulatingSupply: 0,
    marketCap: 0,
    priceUsd: usdtPriceToman > 0 ? lastPriceToman / usdtPriceToman : 0,
    exchangeVolumeUsd: usdtPriceToman > 0
      ? (buyVolumeToman + sellVolumeToman) / usdtPriceToman
      : 0,
    netFlow1h: hourlyFlowUsd,
    globalNetFlow1h: hourlyFlowUsd,
    zScore: 0,
    zScoreLatest: 0,
    zScoreLast2h: 0,
    beta: 0,
    predictedUsdtPct: 0,
    predictedTmnPct: usdtTmnMomentumPct,
    usdtTmnMomentumPct,
    timeframe: null,
    confidence: 55,
    alignedExchanges: 0,
    flowEstimateAvailable: buyVolumeToman + sellVolumeToman > 0,
    hasSignal: false,
    isWallexFallback: true,
    buyVolumeToman,
    sellVolumeToman,
    lastPriceToman,
    priceChange24h,
    usdtPriceToman,
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json() as unknown;
  } finally {
    window.clearTimeout(timeout);
  }
}

function rowsFrom(value: unknown, ...keys: string[]): unknown[] {
  let current = value;
  for (const key of keys) {
    if (!isRecord(current)) return [];
    current = current[key];
  }
  return asArray(current);
}

function uniqueMarketMap(entries: Iterable<[string, MarketData]>): Map<string, MarketData> {
  const result = new Map<string, MarketData>();
  for (const [rawSymbol, market] of entries) {
    const symbol = normalizeSevenExchangeSymbol(rawSymbol);
    if (symbol && !['USDT', 'USD', 'TMN', 'IRT'].includes(symbol)) result.set(symbol, market);
  }
  return result;
}

function parseBinance(payload: unknown): ExchangeSnapshot | null {
  const entries: Array<[string, MarketData]> = [];
  const binanceSymbols = new Map<string, string>();
  for (const item of asArray(payload)) {
    if (!isRecord(item)) continue;
    const symbol = String(item.symbol ?? '').toUpperCase();
    if (!symbol.endsWith('USDT')) continue;
    const rawBase = symbol.slice(0, -4);
    const base = normalizeSevenExchangeSymbol(rawBase);
    entries.push([base, {
      volumeUsd: asNumber(item.quoteVolume),
      changePct: asNumber(item.priceChangePercent),
    }]);
    binanceSymbols.set(base, rawBase);
  }
  const markets = uniqueMarketMap(entries);
  return markets.size > 0
    ? { name: 'Binance', symbols: new Set(markets.keys()), markets, binanceSymbols }
    : null;
}

function createWallexSnapshot(coins: WallexRadarCoin[]): ExchangeSnapshot {
  const entries = coins.flatMap((coin): Array<[string, MarketData]> => {
    const symbol = normalizeSevenExchangeSymbol(coin.symbol);
    if (!symbol) return [];
    return [[symbol, {
      volumeUsd: Math.max(0, asNumber(coin.volume24hUsd)),
      changePct: asNumber(coin.priceChange24h),
    }]];
  });
  const markets = uniqueMarketMap(entries);
  return {
    name: 'Wallex',
    symbols: new Set(markets.keys()),
    markets,
  };
}

function parseOkx(payload: unknown): ExchangeSnapshot | null {
  const entries: Array<[string, MarketData]> = [];
  for (const item of rowsFrom(payload, 'data')) {
    if (!isRecord(item)) continue;
    const instrument = String(item.instId ?? '').toUpperCase();
    if (!instrument.endsWith('-USDT')) continue;
    const last = asNumber(item.last);
    const open = asNumber(item.open24h);
    entries.push([instrument.slice(0, -5), {
      volumeUsd: asNumber(item.volCcy24h) * last,
      changePct: open > 0 ? ((last / open) - 1) * 100 : 0,
    }]);
  }
  const markets = uniqueMarketMap(entries);
  return markets.size > 0 ? { name: 'OKX', symbols: new Set(markets.keys()), markets } : null;
}

function parseKraken(payload: unknown): ExchangeSnapshot | null {
  const result = isRecord(payload) && isRecord(payload.result) ? payload.result : {};
  const pairs = new Map<string, string>();
  for (const [key, value] of Object.entries(result)) {
    if (!isRecord(value)) continue;
    const [baseRaw, quoteRaw] = String(value.wsname ?? '').split('/');
    const quote = String(quoteRaw ?? '').toUpperCase();
    if ((quote !== 'USD' && quote !== 'USDT') || !baseRaw) continue;
    const base = normalizeSevenExchangeSymbol(baseRaw);
    if (base) pairs.set(base, key);
  }
  return pairs.size > 0
    ? { name: 'Kraken', symbols: new Set(pairs.keys()), markets: new Map(), pairs }
    : null;
}

function parseSupply(payload: unknown, gecko = false): Map<string, SupplyData> {
  const supplies = new Map<string, SupplyData>();
  for (const item of asArray(payload)) {
    if (!isRecord(item)) continue;
    const symbol = normalizeSevenExchangeSymbol(item.symbol);
    const quotes = isRecord(item.quotes) ? item.quotes : {};
    const usd = isRecord(quotes.USD) ? quotes.USD : {};
    const circulatingSupply = asNumber(item.circulating_supply);
    const marketCap = asNumber(gecko ? item.market_cap : usd.market_cap);
    if (symbol && circulatingSupply > 0) {
      const previous = supplies.get(symbol);
      if (!previous || marketCap > previous.marketCap) {
        supplies.set(symbol, { circulatingSupply, marketCap });
      }
    }
  }
  return supplies;
}

function readSupplyCache(): Map<string, SupplyData> | null {
  if (typeof window === 'undefined') return null;

  let serialized: string | null;
  try {
    serialized = window.localStorage.getItem(SUPPLY_CACHE_KEY);
  } catch (error) {
    console.warn('Unable to read circulating supply cache:', error);
    return null;
  }
  if (!serialized) return null;

  try {
    const cached: unknown = JSON.parse(serialized);
    if (
      !isRecord(cached) ||
      typeof cached.timestamp !== 'number' ||
      !Array.isArray(cached.supplies) ||
      Date.now() - cached.timestamp >= SUPPLY_CACHE_TTL_MS ||
      cached.timestamp > Date.now()
    ) {
      return null;
    }

    const supplies = new Map<string, SupplyData>();
    for (const entry of cached.supplies) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue;
      const symbol = normalizeSevenExchangeSymbol(entry[0]);
      const circulatingSupply = asNumber(entry[1]);
      const marketCap = asNumber(entry[2]);
      if (symbol && circulatingSupply > 0) {
        supplies.set(symbol, { circulatingSupply, marketCap });
      }
    }
    return supplies.size > 0 ? supplies : null;
  } catch (error) {
    console.warn('Unable to parse circulating supply cache:', error);
    return null;
  }
}

function writeSupplyCache(supplies: Map<string, SupplyData>): void {
  if (typeof window === 'undefined' || supplies.size === 0) return;

  const cached = {
    timestamp: Date.now(),
    supplies: [...supplies].map(([symbol, supply]) => [
      symbol,
      supply.circulatingSupply,
      supply.marketCap,
    ]),
  };
  try {
    window.localStorage.setItem(SUPPLY_CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.warn('Unable to cache circulating supply data:', error);
  }
}

async function fetchSupplyData(): Promise<Map<string, SupplyData>> {
  const cached = readSupplyCache();
  if (cached) return cached;

  let coinPaprikaError: unknown = new Error('CoinPaprika returned no valid circulating supply records');
  try {
    const supplies = parseSupply(await fetchJson('https://api.coinpaprika.com/v1/tickers'));
    if (supplies.size > 0) {
      writeSupplyCache(supplies);
      return supplies;
    }
  } catch (error) {
    coinPaprikaError = error;
  }

  try {
    const supplies = parseSupply(
      await fetchJson('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250&page=1'),
      true,
    );
    if (supplies.size > 0) {
      writeSupplyCache(supplies);
      return supplies;
    }
    throw new Error('CoinGecko returned no valid circulating supply records');
  } catch (coinGeckoError) {
    console.warn('Unable to load circulating supply from CoinPaprika or CoinGecko:', {
      coinPaprikaError,
      coinGeckoError,
    });
    return new Map();
  }
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[], mean = average(values)): number {
  if (values.length === 0) return 0;
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function estimateHourlyFlow(
  symbol: string,
  snapshots: ExchangeSnapshot[],
): { value: number; available: boolean } {
  const estimatingSources = new Set(['Binance', 'Bybit', 'OKX', 'Wallex']);
  let value = 0;
  let available = false;
  for (const snapshot of snapshots) {
    if (!estimatingSources.has(snapshot.name)) continue;
    const market = snapshot.markets.get(symbol);
    if (!market || market.volumeUsd <= 0 || market.changePct === 0) continue;
    value += (market.volumeUsd * market.changePct) / 100 / 24;
    available = true;
  }
  return { value, available };
}

async function getKrakenMarkets(
  pairs: Map<string, string>,
  symbols: string[],
): Promise<Map<string, MarketData>> {
  const markets = new Map<string, MarketData>();
  const pairToSymbol = new Map([...pairs].map(([symbol, pair]) => [pair.toLowerCase(), symbol]));
  const pairKeys = symbols.map((symbol) => pairs.get(symbol)).filter((pair): pair is string => Boolean(pair));
  for (let start = 0; start < pairKeys.length; start += 40) {
    const chunk = pairKeys.slice(start, start + 40);
    const payload = await fetchJson(
      `https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(chunk.join(','))}`,
    );
    if (!isRecord(payload) || !isRecord(payload.result)) continue;
    for (const [pair, item] of Object.entries(payload.result)) {
      if (!isRecord(item)) continue;
      const symbol = pairToSymbol.get(pair.toLowerCase());
      const volume = asArray(item.v);
      const price = asArray(item.p);
      const last = asNumber(price[1]);
      const open = asNumber(item.o);
      if (!symbol || last <= 0) continue;
      markets.set(symbol, {
        volumeUsd: asNumber(volume[1]) * last,
        changePct: open > 0 ? ((last / open) - 1) * 100 : 0,
      });
    }
  }
  return markets;
}

async function getKlines(symbol: string, binanceSymbol = symbol): Promise<unknown[]> {
  return asArray(await fetchJson(
    `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(`${binanceSymbol}USDT`)}&interval=1h&limit=24`,
  ));
}

function createCoinSignal(
  symbol: string,
  rows: unknown[],
  exchangeMarkets: MarketData[],
  supply: SupplyData,
  usdtMomentumPct: number,
  totalUniverseVolume: number,
  estimatedFlow: { value: number; available: boolean },
  marketContext: MarketFallbackContext,
): SevenExchangeRadarCoin {
  const candles = rows.filter((row): row is unknown[] => Array.isArray(row) && row.length > 10);
  const flows = candles.map((row) => (2 * asNumber(row[10])) - asNumber(row[7]));
  const candleFlow = flows.at(-1) ?? 0;
  const latestFlow = candleFlow !== 0 ? candleFlow : estimatedFlow.value;
  const mean = flows.length ? flows.reduce((sum, value) => sum + value, 0) / flows.length : 0;
  const variance = flows.length
    ? flows.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / flows.length
    : 0;
  const standardDeviation = Math.sqrt(variance);
  const recentFlows = flows.slice(-2);
  const recentMean = recentFlows.length
    ? recentFlows.reduce((sum, value) => sum + value, 0) / recentFlows.length
    : 0;
  const zScoreLatest = standardDeviation > 0 && flows.length
    ? (flows[flows.length - 1] - mean) / standardDeviation
    : 0;
  const zScoreLast2h = standardDeviation > 0 && recentFlows.length
    ? (recentMean - mean) / standardDeviation
    : 0;
  const hasCandleFlowBaseline = flows.length >= 2 && standardDeviation > 0;
  const currentPrice = asNumber(candles.at(-1)?.[4]);
  const marketCap = supply.circulatingSupply > 0 && currentPrice > 0
    ? supply.circulatingSupply * currentPrice
    : supply.marketCap;
  const exchangeVolumeUsd = exchangeMarkets.reduce((sum, market) => sum + market.volumeUsd, 0);
  const observedMarkets = exchangeMarkets.filter((market) => market.volumeUsd > 0);
  const coinChangePct = observedMarkets.length
    ? observedMarkets.reduce((sum, market) => sum + market.changePct, 0) / observedMarkets.length
    : 0;
  const relativeChangePct = coinChangePct - marketContext.averageChangePct;
  const volumeToMarketCap = marketCap > 0 ? exchangeVolumeUsd / marketCap : 0;
  const volumeActivityFactor = volumeToMarketCap > 0 && marketContext.averageVolumeToMarketCap > 0
    ? Math.max(0.5, Math.min(2, Math.sqrt(volumeToMarketCap / marketContext.averageVolumeToMarketCap)))
    : 1;
  const changeScale = marketContext.changeStdDevPct > 0
    ? marketContext.changeStdDevPct
    : Math.max(Math.abs(marketContext.averageChangePct), 0.25);
  const fallbackZScore = (relativeChangePct / changeScale) * volumeActivityFactor;
  const zScore = hasCandleFlowBaseline ? zScoreLast2h : fallbackZScore;
  const effectiveLatestZScore = hasCandleFlowBaseline ? zScoreLatest : fallbackZScore;
  const ratios: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const close = asNumber(candles[index][4]);
    const previousClose = asNumber(candles[index - 1][4]);
    const flow = Math.abs(flows[index]);
    if (close <= 0 || previousClose <= 0 || flow <= 0 || marketCap <= 0) continue;
    const hourlyChangePct = ((close / previousClose) - 1) * 100;
    const normalizedFlowPct = (flow / marketCap) * 100;
    ratios.push(
      (Math.abs(hourlyChangePct) / Math.max(normalizedFlowPct, 0.000001)) *
        (100 / marketCap),
    );
  }

  const candleBeta = median(ratios);
  const volumeWeightedFlow = candleFlow !== 0 && totalUniverseVolume > 0
    ? candleFlow * (exchangeVolumeUsd / totalUniverseVolume)
    : 0;
  const globalNetFlow1h = volumeWeightedFlow !== 0
    ? volumeWeightedFlow
    : estimatedFlow.available
      ? estimatedFlow.value
      : candleFlow;
  const fallbackPredictedUsdtPct = (relativeChangePct / 24) * volumeActivityFactor;
  const beta = candleBeta > 0
    ? candleBeta
    : globalNetFlow1h !== 0
      ? Math.abs(fallbackPredictedUsdtPct / globalNetFlow1h)
      : 0;
  const predictedUsdtPct = hasCandleFlowBaseline && candleBeta > 0
    ? candleBeta * globalNetFlow1h
    : fallbackPredictedUsdtPct;
  const predictedTmnPct = (((1 + predictedUsdtPct / 100) * (1 + usdtMomentumPct / 100)) - 1) * 100;
  const alignedExchanges = exchangeMarkets.filter((market) =>
    zScore !== 0 && market.changePct !== 0 && Math.sign(market.changePct) === Math.sign(zScore),
  ).length;
  const confidence = Math.min(95, Math.max(55,
    55 + (alignedExchanges / Math.max(exchangeMarkets.length, 1)) * 25 +
      (Math.min(Math.abs(zScore), 3) / 3) * 15,
  ));
  const timeframe = Math.abs(zScore) >= 2
    ? 'فوری (۱۵ تا ۶۰ دقیقه)'
    : Math.abs(zScore) >= 1.15
      ? 'کوتاه‌مدت (۱ تا ۴ ساعت)'
      : null;
  return {
    symbol,
    circulatingSupply: supply.circulatingSupply,
    marketCap,
    priceUsd: currentPrice,
    exchangeVolumeUsd,
    netFlow1h: latestFlow,
    globalNetFlow1h,
    zScore,
    zScoreLatest: effectiveLatestZScore,
    zScoreLast2h: zScore,
    beta,
    predictedUsdtPct,
    predictedTmnPct,
    usdtTmnMomentumPct: usdtMomentumPct,
    timeframe,
    confidence,
    alignedExchanges,
    flowEstimateAvailable: candleFlow !== 0 || estimatedFlow.available,
    hasSignal:
      timeframe !== null &&
      Math.abs(globalNetFlow1h) >= 5_000 &&
      Math.abs(predictedUsdtPct) >= 0.15 &&
      Math.sign(zScore) === Math.sign(predictedUsdtPct),
  };
}

async function buildRadar(
  wallexCoins: WallexRadarCoin[],
  usdtTmnRate: number,
  usdtTmnChangePct: number,
): Promise<SevenExchangeRadarResponse> {
  const results = await Promise.allSettled([
    fetchJson('https://data-api.binance.vision/api/v3/ticker/24hr'),
    fetchJson('https://www.okx.com/api/v5/market/tickers?instType=SPOT'),
    fetchJson('https://api.kraken.com/0/public/AssetPairs'),
    fetchSupplyData(),
  ]);
  const externalParsers: Array<(payload: unknown) => ExchangeSnapshot | null> = [
    parseBinance,
    parseOkx,
    parseKraken,
  ];
  const externalSnapshots = results.slice(0, 3).flatMap((result, index) => {
    if (result.status !== 'fulfilled') return [];
    const snapshot = externalParsers[index](result.value);
    return snapshot ? [snapshot] : [];
  });
  const wallexSnapshot = createWallexSnapshot(wallexCoins);
  const snapshots = [wallexSnapshot, ...externalSnapshots];
  const supplies = results[3].status === 'fulfilled'
    ? results[3].value
    : new Map<string, SupplyData>();
  const common = externalSnapshots.length > 0
    ? [...wallexSnapshot.symbols].filter((symbol) =>
      externalSnapshots.every((snapshot) => snapshot.symbols.has(symbol)),
    )
    : [];
  const krakenSnapshot = externalSnapshots.find((snapshot) => snapshot.name === 'Kraken');
  if (krakenSnapshot?.pairs) {
    try {
      krakenSnapshot.markets = await getKrakenMarkets(krakenSnapshot.pairs, common);
    } catch (error) {
      console.warn('Unable to load Kraken ticker data:', error);
    }
  }

  const foreignSnapshots = snapshots.filter((snapshot) => snapshot.name !== 'Wallex');
  const binanceSnapshot = externalSnapshots.find((snapshot) => snapshot.name === 'Binance');
  const marketChanges = common.flatMap((symbol) => {
    const changes = foreignSnapshots
      .map((snapshot) => snapshot.markets.get(symbol))
      .filter((market): market is MarketData => Boolean(market && market.volumeUsd > 0))
      .map((market) => market.changePct);
    return changes.length > 0 ? [average(changes)] : [];
  });
  const volumeToMarketCapValues = common.map((symbol) => {
    const marketCap = supplies.get(symbol)?.marketCap ?? 0;
    if (marketCap <= 0) return 0;
    const totalVolume = foreignSnapshots.reduce(
      (sum, snapshot) => sum + (snapshot.markets.get(symbol)?.volumeUsd ?? 0),
      0,
    );
    return totalVolume / marketCap;
  }).filter((ratio) => ratio > 0);
  const averageMarketChangePct = average(marketChanges);
  const marketContext: MarketFallbackContext = {
    averageChangePct: averageMarketChangePct,
    changeStdDevPct: standardDeviation(marketChanges, averageMarketChangePct),
    averageVolumeToMarketCap: average(volumeToMarketCapValues),
  };
  const totalUniverseVolume = common.reduce((sum, symbol) =>
    sum + foreignSnapshots.reduce((coinSum, snapshot) =>
      coinSum + (snapshot.markets.get(symbol)?.volumeUsd ?? 0), 0),
  0);
  const klinesBySymbol = new Map<string, unknown[]>();
  const candleSymbols = binanceSnapshot
    ? [...common]
        .filter((symbol) => binanceSnapshot.symbols.has(symbol))
        .sort((left, right) =>
          (binanceSnapshot.markets.get(right)?.volumeUsd ?? 0) -
          (binanceSnapshot.markets.get(left)?.volumeUsd ?? 0),
        )
        .slice(0, 25)
    : [];
  for (let start = 0; start < candleSymbols.length; start += KLINE_BATCH_SIZE) {
    const batch = candleSymbols.slice(start, start + KLINE_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(async (symbol) => ({
      symbol,
      rows: await getKlines(symbol, binanceSnapshot?.binanceSymbols?.get(symbol) ?? symbol),
    })));
    for (const result of results) {
      if (result.status === 'fulfilled') {
        klinesBySymbol.set(result.value.symbol, result.value.rows);
      }
    }
  }
  const coins = common.map((symbol) => {
    const exchangeMarkets = foreignSnapshots.map((snapshot) =>
      snapshot.markets.get(symbol) ?? { volumeUsd: 0, changePct: 0 },
    );
    return createCoinSignal(
      symbol,
      klinesBySymbol.get(symbol) ?? [],
      exchangeMarkets,
      supplies.get(symbol) ?? { circulatingSupply: 0, marketCap: 0 },
      usdtTmnChangePct,
      totalUniverseVolume,
      estimateHourlyFlow(symbol, snapshots),
      marketContext,
    );
  });
  const exchangeStatus: Record<string, boolean> = {
    Wallex: wallexSnapshot.symbols.size > 0,
    Binance: externalSnapshots.some((snapshot) => snapshot.name === 'Binance'),
    OKX: externalSnapshots.some((snapshot) => snapshot.name === 'OKX'),
    Kraken: externalSnapshots.some((snapshot) => snapshot.name === 'Kraken'),
  };

  return {
    timestamp: Date.now(),
    commonCoins: common.length,
    activeSignals: coins.filter((coin) => coin.hasSignal).length,
    availableExchanges: snapshots.map((snapshot) => snapshot.name),
    usdtTmnRate: asNumber(usdtTmnRate),
    usdtTmnVolume: 0,
    usdtTmnMomentumPct: asNumber(usdtTmnChangePct),
    exchangeStatus,
    coins,
  };
}

export async function fetchSevenExchangeRadar(
  wallexCoins: WallexRadarCoin[],
  usdtTmnRate: number,
  usdtTmnChangePct: number,
  forceRefresh = false,
): Promise<SevenExchangeRadarResponse> {
  const inputKey = JSON.stringify([
    asNumber(usdtTmnRate),
    asNumber(usdtTmnChangePct),
    [...wallexCoins]
      .map((coin) => [
        normalizeSevenExchangeSymbol(coin.symbol),
        asNumber(coin.priceChange24h),
        asNumber(coin.volume24hUsd),
      ])
      .sort(([leftSymbol], [rightSymbol]) => String(leftSymbol).localeCompare(String(rightSymbol))),
  ]);
  if (
    !forceRefresh &&
    radarCache?.inputKey === inputKey &&
    Date.now() - radarCache.timestamp < CACHE_TTL_MS
  ) {
    return radarCache.data;
  }
  if (inFlightRequest?.inputKey === inputKey) return inFlightRequest.promise;

  const request = buildRadar(wallexCoins, usdtTmnRate, usdtTmnChangePct);
  inFlightRequest = { inputKey, promise: request };
  try {
    const data = await request;
    radarCache = { timestamp: Date.now(), inputKey, data };
    return data;
  } finally {
    if (inFlightRequest?.promise === request) inFlightRequest = null;
  }
}
