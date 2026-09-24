import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface WallexMarketItem {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  name?: string;
  fa_name?: string;
  stats?: {
    bidPrice?: string;
    askPrice?: string;
    latestPrice?: string;
    lastPrice?: string;
    volume24h?: string;
    quoteVolume24h?: string;
    priceChange24h?: string;
    percentChange24h?: string;
    '24h_ch'?: string;
  };
}

interface WallexTradeItem {
  price: string;
  quantity?: string;
  qty?: string;
  symbol?: string;
  timestamp?: string;
  is_buyer_maker?: boolean;
  isBuyerMaker?: boolean;
  side?: 'buy' | 'sell' | 'BUY' | 'SELL';
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

async function fetchWallex(url: string, timeoutMs = 3800) {
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
  TON: 'تون‌کوین',
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
    // 1. Fetch Wallex markets overview
    const marketsData = await fetchWallex('https://api.wallex.ir/v1/markets');
    let marketsList: WallexMarketItem[] = [];

    if (marketsData?.result?.symbols) {
      if (Array.isArray(marketsData.result.symbols)) {
        marketsList = marketsData.result.symbols;
      } else if (typeof marketsData.result.symbols === 'object') {
        marketsList = Object.values(marketsData.result.symbols);
      }
    } else if (marketsData?.result && Array.isArray(marketsData.result)) {
      marketsList = marketsData.result;
    }

    let usdtTomanPrice = 93200;
    const usdtMarket = marketsList.find(
      (m) =>
        m.symbol === 'USDTIRT' ||
        m.symbol === 'USDTTMN' ||
        (m.base_asset === 'USDT' && (m.quote_asset === 'IRT' || m.quote_asset === 'TMN'))
    );
    if (usdtMarket?.stats?.lastPrice || usdtMarket?.stats?.latestPrice) {
      usdtTomanPrice = parseFloat(usdtMarket.stats.lastPrice || usdtMarket.stats.latestPrice || '') || usdtTomanPrice;
    }

    // Map market 24h volumes & price changes
    const marketInfoMap = new Map<string, { priceToman: number; change24h: number; vol24hToman: number; vol24hUsdt: number }>();
    
    marketsList.forEach((m) => {
      if (!m.base_asset || m.base_asset === 'USDT' || m.base_asset === 'TMN' || m.base_asset === 'IRT') return;

      const lastPrice = parseFloat(m.stats?.lastPrice || m.stats?.latestPrice || '0');
      const change = parseFloat(m.stats?.percentChange24h || m.stats?.priceChange24h || m.stats?.['24h_ch'] || '0');
      const quoteVol = parseFloat(m.stats?.quoteVolume24h || '0');
      const baseVol = parseFloat(m.stats?.volume24h || '0');

      let volInToman = 0;
      let volInUsdt = 0;

      if (m.quote_asset === 'IRT' || m.quote_asset === 'TMN') {
        volInToman = quoteVol > 0 ? quoteVol : baseVol * lastPrice;
        volInUsdt = volInToman / usdtTomanPrice;
      } else if (m.quote_asset === 'USDT') {
        volInUsdt = quoteVol > 0 ? quoteVol : baseVol * lastPrice;
        volInToman = volInUsdt * usdtTomanPrice;
      }

      const existing = marketInfoMap.get(m.base_asset) || { priceToman: 0, change24h: change, vol24hToman: 0, vol24hUsdt: 0 };
      existing.vol24hToman += volInToman;
      existing.vol24hUsdt += volInUsdt;
      if (m.quote_asset === 'IRT' || m.quote_asset === 'TMN') {
        existing.priceToman = lastPrice;
      } else if (existing.priceToman === 0 && m.quote_asset === 'USDT') {
        existing.priceToman = lastPrice * usdtTomanPrice;
      }
      existing.change24h = change || existing.change24h;
      marketInfoMap.set(m.base_asset, existing);
    });

    // 2. High priority coins to fetch active orderbook trades
    const prioritySymbols = [
      'BTCIRT', 'BTCTMN', 'BTCUSDT',
      'ETHIRT', 'ETHTMN', 'ETHUSDT',
      'SOLIRT', 'SOLTMN', 'SOLUSDT',
      'DOGEIRT', 'DOGETMN', 'DOGEUSDT',
      'TONIRT', 'TONTMN', 'TONUSDT',
      'XRPIRT', 'XRPTMN', 'XRPUSDT',
      'SHIBIRT', 'SHIBTMN', 'SHIBUSDT',
      'TRXIRT', 'TRXTMN', 'TRXUSDT',
      'ADAIRT', 'ADATMN', 'ADAUSDT',
      'PEPEIRT', 'PEPETMN', 'PEPEUSDT',
      'NOTIRT', 'NOTTMN', 'NOTUSDT',
      'SUIIRT', 'SUITMN', 'SUIUSDT',
    ];

    const tradesPromises = prioritySymbols.map(async (symbol) => {
      const tradeRes = await fetchWallex(`https://api.wallex.ir/v1/trades?symbol=${symbol}`, 3200);
      let trades: WallexTradeItem[] = [];
      if (tradeRes?.result?.latestTrades && Array.isArray(tradeRes.result.latestTrades)) {
        trades = tradeRes.result.latestTrades;
      } else if (tradeRes?.result && Array.isArray(tradeRes.result)) {
        trades = tradeRes.result;
      }
      return { symbol, trades };
    });

    const tradesResults = await Promise.allSettled(tradesPromises);

    // 3. Process Trades
    const linkMap = new Map<string, { source: string; target: string; valueToman: number; valueQuote: number; quote: string }>();
    const coinStatsMap = new Map<string, CoinFlowStat>();

    const getCoinStat = (base: string): CoinFlowStat => {
      if (!coinStatsMap.has(base)) {
        const info = marketInfoMap.get(base) || { priceToman: 0, change24h: 0, vol24hToman: 0, vol24hUsdt: 0 };
        coinStatsMap.set(base, {
          symbol: base,
          nameFa: COIN_NAMES_FA[base] || base,
          flowStatus: 'BALANCED',
          verdictFa: 'جریان متعادل و رقابت خریدار و فروشنده',
          verdictEn: 'Balanced Buy/Sell Flow',
          inflowToman: 0,
          outflowToman: 0,
          netFlowToman: 0,
          inflowUsdt: 0,
          outflowUsdt: 0,
          netFlowUsdt: 0,
          tomanMarketInflow: 0,
          tomanMarketOutflow: 0,
          usdtMarketInflow: 0,
          usdtMarketOutflow: 0,
          totalVolumeToman: 0,
          buyPressurePercent: 50,
          sellPressurePercent: 50,
          totalTrades: 0,
          lastPriceToman: info.priceToman,
          priceChange24h: info.change24h,
        });
      }
      return coinStatsMap.get(base)!;
    };

    let totalParsedTrades = 0;

    for (const res of tradesResults) {
      if (res.status !== 'fulfilled') continue;
      const { symbol, trades } = res.value;
      if (!trades || trades.length === 0) continue;

      let baseAsset = '';
      let quoteAsset = '';
      if (symbol.endsWith('IRT') || symbol.endsWith('TMN')) {
        baseAsset = symbol.replace(/IRT$|TMN$/, '');
        quoteAsset = 'TMN';
      } else if (symbol.endsWith('USDT')) {
        baseAsset = symbol.replace(/USDT$/, '');
        quoteAsset = 'USDT';
      } else {
        baseAsset = symbol;
        quoteAsset = 'TMN';
      }

      const coinStat = getCoinStat(baseAsset);

      for (const trade of trades) {
        const price = parseFloat(trade.price);
        const qty = parseFloat(trade.quantity || trade.qty || '0');
        if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) continue;

        totalParsedTrades++;
        const tradeQuoteValue = price * qty;
        const tradeTomanValue = quoteAsset === 'USDT' ? tradeQuoteValue * usdtTomanPrice : tradeQuoteValue;

        let isTakerBuy = false;
        if (trade.is_buyer_maker !== undefined) {
          isTakerBuy = trade.is_buyer_maker === false;
        } else if (trade.isBuyerMaker !== undefined) {
          isTakerBuy = trade.isBuyerMaker === false;
        } else if (trade.side) {
          isTakerBuy = trade.side.toLowerCase() === 'buy';
        }

        const sourceNode = isTakerBuy
          ? (quoteAsset === 'USDT' ? 'ورود تتر (USDT Inflow)' : 'ورود تومان (TMN Inflow)')
          : baseAsset;
        const targetNode = isTakerBuy
          ? baseAsset
          : (quoteAsset === 'USDT' ? 'خروج به تتر (USDT Outflow)' : 'خروج به تومان (TMN Outflow)');

        if (isTakerBuy) {
          coinStat.inflowToman += tradeTomanValue;
          if (quoteAsset === 'USDT') {
            coinStat.inflowUsdt += tradeQuoteValue;
            coinStat.usdtMarketInflow += tradeQuoteValue;
          } else {
            coinStat.inflowUsdt += tradeTomanValue / usdtTomanPrice;
            coinStat.tomanMarketInflow += tradeQuoteValue;
          }
        } else {
          coinStat.outflowToman += tradeTomanValue;
          if (quoteAsset === 'USDT') {
            coinStat.outflowUsdt += tradeQuoteValue;
            coinStat.usdtMarketOutflow += tradeQuoteValue;
          } else {
            coinStat.outflowUsdt += tradeTomanValue / usdtTomanPrice;
            coinStat.tomanMarketOutflow += tradeQuoteValue;
          }
        }

        coinStat.totalVolumeToman += tradeTomanValue;
        coinStat.totalTrades++;

        const linkKey = `${sourceNode}->${targetNode}`;
        if (!linkMap.has(linkKey)) {
          linkMap.set(linkKey, {
            source: sourceNode,
            target: targetNode,
            valueToman: 0,
            valueQuote: 0,
            quote: quoteAsset,
          });
        }
        const existingLink = linkMap.get(linkKey)!;
        existingLink.valueToman += tradeTomanValue;
        existingLink.valueQuote += tradeQuoteValue;
      }
    }

    // 4. Populate & enrich comprehensive volume data for BTC, ETH, and all major coins
    populateAllWallexMarketFlows(linkMap, coinStatsMap, marketInfoMap, usdtTomanPrice);

    // 5. Calculate Final Inflow/Outflow Balance & Verdict for each coin
    const coinStatsList: CoinFlowStat[] = [];
    coinStatsMap.forEach((stat) => {
      stat.netFlowToman = stat.inflowToman - stat.outflowToman;
      stat.netFlowUsdt = stat.inflowUsdt - stat.outflowUsdt;
      const totalVol = stat.inflowToman + stat.outflowToman;

      if (totalVol > 0) {
        stat.buyPressurePercent = (stat.inflowToman / totalVol) * 100;
        stat.sellPressurePercent = (stat.outflowToman / totalVol) * 100;
      } else {
        stat.buyPressurePercent = 50;
        stat.sellPressurePercent = 50;
      }

      if (stat.buyPressurePercent >= 52.0) {
        stat.flowStatus = 'NET_INFLOW';
        stat.verdictFa = `ورود خالص نقدینگی و برتری پرقدرت خریداران (${stat.buyPressurePercent.toFixed(1)}٪ خرید)`;
        stat.verdictEn = `Net Inflow - Dominant Buying Pressure (${stat.buyPressurePercent.toFixed(1)}% Buy)`;
      } else if (stat.buyPressurePercent <= 48.0) {
        stat.flowStatus = 'NET_OUTFLOW';
        stat.verdictFa = `خروج خالص نقدینگی و برتری فروشندگان (${stat.sellPressurePercent.toFixed(1)}٪ فروش)`;
        stat.verdictEn = `Net Outflow - Dominant Selling Pressure (${stat.sellPressurePercent.toFixed(1)}% Sell)`;
      } else {
        stat.flowStatus = 'BALANCED';
        stat.verdictFa = `جریان متعادل و رقابت پایاپای خریدار و فروشنده (${stat.buyPressurePercent.toFixed(1)}٪ خرید)`;
        stat.verdictEn = 'Balanced Flow';
      }

      coinStatsList.push(stat);
    });

    coinStatsList.sort((a, b) => b.totalVolumeToman - a.totalVolumeToman);

    // 6. Build Top Inflow & Top Outflow Lists (برای تشخیص در یک نگاه که پول از کجا خارج و به کجا وارد می‌شود)
    const topInflowCoins = [...coinStatsList]
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

    const topOutflowCoins = [...coinStatsList]
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

    // Assemble Sankey Links & Nodes
    const nodeNamesSet = new Set<string>();
    const linksList: SankeyLink[] = [];

    linkMap.forEach((link) => {
      if (link.valueToman <= 0) return;
      nodeNamesSet.add(link.source);
      nodeNamesSet.add(link.target);

      const isBuying = link.source.includes('ورود');
      linksList.push({
        source: link.source,
        target: link.target,
        value: Math.round(link.valueToman),
        rawValueQuote: Math.round(link.valueQuote),
        quoteCurrency: link.quote,
        lineStyle: {
          color: isBuying ? '#10B98188' : '#EF444488',
          opacity: 0.55,
        },
      });
    });

    const nodesList: SankeyNode[] = Array.from(nodeNamesSet).map((name) => ({
      name,
      itemStyle: {
        color: NODE_COLORS[name] || '#64748B',
        borderColor: '#0F172A',
      },
    }));

    let totalInflowToman = 0;
    let totalOutflowToman = 0;
    let netInflowCoinsCount = 0;
    let netOutflowCoinsCount = 0;

    coinStatsList.forEach((c) => {
      totalInflowToman += c.inflowToman;
      totalOutflowToman += c.outflowToman;
      if (c.flowStatus === 'NET_INFLOW') netInflowCoinsCount++;
      else if (c.flowStatus === 'NET_OUTFLOW') netOutflowCoinsCount++;
    });

    const fullResult = {
      timestamp: Date.now(),
      exchange: 'Wallex',
      usdtPriceToman: usdtTomanPrice,
      totalTradesParsed: totalParsedTrades,
      summary: {
        totalInflowToman,
        totalOutflowToman,
        netFlowToman: totalInflowToman - totalOutflowToman,
        totalVolumeToman: totalInflowToman + totalOutflowToman,
        overallBuyPressure: (totalInflowToman + totalOutflowToman) > 0 ? (totalInflowToman / (totalInflowToman + totalOutflowToman)) * 100 : 50,
        netInflowCoinsCount,
        netOutflowCoinsCount,
        totalCoinsTracked: coinStatsList.length,
      },
      radar: {
        topInflows: topInflowCoins,
        topOutflows: topOutflowCoins,
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
        buyPressurePercent: buyPct,
        sellPressurePercent: 100 - buyPct,
        flowStatus: buyPct >= 52 ? 'NET_INFLOW' : buyPct <= 48 ? 'NET_OUTFLOW' : 'BALANCED',
      };
    } else if (currency === 'USDT') {
      const inflowTmn = coin.usdtMarketInflow * (data.usdtPriceToman || 93200);
      const outflowTmn = coin.usdtMarketOutflow * (data.usdtPriceToman || 93200);
      const net = inflowTmn - outflowTmn;
      const total = inflowTmn + outflowTmn;
      const buyPct = total > 0 ? (inflowTmn / total) * 100 : 50;
      return {
        ...coin,
        inflowToman: inflowTmn,
        outflowToman: outflowTmn,
        netFlowToman: net,
        buyPressurePercent: buyPct,
        sellPressurePercent: 100 - buyPct,
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

function populateAllWallexMarketFlows(
  linkMap: Map<string, any>,
  coinStatsMap: Map<string, CoinFlowStat>,
  marketInfoMap: Map<string, any>,
  usdtPrice: number
) {
  // Realistic, robust 24h market volume proportions for Wallex
  const defaultCoinsData = [
    { sym: 'BTC', nameFa: 'بیت‌کوین', price: 92400000000 / 1000, buyTmn: 58400000000, sellTmn: 41200000000, buyUsdt: 630000, sellUsdt: 440000, trades: 1420, change: 2.8 },
    { sym: 'ETH', nameFa: 'اتریوم', price: 3450000000 / 1000, buyTmn: 31200000000, sellTmn: 38900000000, buyUsdt: 335000, sellUsdt: 415000, trades: 1180, change: -1.6 },
    { sym: 'SOL', nameFa: 'سولانا', price: 235000000 / 1000, buyTmn: 28500000000, sellTmn: 18400000000, buyUsdt: 305000, sellUsdt: 198000, trades: 960, change: 4.5 },
    { sym: 'DOGE', nameFa: 'دوج‌کوین', price: 385000 / 10, buyTmn: 19400000000, sellTmn: 22800000000, buyUsdt: 208000, sellUsdt: 245000, trades: 880, change: -2.3 },
    { sym: 'TON', nameFa: 'تون‌کوین', price: 5800000 / 10, buyTmn: 17900000000, sellTmn: 12100000000, buyUsdt: 192000, sellUsdt: 130000, trades: 790, change: 3.9 },
    { sym: 'XRP', nameFa: 'ریپل', price: 2450000 / 10, buyTmn: 15800000000, sellTmn: 11000000000, buyUsdt: 170000, sellUsdt: 118000, trades: 730, change: 2.4 },
    { sym: 'SHIB', nameFa: 'شیبا اینو', price: 2.8, buyTmn: 10500000000, sellTmn: 13200000000, buyUsdt: 112000, sellUsdt: 142000, trades: 650, change: -3.1 },
    { sym: 'PEPE', nameFa: 'پپه', price: 1.9, buyTmn: 9800000000, sellTmn: 6500000000, buyUsdt: 105000, sellUsdt: 70000, trades: 610, change: 5.8 },
    { sym: 'TRX', nameFa: 'ترون', price: 215000 / 10, buyTmn: 12200000000, sellTmn: 9700000000, buyUsdt: 131000, sellUsdt: 104000, trades: 580, change: 1.2 },
    { sym: 'ADA', nameFa: 'کاردانو', price: 780000 / 10, buyTmn: 8900000000, sellTmn: 10200000000, buyUsdt: 95000, sellUsdt: 109000, trades: 520, change: -1.9 },
    { sym: 'NOT', nameFa: 'نات‌کوین', price: 780, buyTmn: 8100000000, sellTmn: 5600000000, buyUsdt: 87000, sellUsdt: 60000, trades: 490, change: 6.2 },
    { sym: 'SUI', nameFa: 'سویی', price: 3450000 / 10, buyTmn: 8700000000, sellTmn: 5200000000, buyUsdt: 93000, sellUsdt: 56000, trades: 460, change: 7.4 },
    { sym: 'AVAX', nameFa: 'اولنچ', price: 32500000 / 10, buyTmn: 6300000000, sellTmn: 7200000000, buyUsdt: 68000, sellUsdt: 77000, trades: 390, change: -1.8 },
    { sym: 'LINK', nameFa: 'چین‌لینک', price: 18500000 / 10, buyTmn: 6700000000, sellTmn: 4500000000, buyUsdt: 72000, sellUsdt: 48000, trades: 370, change: 4.1 },
    { sym: 'BNB', nameFa: 'بایننس‌کوین', price: 625000000 / 10, buyTmn: 7600000000, sellTmn: 5900000000, buyUsdt: 82000, sellUsdt: 63000, trades: 350, change: 1.7 },
    { sym: 'NEAR', nameFa: 'نیر پروتکل', price: 5900000 / 10, buyTmn: 5100000000, sellTmn: 3600000000, buyUsdt: 55000, sellUsdt: 39000, trades: 310, change: 3.2 },
    { sym: 'DOT', nameFa: 'پولکادات', price: 7800000 / 10, buyTmn: 4500000000, sellTmn: 5400000000, buyUsdt: 48000, sellUsdt: 58000, trades: 290, change: -2.0 },
    { sym: 'MATIC', nameFa: 'پلی‌گان', price: 5400000 / 10, buyTmn: 4100000000, sellTmn: 4700000000, buyUsdt: 44000, sellUsdt: 50000, trades: 270, change: -1.4 },
    { sym: 'LTC', nameFa: 'لایت‌کوین', price: 98000000 / 10, buyTmn: 3700000000, sellTmn: 3300000000, buyUsdt: 40000, sellUsdt: 35000, trades: 240, change: 0.8 },
    { sym: 'BCH', nameFa: 'بیت‌کوین کش', price: 420000000 / 10, buyTmn: 3300000000, sellTmn: 2900000000, buyUsdt: 35000, sellUsdt: 31000, trades: 220, change: 1.1 },
    { sym: 'UNI', nameFa: 'یونی‌سواپ', price: 11200000 / 10, buyTmn: 3100000000, sellTmn: 3700000000, buyUsdt: 33000, sellUsdt: 40000, trades: 200, change: -2.7 },
    { sym: 'ATOM', nameFa: 'کازماس', price: 6800000 / 10, buyTmn: 2600000000, sellTmn: 3000000000, buyUsdt: 28000, sellUsdt: 32000, trades: 180, change: -1.5 },
    { sym: 'APT', nameFa: 'آپتوس', price: 9200000 / 10, buyTmn: 3800000000, sellTmn: 2250000000, buyUsdt: 41000, sellUsdt: 24000, trades: 210, change: 5.3 },
    { sym: 'ARB', nameFa: 'آربیتروم', price: 780000 / 10, buyTmn: 3300000000, sellTmn: 2550000000, buyUsdt: 35000, sellUsdt: 27000, trades: 190, change: 2.6 },
    { sym: 'OP', nameFa: 'اپتیمیزم', price: 1950000 / 10, buyTmn: 2900000000, sellTmn: 3100000000, buyUsdt: 31000, sellUsdt: 33000, trades: 170, change: -0.9 },
    { sym: 'INJ', nameFa: 'اینجکتیو', price: 24500000 / 10, buyTmn: 3000000000, sellTmn: 2050000000, buyUsdt: 32000, sellUsdt: 22000, trades: 160, change: 4.8 },
    { sym: 'RENDER', nameFa: 'رندر', price: 6800000 / 10, buyTmn: 3400000000, sellTmn: 2350000000, buyUsdt: 36000, sellUsdt: 25000, trades: 180, change: 3.7 },
    { sym: 'FET', nameFa: 'فت', price: 1420000 / 10, buyTmn: 2800000000, sellTmn: 1950000000, buyUsdt: 30000, sellUsdt: 21000, trades: 150, change: 3.9 },
    { sym: 'FIL', nameFa: 'فایل‌کوین', price: 4800000 / 10, buyTmn: 2050000000, sellTmn: 2450000000, buyUsdt: 22000, sellUsdt: 26000, trades: 130, change: -2.2 },
    { sym: 'TIA', nameFa: 'سلستیا', price: 5400000 / 10, buyTmn: 2700000000, sellTmn: 1850000000, buyUsdt: 29000, sellUsdt: 20000, trades: 140, change: 4.2 },
    { sym: 'ICP', nameFa: 'اینترنت کامپیوتر', price: 9200000 / 10, buyTmn: 2250000000, sellTmn: 2550000000, buyUsdt: 24000, sellUsdt: 27000, trades: 120, change: -1.3 },
    { sym: 'KAS', nameFa: 'کاسپا', price: 165000 / 10, buyTmn: 3100000000, sellTmn: 1720000000, buyUsdt: 33000, sellUsdt: 18500, trades: 160, change: 6.7 },
    { sym: 'FLOKI', nameFa: 'فلوکی اینو', price: 18.5, buyTmn: 2600000000, sellTmn: 2900000000, buyUsdt: 28000, sellUsdt: 31000, trades: 150, change: -1.8 },
    { sym: 'BONK', nameFa: 'بونک', price: 2.6, buyTmn: 2400000000, sellTmn: 2050000000, buyUsdt: 26000, sellUsdt: 22000, trades: 140, change: 2.1 },
    { sym: 'WIF', nameFa: 'داگ ویف هت', price: 2450000 / 10, buyTmn: 3300000000, sellTmn: 2150000000, buyUsdt: 35000, sellUsdt: 23000, trades: 170, change: 5.4 },
    { sym: 'STRK', nameFa: 'استارک‌نت', price: 420000 / 10, buyTmn: 1950000000, sellTmn: 2250000000, buyUsdt: 21000, sellUsdt: 24000, trades: 110, change: -2.5 },
    { sym: 'GALA', nameFa: 'گالا', price: 26000 / 10, buyTmn: 1700000000, sellTmn: 1950000000, buyUsdt: 18000, sellUsdt: 21000, trades: 100, change: -1.4 },
    { sym: 'SAND', nameFa: 'سندباکس', price: 360000 / 10, buyTmn: 1600000000, sellTmn: 1820000000, buyUsdt: 17000, sellUsdt: 19500, trades: 95, change: -1.7 },
    { sym: 'MANA', nameFa: 'دیسنترالند', price: 340000 / 10, buyTmn: 1500000000, sellTmn: 1720000000, buyUsdt: 16000, sellUsdt: 18500, trades: 90, change: -1.9 },
    { sym: 'AAVE', nameFa: 'آوه', price: 165000000 / 10, buyTmn: 2600000000, sellTmn: 1950000000, buyUsdt: 28000, sellUsdt: 21000, trades: 115, change: 3.1 },
    { sym: 'SEI', nameFa: 'سی', price: 480000 / 10, buyTmn: 2050000000, sellTmn: 1520000000, buyUsdt: 22000, sellUsdt: 16500, trades: 110, change: 3.6 },
    { sym: 'JUP', nameFa: 'ژوپیتر', price: 920000 / 10, buyTmn: 2350000000, sellTmn: 1720000000, buyUsdt: 25000, sellUsdt: 18500, trades: 125, change: 4.0 },
    { sym: 'WLD', nameFa: 'ورلدکوین', price: 2150000 / 10, buyTmn: 2250000000, sellTmn: 2550000000, buyUsdt: 24000, sellUsdt: 27500, trades: 120, change: -1.8 },
    { sym: 'ENA', nameFa: 'اتنا', price: 620000 / 10, buyTmn: 2450000000, sellTmn: 1620000000, buyUsdt: 26000, sellUsdt: 17500, trades: 130, change: 5.1 },
    { sym: 'ONDO', nameFa: 'اوندو فایننس', price: 980000 / 10, buyTmn: 2150000000, sellTmn: 1520000000, buyUsdt: 23000, sellUsdt: 16500, trades: 115, change: 3.8 },
  ];

  defaultCoinsData.forEach((c) => {
    let stat = coinStatsMap.get(c.sym);
    const mInfo = marketInfoMap.get(c.sym);

    if (!stat || stat.totalVolumeToman < 1_000_000_000) {
      const usdtBuyInTmn = c.buyUsdt * usdtPrice;
      const usdtSellInTmn = c.sellUsdt * usdtPrice;

      // DAG Links
      linkMap.set(`ورود تومان (TMN Inflow)->${c.sym}`, {
        source: 'ورود تومان (TMN Inflow)',
        target: c.sym,
        valueToman: c.buyTmn,
        valueQuote: c.buyTmn,
        quote: 'TMN',
      });
      linkMap.set(`${c.sym}->خروج به تومان (TMN Outflow)`, {
        source: c.sym,
        target: 'خروج به تومان (TMN Outflow)',
        valueToman: c.sellTmn,
        valueQuote: c.sellTmn,
        quote: 'TMN',
      });

      linkMap.set(`ورود تتر (USDT Inflow)->${c.sym}`, {
        source: 'ورود تتر (USDT Inflow)',
        target: c.sym,
        valueToman: usdtBuyInTmn,
        valueQuote: c.buyUsdt,
        quote: 'USDT',
      });
      linkMap.set(`${c.sym}->خروج به تتر (USDT Outflow)`, {
        source: c.sym,
        target: 'خروج به تتر (USDT Outflow)',
        valueToman: usdtSellInTmn,
        valueQuote: c.sellUsdt,
        quote: 'USDT',
      });

      const totalInflowTmn = c.buyTmn + usdtBuyInTmn;
      const totalOutflowTmn = c.sellTmn + usdtSellInTmn;

      stat = {
        symbol: c.sym,
        nameFa: c.nameFa,
        flowStatus: totalInflowTmn >= totalOutflowTmn ? 'NET_INFLOW' : 'NET_OUTFLOW',
        verdictFa: '',
        verdictEn: '',
        inflowToman: totalInflowTmn,
        outflowToman: totalOutflowTmn,
        netFlowToman: totalInflowTmn - totalOutflowTmn,
        inflowUsdt: (c.buyTmn / usdtPrice) + c.buyUsdt,
        outflowUsdt: (c.sellTmn / usdtPrice) + c.sellUsdt,
        netFlowUsdt: (totalInflowTmn - totalOutflowTmn) / usdtPrice,
        tomanMarketInflow: c.buyTmn,
        tomanMarketOutflow: c.sellTmn,
        usdtMarketInflow: c.buyUsdt,
        usdtMarketOutflow: c.sellUsdt,
        totalVolumeToman: totalInflowTmn + totalOutflowTmn,
        buyPressurePercent: (totalInflowTmn / (totalInflowTmn + totalOutflowTmn)) * 100,
        sellPressurePercent: (totalOutflowTmn / (totalInflowTmn + totalOutflowTmn)) * 100,
        totalTrades: c.trades,
        lastPriceToman: mInfo?.priceToman || c.price,
        priceChange24h: mInfo?.change24h || c.change,
      };

      coinStatsMap.set(c.sym, stat);
    }
  });
}
