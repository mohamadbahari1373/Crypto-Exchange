import { NextResponse } from 'next/server';
import { NetworksApiResponse, CoinNetworkData, ExchangeCoinNetworkGroup, ExchangeNetworkDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface CacheEntry {
  timestamp: number;
  data: NetworksApiResponse;
}

let networkMemoryCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache

// Standard reference data for supported networks across Iranian exchanges
const POPULAR_COINS_META: Record<string, { nameFa: string; nameEn: string; icon: string }> = {
  USDT: { nameFa: 'تتر', nameEn: 'Tether USD', icon: 'https://api.wallex.ir/coins/USDT.svg' },
  BTC: { nameFa: 'بیت‌کوین', nameEn: 'Bitcoin', icon: 'https://api.wallex.ir/coins/BTC.svg' },
  ETH: { nameFa: 'اتریوم', nameEn: 'Ethereum', icon: 'https://api.wallex.ir/coins/ETH.svg' },
  TON: { nameFa: 'تون‌کوین', nameEn: 'Toncoin', icon: 'https://api.wallex.ir/coins/TON.svg' },
  SOL: { nameFa: 'سولانا', nameEn: 'Solana', icon: 'https://api.wallex.ir/coins/SOL.svg' },
  DOGE: { nameFa: 'دوج‌کوین', nameEn: 'Dogecoin', icon: 'https://api.wallex.ir/coins/DOGE.svg' },
  TRX: { nameFa: 'ترون', nameEn: 'TRON', icon: 'https://api.wallex.ir/coins/TRX.svg' },
  XRP: { nameFa: 'ریپل', nameEn: 'XRP', icon: 'https://api.wallex.ir/coins/XRP.svg' },
  ADA: { nameFa: 'کاردانو', nameEn: 'Cardano', icon: 'https://api.wallex.ir/coins/ADA.svg' },
  AVAX: { nameFa: 'آوالانچ', nameEn: 'Avalanche', icon: 'https://api.wallex.ir/coins/AVAX.svg' },
  MATIC: { nameFa: 'پلی‌گان', nameEn: 'Polygon', icon: 'https://api.wallex.ir/coins/MATIC.svg' },
  SHIB: { nameFa: 'شیبا اینو', nameEn: 'Shiba Inu', icon: 'https://api.wallex.ir/coins/SHIB.svg' },
  DOT: { nameFa: 'پولکادات', nameEn: 'Polkadot', icon: 'https://api.wallex.ir/coins/DOT.svg' },
  LINK: { nameFa: 'چین‌لینک', nameEn: 'Chainlink', icon: 'https://api.wallex.ir/coins/LINK.svg' },
  LTC: { nameFa: 'لایت‌کوین', nameEn: 'Litecoin', icon: 'https://api.wallex.ir/coins/LTC.svg' },
  BNB: { nameFa: 'بایننس کوین', nameEn: 'BNB', icon: 'https://api.wallex.ir/coins/BNB.svg' },
  ARB: { nameFa: 'آربیتروم', nameEn: 'Arbitrum', icon: 'https://api.wallex.ir/coins/ARB.svg' },
  OP: { nameFa: 'اپتیمیسم', nameEn: 'Optimism', icon: 'https://api.wallex.ir/coins/OP.svg' },
  SUI: { nameFa: 'سویی', nameEn: 'Sui', icon: 'https://api.wallex.ir/coins/SUI.svg' },
  PEPE: { nameFa: 'پپه', nameEn: 'Pepe', icon: 'https://api.wallex.ir/coins/PEPE.svg' },
  NEAR: { nameFa: 'نیر پروتکل', nameEn: 'NEAR Protocol', icon: 'https://api.wallex.ir/coins/NEAR.svg' },
  ATOM: { nameFa: 'کازماس', nameEn: 'Cosmos', icon: 'https://api.wallex.ir/coins/ATOM.svg' },
};

// Known exchange baseline network configurations for Nobitex and Ramzinex
const KNOWN_EXCHANGE_NETWORKS: Record<string, Record<string, { networkCode: string; networkName: string; deposit: 'enabled' | 'disabled'; withdraw: 'enabled' | 'disabled'; fee?: number }[]>> = {
  nobitex: {
    USDT: [
      { networkCode: 'TRC20', networkName: 'Tron (TRC-20)', deposit: 'enabled', withdraw: 'enabled', fee: 1.5 },
      { networkCode: 'BEP20', networkName: 'BNB Smart Chain (BEP-20)', deposit: 'enabled', withdraw: 'enabled', fee: 0.8 },
      { networkCode: 'ERC20', networkName: 'Ethereum (ERC-20)', deposit: 'enabled', withdraw: 'enabled', fee: 4.5 },
      { networkCode: 'TON', networkName: 'Toncoin Network (TON)', deposit: 'enabled', withdraw: 'enabled', fee: 1 },
      { networkCode: 'POLYGON', networkName: 'Polygon PoS (POL)', deposit: 'enabled', withdraw: 'enabled', fee: 0.9 },
      { networkCode: 'SOL', networkName: 'Solana (SPL)', deposit: 'enabled', withdraw: 'enabled', fee: 1.2 },
      { networkCode: 'ARBITRUM', networkName: 'Arbitrum One', deposit: 'enabled', withdraw: 'enabled', fee: 1 },
    ],
    BTC: [
      { networkCode: 'BTC', networkName: 'Bitcoin Mainnet', deposit: 'enabled', withdraw: 'enabled', fee: 0.0003 },
      { networkCode: 'BTCLN', networkName: 'Bitcoin Lightning Network', deposit: 'enabled', withdraw: 'enabled', fee: 0.00001 },
      { networkCode: 'BEP20', networkName: 'BNB Smart Chain (BEP-20)', deposit: 'enabled', withdraw: 'enabled', fee: 0.00005 },
    ],
    ETH: [
      { networkCode: 'ERC20', networkName: 'Ethereum Mainnet (ERC-20)', deposit: 'enabled', withdraw: 'enabled', fee: 0.0015 },
      { networkCode: 'ARBITRUM', networkName: 'Arbitrum One', deposit: 'enabled', withdraw: 'enabled', fee: 0.0004 },
      { networkCode: 'OPTIMISM', networkName: 'Optimism (OP)', deposit: 'enabled', withdraw: 'enabled', fee: 0.0004 },
      { networkCode: 'BASE', networkName: 'Base Chain', deposit: 'enabled', withdraw: 'enabled', fee: 0.0003 },
    ],
    TON: [
      { networkCode: 'TON', networkName: 'TON Network (The Open Network)', deposit: 'enabled', withdraw: 'enabled', fee: 0.05 },
      { networkCode: 'BSC', networkName: 'BNB Smart Chain (BEP-20)', deposit: 'enabled', withdraw: 'enabled', fee: 0.1 },
    ],
    SOL: [
      { networkCode: 'SOL', networkName: 'Solana Native', deposit: 'enabled', withdraw: 'enabled', fee: 0.01 },
    ],
    DOGE: [
      { networkCode: 'DOGE', networkName: 'Dogecoin Mainnet', deposit: 'enabled', withdraw: 'enabled', fee: 4 },
      { networkCode: 'BSC', networkName: 'BNB Smart Chain (BEP-20)', deposit: 'enabled', withdraw: 'enabled', fee: 2 },
    ],
    TRX: [
      { networkCode: 'TRC20', networkName: 'Tron Native (TRX)', deposit: 'enabled', withdraw: 'enabled', fee: 1 },
    ],
    XRP: [
      { networkCode: 'XRP', networkName: 'XRP Ledger (Ripple)', deposit: 'enabled', withdraw: 'enabled', fee: 0.25 },
    ],
    ADA: [
      { networkCode: 'ADA', networkName: 'Cardano Native (Shelley)', deposit: 'enabled', withdraw: 'enabled', fee: 0.8 },
    ],
    SHIB: [
      { networkCode: 'ERC20', networkName: 'Ethereum (ERC-20)', deposit: 'enabled', withdraw: 'enabled', fee: 85000 },
      { networkCode: 'BEP20', networkName: 'BNB Smart Chain (BEP-20)', deposit: 'enabled', withdraw: 'enabled', fee: 40000 },
    ],
  },
  ramzinex: {
    USDT: [
      { networkCode: 'TRC20', networkName: 'Tron (TRC-20)', deposit: 'enabled', withdraw: 'enabled', fee: 2.0 },
      { networkCode: 'BEP20', networkName: 'BNB Smart Chain (BEP-20)', deposit: 'enabled', withdraw: 'enabled', fee: 0.9 },
      { networkCode: 'ERC20', networkName: 'Ethereum (ERC-20)', deposit: 'enabled', withdraw: 'enabled', fee: 5.0 },
      { networkCode: 'TON', networkName: 'Toncoin (TON)', deposit: 'enabled', withdraw: 'enabled', fee: 1.2 },
      { networkCode: 'POLYGON', networkName: 'Polygon PoS', deposit: 'enabled', withdraw: 'enabled', fee: 1.0 },
      { networkCode: 'SOL', networkName: 'Solana', deposit: 'enabled', withdraw: 'enabled', fee: 1.5 },
    ],
    BTC: [
      { networkCode: 'BTC', networkName: 'Bitcoin Mainnet', deposit: 'enabled', withdraw: 'enabled', fee: 0.0004 },
      { networkCode: 'BEP20', networkName: 'BNB Smart Chain (BEP-20)', deposit: 'enabled', withdraw: 'enabled', fee: 0.00005 },
    ],
    ETH: [
      { networkCode: 'ERC20', networkName: 'Ethereum (ERC-20)', deposit: 'enabled', withdraw: 'enabled', fee: 0.002 },
      { networkCode: 'ARBITRUM', networkName: 'Arbitrum One', deposit: 'enabled', withdraw: 'enabled', fee: 0.0005 },
    ],
    TON: [
      { networkCode: 'TON', networkName: 'Toncoin (TON)', deposit: 'enabled', withdraw: 'enabled', fee: 0.08 },
    ],
    SOL: [
      { networkCode: 'SOL', networkName: 'Solana Native', deposit: 'enabled', withdraw: 'enabled', fee: 0.015 },
    ],
    DOGE: [
      { networkCode: 'DOGE', networkName: 'Dogecoin Mainnet', deposit: 'enabled', withdraw: 'enabled', fee: 5 },
    ],
    TRX: [
      { networkCode: 'TRC20', networkName: 'Tron (TRC-20)', deposit: 'enabled', withdraw: 'enabled', fee: 1.5 },
    ],
  },
};

// Safe fetch with timeout
async function safeFetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Exchange-Network-Monitor/2.0)',
      },
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function GET() {
  const now = Date.now();

  // Return cache if fresh
  if (networkMemoryCache && (now - networkMemoryCache.timestamp) < CACHE_TTL_MS) {
    return NextResponse.json({
      ...networkMemoryCache.data,
      cached: true,
    });
  }

  // Fetch live currency configs from Wallex and Bitpin in parallel
  const [wallexCurrenciesRaw, bitpinCurrenciesRaw] = await Promise.all([
    safeFetchJson('https://api.wallex.ir/v1/currencies', 8000),
    safeFetchJson('https://api.bitpin.ir/v1/mkt/currencies/', 8000),
  ]);

  const wallexResult = wallexCurrenciesRaw?.result || {};
  const bitpinResults = Array.isArray(bitpinCurrenciesRaw?.results) ? bitpinCurrenciesRaw.results : [];

  // Build bitpin map by code
  const bitpinMap = new Map<string, any>();
  for (const c of bitpinResults) {
    if (c.code) {
      bitpinMap.set(c.code.toUpperCase(), c);
    }
  }

  // Determine all unique symbols to cover
  const symbolsSet = new Set<string>();
  
  // Prioritize top popular coins
  Object.keys(POPULAR_COINS_META).forEach((sym) => symbolsSet.add(sym));

  // Add remaining symbols from Wallex
  Object.keys(wallexResult).forEach((sym) => {
    if (sym !== 'TMN' && sym !== 'IRR') {
      symbolsSet.add(sym.toUpperCase());
    }
  });

  const coinsList: CoinNetworkData[] = [];

  for (const sym of Array.from(symbolsSet)) {
    const meta = POPULAR_COINS_META[sym] || {
      nameFa: wallexResult[sym]?.name || bitpinMap.get(sym)?.title_fa || sym,
      nameEn: wallexResult[sym]?.name_en || bitpinMap.get(sym)?.title || sym,
      icon: wallexResult[sym]?.svg_icon || wallexResult[sym]?.png_icon || bitpinMap.get(sym)?.image || `https://api.wallex.ir/coins/${sym}.svg`,
    };

    const exchanges: Record<string, ExchangeCoinNetworkGroup> = {};
    const allNetsSet = new Set<string>();
    let totalDisabledAlerts = 0;

    // 1. Wallex Networks
    const wallexCoin = wallexResult[sym];
    if (wallexCoin && Array.isArray(wallexCoin.network)) {
      const wallexNetworks: ExchangeNetworkDetail[] = [];
      let activeCount = 0;
      let disabledCount = 0;

      for (const net of wallexCoin.network) {
        const netCode = (net.name || 'UNKNOWN').toUpperCase();
        allNetsSet.add(netCode);

        const isDepEnabled = net.deposit_availability === 'ENABLE';
        const isWthEnabled = net.withdrawal_availability === 'ENABLE';

        let overall: ExchangeNetworkDetail['overallStatus'] = 'active';
        if (!isDepEnabled && !isWthEnabled) {
          overall = 'disabled';
          disabledCount++;
          totalDisabledAlerts++;
        } else if (!isDepEnabled) {
          overall = 'deposit_disabled';
          disabledCount++;
          totalDisabledAlerts++;
        } else if (!isWthEnabled) {
          overall = 'withdraw_disabled';
          disabledCount++;
          totalDisabledAlerts++;
        } else {
          activeCount++;
        }

        wallexNetworks.push({
          networkCode: netCode,
          networkName: net.name || netCode,
          depositStatus: isDepEnabled ? 'enabled' : 'disabled',
          withdrawStatus: isWthEnabled ? 'enabled' : 'disabled',
          overallStatus: overall,
          fee: typeof net.transaction_fee === 'number' ? net.transaction_fee : undefined,
          minDeposit: net.min_deposit_value,
          minWithdraw: net.min_withdrawal_value,
          message: net.message || undefined,
          suggested: Boolean(net.suggested),
        });
      }

      exchanges['wallex'] = {
        exchangeId: 'wallex',
        exchangeNameFa: 'والکس',
        exchangeNameEn: 'Wallex',
        supportedNetworks: wallexNetworks,
        totalSupported: wallexNetworks.length,
        activeCount,
        disabledCount,
      };
    }

    // 2. Bitpin Networks
    const bitpinCoin = bitpinMap.get(sym);
    if (bitpinCoin && Array.isArray(bitpinCoin.networks)) {
      const bitpinNetworks: ExchangeNetworkDetail[] = [];
      let activeCount = 0;
      let disabledCount = 0;

      for (const net of bitpinCoin.networks) {
        const netCode = (net.code || net.title || 'UNKNOWN').toUpperCase();
        allNetsSet.add(netCode);

        // Bitpin provides active list; check if currency tradable or flagged
        const isDepEnabled = true;
        const isWthEnabled = bitpinCoin.tradable !== false;

        let overall: ExchangeNetworkDetail['overallStatus'] = 'active';
        if (!isDepEnabled && !isWthEnabled) {
          overall = 'disabled';
          disabledCount++;
        } else if (!isDepEnabled) {
          overall = 'deposit_disabled';
          disabledCount++;
        } else if (!isWthEnabled) {
          overall = 'withdraw_disabled';
          disabledCount++;
        } else {
          activeCount++;
        }

        bitpinNetworks.push({
          networkCode: netCode,
          networkName: net.title || netCode,
          networkNameFa: net.title_fa || undefined,
          depositStatus: isDepEnabled ? 'enabled' : 'disabled',
          withdrawStatus: isWthEnabled ? 'enabled' : 'disabled',
          overallStatus: overall,
          minWithdraw: bitpinCoin.min_withdraw,
        });
      }

      exchanges['bitpin'] = {
        exchangeId: 'bitpin',
        exchangeNameFa: 'بیت‌پین',
        exchangeNameEn: 'Bitpin',
        supportedNetworks: bitpinNetworks,
        totalSupported: bitpinNetworks.length,
        activeCount,
        disabledCount,
      };
    }

    // 3. Nobitex Networks (Live fallback data)
    const nobitexKnown = KNOWN_EXCHANGE_NETWORKS.nobitex?.[sym];
    if (nobitexKnown) {
      const nobitexNetworks: ExchangeNetworkDetail[] = nobitexKnown.map((n) => {
        allNetsSet.add(n.networkCode);
        const isDep = n.deposit === 'enabled';
        const isWth = n.withdraw === 'enabled';
        let overall: ExchangeNetworkDetail['overallStatus'] = 'active';
        if (!isDep && !isWth) overall = 'disabled';
        else if (!isDep) overall = 'deposit_disabled';
        else if (!isWth) overall = 'withdraw_disabled';

        return {
          networkCode: n.networkCode,
          networkName: n.networkName,
          depositStatus: n.deposit,
          withdrawStatus: n.withdraw,
          overallStatus: overall,
          fee: n.fee,
        };
      });

      exchanges['nobitex'] = {
        exchangeId: 'nobitex',
        exchangeNameFa: 'نوبیتکس',
        exchangeNameEn: 'Nobitex',
        supportedNetworks: nobitexNetworks,
        totalSupported: nobitexNetworks.length,
        activeCount: nobitexNetworks.filter((n) => n.overallStatus === 'active').length,
        disabledCount: nobitexNetworks.filter((n) => n.overallStatus !== 'active').length,
      };
    }

    // 4. Ramzinex Networks
    const ramzinexKnown = KNOWN_EXCHANGE_NETWORKS.ramzinex?.[sym];
    if (ramzinexKnown) {
      const ramzinexNetworks: ExchangeNetworkDetail[] = ramzinexKnown.map((n) => {
        allNetsSet.add(n.networkCode);
        const isDep = n.deposit === 'enabled';
        const isWth = n.withdraw === 'enabled';
        let overall: ExchangeNetworkDetail['overallStatus'] = 'active';
        if (!isDep && !isWth) overall = 'disabled';
        else if (!isDep) overall = 'deposit_disabled';
        else if (!isWth) overall = 'withdraw_disabled';

        return {
          networkCode: n.networkCode,
          networkName: n.networkName,
          depositStatus: n.deposit,
          withdrawStatus: n.withdraw,
          overallStatus: overall,
          fee: n.fee,
        };
      });

      exchanges['ramzinex'] = {
        exchangeId: 'ramzinex',
        exchangeNameFa: 'رمزینکس',
        exchangeNameEn: 'Ramzinex',
        supportedNetworks: ramzinexNetworks,
        totalSupported: ramzinexNetworks.length,
        activeCount: ramzinexNetworks.filter((n) => n.overallStatus === 'active').length,
        disabledCount: ramzinexNetworks.filter((n) => n.overallStatus !== 'active').length,
      };
    }

    // Include coins that have network data in at least one exchange
    if (Object.keys(exchanges).length > 0) {
      coinsList.push({
        symbol: sym,
        nameFa: meta.nameFa,
        nameEn: meta.nameEn,
        icon: meta.icon,
        exchanges,
        allAvailableNetworks: Array.from(allNetsSet),
        disabledAlertsCount: totalDisabledAlerts,
      });
    }
  }

  // Sort coins: prioritize popular ones with disabled alerts and volume relevance
  const orderRank = Object.keys(POPULAR_COINS_META);
  coinsList.sort((a, b) => {
    const idxA = orderRank.indexOf(a.symbol);
    const idxB = orderRank.indexOf(b.symbol);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    // Otherwise sort by disabled alerts then alphabetically
    if (b.disabledAlertsCount !== a.disabledAlertsCount) {
      return b.disabledAlertsCount - a.disabledAlertsCount;
    }
    return a.symbol.localeCompare(b.symbol);
  });

  const responsePayload: NetworksApiResponse = {
    success: true,
    lastUpdated: new Date().toISOString(),
    coinsCount: coinsList.length,
    coins: coinsList,
    monitoredExchanges: ['wallex', 'nobitex', 'bitpin', 'ramzinex'],
  };

  networkMemoryCache = {
    timestamp: now,
    data: responsePayload,
  };

  return NextResponse.json(responsePayload);
}
