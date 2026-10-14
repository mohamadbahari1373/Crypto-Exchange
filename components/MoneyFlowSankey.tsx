'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import DidehbonLogo from '@/components/DidehbonLogo';
import UsdtMoneyFlowSankey from '@/components/UsdtMoneyFlowSankey';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Zap,
  ArrowRightLeft,
  Search,
  Info,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  XCircle,
  BarChart3,
  SlidersHorizontal,
  X,
  Flame,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRight,
  Wallet,
  ShieldCheck,
  Compass,
  Sliders,
  Eye,
  Filter,
  ChevronRight,
  Sparkles,
  PieChart,
} from 'lucide-react';
import {
  formatCount,
  formatPercent,
  formatTomanVolume,
  toPersianDigits,
} from '@/lib/formatters';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  ReferenceLine,
} from 'recharts';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface SankeyNode {
  name: string;
  itemStyle?: {
    color?: string;
    borderColor?: string;
    borderWidth?: number;
  };
  depth?: number;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  rawValueQuote?: number;
  quoteCurrency?: string;
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
  priceChange24h?: number;
}

interface RadarCoinItem {
  symbol: string;
  nameFa: string;
  netFlowToman: number;
  inflowToman: number;
  outflowToman: number;
  buyPressurePercent?: number;
  sellPressurePercent?: number;
  priceChange24h?: number;
}

interface MoneyFlowResponse {
  timestamp: number;
  exchange: string;
  usdtPriceToman: number;
  totalTradesParsed: number;
  summary: {
    totalInflowToman: number;
    totalOutflowToman: number;
    netFlowToman: number;
    totalVolumeToman: number;
    overallBuyPressure: number;
    netInflowCoinsCount: number;
    netOutflowCoinsCount: number;
    totalCoinsTracked: number;
  };
  radar?: {
    topInflows: RadarCoinItem[];
    topOutflows: RadarCoinItem[];
  };
  sankey: {
    nodes: SankeyNode[];
    links: SankeyLink[];
  };
  coinStats: CoinFlowStat[];
  isFallback?: boolean;
  warning?: string;
}

function parseMoneyFlowResponse(payload: unknown): MoneyFlowResponse {
  if (typeof payload !== 'object' || payload === null || !('coinStats' in payload) || !Array.isArray(payload.coinStats)) {
    throw new Error('Invalid money flow response: coinStats is missing');
  }

  const response = payload as MoneyFlowResponse;
  const coinStats = response.coinStats.filter(
    (coin) => coin && typeof coin.symbol === 'string'
  );
  const apiRadar = response.radar;
  const topInflows = Array.isArray(apiRadar?.topInflows) && apiRadar.topInflows.length > 0
    ? apiRadar.topInflows
    : [...coinStats]
        .filter((coin) => Number.isFinite(coin.inflowToman) && coin.inflowToman > 0)
        .sort((a, b) => b.netFlowToman - a.netFlowToman || b.inflowToman - a.inflowToman)
        .slice(0, 8);
  const topOutflows = Array.isArray(apiRadar?.topOutflows) && apiRadar.topOutflows.length > 0
    ? apiRadar.topOutflows
    : [...coinStats]
        .filter((coin) => Number.isFinite(coin.outflowToman) && coin.outflowToman > 0)
        .sort((a, b) => a.netFlowToman - b.netFlowToman || b.outflowToman - a.outflowToman)
        .slice(0, 8);

  return {
    ...response,
    coinStats,
    radar: { ...apiRadar, topInflows, topOutflows },
  };
}

interface MoneyFlowSankeyProps {
  isDark: boolean;
  lang: 'fa' | 'en';
}

interface UsdtTmnOrderflow {
  buyVolumeUsdt: number;
  buyVolumeToman: number;
  sellVolumeUsdt: number;
  sellVolumeToman: number;
  totalVolumeToman: number;
  buyPercent: number;
  sellPercent: number;
  netFlowToman: number;
  tradeCount: number;
}

const COIN_PALETTE: Record<string, string> = {
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
};

export default function MoneyFlowSankey({ isDark, lang }: MoneyFlowSankeyProps) {
  const [data, setData] = useState<MoneyFlowResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterCurrency, setFilterCurrency] = useState<'ALL' | 'TMN' | 'USDT'>('ALL');
  const [coinLimit, setCoinLimit] = useState<string>('30');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<'toman' | 'usdt'>('toman');

  // Visualization Mode inside the chart box:
  // 'sankey_clean' = Clean uncluttered Sankey with density control
  // 'bidirectional_bar' = Side-by-side Inflow vs Outflow divergence bars (zero line crossing!)
  // 'matrix_rotation' = Capital migration & market share matrix
  const [chartVisualMode, setChartVisualMode] = useState<'sankey_clean' | 'bidirectional_bar' | 'matrix_rotation'>('sankey_clean');

  // Chart-specific density & solo filters:
  const [sankeyDensity, setSankeyDensity] = useState<'top8' | 'top15' | 'all'>('top8');
  const [sankeyDirection, setSankeyDirection] = useState<'both' | 'inflow_only' | 'outflow_only'>('both');
  const [selectedSoloCoin, setSelectedSoloCoin] = useState<string>('ALL');

  // Search & Filter State for Table & Modal
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'INFLOW' | 'OUTFLOW'>('ALL');
  const [selectedCoinForModal, setSelectedCoinForModal] = useState<CoinFlowStat | null>(null);

  // Live WebSocket state from official Wallex docs (wss://api.wallex.ir/ws)
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [recentLiveTrades, setRecentLiveTrades] = useState<Array<{
    symbol: string;
    price: number;
    qty: number;
    isBuy: boolean;
    time: string;
  }>>([]);
  const [usdtTmnOrderflow, setUsdtTmnOrderflow] = useState<UsdtTmnOrderflow | null>(null);
  const [orderflowLoading, setOrderflowLoading] = useState<boolean>(true);
  const [orderflowError, setOrderflowError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ currency: filterCurrency, limit: coinLimit });
      const res = await fetch(`/api/money-flow.php?${query.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json: unknown = await res.json();
      setData(parseMoneyFlowResponse(json));
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Failed to fetch Wallex money flow:', e);
    } finally {
      setLoading(false);
    }
  }, [filterCurrency, coinLimit]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const query = new URLSearchParams({ currency: filterCurrency, limit: coinLimit });
        const res = await fetch(`/api/money-flow.php?${query.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json: unknown = await res.json();
        if (isMounted) {
          setData(parseMoneyFlowResponse(json));
          setLastUpdated(new Date());
        }
      } catch (e) {
        console.error('Failed to load money flow:', e);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [filterCurrency, coinLimit]);

  // Auto refresh stream every 20 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData();
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  useEffect(() => {
    let isMounted = true;
    let activeController: AbortController | null = null;

    const fetchOrderflow = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      try {
        const response = await fetch('/api/wallex_trades.php', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload: unknown = await response.json();
        if (typeof payload !== 'object' || payload === null || !('result' in payload)) {
          throw new Error('Invalid Wallex trades response');
        }
        const result = payload.result;
        if (typeof result !== 'object' || result === null || !('latestTrades' in result) || !Array.isArray(result.latestTrades)) {
          throw new Error('Wallex trades response did not include latestTrades');
        }

        let buyVolumeUsdt = 0;
        let buyVolumeToman = 0;
        let sellVolumeUsdt = 0;
        let sellVolumeToman = 0;
        let tradeCount = 0;

        for (const item of result.latestTrades) {
          if (typeof item !== 'object' || item === null) continue;
          const trade = item as Record<string, unknown>;
          const quantity = Number(trade.quantity);
          const price = Number(trade.price);
          const sum = Number(trade.sum);
          if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity < 0 || price < 0) continue;
          const tomanValue = Number.isFinite(sum) ? sum : quantity * price;
          if (trade.isBuyOrder === true) {
            buyVolumeUsdt += quantity;
            buyVolumeToman += tomanValue;
          } else if (trade.isBuyOrder === false) {
            sellVolumeUsdt += quantity;
            sellVolumeToman += tomanValue;
          } else {
            continue;
          }
          tradeCount += 1;
        }

        const totalVolumeToman = buyVolumeToman + sellVolumeToman;
        const buyPercent = totalVolumeToman > 0 ? (buyVolumeToman / totalVolumeToman) * 100 : 0;
        const sellPercent = totalVolumeToman > 0 ? (sellVolumeToman / totalVolumeToman) * 100 : 0;
        if (isMounted) {
          setUsdtTmnOrderflow({
            buyVolumeUsdt,
            buyVolumeToman,
            sellVolumeUsdt,
            sellVolumeToman,
            totalVolumeToman,
            buyPercent,
            sellPercent,
            netFlowToman: buyVolumeToman - sellVolumeToman,
            tradeCount,
          });
          setOrderflowError(null);
        }
      } catch (error) {
        if (isMounted && !(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Failed to fetch Wallex USDT/TMN trades:', error);
          setOrderflowError(lang === 'fa' ? 'دریافت معاملات زنده ناموفق بود.' : 'Unable to load live trades.');
        }
      } finally {
        if (isMounted) setOrderflowLoading(false);
      }
    };

    void fetchOrderflow();
    const interval = setInterval(() => void fetchOrderflow(), 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
      activeController?.abort();
    };
  }, [lang]);

  // Connect to official Wallex WebSocket (wss://api.wallex.ir/ws) for real-time live price & trade streams
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        ws = new WebSocket('wss://api.wallex.ir/ws');

        ws.onopen = () => {
          setWsConnected(true);
          // 1. Subscribe to all@price for all market live prices (Screenshot 4)
          ws?.send(JSON.stringify(['subscribe', { channel: 'all@price' }]));

          // 2. Subscribe to major market live trades (Screenshot 1)
          const channels = [
            'USDTTMN@trade', 'BTCTMN@trade', 'BTCUSDT@trade',
            'GRAMTMN@trade', 'GRAMUSDT@trade',
            'ETHTMN@trade', 'ETHUSDT@trade',
            'SOLTMN@trade', 'SOLUSDT@trade',
            'DOGETMN@trade', 'XRPUSDT@trade',
          ];
          for (const ch of channels) {
            ws?.send(JSON.stringify(['subscribe', { channel: ch }]));
          }
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (Array.isArray(parsed) && parsed.length >= 2) {
              const [channel, payload] = parsed;

              // Channel all@price: update coin price instantly
              if (channel === 'all@price' && payload?.symbol && payload?.price) {
                const sym = payload.symbol.replace(/TMN$|IRT$|USDT$/, '');
                const cleanSym = (sym === 'TON' || sym === 'TONCOIN') ? 'GRAM' : sym;
                const newPrice = parseFloat(payload.price);
                const newCh = typeof payload['24h_ch'] === 'number' ? payload['24h_ch'] : parseFloat(payload['24h_ch'] || '0');

                if (!isNaN(newPrice) && newPrice > 0) {
                  setData((prev) => {
                    if (!prev) return prev;
                    const updatedCoinStats = prev.coinStats.map((coin) => {
                      if (coin.symbol === cleanSym) {
                        return {
                          ...coin,
                          lastPriceToman: payload.symbol.endsWith('TMN') || payload.symbol.endsWith('IRT')
                            ? newPrice
                            : Math.round(newPrice * (prev.usdtPriceToman || 234600)),
                          priceChange24h: !isNaN(newCh) ? newCh : coin.priceChange24h,
                        };
                      }
                      return coin;
                    });
                    return { ...prev, coinStats: updatedCoinStats };
                  });
                }
              }

              // Channel @trade: real executed trades with isBuyOrder (Screenshot 1)
              if (typeof channel === 'string' && channel.endsWith('@trade') && payload) {
                const isBuy = Boolean(payload.isBuyOrder);
                const tradePrice = parseFloat(payload.price || '0');
                const tradeQty = parseFloat(payload.quantity || '0');
                const tradeSymbol = payload.symbol || channel.replace('@trade', '');

                if (tradePrice > 0 && tradeQty > 0) {
                  setRecentLiveTrades((prev) => [
                    {
                      symbol: tradeSymbol,
                      price: tradePrice,
                      qty: tradeQty,
                      isBuy,
                      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    },
                    ...prev.slice(0, 9),
                  ]);
                }
              }
            }
          } catch {
            // Ignore non-json frames
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWs, 4000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWs();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Formatting helpers
  const formatToman = useCallback((num: number) => {
    const absVal = Math.abs(num);
    if (absVal >= 1_000_000_000_000) {
      return (num / 1_000_000_000_000).toFixed(2) + (lang === 'fa' ? ' همت' : 'T TMN');
    }
    if (absVal >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(2) + (lang === 'fa' ? ' میلیارد ت' : 'B TMN');
    }
    if (absVal >= 1_000_000) {
      return (num / 1_000_000).toFixed(1) + (lang === 'fa' ? ' م ت' : 'M TMN');
    }
    return new Intl.NumberFormat('en-US').format(Math.round(num)) + (lang === 'fa' ? ' تومان' : ' TMN');
  }, [lang]);

  const formatUsdt = useCallback((num: number) => {
    const absVal = Math.abs(num);
    if (absVal >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
    }
    if (absVal >= 1_000) {
      return `$${(num / 1_000).toFixed(1)}K`;
    }
    return `$${Math.round(num).toLocaleString()}`;
  }, []);

  // Filtered Coins for Table
  const filteredCoins = useMemo(() => {
    if (!data?.coinStats) return [];
    let list = data.coinStats;

    if (statusFilter === 'INFLOW') {
      list = list.filter((c) => c.flowStatus === 'NET_INFLOW');
    } else if (statusFilter === 'OUTFLOW') {
      list = list.filter((c) => c.flowStatus === 'NET_OUTFLOW');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.symbol.toLowerCase().includes(q) ||
          c.nameFa.toLowerCase().includes(q)
      );
    }

    return list;
  }, [data, statusFilter, searchQuery]);

  // Major spotlight coins: BTC and ETH specifically
  const btcStat = useMemo(() => data?.coinStats.find((c) => c.symbol === 'BTC'), [data]);
  const ethStat = useMemo(() => data?.coinStats.find((c) => c.symbol === 'ETH'), [data]);

  // List of top coins for quick solo filtering
  const topCoinsForFilter = useMemo(() => {
    if (!data?.coinStats) return [];
    return data.coinStats.slice(0, 8);
  }, [data]);

  // --------------------------------------------------------------------------
  // CLEAN & CRYSTAL SANKEY GRAPH CONFIGURATION
  // --------------------------------------------------------------------------
  const cleanSankeyOption = useMemo(() => {
    if (!data?.coinStats || !data?.sankey) return {};

    const allStats = data.coinStats;
    let allowedSymbols: string[] = [];

    if (selectedSoloCoin !== 'ALL') {
      allowedSymbols = [selectedSoloCoin];
    } else if (sankeyDensity === 'top8') {
      allowedSymbols = allStats.slice(0, 8).map((c) => c.symbol);
    } else if (sankeyDensity === 'top15') {
      allowedSymbols = allStats.slice(0, 15).map((c) => c.symbol);
    } else {
      allowedSymbols = allStats.slice(0, 25).map((c) => c.symbol);
    }

    const symbolSet = new Set(allowedSymbols);

    // Build focused links
    let rawLinks = data.sankey.links || [];
    let focusedLinks = rawLinks.filter((l) => {
      const isSrcCoin = symbolSet.has(l.source);
      const isTgtCoin = symbolSet.has(l.target);
      return isSrcCoin || isTgtCoin;
    });

    if (sankeyDirection === 'inflow_only') {
      focusedLinks = focusedLinks.filter((l) => l.source.includes('ورود'));
    } else if (sankeyDirection === 'outflow_only') {
      focusedLinks = focusedLinks.filter((l) => l.target.includes('خروج'));
    }

    // Identify active nodes
    const activeNodesSet = new Set<string>();
    focusedLinks.forEach((l) => {
      activeNodesSet.add(l.source);
      activeNodesSet.add(l.target);
    });

    const nodes = Array.from(activeNodesSet).map((name) => {
      const isSource = name.includes('ورود');
      const isSink = name.includes('خروج');
      let color = COIN_PALETTE[name] || '#3B82F6';

      let depth = 1;
      if (isSource) {
        depth = 0;
        color = name.includes('تومان') ? '#10B981' : '#06B6D4';
      } else if (isSink) {
        depth = 2;
        color = name.includes('تومان') ? '#EF4444' : '#F43F5E';
      }

      return {
        name,
        depth,
        itemStyle: {
          color,
          borderColor: isDark ? '#0F172A' : '#FFFFFF',
          borderWidth: 2,
          shadowBlur: 8,
          shadowColor: color + '40',
        },
        label: {
          color: isDark ? '#F8FAFC' : '#0F172A',
          fontWeight: 700,
          fontSize: 12,
          fontFamily: 'inherit',
          padding: [0, 4],
        },
      };
    });

    const links = focusedLinks.map((link) => {
      const isBuying = link.source.includes('ورود');
      const val = activeViewMode === 'toman' ? link.value : link.value / (data.usdtPriceToman || 234600);

      return {
        source: link.source,
        target: link.target,
        value: Math.max(1, Math.round(val)),
        lineStyle: {
          color: isBuying
            ? 'rgba(16, 185, 129, 0.42)'
            : 'rgba(239, 68, 68, 0.42)',
          curveness: 0.5,
        },
      };
    });

    return {
      backgroundColor: 'transparent',
      animationDuration: 500,
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
        borderColor: isDark ? '#334155' : '#CBD5E1',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        textStyle: {
          color: isDark ? '#F8FAFC' : '#0F172A',
          fontSize: 12,
          fontFamily: 'inherit',
        },
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            const isSource = params.name.includes('ورود');
            const isSink = params.name.includes('خروج');
            const stat = allStats.find((c) => c.symbol === params.name);

            if (isSource) {
              return `
                <div style="direction:rtl;text-align:right;">
                  <div style="font-weight:bold;color:#10B981;margin-bottom:4px;">🟢 منبع تزریق نقدینگی خریداران</div>
                  <div><b>${params.name}</b></div>
                  <div style="font-size:11px;color:#94A3B8;margin-top:2px;">جریان خرید تیکر در بازارهای والکس</div>
                </div>
              `;
            }
            if (isSink) {
              return `
                <div style="direction:rtl;text-align:right;">
                  <div style="font-weight:bold;color:#EF4444;margin-bottom:4px;">🔴 مقصد نقد کردن و خروج دارایی</div>
                  <div><b>${params.name}</b></div>
                  <div style="font-size:11px;color:#94A3B8;margin-top:2px;">جریان فروش تیکر به تومان یا تتر</div>
                </div>
              `;
            }
            if (stat) {
              return `
                <div style="direction:rtl;text-align:right;min-width:180px;">
                  <div style="font-weight:bold;display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                    <span style="color:#3B82F6;">${stat.symbol}</span> - <span>${stat.nameFa}</span>
                  </div>
                  <div style="font-size:11px;margin-bottom:2px;">قیمت: ${formatToman(stat.lastPriceToman)}</div>
                  <div style="color:#10B981;font-size:11px;">ورود: ${formatToman(stat.inflowToman)}</div>
                  <div style="color:#EF4444;font-size:11px;">خروج: ${formatToman(stat.outflowToman)}</div>
                  <div style="font-weight:bold;margin-top:4px;color:${stat.netFlowToman >= 0 ? '#10B981' : '#EF4444'};">
                    خالص: ${stat.netFlowToman >= 0 ? '+' : ''}${formatToman(stat.netFlowToman)}
                  </div>
                </div>
              `;
            }
          } else if (params.dataType === 'edge') {
            const isBuy = params.data.source.includes('ورود');
            const valTmn = activeViewMode === 'toman' ? params.value : params.value * (data.usdtPriceToman || 234600);
            const valUsdt = valTmn / (data.usdtPriceToman || 234600);

            return `
              <div style="direction:rtl;text-align:right;min-width:190px;">
                <div style="font-weight:bold;margin-bottom:4px;color:${isBuy ? '#10B981' : '#EF4444'};">
                  ${isBuy ? '🟢 مسیر ورود سرمایه (خرید)' : '🔴 مسیر خروج سرمایه (فروش)'}
                </div>
                <div style="font-size:11px;color:#94A3B8;">${params.data.source} ➔ ${params.data.target}</div>
                <div style="margin-top:6px;font-size:12px;font-weight:bold;">حجم انتقال: ${formatToman(valTmn)}</div>
                <div style="font-size:11px;color:#94A3B8;">معادل دلاری: ${formatUsdt(valUsdt)}</div>
              </div>
            `;
          }
          return '';
        },
      },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          emphasis: {
            focus: 'adjacency',
            itemStyle: {
              shadowBlur: 14,
            },
            lineStyle: {
              opacity: 0.9,
            },
          },
          nodeWidth: 26,
          nodeGap: 24,
          layoutIterations: 64,
          draggable: true,
          orient: 'horizontal',
          levels: [
            {
              depth: 0,
              itemStyle: { color: '#10B981' },
              lineStyle: { color: 'source', opacity: 0.38 },
            },
            {
              depth: 1,
              lineStyle: { color: 'source', opacity: 0.38 },
            },
            {
              depth: 2,
              itemStyle: { color: '#EF4444' },
              lineStyle: { color: 'source', opacity: 0.38 },
            },
          ],
          data: nodes,
          links: links,
          lineStyle: {
            curveness: 0.5,
          },
          label: {
            position: 'right',
            formatter: '{b}',
          },
        },
      ],
    };
  }, [
    data,
    sankeyDensity,
    sankeyDirection,
    selectedSoloCoin,
    activeViewMode,
    isDark,
    formatToman,
    formatUsdt,
  ]);

  // --------------------------------------------------------------------------
  // BI-DIRECTIONAL NET DIVERGENCE CHART DATA (صفر تداخل و خطوط تودرتو)
  // --------------------------------------------------------------------------
  const biDirectionalBarData = useMemo(() => {
    if (!data?.coinStats) return [];
    let list = data.coinStats;

    if (selectedSoloCoin !== 'ALL') {
      list = list.filter((c) => c.symbol === selectedSoloCoin);
    } else if (sankeyDensity === 'top8') {
      list = list.slice(0, 8);
    } else if (sankeyDensity === 'top15') {
      list = list.slice(0, 15);
    } else {
      list = list.slice(0, 25);
    }

    return list.map((coin) => ({
      symbol: coin.symbol,
      nameFa: coin.nameFa,
      inflowToman: coin.inflowToman,
      outflowToman: -coin.outflowToman, // Negative for left side
      outflowPositive: coin.outflowToman,
      netFlowToman: coin.netFlowToman,
      buyPressure: coin.buyPressurePercent,
      sellPressure: coin.sellPressurePercent,
      displayInflow: activeViewMode === 'toman' ? coin.inflowToman : coin.inflowUsdt,
      displayOutflow: activeViewMode === 'toman' ? -coin.outflowToman : -coin.outflowUsdt,
      displayNet: activeViewMode === 'toman' ? coin.netFlowToman : coin.netFlowUsdt,
    }));
  }, [data, selectedSoloCoin, sankeyDensity, activeViewMode]);

  return (
    <div className={`w-full transition-colors duration-200 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* 1. Header & Quick Controls */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <DidehbonLogo size="sm" showText={false} withGlow={true} />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex h-3 w-3 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2 text-white">
                <Compass className="w-5 h-5 text-blue-400" />
                {lang === 'fa' ? 'رادار جریان ورود و خروج نقدینگی' : 'Real-Time Money Flow Radar'}
              </h2>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-cyan-400 border border-blue-500/20">
                didehbon.ir
              </span>
            </div>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live USDT Price pill */}
          {data?.usdtPriceToman && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 shadow-sm">
              <span className="text-emerald-400 font-bold">تتر زنده والکس:</span>
              <span className="font-mono font-bold">{data.usdtPriceToman.toLocaleString('en-US')} تومان</span>
            </div>
          )}

          {/* Currency Filter */}
          <div className="flex bg-slate-900/90 p-1 rounded-xl text-xs font-semibold border border-slate-700/80 shadow-lg">
            <button
              onClick={() => setFilterCurrency('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterCurrency === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {lang === 'fa' ? 'همه بازارها' : 'All Markets'}
            </button>
            <button
              onClick={() => setFilterCurrency('TMN')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterCurrency === 'TMN'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {lang === 'fa' ? 'فقط تومانی (TMN)' : 'Toman Only'}
            </button>
            <button
              onClick={() => setFilterCurrency('USDT')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterCurrency === 'USDT'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {lang === 'fa' ? 'فقط تتری (USDT)' : 'USDT Only'}
            </button>
          </div>

          {/* Unit Toggle */}
          <div className="flex bg-slate-900/90 p-1 rounded-xl text-xs font-semibold border border-slate-700/80 shadow-lg">
            <button
              onClick={() => setActiveViewMode('toman')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeViewMode === 'toman'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              تومان
            </button>
            <button
              onClick={() => setActiveViewMode('usdt')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeViewMode === 'usdt'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              USDT
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white px-3.5 py-2 rounded-xl text-xs font-medium transition-all shadow-lg cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? (lang === 'fa' ? 'در حال دریافت...' : 'Fetching...') : (lang === 'fa' ? 'بروزرسانی' : 'Refresh')}</span>
          </button>
        </div>
      </div>

      {/* Live Trades Stream from Wallex WebSocket (Screenshot 1: wss://api.wallex.ir/ws MARKET@trade) */}
      {recentLiveTrades.length > 0 && (
        <div className="mb-6 p-3 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold text-slate-300">
                {lang === 'fa' ? 'جریان معاملات لحظه‌ای والکس (Live WebSocket Feed)' : 'Live Executed Trades Stream (Wallex WS)'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {lang === 'fa' ? 'کانال‌های مشترک: trade@' : 'Subscribed to @trade channels'}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {recentLiveTrades.map((tr, idx) => {
              const cleanSym = tr.symbol.replace(/TMN$|IRT$|USDT$/, '');
              const displaySym = (cleanSym === 'TON' || cleanSym === 'TONCOIN') ? 'GRAM' : cleanSym;
              const isTmn = tr.symbol.endsWith('TMN') || tr.symbol.endsWith('IRT');

              return (
                <div
                  key={`${tr.symbol}-${tr.time}-${idx}`}
                  className={`flex-shrink-0 flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all ${
                    tr.isBuy
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                  }`}
                >
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    tr.isBuy ? 'bg-emerald-800/60 text-emerald-200' : 'bg-rose-800/60 text-rose-200'
                  }`}>
                    {tr.isBuy ? (lang === 'fa' ? 'خرید' : 'BUY') : (lang === 'fa' ? 'فروش' : 'SELL')}
                  </span>
                  <span className="font-bold text-slate-200">{displaySym}</span>
                  <span className="text-slate-300">
                    {tr.price >= 1000 ? Math.round(tr.price).toLocaleString('en-US') : tr.price} {isTmn ? 'ت' : '$'}
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    ({tr.qty.toFixed(tr.qty < 1 ? 4 : 2)})
                  </span>
                  <span className="text-slate-500 text-[10px]">{tr.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section
        aria-live="polite"
        className="mb-6 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-4 sm:p-5 text-white shadow-xl"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-100">
            تحلیل زنده خرید و فروش تتر/تومان در والکس (ورود و خروج نقدینگی)
          </h3>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/60 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {orderflowLoading
              ? (lang === 'fa' ? 'در حال دریافت...' : 'Loading...')
              : (lang === 'fa' ? 'به‌روزرسانی هر ۱۲ ثانیه' : 'Refreshes every 12 seconds')}
          </span>
        </div>

        {orderflowError && (
          <p role="status" className="mb-3 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            {orderflowError}
          </p>
        )}

        {usdtTmnOrderflow ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-3.5">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-300">
                  <ArrowDownRight className="h-4 w-4" />
                  خرید فعال تتر (ورود نقدینگی)
                </div>
                <p className="text-lg font-black text-white">
                  {formatTomanVolume(usdtTmnOrderflow.buyVolumeToman, 'hemat', lang)}
                </p>
                <p className="mt-1 text-xs text-emerald-200/80">
                  {lang === 'fa'
                    ? toPersianDigits(usdtTmnOrderflow.buyVolumeUsdt.toLocaleString('en-US', { maximumFractionDigits: 2 }))
                    : usdtTmnOrderflow.buyVolumeUsdt.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDT
                </p>
              </div>
              <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 p-3.5">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-300">
                  <ArrowUpRight className="h-4 w-4" />
                  فروش فعال تتر (خروج نقدینگی)
                </div>
                <p className="text-lg font-black text-white">
                  {formatTomanVolume(usdtTmnOrderflow.sellVolumeToman, 'hemat', lang)}
                </p>
                <p className="mt-1 text-xs text-rose-200/80">
                  {lang === 'fa'
                    ? toPersianDigits(usdtTmnOrderflow.sellVolumeUsdt.toLocaleString('en-US', { maximumFractionDigits: 2 }))
                    : usdtTmnOrderflow.sellVolumeUsdt.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDT
                </p>
              </div>
            </div>

            <div className={`my-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-center ${
              usdtTmnOrderflow.netFlowToman >= 0
                ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300'
                : 'border-rose-800/60 bg-rose-950/30 text-rose-300'
            }`}>
              {usdtTmnOrderflow.netFlowToman >= 0
                ? <ArrowDownRight className="h-4 w-4" />
                : <ArrowUpRight className="h-4 w-4" />}
              <span className="text-xs sm:text-sm font-bold">
                {usdtTmnOrderflow.netFlowToman >= 0
                  ? `+${formatTomanVolume(usdtTmnOrderflow.netFlowToman, 'compact', lang)} ورود خالص تتر`
                  : `${formatTomanVolume(Math.abs(usdtTmnOrderflow.netFlowToman), 'compact', lang)} خروج خالص تتر`}
              </span>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300">
                  خرید {formatPercent(usdtTmnOrderflow.buyPercent, lang)}
                </span>
                <span className="font-semibold text-rose-300">
                  فروش {formatPercent(usdtTmnOrderflow.sellPercent, lang)}
                </span>
              </div>
              <div
                className="flex h-2.5 overflow-hidden rounded-full bg-rose-500/80"
                role="img"
                aria-label={`Buy ${formatPercent(usdtTmnOrderflow.buyPercent, lang)}, sell ${formatPercent(usdtTmnOrderflow.sellPercent, lang)}`}
              >
                <div
                  className="h-full bg-emerald-500 transition-[width] duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, usdtTmnOrderflow.buyPercent))}%` }}
                />
              </div>
              <div className="mt-2 text-right text-[10px] text-slate-500">
                {lang === 'fa' ? 'تعداد معاملات بررسی‌شده:' : 'Trades analyzed:'} {formatCount(usdtTmnOrderflow.tradeCount, lang)}
              </div>
            </div>
            <UsdtMoneyFlowSankey
              buyVolumeToman={usdtTmnOrderflow.buyVolumeToman}
              sellVolumeToman={usdtTmnOrderflow.sellVolumeToman}
              isDark={isDark}
              lang={lang}
            />
          </>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-5 text-center text-xs text-slate-400">
            {orderflowLoading
              ? (lang === 'fa' ? 'در حال بارگذاری داده معاملات...' : 'Loading trade data...')
              : orderflowError || (lang === 'fa' ? 'داده‌ای برای نمایش وجود ندارد.' : 'No trade data available.')}
          </div>
        )}
      </section>

      {data?.isFallback && (
        <div role="status" className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          {lang === 'fa'
            ? 'داده زنده والکس در دسترس نیست؛ آخرین داده ذخیره‌شده نمایش داده می‌شود.'
            : 'Live Wallex data is unavailable; showing the last cached snapshot.'}
        </div>
      )}

      {/* 2. AT-A-GLANCE RADAR: پول الان داره از کجا خارج میشه و وارد چه ارزی میشه؟ */}
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-5 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
            <h3 className="font-extrabold text-base tracking-wide text-amber-300">
              {lang === 'fa' ? 'در یک نگاه: پول الان در والکس از کجا خارج و وارد چه ارزی می‌شود؟' : 'Capital Movement Vector: Exit Points vs Entry Targets'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full">
            {lang === 'fa' ? `نرخ تتر مبنا: ${formatToman(data?.usdtPriceToman || 234600)}` : `USDT Rate: ${formatToman(data?.usdtPriceToman || 234600)}`}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Left Column: Top Outflows (خروج پول از کجا؟) */}
          <div className="lg:col-span-5 bg-rose-950/30 border border-rose-900/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-rose-900/40">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-rose-300">
                  {lang === 'fa' ? '🔴 بیشترین خروج پول (فروش سنگین)' : 'Top Capital Exits (Selling)'}
                </span>
              </div>
              <span className="text-[10px] text-rose-400/80 font-mono">خالص خروج</span>
            </div>

            <div className="space-y-2.5">
              {data?.radar?.topOutflows && data.radar.topOutflows.length > 0 ? (
                data.radar.topOutflows.slice(0, 4).map((coin) => (
                  <div
                    key={coin.symbol}
                    onClick={() => {
                      setSelectedSoloCoin(coin.symbol);
                    }}
                    className="flex items-center justify-between bg-slate-900/80 hover:bg-slate-850 p-2 rounded-lg border border-rose-900/30 cursor-pointer transition-all hover:border-rose-500/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-200">{coin.symbol}</span>
                      <span className="text-xs text-slate-400">{coin.nameFa}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-rose-400 font-mono">
                        -{activeViewMode === 'toman' ? formatToman(coin.netFlowToman) : formatUsdt(coin.netFlowToman / (data?.usdtPriceToman || 234600))}
                      </div>
                      <div className="text-[10px] text-rose-500/80">
                        {coin.sellPressurePercent?.toFixed(0)}٪ فشار فروش
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 py-2 text-center">
                  {data?.isFallback
                    ? (lang === 'fa' ? 'داده زنده بازار فعلاً در دسترس نیست.' : 'Live market data is currently unavailable.')
                    : (lang === 'fa' ? 'داده‌ای برای این فیلتر پیدا نشد.' : 'No market data found for this filter.')}
                </div>
              )}
            </div>
          </div>

          {/* Middle: The Capital Flow Vector */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center p-2 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 mb-2">
              <ArrowRightLeft className="w-6 h-6 text-blue-400 animate-pulse" />
            </div>
            <span className="text-xs font-black text-slate-300 mb-1">چرخش سرمایه</span>
            <span className="text-[10px] text-slate-500 leading-tight">
              انتقال نقدینگی از ارزهای تحت فروش به بازارهای مستعد رشد
            </span>
          </div>

          {/* Right Column: Top Inflows (ورود پول به چه ارزی؟) */}
          <div className="lg:col-span-5 bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-900/40">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-300">
                  {lang === 'fa' ? '🟢 بیشترین ورود پول (خرید قدرتمند)' : 'Top Capital Inflows (Buying)'}
                </span>
              </div>
              <span className="text-[10px] text-emerald-400/80 font-mono">خالص ورود</span>
            </div>

            <div className="space-y-2.5">
              {data?.radar?.topInflows && data.radar.topInflows.length > 0 ? (
                data.radar.topInflows.slice(0, 4).map((coin) => (
                  <div
                    key={coin.symbol}
                    onClick={() => {
                      setSelectedSoloCoin(coin.symbol);
                    }}
                    className="flex items-center justify-between bg-slate-900/80 hover:bg-slate-850 p-2 rounded-lg border border-emerald-900/30 cursor-pointer transition-all hover:border-emerald-500/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-200">{coin.symbol}</span>
                      <span className="text-xs text-slate-400">{coin.nameFa}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-400 font-mono">
                        +{activeViewMode === 'toman' ? formatToman(coin.netFlowToman) : formatUsdt(coin.netFlowToman / (data?.usdtPriceToman || 234600))}
                      </div>
                      <div className="text-[10px] text-emerald-500/80">
                        {coin.buyPressurePercent?.toFixed(0)}٪ برتری خرید
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 py-2 text-center">
                  {data?.isFallback
                    ? (lang === 'fa' ? 'داده زنده بازار فعلاً در دسترس نیست.' : 'Live market data is currently unavailable.')
                    : (lang === 'fa' ? 'داده‌ای برای این فیلتر پیدا نشد.' : 'No market data found for this filter.')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. THE INTERACTIVE MONEY FLOW VISUALIZER WITH 3 UNCLUTTERED MODES */}
      <div className="mb-6 rounded-2xl p-5 border border-slate-800 bg-slate-900/90 shadow-2xl text-slate-100 backdrop-blur-xl">
        {/* Top Header of Chart with Mode Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 border-b border-slate-800/90 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-5 h-5 text-indigo-400" />
              <h3 className="font-extrabold text-base text-white">
                {lang === 'fa' ? 'نقشه و نمودار بصری جریان انتقال نقدینگی' : 'Visual Liquidity Flow Dynamics'}
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              {lang === 'fa'
                ? 'نمای تفکیک‌شده و بدون تداخل خطوط برای تحلیل آسان ورود و خروج پول'
                : 'Clutter-free and categorized views for effortless capital inflow and outflow analysis'}
            </p>
          </div>

          {/* View Mode Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setChartVisualMode('sankey_clean')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                chartVisualMode === 'sankey_clean'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>جریان آبشاری (Sankey خلوت)</span>
            </button>
            <button
              onClick={() => setChartVisualMode('bidirectional_bar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                chartVisualMode === 'bidirectional_bar'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>ترازنامه دوطرفه (بسیار شفاف)</span>
            </button>
            <button
              onClick={() => setChartVisualMode('matrix_rotation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                chartVisualMode === 'matrix_rotation'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>ماتریس چرخش سرمایه</span>
            </button>
          </div>
        </div>

        {/* Filter Bar & Controls for the Visualizer */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-4">
          {/* Density / Coin Limit Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 flex items-center gap-1 text-[11px] font-medium">
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              تراکم ارزها:
            </span>
            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700/60">
              <button
                onClick={() => setSankeyDensity('top8')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  sankeyDensity === 'top8'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ۸ لیدر اصلی (کاملاً خلوت و شفاف)
              </button>
              <button
                onClick={() => setSankeyDensity('top15')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  sankeyDensity === 'top15'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ۱۵ ارز برتر
              </button>
              <button
                onClick={() => setSankeyDensity('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  sankeyDensity === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                نمایش کامل (۲۵+)
              </button>
            </div>
          </div>

          {/* Flow Direction (Only for Sankey) */}
          {chartVisualMode === 'sankey_clean' && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 text-[11px] font-medium">جهت جریان:</span>
              <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700/60">
                <button
                  onClick={() => setSankeyDirection('both')}
                  className={`px-2 py-1 rounded-md text-xs font-medium ${
                    sankeyDirection === 'both' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ورود و خروج کامل
                </button>
                <button
                  onClick={() => setSankeyDirection('inflow_only')}
                  className={`px-2 py-1 rounded-md text-xs font-medium ${
                    sankeyDirection === 'inflow_only' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-emerald-200'
                  }`}
                >
                  فقط ورود 🟢
                </button>
                <button
                  onClick={() => setSankeyDirection('outflow_only')}
                  className={`px-2 py-1 rounded-md text-xs font-medium ${
                    sankeyDirection === 'outflow_only' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:text-rose-200'
                  }`}
                >
                  فقط خروج 🔴
                </button>
              </div>
            </div>
          )}

          {/* Solo Coin Isolator */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] font-medium">ایزوله کردن ارز:</span>
            <select
              value={selectedSoloCoin}
              onChange={(e) => setSelectedSoloCoin(e.target.value)}
              className="bg-slate-900 text-slate-200 border border-slate-700/80 text-xs rounded-lg px-2.5 py-1 font-medium outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">همه رمزارزها (تجمیعی)</option>
              {topCoinsForFilter.map((c) => (
                <option key={c.symbol} value={c.symbol}>
                  {c.symbol} ({c.nameFa})
                </option>
              ))}
            </select>
            {selectedSoloCoin !== 'ALL' && (
              <button
                onClick={() => setSelectedSoloCoin('ALL')}
                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-rose-300 px-2 py-1 rounded-md border border-slate-700"
              >
                حذف فیلتر
              </button>
            )}
          </div>
        </div>

        {/* --- VIEW 1: CLEAN SANKEY FLOW --- */}
        {chartVisualMode === 'sankey_clean' && (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>ستون چپ: منابع ورود نقدینگی خریداران</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span>ستون وسط: رمزارزهای والکس (امکان جابجایی با درگ موس)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>ستون راست: مقاصد خروج دارایی فروشندگان</span>
              </div>
            </div>

            <div className="w-full h-[520px] bg-slate-950/40 rounded-xl p-2 border border-slate-800/60 relative">
              {data?.sankey ? (
                <ReactECharts
                  option={cleanSankeyOption}
                  style={{ height: '100%', width: '100%' }}
                  opts={{ renderer: 'svg' }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
                  در حال ترسیم جریان نقدینگی...
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-2">
              <span>💡 با قرار دادن موس روی هر رمزارز، مسیرهای اختصاصی آن هایلایت می‌شوند.</span>
              <span>تعداد رمزارزهای در حال نمایش: {sankeyDensity === 'top8' ? '۸ لیدر بازار' : sankeyDensity === 'top15' ? '۱۵ ارز برتر' : 'نمایش کامل'}</span>
            </div>
          </div>
        )}

        {/* --- VIEW 2: BI-DIRECTIONAL NET CASH FLOW (DIVERGENCE BARS) --- */}
        {chartVisualMode === 'bidirectional_bar' && (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <ArrowDownRight className="w-4 h-4" />
                <span>خروج نقدینگی / فروش (سمت چپ 🔴)</span>
              </div>
              <div className="text-center font-bold text-slate-300">
                <span>ترازنامه بلادرنگ ورود در برابر خروج نقدینگی</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <span>ورود نقدینگی / خرید (سمت راست 🟢)</span>
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <div className="w-full h-[520px] bg-slate-950/40 rounded-xl p-4 border border-slate-800/60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={biDirectionalBarData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                >
                  <XAxis
                    type="number"
                    stroke="#64748B"
                    tickFormatter={(val) => {
                      const abs = Math.abs(val);
                      if (activeViewMode === 'toman') {
                        if (abs >= 1e12) return `${(abs / 1e12).toFixed(1)}T`;
                        if (abs >= 1e9) return `${(abs / 1e9).toFixed(0)}B`;
                        if (abs >= 1e6) return `${(abs / 1e6).toFixed(0)}M`;
                      } else {
                        if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
                        if (abs >= 1e3) return `$${(abs / 1e3).toFixed(0)}K`;
                      }
                      return `${abs}`;
                    }}
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="symbol"
                    stroke="#64748B"
                    width={70}
                    tick={{ fill: '#F8FAFC', fontSize: 12, fontWeight: 'bold' }}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs text-right font-sans min-w-[200px]">
                            <div className="font-bold text-white text-sm mb-1 flex items-center justify-between border-b border-slate-800 pb-1">
                              <span className="text-blue-400 font-mono">{item.symbol}</span>
                              <span className="text-slate-300">{item.nameFa}</span>
                            </div>
                            <div className="text-emerald-400 mt-2 flex justify-between">
                              <span>🟢 کل ورود پول (خرید):</span>
                              <span className="font-mono font-bold">
                                {activeViewMode === 'toman' ? formatToman(item.inflowToman) : formatUsdt(item.inflowToman / (data?.usdtPriceToman || 234600))}
                              </span>
                            </div>
                            <div className="text-rose-400 mt-1 flex justify-between">
                              <span>🔴 کل خروج پول (فروش):</span>
                              <span className="font-mono font-bold">
                                {activeViewMode === 'toman' ? formatToman(item.outflowPositive) : formatUsdt(item.outflowPositive / (data?.usdtPriceToman || 234600))}
                              </span>
                            </div>
                            <div className={`mt-2 pt-2 border-t border-slate-800 font-bold flex justify-between ${item.netFlowToman >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              <span>⚡ خالص جریان (Net):</span>
                              <span className="font-mono">
                                {item.netFlowToman >= 0 ? '+' : ''}
                                {activeViewMode === 'toman' ? formatToman(item.netFlowToman) : formatUsdt(item.netFlowToman / (data?.usdtPriceToman || 234600))}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">
                              نسبت برتری: {item.buyPressure.toFixed(0)}٪ خرید در برابر {item.sellPressure.toFixed(0)}٪ فروش
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine x={0} stroke="#475569" strokeWidth={2} />
                  {/* Left Side: Outflows (Negative values) */}
                  <Bar dataKey="displayOutflow" fill="#EF4444" radius={[4, 0, 0, 4]} name="خروج پول" />
                  {/* Right Side: Inflows (Positive values) */}
                  <Bar dataKey="displayInflow" fill="#10B981" radius={[0, 4, 4, 0]} name="ورود پول" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-2">
              <span>💡 این نمودار بدون هیچ خطوط متقاطعی، دقیقاً تراز خرید و فروش هر رمزارز را در ۲ جهت نمایش می‌دهد.</span>
              <span className="text-emerald-400 font-bold">سبز: ورود سرمایه | <span className="text-rose-400">قرمز: خروج سرمایه</span></span>
            </div>
          </div>
        )}

        {/* --- VIEW 3: CAPITAL ROTATION MATRIX --- */}
        {chartVisualMode === 'matrix_rotation' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {filteredCoins.slice(0, 12).map((coin) => {
                const isNetInflow = coin.flowStatus === 'NET_INFLOW';
                const isNetOutflow = coin.flowStatus === 'NET_OUTFLOW';

                return (
                  <div
                    key={coin.symbol}
                    onClick={() => {
                      setSelectedSoloCoin(coin.symbol);
                      setChartVisualMode('sankey_clean');
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] ${
                      isNetInflow
                        ? 'bg-emerald-950/20 border-emerald-800/40 hover:border-emerald-500'
                        : isNetOutflow
                        ? 'bg-rose-950/20 border-rose-800/40 hover:border-rose-500'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black font-mono text-sm text-white">{coin.symbol}</span>
                        <span className="text-[11px] text-slate-400">{coin.nameFa}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isNetInflow ? 'bg-emerald-500/20 text-emerald-400' : isNetOutflow ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isNetInflow ? 'ورود خالص' : isNetOutflow ? 'خروج خالص' : 'متعادل'}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>ورود:</span>
                        <span className="text-emerald-400 font-mono font-bold">
                          {activeViewMode === 'toman' ? formatToman(coin.inflowToman) : formatUsdt(coin.inflowUsdt)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>خروج:</span>
                        <span className="text-rose-400 font-mono font-bold">
                          {activeViewMode === 'toman' ? formatToman(coin.outflowToman) : formatUsdt(coin.outflowUsdt)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-800/80 flex justify-between font-bold">
                        <span>خالص جریان:</span>
                        <span className={`font-mono ${coin.netFlowToman >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {coin.netFlowToman >= 0 ? '+' : ''}
                          {activeViewMode === 'toman' ? formatToman(coin.netFlowToman) : formatUsdt(coin.netFlowUsdt)}
                        </span>
                      </div>
                    </div>

                    {/* Dominance Bar */}
                    <div className="mt-3">
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                        <div style={{ width: `${coin.buyPressurePercent}%` }} className="bg-emerald-500 h-full"></div>
                        <div style={{ width: `${coin.sellPressurePercent}%` }} className="bg-rose-500 h-full"></div>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                        <span>{coin.buyPressurePercent.toFixed(0)}٪ خرید</span>
                        <span>{coin.sellPressurePercent.toFixed(0)}٪ فروش</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. DETAILED ALL-COINS FLOW TABLE WITH INSTANT SEARCH */}
      <div className="rounded-2xl p-5 border border-slate-800 bg-slate-900/90 shadow-xl text-slate-100 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base text-white">
              {lang === 'fa' ? 'جدول جامع ورود و خروج پول تک‌تک رمزارزهای والکس' : 'Comprehensive Coin Flow Matrix'}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter Buttons */}
            <div className="flex bg-slate-800/90 border border-slate-700/80 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'ALL' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                همه ({data?.coinStats.length || 0})
              </button>
              <button
                onClick={() => setStatusFilter('INFLOW')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'INFLOW' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ورود خالص پول
              </button>
              <button
                onClick={() => setStatusFilter('OUTFLOW')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'OUTFLOW' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                خروج خالص پول
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی رمزارز (BTC, اتریوم...)"
                className="pl-3 pr-9 py-1.5 text-xs bg-slate-800/90 text-white placeholder-slate-400 border border-slate-700 rounded-xl outline-none focus:border-blue-500 w-52"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-800/80 border-b border-slate-700 text-slate-300 font-bold">
              <tr>
                <th className="py-3 px-3">رمزارز</th>
                <th className="py-3 px-3">قیمت و تغییرات ۲۴ساعته</th>
                <th className="py-3 px-3 text-emerald-400 font-extrabold">🟢 کل ورود پول (خرید)</th>
                <th className="py-3 px-3 text-rose-400 font-extrabold">🔴 کل خروج پول (فروش)</th>
                <th className="py-3 px-3 text-blue-400 font-extrabold">⚡ جریان خالص (Net Flow)</th>
                <th className="py-3 px-3">نسبت برتری خریدار / فروشنده</th>
                <th className="py-3 px-3 text-center">وضعیت سیگنال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {filteredCoins.map((coin) => {
                const isNetInflow = coin.flowStatus === 'NET_INFLOW';
                const isNetOutflow = coin.flowStatus === 'NET_OUTFLOW';

                return (
                  <tr
                    key={coin.symbol}
                    onClick={() => {
                      setSelectedSoloCoin(coin.symbol);
                    }}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-white">{coin.symbol}</span>
                        <span className="text-slate-400 text-xs">{coin.nameFa}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono">
                      <div className="text-slate-200">{formatToman(coin.lastPriceToman)}</div>
                      <div className={`text-[10px] ${coin.priceChange24h && coin.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {coin.priceChange24h && coin.priceChange24h >= 0 ? '+' : ''}{coin.priceChange24h?.toFixed(2)}٪
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-400 font-bold">
                      {activeViewMode === 'toman' ? formatToman(coin.inflowToman) : formatUsdt(coin.inflowUsdt)}
                    </td>
                    <td className="py-3 px-3 font-mono text-rose-400 font-bold">
                      {activeViewMode === 'toman' ? formatToman(coin.outflowToman) : formatUsdt(coin.outflowUsdt)}
                    </td>
                    <td className="py-3 px-3 font-mono font-black">
                      <span className={isNetInflow ? 'text-emerald-400' : isNetOutflow ? 'text-rose-400' : 'text-slate-400'}>
                        {coin.netFlowToman >= 0 ? '+' : ''}
                        {activeViewMode === 'toman' ? formatToman(coin.netFlowToman) : formatUsdt(coin.netFlowUsdt)}
                      </span>
                    </td>
                    <td className="py-3 px-3 w-48">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-emerald-400 font-bold">{coin.buyPressurePercent.toFixed(0)}٪ خرید</span>
                        <span className="text-rose-400 font-bold">{coin.sellPressurePercent.toFixed(0)}٪ فروش</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex border border-slate-700">
                        <div style={{ width: `${coin.buyPressurePercent}%` }} className="bg-emerald-500 h-full"></div>
                        <div style={{ width: `${coin.sellPressurePercent}%` }} className="bg-rose-500 h-full"></div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                        isNetInflow
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : isNetOutflow
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : 'bg-slate-700/40 text-slate-400 border border-slate-600/40'
                      }`}>
                        {isNetInflow ? <ArrowUpRight className="w-3 h-3" /> : isNetOutflow ? <ArrowDownRight className="w-3 h-3" /> : null}
                        {isNetInflow ? 'ورود پول' : isNetOutflow ? 'خروج پول' : 'متعادل'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
