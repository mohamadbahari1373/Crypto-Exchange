'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
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
  ExternalLink,
  HelpCircle,
  Clock,
  ArrowUpRight,
  Sparkles,
  Zap,
  Target,
  Users,
  Coins,
  Search,
  ArrowUpDown,
  Newspaper,
  Network,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
} from 'lucide-react';
import NewsFeed from '@/components/NewsFeed';
import NetworkExplorer from '@/components/NetworkExplorer';
import MoneyFlowSankey from '@/components/MoneyFlowSankey';
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

export default function VolumeDashboard() {
  const [data, setData] = useState<VolumeApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  // User Preferences
  const [lang, setLang] = useState<Language>('fa');
  const [theme, setTheme] = useState<Theme>('dark');
  const [displayMode, setDisplayMode] = useState<NumberDisplayMode>('hemat');
  const [userExchangeId, setUserExchangeId] = useState<string>('wallex'); // Wallex default as user is from Wallex
  const [mainSection, setMainSection] = useState<'volumes' | 'flow' | 'news' | 'networks'>('volumes');
  const [activeTab, setActiveTab] = useState<'table' | 'coins' | 'cx' | 'security'>('coins');
  const [selectedCoinSymbol, setSelectedCoinSymbol] = useState<string>('ALL');
  const [coinSearchQuery, setCoinSearchQuery] = useState<string>('');
  const [hoveredExchangeId, setHoveredExchangeId] = useState<string | null>(null);

  const t = translations[lang];
  const isRtl = lang === 'fa';

  // Fetch exchange volume data
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/exchanges', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const json: VolumeApiResponse = await res.json();
      setData(json);
      setLastRefreshedAt(new Date());
      setSecondsAgo(0);
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
        const res = await fetch('/api/exchanges', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        const json: VolumeApiResponse = await res.json();
        if (isMounted) {
          setData(json);
          setLastRefreshedAt(new Date());
          setSecondsAgo(0);
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

  // Update "seconds ago" timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefreshedAt.getTime()) / 1000));
    }, 2000);
    return () => clearInterval(timer);
  }, [lastRefreshedAt]);

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

  // Selected coin details
  const activeCoin = useMemo(() => {
    const coinList = data?.coins;
    if (!coinList || selectedCoinSymbol === 'ALL') return null;
    return coinList.find((c) => c.symbol === selectedCoinSymbol) || null;
  }, [data, selectedCoinSymbol]);

  const isDark = theme === 'dark';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`min-h-screen transition-colors duration-200 ${
        isDark
          ? 'bg-[#090D16] text-slate-100 selection:bg-slate-700 selection:text-white'
          : 'bg-[#F4F6F9] text-slate-900 selection:bg-slate-200 selection:text-slate-900'
      }`}
    >
      {/* Container with constrained max-width for less-is-more elegance */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
        {/* TOP BAR / NAVIGATION - Less is More */}
        <header
          id="app-header"
          className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border ${
            isDark
              ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
              : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-inner ${
                isDark ? 'bg-blue-950/80 text-blue-400 border border-blue-900/60' : 'bg-blue-50 text-blue-700 border border-blue-100'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  {t.appTitle}
                </h1>
              </div>
            </div>
          </div>

          {/* Minimalist Controls & Tool Options */}
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end flex-wrap">
            {/* Primary Tool Switcher (Volume Comparison vs Exchange & Crypto News) */}
            <div
              id="tool-primary-switcher"
              className={`flex items-center p-1 rounded-xl border text-xs font-semibold shadow-xs ${
                isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-slate-100 border-slate-300/80'
              }`}
            >
              <button
                id="btn-nav-volumes"
                onClick={() => setMainSection('volumes')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  mainSection === 'volumes'
                    ? isDark
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                      : 'bg-white text-blue-700 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{t.navVolumes}</span>
              </button>

              <button
                id="btn-nav-flow"
                onClick={() => setMainSection('flow')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all relative ${
                  mainSection === 'flow'
                    ? isDark
                      ? 'bg-gradient-to-r from-amber-500 to-emerald-600 text-slate-950 font-bold shadow-sm shadow-amber-900/40'
                      : 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : isDark
                    ? 'text-amber-400/90 hover:text-amber-300'
                    : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>{t.navFlow}</span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              </button>

              <button
                id="btn-nav-news"
                onClick={() => setMainSection('news')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all relative ${
                  mainSection === 'news'
                    ? isDark
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                      : 'bg-white text-blue-700 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Newspaper className="w-3.5 h-3.5" />
                <span>{t.navNews}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </button>

              <button
                id="btn-nav-networks"
                onClick={() => setMainSection('networks')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all relative ${
                  mainSection === 'networks'
                    ? isDark
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                      : 'bg-white text-blue-700 shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>{t.navNetworks}</span>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              </button>
            </div>

            <div className={`h-5 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-300'}`} />

            {/* Display Mode Toggle (Hemat vs Billion vs Full) */}
            <div
              className={`flex items-center p-0.5 rounded-lg border text-xs font-medium ${
                isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <button
                id="btn-mode-hemat"
                onClick={() => setDisplayMode('hemat')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  displayMode === 'hemat'
                    ? isDark
                      ? 'bg-slate-800 text-blue-400 font-semibold shadow-sm'
                      : 'bg-white text-blue-700 font-semibold shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t.displayModeHemat}
              >
                {lang === 'fa' ? 'همت' : 'Hemat'}
              </button>
              <button
                id="btn-mode-compact"
                onClick={() => setDisplayMode('compact')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  displayMode === 'compact'
                    ? isDark
                      ? 'bg-slate-800 text-blue-400 font-semibold shadow-sm'
                      : 'bg-white text-blue-700 font-semibold shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t.displayModeCompact}
              >
                {lang === 'fa' ? 'میلیارد' : 'Billion'}
              </button>
              <button
                id="btn-mode-full"
                onClick={() => setDisplayMode('full')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  displayMode === 'full'
                    ? isDark
                      ? 'bg-slate-800 text-blue-400 font-semibold shadow-sm'
                      : 'bg-white text-blue-700 font-semibold shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t.displayModeFull}
              >
                {lang === 'fa' ? 'کامل' : 'Full'}
              </button>
            </div>

            {/* Language Switcher */}
            <button
              id="btn-lang-toggle"
              onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                isDark
                  ? 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-white'
              }`}
              title="تغییر زبان / Switch Language"
            >
              {lang === 'fa' ? 'EN' : 'فا'}
            </button>

            {/* Theme Switcher */}
            <button
              id="btn-theme-toggle"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`p-1.5 rounded-lg border transition-all ${
                isDark
                  ? 'bg-slate-900/90 border-slate-800 text-amber-300 hover:bg-slate-800'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-white'
              }`}
              title={isDark ? t.themeLight : t.themeDark}
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Refresh Button */}
            <button
              id="btn-refresh"
              onClick={fetchData}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                loading
                  ? 'opacity-60 cursor-not-allowed'
                  : isDark
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-900/30'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t.refresh}</span>
            </button>
          </div>
        </header>

        {/* MAIN SECTION CONDITIONAL: VOLUMES VS FLOW VS NEWS VS NETWORKS */}
        {mainSection === 'flow' ? (
          <MoneyFlowSankey isDark={isDark} lang={lang} />
        ) : mainSection === 'news' ? (
          <NewsFeed lang={lang} theme={theme} />
        ) : mainSection === 'networks' ? (
          <NetworkExplorer lang={lang} theme={theme} />
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
            {/* REFRESH STATUS STRIP */}
            <div
              className={`flex items-center justify-between text-xs px-2 -mt-2 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              {t.lastUpdate}:{' '}
              {secondsAgo < 5
                ? t.justNow
                : `${lang === 'fa' ? toPersianDigits(secondsAgo) : secondsAgo} ${t.secondsAgo}`}
            </span>
          </div>
          {data?.cached && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded ${
                isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200/70 text-slate-600'
              }`}
            >
              {t.statusCached} ({lang === 'fa' ? toPersianDigits(data.cacheAgeSeconds || 0) : data.cacheAgeSeconds}s)
            </span>
          )}
        </div>

        {/* 4 CORE KPI METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Market Volume */}
          <div
            id="metric-total-market"
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

          <button
            id="tab-btn-cx"
            onClick={() => setActiveTab('cx')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-1 whitespace-nowrap ${
              activeTab === 'cx'
                ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>{t.tabCxAnalysis}</span>
          </button>

          <button
            id="tab-btn-security"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-1 whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                : isDark
                ? 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{t.tabSecurity}</span>
          </button>

          <button
            id="tab-btn-flow-shortcut"
            onClick={() => setMainSection('flow')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 -mb-1 whitespace-nowrap ${
              isDark
                ? 'border-transparent text-amber-400 hover:bg-amber-500/10'
                : 'border-transparent text-amber-600 hover:bg-amber-50'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>{lang === 'fa' ? 'جریان زنده پول (Sankey)' : 'Money Flow (Sankey)'}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
            {/* Header with Search and Coin Filter Pills */}
            <div
              className={`p-4 rounded-xl border ${
                isDark
                  ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800/40">
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

                {/* Coin Search Input */}
                <div className="w-full md:w-72 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="coin-search-input"
                    type="text"
                    value={coinSearchQuery}
                    onChange={(e) => setCoinSearchQuery(e.target.value)}
                    placeholder={t.coinSearchPlaceholder}
                    className={`w-full ps-9 pe-3 py-1.5 text-xs rounded-lg border outline-none transition-all ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                    }`}
                  />
                  {coinSearchQuery && (
                    <button
                      onClick={() => setCoinSearchQuery('')}
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Coin Quick-Select Pills */}
              <div className="pt-3">
                <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center justify-between">
                  <span>{t.filterSelectCoin}</span>
                  <span className="text-[10px] text-slate-500">
                    {lang === 'fa' ? `${filteredCoins.length} رمزارز فعال` : `${filteredCoins.length} active coins`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    id="coin-pill-all"
                    onClick={() => setSelectedCoinSymbol('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedCoinSymbol === 'ALL'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : isDark
                        ? 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{t.filterAllCoins}</span>
                  </button>

                  {filteredCoins.map((coin) => {
                    const isSelected = selectedCoinSymbol === coin.symbol;
                    return (
                      <button
                        key={coin.symbol}
                        id={`coin-pill-${coin.symbol.toLowerCase()}`}
                        onClick={() => setSelectedCoinSymbol(coin.symbol)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : isDark
                            ? 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <span className="font-mono text-[11px]">{coin.symbol}</span>
                        <span className="text-[11px] opacity-80">
                          {lang === 'fa' ? coin.nameFa : coin.nameEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
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

        {/* TAB 2: CX & COMPETITIVE ANALYSIS */}
        {activeTab === 'cx' && (
          <div id="section-cx-analysis" className="flex flex-col gap-5">
            {/* Header banner */}
            <div
              className={`p-4 rounded-xl border ${
                isDark
                  ? 'bg-[#0F172A] border-slate-800/80'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" />
                <h2 className="text-base sm:text-lg font-bold">
                  {t.cxSectionTitle}
                </h2>
              </div>
              <p
                className={`text-xs mt-1 max-w-3xl ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                {t.cxSectionSubtitle}
              </p>
            </div>

            {/* Gap Analysis Card */}
            <div
              className={`p-5 rounded-xl border ${
                isDark
                  ? 'bg-[#0F172A] border-blue-900/40'
                  : 'bg-white border-blue-200'
              }`}
            >
              <h3 className="text-sm font-bold text-blue-400 mb-2">
                {t.gapAnalysisTitle}
              </h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {t.gapAnalysisDesc}
              </p>

              {/* Comparative Stats Box */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div
                  className={`p-3 rounded-lg border ${
                    isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {lang === 'fa' ? 'صرافی مبنای شما' : 'Your Exchange'} (
                    {lang === 'fa' ? selectedExchange?.nameFa : selectedExchange?.nameEn})
                  </span>
                  <span className="text-base font-bold text-blue-400">
                    {formatTomanVolume(selectedExchange?.totalVolumeToman || 0, 'compact', lang)}
                  </span>
                  <span className="text-[10px] block text-slate-500 mt-0.5">
                    {formatPercent(selectedExchange?.marketSharePercent || 0, lang)} {t.marketShare}
                  </span>
                </div>

                <div
                  className={`p-3 rounded-lg border ${
                    isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {lang === 'fa' ? 'رهبر فعلی بازار' : 'Current Market Leader'} (
                    {lang === 'fa' ? leaderExchange?.nameFa : leaderExchange?.nameEn})
                  </span>
                  <span className="text-base font-bold text-amber-400">
                    {formatTomanVolume(leaderExchange?.totalVolumeToman || 0, 'compact', lang)}
                  </span>
                  <span className="text-[10px] block text-slate-500 mt-0.5">
                    {formatPercent(leaderExchange?.marketSharePercent || 0, lang)} {t.marketShare}
                  </span>
                </div>

                <div
                  className={`p-3 rounded-lg border ${
                    isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {lang === 'fa' ? 'شکاف نقدینگی و حجم' : 'Volume / Liquidity Gap'}
                  </span>
                  <span className="text-base font-bold text-rose-400">
                    {formatTomanVolume(leaderGapToman, 'compact', lang)}
                  </span>
                  <span className="text-[10px] block text-slate-500 mt-0.5">
                    {selectedExchange?.id === leaderExchange?.id
                      ? lang === 'fa'
                        ? 'در صدر بازار'
                        : 'At the top'
                      : lang === 'fa'
                      ? 'کسری سهم جهت رقابت مستقیم'
                      : 'Deficit to capture leadership'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Diagnostic Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pillar 1: Liquidity & Slippage */}
              <div
                className={`p-4 rounded-xl border ${
                  isDark ? 'bg-[#0F172A] border-slate-800/80' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded bg-blue-500/10 text-blue-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold">{t.liquidityTitle}</h4>
                </div>
                <p
                  className={`text-xs leading-relaxed ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {t.liquidityDesc}
                </p>
              </div>

              {/* Pillar 2: Market Breadth & Altcoin Agility */}
              <div
                className={`p-4 rounded-xl border ${
                  isDark ? 'bg-[#0F172A] border-slate-800/80' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded bg-cyan-500/10 text-cyan-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold">{t.marketBreadthTitle}</h4>
                </div>
                <p
                  className={`text-xs leading-relaxed ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {t.marketBreadthDesc}
                </p>
              </div>

              {/* Pillar 3: Instant Swap / OTC UX */}
              <div
                className={`p-4 rounded-xl border ${
                  isDark ? 'bg-[#0F172A] border-slate-800/80' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded bg-amber-500/10 text-amber-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold">{t.onboardingTitle}</h4>
                </div>
                <p
                  className={`text-xs leading-relaxed ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {t.onboardingDesc}
                </p>
              </div>

              {/* Pillar 4: Fiat Settlement Speed */}
              <div
                className={`p-4 rounded-xl border ${
                  isDark ? 'bg-[#0F172A] border-slate-800/80' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold">{t.speedTitle}</h4>
                </div>
                <p
                  className={`text-xs leading-relaxed ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {t.speedDesc}
                </p>
              </div>
            </div>

            {/* Market Share Growth Simulator (Interactive Value for CX Specialist) */}
            <div
              className={`p-4 rounded-xl border ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300">
                  {lang === 'fa'
                    ? 'محاسبه ارزش اقتصادی هر ۱٪ ارتقای سهم بازار'
                    : 'Economic Value of +1% Market Share Gain'}
                </span>
                <span className="text-xs font-bold text-emerald-400">
                  +
                  {formatTomanVolume(
                    (data?.grandTotalToman || 0) * 0.01,
                    displayMode,
                    lang
                  )}
                </span>
              </div>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {lang === 'fa'
                  ? `با توجه به مجموع معاملات روزانه بازار، کاهش اصطکاک تجربه کاربری و افزایش تنها ۱٪ سهم بازار، روزانه حجم معاملاتی به ارزش بیش از ${formatTomanVolume(
                      (data?.grandTotalToman || 0) * 0.01,
                      'compact',
                      lang
                    )} به صرافی شما سرازیر می‌کند.`
                  : `With total daily market trading volume, capturing just +1% market share from competitors brings ${formatTomanVolume(
                      (data?.grandTotalToman || 0) * 0.01,
                      'compact',
                      lang
                    )} in incremental volume to your exchange.`}
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: PLL SECURITY & API SPECS */}
        {activeTab === 'security' && (
          <div id="section-security" className="flex flex-col gap-4">
            {/* Security Banner */}
            <div
              className={`p-5 rounded-xl border ${
                isDark
                  ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold">{t.securityTitle}</h3>
              </div>
              <p
                className={`text-xs leading-relaxed ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                {t.securitySubtitle}
              </p>
            </div>

            {/* 3 Security Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className={`p-4 rounded-xl border ${
                  isDark ? 'bg-[#0F172A] border-slate-800/80' : 'bg-white border-slate-200'
                }`}
              >
                <div className="font-bold text-xs text-blue-400 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  {t.ssrfProtectionTitle}
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t.ssrfProtectionDesc}
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  isDark ? 'bg-[#0F172A] border-slate-800/80' : 'bg-white border-slate-200'
                }`}
              >
                <div className="font-bold text-xs text-emerald-400 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {t.piiProtectionTitle}
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t.piiProtectionDesc}
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  isDark ? 'bg-[#0F172A] border-slate-800/80' : 'bg-white border-slate-200'
                }`}
              >
                <div className="font-bold text-xs text-indigo-400 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  {t.rateLimitTitle}
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t.rateLimitDesc}
                </p>
              </div>
            </div>

            {/* List of APIs Provided by User & Protocol Status */}
            <div
              className={`p-4 rounded-xl border ${
                isDark ? 'bg-[#0F172A] border-slate-800/80' : 'bg-white border-slate-200'
              }`}
            >
              <h4 className="text-xs font-bold mb-3 tracking-wide">
                {lang === 'fa' ? 'فهرست اندپوینت‌های رسمی صرافی‌ها' : 'Official Exchange API Endpoints & Health'}
              </h4>
              <div className="space-y-2 text-xs">
                {data?.exchanges?.map((ex) => (
                  <div
                    key={ex.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border gap-2 ${
                      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-400">
                        {lang === 'fa' ? ex.nameFa : ex.nameEn}
                      </span>
                      <code
                        className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                          isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700'
                        }`}
                      >
                        {ex.apiUrl}
                      </code>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          ex.status === 'live'
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            ex.status === 'live' ? 'bg-emerald-400' : 'bg-slate-400'
                          }`}
                        />
                        {ex.status === 'live'
                          ? lang === 'fa'
                            ? 'اتصال زنده سرور'
                            : 'Live Server Connection'
                          : lang === 'fa'
                          ? 'پایش داده مرجع'
                          : 'Benchmark Tracked'}
                      </span>
                      <a
                        href={ex.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                        title="Website"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
