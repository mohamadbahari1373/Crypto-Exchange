const CACHE_TTL_MS = 60_000;
const SUPPLY_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const SUPPLY_CACHE_KEY = 'seven-exchange-radar-supply-v1';
const REQUEST_TIMEOUT_MS = 8_000;
const PROXY_TIMEOUT_MS = 90_000;
const KLINE_BATCH_SIZE = 8;
const KLINE_BATCH_DELAY_MS = 120;
const REFERENCE_EXCHANGES = ['Binance', 'OKX', 'Bybit', 'Coinbase', 'Kraken', 'Upbit'] as const;

type JsonRecord = Record<string, unknown>;

interface MarketData {
  volumeUsd: number;
  changePct: number;
}

interface CandlePair {
  pair: string;
  quoteToUsd: number;
}

interface MarketCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  closeUsd: number;
  quoteVolumeUsd: number;
  takerBuyQuoteVolumeUsd?: number;
}

interface SupplyData {
  circulatingSupply: number;
  marketCap: number;
}

interface ExchangeSnapshot {
  name: string;
  symbols: Set<string>;
  markets: Map<string, MarketData>;
  candlePairs?: Map<string, CandlePair>;
  pairs?: Map<string, string>;
}

export interface WallexRadarCoin {
  symbol: string;
  nameFa?: string;
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
  candleDataAvailable: boolean;
  flowDataAvailable: boolean;
  hasSignal: boolean;
  isWallexFallback?: boolean;
  referenceListingStatus?: 'listed' | 'unlisted' | 'unknown';
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
  lastPriceToman: number;
  priceChange24h: number;
  usdtPriceToman: number;
  usdtTmnMomentumPct: number;
  referenceListingStatus?: 'unlisted' | 'unknown';
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

export function normalizeAssetSymbol(value: unknown): string {
  let symbol = String(value ?? '').trim().toUpperCase();
  symbol = symbol
    .replace(/[-_/](USDT|USDC|USD|KRW|TMN|IRT)$/, '')
    .replace(/(USDT|USDC|USD|KRW|TMN|IRT)$/, '')
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
  const usdtTmnMomentumPct = Number.isFinite(input.usdtTmnMomentumPct)
    ? input.usdtTmnMomentumPct
    : 0;
  const priceChange24h = Number.isFinite(input.priceChange24h) ? input.priceChange24h : 0;
  const lastPriceToman = nonNegative(input.lastPriceToman);

  return {
    symbol: normalizeAssetSymbol(input.symbol),
    circulatingSupply: 0,
    marketCap: 0,
    priceUsd: usdtPriceToman > 0 ? lastPriceToman / usdtPriceToman : 0,
    exchangeVolumeUsd: usdtPriceToman > 0
      ? (buyVolumeToman + sellVolumeToman) / usdtPriceToman
      : 0,
    netFlow1h: 0,
    globalNetFlow1h: 0,
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
    candleDataAvailable: false,
    flowDataAvailable: false,
    hasSignal: false,
    isWallexFallback: true,
    referenceListingStatus: input.referenceListingStatus ?? 'unknown',
    buyVolumeToman,
    sellVolumeToman,
    lastPriceToman,
    priceChange24h,
    usdtPriceToman,
  };
}

async function fetchJson(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
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
    const symbol = normalizeAssetSymbol(rawSymbol);
    if (symbol && !['USDT', 'USDC', 'USD', 'TMN', 'IRT', 'KRW'].includes(symbol)) {
      result.set(symbol, market);
    }
  }
  return result;
}

function parseBinance(payload: unknown): ExchangeSnapshot | null {
  const entries: Array<[string, MarketData]> = [];
  const candlePairs = new Map<string, CandlePair>();
  for (const item of asArray(payload)) {
    if (!isRecord(item)) continue;
    const symbol = String(item.symbol ?? '').toUpperCase();
    const quote = ['USDT', 'USDC', 'USD'].find((suffix) => symbol.endsWith(suffix));
    if (!quote) continue;
    const rawBase = symbol.slice(0, -quote.length);
    const base = normalizeAssetSymbol(rawBase);
    entries.push([base, {
      volumeUsd: asNumber(item.quoteVolume),
      changePct: asNumber(item.priceChangePercent),
    }]);
    candlePairs.set(base, { pair: symbol, quoteToUsd: 1 });
  }
  const markets = uniqueMarketMap(entries);
  return markets.size > 0
    ? { name: 'Binance', symbols: new Set(markets.keys()), markets, candlePairs }
    : null;
}

function createWallexSnapshot(coins: WallexRadarCoin[]): ExchangeSnapshot {
  const entries = coins.flatMap((coin): Array<[string, MarketData]> => {
    const symbol = normalizeAssetSymbol(coin.symbol);
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
  const candlePairs = new Map<string, CandlePair>();
  for (const item of rowsFrom(payload, 'data')) {
    if (!isRecord(item)) continue;
    const instrument = String(item.instId ?? '').toUpperCase();
    const quote = ['-USDT', '-USDC', '-USD'].find((suffix) => instrument.endsWith(suffix));
    if (!quote) continue;
    const last = asNumber(item.last);
    const open = asNumber(item.open24h);
    const base = instrument.slice(0, -quote.length);
    entries.push([base, {
      volumeUsd: asNumber(item.volCcy24h) * last,
      changePct: open > 0 ? ((last / open) - 1) * 100 : 0,
    }]);
    candlePairs.set(normalizeAssetSymbol(base), {
      pair: instrument,
      quoteToUsd: 1,
    });
  }
  const markets = uniqueMarketMap(entries);
  return markets.size > 0
    ? { name: 'OKX', symbols: new Set(markets.keys()), markets, candlePairs }
    : null;
}

function parseKraken(payload: unknown): ExchangeSnapshot | null {
  const result = isRecord(payload) && isRecord(payload.result) ? payload.result : {};
  const pairs = new Map<string, string>();
  const candlePairs = new Map<string, CandlePair>();
  for (const [key, value] of Object.entries(result)) {
    if (!isRecord(value)) continue;
    const [baseRaw, quoteRaw] = String(value.wsname ?? '').split('/');
    const quote = String(quoteRaw ?? '').toUpperCase();
    if (!['USD', 'USDT', 'USDC'].includes(quote) || !baseRaw) continue;
    const base = normalizeAssetSymbol(baseRaw);
    if (base) {
      pairs.set(base, key);
      candlePairs.set(base, { pair: String(value.altname ?? key), quoteToUsd: 1 });
    }
  }
  return pairs.size > 0
    ? { name: 'Kraken', symbols: new Set(pairs.keys()), markets: new Map(), pairs, candlePairs }
    : null;
}

function parseProxyMarkets(payload: unknown): ExchangeSnapshot[] {
  if (!isRecord(payload) || !Array.isArray(payload.exchanges)) {
    throw new Error('Invalid radar proxy response: exchanges are missing');
  }

  const snapshots = payload.exchanges.flatMap((entry): ExchangeSnapshot[] => {
    if (!isRecord(entry) || typeof entry.name !== 'string' || !Array.isArray(entry.markets)) return [];
    if (!(REFERENCE_EXCHANGES as readonly string[]).includes(entry.name)) return [];

    const entries: Array<[string, MarketData]> = [];
    const candlePairs = new Map<string, CandlePair>();
    for (const market of entry.markets) {
      if (!isRecord(market) || typeof market.symbol !== 'string' || typeof market.pair !== 'string') continue;
      const symbol = normalizeAssetSymbol(market.symbol);
      if (!symbol) continue;
      entries.push([symbol, {
        volumeUsd: Math.max(0, asNumber(market.volumeUsd)),
        changePct: asNumber(market.changePct),
      }]);
      candlePairs.set(symbol, {
        pair: market.pair,
        quoteToUsd: Math.max(0, asNumber(market.quoteToUsd ?? 1)),
      });
    }
    const markets = uniqueMarketMap(entries);
    return markets.size > 0
      ? [{
          name: entry.name,
          symbols: new Set(markets.keys()),
          markets,
          candlePairs,
        }]
      : [];
  });

  if (snapshots.length === 0) {
    throw new Error('Radar proxy returned no usable exchange markets');
  }
  return snapshots;
}

function parseSupply(payload: unknown, gecko = false): Map<string, SupplyData> {
  const supplies = new Map<string, SupplyData>();
  for (const item of asArray(payload)) {
    if (!isRecord(item)) continue;
    const symbol = normalizeAssetSymbol(item.symbol);
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
      const symbol = normalizeAssetSymbol(entry[0]);
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

function parseCandleRows(
  payload: unknown,
  exchange: string,
  quoteToUsd: number,
): MarketCandle[] {
  const rows: MarketCandle[] = [];
  const addCandle = (
    time: unknown,
    open: unknown,
    high: unknown,
    low: unknown,
    close: unknown,
    quoteVolume: unknown,
    takerBuyQuoteVolume?: unknown,
    timeMultiplier = 1,
  ) => {
    const parsedClose = asNumber(close);
    if (parsedClose <= 0) return;
    const parsedBuyVolume = takerBuyQuoteVolume === undefined || takerBuyQuoteVolume === null
      ? undefined
      : asNumber(takerBuyQuoteVolume) * quoteToUsd;
    rows.push({
      time: asNumber(time) * timeMultiplier,
      open: asNumber(open),
      high: asNumber(high),
      low: asNumber(low),
      close: parsedClose,
      closeUsd: quoteToUsd > 0 ? parsedClose * quoteToUsd : 0,
      quoteVolumeUsd: asNumber(quoteVolume) * quoteToUsd,
      ...(parsedBuyVolume === undefined ? {} : { takerBuyQuoteVolumeUsd: parsedBuyVolume }),
    });
  };

  const normalizedRows = isRecord(payload) && Array.isArray(payload.rows)
    ? payload.rows
    : null;
  if (normalizedRows) {
    for (const row of normalizedRows) {
      if (!isRecord(row)) continue;
      addCandle(
        row.time,
        row.open,
        row.high,
        row.low,
        row.close,
        row.quoteVolume,
        row.takerBuyQuoteVolume,
      );
    }
  } else if (exchange === 'Binance') {
    for (const row of asArray(payload)) {
      if (!Array.isArray(row) || row.length < 11) continue;
      addCandle(row[0], row[1], row[2], row[3], row[4], row[7], row[10]);
    }
  } else if (exchange === 'OKX') {
    for (const row of rowsFrom(payload, 'data')) {
      if (!Array.isArray(row) || row.length < 8) continue;
      addCandle(row[0], row[1], row[2], row[3], row[4], row[7]);
    }
  } else if (exchange === 'Bybit') {
    for (const row of rowsFrom(payload, 'result', 'list')) {
      if (!Array.isArray(row) || row.length < 7) continue;
      addCandle(row[0], row[1], row[2], row[3], row[4], row[6]);
    }
  } else if (exchange === 'Coinbase') {
    for (const row of asArray(payload)) {
      if (!Array.isArray(row) || row.length < 6) continue;
      addCandle(row[0], row[3], row[2], row[1], row[4], asNumber(row[5]) * asNumber(row[4]), undefined, 1_000);
    }
  } else if (exchange === 'Kraken') {
    const result = isRecord(payload) && isRecord(payload.result) ? payload.result : {};
    for (const [pair, candles] of Object.entries(result)) {
      if (pair === 'last') continue;
      for (const row of asArray(candles)) {
        if (!Array.isArray(row) || row.length < 8) continue;
        addCandle(row[0], row[1], row[2], row[3], row[4], asNumber(row[6]) * asNumber(row[4]), undefined, 1_000);
      }
    }
  } else if (exchange === 'Upbit') {
    for (const row of asArray(payload)) {
      if (!isRecord(row)) continue;
      addCandle(
        row.timestamp,
        row.opening_price,
        row.high_price,
        row.low_price,
        row.trade_price,
        row.candle_acc_trade_price,
      );
    }
  }

  return rows.sort((left, right) => left.time - right.time).slice(-24);
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function getDirectCandleBatch(
  symbols: string[],
): Promise<Map<string, MarketCandle[]>> {
  const results = await Promise.allSettled(symbols.map(async (symbol) => ({
    symbol,
    candles: parseCandleRows(
      await fetchJson(
        `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(`${symbol}USDT`)}&interval=1h&limit=24`,
      ),
      'Binance',
      1,
    ),
  })));
  const candles = new Map<string, MarketCandle[]>();
  for (const result of results) {
    if (result.status === 'fulfilled') candles.set(result.value.symbol, result.value.candles);
    else console.warn('Unable to load Binance radar candles:', result.reason);
  }
  return candles;
}

function createCoinSignal(
  symbol: string,
  candles: MarketCandle[],
  exchangeMarkets: MarketData[],
  supply: SupplyData,
  usdtMomentumPct: number,
): SevenExchangeRadarCoin {
  const hourlyReturns: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const close = candles[index].close;
    const previousClose = candles[index - 1].close;
    if (close > 0 && previousClose > 0) {
      hourlyReturns.push(((close / previousClose) - 1) * 100);
    }
  }
  const returnsMean = average(hourlyReturns);
  const returnsStdDev = standardDeviation(hourlyReturns, returnsMean);
  const recentReturns = hourlyReturns.slice(-2);
  const recentReturnMean = average(recentReturns);
  const zScoreLatest = returnsStdDev > 0 && hourlyReturns.length
    ? (hourlyReturns[hourlyReturns.length - 1] - returnsMean) / returnsStdDev
    : 0;
  const zScore = returnsStdDev > 0 && recentReturns.length
    ? (recentReturnMean - returnsMean) / returnsStdDev
    : 0;
  const candleDataAvailable = candles.length === 24 && hourlyReturns.length === 23;
  const currentPrice = candles.at(-1)?.closeUsd ?? 0;
  const marketCap = supply.circulatingSupply > 0 && currentPrice > 0
    ? supply.circulatingSupply * currentPrice
    : supply.marketCap;
  const exchangeVolumeUsd = exchangeMarkets.reduce((sum, market) => sum + market.volumeUsd, 0);
  const effectiveZScore = candleDataAvailable ? zScore : 0;
  const effectiveLatestZScore = candleDataAvailable ? zScoreLatest : 0;
  const latestCandle = candles.at(-1);
  const takerBuyQuoteVolumeUsd = latestCandle?.takerBuyQuoteVolumeUsd;
  const flowDataAvailable = typeof takerBuyQuoteVolumeUsd === 'number' &&
    Number.isFinite(takerBuyQuoteVolumeUsd);
  const candleFlow = flowDataAvailable && latestCandle
    ? (2 * takerBuyQuoteVolumeUsd) - latestCandle.quoteVolumeUsd
    : 0;
  const ratios: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const close = candles[index].close;
    const previousClose = candles[index - 1].close;
    const takerBuyVolume = candles[index].takerBuyQuoteVolumeUsd;
    const flow = typeof takerBuyVolume === 'number' && Number.isFinite(takerBuyVolume)
      ? Math.abs((2 * takerBuyVolume) - candles[index].quoteVolumeUsd)
      : 0;
    if (close <= 0 || previousClose <= 0 || flow <= 0 || marketCap <= 0) continue;
    const hourlyChangePct = ((close / previousClose) - 1) * 100;
    const normalizedFlowPct = (flow / marketCap) * 100;
    ratios.push(
      (Math.abs(hourlyChangePct) / Math.max(normalizedFlowPct, 0.000001)) *
        (100 / marketCap),
    );
  }

  const candleBeta = median(ratios);
  const globalNetFlow1h = flowDataAvailable ? candleFlow : 0;
  const beta = candleBeta;
  const predictedUsdtPct = flowDataAvailable && candleBeta > 0
    ? candleBeta * globalNetFlow1h
    : candleDataAvailable ? recentReturnMean : 0;
  const predictedTmnPct = (((1 + predictedUsdtPct / 100) * (1 + usdtMomentumPct / 100)) - 1) * 100;
  const alignedExchanges = exchangeMarkets.filter((market) =>
    effectiveZScore !== 0 &&
      market.changePct !== 0 &&
      Math.sign(market.changePct) === Math.sign(effectiveZScore),
  ).length;
  const confidence = Math.min(95, Math.max(55,
    55 + (alignedExchanges / Math.max(exchangeMarkets.length, 1)) * 25 +
      (Math.min(Math.abs(effectiveZScore), 3) / 3) * 15,
  ));
  const timeframe = Math.abs(effectiveZScore) >= 2 && Math.abs(predictedUsdtPct) >= 1
    ? 'فوری (۱۵ تا ۶۰ دقیقه)'
    : Math.abs(effectiveZScore) >= 1.5
      ? 'کوتاه‌مدت (۱ تا ۴ ساعت)'
      : null;
  return {
    symbol,
    circulatingSupply: supply.circulatingSupply,
    marketCap,
    priceUsd: currentPrice,
    exchangeVolumeUsd,
    netFlow1h: globalNetFlow1h,
    globalNetFlow1h,
    zScore: effectiveZScore,
    zScoreLatest: effectiveLatestZScore,
    zScoreLast2h: effectiveZScore,
    beta,
    predictedUsdtPct,
    predictedTmnPct,
    usdtTmnMomentumPct: usdtMomentumPct,
    timeframe,
    confidence,
    alignedExchanges,
    candleDataAvailable,
    flowDataAvailable,
    hasSignal:
      flowDataAvailable &&
      Math.abs(effectiveZScore) >= 1.5 &&
      Math.abs(predictedUsdtPct) >= 1.0 &&
      Math.abs(globalNetFlow1h) >= 25_000 &&
      Math.sign(effectiveZScore) === Math.sign(predictedUsdtPct),
  };
}

async function buildRadar(
  wallexCoins: WallexRadarCoin[],
  usdtTmnRate: number,
  usdtTmnChangePct: number,
): Promise<SevenExchangeRadarResponse> {
  const wallexSnapshot = createWallexSnapshot(wallexCoins);
  const suppliesPromise = fetchSupplyData();
  let externalSnapshots: ExchangeSnapshot[];

  try {
    const proxyPayload = await fetchJson('/radar-proxy.php?action=markets', {}, PROXY_TIMEOUT_MS);
    const proxySnapshots = parseProxyMarkets(proxyPayload);
    if (proxySnapshots.length < 2) {
      throw new Error(`Radar proxy returned data for only ${proxySnapshots.length} exchanges`);
    }
    externalSnapshots = proxySnapshots;
  } catch (error) {
    console.warn('Radar PHP proxy is unavailable or returned insufficient data; using direct APIs.', error);
    const directResults = await Promise.allSettled([
      fetchJson('https://data-api.binance.vision/api/v3/ticker/24hr'),
      fetchJson('https://www.okx.com/api/v5/market/tickers?instType=SPOT'),
      fetchJson('https://api.kraken.com/0/public/AssetPairs'),
    ]);
    const parsers = [parseBinance, parseOkx, parseKraken];
    externalSnapshots = directResults.flatMap((result, index) => {
      if (result.status !== 'fulfilled') {
        console.warn(`Unable to load ${['Binance', 'OKX', 'Kraken'][index]} markets:`, result.reason);
        return [];
      }
      const snapshot = parsers[index](result.value);
      return snapshot ? [snapshot] : [];
    });
  }

  const common = [...wallexSnapshot.symbols].filter((symbol) =>
    externalSnapshots.some((snapshot) => snapshot.symbols.has(symbol)),
  );
  const krakenSnapshot = externalSnapshots.find((snapshot) => snapshot.name === 'Kraken');
  if (krakenSnapshot?.pairs && krakenSnapshot.markets.size === 0) {
    try {
      krakenSnapshot.markets = await getKrakenMarkets(krakenSnapshot.pairs, common);
    } catch (error) {
      console.warn('Unable to load Kraken ticker data:', error);
    }
  }

  const foreignSnapshots = externalSnapshots;
  const candlesBySymbol = new Map<string, MarketCandle[]>();
  for (let start = 0; start < common.length; start += KLINE_BATCH_SIZE) {
    const batch = common.slice(start, start + KLINE_BATCH_SIZE);
    try {
      const candles = await getDirectCandleBatch(batch);
      for (const [symbol, rows] of candles) candlesBySymbol.set(symbol, rows);
    } catch (error) {
      console.warn('Unable to load a radar candle batch:', error);
    }
    if (start + KLINE_BATCH_SIZE < common.length) {
      await pause(KLINE_BATCH_DELAY_MS);
    }
  }

  const supplies = await suppliesPromise;
  const coins = common.map((symbol) => {
    const exchangeMarkets = foreignSnapshots.flatMap((snapshot) => {
      const market = snapshot.markets.get(symbol);
      return market ? [market] : [];
    });
    return createCoinSignal(
      symbol,
      candlesBySymbol.get(symbol) ?? [],
      exchangeMarkets,
      supplies.get(symbol) ?? { circulatingSupply: 0, marketCap: 0 },
      usdtTmnChangePct,
    );
  });
  const exchangeStatus: Record<string, boolean> = {
    Wallex: wallexSnapshot.symbols.size > 0,
    ...Object.fromEntries(REFERENCE_EXCHANGES.map((name) => [
      name,
      externalSnapshots.some((snapshot) => snapshot.name === name),
    ])),
  };

  return {
    timestamp: Date.now(),
    commonCoins: common.length,
    activeSignals: new Set(
      coins
        .filter((coin) => coin.hasSignal)
        .map((coin) => normalizeAssetSymbol(coin.symbol))
        .filter(Boolean),
    ).size,
    availableExchanges: ['Wallex', ...externalSnapshots.map((snapshot) => snapshot.name)],
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
        normalizeAssetSymbol(coin.symbol),
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
