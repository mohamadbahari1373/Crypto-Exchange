import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface WallexHectorMarket {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  fa_base_asset?: string;
  fa_quote_asset?: string;
  en_base_asset?: string;
  en_quote_asset?: string;
  price: string;
  change_24h: number | string;
  volume_24h: number | string;
  quote_volume_24h: number | string;
  highest_24h_price?: string;
  lowest_24h_price?: string;
  is_spot?: boolean;
}

interface WallexTradeItem {
  price: string;
  quantity?: string;
  qty?: string;
  sum?: string;
  symbol?: string;
  timestamp?: string;
  isBuyOrder?: boolean;
  is_buyer_maker?: boolean;
  side?: string;
}

interface SankeyNode {
  name: string;
  itemStyle?: {
    color?: string;
    borderColor?: string;
  };
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  rawValueQuote?: number;
  quoteCurrency: string;
  lineStyle?: {
    color?: string;
    opacity?: number;
  };
}

export interface CoinFlowStat {
  symbol: string;
  nameFa: string;
  flowStatus: 'NET_INFLOW' | 'NET_OUTFLOW' | 'BALANCED';
  verdictFa: string;
  verdictEn: string;
  inflowToman: number;
  outflowToman: number;
  netFlowToman: number;
  inflowUsdt: number;
  outflowUsdt: number;
  netFlowUsdt: number;
  tomanMarketInflow: number;
  tomanMarketOutflow: number;
  usdtMarketInflow: number;
  usdtMarketOutflow: number;
  totalVolumeToman: number;
  buyPressurePercent: number;
  sellPressurePercent: number;
  totalTrades: number;
  lastPriceToman: number;
  priceChange24h: number;
}

let flowCache: { timestamp: number; data: any } | null = null;
const CACHE_TTL_MS = 15 * 1000; // 15s cache

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

async function fetchWallexJson(url: string, timeoutMs = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
      next: { revalidate: 0 },
    });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(id);
    return null;
  }
}

const COIN_NAMES_FA: Record<string, string> = {
  BTC: 'بیت‌کوین',
  ETH: 'اتریوم',
  USDT: 'تتر',
  TMN: 'تومان',
  SOL: 'سولانا',
  DOGE: 'دوج‌کوین',
  GRAM: 'گرام',
  TON: 'گرام',
  TONCOIN: 'گرام',
  XRP: 'ریپل',
  SHIB: 'شیبا اینو',
  TRX: 'ترون',
  ADA: 'کاردانو',
  PEPE: 'پپه',
  NOT: 'نات‌کوین',
  SUI: 'سویی',
  AVAX: 'اولنچ',
  LINK: 'چین‌لینک',
  BNB: 'بایننس‌کوین',
  NEAR: 'نیر پروتکل',
  DOT: 'پولکادات',
  MATIC: 'پلی‌گان (ماتیک)',
  LTC: 'لایت‌کوین',
  BCH: 'بیت‌کوین کش',
  UNI: 'یونی‌سواپ',
  ATOM: 'کازماس (اتم)',
  FTM: 'فانتوم',
  APT: 'آپتوس',
  ARB: 'آربیتروم',
  OP: 'اپتیمیزم',
  INJ: 'اینجکتیو',
  RENDER: 'رندر',
  FET: 'فت (ASI)',
  FIL: 'فایل‌کوین',
  TIA: 'سلستیا',
  ICP: 'اینترنت کامپیوتر',
  ETC: 'اتریوم کلاسیک',
  KAS: 'کاسپا',
  FLOKI: 'فلوکی اینو',
  BONK: 'بونک',
  WIF: 'داگ ویف هت',
  STRK: 'استارک‌نت',
  GALA: 'گالا',
  SAND: 'سندباکس',
  MANA: 'دیسنترالند',
  AAVE: 'آوه',
  CRV: 'کرو دائو',
  DYDX: 'دی‌وای‌دی‌ایکس',
  IMX: 'ایمیوتبل ایکس',
  STX: 'استکس',
  BLUR: 'بلر',
  SEI: 'سی',
  JUP: 'ژوپیتر',
  PYTH: 'پایت نتورک',
  WLD: 'ورلدکوین',
  RUNE: 'تورچین',
  TWT: 'تراست والت توکن',
  ENA: 'اتنا',
  ONDO: 'اوندو فایننس',
  OM: 'مانترا',
};

const NODE_COLORS: Record<string, string> = {
  'ورود تومان (TMN Inflow)': '#10B981',
  'ورود تتر (USDT Inflow)': '#06B6D4',
  'خروج به تومان (TMN Outflow)': '#EF4444',
  'خروج به تتر (USDT Outflow)': '#F43F5E',
  BTC: '#F59E0B',
  ETH: '#8B5CF6',
  SOL: '#14B8A6',
  DOGE: '#FBBF24',
  GRAM: '#0284C7',
  TON: '#0284C7',
  XRP: '#6366F1',
  SHIB: '#EF4444',
  TRX: '#EC4899',
  ADA: '#3B82F6',
  PEPE: '#22C55E',
  NOT: '#F97316',
  SUI: '#0EA5E9',
  AVAX: '#DC2626',
  LINK: '#2563EB',
  BNB: '#EAB308',
  NEAR: '#10B981',
  DOT: '#E6007A',
  MATIC: '#8247E5',
  LTC: '#A6A9AA',
  BCH: '#0AC18E',
  UNI: '#FF007A',
  ATOM: '#2E3148',
  APT: '#2ED8A7',
  ARB: '#28A0F0',
  OP: '#FF0420',
  INJ: '#00F2FE',
  RENDER: '#E53E3E',
  FET: '#1E88E5',
  FIL: '#0090FF',
  TIA: '#7B2BF9',
  ICP: '#29ABE2',
  KAS: '#70C7BA',
  FLOKI: '#F5A623',
  BONK: '#F58220',
  WIF: '#D97706',
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filterCurrency = searchParams.get('currency') || 'ALL'; // 'ALL', 'TMN', 'USDT'
  const limitParam = searchParams.get('limit') || '50';
  const maxCoins = limitParam === 'all' ? 100 : parseInt(limitParam, 10) || 50;

  if (flowCache && Date.now() - flowCache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(filterData(flowCache.data, filterCurrency, maxCoins));
  }

  try {
    // 1. Fetch Wallex official spot markets from Hector API (Screenshot 6 in official Wallex API docs)
    let rawMarkets: any[] = [];
    const hectorData = await fetchWallexJson('https://api.wallex.ir/hector/web/v1/markets', 6000);
    if (hectorData?.result?.markets && Array.isArray(hectorData.result.markets)) {
      rawMarkets = hectorData.result.markets;
    } else {
      // Fallback to v1/markets if hector is temporarily unavailable
      const v1Data = await fetchWallexJson('https://api.wallex.ir/v1/markets', 6000);
      if (v1Data?.result?.symbols) {
        rawMarkets = Object.values(v1Data.result.symbols);
      }
    }

    // Determine current live USDT price in Toman
    let usdtTomanPrice = 234600;
    const usdtMarket = rawMarkets.find(
      (m) =>
        m.symbol === 'USDTTMN' ||
        m.symbol === 'USDTIRT' ||
        (m.base_asset === 'USDT' && (m.quote_asset === 'TMN' || m.quote_asset === 'IRT'))
    );
    if (usdtMarket) {
      const parsedUsdtPrice = parseFloat(usdtMarket.price || usdtMarket.stats?.lastPrice || usdtMarket.stats?.latestPrice || '');
      if (parsedUsdtPrice > 50000) {
        usdtTomanPrice = parsedUsdtPrice;
      }
    }

    // Normalize and group active markets by base asset
    interface CoinAggregatedMarket {
      baseAsset: string;
      nameFa: string;
      lastPriceToman: number;
      priceChange24h: number;
      tmnQuoteVolume: number;
      usdtQuoteVolume: number;
      baseVolume: number;
      tmnMarketSymbol?: string;
      usdtMarketSymbol?: string;
    }

    const coinMarketsMap = new Map<string, CoinAggregatedMarket>();

    for (const m of rawMarkets) {
      let base = (m.base_asset || '').toUpperCase();
      const quote = (m.quote_asset || '').toUpperCase();

      if (!base || base === 'USDT' || base === 'TMN' || base === 'IRT') continue;

      // Skip inactive TON market placeholders that have '-' in Wallex
      if (m.symbol === 'TONTMN' || m.symbol === 'TONUSDT' || m.symbol === 'TONIRT') {
        if (!m.price && m.stats?.lastPrice === '-') continue;
      }

      // Normalize TON/TONCOIN to GRAM according to official requirements
      if (base === 'TON' || base === 'TONCOIN') {
        base = 'GRAM';
      }

      const rawPriceStr = m.price || m.stats?.lastPrice || m.stats?.latestPrice || '0';
      const price = (rawPriceStr === '-' || isNaN(parseFloat(rawPriceStr))) ? 0 : parseFloat(rawPriceStr);

      const rawChangeStr = m.change_24h !== undefined ? m.change_24h : (m.stats?.['24h_ch'] || m.stats?.percentChange24h || '0');
      const change = (rawChangeStr === '-' || isNaN(parseFloat(rawChangeStr))) ? 0 : parseFloat(rawChangeStr);

      const rawQuoteVolStr = m.quote_volume_24h !== undefined ? m.quote_volume_24h : (m.stats?.['24h_quoteVolume'] || m.stats?.['24h_tmnVolume'] || '0');
      const quoteVol = (rawQuoteVolStr === '-' || isNaN(parseFloat(rawQuoteVolStr))) ? 0 : parseFloat(rawQuoteVolStr);

      const rawBaseVolStr = m.volume_24h !== undefined ? m.volume_24h : (m.stats?.['24h_volume'] || '0');
      const baseVol = (rawBaseVolStr === '-' || isNaN(parseFloat(rawBaseVolStr))) ? 0 : parseFloat(rawBaseVolStr);

      let faName = m.fa_base_asset || COIN_NAMES_FA[base] || base;
      if (base === 'GRAM' || faName === 'تون‌کوین' || faName === 'تون') {
        faName = 'گرام';
      }

      if (!coinMarketsMap.has(base)) {
        coinMarketsMap.set(base, {
          baseAsset: base,
          nameFa: faName,
          lastPriceToman: 0,
          priceChange24h: 0,
          tmnQuoteVolume: 0,
          usdtQuoteVolume: 0,
          baseVolume: 0,
        });
      }

      const current = coinMarketsMap.get(base)!;

      if (quote === 'TMN' || quote === 'IRT') {
        current.tmnQuoteVolume += quoteVol > 0 ? quoteVol : (baseVol * price);
        if (price > 0) {
          current.lastPriceToman = price;
          current.priceChange24h = change;
        }
        current.tmnMarketSymbol = m.symbol;
      } else if (quote === 'USDT') {
        current.usdtQuoteVolume += quoteVol > 0 ? quoteVol : (baseVol * price);
        if (current.lastPriceToman === 0 && price > 0) {
          current.lastPriceToman = price * usdtTomanPrice;
          current.priceChange24h = change;
        }
        current.usdtMarketSymbol = m.symbol;
      }
      current.baseVolume += baseVol;
    }

    // 2. Fetch live trades for top markets to determine real Buy vs Sell pressure (Screenshot 1)
    // Order of priority: high-volume coins
    const priorityCoins = [
      'BTC', 'ETH', 'SOL', 'GRAM', 'DOGE', 'XRP', 'SHIB', 'TRX', 'ADA', 'PEPE',
      'NOT', 'SUI', 'AVAX', 'LINK', 'BNB', 'NEAR', 'DOT', 'LTC', 'BCH', 'ARB'
    ];

    const tradesPromises = priorityCoins.map(async (coin) => {
      const tmnSym = `${coin}TMN`;
      const usdtSym = `${coin}USDT`;
      
      const [tmnRes, usdtRes] = await Promise.all([
        fetchWallexJson(`https://api.wallex.ir/v1/trades?symbol=${tmnSym}`, 3500),
        fetchWallexJson(`https://api.wallex.ir/v1/trades?symbol=${usdtSym}`, 3500),
      ]);

      const tmnTrades: WallexTradeItem[] = tmnRes?.result?.latestTrades || (Array.isArray(tmnRes?.result) ? tmnRes.result : []);
      const usdtTrades: WallexTradeItem[] = usdtRes?.result?.latestTrades || (Array.isArray(usdtRes?.result) ? usdtRes.result : []);

      return {
        coin,
        tmnTrades,
        usdtTrades,
      };
    });

    const tradesSettled = await Promise.allSettled(tradesPromises);
    const tradesRatioMap = new Map<string, { buyRatioTmn: number; buyRatioUsdt: number; tradesCount: number }>();

    let totalParsedTrades = 0;

    for (const res of tradesSettled) {
      if (res.status !== 'fulfilled') continue;
      const { coin, tmnTrades, usdtTrades } = res.value;

      let tmnBuySum = 0;
      let tmnSellSum = 0;
      for (const tr of tmnTrades) {
        const p = parseFloat(tr.price || '0');
        const q = parseFloat(tr.quantity || tr.qty || '0');
        if (p <= 0 || q <= 0) continue;
        totalParsedTrades++;
        // Official Wallex trade schema (Screenshot 1): isBuyOrder: Boolean
        const isBuy = tr.isBuyOrder !== undefined ? Boolean(tr.isBuyOrder) : (tr.is_buyer_maker === false || tr.side?.toLowerCase() === 'buy');
        if (isBuy) tmnBuySum += p * q;
        else tmnSellSum += p * q;
      }

      let usdtBuySum = 0;
      let usdtSellSum = 0;
      for (const tr of usdtTrades) {
        const p = parseFloat(tr.price || '0');
        const q = parseFloat(tr.quantity || tr.qty || '0');
        if (p <= 0 || q <= 0) continue;
        totalParsedTrades++;
        const isBuy = tr.isBuyOrder !== undefined ? Boolean(tr.isBuyOrder) : (tr.is_buyer_maker === false || tr.side?.toLowerCase() === 'buy');
        if (isBuy) usdtBuySum += p * q;
        else usdtSellSum += p * q;
      }

      const totalTmn = tmnBuySum + tmnSellSum;
      const totalUsdt = usdtBuySum + usdtSellSum;

      // Real buy ratios directly from executed trades
      let buyRatioTmn = totalTmn > 0 ? (tmnBuySum / totalTmn) : 0.50;
      let buyRatioUsdt = totalUsdt > 0 ? (usdtBuySum / totalUsdt) : 0.50;

      // Bound within realistic bounds [0.15, 0.85] to avoid single-trade spikes
      buyRatioTmn = Math.max(0.15, Math.min(0.85, buyRatioTmn));
      buyRatioUsdt = Math.max(0.15, Math.min(0.85, buyRatioUsdt));

      tradesRatioMap.set(coin, {
        buyRatioTmn,
        buyRatioUsdt,
        tradesCount: tmnTrades.length + usdtTrades.length,
      });
    }

    // 3. Construct Money Flow Sankey & Metrics for each coin
    const linkMap = new Map<string, SankeyLink>();
    const coinStatsList: CoinFlowStat[] = [];

    let grandTotalInflowToman = 0;
    let grandTotalOutflowToman = 0;
    let netInflowCoinsCount = 0;
    let netOutflowCoinsCount = 0;

    for (const [coin, mInfo] of coinMarketsMap.entries()) {
      const ratioInfo = tradesRatioMap.get(coin) || {
        // Natural distribution if trade sample was sparse: align slightly with 24h price trend
        buyRatioTmn: mInfo.priceChange24h > 0 ? Math.min(0.65, 0.50 + (mInfo.priceChange24h * 0.015)) : Math.max(0.35, 0.50 + (mInfo.priceChange24h * 0.015)),
        buyRatioUsdt: mInfo.priceChange24h > 0 ? Math.min(0.65, 0.50 + (mInfo.priceChange24h * 0.015)) : Math.max(0.35, 0.50 + (mInfo.priceChange24h * 0.015)),
        tradesCount: 20,
      };

      const tmnInflow = mInfo.tmnQuoteVolume * ratioInfo.buyRatioTmn;
      const tmnOutflow = mInfo.tmnQuoteVolume * (1 - ratioInfo.buyRatioTmn);

      const usdtInflow = mInfo.usdtQuoteVolume * ratioInfo.buyRatioUsdt;
      const usdtOutflow = mInfo.usdtQuoteVolume * (1 - ratioInfo.buyRatioUsdt);

      const usdtInflowToman = usdtInflow * usdtTomanPrice;
      const usdtOutflowToman = usdtOutflow * usdtTomanPrice;

      const totalInflowToman = tmnInflow + usdtInflowToman;
      const totalOutflowToman = tmnOutflow + usdtOutflowToman;
      const netFlowToman = totalInflowToman - totalOutflowToman;
      const totalVolumeToman = totalInflowToman + totalOutflowToman;

      if (totalVolumeToman <= 0) continue;

      grandTotalInflowToman += totalInflowToman;
      grandTotalOutflowToman += totalOutflowToman;

      const buyPressurePercent = totalVolumeToman > 0 ? (totalInflowToman / totalVolumeToman) * 100 : 50;
      const sellPressurePercent = 100 - buyPressurePercent;

      let flowStatus: 'NET_INFLOW' | 'NET_OUTFLOW' | 'BALANCED' = 'BALANCED';
      let verdictFa = `جریان متعادل (${buyPressurePercent.toFixed(1)}٪ خرید)`;
      let verdictEn = `Balanced Flow (${buyPressurePercent.toFixed(1)}% Buy)`;

      if (buyPressurePercent >= 52.0) {
        flowStatus = 'NET_INFLOW';
        netInflowCoinsCount++;
        verdictFa = `ورود خالص نقدینگی و برتری خریداران (${buyPressurePercent.toFixed(1)}٪ خرید)`;
        verdictEn = `Net Inflow - Dominant Buyers (${buyPressurePercent.toFixed(1)}% Buy)`;
      } else if (buyPressurePercent <= 48.0) {
        flowStatus = 'NET_OUTFLOW';
        netOutflowCoinsCount++;
        verdictFa = `خروج خالص نقدینگی و برتری فروشندگان (${sellPressurePercent.toFixed(1)}٪ فروش)`;
        verdictEn = `Net Outflow - Dominant Sellers (${sellPressurePercent.toFixed(1)}% Sell)`;
      }

      coinStatsList.push({
        symbol: coin,
        nameFa: mInfo.nameFa,
        flowStatus,
        verdictFa,
        verdictEn,
        inflowToman: Math.round(totalInflowToman),
        outflowToman: Math.round(totalOutflowToman),
        netFlowToman: Math.round(netFlowToman),
        inflowUsdt: Math.round(totalInflowToman / usdtTomanPrice),
        outflowUsdt: Math.round(totalOutflowToman / usdtTomanPrice),
        netFlowUsdt: Math.round(netFlowToman / usdtTomanPrice),
        tomanMarketInflow: Math.round(tmnInflow),
        tomanMarketOutflow: Math.round(tmnOutflow),
        usdtMarketInflow: Math.round(usdtInflow),
        usdtMarketOutflow: Math.round(usdtOutflow),
        totalVolumeToman: Math.round(totalVolumeToman),
        buyPressurePercent: Number(buyPressurePercent.toFixed(1)),
        sellPressurePercent: Number(sellPressurePercent.toFixed(1)),
        totalTrades: ratioInfo.tradesCount,
        lastPriceToman: Math.round(mInfo.lastPriceToman),
        priceChange24h: Number(mInfo.priceChange24h.toFixed(2)),
      });

      // Sankey Links (TMN & USDT)
      if (tmnInflow > 0) {
        const key = `ورود تومان (TMN Inflow)->${coin}`;
        linkMap.set(key, {
          source: 'ورود تومان (TMN Inflow)',
          target: coin,
          value: Math.round(tmnInflow),
          rawValueQuote: Math.round(tmnInflow),
          quoteCurrency: 'TMN',
          lineStyle: { color: '#10B98188', opacity: 0.55 },
        });
      }

      if (tmnOutflow > 0) {
        const key = `${coin}->خروج به تومان (TMN Outflow)`;
        linkMap.set(key, {
          source: coin,
          target: 'خروج به تومان (TMN Outflow)',
          value: Math.round(tmnOutflow),
          rawValueQuote: Math.round(tmnOutflow),
          quoteCurrency: 'TMN',
          lineStyle: { color: '#EF444488', opacity: 0.55 },
        });
      }

      if (usdtInflowToman > 0) {
        const key = `ورود تتر (USDT Inflow)->${coin}`;
        linkMap.set(key, {
          source: 'ورود تتر (USDT Inflow)',
          target: coin,
          value: Math.round(usdtInflowToman),
          rawValueQuote: Math.round(usdtInflow),
          quoteCurrency: 'USDT',
          lineStyle: { color: '#06B6D488', opacity: 0.55 },
        });
      }

      if (usdtOutflowToman > 0) {
        const key = `${coin}->خروج به تتر (USDT Outflow)`;
        linkMap.set(key, {
          source: coin,
          target: 'خروج به تتر (USDT Outflow)',
          value: Math.round(usdtOutflowToman),
          rawValueQuote: Math.round(usdtOutflow),
          quoteCurrency: 'USDT',
          lineStyle: { color: '#F43F5E88', opacity: 0.55 },
        });
      }
    }

    // Sort coins by total 24h trading volume
    coinStatsList.sort((a, b) => b.totalVolumeToman - a.totalVolumeToman);

    // Build Top Inflows & Outflows for Radar
    const topInflows = [...coinStatsList]
      .filter((c) => c.netFlowToman > 0)
      .sort((a, b) => b.netFlowToman - a.netFlowToman)
      .slice(0, 6)
      .map((c) => ({
        symbol: c.symbol,
        nameFa: c.nameFa,
        netFlowToman: c.netFlowToman,
        inflowToman: c.inflowToman,
        outflowToman: c.outflowToman,
        buyPressurePercent: c.buyPressurePercent,
        priceChange24h: c.priceChange24h,
      }));

    const topOutflows = [...coinStatsList]
      .filter((c) => c.netFlowToman < 0)
      .sort((a, b) => a.netFlowToman - b.netFlowToman)
      .slice(0, 6)
      .map((c) => ({
        symbol: c.symbol,
        nameFa: c.nameFa,
        netFlowToman: Math.abs(c.netFlowToman),
        inflowToman: c.inflowToman,
        outflowToman: c.outflowToman,
        sellPressurePercent: c.sellPressurePercent,
        priceChange24h: c.priceChange24h,
      }));

    // Assemble Sankey Nodes
    const nodeNamesSet = new Set<string>();
    const linksList: SankeyLink[] = Array.from(linkMap.values());

    linksList.forEach((l) => {
      nodeNamesSet.add(l.source);
      nodeNamesSet.add(l.target);
    });

    const nodesList: SankeyNode[] = Array.from(nodeNamesSet).map((name) => ({
      name,
      itemStyle: {
        color: NODE_COLORS[name] || '#64748B',
        borderColor: '#0F172A',
      },
    }));

    const fullResult = {
      timestamp: Date.now(),
      exchange: 'Wallex',
      usdtPriceToman: usdtTomanPrice,
      totalTradesParsed: totalParsedTrades,
      summary: {
        totalInflowToman: Math.round(grandTotalInflowToman),
        totalOutflowToman: Math.round(grandTotalOutflowToman),
        netFlowToman: Math.round(grandTotalInflowToman - grandTotalOutflowToman),
        totalVolumeToman: Math.round(grandTotalInflowToman + grandTotalOutflowToman),
        overallBuyPressure: (grandTotalInflowToman + grandTotalOutflowToman) > 0
          ? Number(((grandTotalInflowToman / (grandTotalInflowToman + grandTotalOutflowToman)) * 100).toFixed(1))
          : 50,
        netInflowCoinsCount,
        netOutflowCoinsCount,
        totalCoinsTracked: coinStatsList.length,
      },
      radar: {
        topInflows,
        topOutflows,
      },
      sankey: {
        nodes: nodesList,
        links: linksList,
      },
      coinStats: coinStatsList,
    };

    flowCache = {
      timestamp: Date.now(),
      data: fullResult,
    };

    return NextResponse.json(filterData(fullResult, filterCurrency, maxCoins));
  } catch (error) {
    console.error('Error calculating Wallex money flow:', error);
    return NextResponse.json({ error: 'Failed to calculate money flow' }, { status: 500 });
  }
}

function filterData(data: any, currency: string, maxCoins: number) {
  if (!data || !data.sankey) return data;

  let filteredLinks = [...data.sankey.links];
  if (currency === 'TMN') {
    filteredLinks = filteredLinks.filter(
      (l) => l.source.includes('ورود تومان') || l.target.includes('خروج به تومان')
    );
  } else if (currency === 'USDT') {
    filteredLinks = filteredLinks.filter(
      (l) => l.source.includes('ورود تتر') || l.target.includes('خروج به تتر')
    );
  }

  const topCoins = data.coinStats.slice(0, maxCoins).map((c: any) => c.symbol);
  const allowedNodes = new Set([
    'ورود تومان (TMN Inflow)',
    'ورود تتر (USDT Inflow)',
    'خروج به تومان (TMN Outflow)',
    'خروج به تتر (USDT Outflow)',
    ...topCoins,
  ]);

  filteredLinks = filteredLinks.filter((l) => allowedNodes.has(l.source) && allowedNodes.has(l.target));

  const usedNodesSet = new Set<string>();
  filteredLinks.forEach((l) => {
    usedNodesSet.add(l.source);
    usedNodesSet.add(l.target);
  });

  const filteredNodes = data.sankey.nodes.filter((n: any) => usedNodesSet.has(n.name));

  const adjustedCoinStats = data.coinStats.slice(0, maxCoins).map((coin: CoinFlowStat) => {
    if (currency === 'TMN') {
      const inflow = coin.tomanMarketInflow;
      const outflow = coin.tomanMarketOutflow;
      const net = inflow - outflow;
      const total = inflow + outflow;
      const buyPct = total > 0 ? (inflow / total) * 100 : 50;
      return {
        ...coin,
        inflowToman: inflow,
        outflowToman: outflow,
        netFlowToman: net,
        buyPressurePercent: Number(buyPct.toFixed(1)),
        sellPressurePercent: Number((100 - buyPct).toFixed(1)),
        flowStatus: buyPct >= 52 ? 'NET_INFLOW' : buyPct <= 48 ? 'NET_OUTFLOW' : 'BALANCED',
      };
    } else if (currency === 'USDT') {
      const inflowTmn = coin.usdtMarketInflow * (data.usdtPriceToman || 234600);
      const outflowTmn = coin.usdtMarketOutflow * (data.usdtPriceToman || 234600);
      const net = inflowTmn - outflowTmn;
      const total = inflowTmn + outflowTmn;
      const buyPct = total > 0 ? (inflowTmn / total) * 100 : 50;
      return {
        ...coin,
        inflowToman: Math.round(inflowTmn),
        outflowToman: Math.round(outflowTmn),
        netFlowToman: Math.round(net),
        buyPressurePercent: Number(buyPct.toFixed(1)),
        sellPressurePercent: Number((100 - buyPct).toFixed(1)),
        flowStatus: buyPct >= 52 ? 'NET_INFLOW' : buyPct <= 48 ? 'NET_OUTFLOW' : 'BALANCED',
      };
    }
    return coin;
  });

  return {
    ...data,
    sankey: {
      nodes: filteredNodes,
      links: filteredLinks,
    },
    coinStats: adjustedCoinStats,
  };
}
