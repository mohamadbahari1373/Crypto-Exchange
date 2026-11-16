'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { EChartsOption } from 'echarts';
import { AlertCircle, LoaderCircle, Newspaper, X } from 'lucide-react';
import type { NewsArticle as SiteNewsArticle } from '@/lib/types';
import { fetchNewsData } from '@/lib/newsClient';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

type CandleInterval = '15m' | '1h' | '4h' | '1d' | '1w';

interface LiveNewsCandleChartProps {
  coinId: string;
  coinName: string;
  coinSymbol: string;
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
  volume: number;
}

const OKX_INTERVALS: Record<CandleInterval, string> = {
  '15m': '15m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
  '1w': '1W',
};

const COINGECKO_DAYS: Record<CandleInterval, string> = {
  '15m': '1',
  '1h': '7',
  '4h': '30',
  '1d': '90',
  '1w': '365',
};

const PERSIAN_COIN_NAMES: Record<string, string[]> = {
  BTC: ['بیت کوین', 'بیت‌کوین', 'بیتکوین'],
  ETH: ['اتریوم', 'اتر'],
  BNB: ['بایننس کوین', 'بایننس‌کوین', 'بی ان بی'],
  XRP: ['ریپل'],
  SOL: ['سولانا'],
  ADA: ['کاردانو'],
  DOGE: ['دوج کوین', 'دوج‌کوین', 'دوج'],
  TRX: ['ترون'],
  TON: ['تون', 'تون کوین', 'تون‌کوین'],
  DOT: ['پولکادات'],
  LTC: ['لایت کوین', 'لایت‌کوین'],
  BCH: ['بیت کوین کش', 'بیت‌کوین کش'],
  LINK: ['چین لینک', 'چین‌لینک'],
  AVAX: ['آوالانچ', 'اواکس'],
  SHIB: ['شیبا اینو', 'شیبا'],
  UNI: ['یونی سواپ', 'یونی‌سواپ'],
  XLM: ['استلار'],
  ETC: ['اتریوم کلاسیک'],
  XMR: ['مونرو'],
  NEAR: ['نیر'],
  APT: ['آپتوس'],
  ARB: ['آربیتروم'],
  OP: ['آپتیمیزم'],
  SUI: ['سویی'],
  FIL: ['فایل کوین', 'فایل‌کوین'],
  ATOM: ['کازماس', 'اتم'],
  ICP: ['اینترنت کامپیوتر'],
  HBAR: ['هدرا'],
  VET: ['وی چین', 'وی‌چین'],
  RENDER: ['رندر'],
  FET: ['فچ ای آی', 'فچ ای‌آی'],
  AAVE: ['آوه'],
  MKR: ['میکر'],
  MNT: ['منتل'],
  INJ: ['اینجکتیو'],
  ALGO: ['الگورند'],
  GRT: ['گراف'],
  EOS: ['ایاس'],
  CRO: ['کرونوس'],
  POL: ['پالیگان'],
  MATIC: ['پالیگان'],
  KAS: ['کاسپا'],
  XTZ: ['تزوس'],
  WIF: ['داگ ویف هت', 'داگ‌ویف‌هت'],
  PEPE: ['پپه'],
  BONK: ['بونک'],
  FLOKI: ['فلوکی'],
  AR: ['آرویو'],
  ONDO: ['اوندو'],
  TIA: ['سلسیا'],
  SEI: ['سی'],
  IMX: ['ایمیوتبل اکس'],
  RUNE: ['تورچین'],
  QNT: ['کوانت'],
  FTM: ['فانتوم'],
  LDO: ['لیدو'],
  STX: ['استکس'],
  ZEC: ['زی کش', 'زی‌کش'],
  FLR: ['فلیئر'],
  EGLD: ['الروند'],
  THETA: ['تتا'],
  ENA: ['اتنا'],
  RAY: ['ری‌دیم', 'ریدیوم'],
  JUP: ['ژوپیتر'],
  JTO: ['ژیتو'],
  PENDLE: ['پندل'],
  SAND: ['سندباکس'],
  MANA: ['دیسنترالند'],
  AXS: ['اکسی اینفینیتی'],
  APE: ['ایپ کوین'],
  KAVA: ['کاوا'],
  KCS: ['کوکوین توکن'],
  IOTA: ['آیوتا'],
  DYDX: ['دی دایکس'],
  SNX: ['سینتتیکس'],
  CRV: ['کرو'],
  LUNC: ['ترا کلاسیک'],
  LUNA: ['ترا'],
  ZRO: ['زیرو'],
  ENJ: ['انجین'],
  CFX: ['کانفلاکس'],
  TWT: ['تراست ولت'],
  GMT: ['استپن'],
  BTT: ['بیت تورنت'],
  CORE: ['کور'],
  RPL: ['راکت پول'],
  ARKM: ['آرکهام'],
  PYTH: ['پایث'],
  WLD: ['ورلدکوین'],
  TAO: ['بیت تنسور'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function utcDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function formatDate(timestamp: number, includeTime = false): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    ...(includeTime ? { year: 'numeric' } : {}),
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
    timeZone: 'UTC',
  }).format(timestamp);
}

function formatCandleDate(timestamp: number, interval: CandleInterval): string {
  return formatDate(timestamp, interval === '15m' || interval === '1h' || interval === '4h');
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

function createCandle(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  interval: CandleInterval,
): OhlcCandle {
  return {
    timestamp,
    dateLabel: formatCandleDate(timestamp, interval),
    dayKey: utcDayKey(timestamp),
    open,
    high,
    low,
    close,
    volume,
  };
}

function parseBinanceCandles(payload: unknown, interval: CandleInterval): OhlcCandle[] {
  if (!Array.isArray(payload)) throw new Error('پاسخ کندل Binance معتبر نیست.');
  return payload.flatMap((row): OhlcCandle[] => {
    if (!Array.isArray(row) || row.length < 6) return [];
    const timestamp = asNumber(row[0]);
    const open = asNumber(row[1]);
    const high = asNumber(row[2]);
    const low = asNumber(row[3]);
    const close = asNumber(row[4]);
    if (timestamp <= 0 || close <= 0) return [];
    return [createCandle(timestamp, open, high, low, close, asNumber(row[5]), interval)];
  }).sort((left, right) => left.timestamp - right.timestamp);
}

function parseOkxCandles(payload: unknown, interval: CandleInterval): OhlcCandle[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('پاسخ کندل OKX معتبر نیست.');
  }
  if (payload.code !== '0') throw new Error('OKX کندل این نماد را ارائه نکرد.');
  return payload.data.flatMap((row): OhlcCandle[] => {
    if (!Array.isArray(row) || row.length < 6) return [];
    const timestamp = asNumber(row[0]);
    const open = asNumber(row[1]);
    const high = asNumber(row[2]);
    const low = asNumber(row[3]);
    const close = asNumber(row[4]);
    if (timestamp <= 0 || close <= 0) return [];
    return [createCandle(timestamp, open, high, low, close, asNumber(row[5]), interval)];
  }).sort((left, right) => left.timestamp - right.timestamp);
}

function parseCoinGeckoCandles(payload: unknown, interval: CandleInterval): OhlcCandle[] {
  if (!Array.isArray(payload)) throw new Error('پاسخ کندل CoinGecko معتبر نیست.');
  return payload.flatMap((row): OhlcCandle[] => {
    if (!Array.isArray(row) || row.length < 5) return [];
    const timestamp = asNumber(row[0]);
    const open = asNumber(row[1]);
    const high = asNumber(row[2]);
    const low = asNumber(row[3]);
    const close = asNumber(row[4]);
    if (timestamp <= 0 || close <= 0) return [];
    return [createCandle(timestamp, open, high, low, close, 0, interval)];
  }).sort((left, right) => left.timestamp - right.timestamp);
}

function normalizeNewsText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesCoinNews(
  article: SiteNewsArticle,
  coinName: string,
  coinSymbol: string,
): boolean {
  const text = [
    article.title,
    article.originalTitle,
    article.summary,
    article.originalSummary,
    article.fullContent,
    article.content,
    article.description,
    article.body,
  ].filter((value): value is string => Boolean(value)).join(' ');
  const normalizedText = normalizeNewsText(text);
  const englishName = coinName.trim();
  if (
    englishName &&
    new RegExp(`\\b${escapeRegex(englishName)}\\b`, 'i').test(text)
  ) return true;

  const symbol = coinSymbol.trim().toUpperCase();
  if (symbol && new RegExp(`\\b${escapeRegex(symbol)}\\b`, 'i').test(text)) return true;

  const aliases = PERSIAN_COIN_NAMES[symbol] ?? [];
  return aliases.some((alias) => normalizedText.includes(normalizeNewsText(alias)));
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
    data.length < 4 ||
    !data.every((value) => typeof value === 'number' && Number.isFinite(value))
  ) return '';
  const [open, close, low, high] = data;
  const dateLabel = typeof entry.axisValue === 'string' ? entry.axisValue : '';

  return `<div dir="rtl" style="min-width:180px">
    <div dir="ltr" style="font-size:11px;color:#9ca3af;margin-bottom:8px">${escapeHtml(dateLabel)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px">
      <span style="color:#9ca3af">بازشدن</span><b dir="ltr">${formatPrice(open)}</b>
      <span style="color:#9ca3af">بیشترین</span><b dir="ltr" style="color:#34d399">${formatPrice(high)}</b>
      <span style="color:#9ca3af">کمترین</span><b dir="ltr" style="color:#fb7185">${formatPrice(low)}</b>
      <span style="color:#9ca3af">بسته‌شدن</span><b dir="ltr">${formatPrice(close)}</b>
    </div>
  </div>`;
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function translateToPersian(text: string): Promise<string> {
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

  const translated: string[] = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fa&dt=t&q=${encodeURIComponent(chunk)}`,
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
      throw new Error('پاسخ ترجمه معتبر نیست.');
    }
    const translatedChunk = payload[0].reduce<string>((result, segment) => {
      return Array.isArray(segment) && typeof segment[0] === 'string'
        ? result + segment[0]
        : result;
    }, '');
    if (!translatedChunk) throw new Error('ترجمهٔ خبر خالی است.');
    translated.push(translatedChunk);
  }
  return translated.join('\n\n');
}

export default function LiveNewsCandleChart({
  coinId,
  coinName,
  coinSymbol,
  onClose,
}: LiveNewsCandleChartProps) {
  const [candles, setCandles] = useState<OhlcCandle[]>([]);
  const [articles, setArticles] = useState<SiteNewsArticle[]>([]);
  const [candleLoading, setCandleLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [candleError, setCandleError] = useState<string | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [interval, setInterval] = useState<CandleInterval>('1h');
  const [candleSource, setCandleSource] = useState<string>('');
  const [streamStatus, setStreamStatus] = useState('اتصال به استریم...');
  const [selectedArticle, setSelectedArticle] = useState<SiteNewsArticle | null>(null);
  const [translatedArticle, setTranslatedArticle] = useState<{ id: string; title: string; content: string } | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let socket: WebSocket | null = null;
    let noMessageTimer: number | undefined;
    let usingOkx = false;
    const normalizedSymbol = coinSymbol.trim().toUpperCase();
    const validCoinId = /^[a-zA-Z0-9_-]+$/.test(coinId);
    const validSymbol = /^[A-Z0-9]{2,20}$/.test(normalizedSymbol);

    setCandles([]);
    setCandleLoading(true);
    setCandleError(null);
    setCandleSource('');
    setStreamStatus('اتصال به استریم...');

    const closeSocket = () => {
      if (noMessageTimer !== undefined) window.clearTimeout(noMessageTimer);
      noMessageTimer = undefined;
      if (!socket) return;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      socket = null;
    };

    const addCandles = (incoming: OhlcCandle[]) => {
      if (!active || incoming.length === 0) return;
      setCandles((current) => {
        const byTimestamp = new Map(current.map((candle) => [candle.timestamp, candle]));
        for (const candle of incoming) byTimestamp.set(candle.timestamp, candle);
        return [...byTimestamp.values()]
          .sort((left, right) => left.timestamp - right.timestamp)
          .slice(-100);
      });
    };

    const parseBinanceUpdate = (payload: unknown): OhlcCandle[] => {
      if (!isRecord(payload) || !isRecord(payload.k)) return [];
      const candle = payload.k;
      const timestamp = asNumber(candle.t);
      const close = asNumber(candle.c);
      if (timestamp <= 0 || close <= 0) return [];
      return [createCandle(
        timestamp,
        asNumber(candle.o),
        asNumber(candle.h),
        asNumber(candle.l),
        close,
        asNumber(candle.v),
        interval,
      )];
    };

    const parseOkxUpdate = (payload: unknown): OhlcCandle[] => {
      if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
      return payload.data.flatMap((row): OhlcCandle[] => {
        if (!Array.isArray(row) || row.length < 6) return [];
        const timestamp = asNumber(row[0]);
        const close = asNumber(row[4]);
        if (timestamp <= 0 || close <= 0) return [];
        return [createCandle(
          timestamp,
          asNumber(row[1]),
          asNumber(row[2]),
          asNumber(row[3]),
          close,
          asNumber(row[5]),
          interval,
        )];
      });
    };

    const connectOkx = () => {
      if (!active || usingOkx) return;
      usingOkx = true;
      closeSocket();
      try {
        const nextSocket = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
        socket = nextSocket;
        setStreamStatus('اتصال جایگزین OKX');
        nextSocket.onopen = () => {
          nextSocket.send(JSON.stringify({
            op: 'subscribe',
            args: [{ channel: `candle${OKX_INTERVALS[interval]}`, instId: `${normalizedSymbol}-USDT` }],
          }));
        };
        nextSocket.onmessage = (event) => {
          try {
            addCandles(parseOkxUpdate(JSON.parse(String(event.data)) as unknown));
            setStreamStatus('زنده · OKX');
          } catch (error) {
            console.warn('Invalid OKX candle stream update:', error);
          }
        };
        nextSocket.onerror = () => setStreamStatus('استریم در دسترس نیست');
        nextSocket.onclose = () => {
          if (active) setStreamStatus('استریم قطع شد');
        };
      } catch (error) {
        console.warn('Unable to connect to the OKX candle stream:', error);
        setStreamStatus('استریم در دسترس نیست');
      }
    };

    const connectBinance = () => {
      if (!active || usingOkx || !validSymbol) {
        if (!validSymbol) connectOkx();
        return;
      }
      try {
        const nextSocket = new WebSocket(
          `wss://data-stream.binance.vision/ws/${normalizedSymbol.toLowerCase()}usdt@kline_${interval}`,
        );
        socket = nextSocket;
        let receivedMessage = false;
        setStreamStatus('اتصال به Binance...');
        nextSocket.onopen = () => {
          noMessageTimer = window.setTimeout(() => {
            if (!receivedMessage) connectOkx();
          }, 7000);
        };
        nextSocket.onmessage = (event) => {
          receivedMessage = true;
          if (noMessageTimer !== undefined) window.clearTimeout(noMessageTimer);
          noMessageTimer = undefined;
          try {
            addCandles(parseBinanceUpdate(JSON.parse(String(event.data)) as unknown));
            setStreamStatus('زنده · Binance');
          } catch (error) {
            console.warn('Invalid Binance candle stream update:', error);
          }
        };
        nextSocket.onerror = () => connectOkx();
        nextSocket.onclose = () => {
          if (active && !usingOkx) connectOkx();
        };
      } catch (error) {
        console.warn('Unable to connect to the Binance candle stream:', error);
        connectOkx();
      }
    };

    const loadCandles = async () => {
      const binanceUrl = `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(`${normalizedSymbol}USDT`)}&interval=${interval}&limit=100`;
      const okxUrl = `https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(`${normalizedSymbol}-USDT`)}&bar=${OKX_INTERVALS[interval]}&limit=100`;
      try {
        if (!validSymbol) throw new Error('نماد ارز معتبر نیست.');
        const payload = await fetchJson(binanceUrl, controller.signal);
        const rows = parseBinanceCandles(payload, interval);
        if (!rows.length) throw new Error('Binance کندلی برای این نماد ندارد.');
        if (!active) return;
        setCandles(rows.slice(-100));
        setCandleSource('Binance');
        connectBinance();
      } catch (binanceError) {
        if (!active || controller.signal.aborted) return;
        try {
          const payload = await fetchJson(okxUrl, controller.signal);
          const rows = parseOkxCandles(payload, interval);
          if (!rows.length) throw new Error('OKX کندلی برای این نماد ندارد.');
          if (!active) return;
          setCandles(rows.slice(-100));
          setCandleSource('OKX');
          connectOkx();
        } catch (okxError) {
          if (!active || controller.signal.aborted) return;
          try {
            if (!validCoinId) throw new Error('شناسهٔ CoinGecko معتبر نیست.');
            const payload = await fetchJson(
              `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/ohlc?vs_currency=usd&days=${COINGECKO_DAYS[interval]}`,
              controller.signal,
            );
            const rows = parseCoinGeckoCandles(payload, interval);
            if (!rows.length) throw new Error('CoinGecko کندلی برای این نماد ندارد.');
            if (!active) return;
            setCandles(rows.slice(-100));
            setCandleSource('CoinGecko');
            connectBinance();
          } catch (coinGeckoError) {
            if (active && !controller.signal.aborted) {
              const error = coinGeckoError instanceof Error ? coinGeckoError : binanceError;
              setCandleError(
                error instanceof Error && error.message.startsWith('HTTP ')
                  ? `دریافت نمودار ناموفق بود (${error.message}).`
                  : error instanceof Error
                    ? error.message
                    : 'دریافت اطلاعات نمودار ناموفق بود.',
              );
            }
          }
        }
      } finally {
        if (active && !controller.signal.aborted) setCandleLoading(false);
      }
    };

    void loadCandles();
    return () => {
      active = false;
      controller.abort();
      closeSocket();
    };
  }, [coinId, coinSymbol, interval]);

  useEffect(() => {
    const controller = new AbortController();
    setArticles([]);
    setNewsLoading(true);
    setNewsError(null);
    setSelectedArticle(null);
    setTranslatedArticle(null);
    setShowTranslation(false);
    setTranslationError(null);
    setTranslationLoading(false);
    void fetchNewsData(controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setArticles(response.articles);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setNewsError(
            error instanceof Error && error.message.startsWith('HTTP ')
              ? `دریافت اخبار ناموفق بود (${error.message}).`
              : error instanceof Error
                ? error.message
                : 'دریافت اخبار سایت ناموفق بود.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setNewsLoading(false);
      });
    return () => controller.abort();
  }, [coinId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedArticle) setSelectedArticle(null);
        else onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, selectedArticle]);

  const matchedArticles = useMemo(() => articles
    .filter((article) => matchesCoinNews(article, coinName, coinSymbol))
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt)),
  [articles, coinName, coinSymbol]);

  const translateSelectedArticle = async () => {
    if (!selectedArticle) return;
    if (translatedArticle?.id === selectedArticle.id) {
      setShowTranslation((current) => !current);
      return;
    }

    setTranslationLoading(true);
    setTranslationError(null);
    try {
      const sourceTitle = selectedArticle.originalTitle || selectedArticle.title;
      const sourceContent = selectedArticle.fullContent
        || selectedArticle.content
        || selectedArticle.body
        || selectedArticle.description
        || selectedArticle.originalSummary
        || selectedArticle.summary;
      const [title, content] = await Promise.all([
        translateToPersian(sourceTitle),
        translateToPersian(sourceContent),
      ]);
      setTranslatedArticle({ id: selectedArticle.id, title, content });
      setShowTranslation(true);
    } catch (error) {
      console.error(`Unable to translate news article ${selectedArticle.id}:`, error);
      setTranslationError('ترجمه انجام نشد. دوباره تلاش کنید.');
    } finally {
      setTranslationLoading(false);
    }
  };

  const markPoints = useMemo(() => {
    const candleByDay = new Map<string, OhlcCandle>();
    for (const candle of candles) {
      candleByDay.set(candle.dayKey, candle);
    }
    return matchedArticles.flatMap((article) => {
      const timestamp = Date.parse(article.publishedAt);
      const candle = Number.isFinite(timestamp)
        ? candleByDay.get(utcDayKey(timestamp))
        : undefined;
      if (!candle) return [];
      return [{
        name: article.title,
        title: article.title,
        dateLabel: formatDate(timestamp, true),
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
    grid: [
      { left: 68, right: 24, top: 36, height: '58%' },
      { left: 68, right: 24, top: '76%', height: '13%' },
    ],
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
    xAxis: [0, 1].map((gridIndex) => ({
      type: 'category' as const,
      gridIndex,
      data: candles.map((candle) => candle.dateLabel),
      boundaryGap: true,
      axisLine: { lineStyle: { color: '#374151' } },
      axisTick: { lineStyle: { color: '#374151' } },
      axisLabel: {
        show: gridIndex === 1,
        color: '#9ca3af',
        fontFamily: 'Arial, sans-serif',
        fontSize: 10,
        rotate: 25,
        hideOverlap: true,
      },
      splitLine: { show: false },
    })),
    yAxis: [
      {
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
      {
        gridIndex: 1,
        scale: true,
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 },
      {
        type: 'slider',
        xAxisIndex: [0, 1],
        height: 14,
        bottom: 4,
        borderColor: '#263244',
        backgroundColor: '#111827',
        fillerColor: 'rgba(56,189,248,0.14)',
        handleStyle: { color: '#38bdf8', borderColor: '#7dd3fc' },
        textStyle: { color: '#9ca3af', fontFamily: 'Arial, sans-serif', fontSize: 10 },
      },
    ],
    series: [
      {
        name: 'قیمت',
        type: 'candlestick',
        xAxisIndex: 0,
        yAxisIndex: 0,
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
      },
      {
        name: 'حجم',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: candles.map((candle) => ({
          value: candle.volume,
          itemStyle: {
            color: candle.close >= candle.open
              ? 'rgba(34,197,94,0.65)'
              : 'rgba(239,68,68,0.65)',
          },
        })),
      },
    ],
  }), [candles, markPoints]);

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
              نمودار زنده · {streamStatus}
            </div>
            <h2 id="live-candle-title" className="truncate text-base font-semibold text-white sm:text-lg">
              تحلیل کندلی {coinName} <span className="font-sans uppercase text-gray-400" dir="ltr">({coinSymbol})</span>
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="انتخاب بازه نمودار">
                {([
                  ['15m', '15m'],
                  ['1h', '1H'],
                  ['4h', '4H'],
                  ['1d', '1D'],
                  ['1w', '1W'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setInterval(value)}
                    aria-pressed={interval === value}
                    className={`rounded-lg border px-3 py-1.5 font-sans text-xs font-semibold transition ${
                      interval === value
                        ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
                        : 'border-white/[0.07] bg-white/[0.025] text-gray-400 hover:text-gray-200'
                    }`}
                    dir="ltr"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-gray-500" dir="ltr">
                {candleSource ? `${candleSource} · ${streamStatus}` : streamStatus}
              </span>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                <span className="h-2 w-2 rounded-sm bg-emerald-400" />
                کندل صعودی
                <span className="mr-2 h-2 w-2 rounded-sm bg-rose-400" />
                کندل نزولی
                <span className="mr-2 h-2 w-2 rounded-sm bg-cyan-400/70" />
                حجم
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
              دادهٔ تاریخچه از {candleSource || 'Binance / OKX / CoinGecko'} دریافت می‌شود.
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
                  در حال حاضر خبری مرتبط با این ارز ثبت نشده است
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {matchedArticles.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => {
                      setSelectedArticle(article);
                      setShowTranslation(false);
                      setTranslationError(null);
                    }}
                    className="relative block w-full rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-right transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                  >
                    <span className="absolute -right-[5px] top-4 h-2 w-2 rounded-full border border-[#0b0e16] bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.65)]" />
                    <time
                      dateTime={article.publishedAt}
                      className="mb-2 block text-[10px] text-cyan-200/80"
                      dir="ltr"
                    >
                      {formatDate(Date.parse(article.publishedAt), true)}
                    </time>
                    <span className="mb-1 block text-[10px] text-gray-500">
                      {article.sourceNameFa || article.sourceNameEn || article.source}
                    </span>
                    <span dir="auto" className="block text-xs font-medium leading-6 text-gray-200">
                      {article.originalTitle || article.title}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] leading-5 text-gray-600">
              خبرها از فید اخبار سایت دریافت و بر اساس نام و نماد این ارز فیلتر می‌شوند.
            </p>
          </aside>
        </div>
      </section>

      {selectedArticle && (() => {
        const translated = translatedArticle?.id === selectedArticle.id && showTranslation;
        const articleTitle = translated
          ? translatedArticle.title
          : selectedArticle.originalTitle || selectedArticle.title;
        const articleContent = translated
          ? translatedArticle.content
          : selectedArticle.fullContent
            || selectedArticle.content
            || selectedArticle.body
            || selectedArticle.description
            || selectedArticle.originalSummary
            || selectedArticle.summary;
        const articleImage = selectedArticle.imageUrl || selectedArticle.image_url || selectedArticle.image;
        return (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-5"
            onClick={() => setSelectedArticle(null)}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="selected-news-title"
              onClick={(event) => event.stopPropagation()}
              className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#10141e] text-white shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                aria-label="بستن خبر"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white hover:bg-black"
              >
                <X size={18} />
              </button>
              {articleImage && (
                <div className="relative flex max-h-[36vh] min-h-32 shrink-0 items-center justify-center overflow-hidden bg-black/30">
                  <Image
                    src={articleImage}
                    alt={articleTitle}
                    width={1200}
                    height={700}
                    unoptimized
                    className="max-h-[36vh] w-full object-contain"
                  />
                </div>
              )}
              <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-2.5 py-1 text-cyan-200">
                    {selectedArticle.sourceNameFa || selectedArticle.sourceNameEn || selectedArticle.source}
                  </span>
                  <time dateTime={selectedArticle.publishedAt} className="text-gray-400" dir="ltr">
                    {formatDate(Date.parse(selectedArticle.publishedAt), true)}
                  </time>
                </div>
                <h2 id="selected-news-title" dir="auto" className="mb-4 text-lg font-bold leading-relaxed sm:text-xl">
                  {articleTitle}
                </h2>
                <div dir="auto" className="whitespace-pre-wrap break-words text-sm leading-8 text-gray-300">
                  {articleContent}
                </div>
                {translationError && (
                  <p role="alert" className="mt-3 text-sm text-rose-300">{translationError}</p>
                )}
                <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
                  <button
                    type="button"
                    onClick={() => void translateSelectedArticle()}
                    disabled={translationLoading}
                    className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.12] disabled:opacity-60"
                  >
                    {translationLoading
                      ? 'در حال ترجمه...'
                      : translatedArticle?.id === selectedArticle.id && showTranslation
                        ? 'نمایش متن اصلی'
                        : 'ترجمه به فارسی'}
                  </button>
                  <a
                    href={selectedArticle.url || selectedArticle.link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/[0.08]"
                  >
                    مشاهده منبع اصلی
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