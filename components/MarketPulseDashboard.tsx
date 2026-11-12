'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { Activity, AlertCircle, ArrowDownRight, ArrowUpRight, Bitcoin, Globe2, TrendingDown, TrendingUp, Waves } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import LiveNewsCandleChart from '@/components/LiveNewsCandleChart';

type LoadState<T> = { status: 'loading'; data: null; error: null } | { status: 'success'; data: T; error: null } | { status: 'error'; data: null; error: string };

interface FearGreedPoint { value: number; classification: string; timestamp: number; date: string; }
interface GlobalMarketData { marketCapUsd: number; volumeUsd: number; bitcoinDominance: number; marketCapChange24h: number; }
interface MarketCoin { id: string; name: string; symbol: string; image: string; currentPrice: number; marketCap: number | null; marketCapRank: number | null; priceChange24h: number | null; sparkline: number[]; }
interface TrendingCoin { id: string; name: string; symbol: string; thumb: string | null; marketCapRank: number | null; }

// فیلتر قوی‌تر برای حذف استیبل‌کوین‌ها و توکن‌های طلا
const STABLECOIN_SYMBOLS = new Set(['USDT', 'USDC', 'DAI', 'FDUSD', 'USDD', 'TUSD', 'XAUT', 'PAXG', 'USYC', 'LEO']);

const initialState = <T,>(): LoadState<T> => ({ status: 'loading', data: null, error: null });
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const formatNumber = (value: number, maximumFractionDigits = 2) => new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
const formatUsdCompact = (value: number) => {
  const units = [{ limit: 1e12, suffix: 'T' }, { limit: 1e9, suffix: 'B' }, { limit: 1e6, suffix: 'M' }];
  const unit = units.find(({ limit }) => Math.abs(value) >= limit);
  if (!unit) return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
  return `$${(value / unit.limit).toLocaleString('en-US', { maximumFractionDigits: 2 })}${unit.suffix}`;
};
const formatUsdPrice = (value: number) => {
  const fractionDigits = value >= 1 ? 2 : value >= 0.01 ? 4 : 8;
  return `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: fractionDigits }).format(value)}`;
};
function formatChartDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(timestamp * 1000));
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith('HTTP ')) return `دریافت اطلاعات ناموفق بود (${error.message}).`;
  return 'اتصال برقرار نشد. لطفاً دوباره تلاش کنید.';
}

function Skeleton({ className = '' }: { className?: string }) { return <div className={`animate-pulse rounded-lg bg-white/[0.07] ${className}`} />; }
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center text-sm text-rose-300">
      <AlertCircle size={20} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string; }) {
  return <article className={`rounded-2xl border border-white/[0.08] bg-[#12141c]/80 shadow-[0_16px_50px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl ${className}`}>{children}</article>;
}

function SectionHeading({ eyebrow, title, icon, iconClass = 'text-cyan-300' }: { eyebrow: string; title: string; icon: ReactNode; iconClass?: string; }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="mb-1 font-sans text-[11px] font-medium tracking-wide text-gray-500" dir="ltr">{eyebrow}</p>
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      <span className={`rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5 ${iconClass}`}>{icon}</span>
    </div>
  );
}

function StatCard({ title, value, detail, icon, loading, error, accent }: { title: string; value: string; detail?: ReactNode; icon: ReactNode; loading: boolean; error: string | null; accent: string; }) {
  return (
    <Panel className="group relative overflow-hidden p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.14]">
      <div className={`pointer-events-none absolute -left-10 -top-12 h-28 w-28 rounded-full opacity-[0.08] blur-3xl ${accent.replace('text-', 'bg-')}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          {loading ? (
            <div className="mt-4 space-y-2"><Skeleton className="h-7 w-36" /><Skeleton className="h-3 w-24" /></div>
          ) : error ? (
            <div className="mt-3"><ErrorState message={error} /></div>
          ) : (
            <><p className="mt-3 font-sans text-2xl font-bold tracking-tight text-white sm:text-[27px]" dir="ltr">{value}</p>{detail && <div className="mt-2 text-xs text-gray-400">{detail}</div>}</>
          )}
        </div>
        <span className={`rounded-xl border border-white/[0.07] bg-white/[0.04] p-2.5 ${accent}`}>{icon}</span>
      </div>
    </Panel>
  );
}

function Sparkline({ values, positive, id }: { values: number[]; positive: boolean; id: string; }) {
  if (values.length < 2) return <span className="text-[10px] text-gray-600">نمودار در دسترس نیست</span>;
  const color = positive ? '#34d399' : '#fb7185';
  const data = values.map((price, index) => ({ index, price }));
  return (
    <div className="h-10 w-24 sm:w-28" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Line type="monotone" dataKey="price" stroke={color} strokeWidth={1.8} dot={false} activeDot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CoinRow({ coin, onSelect }: { coin: MarketCoin; onSelect: (coinId: string) => void; }) {
  const positive = coin.priceChange24h !== null && coin.priceChange24h >= 0;
  return (
    <button type="button" onClick={() => onSelect(coin.id)} className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 rounded-xl border border-white/[0.055] bg-white/[0.015] p-3.5 text-right transition hover:border-cyan-300/20 hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 sm:grid-cols-[minmax(0,1.15fr)_minmax(95px,0.8fr)_minmax(95px,0.75fr)_minmax(96px,0.65fr)] sm:gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]"><Image src={coin.image} alt="" fill sizes="40px" unoptimized className="object-cover" /></div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-100">{coin.name}</p>
          <p className="mt-0.5 font-sans text-xs uppercase tracking-wider text-gray-500" dir="ltr">{coin.symbol}<span className="mx-1.5 text-gray-700">·</span><span dir="rtl" className="normal-case tracking-normal">رتبه </span><span className="font-sans" dir="ltr">{coin.marketCapRank === null ? '—' : formatNumber(coin.marketCapRank)}</span></p>
        </div>
      </div>
      <div className="text-left font-sans sm:text-right" dir="ltr">
        <p className="font-sans text-sm font-semibold text-white">{formatUsdPrice(coin.currentPrice)}</p>
        <p className="mt-1 font-sans text-[10px] text-gray-500" dir="ltr">{coin.marketCap === null ? 'ارزش بازار —' : `${formatUsdCompact(coin.marketCap)} ارزش بازار`}</p>
      </div>
      <div className="flex items-center justify-end gap-2 sm:justify-center">
        {coin.priceChange24h === null ? <span className="rounded-lg border border-white/[0.08] px-2 py-1 text-xs text-gray-500">ناموجود</span> : <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-sans text-xs font-semibold tabular-nums ${positive ? 'border-emerald-400/20 bg-emerald-400/[0.09] text-emerald-300 shadow-[0_0_18px_-10px_rgba(52,211,153,0.9)]' : 'border-rose-400/20 bg-rose-400/[0.09] text-rose-300 shadow-[0_0_18px_-10px_rgba(251,113,133,0.9)]'}`} dir="ltr">{positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{positive ? '+' : ''}{formatNumber(coin.priceChange24h)}%</span>}
      </div>
      <div className="col-span-2 flex items-center justify-between border-t border-white/[0.04] pt-2 sm:col-span-1 sm:justify-end sm:border-0 sm:pt-0">
        <span className="text-[10px] text-gray-500 sm:hidden">روند 7 روزه</span>
        <Sparkline values={coin.sparkline} positive={positive} id={coin.id} />
      </div>
    </button>
  );
}

function MovementCard({ coin, type, onSelect }: { coin: MarketCoin & { priceChange24h: number }; type: 'gainer' | 'loser'; onSelect: (coinId: string) => void; }) {
  const isGainer = type === 'gainer';
  return (
    <button type="button" onClick={() => onSelect(coin.id)} className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-right transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${isGainer ? 'border-emerald-400/15 bg-emerald-400/[0.035]' : 'border-rose-400/15 bg-rose-400/[0.035]'}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/[0.06]"><Image src={coin.image} alt="" fill sizes="32px" unoptimized className="object-cover" /></div>
        <div className="min-w-0">
          <p className="truncate font-sans text-xs font-semibold text-gray-100" dir="ltr">{coin.name}</p>
          <p className="font-sans text-[10px] uppercase text-gray-500" dir="ltr">{coin.symbol}</p>
        </div>
      </div>
      <p className={`shrink-0 font-sans text-sm font-bold tabular-nums ${isGainer ? 'text-emerald-300' : 'text-rose-300'}`} dir="ltr">{isGainer ? '+' : ''}{formatNumber(coin.priceChange24h)}%</p>
    </button>
  );
}

export default function MarketPulseDashboard() {
  const [fearGreed, setFearGreed] = useState<LoadState<FearGreedPoint[]>>(initialState);
  const [globalMarket, setGlobalMarket] = useState<LoadState<GlobalMarketData>>(initialState);
  const [marketCoins, setMarketCoins] = useState<LoadState<MarketCoin[]>>(initialState);
  const [trendingCoins, setTrendingCoins] = useState<LoadState<TrendingCoin[]>>(initialState);
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null);
  const activeController = useRef<AbortController | null>(null);
  const closeChart = useCallback(() => setSelectedCoinId(null), []);

  const refreshData = useCallback(async (signal: AbortSignal) => {
    const loadFearGreed = async () => {
      setFearGreed({ status: 'loading', data: null, error: null });
      try {
        const response = await fetchJson<any>('https://api.alternative.me/fng/?limit=30', signal);
        const points = response.data.map((entry: any) => ({
          value: Number(entry.value), classification: entry.value_classification, timestamp: Number(entry.timestamp), date: formatChartDate(Number(entry.timestamp))
        })).sort((a: any, b: any) => a.timestamp - b.timestamp);
        if (!signal.aborted) setFearGreed({ status: 'success', data: points, error: null });
      } catch (error) { if (!signal.aborted) setFearGreed({ status: 'error', data: null, error: getErrorMessage(error) }); }
    };

    const loadGlobalMarket = async () => {
      setGlobalMarket({ status: 'loading', data: null, error: null });
      try {
        const response = await fetchJson<any>('https://api.coingecko.com/api/v3/global', signal);
        const data = response.data;
        if (!signal.aborted) setGlobalMarket({ status: 'success', data: { marketCapUsd: data.total_market_cap.usd, volumeUsd: data.total_volume.usd, bitcoinDominance: data.market_cap_percentage.btc, marketCapChange24h: data.market_cap_change_percentage_24h_usd }, error: null });
      } catch (error) { if (!signal.aborted) setGlobalMarket({ status: 'error', data: null, error: getErrorMessage(error) }); }
    };

    const loadMarketCoins = async () => {
      setMarketCoins({ status: 'loading', data: null, error: null });
      try {
        const response = await fetchJson<any[]>('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h', signal);
        const coins = response.filter(coin => !STABLECOIN_SYMBOLS.has(coin.symbol?.trim().toUpperCase())).map(coin => ({
          id: coin.id, name: coin.name, symbol: coin.symbol, image: coin.image, currentPrice: coin.current_price, marketCap: coin.market_cap, marketCapRank: coin.market_cap_rank, priceChange24h: coin.price_change_percentage_24h, sparkline: coin.sparkline_in_7d?.price || []
        }));
        if (!signal.aborted) setMarketCoins({ status: 'success', data: coins, error: null });
      } catch (error) { if (!signal.aborted) setMarketCoins({ status: 'error', data: null, error: getErrorMessage(error) }); }
    };

    const loadTrendingCoins = async () => {
      setTrendingCoins({ status: 'loading', data: null, error: null });
      try {
        const response = await fetchJson<any>('https://api.coingecko.com/api/v3/search/trending', signal);
        const coins = response.coins.filter((c: any) => !STABLECOIN_SYMBOLS.has(c.item.symbol.trim().toUpperCase())).slice(0, 5).map((c: any) => ({
          id: c.item.id, name: c.item.name, symbol: c.item.symbol, thumb: c.item.thumb, marketCapRank: c.item.market_cap_rank
        }));
        if (!signal.aborted) setTrendingCoins({ status: 'success', data: coins, error: null });
      } catch (error) { if (!signal.aborted) setTrendingCoins({ status: 'error', data: null, error: getErrorMessage(error) }); }
    };

    await Promise.all([loadFearGreed(), loadGlobalMarket(), loadMarketCoins(), loadTrendingCoins()]);
  }, []);

  const loadDashboard = useCallback(async () => {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    await refreshData(controller.signal);
  }, [refreshData]);

  useEffect(() => {
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(), 60_000);
    return () => { activeController.current?.abort(); window.clearInterval(interval); };
  }, [loadDashboard]);

  const market = globalMarket.status === 'success' ? globalMarket.data : null;
  const change = market?.marketCapChange24h;
  const sentimentPoints = fearGreed.status === 'success' ? fearGreed.data : [];
  const latestSentiment = sentimentPoints[sentimentPoints.length - 1];
  const coinList = marketCoins.status === 'success' ? marketCoins.data : [];
  
  const movementCoins = coinList.filter((coin): coin is MarketCoin & { priceChange24h: number } => coin.priceChange24h !== null);
  const gainers = movementCoins.filter(c => c.priceChange24h > 0).sort((a, b) => b.priceChange24h - a.priceChange24h).slice(0, 3);
  const losers = movementCoins.filter(c => c.priceChange24h < 0).sort((a, b) => a.priceChange24h - b.priceChange24h).slice(0, 3);
  
  // تغییر به 20 ارز برای لیست پایینی بجای 10 ارز
  const topCoins = coinList.slice(0, 20);

  return (
    <main dir="rtl" className="min-h-screen bg-[#090b11] px-4 py-7 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="relative mb-6 overflow-hidden rounded-3xl border border-cyan-400/10 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.12),transparent_36%),radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.10),transparent_35%),#10121a] px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1 text-xs text-cyan-200">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
                داده‌های زنده بازار
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">نبض جهانی بازار</h1>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="ارزش کل بازار" value={market ? formatUsdCompact(market.marketCapUsd) : ''} detail={market && change !== undefined ? <span className={`inline-flex items-center gap-1 font-sans ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} dir="ltr">{change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{formatNumber(change)}%</span> : undefined} icon={<Globe2 size={19} />} loading={globalMarket.status === 'loading'} error={globalMarket.status === 'error' ? globalMarket.error : null} accent="text-violet-300" />
          <StatCard title="حجم معاملات 24 ساعته" value={market ? formatUsdCompact(market.volumeUsd) : ''} icon={<Activity size={19} />} loading={globalMarket.status === 'loading'} error={globalMarket.status === 'error' ? globalMarket.error : null} accent="text-cyan-300" />
          <StatCard title="دامیننس بیت‌کوین" value={market ? `${formatNumber(market.bitcoinDominance)}%` : ''} icon={<Bitcoin size={19} />} loading={globalMarket.status === 'loading'} error={globalMarket.status === 'error' ? globalMarket.error : null} accent="text-amber-300" />
          <StatCard title="تغییر ارزش بازار" value={market && change !== undefined ? `${change > 0 ? '+' : ''}${formatNumber(change)}%` : ''} icon={<TrendingUp size={19} />} loading={globalMarket.status === 'loading'} error={globalMarket.status === 'error' ? globalMarket.error : null} accent={change !== undefined && change < 0 ? 'text-rose-300' : 'text-emerald-300'} />
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel className="overflow-hidden p-5 sm:p-6">
            <SectionHeading eyebrow="SENTIMENT · 30D" title="شاخص ترس و طمع" icon={<Activity size={20} />} iconClass="text-amber-300" />
            {fearGreed.status === 'loading' ? <div className="mt-6 space-y-4"><Skeleton className="mx-auto h-14 w-40" /><Skeleton className="h-3 w-full" /><Skeleton className="h-36 w-full" /></div> : latestSentiment ? (
              <>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className={`font-sans text-5xl font-bold tracking-tight ${latestSentiment.value >= 50 ? 'text-emerald-300' : 'text-rose-300'}`} dir="ltr">{formatNumber(latestSentiment.value, 0)}<span className="mr-1 text-base font-medium text-gray-500">/ 100</span></p>
                  </div>
                  <span className={`rounded-full border px-3 py-1.5 text-sm font-medium ${latestSentiment.value >= 50 ? 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200' : 'border-rose-400/20 bg-rose-400/[0.08] text-rose-200'}`}>{latestSentiment.classification}</span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-gradient-to-l from-rose-500/80 via-amber-400/80 to-emerald-400/80"><div className="h-full bg-[#12141c]/90 transition-[width] duration-700" style={{ width: `${latestSentiment.value}%` }} /></div>
                <div className="mt-5 h-36 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sentimentPoints} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sentimentArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={latestSentiment.value >= 50 ? '#34d399' : '#fb7185'} stopOpacity={0.32} /><stop offset="100%" stopColor={latestSentiment.value >= 50 ? '#34d399' : '#fb7185'} stopOpacity={0.015} /></linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#ffffff" strokeOpacity={0.06} />
                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={26} />
                      <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={{ background: '#171923', border: '1px solid #343744', borderRadius: 12, color: '#fff' }} labelStyle={{ color: '#9ca3af', fontSize: 11 }} />
                      <Area type="monotone" dataKey="value" stroke={latestSentiment.value >= 50 ? '#34d399' : '#fb7185'} strokeWidth={2} fill="url(#sentimentArea)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : null}
          </Panel>

          <Panel className="p-5 sm:p-6">
            <SectionHeading eyebrow="MARKET MOVERS · 24H" title="برندگان و بازندگان" icon={<Waves size={20} />} iconClass="text-violet-300" />
            {marketCoins.status === 'loading' ? <Skeleton className="mt-5 h-48 w-full" /> : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.025] p-3">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-emerald-300"><TrendingUp size={15} /> بیشترین رشد</div>
                  <div className="space-y-2">{gainers.map(coin => <MovementCard key={coin.id} coin={coin} type="gainer" onSelect={setSelectedCoinId} />)}</div>
                </div>
                <div className="rounded-xl border border-rose-400/10 bg-rose-400/[0.025] p-3">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-rose-300"><TrendingDown size={15} /> بیشترین افت</div>
                  <div className="space-y-2">{losers.map(coin => <MovementCard key={coin.id} coin={coin} type="loser" onSelect={setSelectedCoinId} />)}</div>
                </div>
              </div>
            )}
          </Panel>
        </section>

        <Panel className="mb-6 p-5 sm:p-6">
          <SectionHeading eyebrow="COINGECKO TRENDING" title="ارزهای ترند" icon={<Waves size={19} />} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {trendingCoins.data?.map((coin, i) => (
              <button key={coin.id} type="button" onClick={() => setSelectedCoinId(coin.id)} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 text-right hover:border-cyan-300/20">
                <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">{coin.thumb && <Image src={coin.thumb} alt="" fill unoptimized className="object-cover" />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-sans text-xs font-semibold">{coin.name}</span></span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-4"><SectionHeading eyebrow="LIVE MARKET DATA" title="برترین ارزهای بازار" icon={<TrendingUp size={20} />} /></div>
          <div className="space-y-2 p-3 sm:px-5 sm:pb-5">
            {topCoins.map(coin => <CoinRow key={coin.id} coin={coin} onSelect={setSelectedCoinId} />)}
          </div>
        </Panel>
      </div>
      
      {selectedCoinId && <LiveNewsCandleChart coinId={selectedCoinId} onClose={closeChart} />}
    </main>
  );
}