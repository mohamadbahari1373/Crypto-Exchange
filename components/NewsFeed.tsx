'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { gsap } from 'gsap';
import {
  Newspaper,
  Search,
  Globe,
  Clock3,
  ExternalLink,
} from 'lucide-react';
import { DidehbonLogoIcon } from '@/components/DidehbonLogo';
import {
  NewsArticle,
  NewsApiResponse,
  NewsSourceId,
  Language,
  Theme,
} from '@/lib/types';
import { translations } from '@/lib/translations';
import { toPersianDigits } from '@/lib/formatters';
import { fetchNewsData, isNewsApiResponse } from '@/lib/newsClient';

const NEWS_STORAGE_KEY = 'didehbon-news-feed-v1';
type NewsOriginFilter = 'all' | 'iranian' | 'foreign';

function normalizeNewsSource(source: string): string {
  return source.toLowerCase().replace(/[\s\u200c\u200f-]/g, '');
}

const IRANIAN_NEWS_SOURCES = new Set([
  'میهن بلاکچین',
  'ارزدیجیتال',
  'ارز دیجیتال',
  'میهن سیگنال',
  'mihanblockchain',
  'arzdigital',
  'mihansignal',
].map(normalizeNewsSource));

const FOREIGN_NEWS_SOURCES = new Set([
  'کریپتو پوتیتو',
  'cryptopotato',
  'کوین‌مارکت‌کپ',
  'کوین مارکت کپ',
  'coinmarketcap',
  'کوین‌دسک',
  'کوین دسک',
  'coindesk',
  'کوین‌تلگراف',
  'کوین تلگراف',
  'cointelegraph',
].map(normalizeNewsSource));

function matchesNewsOrigin(article: NewsArticle, origin: Exclude<NewsOriginFilter, 'all'>): boolean {
  const sources = origin === 'iranian' ? IRANIAN_NEWS_SOURCES : FOREIGN_NEWS_SOURCES;
  return [article.source, article.sourceNameFa, article.sourceNameEn]
    .some((source) => sources.has(normalizeNewsSource(source)));
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

function getFullNewsText(article: NewsArticle): string {
  return (
    article.fullContent ||
    article.content ||
    article.body ||
    article.description ||
    article.originalSummary ||
    article.summary ||
    ''
  ).trim();
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

async function translateLongTextToPersian(text: string): Promise<string> {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + 3500, text.length);
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start + 1500) end = lastSpace;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }

  const translatedChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk) translatedChunks.push(await translateToPersian(chunk));
  }
  return translatedChunks.join('\n\n');
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

export default function NewsFeed({ lang, theme }: NewsFeedProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<NewsOriginFilter>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showPersianByArticle, setShowPersianByArticle] = useState<Record<string, boolean>>({});
  const [persianTranslations, setPersianTranslations] = useState<
    Record<string, { title: string; summary: string }>
  >({});
  const [translatingByArticle, setTranslatingByArticle] = useState<Record<string, boolean>>({});
  const [translationErrors, setTranslationErrors] = useState<Record<string, string>>({});
  const [selectedNews, setSelectedNews] = useState<NewsArticle | null>(null);
  const [showFullPersian, setShowFullPersian] = useState(false);
  const [fullPersianTranslations, setFullPersianTranslations] = useState<
    Record<string, { title: string; content: string }>
  >({});
  const [fullTranslationLoading, setFullTranslationLoading] = useState(false);
  const [fullTranslationError, setFullTranslationError] = useState<string | null>(null);
  const refreshInFlightRef = useRef(false);
  const refreshControllerRef = useRef<AbortController | null>(null);
  const modalBackdropRef = useRef<HTMLDivElement>(null);
  const modalPanelRef = useRef<HTMLDivElement>(null);
  const modalClosingRef = useRef(false);
  const modalScrollPositionRef = useRef(0);

  const t = translations[lang];
  const isDark = theme === 'dark';
  const isRtl = lang === 'fa';

  const closeNewsModal = useCallback(() => {
    if (modalClosingRef.current) return;
    const backdrop = modalBackdropRef.current;
    const panel = modalPanelRef.current;
    if (!backdrop || !panel) {
      setSelectedNews(null);
      return;
    }

    modalClosingRef.current = true;
    gsap.timeline({
      onComplete: () => {
        setSelectedNews(null);
        modalClosingRef.current = false;
      },
    })
      .to(panel, { opacity: 0, scale: 0.96, y: 8, duration: 0.16, ease: 'power2.in' }, 0)
      .to(backdrop, { opacity: 0, duration: 0.16, ease: 'power2.in' }, 0);
  }, []);

  useEffect(() => {
    if (!selectedNews) return;

    const previousOverflow = document.body.style.overflow;
    const backdrop = modalBackdropRef.current;
    const panel = modalPanelRef.current;
    modalScrollPositionRef.current = window.scrollY;
    document.body.style.overflow = 'hidden';
    modalClosingRef.current = false;

    if (backdrop && panel) {
      gsap.fromTo(
        backdrop,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: 'power2.out' }
      );
      gsap.fromTo(
        panel,
        { opacity: 0, scale: 0.96, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.24, ease: 'power3.out' }
      );
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeNewsModal();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      gsap.killTweensOf(backdrop);
      gsap.killTweensOf(panel);
      document.body.style.overflow = previousOverflow;
      window.scrollTo(0, modalScrollPositionRef.current);
    };
  }, [selectedNews, closeNewsModal]);

  const fetchNews = useCallback(async (silent = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    if (!silent) setError(null);
    try {
      const data = await fetchNewsData(controller.signal);
      if (controller.signal.aborted) return;
      setArticles(data.articles);
      storeNews(data);
      setLastUpdated(new Date(data.lastUpdated || Date.now()));
      setError(null);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      console.error('Error fetching news:', err);
      if (!silent) {
        setError(err instanceof Error ? err.message : 'خطا در بارگذاری اخبار');
      }
    } finally {
      if (refreshControllerRef.current === controller) {
        refreshControllerRef.current = null;
        refreshInFlightRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    const cachedData = readStoredNews();
    if (cachedData) {
      setArticles(cachedData.articles);
      setLastUpdated(new Date(cachedData.lastUpdated || Date.now()));
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchNews(true);
    };

    void fetchNews(false);
    const interval = window.setInterval(() => void fetchNews(true), 60000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      refreshControllerRef.current?.abort();
      refreshControllerRef.current = null;
      refreshInFlightRef.current = false;
    };
  }, [fetchNews]);

  // Filtered Articles
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      if (activeCategoryFilter !== 'all' && !matchesNewsOrigin(art, activeCategoryFilter)) {
        return false;
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
  }, [articles, activeCategoryFilter, searchQuery]);

  const translateSelectedNews = async () => {
    if (!selectedNews) return;
    if (showFullPersian) {
      setShowFullPersian(false);
      return;
    }

    const cachedTranslation = fullPersianTranslations[selectedNews.id];
    if (cachedTranslation) {
      setShowFullPersian(true);
      return;
    }

    const originalTitle = selectedNews.originalTitle || selectedNews.title;
    const originalContent = getFullNewsText(selectedNews);
    setFullTranslationLoading(true);
    setFullTranslationError(null);
    try {
      const [title, content] = await Promise.all([
        translateToPersian(originalTitle),
        originalContent ? translateLongTextToPersian(originalContent) : Promise.resolve(''),
      ]);
      setFullPersianTranslations((current) => ({
        ...current,
        [selectedNews.id]: { title, content },
      }));
      setShowFullPersian(true);
    } catch (err) {
      console.error(`Unable to translate full news article ${selectedNews.id}:`, err);
      setFullTranslationError('ترجمه انجام نشد. دوباره تلاش کنید.');
    } finally {
      setFullTranslationLoading(false);
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
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800/40">
          <DidehbonLogoIcon size={38} withGlow={isDark} />
          <h2 className="text-base sm:text-lg font-bold tracking-tight">
            {t.navNews}
          </h2>
        </div>

        {/* SEARCH AND FILTER BUTTONS */}
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
                    type="button"
                    onClick={() => setActiveCategoryFilter('all')}
                    className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md transition-all ${
                      isDark
                        ? 'bg-slate-800 text-blue-400 font-semibold shadow-sm'
                        : 'bg-white text-blue-700 font-semibold shadow-xs'
                    }`}
                  >
                    {t.newsAll} ({lang === 'fa' ? toPersianDigits(articles.length) : articles.length})
                  </button>
                </div>

                {/* Source Filter */}
                <div
                  className={`flex max-w-full flex-wrap items-center gap-1.5 p-1 rounded-lg border text-xs font-medium ${
                    isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  {(['all', 'iranian', 'foreign'] as const).map((filter) => (
                    <button
                      key={filter}
                      id={`filter-source-${filter}`}
                      onClick={() => setActiveCategoryFilter(filter)}
                      className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-md transition-all ${
                        activeCategoryFilter === filter
                          ? isDark
                            ? 'bg-slate-800 text-slate-100 font-semibold shadow-sm'
                            : 'bg-white text-slate-900 font-semibold shadow-xs'
                          : isDark
                          ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                      }`}
                    >
                      {filter === 'all'
                        ? (lang === 'fa' ? 'همه' : 'All')
                        : filter === 'iranian'
                        ? (lang === 'fa' ? 'اخبار ایرانی' : 'Iranian News')
                        : (lang === 'fa' ? 'اخبار خارجی' : 'Foreign News')}
                    </button>
                  ))}
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
      </div>

      {filteredArticles.length === 0 ? (
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
                <div className="group/image relative mb-3">
                  <NewsCardImage
                    src={article.imageUrl || article.image_url || article.image}
                    alt={article.title}
                    source={article.source}
                    isDark={isDark}
                  />

                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={lang === 'fa' ? 'مطالعه کامل خبر' : 'Read full article'}
                    onClick={() => {
                      setShowFullPersian(false);
                      setFullTranslationError(null);
                      setSelectedNews(article);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setShowFullPersian(false);
                        setFullTranslationError(null);
                        setSelectedNews(article);
                      }
                    }}
                    className="absolute inset-0 z-[1] flex cursor-pointer items-end justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                  >
                    <span className="pointer-events-none mb-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold text-white opacity-0 backdrop-blur transition-opacity duration-200 group-hover/image:opacity-100">
                      {lang === 'fa' ? 'مطالعه کامل خبر' : 'Read full article'}
                    </span>
                  </div>

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

      {selectedNews && (() => {
        const fullTranslation = fullPersianTranslations[selectedNews.id];
        const originalTitle = selectedNews.originalTitle || selectedNews.title;
        const originalContent = getFullNewsText(selectedNews);
        const modalImage = selectedNews.imageUrl || selectedNews.image_url || selectedNews.image;
        const sourceName = lang === 'fa'
          ? selectedNews.sourceNameFa || selectedNews.sourceNameEn || selectedNews.source
          : selectedNews.sourceNameEn || selectedNews.sourceNameFa || selectedNews.source;
        const displayTitle = showFullPersian && fullTranslation
          ? fullTranslation.title
          : originalTitle;
        const displayContent = showFullPersian && fullTranslation
          ? fullTranslation.content
          : originalContent;

        return (
          <div
            ref={modalBackdropRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={closeNewsModal}
          >
            <section
              ref={modalPanelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="news-modal-title"
              onClick={(event) => event.stopPropagation()}
              className={`relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${
                isDark
                  ? 'border-slate-700 bg-[#0F172A] text-slate-100'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              <button
                type="button"
                onClick={closeNewsModal}
                aria-label={lang === 'fa' ? 'بستن خبر' : 'Close article'}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/70 text-2xl leading-none text-white backdrop-blur transition-colors hover:bg-black"
              >
                ×
              </button>

              <div className="relative flex max-h-[42vh] min-h-40 shrink-0 items-center justify-center overflow-hidden bg-black/30">
                {modalImage ? (
                  <Image
                    src={modalImage}
                    alt={originalTitle}
                    width={1200}
                    height={800}
                    unoptimized
                    className="max-h-[42vh] w-full object-contain"
                  />
                ) : (
                  <Newspaper className="h-14 w-14 text-slate-500" />
                )}
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-3 pt-8 text-xs text-white">
                  <span className="rounded-md border border-white/20 bg-black/40 px-2 py-1 font-semibold backdrop-blur">
                    {sourceName}
                  </span>
                  <time dateTime={selectedNews.publishedAt} className="text-white/85">
                    {formatRelativeTime(selectedNews.publishedAt, lang)}
                  </time>
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
                <h2
                  id="news-modal-title"
                  dir="auto"
                  className="mb-4 text-lg font-bold leading-relaxed sm:text-xl"
                >
                  {displayTitle}
                </h2>

                <div className={`mb-5 whitespace-pre-wrap break-words text-sm leading-8 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`} dir="auto">
                  {displayContent || (lang === 'fa' ? 'متن کامل خبر در دسترس نیست.' : 'Full article text is unavailable.')}
                </div>

                {fullTranslationError && (
                  <p role="alert" className="mb-4 text-sm text-red-500">
                    {fullTranslationError}
                  </p>
                )}

                <div className={`flex flex-wrap items-center gap-3 border-t pt-4 ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}>
                  <button
                    type="button"
                    onClick={() => void translateSelectedNews()}
                    disabled={fullTranslationLoading}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
                      isDark
                        ? 'bg-cyan-950/70 text-cyan-300 hover:bg-cyan-900'
                        : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                    }`}
                  >
                    {fullTranslationLoading
                      ? (lang === 'fa' ? 'در حال ترجمه...' : 'Translating...')
                      : showFullPersian
                        ? (lang === 'fa' ? 'نمایش متن اصلی' : 'Show original')
                        : (lang === 'fa' ? 'ترجمه به فارسی' : 'Translate to Persian')}
                  </button>
                  <a
                    href={selectedNews.url || selectedNews.link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      isDark
                        ? 'bg-blue-950/70 text-blue-300 hover:bg-blue-900'
                        : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                    }`}
                  >
                    {lang === 'fa' ? 'مشاهده منبع اصلی' : 'View original source'}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </section>
          </div>
        );
      })()}
    </div>
  );
}
