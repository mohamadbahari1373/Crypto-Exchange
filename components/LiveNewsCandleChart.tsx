'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { AlertCircle, LoaderCircle, Newspaper, X } from 'lucide-react';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface LiveNewsCandleChartProps {
  coinId: string;
  onClose: () => void;
}

interface OhlcCandle {
  timestamp: number;
  dateLabel: string;
  dayKey: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface NewsArticle {
  title: string;
  publishedAt: string;
  dayKey: string;
}

interface RawNewsArticle {
  title?: unknown;
  headline?: unknown;
  date?: unknown;
  published_at?: unknown;
  publishedAt?: unknown;
}

type OhlcResponse = unknown;
type NewsResponse = unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    return Number.isFinite(new Date(milliseconds).getTime()) ? milliseconds : null;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function utcDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function formatDate(timestamp: number, includeTime = false): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
    timeZone: 'UTC',
  }).format(timestamp);
}

function formatPrice(value: number): string {
  const digits = value >= 1 ? 2 : value >= 0.01 ? 4 : 8;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function extractNewsRecords(payload: NewsResponse): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  for (const key of ['articles', 'news', 'results', 'data']) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) return candidate;
    if (isRecord(candidate)) {
      for (const nestedKey of ['articles', 'news', 'results']) {
        if (Array.isArray(candidate[nestedKey])) return candidate[nestedKey];
      }
    }
  }
  return [];
}

function parseNews(payload: NewsResponse): NewsArticle[] {
  return extractNewsRecords(payload).flatMap((record) => {
    if (!isRecord(record)) return [];
    const article = record as RawNewsArticle;
    const titleValue = typeof article.title === 'string'
      ? article.title
      : article.headline;
    const dateValue = article.date ?? article.published_at ?? article.publishedAt;
    if (typeof titleValue !== 'string' || !titleValue.trim()) return [];

    const timestamp = toTimestamp(dateValue);
    if (timestamp === null) return [];
    return [{
      title: titleValue.trim(),
      publishedAt: new Date(timestamp).toISOString(),
      dayKey: utcDayKey(timestamp),
    }];
  });
}

function parseCandles(payload: OhlcResponse): OhlcCandle[] {
  if (!Array.isArray(payload)) {
    throw new Error('پاسخ نمودار از سرویس معتبر نیست.');
  }

  return payload.flatMap((row): OhlcCandle[] => {
    if (
      !Array.isArray(row) ||
      row.length < 5 ||
      !row.every((value) => typeof value === 'number' && Number.isFinite(value))
    ) {
      return [];
    }
    const [timestamp, open, high, low, close] = row as number[];
    return [{
      timestamp,
      dateLabel: formatDate(timestamp),
      dayKey: utcDayKey(timestamp),
      open,
      high,
      low,
      close,
    }];
  }).sort((a, b) => a.timestamp - b.timestamp);
}

function chartTooltip(params: unknown): string {
  const entry = Array.isArray(params) ? params[0] : params;
  if (!isRecord(entry)) return '';

  const data = entry.data;
  if (entry.componentType === 'markPoint' && isRecord(data)) {
    const title = typeof data.title === 'string' ? data.title : entry.name;
    const date = typeof data.dateLabel === 'string' ? data.dateLabel : '';
    return `<div dir="rtl" style="max-width:320px;white-space:normal">
      <div style="font-size:11px;color:#9ca3af;margin-bottom:6px" dir="ltr">${escapeHtml(date)}</div>
      <div style="font-weight:600;line-height:1.7">${escapeHtml(String(title ?? 'خبر بازار'))}</div>
    </div>`;
  }

  if (
    !Array.isArray(data) ||
    data.length < 5 ||
    !data.every((value) => typeof value === 'number' && Number.isFinite(value))
  ) return '';
  const [timestamp, open, close, low, high] = data;

  return `<div dir="rtl" style="min-width:180px">
    <div dir="ltr" style="font-size:11px;color:#9ca3af;margin-bottom:8px">${escapeHtml(formatDate(timestamp, true))}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px">
      <span style="color:#9ca3af">بازشدن</span><b dir="ltr">${formatPrice(open)}</b>
      <span style="color:#9ca3af">بیشترین</span><b dir="ltr" style="color:#34d399">${formatPrice(high)}</b>
      <span style="color:#9ca3af">کمترین</span><b dir="ltr" style="color:#fb7185">${formatPrice(low)}</b>
      <span style="color:#9ca3af">بسته‌شدن</span><b dir="ltr">${formatPrice(close)}</b>
    </div>
  </div>`;
}

export default function LiveNewsCandleChart({
  coinId,
  onClose,
}: LiveNewsCandleChartProps) {
  const [candles, setCandles] = useState<OhlcCandle[]>([]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [candleLoading, setCandleLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [candleError, setCandleError] = useState<string | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const validCoinId = /^[a-zA-Z0-9_-]+$/.test(coinId);
    setCandles([]);
    setArticles([]);
    setCandleLoading(true);
    setNewsLoading(true);
    setCandleError(null);
    setNewsError(null);

    const loadCandles = async () => {
      try {
        if (!validCoinId) throw new Error('شناسهٔ ارز معتبر نیست.');
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/ohlc?vs_currency=usd&days=30`,
          { cache: 'no-store', signal: controller.signal },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = parseCandles(await response.json());
        if (parsed.length === 0) throw new Error('برای بازهٔ انتخاب‌شده کندلی دریافت نشد.');
        if (!controller.signal.aborted) setCandles(parsed);
      } catch (error) {
        if (!controller.signal.aborted) {
          setCandleError(
            error instanceof Error && error.message.startsWith('HTTP ')
              ? `دریافت نمودار ناموفق بود (${error.message}).`
              : error instanceof Error
                ? error.message
                : 'دریافت اطلاعات نمودار ناموفق بود.',
          );
        }
      } finally {
        if (!controller.signal.aborted) setCandleLoading(false);
      }
    };

    const loadNews = async () => {
      try {
        const response = await fetch('/api/news', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = parseNews(await response.json());
        if (parsed.length === 0) throw new Error('خبر دارای عنوان و تاریخ معتبر دریافت نشد.');
        if (!controller.signal.aborted) setArticles(parsed);
      } catch (error) {
        if (!controller.signal.aborted) {
          setNewsError(
            error instanceof Error && error.message.startsWith('HTTP ')
              ? `دریافت اخبار ناموفق بود (${error.message}).`
              : error instanceof Error
                ? error.message
                : 'دریافت اخبار سایت ناموفق بود.',
          );
        }
      } finally {
        if (!controller.signal.aborted) setNewsLoading(false);
      }
    };

    void Promise.all([loadCandles(), loadNews()]);
    return () => controller.abort();
  }, [coinId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const matchedArticles = useMemo(() => {
    // 1. استخراج تاریخ‌های موجود در کندل‌ها برای سرعت بخشیدن به جستجو
    const candleDays = new Set(candles.map((candle) => candle.dayKey));
    
    // 2. کلمات کلیدی هوشمند برای فیلتر اخبار بر اساس کوین
    const coinKeywords = [
      coinId.toLowerCase(),
      coinId.replace('-', ' '),
      coinId === 'bitcoin' ? 'بیت کوین' : '',
      coinId === 'bitcoin' ? 'بیت‌کوین' : '',
      coinId === 'bitcoin' ? 'btc' : '',
      coinId === 'ethereum' ? 'اتریوم' : '',
      coinId === 'ethereum' ? 'eth' : '',
      coinId === 'solana' ? 'سولانا' : '',
      coinId === 'solana' ? 'sol' : '',
      coinId === 'ripple' ? 'ریپل' : '',
      coinId === 'ripple' ? 'xrp' : '',
      coinId === 'binancecoin' ? 'بایننس' : '',
      coinId === 'binancecoin' ? 'bnb' : '',
      coinId === 'cardano' ? 'کاردانو' : '',
      coinId === 'cardano' ? 'ada' : '',
    ].filter(Boolean); // موارد خالی رو پاک میکنه

    return articles.filter((article) => {
      // آیا تاریخ انتشار خبر با روزِ یکی از کندل‌های ۳۰ روز اخیر یکی است؟
      const isDateMatched = candleDays.has(article.dayKey);
      
      // آیا در تیتر خبر اسمی از این ارز یا نماد آن آمده است؟
      const titleLower = article.title.toLowerCase();
      const isContentMatched = coinKeywords.some((keyword) => 
        titleLower.includes(keyword)
      );

      // خبری رو قبول کن که هم در ۳۰ روز اخیر باشه و هم ربطی به این کوین داشته باشه
      return isDateMatched && isContentMatched;
    });
  }, [articles, candles, coinId]);

  const markPoints = useMemo(() => {
    const candleByDay = new Map<string, OhlcCandle>();
    for (const candle of candles) {
      candleByDay.set(candle.dayKey, candle);
    }
    return matchedArticles.flatMap((article) => {
      const candle = candleByDay.get(article.dayKey);
      if (!candle) return [];
      return [{
        name: article.title,
        title: article.title,
        dateLabel: formatDate(Date.parse(article.publishedAt), true),
        coord: [candle.dateLabel, candle.high],
        value: 1,
        symbol: 'pin',
        symbolSize: 34,
        itemStyle: { color: '#38bdf8', borderColor: '#e0f2fe', borderWidth: 1 },
        label: {
          show: true,
          formatter: 'خبر',
          color: '#08111c',
          fontSize: 9,
          fontWeight: 700,
        },
      }];
    });
  }, [candles, matchedArticles]);

  const chartOption: EChartsOption = useMemo(() => ({
    animation: true,
    animationDuration: 450,
    backgroundColor: 'transparent',
    grid: { left: 68, right: 24, top: 36, bottom: 68 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', lineStyle: { color: '#64748b', type: 'dashed' } },
      backgroundColor: '#111827',
      borderColor: '#374151',
      borderWidth: 1,
      textStyle: { color: '#f9fafb', fontFamily: 'Arial, sans-serif' },
      extraCssText: 'box-shadow:0 12px 40px rgba(0,0,0,.45);border-radius:12px;',
      formatter: chartTooltip,
    },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    xAxis: {
      type: 'category',
      data: candles.map((candle) => candle.dateLabel),
      boundaryGap: true,
      axisLine: { lineStyle: { color: '#374151' } },
      axisTick: { lineStyle: { color: '#374151' } },
      axisLabel: {
        color: '#9ca3af',
        fontFamily: 'Arial, sans-serif',
        fontSize: 10,
        rotate: 25,
        hideOverlap: true,
      },
      splitLine: { show: false },
    },
    yAxis: {
      scale: true,
      position: 'right',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#9ca3af',
        fontFamily: 'Arial, sans-serif',
        formatter: (value: number) => formatPrice(value),
      },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.10)', type: 'dashed' } },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
      {
        type: 'slider',
        xAxisIndex: 0,
        height: 18,
        bottom: 12,
        borderColor: '#263244',
        backgroundColor: '#111827',
        fillerColor: 'rgba(56,189,248,0.14)',
        handleStyle: { color: '#38bdf8', borderColor: '#7dd3fc' },
        textStyle: { color: '#9ca3af', fontFamily: 'Arial, sans-serif', fontSize: 10 },
      },
    ],
    series: [{
      name: 'قیمت',
      type: 'candlestick',
      data: candles.map((candle) => [
        candle.open,
        candle.close,
        candle.low,
        candle.high,
      ]),
      itemStyle: {
        color: '#22c55e',
        color0: '#ef4444',
        borderColor: '#22c55e',
        borderColor0: '#ef4444',
      },
      emphasis: { itemStyle: { borderWidth: 2 } },
      markPoint: {
        symbol: 'pin',
        data: markPoints,
        tooltip: { trigger: 'item', formatter: chartTooltip },
      },
    }],
  }), [candles, markPoints]);

  const displayName = coinId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-2 backdrop-blur-md sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-candle-title"
        className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-[#0b0e16]/95 shadow-[0_30px_120px_rgba(0,0,0,0.7)] sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs text-cyan-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              نمودار زنده · بازه 30 روزه
            </div>
            <h2 id="live-candle-title" className="truncate text-base font-semibold text-white sm:text-lg">
              تحلیل کندلی {displayName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-gray-300 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_310px] lg:overflow-hidden">
          <div className="flex min-h-[350px] flex-col border-b border-white/[0.06] p-3 sm:min-h-[440px] sm:p-5 lg:min-h-0 lg:border-b-0 lg:border-l">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                <span className="h-2 w-2 rounded-sm bg-emerald-400" />
                کندل صعودی
                <span className="mr-2 h-2 w-2 rounded-sm bg-rose-400" />
                کندل نزولی
              </div>
              <span className="text-[11px] text-gray-500" dir="ltr">OHLC · USD</span>
            </div>
            {candleLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-white/[0.05] bg-white/[0.015]">
                <LoaderCircle className="h-9 w-9 animate-spin text-cyan-300" />
                <p className="text-sm text-gray-400">در حال دریافت کندل‌های زنده...</p>
                <div className="w-2/3 space-y-2">
                  <div className="h-2 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-2 w-4/5 animate-pulse rounded bg-white/[0.06]" />
                </div>
              </div>
            ) : candleError ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-rose-400/10 bg-rose-400/[0.025] p-5">
                <div className="flex max-w-sm flex-col items-center gap-2 text-center text-sm text-rose-300">
                  <AlertCircle size={22} />
                  <p>{candleError}</p>
                </div>
              </div>
            ) : (
              <div className="min-h-[300px] flex-1" dir="ltr">
                <ReactECharts
                  option={chartOption}
                  notMerge
                  lazyUpdate
                  opts={{ renderer: 'canvas' }}
                  style={{ width: '100%', height: '100%', minHeight: 300 }}
                />
              </div>
            )}
            <p className="mt-2 text-center text-[10px] text-gray-600">
              قیمت‌ها و کندل‌ها از CoinGecko دریافت شده‌اند.
            </p>
          </div>

          <aside className="flex min-h-64 flex-col p-4 sm:p-5 lg:min-h-0 lg:overflow-y-auto">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <p className="mb-1 text-[10px] tracking-wide text-gray-500">NEWS OVERLAY</p>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Newspaper size={16} className="text-cyan-300" />
                  اخبار مرتبط با این ارز
                </h3>
              </div>
              {!newsLoading && !newsError && (
                <span className="rounded-full border border-cyan-300/10 bg-cyan-300/[0.06] px-2.5 py-1 text-[10px] text-cyan-200" dir="ltr">
                  {matchedArticles.length} MATCHED
                </span>
              )}
            </div>

            {newsLoading ? (
              <div className="space-y-3" aria-label="در حال بارگذاری اخبار">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="rounded-xl border border-white/[0.06] p-3">
                    <div className="mb-3 h-3 w-24 animate-pulse rounded bg-white/[0.07]" />
                    <div className="mb-2 h-4 w-full animate-pulse rounded bg-white/[0.07]" />
                    <div className="h-4 w-3/4 animate-pulse rounded bg-white/[0.07]" />
                  </div>
                ))}
              </div>
            ) : newsError ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-center text-xs text-rose-300">
                  <AlertCircle size={19} />
                  <p>{newsError}</p>
                </div>
              </div>
            ) : matchedArticles.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                <Newspaper size={24} className="text-gray-600" />
                <p className="text-xs leading-6 text-gray-500">
                  برای این ارز در ۳۰ روز گذشته خبری یافت نشد.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {matchedArticles.map((article, index) => (
                  <article
                    key={`${article.dayKey}-${index}-${article.title}`}
                    className="relative rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.035]"
                  >
                    <span className="absolute -right-[5px] top-4 h-2 w-2 rounded-full border border-[#0b0e16] bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.65)]" />
                    <time
                      dateTime={article.publishedAt}
                      className="mb-2 block text-[10px] text-cyan-200/80"
                      dir="ltr"
                    >
                      {formatDate(Date.parse(article.publishedAt), true)}
                    </time>
                    <h4 className="text-xs font-medium leading-6 text-gray-200">{article.title}</h4>
                  </article>
                ))}
              </div>
            )}
            <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] leading-5 text-gray-600">
              فقط خبرهایی نمایش داده می‌شوند که به طور اختصاصی درباره این ارز در ۳۰ روز اخیر در سایت شما منتشر شده باشند.
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}