'use client';

import React, { useState, useEffect, useMemo, useTransition, useRef } from 'react';
import {
  RefreshCw,
  Sun,
  Moon,
  ShieldCheck,
  TrendingUp,
  Award,
  Layers,
  BarChart3,
  CheckCircle2,
  HelpCircle,
  ArrowUpRight,
  Zap,
  Users,
  Coins,
  Search,
  ArrowUpDown,
  Newspaper,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  LayoutGrid,
} from 'lucide-react';
import NewsFeed from '@/components/NewsFeed';
import MarketClockCards from '@/components/MarketClockCards';
import MoneyFlowSankey from '@/components/MoneyFlowSankey';
import SignalRadarBackground from '@/components/SignalRadarBackground';
import MarketPulseDashboard from '@/components/MarketPulseDashboard';
import DidehbonLogo, { DidehbonLogoIcon } from '@/components/DidehbonLogo';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { Language, Theme, NumberDisplayMode, ExchangeData, VolumeApiResponse } from '@/lib/types';
import {
  formatTomanVolume,
  formatUsdtAmount,
  formatPercent,
  formatCount,
  toPersianDigits,
  getSecondaryVolumeLabel,
} from '@/lib/formatters';
import { translations } from '@/lib/translations';

const QUICK_COIN_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'];

export default function VolumeDashboard() {
  const [data, setData] = useState<VolumeApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // User Preferences
  const [lang, setLang] = useState<Language>('fa');
  const [theme, setTheme] = useState<Theme>('dark');
  const displayMode: NumberDisplayMode = 'full';
  const [userExchangeId, setUserExchangeId] = useState<string>('wallex'); // Wallex default as user is from Wallex
  const [mainSection, setMainSection] = useState<'volumes' | 'flow' | 'news' | 'marketpulse'>('news');
  const [activeTab, setActiveTab] = useState<'table' | 'coins'>('coins');
  const [selectedCoinSymbol, setSelectedCoinSymbol] = useState<string>('ALL');
  const [coinSearchQuery, setCoinSearchQuery] = useState<string>('');
  const [coinPickerOpen, setCoinPickerOpen] = useState(false);
  const [allCoinsGridOpen, setAllCoinsGridOpen] = useState(false);
  const [hoveredExchangeId, setHoveredExchangeId] = useState<string | null>(null);
  const coinPickerRootRef = useRef<HTMLDivElement>(null);
  const coinPickerPanelRef = useRef<HTMLDivElement>(null);
  const coinSearchInputRef = useRef<HTMLInputElement>(null);
  const allCoinsPanelRef = useRef<HTMLDivElement>(null);
  const muuriGridRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];
  const isRtl = lang === 'fa';

  // Fetch exchange volume data
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/volumes.php', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const json: VolumeApiResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'خطا در برقراری ارتباط');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initialLoad = async () => {
      try {
        const res = await fetch('/api/volumes.php', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        const json: VolumeApiResponse = await res.json();
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'خطا در برقراری ارتباط');
          setLoading(false);
        }
      }
    };

    initialLoad();
    const interval = setInterval(() => {
      initialLoad();
    }, 60000); // Auto-refresh every 60s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Selected Exchange Data
  const selectedExchange = useMemo(() => {
    if (!data?.exchanges) return null;
    return data.exchanges.find((e) => e.id === userExchangeId) || data.exchanges[0];
  }, [data, userExchangeId]);

  // Leader exchange (#1)
  const leaderExchange = useMemo(() => {
    if (!data?.exchanges?.length) return null;
    return data.exchanges[0];
  }, [data]);

  // Gap between selected exchange and leader
  const leaderGapToman = useMemo(() => {
    if (!selectedExchange || !leaderExchange) return 0;
    return Math.max(0, leaderExchange.totalVolumeToman - selectedExchange.totalVolumeToman);
  }, [selectedExchange, leaderExchange]);

  // Subtle navy & distinct color palette mapped to each exchange for proportional visual bar
  const exchangeColors: Record<string, { bg: string; text: string; border: string }> = {
    nobitex: { bg: '#1E3A8A', text: '#93C5FD', border: '#3B82F6' }, // Royal Navy
    bitpin: { bg: '#0E7490', text: '#A5F3FC', border: '#06B6D4' },  // Deep Cyan Slate
    wallex: { bg: '#2563EB', text: '#BFDBFE', border: '#60A5FA' },  // Classic Vibrant Blue
    ompfinex: { bg: '#0F766E', text: '#99F6E4', border: '#14B8A6' }, // Teal Emerald
    abantether: { bg: '#B45309', text: '#FDE68A', border: '#F59E0B' }, // Amber Gold
    okex: { bg: '#4338CA', text: '#C7D2FE', border: '#6366F1' },     // Indigo Slate
    ramzinex: { bg: '#334155', text: '#CBD5E1', border: '#64748B' }, // Slate Navy
    tabdeal: { bg: '#1E293B', text: '#94A3B8', border: '#475569' },  // Midnight Slate
    bit24: { bg: '#6D28D9', text: '#DDD6FE', border: '#8B5CF6' },    // Violet Indigo
    sarmayex: { bg: '#0369A1', text: '#BAE6FD', border: '#38BDF8' }, // Ocean Sky
    etrax: { bg: '#9D174D', text: '#FBCFE8', border: '#EC4899' },    // Rose Slate
    bitbarg: { bg: '#374151', text: '#D1D5DB', border: '#6B7280' },  // Steel Grey
    hamtapay: { bg: '#15803D', text: '#BBF7D0', border: '#22C55E' }, // Emerald Forest
  };

  // Filtered coins list
  const filteredCoins = useMemo(() => {
    const coinList = data?.coins;
    if (!coinList) return [];
    if (!coinSearchQuery.trim()) return coinList;
    const q = coinSearchQuery.trim().toLowerCase();
    return coinList.filter(
      (c) =>
        c.symbol.toLowerCase().includes(q) ||
        c.nameFa.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q)
    );
  }, [data, coinSearchQuery]);
  const allCoins = useMemo(() => data?.coins ?? [], [data]);

  // Selected coin details
  const activeCoin = useMemo(() => {
    const coinList = data?.coins;
    if (!coinList || selectedCoinSymbol === 'ALL') return null;
    return coinList.find((c) => c.symbol.toUpperCase() === selectedCoinSymbol.toUpperCase()) || null;
  }, [data, selectedCoinSymbol]);

  useEffect(() => {
    if (mainSection !== 'volumes' || activeTab !== 'coins') {
      setCoinPickerOpen(false);
      setAllCoinsGridOpen(false);
    }
  }, [activeTab, mainSection]);

  useEffect(() => {
    if (!coinPickerOpen) return;
    coinSearchInputRef.current?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !coinPickerRootRef.current?.contains(event.target)) {
        setCoinPickerOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCoinPickerOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [coinPickerOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    void import('gsap')
      .then(({ gsap }) => {
        const panel = coinPickerPanelRef.current;
        if (cancelled || !panel) return;
        if (coinPickerOpen) {
          gsap.fromTo(
            panel,
            { autoAlpha: 0, height: 0, y: -8 },
            { autoAlpha: 1, height: 'auto', y: 0, duration: 0.22, ease: 'power2.out', overwrite: 'auto' },
          );
        } else {
          gsap.to(panel, { autoAlpha: 0, height: 0, y: -8, duration: 0.16, ease: 'power2.in', overwrite: 'auto' });
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to animate the coin picker:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [coinPickerOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    void import('gsap')
      .then(({ gsap }) => {
        const panel = allCoinsPanelRef.current;
        if (cancelled || !panel) return;
        if (allCoinsGridOpen) {
          gsap.fromTo(
            panel,
            { autoAlpha: 0, height: 0, y: -8 },
            { autoAlpha: 1, height: 'auto', y: 0, duration: 0.28, ease: 'power2.out', overwrite: 'auto' },
          );
        } else {
          gsap.to(panel, { autoAlpha: 0, height: 0, y: -8, duration: 0.18, ease: 'power2.in', overwrite: 'auto' });
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to animate the coin grid panel:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [allCoinsGridOpen]);

  useEffect(() => {
    if (!allCoinsGridOpen || typeof window === 'undefined') return;
    const container = muuriGridRef.current;
    if (!container) return;

    let cancelled = false;
    let layoutFrame = 0;
    let destroyGrid: (() => void) | undefined;
    void import('muuri')
      .then(({ default: Muuri }) => {
        if (cancelled || !container.isConnected) return;
        const grid = new Muuri(container, {
          dragEnabled: true,
          dragSort: true,
          layoutDuration: 300,
          layoutEasing: 'ease',
          layoutOnResize: 150,
        });
        destroyGrid = () => grid.destroy();
        layoutFrame = window.requestAnimationFrame(() => {
          grid.refreshItems().layout();
        });
      })
      .catch((error: unknown) => {
        console.error('Unable to initialize the coin grid:', error);
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(layoutFrame);
      destroyGrid?.();
    };
  }, [allCoinsGridOpen, allCoins]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    void import('gsap')
      .then(({ gsap }) => {
        const section = document.querySelector<HTMLElement>(
          activeTab === 'coins' ? '#section-coin-breakdown' : '#section-table',
        );
        if (cancelled || !section) return;
        gsap.fromTo(
          section,
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' },
        );
      })
      .catch((error: unknown) => {
        console.error('Unable to animate the active dashboard tab:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, mainSection]);

  useEffect(() => {
    if (!data || mainSection !== 'volumes' || typeof window === 'undefined') return;
    let cancelled = false;
    void import('gsap')
      .then(({ gsap }) => {
        const cards = document.querySelectorAll<HTMLElement>('[data-stat-card]');
        if (cancelled || cards.length === 0) return;
        gsap.fromTo(
          cards,
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.08, ease: 'power2.out', overwrite: 'auto' },
        );
      })
      .catch((error: unknown) => {
        console.error('Unable to animate the statistics cards:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [data, mainSection]);

  const isDark = theme === 'dark';
  const primaryNavigation = (
    <nav
      id="tool-primary-switcher"
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`flex h-[52px] w-max items-center gap-0.5 rounded-xl border p-1 text-xs font-semibold shadow-xs ${
        isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-slate-100 border-slate-300/80'
      }`}
    >
      <button
        id="btn-nav-marketpulse"
        onClick={() => setMainSection('marketpulse')}
        className={`order-4 flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 transition-all ${
          mainSection === 'marketpulse'
            ? isDark
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
              : 'bg-white text-blue-700 shadow-xs'
            : isDark
            ? 'text-slate-400 hover:text-slate-200'
            : 'text-slate-600 hover:text-slate-900'
        }`}
        aria-pressed={mainSection === 'marketpulse'}
      >
        <span>🔥 نبض بازار جهانی</span>
      </button>

      <button
        id="btn-nav-volumes"
        onClick={() => setMainSection('volumes')}
        className={`order-3 flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 transition-all ${
          mainSection === 'volumes'
            ? isDark
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
              : 'bg-white text-blue-700 shadow-xs'
            : isDark
            ? 'text-slate-400 hover:text-slate-200'
            : 'text-slate-600 hover:text-slate-900'
        }`}
        aria-pressed={mainSection === 'volumes'}
      >
        <BarChart3 className="h-3.5 w-3.5" />
        <span>{t.navVolumes}</span>
      </button>

      <button
        id="btn-nav-flow"
        onClick={() => setMainSection('flow')}
        className={`order-2 relative flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 transition-all ${
          mainSection === 'flow'
            ? isDark
              ? 'bg-gradient-to-r from-amber-500 to-emerald-600 font-bold text-slate-950 shadow-sm shadow-amber-900/40'
              : 'bg-amber-500 font-bold text-slate-950 shadow-xs'
            : isDark
            ? 'text-amber-400/90 hover:text-amber-300'
            : 'text-amber-700 hover:text-amber-900'
        }`}
        aria-pressed={mainSection === 'flow'}
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
        <span>{t.navFlow}</span>
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
      </button>

      <button
        id="btn-nav-news"
        onClick={() => setMainSection('news')}
        className={`order-1 relative flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 transition-all ${
          mainSection === 'news'
            ? isDark
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
              : 'bg-white text-blue-700 shadow-xs'
            : isDark
            ? 'text-slate-400 hover:text-slate-200'
            : 'text-slate-600 hover:text-slate-900'
        }`}
        aria-pressed={mainSection === 'news'}
      >
        <Newspaper className="h-3.5 w-3.5" />
        <span>{t.navNews}</span>
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
      </button>
    </nav>
  );

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`min-h-screen transition-colors duration-200 ${
        isDark
          ? 'bg-[#090D16] text-slate-100 selection:bg-slate-700 selection:text-white'
          : 'bg-[#F4F6F9] text-slate-900 selection:bg-slate-200 selection:text-slate-900'
      }`}
    >
      <SignalRadarBackground />
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6">
        {/* TOP BAR / NAVIGATION - Less is More */}
        <header
          id="app-header"
          className={`flex flex-col items-start gap-3 rounded-xl border p-3 sm:p-4 2xl:flex-nowrap 2xl:items-center 2xl:justify-between ${
            isRtl ? '2xl:flex-row' : '2xl:flex-row-reverse'
          } ${
            isDark
              ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
              : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex w-full min-w-0 flex-wrap items-center gap-3 2xl:w-auto 2xl:flex-nowrap">
            <DidehbonLogo
              size="md"
              variant="full"
              lang={lang}
              isDark={isDark}
              showDomain={true}
            />
            <div className="max-w-full overflow-x-auto no-scrollbar">
              {primaryNavigation}
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-wrap items-center gap-2.5 2xl:w-auto 2xl:flex-nowrap 2xl:justify-end">
            <div className="max-w-full overflow-x-auto no-scrollbar">
              <MarketClockCards lang={lang} />
            </div>

            <div className={`h-5 w-px shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-300'}`} />

            <button
              id="btn-lang-toggle"
              onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')}
              className={`h-[52px] shrink-0 rounded-lg border px-2.5 text-xs font-medium transition-all ${
                isDark
                  ? 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-white'
              }`}
              title="تغییر زبان / Switch Language"
            >
              {lang === 'fa' ? 'EN' : 'فا'}
            </button>

            <button
              id="btn-theme-toggle"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg border transition-all ${
                isDark
                  ? 'bg-slate-900/90 border-slate-800 text-amber-300 hover:bg-slate-800'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-white'
              }`}
              title={isDark ? t.themeLight : t.themeDark}
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* MAIN SECTION CONDITIONAL: VOLUMES VS FLOW VS NEWS */}
        {mainSection === 'marketpulse' ? (
          <MarketPulseDashboard />
        ) : mainSection === 'flow' ? (
          <MoneyFlowSankey isDark={isDark} lang={lang} />
        ) : mainSection === 'news' ? (
          <NewsFeed lang={lang} theme={theme} />
        ) : !data && loading ? (
          <div
            className={`flex flex-col items-center justify-center p-12 text-center rounded-xl border ${
              isDark ? 'bg-[#0F172A] border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <h3 className="text-base font-bold mb-1">{t.refreshing}</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {lang === 'fa'
                ? 'در حال دریافت اطلاعات زنده حجم معاملات و وب‌سرویس‌های صرافی‌ها...'
                : 'Fetching live market volumes and exchange API endpoints...'}
            </p>
          </div>
        ) : error && !data ? (
          <div
            className={`flex flex-col items-center justify-center p-12 text-center rounded-xl border ${
              isDark ? 'bg-[#0F172A] border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold mb-1 text-rose-400">
              {lang === 'fa' ? 'خطا در بارگذاری اطلاعات' : 'Failed to load data'}
            </h3>
            <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all"
            >
              {lang === 'fa' ? 'تلاش مجدد' : 'Retry'}
            </button>
          </div>
        ) : (
          <>
        {/* 4 CORE KPI METRICS */}
        <div id="volume-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Market Volume */}
          <div
            id="metric-total-market"
            data-stat-card
            className={`p-4 rounded-xl border transition-all ${
              isDark
                ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
                : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.totalMarketVolume}
              </span>
              <span
                className={`p-1.5 rounded-lg ${
                  isDark ? 'bg-blue-950/60 text-blue-400' : 'bg-blue-50 text-blue-600'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-blue-500">
                {formatTomanVolume(data?.grandTotalToman || 0, displayMode, lang)}
              </div>
              {getSecondaryVolumeLabel(data?.grandTotalToman || 0, displayMode, lang) && (
                <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {getSecondaryVolumeLabel(data?.grandTotalToman || 0, displayMode, lang)}
                </div>
              )}
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {lang === 'fa'
                  ? `مجموع معاملات ۲۴ساعته در ${toPersianDigits(data?.exchanges?.length || 13)} صرافی برتر`
                  : `Aggregated across ${data?.exchanges?.length || 13} leading exchanges`}
              </p>
            </div>
          </div>

          {/* Card 2: My Exchange Selector & Volume */}
          <div
            id="metric-my-exchange"
            data-stat-card
            className={`p-4 rounded-xl border transition-all ${
              isDark
                ? 'bg-[#0F172A] border-blue-900/40 shadow-lg shadow-blue-950/20'
                : 'bg-white border-blue-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.myExchange}:
                </span>
                <select
                  id="select-my-exchange"
                  value={userExchangeId}
                  onChange={(e) => setUserExchangeId(e.target.value)}
                  className={`text-xs font-semibold rounded px-1.5 py-0.5 border cursor-pointer ${
                    isDark
                      ? 'bg-slate-900 text-blue-400 border-slate-700 focus:ring-blue-500'
                      : 'bg-slate-50 text-blue-700 border-slate-300 focus:ring-blue-500'
                  }`}
                >
                  {data?.exchanges?.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {lang === 'fa' ? ex.nameFa : ex.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  isDark ? 'bg-blue-950 text-blue-300' : 'bg-blue-100 text-blue-800'
                }`}
              >
                #{lang === 'fa' ? toPersianDigits(selectedExchange?.rank || 0) : selectedExchange?.rank}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold tracking-tight">
                {formatTomanVolume(selectedExchange?.totalVolumeToman || 0, displayMode, lang)}
              </div>
              {getSecondaryVolumeLabel(selectedExchange?.totalVolumeToman || 0, displayMode, lang) && (
                <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {getSecondaryVolumeLabel(selectedExchange?.totalVolumeToman || 0, displayMode, lang)}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium text-emerald-500">
                  {formatPercent(selectedExchange?.marketSharePercent || 0, lang)} {t.marketShare}
                </span>
                <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>•</span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {formatCount(selectedExchange?.activeMarketsCount || 0, lang)} {t.activeMarkets}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Gap vs Leader */}
          <div
            id="metric-leader-gap"
            data-stat-card
            className={`p-4 rounded-xl border transition-all ${
              isDark
                ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
                : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.leaderGap}
              </span>
              <span
                className={`p-1.5 rounded-lg ${
                  isDark ? 'bg-amber-950/60 text-amber-400' : 'bg-amber-50 text-amber-600'
                }`}
              >
                <Award className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-amber-500">
                {selectedExchange?.id === leaderExchange?.id
                  ? lang === 'fa'
                    ? 'صدرنشین بازار'
                    : 'Market Leader'
                  : formatTomanVolume(leaderGapToman, displayMode, lang)}
              </div>
              {selectedExchange?.id !== leaderExchange?.id &&
                getSecondaryVolumeLabel(leaderGapToman, displayMode, lang) && (
                  <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {getSecondaryVolumeLabel(leaderGapToman, displayMode, lang)}
                  </div>
                )}
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {selectedExchange?.id === leaderExchange?.id
                  ? lang === 'fa'
                    ? 'بالاترین سهم حجم در معاملات ایران'
                    : 'Highest trading volume in Iran'
                  : `${t.compareVsLeader} ${lang === 'fa' ? leaderExchange?.nameFa : leaderExchange?.nameEn}`}
              </p>
            </div>
          </div>

          {/* Card 4: Active Ecosystem Scope */}
          <div
            id="metric-scope"
            data-stat-card
            className={`p-4 rounded-xl border transition-all ${
              isDark
                ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
                : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.monitoredExchanges}
              </span>
              <span
                className={`p-1.5 rounded-lg ${
                  isDark ? 'bg-indigo-950/60 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                <Layers className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-bold tracking-tight">
                {lang === 'fa'
                  ? `${toPersianDigits(data?.exchanges?.length || 13)} صرافی`
                  : `${data?.exchanges?.length || 13} Exchanges`}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-500 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'fa' ? 'استخراج با پروتکل امنیتی PLL' : 'Monitored via PLL Protocol'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PROPORTIONAL MARKET SHARE BAR (Visual Less-is-more chart) */}
        <section
          id="market-share-proportional-bar"
          className={`p-4 rounded-xl border ${
            isDark
              ? 'bg-[#0F172A] border-slate-800/80'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold tracking-wide">
              {lang === 'fa' ? 'طیف سهم بازار صرافی‌ها (تومان)' : 'Market Share Proportional Spectrum (TMN)'}
            </span>
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {lang === 'fa' ? 'کل ۱۰۰٪' : '100% Total'}
            </span>
          </div>

          {/* Unified horizontal segmented bar */}
          <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-slate-800/50 p-0.5 border border-slate-700/50">
            {data?.exchanges?.map((ex) => {
              const widthPct = Math.max(ex.marketSharePercent, 1.5);
              const isSelected = ex.id === userExchangeId;
              const isHovered = ex.id === hoveredExchangeId;
              return (
                <div
                  key={ex.id}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: exchangeColors[ex.id]?.border || '#3B82F6',
                  }}
                  onMouseEnter={() => setHoveredExchangeId(ex.id)}
                  onMouseLeave={() => setHoveredExchangeId(null)}
                  className={`h-full transition-all cursor-pointer relative ${
                    isSelected ? 'ring-2 ring-white/80 z-10' : ''
                  } ${isHovered ? 'brightness-125' : ''}`}
                  title={`${lang === 'fa' ? ex.nameFa : ex.nameEn}: ${formatPercent(
                    ex.marketSharePercent,
                    lang
                  )} (${formatTomanVolume(ex.totalVolumeToman, 'compact', lang)})`}
                />
              );
            })}
          </div>

          {/* Legend Chips */}
          <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-2 border-t border-slate-800/40 text-xs">
            {data?.exchanges?.map((ex) => {
              const isSelected = ex.id === userExchangeId;
              return (
                <button
                  key={ex.id}
                  onClick={() => setUserExchangeId(ex.id)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                    isSelected
                      ? isDark
                        ? 'bg-blue-950/80 text-blue-300 border border-blue-700 shadow-sm'
                        : 'bg-blue-100 text-blue-900 border border-blue-300 shadow-xs'
                      : isDark
                      ? 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-transparent hover:border-slate-700'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-300'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: exchangeColors[ex.id]?.border || '#3B82F6' }}
                  />
                  <span>{lang === 'fa' ? ex.nameFa : ex.nameEn}</span>
                  <span className="font-bold">{formatPercent(ex.marketSharePercent, lang)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* TABS NAVIGATION - Focused Views */}
        <div className="flex items-center gap-2 border-b border-slate-800/60 pb-1 overflow-x-auto no-scrollbar">
          <button
            id="tab-btn-coins"
            onClick={() => setActiveTab('coins')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-1 whitespace-nowrap ${
              activeTab === 'coins'
                ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{t.tabCoinBreakdown}</span>
          </button>

          <button
            id="tab-btn-table"
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-1 whitespace-nowrap ${
              activeTab === 'table'
                ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{t.tabComparison}</span>
          </button>

        </div>

        {/* TAB 1: COMPARISON TABLE */}
        {activeTab === 'table' && (
          <div
            id="section-table"
            className={`rounded-xl border overflow-hidden ${
              isDark
                ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
                : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr
                    className={`border-b ${
                      isDark
                        ? 'bg-slate-900/90 border-slate-800 text-slate-400'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <th className="py-3 px-3.5 text-start font-semibold">{t.colRank}</th>
                    <th className="py-3 px-3.5 text-start font-semibold">{t.colExchange}</th>
                    <th className="py-3 px-3.5 text-start font-semibold">{t.colTotalVolume}</th>
                    <th className="py-3 px-3.5 text-start font-semibold">{t.colBtcVolume}</th>
                    <th id="th-col-usdt" className="py-3 px-3.5 text-start font-semibold text-emerald-600 dark:text-emerald-400">{t.colUsdtVolume}</th>
                    <th className="py-3 px-3.5 text-start font-semibold">{t.colMarketShare}</th>
                    <th className="py-3 px-3.5 text-start font-semibold">{t.colMarketsCount}</th>
                    <th className="py-3 px-3.5 text-start font-semibold">{t.colStatus}</th>
                    <th className="py-3 px-3.5 text-center font-semibold">{t.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {data?.exchanges?.map((ex) => {
                    const isSelected = ex.id === userExchangeId;
                    const maxVol = data.exchanges[0]?.totalVolumeToman || 1;
                    const barWidth = Math.min(100, Math.round((ex.totalVolumeToman / maxVol) * 100));

                    return (
                      <tr
                        key={ex.id}
                        className={`transition-colors ${
                          isSelected
                            ? isDark
                              ? 'bg-blue-950/30 font-medium'
                              : 'bg-blue-50/70 font-medium'
                            : isDark
                            ? 'hover:bg-slate-800/30'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              ex.rank === 1
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : ex.rank === 2
                                ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40'
                                : ex.rank === 3
                                ? 'bg-amber-700/20 text-amber-500 border border-amber-700/40'
                                : isDark
                                ? 'bg-slate-800 text-slate-400'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {lang === 'fa' ? toPersianDigits(ex.rank) : ex.rank}
                          </span>
                        </td>

                        {/* Exchange Name & Model */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs shadow-xs"
                              style={{
                                backgroundColor: exchangeColors[ex.id]?.bg || '#1E293B',
                                color: exchangeColors[ex.id]?.text || '#FFFFFF',
                              }}
                            >
                              {ex.nameEn.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm">
                                  {lang === 'fa' ? ex.nameFa : ex.nameEn}
                                </span>
                                {isSelected && (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                      isDark
                                        ? 'bg-blue-900/60 text-blue-300 border border-blue-700'
                                        : 'bg-blue-100 text-blue-800 border border-blue-300'
                                    }`}
                                  >
                                    {lang === 'fa' ? 'صرافی شما' : 'Your Exchange'}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] block ${
                                  isDark ? 'text-slate-400' : 'text-slate-500'
                                }`}
                              >
                                {lang === 'fa' ? ex.modelFa : ex.model}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Total Volume */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <div className="font-bold text-sm text-blue-400">
                            {formatTomanVolume(ex.totalVolumeToman, displayMode, lang)}
                          </div>
                          {getSecondaryVolumeLabel(ex.totalVolumeToman, displayMode, lang) && (
                            <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {getSecondaryVolumeLabel(ex.totalVolumeToman, displayMode, lang)}
                            </div>
                          )}
                          {/* Micro-bar */}
                          <div className="w-24 h-1 rounded-full bg-slate-800 mt-1 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </td>

                        {/* BTC Volume */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <div className="font-medium">
                            {formatTomanVolume(ex.btcVolumeToman, displayMode, lang)}
                          </div>
                          <span
                            className={`text-[10px] ${
                              isDark ? 'text-slate-500' : 'text-slate-400'
                            }`}
                          >
                            BTC/TMN + BTC/USDT
                          </span>
                        </td>

                        {/* USDT Volume (Equivalent USDT) */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatUsdtAmount(ex.usdtVolumeQty || Math.round(ex.usdtVolumeToman / 233000), displayMode, lang)}
                          </div>
                          <span
                            className={`text-[10px] ${
                              isDark ? 'text-slate-500' : 'text-slate-400'
                            }`}
                          >
                            {lang === 'fa' ? 'تتر (USDT)' : 'USDT'}
                          </span>
                        </td>

                        {/* Market Share % */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <span className="font-bold text-emerald-500">
                            {formatPercent(ex.marketSharePercent, lang)}
                          </span>
                        </td>

                        {/* Markets Count */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <span className="font-medium">
                            {formatCount(ex.activeMarketsCount, lang)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              ex.status === 'live'
                                ? isDark
                                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isDark
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                ex.status === 'live' ? 'bg-emerald-400' : 'bg-slate-400'
                              }`}
                            />
                            {ex.status === 'live' ? t.statusLive : t.statusBenchmark}
                          </span>
                        </td>

                        {/* Action: Set as Mine */}
                        <td className="py-3.5 px-3.5 whitespace-nowrap text-center">
                          <button
                            id={`btn-select-${ex.id}`}
                            onClick={() => setUserExchangeId(ex.id)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                              isSelected
                                ? isDark
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'bg-blue-600 text-white font-semibold'
                                : isDark
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isSelected ? t.selectedAsMine : t.selectAsMine}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer Note */}
            <div
              className={`p-3 border-t text-xs flex flex-col sm:flex-row items-center justify-between gap-2 ${
                isDark
                  ? 'bg-slate-900/60 border-slate-800 text-slate-400'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <span>{t.lessIsMoreNote}</span>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>{lang === 'fa' ? 'تمام مبالغ به تومان است' : 'All volumes in Tomans'}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB: COIN-SPECIFIC VOLUME ANALYSIS & RECHARTS */}
        {activeTab === 'coins' && (
          <div id="section-coin-breakdown" className="flex flex-col gap-5">
            {/* Coin picker, quick filters, and animated full-market grid */}
            <div
              className={`p-4 rounded-xl border ${
                isDark
                  ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/40">
                <div>
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <h2 className="text-base font-bold">
                      {t.coinBreakdownTitle}
                    </h2>
                  </div>
                  <p
                    className={`text-xs mt-1 ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {t.coinBreakdownSubtitle}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500">
                  {lang === 'fa'
                    ? `${toPersianDigits(data?.coins?.length ?? 0)} رمزارز در فهرست`
                    : `${data?.coins?.length ?? 0} assets listed`}
                </span>
              </div>

              <div className="flex flex-col gap-4 pt-4">
                <section className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-slate-400">
                    {t.filterSelectCoin}
                  </label>
                  <div ref={coinPickerRootRef} className="relative">
                    <button
                      id="coin-picker-trigger"
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={coinPickerOpen}
                      aria-controls="coin-picker-options"
                      onClick={() => setCoinPickerOpen((open) => !open)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-start text-sm transition-colors ${
                        isDark
                          ? 'border-slate-700 bg-slate-900 text-slate-100 hover:border-blue-500/70'
                          : 'border-slate-300 bg-slate-50 text-slate-900 hover:border-blue-500'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Search className="h-4 w-4 shrink-0 text-blue-400" />
                        <span className="truncate">
                          {selectedCoinSymbol === 'ALL'
                            ? t.filterAllCoins
                            : `${selectedCoinSymbol} · ${activeCoin
                              ? (lang === 'fa' ? activeCoin.nameFa : activeCoin.nameEn)
                              : selectedCoinSymbol}`}
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${coinPickerOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <div
                      ref={coinPickerPanelRef}
                      aria-hidden={!coinPickerOpen}
                      className={`absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-xl border shadow-2xl ${
                        coinPickerOpen ? 'pointer-events-auto' : 'pointer-events-none'
                      } ${
                        isDark
                          ? 'border-slate-700 bg-slate-950 shadow-black/40'
                          : 'border-slate-200 bg-white shadow-slate-900/15'
                      }`}
                      style={{ height: 0, opacity: 0, visibility: 'hidden' }}
                    >
                      <div className={`border-b p-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                        <div className="relative">
                          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            ref={coinSearchInputRef}
                            id="coin-search-input"
                            type="search"
                            role="searchbox"
                            value={coinSearchQuery}
                            onChange={(event) => setCoinSearchQuery(event.target.value)}
                            placeholder={t.coinSearchPlaceholder}
                            className={`w-full rounded-lg border py-2 ps-9 pe-3 text-xs outline-none ${
                              isDark
                                ? 'border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500 focus:border-blue-500'
                                : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                            }`}
                          />
                        </div>
                      </div>
                      <div id="coin-picker-options" role="listbox" aria-label={t.filterSelectCoin} className="max-h-80 overflow-y-auto p-1.5">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedCoinSymbol === 'ALL'}
                          onClick={() => {
                            setSelectedCoinSymbol('ALL');
                            setCoinSearchQuery('');
                            setCoinPickerOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-start text-xs transition-colors ${
                            selectedCoinSymbol === 'ALL'
                              ? 'bg-blue-600/15 text-blue-300'
                              : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2"><Layers className="h-4 w-4" />{t.filterAllCoins}</span>
                          <span className="text-[10px] text-slate-500">{data?.coins?.length ?? 0}</span>
                        </button>
                        {filteredCoins.length > 0 ? filteredCoins.map((coin) => {
                          const symbol = coin.symbol.toUpperCase();
                          const isSelected = selectedCoinSymbol === symbol;
                          return (
                            <button
                              key={coin.symbol}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setSelectedCoinSymbol(symbol);
                                setCoinSearchQuery('');
                                setCoinPickerOpen(false);
                              }}
                              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start transition-colors ${
                                isSelected
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <span className="min-w-14 rounded-md bg-slate-800/80 px-2 py-1 text-center font-mono text-[11px] font-bold">{coin.symbol}</span>
                                <span className="min-w-0">
                                  <span className="block truncate text-xs font-medium">{lang === 'fa' ? coin.nameFa : coin.nameEn}</span>
                                  {lang === 'fa' && <span className="block truncate text-[10px] text-slate-500">{coin.nameEn}</span>}
                                </span>
                              </span>
                              <span className="shrink-0 text-[10px] font-semibold text-emerald-400">
                                {formatPercent(coin.wallexSharePercent, lang)}
                              </span>
                            </button>
                          );
                        }) : (
                          <p className="px-3 py-5 text-center text-xs text-slate-500">
                            {lang === 'fa' ? 'رمزارزی با این نام پیدا نشد.' : 'No matching assets found.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {lang === 'fa' ? 'دسترسی سریع' : 'Quick select'}
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      id="coin-pill-all"
                      type="button"
                      aria-pressed={selectedCoinSymbol === 'ALL'}
                      onClick={() => {
                        setSelectedCoinSymbol('ALL');
                        setCoinSearchQuery('');
                        setCoinPickerOpen(false);
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        selectedCoinSymbol === 'ALL'
                          ? 'border-blue-500 bg-blue-600 text-white'
                          : isDark ? 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/60' : 'border-slate-200 bg-slate-100 text-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {t.filterAllCoins}
                    </button>
                    {QUICK_COIN_SYMBOLS.map((symbol) => {
                      const coin = data?.coins?.find((item) => item.symbol.toUpperCase() === symbol);
                      const isSelected = selectedCoinSymbol === symbol;
                      return (
                        <button
                          key={symbol}
                          id={`coin-pill-${symbol.toLowerCase()}`}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            setSelectedCoinSymbol(symbol);
                            setCoinSearchQuery('');
                            setCoinPickerOpen(false);
                          }}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                            isSelected
                              ? 'border-amber-400 bg-amber-500 text-slate-950 font-bold'
                              : isDark ? 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500' : 'border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-400'
                          }`}
                        >
                          <span className="font-mono font-bold">{symbol}</span>
                          {coin && <span className="text-[11px] opacity-75">{lang === 'fa' ? coin.nameFa : coin.nameEn}</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">
                      {lang === 'fa' ? 'همه رمزارزها' : 'Full asset list'}
                    </span>
                    <button
                      id="coin-grid-toggle"
                      type="button"
                      aria-expanded={allCoinsGridOpen}
                      aria-controls="all-coins-grid-panel"
                      onClick={() => {
                        setCoinPickerOpen(false);
                        setCoinSearchQuery('');
                        setAllCoinsGridOpen((open) => !open);
                      }}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        isDark
                          ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20'
                          : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                      }`}
                    >
                      <LayoutGrid className="h-4 w-4" />
                      {lang === 'fa'
                        ? `مشاهده همه ${toPersianDigits(data?.coins?.length ?? 0)} رمزارز`
                        : `View all ${data?.coins?.length ?? 0} assets`}
                      {allCoinsGridOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div
                    id="all-coins-grid-panel"
                    ref={allCoinsPanelRef}
                    aria-hidden={!allCoinsGridOpen}
                    className={`overflow-hidden ${allCoinsGridOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    style={{ height: 0, opacity: 0, visibility: 'hidden' }}
                  >
                    {allCoins.length > 0 ? (
                      <div
                        ref={muuriGridRef}
                        className="relative min-h-16 w-full"
                        aria-label={lang === 'fa' ? 'شبکه رمزارزها؛ برای مرتب‌سازی کارت‌ها را بکشید' : 'Asset grid; drag cards to rearrange'}
                      >
                        {allCoins.map((coin) => (
                          <button
                            key={coin.symbol}
                            type="button"
                            aria-pressed={selectedCoinSymbol === coin.symbol.toUpperCase()}
                            onClick={() => setSelectedCoinSymbol(coin.symbol.toUpperCase())}
                            className={`coin-grid-item absolute box-border w-1/2 p-1.5 text-start sm:w-1/3 lg:w-1/4 xl:w-1/6`}
                          >
                            <span className={`flex h-full min-h-20 flex-col justify-between rounded-xl border p-3 transition-colors ${
                              selectedCoinSymbol === coin.symbol.toUpperCase()
                                ? 'border-amber-400 bg-amber-500/10'
                                : isDark ? 'border-slate-700 bg-slate-900 hover:border-indigo-400/60' : 'border-slate-200 bg-white hover:border-indigo-300'
                            }`}>
                              <span className="flex items-center justify-between gap-1">
                                <span className="font-mono text-xs font-bold">{coin.symbol}</span>
                                <span className="text-[10px] font-semibold text-emerald-400">{formatPercent(coin.wallexSharePercent, lang)}</span>
                              </span>
                              <span className={`mt-2 truncate text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                {lang === 'fa' ? coin.nameFa : coin.nameEn}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="py-6 text-center text-xs text-slate-500">
                        {lang === 'fa' ? 'برای نمایش شبکه، جستجو را پاک کنید یا عبارت دیگری وارد کنید.' : 'Clear or change the search to show assets.'}
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>

            {/* REAL-TIME RECHARTS BAR CHART */}
            <div
              id="section-recharts-volume-comparison"
              className={`p-4 rounded-xl border ${
                isDark
                  ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/40">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold">
                      {selectedCoinSymbol === 'ALL'
                        ? lang === 'fa'
                          ? 'نمودار مقایسه حجم ۲۴ ساعته صرافی‌ها در کل بازار (Recharts)'
                          : 'Exchange Real-time 24h Volume Comparison (Recharts)'
                        : lang === 'fa'
                        ? `نمودار مقایسه حجم ۲۴ ساعته صرافی‌ها در رمزارز ${activeCoin ? activeCoin.nameFa : selectedCoinSymbol}`
                        : `24h Volume Comparison for ${selectedCoinSymbol} Across Exchanges`}
                    </h3>
                  </div>
                  <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {lang === 'fa'
                      ? 'مقایسه حجم معاملاتی صرافی‌های ایران به صورت زنده بر پایه میلیون تومان'
                      : 'Real-time trading volume comparison in Million Tomans (TMN)'}
                  </p>
                </div>

                {activeCoin && (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span
                      className={`text-[11px] px-2 py-1 rounded-md font-mono ${
                        isDark ? 'bg-slate-800 text-amber-300' : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {lang === 'fa' ? 'قیمت میانگین: ' : 'Avg Price: '}
                      {formatTomanVolume(activeCoin.lastPriceToman || 0, 'full', lang)}
                    </span>
                  </div>
                )}
              </div>

              {/* Recharts Bar Chart Container */}
              <div className="w-full h-72">
                {(() => {
                  const chartData = (data?.exchanges || []).map((ex) => {
                    let volumeToman = ex.totalVolumeToman;
                    let share = ex.marketSharePercent;

                    if (activeCoin && activeCoin.byExchange[ex.id]) {
                      volumeToman = activeCoin.byExchange[ex.id].volumeToman;
                      share = activeCoin.byExchange[ex.id].marketSharePercent;
                    }

                    const volumeMillionToman = Math.round(volumeToman / 1_000_000);

                    return {
                      id: ex.id,
                      name: lang === 'fa' ? ex.nameFa : ex.nameEn,
                      nameEn: ex.nameEn,
                      volumeMillionToman,
                      volumeToman,
                      marketSharePercent: share,
                      isWallex: ex.id === 'wallex',
                      isUserExchange: ex.id === userExchangeId,
                      fillColor:
                        ex.id === userExchangeId
                          ? '#2563EB' // Wallex / Selected exchange vibrant blue
                          : ex.id === 'nobitex'
                          ? '#1E3A8A'
                          : ex.id === 'bitpin'
                          ? '#0E7490'
                          : ex.id === 'ramzinex'
                          ? '#475569'
                          : ex.id === 'tabdeal'
                          ? '#334155'
                          : ex.id === 'bit24'
                          ? '#4338CA'
                          : '#64748B',
                    };
                  });

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 10, right: 15, left: 15, bottom: 25 }}
                      >
                        <XAxis
                          dataKey="name"
                          stroke={isDark ? '#64748B' : '#94A3B8'}
                          tick={{ fill: isDark ? '#94A3B8' : '#475569', fontSize: 12 }}
                          axisLine={{ stroke: isDark ? '#334155' : '#CBD5E1' }}
                          tickLine={false}
                        />
                        <YAxis
                          stroke={isDark ? '#64748B' : '#94A3B8'}
                          tick={{ fill: isDark ? '#94A3B8' : '#475569', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) => {
                            if (val >= 1000) return `${Math.round(val / 1000)}B`;
                            return `${val}M`;
                          }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const item = payload[0].payload;
                            return (
                              <div
                                className={`p-3 rounded-lg shadow-xl border text-xs ${
                                  isDark
                                    ? 'bg-[#0F172A] border-slate-700 text-slate-100'
                                    : 'bg-white border-slate-200 text-slate-800'
                                }`}
                              >
                                <div className="font-bold text-sm mb-1 flex items-center justify-between gap-3">
                                  <span>{item.name}</span>
                                  {item.isUserExchange && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-normal">
                                      {lang === 'fa' ? 'صرافی شما' : 'Your Exchange'}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-1 text-[11px]">
                                  <div className="flex justify-between gap-4 text-slate-400">
                                    <span>{lang === 'fa' ? 'حجم معاملاتی:' : 'Volume:'}</span>
                                    <span className="font-semibold text-blue-400">
                                      {formatTomanVolume(item.volumeToman, displayMode, lang)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4 text-slate-400">
                                    <span>{lang === 'fa' ? 'سهم از بازار:' : 'Market Share:'}</span>
                                    <span className="font-semibold text-emerald-400">
                                      {formatPercent(item.marketSharePercent, lang)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="volumeMillionToman"
                          radius={[6, 6, 0, 0]}
                          animationDuration={800}
                        >
                          {chartData.map((entry) => (
                            <Cell
                              key={`cell-${entry.id}`}
                              fill={entry.fillColor}
                              stroke={entry.isUserExchange ? '#60A5FA' : 'transparent'}
                              strokeWidth={entry.isUserExchange ? 2 : 0}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>

            {/* SINGLE SELECTED COIN DEEP DIVE (When a coin is selected) */}
            {activeCoin && (
              <div
                id="single-coin-detail-card"
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/40">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-sm text-amber-400">
                      {activeCoin.symbol}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">
                        {lang === 'fa'
                          ? `جزئیات حجم و توزیع نقدینگی ${activeCoin.nameFa} (${activeCoin.symbol})`
                          : `${activeCoin.nameEn} (${activeCoin.symbol}) Volume Breakdown`}
                      </h3>
                      <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {lang === 'fa'
                          ? `حجم کل ۲۴ساعته در تمام صرافی‌ها: ${formatTomanVolume(activeCoin.totalVolumeToman, displayMode, lang)}`
                          : `Total 24h Volume Across Exchanges: ${formatTomanVolume(activeCoin.totalVolumeToman, displayMode, lang)}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className={`px-3 py-1.5 rounded-lg border text-xs ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <span className="text-slate-400 block text-[10px]">
                        {t.wallexShareInCoin}
                      </span>
                      <span className="font-bold text-blue-400">
                        {formatPercent(activeCoin.wallexSharePercent, lang)}
                      </span>
                    </div>

                    <div
                      className={`px-3 py-1.5 rounded-lg border text-xs ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <span className="text-slate-400 block text-[10px]">
                        {t.leaderInCoin}
                      </span>
                      <span className="font-bold text-amber-400">
                        {(() => {
                          const topEx = data?.exchanges?.find((e) => e.id === activeCoin.topExchangeId);
                          return topEx ? (lang === 'fa' ? topEx.nameFa : topEx.nameEn) : activeCoin.topExchangeId;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Per Exchange Table for Selected Coin */}
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead>
                      <tr
                        className={`border-b ${
                          isDark
                            ? 'bg-slate-900/90 border-slate-800 text-slate-400'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <th className="py-2.5 px-3 text-start font-semibold">{t.colExchange}</th>
                        <th className="py-2.5 px-3 text-start font-semibold">{t.coinVolumeToman}</th>
                        <th className="py-2.5 px-3 text-start font-semibold">{t.coinVolumeQty}</th>
                        <th className="py-2.5 px-3 text-start font-semibold">{t.coinLastPrice}</th>
                        <th className="py-2.5 px-3 text-start font-semibold">{t.colMarketShare}</th>
                        <th className="py-2.5 px-3 text-start font-semibold">{t.colStatus}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {data?.exchanges?.map((ex) => {
                        const coinStat = activeCoin.byExchange[ex.id];
                        const isUserEx = ex.id === userExchangeId;
                        const volTmn = coinStat?.volumeToman || 0;
                        const volQty = coinStat?.volumeQty || 0;
                        const price = coinStat?.lastPriceToman || activeCoin.lastPriceToman;
                        const share = coinStat?.marketSharePercent || 0;

                        return (
                          <tr
                            key={ex.id}
                            className={`transition-colors ${
                              isUserEx
                                ? isDark
                                  ? 'bg-blue-950/20'
                                  : 'bg-blue-50/50'
                                : isDark
                                ? 'hover:bg-slate-900/40'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px]"
                                  style={{
                                    backgroundColor: exchangeColors[ex.id]?.bg || '#1E293B',
                                    color: exchangeColors[ex.id]?.text || '#FFFFFF',
                                  }}
                                >
                                  {ex.nameEn.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="font-bold">
                                  {lang === 'fa' ? ex.nameFa : ex.nameEn}
                                </span>
                                {isUserEx && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-blue-500/20 text-blue-400">
                                    {lang === 'fa' ? 'صرافی شما' : 'Your Exchange'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap font-bold text-blue-400">
                              {formatTomanVolume(volTmn, displayMode, lang)}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                              {formatCount(volQty, lang)} {activeCoin.symbol}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                              {formatTomanVolume(price || 0, 'full', lang)}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${Math.min(100, share)}%` }}
                                  />
                                </div>
                                <span className="font-semibold text-[11px]">
                                  {formatPercent(share, lang)}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  ex.status === 'live'
                                    ? isDark
                                      ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : isDark
                                    ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {ex.status === 'live' ? t.statusLive : t.statusBenchmark}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        </>
        )}

        {/* /OFFICIAL DIDEHBON FOOTER REMOVED */}
      </div>
    </div>
  );
}
