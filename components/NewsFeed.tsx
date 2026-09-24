'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Newspaper,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Building2,
  TrendingUp,
  Globe,
  Tag,
  CheckCircle2,
  Languages,
  Workflow,
  Send,
  Share2,
  Sparkles,
} from 'lucide-react';
import {
  NewsArticle,
  NewsApiResponse,
  NewsCategoryFilter,
  NewsSourceId,
  Language,
  Theme,
} from '@/lib/types';
import { translations } from '@/lib/translations';
import { toPersianDigits } from '@/lib/formatters';
import N8nTelegramNewsModal from '@/components/N8nTelegramNewsModal';

interface NewsFeedProps {
  lang: Language;
  theme: Theme;
}

interface NewsCardImageProps {
  src?: string;
  alt: string;
  source: NewsSourceId;
  isDark: boolean;
}

function NewsCardImage({ src, alt, source, isDark }: NewsCardImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const sourceGradient = {
    arzdigital: 'from-emerald-950/80 via-slate-900 to-slate-950',
    mihansignal: 'from-amber-950/80 via-slate-900 to-slate-950',
    mihanblockchain: 'from-cyan-950/80 via-slate-900 to-slate-950',
    cryptopotato: 'from-purple-950/80 via-slate-900 to-slate-950',
    coindesk: 'from-sky-950/80 via-slate-900 to-slate-950',
    all: 'from-blue-950/80 via-slate-900 to-slate-950',
  }[source] || 'from-blue-950/80 via-slate-900 to-slate-950';

  if (!src || error) {
    return (
      <div
        className={`w-full h-44 sm:h-48 rounded-lg overflow-hidden flex flex-col items-center justify-center relative bg-gradient-to-br ${sourceGradient} border ${
          isDark ? 'border-slate-800/80' : 'border-slate-200'
        }`}
      >
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
        <Newspaper className="w-9 h-9 text-slate-400/50 mb-1 z-10" />
        <span className="text-[10px] font-semibold text-slate-400/80 z-10 font-mono tracking-wider uppercase">
          {source}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-44 sm:h-48 rounded-lg overflow-hidden relative border transition-all ${
        isDark ? 'border-slate-800/80 bg-slate-900' : 'border-slate-200 bg-slate-100'
      }`}
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-slate-800/40 flex items-center justify-center z-0">
          <Newspaper className="w-8 h-8 text-slate-600/40" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* Subtle bottom gradient shadow */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
    </div>
  );
}

export default function NewsFeed({ lang, theme }: NewsFeedProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<NewsCategoryFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<NewsSourceId>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(() => Date.now());
  const [n8nModalOpen, setN8nModalOpen] = useState<boolean>(false);
  const [selectedArticleForN8n, setSelectedArticleForN8n] = useState<NewsArticle | undefined>(undefined);

  const t = translations[lang];
  const isDark = theme === 'dark';
  const isRtl = lang === 'fa';

  const fetchNews = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/news', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: NewsApiResponse = await res.json();
      if (data && Array.isArray(data.articles)) {
        setArticles(data.articles);
        setLastUpdated(new Date(data.lastUpdated || Date.now()));
        setCurrentTimeMs(Date.now());
      }
    } catch (err: any) {
      console.error('Error fetching news:', err);
      setError(err.message || 'خطا در بارگذاری اخبار');
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const initialLoad = async () => {
      try {
        const res = await fetch('/api/news', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: NewsApiResponse = await res.json();
        if (isMounted && data && Array.isArray(data.articles)) {
          setArticles(data.articles);
          setLastUpdated(new Date(data.lastUpdated || Date.now()));
          setCurrentTimeMs(Date.now());
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'خطا در بارگذاری اخبار');
          setLoading(false);
        }
      }
    };

    initialLoad();

    const interval = setInterval(() => {
      initialLoad();
    }, 90000); // 90 seconds auto refresh

    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 30000); // 30 seconds time update

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(timer);
    };
  }, []);

  // Filtered Articles
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      // Source filter
      if (sourceFilter !== 'all' && art.source !== sourceFilter) {
        return false;
      }
      // Category filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'exchanges' && art.category !== 'exchanges') {
          return false;
        }
        if (categoryFilter === 'market' && art.category !== 'market') {
          return false;
        }
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = art.title.toLowerCase().includes(q);
        const matchesSummary = art.summary.toLowerCase().includes(q);
        const matchesAuthor = art.author?.toLowerCase().includes(q);
        return matchesTitle || matchesSummary || matchesAuthor;
      }
      return true;
    });
  }, [articles, sourceFilter, categoryFilter, searchQuery]);

  // Counts for tabs
  const exchangeCount = useMemo(
    () => articles.filter((a) => a.category === 'exchanges').length,
    [articles]
  );
  const marketCount = useMemo(
    () => articles.filter((a) => a.category === 'market').length,
    [articles]
  );

  // Time-ago formatter using state timestamp instead of impure Date.now()
  const formatTimeAgo = (isoDate: string): string => {
    try {
      const diffMs = currentTimeMs - new Date(isoDate).getTime();
      const diffMins = Math.max(1, Math.floor(diffMs / 60000));
      if (diffMins < 60) {
        return lang === 'fa'
          ? `${toPersianDigits(diffMins)} دقیقه ${t.newsTimeAgo}`
          : `${diffMins}m ${t.newsTimeAgo}`;
      }
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return lang === 'fa'
          ? `${toPersianDigits(diffHours)} ساعت ${t.newsTimeAgo}`
          : `${diffHours}h ${t.newsTimeAgo}`;
      }
      const diffDays = Math.floor(diffHours / 24);
      return lang === 'fa'
        ? `${toPersianDigits(diffDays)} روز ${t.newsTimeAgo}`
        : `${diffDays}d ${t.newsTimeAgo}`;
    } catch {
      return '';
    }
  };

  return (
    <div id="crypto-news-module" className="flex flex-col gap-6">
      {/* HEADER CONTROLS & FILTER BAR */}
      <div
        id="news-control-card"
        className={`p-4 sm:p-5 rounded-xl border ${
          isDark
            ? 'bg-[#0F172A] border-slate-800/80 shadow-lg shadow-black/20'
            : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800/40">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-inner ${
                isDark
                  ? 'bg-blue-950/80 text-blue-400 border border-blue-900/60'
                  : 'bg-blue-50 text-blue-700 border border-blue-100'
              }`}
            >
              <Newspaper className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  {t.navNews}
                </h2>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    isDark
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {lang === 'fa' ? 'فید زنده' : 'Live RSS & API'}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.navNewsDesc}
              </p>
            </div>
          </div>

          {/* Quick Refresh & Source Badges */}
          <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end flex-wrap">
            {/* n8n & Telegram API Bridge Button */}
            <button
              onClick={() => {
                setSelectedArticleForN8n(filteredArticles[0]);
                setN8nModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white cursor-pointer"
            >
              <Workflow className="w-3.5 h-3.5 animate-pulse" />
              <span>{lang === 'fa' ? 'اتصال API به n8n و تلگرام' : 'n8n & Telegram API'}</span>
            </button>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {lastUpdated.toLocaleTimeString(lang === 'fa' ? 'fa-IR' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <button
              id="btn-refresh-news"
              onClick={() => fetchNews(true)}
              disabled={refreshing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                isDark
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
              <span>{refreshing ? t.refreshing : t.refresh}</span>
            </button>
          </div>
        </div>

        {/* SEARCH AND FILTER BUTTONS */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search
              className={`absolute top-2.5 w-4 h-4 text-slate-400 ${
                isRtl ? 'right-3' : 'left-3'
              }`}
            />
            <input
              id="input-news-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.newsSearchPlaceholder}
              className={`w-full text-xs rounded-lg py-2 border transition-all focus:outline-hidden ${
                isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
              } ${
                isDark
                  ? 'bg-slate-900/90 border-slate-800 text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute top-2 text-xs text-slate-400 hover:text-slate-200 ${
                  isRtl ? 'left-3' : 'right-3'
                }`}
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div
            className={`flex items-center p-0.5 rounded-lg border text-xs font-medium self-stretch sm:self-auto ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              id="filter-category-all"
              onClick={() => setCategoryFilter('all')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition-all ${
                categoryFilter === 'all'
                  ? isDark
                    ? 'bg-slate-800 text-blue-400 font-semibold shadow-sm'
                    : 'bg-white text-blue-700 font-semibold shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.newsAll} ({lang === 'fa' ? toPersianDigits(articles.length) : articles.length})
            </button>

            <button
              id="filter-category-exchanges"
              onClick={() => setCategoryFilter('exchanges')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                categoryFilter === 'exchanges'
                  ? isDark
                    ? 'bg-slate-800 text-blue-400 font-semibold shadow-sm'
                    : 'bg-white text-blue-700 font-semibold shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{t.newsExchanges}</span>
              <span className="text-[10px] opacity-75 font-mono">
                ({lang === 'fa' ? toPersianDigits(exchangeCount) : exchangeCount})
              </span>
            </button>

            <button
              id="filter-category-market"
              onClick={() => setCategoryFilter('market')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                categoryFilter === 'market'
                  ? isDark
                    ? 'bg-slate-800 text-blue-400 font-semibold shadow-sm'
                    : 'bg-white text-blue-700 font-semibold shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{t.newsMarket}</span>
              <span className="text-[10px] opacity-75 font-mono">
                ({lang === 'fa' ? toPersianDigits(marketCount) : marketCount})
              </span>
            </button>
          </div>

          {/* Source Filter */}
          <div
            className={`flex items-center p-0.5 rounded-lg border text-xs font-medium self-stretch sm:self-auto flex-wrap gap-0.5 ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              id="filter-source-all"
              onClick={() => setSourceFilter('all')}
              className={`px-2.5 py-1.5 rounded-md transition-all ${
                sourceFilter === 'all'
                  ? isDark
                    ? 'bg-slate-800 text-slate-100 font-semibold shadow-sm'
                    : 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.newsSourceAll}
            </button>

            <button
              id="filter-source-arzdigital"
              onClick={() => setSourceFilter('arzdigital')}
              className={`px-2.5 py-1.5 rounded-md transition-all ${
                sourceFilter === 'arzdigital'
                  ? isDark
                    ? 'bg-emerald-950/80 text-emerald-300 font-semibold shadow-sm border border-emerald-800/60'
                    : 'bg-emerald-50 text-emerald-800 font-semibold shadow-xs border border-emerald-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.newsSourceArzdigital}
            </button>

            <button
              id="filter-source-mihansignal"
              onClick={() => setSourceFilter('mihansignal')}
              className={`px-2.5 py-1.5 rounded-md transition-all ${
                sourceFilter === 'mihansignal'
                  ? isDark
                    ? 'bg-amber-950/80 text-amber-300 font-semibold shadow-sm border border-amber-800/60'
                    : 'bg-amber-50 text-amber-800 font-semibold shadow-xs border border-amber-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.newsSourceMihansignal}
            </button>

            <button
              id="filter-source-mihanblockchain"
              onClick={() => setSourceFilter('mihanblockchain')}
              className={`px-2.5 py-1.5 rounded-md transition-all ${
                sourceFilter === 'mihanblockchain'
                  ? isDark
                    ? 'bg-cyan-950/80 text-cyan-300 font-semibold shadow-sm border border-cyan-800/60'
                    : 'bg-cyan-50 text-cyan-800 font-semibold shadow-xs border border-cyan-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.newsSourceMihanblockchain}
            </button>

            <button
              id="filter-source-cryptopotato"
              onClick={() => setSourceFilter('cryptopotato')}
              className={`px-2.5 py-1.5 rounded-md transition-all ${
                sourceFilter === 'cryptopotato'
                  ? isDark
                    ? 'bg-purple-950/80 text-purple-300 font-semibold shadow-sm border border-purple-800/60'
                    : 'bg-purple-50 text-purple-800 font-semibold shadow-xs border border-purple-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.newsSourceCryptopotato}
            </button>

            <button
              id="filter-source-coindesk"
              onClick={() => setSourceFilter('coindesk')}
              className={`px-2.5 py-1.5 rounded-md transition-all ${
                sourceFilter === 'coindesk'
                  ? isDark
                    ? 'bg-sky-950/80 text-sky-300 font-semibold shadow-sm border border-sky-800/60'
                    : 'bg-sky-50 text-sky-800 font-semibold shadow-xs border border-sky-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.newsSourceCoindesk}
            </button>
          </div>
        </div>

        {/* Active Filters Summary */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {lang === 'fa'
              ? `${toPersianDigits(filteredArticles.length)} ${t.newsFilterCount}`
              : `${filteredArticles.length} ${t.newsFilterCount}`}
          </span>
          <div className="flex items-center gap-2">
            <span>
              {lang === 'fa'
                ? 'فیدهای متصل: ارزدیجیتال (RSS)، میهن سیگنال (API)، میهن بلاکچین (WP/RSS)، کریپتو پوتیتو (RSS) و کوین‌دسک (CoinDesk RSS)'
                : 'Connected feeds: ArzDigital (RSS), MihanSignal (API), MihanBlockchain (WP/RSS), CryptoPotato (RSS) & CoinDesk (RSS)'}
            </span>
          </div>
        </div>
      </div>

      {/* ARTICLES GRID / LIST */}
      {loading ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <p className="text-sm text-slate-400">{t.refreshing}</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div
          className={`p-12 text-center rounded-xl border ${
            isDark ? 'bg-[#0F172A] border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-40 text-slate-400" />
          <h3 className="font-bold text-base mb-1">{t.newsEmptyTitle}</h3>
          <p className="text-xs text-slate-500">{t.newsEmptyDesc}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredArticles.map((article) => {
            const isExchangeCategory = article.category === 'exchanges';
            const isMihan = article.source === 'mihansignal';
            const isMihanBc = article.source === 'mihanblockchain';
            const isCryptoPotato = article.source === 'cryptopotato';
            const isCoinDesk = article.source === 'coindesk';

            let sourceBadgeStyle = isDark
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
              : 'bg-emerald-500/90 text-white border-emerald-400/40';
            if (isMihan) {
              sourceBadgeStyle = isDark
                ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                : 'bg-amber-600/90 text-white border-amber-400/40';
            } else if (isMihanBc) {
              sourceBadgeStyle = isDark
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80'
                : 'bg-cyan-600/90 text-white border-cyan-400/40';
            } else if (isCryptoPotato) {
              sourceBadgeStyle = isDark
                ? 'bg-purple-950/80 text-purple-300 border-purple-800/80'
                : 'bg-purple-600/90 text-white border-purple-400/40';
            } else if (isCoinDesk) {
              sourceBadgeStyle = isDark
                ? 'bg-sky-950/80 text-sky-300 border-sky-800/80'
                : 'bg-sky-600/90 text-white border-sky-400/40';
            }

            return (
              <article
                key={article.id}
                id={`article-card-${article.id}`}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all duration-300 group hover:-translate-y-0.5 ${
                  isDark
                    ? 'bg-[#0F172A] border-slate-800/90 hover:border-slate-700 shadow-md shadow-black/20 hover:shadow-xl'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-lg'
                }`}
              >
                <div>
                  {/* News Thumbnail Image with floating metadata */}
                  <div className="relative mb-3">
                    <NewsCardImage
                      src={article.imageUrl}
                      alt={article.title}
                      source={article.source}
                      isDark={isDark}
                    />

                    {/* Floating Source & Category Badges */}
                    <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Source Badge */}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md border shadow-xs ${sourceBadgeStyle}`}
                        >
                          <Globe className="w-2.5 h-2.5" />
                          {lang === 'fa' ? article.sourceNameFa : article.sourceNameEn}
                        </span>

                        {/* Category Badge */}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md backdrop-blur-md shadow-xs ${
                            isExchangeCategory
                              ? isDark
                                ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                                : 'bg-blue-600/90 text-white border border-blue-400/40'
                              : isDark
                              ? 'bg-slate-900/80 text-slate-300 border border-slate-700/60'
                              : 'bg-slate-800/80 text-white border border-slate-600/40'
                          }`}
                        >
                          {isExchangeCategory ? (
                            <Building2 className="w-2.5 h-2.5" />
                          ) : (
                            <Tag className="w-2.5 h-2.5" />
                          )}
                          {article.categoryFa}
                        </span>
                      </div>

                      {/* Time Ago */}
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/70 text-slate-200 backdrop-blur-md border border-white/10 shadow-xs whitespace-nowrap">
                        <Clock className="w-2.5 h-2.5 opacity-75" />
                        {formatTimeAgo(article.publishedAt)}
                      </span>
                    </div>

                    {/* Persian Translation Badge for Foreign Articles */}
                    {article.isTranslated && (
                      <div className="absolute bottom-2.5 right-2.5 pointer-events-none">
                        <span
                          className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-md border ${
                            isDark
                              ? 'bg-indigo-950/90 text-indigo-300 border-indigo-700/60 shadow-xs'
                              : 'bg-indigo-900/90 text-indigo-100 border-indigo-600/60 shadow-xs'
                          }`}
                        >
                          <Languages className="w-2.5 h-2.5 text-indigo-300" />
                          {lang === 'fa' ? 'ترجمه اختصاصی فارسی' : 'Persian Translation'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group-hover:text-blue-400 transition-colors block mb-1.5"
                  >
                    <h3 className="font-bold text-sm leading-snug tracking-tight line-clamp-2">
                      {article.title}
                    </h3>
                  </a>

                  {/* Original English Title for context */}
                  {article.originalTitle && article.originalTitle !== article.title && (
                    <p
                      dir="ltr"
                      className={`text-[11px] font-mono line-clamp-1 mb-2 opacity-70 ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      {article.originalTitle}
                    </p>
                  )}

                  {/* Summary Text */}
                  <p
                    className={`text-xs leading-relaxed line-clamp-2 ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {article.summary}
                  </p>
                </div>

                {/* Footer action and author */}
                <div className="mt-4 pt-3 border-t border-slate-800/40 flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1 text-slate-500 text-[11px] truncate max-w-[130px]">
                    {article.author && (
                      <span className="truncate">{article.author}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Send / Copy for Telegram n8n button */}
                    <button
                      onClick={() => {
                        setSelectedArticleForN8n(article);
                        setN8nModalOpen(true);
                      }}
                      title="مشاهده خروجی تلگرام و ارسال به n8n"
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md transition-all ${
                        isDark
                          ? 'text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/50'
                          : 'text-cyan-700 hover:text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200'
                      }`}
                    >
                      <Send className="w-3 h-3" />
                      <span>{lang === 'fa' ? 'تلگرام / n8n' : 'Telegram'}</span>
                    </button>

                    <a
                      href={article.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                        isDark
                          ? 'text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-950/80 border border-blue-900/40'
                          : 'text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200'
                      }`}
                    >
                      <span>{t.newsReadMore}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* n8n & Telegram Bridge Management Modal */}
      <N8nTelegramNewsModal
        isOpen={n8nModalOpen}
        onClose={() => setN8nModalOpen(false)}
        sampleArticle={selectedArticleForN8n || filteredArticles[0]}
        isDark={isDark}
      />
    </div>
  );
}
