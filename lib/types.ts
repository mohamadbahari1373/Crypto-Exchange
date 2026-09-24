export type Language = 'fa' | 'en';
export type Theme = 'dark' | 'light';
export type NumberDisplayMode = 'hemat' | 'compact' | 'full';

export interface ExchangeData {
  id: string;
  nameFa: string;
  nameEn: string;
  url: string;
  apiUrl: string;
  model: string;
  modelFa: string;
  totalVolumeToman: number;
  btcVolumeToman: number;
  usdtVolumeToman: number;
  usdtVolumeQty?: number;
  activeMarketsCount: number;
  status: 'live' | 'benchmark' | 'cached';
  rank: number;
  marketSharePercent: number;
  isUserExchange?: boolean;
}

export interface ExchangeCoinStat {
  exchangeId: string;
  volumeToman: number;
  volumeQty: number;
  lastPriceToman?: number;
  marketSharePercent: number;
}

export interface CoinData {
  symbol: string;
  nameFa: string;
  nameEn: string;
  totalVolumeToman: number;
  totalVolumeQty: number;
  lastPriceToman?: number;
  byExchange: Record<string, ExchangeCoinStat>;
  topExchangeId: string;
  wallexSharePercent: number;
}

export interface VolumeApiResponse {
  success: boolean;
  lastUpdated: string;
  grandTotalToman: number;
  exchanges: ExchangeData[];
  coins?: CoinData[];
  cached?: boolean;
  cacheAgeSeconds?: number;
  security: {
    ssrfProtected: boolean;
    protocol: string;
    cacheTtlSeconds: number;
    piiSanitized: boolean;
  };
}

export type NewsCategoryFilter = 'all' | 'exchanges' | 'market';
export type NewsSourceId = 'all' | 'arzdigital' | 'mihansignal' | 'mihanblockchain' | 'cryptopotato' | 'coindesk';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  originalTitle?: string;
  originalSummary?: string;
  isTranslated?: boolean;
  url: string;
  source: 'arzdigital' | 'mihansignal' | 'mihanblockchain' | 'cryptopotato' | 'coindesk';
  sourceNameFa: string;
  sourceNameEn: string;
  category: 'exchanges' | 'market' | 'general';
  categoryFa: string;
  publishedAt: string;
  imageUrl?: string;
  author?: string;
}

export interface NewsApiResponse {
  success: boolean;
  articles: NewsArticle[];
  lastUpdated: string;
  total: number;
  sources: {
    arzdigital: number;
    mihansignal: number;
    mihanblockchain?: number;
    cryptopotato: number;
    coindesk?: number;
  };
  cached?: boolean;
}

export type NetworkTransferStatus = 'active' | 'deposit_disabled' | 'withdraw_disabled' | 'disabled' | 'unknown';

export interface ExchangeNetworkDetail {
  networkCode: string;
  networkName: string;
  networkNameFa?: string;
  depositStatus: 'enabled' | 'disabled' | 'unknown';
  withdrawStatus: 'enabled' | 'disabled' | 'unknown';
  overallStatus: NetworkTransferStatus;
  fee?: number;
  minDeposit?: number | string;
  minWithdraw?: number | string;
  message?: string;
  suggested?: boolean;
}

export interface ExchangeCoinNetworkGroup {
  exchangeId: string;
  exchangeNameFa: string;
  exchangeNameEn: string;
  supportedNetworks: ExchangeNetworkDetail[];
  totalSupported: number;
  activeCount: number;
  disabledCount: number;
}

export interface CoinNetworkData {
  symbol: string;
  nameFa: string;
  nameEn: string;
  icon?: string;
  exchanges: Record<string, ExchangeCoinNetworkGroup>;
  allAvailableNetworks: string[];
  disabledAlertsCount: number;
}

export interface NetworksApiResponse {
  success: boolean;
  lastUpdated: string;
  coinsCount: number;
  coins: CoinNetworkData[];
  monitoredExchanges: string[];
  cached?: boolean;
}

