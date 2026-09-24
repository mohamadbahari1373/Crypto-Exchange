'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
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
} from 'lucide-react';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

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
}

interface MoneyFlowSankeyProps {
  isDark: boolean;
  lang: 'fa' | 'en';
}

export default function MoneyFlowSankey({ isDark, lang }: MoneyFlowSankeyProps) {
  const [data, setData] = useState<MoneyFlowResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterCurrency, setFilterCurrency] = useState<'ALL' | 'TMN' | 'USDT'>('ALL');
  const [coinLimit, setCoinLimit] = useState<string>('30');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<'toman' | 'usdt'>('toman');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'INFLOW' | 'OUTFLOW'>('ALL');
  const [selectedCoinForModal, setSelectedCoinForModal] = useState<CoinFlowStat | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/money-flow?currency=${filterCurrency}&limit=${coinLimit}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastUpdated(new Date());
      }
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
        const res = await fetch(`/api/money-flow?currency=${filterCurrency}&limit=${coinLimit}`, {
          cache: 'no-store',
        });
        if (res.ok && isMounted) {
          const json = await res.json();
          setData(json);
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
    return new Intl.NumberFormat('fa-IR').format(Math.round(num)) + (lang === 'fa' ? ' تومان' : ' TMN');
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

  // Filtered Coins
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
  const solStat = useMemo(() => data?.coinStats.find((c) => c.symbol === 'SOL'), [data]);
  const dogeStat = useMemo(() => data?.coinStats.find((c) => c.symbol === 'DOGE'), [data]);

  // ECharts Sankey Configuration
  const sankeyOption = useMemo(() => {
    if (!data?.sankey) return {};

    const nodes = data.sankey.nodes || [];
    const links = data.sankey.links || [];

    const customNodes = nodes.map((node) => {
      let color = '#3B82F6';
      if (node.name.includes('ورود تومان')) color = '#10B981';
      else if (node.name.includes('ورود تتر')) color = '#06B6D4';
      else if (node.name.includes('خروج به تومان')) color = '#EF4444';
      else if (node.name.includes('خروج به تتر')) color = '#F43F5E';
      else if (node.name === 'BTC') color = '#F59E0B';
      else if (node.name === 'ETH') color = '#8B5CF6';
      else if (node.name === 'SOL') color = '#14B8A6';
      else if (node.name === 'DOGE') color = '#FBBF24';
      else if (node.name === 'TON') color = '#0284C7';
      else if (node.name === 'XRP') color = '#6366F1';
      else if (node.name === 'SHIB') color = '#EF4444';
      else if (node.name === 'TRX') color = '#EC4899';
      else if (node.name === 'PEPE') color = '#22C55E';
      else if (node.name === 'SUI') color = '#0EA5E9';
      else if (node.name === 'NOT') color = '#F97316';
      else if (node.name === 'AVAX') color = '#DC2626';

      return {
        name: node.name,
        itemStyle: {
          color: color,
          borderColor: isDark ? '#0F172A' : '#FFFFFF',
          borderWidth: 1.5,
        },
        label: {
          color: isDark ? '#F1F5F9' : '#0F172A',
          fontWeight: 'bold',
          fontSize: 12,
          fontFamily: 'inherit',
        },
      };
    });

    const customLinks = links.map((link) => {
      const isBuying = link.source.includes('ورود');
      return {
        source: link.source,
        target: link.target,
        value: activeViewMode === 'toman' ? link.value : (link.value / (data.usdtPriceToman || 93200)),
        lineStyle: {
          color: isBuying
            ? 'rgba(16, 185, 129, 0.55)' // Emerald green flow for taker buys
            : 'rgba(239, 68, 68, 0.55)', // Crimson flow for taker sells
          curveness: 0.5,
        },
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
        borderColor: isDark ? '#334155' : '#E2E8F0',
        textStyle: {
          color: isDark ? '#F8FAFC' : '#0F172A',
          fontSize: 12,
          fontFamily: 'inherit',
        },
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            const isSource = params.name.includes('ورود');
            const isSink = params.name.includes('خروج');
            return `<div style="font-weight:bold;margin-bottom:4px;direction:rtl;text-align:right;">${params.name}</div>
                    <div style="direction:rtl;text-align:right;font-size:11px;color:#94A3B8;">
                      ${isSource ? '🟢 منبع ورود نقدینگی خریداران به بازار والکس' : isSink ? '🔴 مقصد خروج و نقد کردن دارایی‌های فروشندگان' : '🪙 رمزارز واسط معامله'}
                    </div>`;
          } else if (params.dataType === 'edge') {
            const isBuy = params.data.source.includes('ورود');
            const valTmn = activeViewMode === 'toman' ? params.value : params.value * (data.usdtPriceToman || 93200);
            const valUsdt = valTmn / (data.usdtPriceToman || 93200);
            return `
              <div style="direction:rtl;text-align:right;">
                <div style="font-weight:bold;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                  <span style="color:${isBuy ? '#10B981' : '#EF4444'};">
                    ${isBuy ? '🟢 ورود سرمایه (خرید تیکر)' : '🔴 خروج سرمایه (فروش تیکر)'}
                  </span>
                </div>
                <div><b>مبدا:</b> ${params.data.source} ➔ <b>مقصد:</b> ${params.data.target}</div>
                <div style="margin-top:4px;"><b>ارزش تومانی:</b> ${formatToman(valTmn)}</div>
                <div><b>ارزش دلاری (USDT):</b> ${formatUsdt(valUsdt)}</div>
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
          },
          nodeWidth: 24,
          nodeGap: 16,
          draggable: false,
          orient: 'horizontal',
          data: customNodes,
          links: customLinks,
          lineStyle: {
            color: 'source',
            curveness: 0.5,
          },
          label: {
            position: 'right',
            formatter: '{b}',
          },
        },
      ],
    };
  }, [data, activeViewMode, isDark, formatToman, formatUsdt]);

  return (
    <div className={`w-full transition-colors duration-200 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* 1. Header & Quick Controls */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2 text-white">
              <Compass className="w-6 h-6 text-blue-400" />
              {lang === 'fa' ? 'رادار جریان ورود و خروج نقدینگی صرافی والکس' : 'Wallex Real-Time Money Flow Radar'}
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            {lang === 'fa'
              ? 'تشخیص بلادرنگ مسیر حرکت سرمایه، خروج پول از رمزارزها و ورود به بازارهای هدف والکس'
              : 'Real-time detection of capital rotation, exits from assets, and inflows into Wallex markets'}
          </p>
        </div>

        {/* Global Action Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
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

          {/* Coin Limit Filter */}
          <select
            value={coinLimit}
            onChange={(e) => setCoinLimit(e.target.value)}
            className="bg-slate-900/90 text-slate-200 border border-slate-700/80 text-xs rounded-xl px-3 py-2 font-medium outline-none shadow-lg focus:border-blue-500 cursor-pointer"
          >
            <option value="20" className="bg-slate-900 text-slate-200">۲۰ ارز برتر</option>
            <option value="30" className="bg-slate-900 text-slate-200">۳۰ ارز برتر</option>
            <option value="50" className="bg-slate-900 text-slate-200">۵۰ ارز برتر</option>
            <option value="all" className="bg-slate-900 text-slate-200">همه ارزهای والکس</option>
          </select>

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
            {lang === 'fa' ? `نرخ تتر مبنا: ${formatToman(data?.usdtPriceToman || 93200)}` : `USDT Rate: ${formatToman(data?.usdtPriceToman || 93200)}`}
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
                  <div key={coin.symbol} className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-rose-900/30">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-200">{coin.symbol}</span>
                      <span className="text-xs text-slate-400">{coin.nameFa}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-rose-400 font-mono">
                        -{activeViewMode === 'toman' ? formatToman(coin.netFlowToman) : formatUsdt(coin.netFlowToman / (data?.usdtPriceToman || 93200))}
                      </div>
                      <div className="text-[10px] text-rose-500/80">
                        {coin.sellPressurePercent?.toFixed(0)}٪ فشار فروش
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 py-2 text-center">در حال تحلیل داده‌های بازار...</div>
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
                  <div key={coin.symbol} className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-emerald-900/30">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-200">{coin.symbol}</span>
                      <span className="text-xs text-slate-400">{coin.nameFa}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-400 font-mono">
                        +{activeViewMode === 'toman' ? formatToman(coin.netFlowToman) : formatUsdt(coin.netFlowToman / (data?.usdtPriceToman || 93200))}
                      </div>
                      <div className="text-[10px] text-emerald-500/80">
                        {coin.buyPressurePercent?.toFixed(0)}٪ برتری خرید
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 py-2 text-center">در حال تحلیل داده‌های بازار...</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. DEDICATED SPOTLIGHT CARDS: BITCOIN (BTC) & ETHEREUM (ETH) INFLOW VS OUTFLOW */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            {lang === 'fa' ? 'داشبورد اختصاصی جریان ورود و خروج بیت‌کوین و اتریوم در والکس' : 'Bitcoin & Ethereum Deep Flow Analytics'}
          </h3>
          <span className="text-xs text-slate-400">تفکیک کامل خریدار (Inflow) و فروشنده (Outflow)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* BTC Spotlight Card */}
          {btcStat && (
            <div className="rounded-2xl p-5 border transition-all shadow-xl bg-slate-900/90 border-amber-500/40 text-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-lg font-mono">
                    ₿
                  </div>
                  <div>
                    <div className="font-extrabold text-base flex items-center gap-1.5 text-white">
                      <span>بیت‌کوین</span>
                      <span className="text-xs font-mono text-amber-400">BTC</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      قیمت: {formatToman(btcStat.lastPriceToman)} ({btcStat.priceChange24h && btcStat.priceChange24h >= 0 ? '+' : ''}{btcStat.priceChange24h?.toFixed(2)}٪)
                    </span>
                  </div>
                </div>

                <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                  btcStat.flowStatus === 'NET_INFLOW'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {btcStat.flowStatus === 'NET_INFLOW' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  <span>{btcStat.flowStatus === 'NET_INFLOW' ? 'ورود خالص پول' : 'خروج خالص پول'}</span>
                </div>
              </div>

              {/* Inflow vs Outflow Key Metrics */}
              <div className="grid grid-cols-3 gap-2 bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 mb-3 text-center">
                <div>
                  <div className="text-[11px] text-emerald-400 font-bold mb-0.5">🟢 کل ورود پول (خرید)</div>
                  <div className="text-xs font-black font-mono text-white">
                    {activeViewMode === 'toman' ? formatToman(btcStat.inflowToman) : formatUsdt(btcStat.inflowUsdt)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-rose-400 font-bold mb-0.5">🔴 کل خروج پول (فروش)</div>
                  <div className="text-xs font-black font-mono text-white">
                    {activeViewMode === 'toman' ? formatToman(btcStat.outflowToman) : formatUsdt(btcStat.outflowUsdt)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-blue-400 font-bold mb-0.5">⚡ خالص ورود/خروج</div>
                  <div className={`text-xs font-black font-mono ${btcStat.netFlowToman >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {btcStat.netFlowToman >= 0 ? '+' : ''}
                    {activeViewMode === 'toman' ? formatToman(btcStat.netFlowToman) : formatUsdt(btcStat.netFlowUsdt)}
                  </div>
                </div>
              </div>

              {/* Progress Bar of Buy vs Sell Dominance */}
              <div>
                <div className="flex justify-between text-[11px] font-bold mb-1">
                  <span className="text-emerald-400">فشار خرید: {btcStat.buyPressurePercent.toFixed(1)}٪</span>
                  <span className="text-rose-400">فشار فروش: {btcStat.sellPressurePercent.toFixed(1)}٪</span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex border border-slate-700">
                  <div style={{ width: `${btcStat.buyPressurePercent}%` }} className="bg-emerald-500 h-full transition-all"></div>
                  <div style={{ width: `${btcStat.sellPressurePercent}%` }} className="bg-rose-500 h-full transition-all"></div>
                </div>
                <div className="text-[10px] text-slate-400 mt-2 text-center">
                  تفکیک جفت‌ارزها: بازار تومانی (خرید {formatToman(btcStat.tomanMarketInflow)} | فروش {formatToman(btcStat.tomanMarketOutflow)})
                </div>
              </div>
            </div>
          )}

          {/* ETH Spotlight Card */}
          {ethStat && (
            <div className="rounded-2xl p-5 border transition-all shadow-xl bg-slate-900/90 border-purple-500/40 text-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-lg font-mono">
                    Ξ
                  </div>
                  <div>
                    <div className="font-extrabold text-base flex items-center gap-1.5 text-white">
                      <span>اتریوم</span>
                      <span className="text-xs font-mono text-purple-400">ETH</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      قیمت: {formatToman(ethStat.lastPriceToman)} ({ethStat.priceChange24h && ethStat.priceChange24h >= 0 ? '+' : ''}{ethStat.priceChange24h?.toFixed(2)}٪)
                    </span>
                  </div>
                </div>

                <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                  ethStat.flowStatus === 'NET_INFLOW'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {ethStat.flowStatus === 'NET_INFLOW' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  <span>{ethStat.flowStatus === 'NET_INFLOW' ? 'ورود خالص پول' : 'خروج خالص پول'}</span>
                </div>
              </div>

              {/* Inflow vs Outflow Key Metrics */}
              <div className="grid grid-cols-3 gap-2 bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 mb-3 text-center">
                <div>
                  <div className="text-[11px] text-emerald-400 font-bold mb-0.5">🟢 کل ورود پول (خرید)</div>
                  <div className="text-xs font-black font-mono text-white">
                    {activeViewMode === 'toman' ? formatToman(ethStat.inflowToman) : formatUsdt(ethStat.inflowUsdt)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-rose-400 font-bold mb-0.5">🔴 کل خروج پول (فروش)</div>
                  <div className="text-xs font-black font-mono text-white">
                    {activeViewMode === 'toman' ? formatToman(ethStat.outflowToman) : formatUsdt(ethStat.outflowUsdt)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-blue-400 font-bold mb-0.5">⚡ خالص ورود/خروج</div>
                  <div className={`text-xs font-black font-mono ${ethStat.netFlowToman >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {ethStat.netFlowToman >= 0 ? '+' : ''}
                    {activeViewMode === 'toman' ? formatToman(ethStat.netFlowToman) : formatUsdt(ethStat.netFlowUsdt)}
                  </div>
                </div>
              </div>

              {/* Progress Bar of Buy vs Sell Dominance */}
              <div>
                <div className="flex justify-between text-[11px] font-bold mb-1">
                  <span className="text-emerald-400">فشار خرید: {ethStat.buyPressurePercent.toFixed(1)}٪</span>
                  <span className="text-rose-400">فشار فروش: {ethStat.sellPressurePercent.toFixed(1)}٪</span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex border border-slate-700">
                  <div style={{ width: `${ethStat.buyPressurePercent}%` }} className="bg-emerald-500 h-full transition-all"></div>
                  <div style={{ width: `${ethStat.sellPressurePercent}%` }} className="bg-rose-500 h-full transition-all"></div>
                </div>
                <div className="text-[10px] text-slate-400 mt-2 text-center">
                  تفکیک جفت‌ارزها: بازار تومانی (خرید {formatToman(ethStat.tomanMarketInflow)} | فروش {formatToman(ethStat.tomanMarketOutflow)})
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. THE INTERACTIVE SANKEY DIAGRAM */}
      <div className="mb-6 rounded-2xl p-5 border border-slate-800 bg-slate-900/90 shadow-xl text-slate-100 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base text-white">
              {lang === 'fa' ? 'نمودار پیوسته مسیر انتقال جریان نقدینگی (Sankey Flow)' : 'Continuous Liquidity Sankey Graph'}
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500/50"></span>
              <span className="text-slate-300 font-medium">ورود سرمایه (خرید)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block shadow-sm shadow-rose-500/50"></span>
              <span className="text-slate-300 font-medium">خروج سرمایه (فروش)</span>
            </div>
          </div>
        </div>

        <div className="w-full h-[460px]">
          {data?.sankey ? (
            <ReactECharts
              option={sankeyOption}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
              در حال رسم گراف جریان نقدینگی...
            </div>
          )}
        </div>
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
                  <tr key={coin.symbol} className="hover:bg-slate-800/50 transition-colors">
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
