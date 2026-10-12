'use client';

import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import Image from 'next/image';
import {
  Newspaper,
  Search,
  Filter,
  RefreshCw,
  Building2,
  TrendingUp,
  Globe,
  Code2,
  Clock3,
  ExternalLink,
} from 'lucide-react';
import NewsApiConsole from './NewsApiConsole';
import { DidehbonLogoIcon } from '@/components/DidehbonLogo';
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

const NEWS_STORAGE_KEY = 'didehbon-news-feed-v1';

function isNewsApiResponse(data: unknown): data is NewsApiResponse {
  return typeof data === 'object' && data !== null
    && 'success' in data && data.success === true
    && 'articles' in data && Array.isArray(data.articles)
    && 'lastUpdated' in data && typeof data.lastUpdated === 'string'
    && 'total' in data && typeof data.total === 'number'
    && 'sources' in data && typeof data.sources === 'object' && data.sources !== null;
}

async function fetchNewsData(): Promise<NewsApiResponse> {
  let response = await fetch('/api/cache_news.json', { cache: 'no-store' });
  if (response.status === 404) {
    response = await fetch('/api/news.php', { cache: 'no-store' });
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data: unknown = await response.json();
  if (!isNewsApiResponse(data)) {
    throw new Error('Invalid news response');
  }
  return data;
}

function readStoredNews(): NewsApiResponse | null {
  try {
    const stored = window.localStorage.getItem(NEWS_STORAGE_KEY);
    if (!stored) return null;
    const data: unknown = JSON.parse(stored);
    return isNewsApiResponse(data) ? data : null;
  } catch (error) {
    console.warn('Unable to read cached news:', error);
    return null;
  }
}

function storeNews(data: NewsApiResponse): void {
  try {
    window.localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Unable to persist news cache:', error);
  }
}

function formatRelativeTime(publishedAt: string, lang: Language): string {
  const publishedTime = new Date(publishedAt).getTime();
  if (!Number.isFinite(publishedTime)) return '';

  const seconds = (publishedTime - Date.now()) / 1000;
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.34524, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ];
  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = 'second';

  for (const [threshold, nextUnit] of units) {
    unit = nextUnit;
    if (Math.abs(value) < threshold) break;
    value /= threshold;
  }

  return new Intl.RelativeTimeFormat(lang === 'fa' ? 'fa-IR' : 'en', {
    numeric: 'auto',
  }).format(Math.round(value), unit);
}

async function translateToPersian(text: string): Promise<string> {
  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fa&dt=t&q=${encodeURIComponent(text)}`
  );
  if (!response.ok) {
    throw new Error(`Translation request failed: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Invalid translation response');
  }

  const translated = data[0].reduce<string>((result, segment) => {
    if (Array.isArray(segment) && typeof segment[0] === 'string') {
      return result + segment[0];
    }
    return result;
  }, '');
  if (!translated) {
    throw new Error('Translation response was empty');
  }
  return translated;
}

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
    coinmarketcap: 'from-lime-950/80 via-slate-900 to-slate-950',
    cointelegraph: 'from-fuchsia-950/80 via-slate-900 to-slate-950',
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

interface Live3DClockProps {
  isDark: boolean;
  lang: Language;
}

const Live3DClock = memo(function Live3DClock({ isDark, lang }: Live3DClockProps) {
  const hrRef = useRef<HTMLSpanElement>(null);
  const minRef = useRef<HTMLSpanElement>(null);
  const secRef = useRef<HTMLSpanElement>(null);
  const msRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let animId: number;
    let lastTime = 0;

    const tick = (now: number) => {
      // Throttled to ~32ms (30 FPS) for smooth visual milliseconds without CPU stress
      if (now - lastTime >= 32) {
        lastTime = now;
        const d = new Date();
        const hr = d.getHours().toString().padStart(2, '0');
        const min = d.getMinutes().toString().padStart(2, '0');
        const sec = d.getSeconds().toString().padStart(2, '0');
        const ms = Math.floor(d.getMilliseconds() / 10).toString().padStart(2, '0');

        if (hrRef.current && hrRef.current.textContent !== hr) hrRef.current.textContent = hr;
        if (minRef.current && minRef.current.textContent !== min) minRef.current.textContent = min;
        if (secRef.current && secRef.current.textContent !== sec) secRef.current.textContent = sec;
        if (msRef.current && msRef.current.textContent !== ms) msRef.current.textContent = ms;
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      dir="ltr"
      className={`relative inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-mono select-none transition-all ${
        isDark
          ? 'bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-slate-700/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.9),0_6px_16px_rgba(0,0,0,0.6)]'
          : 'bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 border border-slate-300 shadow-[inset_0_2px_3px_rgba(255,255,255,0.8),0_4px_10px_rgba(0,0,0,0.12)]'
      }`}
      title={lang === 'fa' ? 'ساعت فوق دقیق زنده با صدم ثانیه' : 'High-precision real-time 3D clock'}
    >
      {/* Live Pulsing Dot */}
      <span className="relative flex h-2 w-2 mr-1">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.8)]"></span>
      </span>

      {/* HOURS */}
      <div className="flex flex-col items-center">
        <div
          className={`relative px-1.5 py-0.5 rounded-lg flex items-center justify-center min-w-[24px] border-t transition-all ${
            isDark
              ? 'bg-gradient-to-b from-slate-800 to-slate-900 border-slate-600 shadow-[0_3px_0_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)]'
              : 'bg-gradient-to-b from-white to-slate-100 border-white shadow-[0_2px_0_rgba(0,0,0,0.15)]'
          }`}
        >
          <span
            ref={hrRef}
            className={`text-xs font-black tracking-wider ${
              isDark ? 'text-slate-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-slate-800'
            }`}
          >
            --
          </span>
          <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/15 to-transparent rounded-t-lg pointer-events-none" />
        </div>
        <span className="text-[7.5px] font-bold text-slate-500 uppercase mt-0.5 tracking-tighter">
          {lang === 'fa' ? 'ساعت' : 'HR'}
        </span>
      </div>

      {/* COLON */}
      <span className="text-xs font-black text-cyan-400/90 animate-pulse pb-2">:</span>

      {/* MINUTES */}
      <div className="flex flex-col items-center">
        <div
          className={`relative px-1.5 py-0.5 rounded-lg flex items-center justify-center min-w-[24px] border-t transition-all ${
            isDark
              ? 'bg-gradient-to-b from-slate-800 to-slate-900 border-slate-600 shadow-[0_3px_0_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)]'
              : 'bg-gradient-to-b from-white to-slate-100 border-white shadow-[0_2px_0_rgba(0,0,0,0.15)]'
          }`}
        >
          <span
            ref={minRef}
            className={`text-xs font-black tracking-wider ${
              isDark ? 'text-slate-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-slate-800'
            }`}
          >
            --
          </span>
          <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/15 to-transparent rounded-t-lg pointer-events-none" />
        </div>
        <span className="text-[7.5px] font-bold text-slate-500 uppercase mt-0.5 tracking-tighter">
          {lang === 'fa' ? 'دقیقه' : 'MIN'}
        </span>
      </div>

      {/* COLON */}
      <span className="text-xs font-black text-cyan-400/90 animate-pulse pb-2">:</span>

      {/* SECONDS (CYAN NEON GLOW) */}
      <div className="flex flex-col items-center">
        <div
          className={`relative px-1.5 py-0.5 rounded-lg flex items-center justify-center min-w-[24px] border-t transition-all ${
            isDark
              ? 'bg-gradient-to-b from-cyan-950/60 to-slate-900 border-cyan-500/50 shadow-[0_3px_0_rgba(0,0,0,0.7),inset_0_1px_0_rgba(34,211,238,0.25)]'
              : 'bg-gradient-to-b from-cyan-50 to-cyan-100 border-cyan-200 shadow-[0_2px_0_rgba(6,182,212,0.3)]'
          }`}
        >
          <span
            ref={secRef}
            className="text-xs font-black tracking-wider text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]"
          >
            --
          </span>
          <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/20 to-transparent rounded-t-lg pointer-events-none" />
        </div>
        <span className="text-[7.5px] font-bold text-cyan-500 uppercase mt-0.5 tracking-tighter">
          {lang === 'fa' ? 'ثانیه' : 'SEC'}
        </span>
      </div>

      {/* DOT */}
      <span className="text-xs font-black text-amber-400/90 pb-2">.</span>

      {/* MILLISECONDS (AMBER/GOLD GLOW) */}
      <div className="flex flex-col items-center">
        <div
          className={`relative px-1.5 py-0.5 rounded-lg flex items-center justify-center min-w-[26px] border-t transition-all ${
            isDark
              ? 'bg-gradient-to-b from-amber-950/60 to-slate-900 border-amber-500/50 shadow-[0_3px_0_rgba(0,0,0,0.7),inset_0_1px_0_rgba(251,191,36,0.25)]'
              : 'bg-gradient-to-b from-amber-50 to-amber-100 border-amber-200 shadow-[0_2px_0_rgba(245,158,11,0.3)]'
          }`}
        >
          <span
            ref={msRef}
            className="text-xs font-black tracking-wider text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]"
          >
            --
          </span>
          <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/20 to-transparent rounded-t-lg pointer-events-none" />
        </div>
        <span className="text-[7.5px] font-bold text-amber-500 uppercase mt-0.5 tracking-tighter">
          {lang === 'fa' ? 'میلی‌ثانیه' : 'MS'}
        </span>
      </div>
    </div>
  );
});

export default function NewsFeed({ lang, theme }: NewsFeedProps) {
  const [newsSectionTab, setNewsSectionTab] = useState<'feed' | 'api'>('feed');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<NewsCategoryFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<NewsSourceId>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showPersianByArticle, setShowPersianByArticle] = useState<Record<string, boolean>>({});
  const [persianTranslations, setPersianTranslations] = useState<
    Record<string, { title: string; summary: string }>
  >({});
  const [translatingByArticle, setTranslatingByArticle] = useState<Record<string, boolean>>({});
  const [translationErrors, setTranslationErrors] = useState<Record<string, string>>({});

  const t = translations[lang];
  const isDark = theme === 'dark';
  const isRtl = lang === 'fa';

  const fetchNews = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError(null);
    try {
      const data = await fetchNewsData();
      setArticles(data.articles);
      storeNews(data);
      setLastUpdated(new Date(data.lastUpdated || Date.now()));
    } catch (err: any) {
      console.error('Error fetching news:', err);
      setError(err.message || 'خطا در بارگذاری اخبار');
    } finally {
      if (isManualRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const cachedData = readStoredNews();
    if (cachedData) {
      setArticles(cachedData.articles);
      setLastUpdated(new Date(cachedData.lastUpdated || Date.now()));
    }

    const initialLoad = async () => {
      try {
        const data = await fetchNewsData();
        if (isMounted) {
          setArticles(data.articles);
          storeNews(data);
          setLastUpdated(new Date(data.lastUpdated || Date.now()));
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'خطا در بارگذاری اخبار');
        }
      }
    };

    initialLoad();

    const interval = setInterval(() => {
      initialLoad();
    }, 90000); // 90 seconds auto refresh

    return () => {
      isMounted = false;
      clearInterval(interval);
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
        const matchesOriginalTitle = art.originalTitle?.toLowerCase().includes(q);
        const matchesSummary = art.summary.toLowerCase().includes(q);
        const matchesAuthor = art.author?.toLowerCase().includes(q);
        return matchesTitle || matchesOriginalTitle || matchesSummary || matchesAuthor;
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
            <DidehbonLogoIcon size={38} withGlow={isDark} />
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  {t.navNews}
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                    isDark ? 'bg-cyan-950/70 text-cyan-400 border border-cyan-800/60' : 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                  }`}
                >
                  didehbon.ir
                </span>
              </div>

              {/* Sub-view switcher: Feed vs API */}
              <div
                className={`flex items-center p-0.5 rounded-xl border ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <button
                  id="tab-news-feed"
                  onClick={() => setNewsSectionTab('feed')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    newsSectionTab === 'feed'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Newspaper className="w-3.5 h-3.5" />
                  <span>{lang === 'fa' ? 'فید اخبار' : 'News Feed'}</span>
                </button>
                <button
                  id="tab-news-api"
                  onClick={() => setNewsSectionTab('api')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    newsSectionTab === 'api'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{lang === 'fa' ? 'سرویس API و وب‌هوک' : 'API Hub'}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Refresh & Source Badges */}
          <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-end flex-wrap">
            <Live3DClock isDark={isDark} lang={lang} />

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

        {/* SEARCH AND FILTER BUTTONS (ONLY IN FEED MODE) */}
        {newsSectionTab === 'feed' && (
          <>
            <div className="mt-4 flex flex-col gap-3">
              {/* Search Box */}
              <div className="relative w-full">
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

              <div className="flex w-full flex-wrap items-center gap-2">
                {/* Category Tabs */}
                <div
                  className={`flex max-w-full flex-wrap items-center gap-1.5 p-1 rounded-lg border text-xs font-medium ${
                    isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                <button
                  id="filter-category-all"
                  onClick={() => setCategoryFilter('all')}
                  className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md transition-all ${
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
                  className={`shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
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
                  className={`shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
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
                  className={`flex max-w-full flex-wrap items-center gap-1.5 p-1 rounded-lg border text-xs font-medium ${
                    isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                <button
                  id="filter-source-all"
                  onClick={() => setSourceFilter('all')}
                  className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-md transition-all ${
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
                  className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-md transition-all ${
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
                  className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-md transition-all ${
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
                  className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-md transition-all ${
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
                  className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-md transition-all ${
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
                  className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-md transition-all ${
                    sourceFilter === 'coindesk'
                      ? isDark
                        ? 'bg-sky-950/80 text-sky-300 font-semibold shadow-sm border border-sky-800/60'
                        : 'bg-sky-50 text-sky-800 font-semibold shadow-xs border border-sky-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.newsSourceCoindesk}
                </button>

                <button
                  id="filter-source-coinmarketcap"
                  onClick={() => setSourceFilter('coinmarketcap')}
                  className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-md transition-all ${
                    sourceFilter === 'coinmarketcap'
                      ? isDark
                        ? 'bg-lime-950/80 text-lime-300 font-semibold shadow-sm border border-lime-800/60'
                        : 'bg-lime-50 text-lime-800 font-semibold shadow-xs border border-lime-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.newsSourceCoinmarketcap}
                </button>

                <button
                  id="filter-source-cointelegraph"
                  onClick={() => setSourceFilter('cointelegraph')}
                  className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-md transition-all ${
                    sourceFilter === 'cointelegraph'
                      ? isDark
                        ? 'bg-fuchsia-950/80 text-fuchsia-300 font-semibold shadow-sm border border-fuchsia-800/60'
                        : 'bg-fuchsia-50 text-fuchsia-800 font-semibold shadow-xs border border-fuchsia-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.newsSourceCointelegraph}
                </button>
                </div>
              </div>
            </div>

            {/* Active Filters Summary */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                {lang === 'fa'
                  ? `${toPersianDigits(filteredArticles.length)} ${t.newsFilterCount}`
                  : `${filteredArticles.length} ${t.newsFilterCount}`}
              </span>
            </div>
          </>
        )}
      </div>

      {/* RENDER ACTIVE TAB: API CONSOLE OR ARTICLES GRID */}
      {newsSectionTab === 'api' ? (
        <NewsApiConsole lang={lang} isDark={isDark} />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
          {filteredArticles.map((article) => {
            const articleUrl = article.url || article.link || '#';
            const articleWithPersianFields = article as NewsArticle & {
              titleFa?: string;
              title_fa?: string;
              summaryFa?: string;
              description_fa?: string;
            };
            const isShowingPersian = showPersianByArticle[article.id] ?? false;
            const persianTitle = articleWithPersianFields.titleFa
              || articleWithPersianFields.title_fa
              || (article.isTranslated ? article.title : undefined);
            const persianSummary = articleWithPersianFields.summaryFa
              || articleWithPersianFields.description_fa
              || (article.isTranslated ? article.summary : undefined);
            const cachedTranslation = persianTranslations[article.id];
            const title = isShowingPersian
              ? persianTitle || cachedTranslation?.title || article.title
              : article.originalTitle || article.title;
            const summary = isShowingPersian
              ? persianSummary || cachedTranslation?.summary || article.summary
              : article.originalSummary || article.summary || article.content || article.body || article.fullContent || '';
            const isTranslating = translatingByArticle[article.id] ?? false;
            const isMihan = article.source === 'mihansignal';
            const isMihanBc = article.source === 'mihanblockchain';
            const isCryptoPotato = article.source === 'cryptopotato';
            const isCoinDesk = article.source === 'coindesk';
            const isCoinMarketCap = article.source === 'coinmarketcap';
            const isCoinTelegraph = article.source === 'cointelegraph';

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
            } else if (isCoinMarketCap) {
              sourceBadgeStyle = isDark
                ? 'bg-lime-950/80 text-lime-300 border-lime-800/80'
                : 'bg-lime-600/90 text-white border-lime-400/40';
            } else if (isCoinTelegraph) {
              sourceBadgeStyle = isDark
                ? 'bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-800/80'
                : 'bg-fuchsia-600/90 text-white border-fuchsia-400/40';
            }

            return (
              <article
                key={article.id}
                id={`article-card-${article.id}`}
                className={`h-full p-3.5 rounded-xl border transition-all duration-300 group flex flex-col ${
                  isDark
                    ? 'bg-[#0F172A] border-slate-800/90 hover:border-slate-700 shadow-md shadow-black/20 hover:shadow-xl'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-lg'
                }`}
              >
                {/* News Thumbnail Image with floating metadata */}
                <div className="relative mb-3">
                  <NewsCardImage
                    src={article.imageUrl || article.image_url || article.image}
                    alt={article.title}
                    source={article.source}
                    isDark={isDark}
                  />

                  {/* Source Badge */}
                  <div className="absolute top-2.5 left-2.5 pointer-events-none">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md border shadow-xs ${sourceBadgeStyle}`}
                    >
                      <Globe className="w-2.5 h-2.5" />
                      {lang === 'fa' ? article.sourceNameFa : article.sourceNameEn}
                    </span>
                  </div>
                </div>

                <div className="mb-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Clock3 className="h-3 w-3 shrink-0" />
                  <time dateTime={article.publishedAt}>
                    {formatRelativeTime(article.publishedAt, lang)}
                  </time>
                </div>

                <h3 className="font-bold text-sm leading-snug tracking-tight break-words">
                  <a
                    href={articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                  >
                    {title}
                  </a>
                </h3>
                <p
                  dir={isRtl ? 'rtl' : 'auto'}
                  className={`mt-2 text-xs leading-relaxed line-clamp-3 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {isTranslating ? 'در حال ترجمه...' : summary}
                </p>
                {translationErrors[article.id] && (
                  <p role="alert" className="mt-1 text-xs text-red-400">
                    ترجمه انجام نشد. دوباره تلاش کنید.
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <button
                    type="button"
                    disabled={isTranslating}
                    onClick={async () => {
                      if (isShowingPersian) {
                        setShowPersianByArticle((current) => ({
                          ...current,
                          [article.id]: false,
                        }));
                        return;
                      }

                      if (cachedTranslation || (persianTitle && persianSummary)) {
                        setShowPersianByArticle((current) => ({
                          ...current,
                          [article.id]: true,
                        }));
                        return;
                      }

                      const originalTitle = article.originalTitle || article.title;
                      const originalSummary = article.originalSummary
                        || article.summary
                        || article.content
                        || article.body
                        || article.fullContent
                        || '';
                      setTranslatingByArticle((current) => ({ ...current, [article.id]: true }));
                      setTranslationErrors((current) => ({ ...current, [article.id]: '' }));
                      try {
                        const [translatedTitle, translatedSummary] = await Promise.all([
                          persianTitle
                            ? Promise.resolve(persianTitle)
                            : translateToPersian(originalTitle),
                          persianSummary
                            ? Promise.resolve(persianSummary)
                            : originalSummary
                              ? translateToPersian(originalSummary)
                              : Promise.resolve(''),
                        ]);
                        setPersianTranslations((current) => ({
                          ...current,
                          [article.id]: {
                            title: translatedTitle,
                            summary: translatedSummary,
                          },
                        }));
                        setShowPersianByArticle((current) => ({
                          ...current,
                          [article.id]: true,
                        }));
                      } catch (err) {
                        console.error(`Unable to translate news article ${article.id}:`, err);
                        setTranslationErrors((current) => ({
                          ...current,
                          [article.id]: 'Translation failed',
                        }));
                      } finally {
                        setTranslatingByArticle((current) => ({
                          ...current,
                          [article.id]: false,
                        }));
                      }
                    }}
                    className={`text-xs font-semibold transition-colors ${
                      isDark
                        ? 'text-cyan-400 hover:text-cyan-300'
                        : 'text-cyan-700 hover:text-cyan-900'
                    } disabled:cursor-wait disabled:opacity-60`}
                    aria-label={
                      isShowingPersian
                        ? 'نمایش متن اصلی'
                        : isTranslating
                          ? 'در حال ترجمه'
                          : 'ترجمه به فارسی'
                    }
                  >
                    {isShowingPersian
                      ? 'نمایش متن اصلی'
                      : isTranslating
                        ? 'در حال ترجمه...'
                        : 'ترجمه به فارسی'}
                  </button>
                  <a
                    href={articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${
                      isDark
                        ? 'text-blue-400 hover:text-blue-300'
                        : 'text-blue-700 hover:text-blue-900'
                    }`}
                  >
                    {lang === 'fa' ? 'مشاهده منبع' : 'Read source'}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
