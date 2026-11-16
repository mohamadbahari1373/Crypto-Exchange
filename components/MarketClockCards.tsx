'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Language } from '@/lib/types';

const MARKETS = [
  {
    id: 'tehran',
    cityFa: 'تهران',
    cityEn: 'Tehran',
    timeZone: 'Asia/Tehran',
    open: 0,
    close: 24 * 60,
    is24x7: true,
    accent: {
      border: 'border-cyan-500/40 shadow-[0_0_14px_rgba(34,211,238,0.16)]',
      city: 'text-teal-300',
      openDot: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]',
      openStatus: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
      digits: 'text-teal-200',
      seconds: 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.65)]',
      colon: 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.65)]',
    },
  },
  {
    id: 'tokyo',
    cityFa: 'توکیو',
    cityEn: 'Tokyo',
    timeZone: 'Asia/Tokyo',
    open: 9 * 60,
    close: 15 * 60,
    is24x7: false,
    accent: {
      border: 'border-fuchsia-500/40 shadow-[0_0_14px_rgba(217,70,239,0.16)]',
      city: 'text-pink-300',
      openDot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
      openStatus: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
      digits: 'text-pink-200',
      seconds: 'text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]',
      colon: 'text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.55)]',
    },
  },
  {
    id: 'london',
    cityFa: 'لندن',
    cityEn: 'London',
    timeZone: 'Europe/London',
    open: 8 * 60,
    close: 16 * 60 + 30,
    is24x7: false,
    accent: {
      border: 'border-blue-500/40 shadow-[0_0_14px_rgba(59,130,246,0.18)]',
      city: 'text-indigo-300',
      openDot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
      openStatus: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
      digits: 'text-indigo-200',
      seconds: 'text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]',
      colon: 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.55)]',
    },
  },
  {
    id: 'new-york',
    cityFa: 'نیویورک',
    cityEn: 'New York',
    timeZone: 'America/New_York',
    open: 9 * 60 + 30,
    close: 16 * 60,
    is24x7: false,
    accent: {
      border: 'border-emerald-500/40 shadow-[0_0_14px_rgba(16,185,129,0.18)]',
      city: 'text-amber-300',
      openDot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
      openStatus: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
      digits: 'text-amber-200',
      seconds: 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]',
      colon: 'text-amber-400',
    },
  },
] as const;

const CLOSED_MARKET_STYLE = {
  border: 'border-rose-500/40 shadow-[0_0_14px_rgba(244,63,94,0.18)]',
  city: 'text-rose-300',
  dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
  status: 'border-rose-500/30 bg-rose-500/15 text-rose-400',
  seconds: 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.55)]',
  colon: 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.55)]',
} as const;

interface MarketClock {
  hour: string;
  minute: string;
  second: string;
  isOpen: boolean;
}

function getMarketClock(now: Date, market: (typeof MARKETS)[number]): MarketClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: market.timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const hour = Number(values.hour);
  const minute = Number(values.minute);
  const weekday = values.weekday;
  const currentMinutes = hour * 60 + minute;

  return {
    hour: values.hour,
    minute: values.minute,
    second: values.second,
    isOpen: market.is24x7
      || (weekday !== 'Sat' && weekday !== 'Sun' && currentMinutes >= market.open && currentMinutes < market.close),
  };
}

function AnimatedClockDigit({ value, className }: { value: string; className: string }) {
  const digitRef = useRef<HTMLSpanElement>(null);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (previousValueRef.current === value) return;
    previousValueRef.current = value;
    const digit = digitRef.current;
    if (!digit) return;

    const tween = gsap.fromTo(
      digit,
      { autoAlpha: 0.4, scale: 0.84, y: 2 },
      { autoAlpha: 1, scale: 1, y: 0, duration: 0.24, ease: 'power2.out' },
    );
    return () => {
      tween.kill();
    };
  }, [value]);

  return (
    <span ref={digitRef} className={className}>
      {value}
    </span>
  );
}

export default function MarketClockCards({ lang }: { lang: Language }) {
  const [clocks, setClocks] = useState<Record<string, MarketClock>>({});

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      const nextClocks = Object.fromEntries(MARKETS.map((market) => [market.id, getMarketClock(now, market)]));
      setClocks((current) => {
        const unchanged = MARKETS.every((market) => {
          const previous = current[market.id];
          const next = nextClocks[market.id];
          return previous?.hour === next.hour
            && previous?.minute === next.minute
            && previous?.second === next.second
            && previous?.isOpen === next.isOpen;
        });
        return unchanged ? current : nextClocks;
      });
    };

    updateClocks();
    const interval = window.setInterval(updateClocks, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div dir="rtl" className="flex w-max flex-nowrap items-center gap-1.5">
      {MARKETS.map((market) => {
        const clock = clocks[market.id];
        const city = lang === 'fa' ? market.cityFa : market.cityEn;
        const isClosed = !market.is24x7 && clock?.isOpen !== true;
        const status = market.is24x7
          ? null
          : lang === 'fa'
            ? (clock?.isOpen ? 'باز' : 'بسته')
            : (clock?.isOpen ? 'Open' : 'Closed');

        return (
          <div
            key={market.id}
            title={`${city} · ${market.timeZone}`}
            className={`market-clock-shimmer relative isolate flex h-[52px] w-[128px] shrink-0 flex-col justify-center gap-1 overflow-hidden rounded-xl border bg-[#070b14]/90 p-1.5 text-slate-200 backdrop-blur-md ${
              isClosed ? CLOSED_MARKET_STYLE.border : market.accent.border
            }`}
          >
            <div className="relative z-10 flex min-h-[14px] items-center justify-between gap-1">
              <span className={`text-[10px] font-bold leading-3 ${
                isClosed ? CLOSED_MARKET_STYLE.city : market.accent.city
              }`}>{city}</span>
              <span className="inline-flex min-h-[14px] items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                      isClosed ? CLOSED_MARKET_STYLE.dot : market.accent.openDot
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                      isClosed ? CLOSED_MARKET_STYLE.dot : market.accent.openDot
                    }`}
                  />
                </span>
                {status && (
                  <span
                    className={`rounded-full border px-1 py-[1px] text-[8px] font-semibold leading-3 ${
                      isClosed ? CLOSED_MARKET_STYLE.status : market.accent.openStatus
                    }`}
                  >
                    {status}
                  </span>
                )}
              </span>
            </div>

            <div dir="ltr" className="relative z-10 flex items-center justify-center gap-0.5">
              <div dir="ltr" className="flex min-w-0 flex-1 flex-col items-center rounded-md border border-white/[0.06] bg-[#0d1424] py-0.5">
                <AnimatedClockDigit
                  value={clock?.hour ?? '--'}
                  className={`font-mono text-xs font-black leading-3 tabular-nums ${market.accent.digits}`}
                />
                <span dir="ltr" className="text-[7px] font-medium leading-[8px] text-slate-500">
                  {lang === 'fa' ? 'ساعت' : 'HR'}
                </span>
              </div>
              <span className={`animate-pulse pb-1 text-[10px] font-black leading-3 ${
                isClosed ? CLOSED_MARKET_STYLE.colon : market.accent.colon
              }`}>:</span>
              <div dir="ltr" className="flex min-w-0 flex-1 flex-col items-center rounded-md border border-white/[0.06] bg-[#0d1424] py-0.5">
                <AnimatedClockDigit
                  value={clock?.minute ?? '--'}
                  className={`font-mono text-xs font-black leading-3 tabular-nums ${market.accent.digits}`}
                />
                <span dir="ltr" className="text-[7px] font-medium leading-[8px] text-slate-500">
                  {lang === 'fa' ? 'دقیقه' : 'MIN'}
                </span>
              </div>
              <span className={`animate-pulse pb-1 text-[10px] font-black leading-3 ${
                isClosed ? CLOSED_MARKET_STYLE.colon : market.accent.colon
              }`}>:</span>
              <div dir="ltr" className="flex min-w-0 flex-1 flex-col items-center rounded-md border border-white/[0.06] bg-[#0d1424] py-0.5">
                <AnimatedClockDigit
                  value={clock?.second ?? '--'}
                  className={`font-mono text-xs font-black leading-3 tabular-nums ${
                    isClosed ? CLOSED_MARKET_STYLE.seconds : market.accent.seconds
                  }`}
                />
                <span dir="ltr" className="text-[7px] font-medium leading-[8px] text-slate-500">
                  {lang === 'fa' ? 'ثانیه' : 'SEC'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
