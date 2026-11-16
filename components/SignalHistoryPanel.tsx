'use client';

import { useMemo, useState } from 'react';
import { Check, Clock3, X } from 'lucide-react';
import {
  formatPersianDateTime,
  getSignalStageLabel,
  SIGNAL_EVALUATION_WINDOW_MS,
  toLatinDigits,
  type SignalGuaranteeTier,
  type SignalHistoryRecord,
  type SignalStatus,
} from '@/lib/signalHistory';

type StatusFilter = 'all' | SignalStatus;
type TierFilter = 'all' | 'gold' | 'high';

const STATUS_LABELS: Record<StatusFilter, { fa: string; en: string }> = {
  all: { fa: 'همه', en: 'All' },
  success: { fa: 'موفق', en: 'Successful' },
  failed: { fa: 'ناموفق', en: 'Failed' },
  pending: { fa: 'در حال بررسی', en: 'Pending' },
};

const TIER_LABELS: Record<SignalGuaranteeTier, { fa: string; en: string }> = {
  gold: { fa: 'تضمین طلایی', en: 'Gold guarantee' },
  high: { fa: 'تضمین بالا', en: 'High guarantee' },
  medium: { fa: 'اعتبار متوسط', en: 'Moderate confidence' },
};

function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

function formatMovement(value: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  if (value === 0) return `0.00%`;
  return `${value > 0 ? '+' : '-'}${formatted}%`;
}

function getTimestampMs(value: SignalHistoryRecord['resolvedAt']): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function renderStageLabel(label: string, lang: 'fa' | 'en') {
  const isPersian = lang === 'fa';
  const earlySuccess = toLatinDigits(label).match(/^موفق در بازه ([1-4]) ساعته$/);
  if (earlySuccess) {
    return (
      <span className="text-emerald-400">
        {isPersian ? 'موفق در بازه' : 'Successful in'}{' '}
        <span dir="ltr" className="font-mono tabular-nums">{earlySuccess[1]}</span>{' '}
        {isPersian ? 'ساعته' : 'hour window'}
      </span>
    );
  }

  const parts = toLatinDigits(label).split(' • ');
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {parts.map((part, index) => {
        const match = part.match(/^([1-4]) ساعته: (.+)$/);
        if (!match) {
          return <span key={`${part}-${index}`} dir="ltr" className="font-mono tabular-nums">{part}</span>;
        }
        const state = match[2];
        const color = state === 'ناموفق'
          ? 'text-rose-400'
          : state === 'موفق'
            ? 'text-emerald-400'
            : 'text-amber-400';
        const translatedState = isPersian
          ? state
          : state === 'ناموفق'
            ? 'failed'
            : state === 'موفق'
              ? 'successful'
              : 'under review';
        return (
          <span key={`${part}-${index}`} className={color}>
            {index > 0 && <span className="mx-1 text-slate-500">•</span>}
            <span dir="ltr" className="font-mono tabular-nums">{match[1]}</span>
            {isPersian ? ' ساعته: ' : ' hour: '}
            {translatedState}
          </span>
        );
      })}
    </div>
  );
}

function getTierStyle(tier: SignalGuaranteeTier): string {
  if (tier === 'gold') return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
  if (tier === 'high') return 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300';
  return 'border-violet-400/30 bg-violet-400/10 text-violet-300';
}

export default function SignalHistoryPanel({
  records,
  isDark,
  lang,
}: {
  records: SignalHistoryRecord[];
  isDark: boolean;
  lang: 'fa' | 'en';
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const isPersian = lang === 'fa';
  const statusCounts = useMemo(() => ({
    success: records.filter((record) => record.status === 'success').length,
    failed: records.filter((record) => record.status === 'failed').length,
    pending: records.filter((record) => record.status === 'pending').length,
  }), [records]);
  const completedCount = statusCounts.success + statusCounts.failed;
  const winRate = completedCount > 0 ? (statusCounts.success / completedCount) * 100 : 0;
  const filteredRecords = useMemo(
    () => records.filter((record) =>
      (statusFilter === 'all' || record.status === statusFilter)
      && (tierFilter === 'all' || record.guaranteeTier === tierFilter),
    ),
    [records, statusFilter, tierFilter],
  );
  const cardClass = isDark
    ? 'border-slate-700/70 bg-slate-950/60 text-slate-100'
    : 'border-slate-200 bg-white/80 text-slate-900';
  const subTextClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const stickyHeaderCellClass = `sticky top-0 z-10 px-3 py-3 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`;

  return (
    <section className={`mb-6 overflow-hidden rounded-3xl border p-4 shadow-xl backdrop-blur-xl sm:p-6 ${cardClass}`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black sm:text-xl">
            {isPersian ? 'تاریخچه و کارنامه سیگنال‌های دیده‌بُن' : 'Didehbon Signal History & Performance'}
          </h2>
          <p className={`mt-1 text-xs ${subTextClass}`}>
            {isPersian ? 'نتایج بر اساس قیمت لحظه‌ای و افق ارزیابی چهار ساعته' : 'Outcomes based on live prices and a four-hour evaluation window'}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${subTextClass} ${isDark ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-slate-50'}`}>
          {isPersian ? 'کل سیگنال‌ها' : 'Total signals'}: <span dir="ltr" className="tabular-nums">{records.length}</span>
        </span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: isPersian ? 'کل ثبت‌شده' : 'Total', value: records.length, color: 'text-sky-400' },
          { label: isPersian ? 'موفق' : 'Successful', value: statusCounts.success, color: 'text-emerald-400' },
          { label: isPersian ? 'ناموفق' : 'Failed', value: statusCounts.failed, color: 'text-rose-400' },
          { label: isPersian ? 'در حال بررسی' : 'Pending', value: statusCounts.pending, color: 'text-amber-400' },
          { label: isPersian ? 'نرخ موفقیت واقعی' : 'Win rate', value: `${formatNumber(winRate, 1)}%`, color: 'text-cyan-400' },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl border px-3 py-3 ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-slate-50'}`}>
            <div className={`text-[11px] ${subTextClass}`}>{item.label}</div>
            <div className={`mt-1 text-lg font-black tabular-nums ${item.color}`}>
              <span dir="ltr" className="tabular-nums">{typeof item.value === 'number' ? formatNumber(item.value, 0) : item.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className={`flex flex-wrap gap-1 rounded-xl border p-1 ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-slate-50'}`}>
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                statusFilter === filter
                  ? 'bg-sky-500/20 text-sky-300'
                  : `${subTextClass} hover:text-sky-400`
              }`}
            >
              {STATUS_LABELS[filter][lang]}
            </button>
          ))}
        </div>
        <div className={`flex flex-wrap gap-1 rounded-xl border p-1 ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-slate-50'}`}>
          {([
            ['all', isPersian ? 'همه سطوح' : 'All tiers'],
            ['gold', isPersian ? 'تضمین طلایی ≥ 85%' : 'Gold ≥ 85%'],
            ['high', isPersian ? 'تضمین بالا ≥ 70%' : 'High ≥ 70%'],
          ] as const).map(([filter, label]) => (
            <button
              key={filter}
              type="button"
              onClick={() => setTierFilter(filter)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                tierFilter === filter
                  ? 'bg-violet-500/20 text-violet-300'
                  : `${subTextClass} hover:text-violet-400`
              }`}
            >
              {filter === 'gold' || filter === 'high'
                ? (
                  <>
                    {isPersian ? (filter === 'gold' ? 'تضمین طلایی' : 'تضمین بالا') : (filter === 'gold' ? 'Gold guarantee' : 'High guarantee')}
                    {' '}
                    <span dir="ltr" className="tabular-nums">{filter === 'gold' ? '≥ 85%' : '≥ 70%'}</span>
                  </>
                )
                : label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[460px] overflow-x-auto overflow-y-auto rounded-2xl border border-slate-800/70">
        <table className="w-full min-w-[980px] text-right text-xs">
          <thead className={`sticky top-0 z-10 ${isDark ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            <tr>
              <th className={stickyHeaderCellClass}>{isPersian ? 'ارز' : 'Asset'}</th>
              <th className={stickyHeaderCellClass}>{isPersian ? 'جهت و پیش‌بینی' : 'Direction & prediction'}</th>
              <th className={stickyHeaderCellClass}>{isPersian ? 'زمان صدور' : 'Issued at'}</th>
              <th className={stickyHeaderCellClass}>{isPersian ? 'تضمین دیده‌بُن' : 'Didehbon confidence'}</th>
              <th className={stickyHeaderCellClass}>{isPersian ? 'تحقق بازار تا این لحظه' : 'Market realization so far'}</th>
              <th className={stickyHeaderCellClass}>{isPersian ? 'نتیجه' : 'Result'}</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-slate-800 bg-slate-950/40' : 'divide-slate-100 bg-white/50'}`}>
            {filteredRecords.map((record) => {
              const statusLabel = STATUS_LABELS[record.status];
              const statusStyle = record.status === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : record.status === 'failed'
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400';
              const actualMovePct = record.actualMovePct ?? null;
              const realizedGoalPct = record.realizedGoalPct ?? null;
              const movementColor = actualMovePct === null || Math.abs(actualMovePct) < 0.000001
              ? 'text-slate-400'
              : actualMovePct * record.predictedUsdtPct > 0
                ? 'text-emerald-400'
                : 'text-rose-400';
              const resolvedAtMs = getTimestampMs(record.resolvedAt);
              const createdAtMs = Date.parse(record.createdAt);
              const durationMinutes = record.durationMinutes
                ?? (resolvedAtMs !== null && Number.isFinite(createdAtMs)
                  ? Math.max(1, Math.round((resolvedAtMs - createdAtMs) / 60_000))
                  : null);
              const resolvedDateTime = record.resolvedPersianDate && record.resolvedPersianTime
                ? {
                    date: toLatinDigits(record.resolvedPersianDate),
                    time: toLatinDigits(record.resolvedPersianTime),
                  }
                : resolvedAtMs !== null
                  ? formatPersianDateTime(resolvedAtMs)
                  : null;
              const evaluationDeadline = record.status !== 'success' && Number.isFinite(createdAtMs)
                ? formatPersianDateTime(createdAtMs + SIGNAL_EVALUATION_WINDOW_MS)
                : null;
              const stageElapsed = record.status === 'success' && resolvedAtMs !== null && Number.isFinite(createdAtMs)
                ? (resolvedAtMs - createdAtMs) / 60_000
                : (Date.now() - createdAtMs) / 60_000;
              const stageLabel = record.realizedLabel
                ?? getSignalStageLabel(record.status, stageElapsed);
              return (
                <tr key={record.id} className={isDark ? 'hover:bg-slate-900/70' : 'hover:bg-slate-50'}>
                  <td className="px-3 py-3">
                    <span className="font-mono font-black" dir="ltr">{record.symbol}</span>
                    <span className={`mr-2 ${subTextClass}`}>{record.nameFa}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={record.direction === 'bullish' ? 'text-emerald-400' : 'text-rose-400'}>
                      {isPersian
                        ? record.direction === 'bullish' ? 'صعودی' : 'نزولی'
                        : record.direction === 'bullish' ? 'Bullish' : 'Bearish'}
                    </span>
                    <span className={`mr-2 font-mono tabular-nums ${record.predictedUsdtPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} dir="ltr">
                      {record.predictedUsdtPct >= 0 ? '+' : ''}{formatNumber(record.predictedUsdtPct)}%
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-mono tabular-nums" dir="ltr">{toLatinDigits(record.persianDate)}</span>
                    <span className={`mr-2 font-mono tabular-nums ${subTextClass}`} dir="ltr">{toLatinDigits(record.persianTime)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${getTierStyle(record.guaranteeTier)}`}>
                      <span className="font-mono font-bold tabular-nums" dir="ltr">{formatNumber(record.confidencePct, 0)}%</span>
                      <span>• {TIER_LABELS[record.guaranteeTier][lang]}</span>
                      <span className="font-mono tabular-nums" dir="ltr">
                        {record.guaranteeTier === 'gold'
                          ? '(≥ 85%)'
                          : record.guaranteeTier === 'high'
                            ? '(70%–84%)'
                            : '(< 70%)'}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-bold tabular-nums ${movementColor}`} dir="ltr">
                        {actualMovePct === null ? '—' : formatMovement(actualMovePct)}
                      </span>
                      <span className={`text-[11px] ${subTextClass}`}>
                        {isPersian ? 'حرکت بازار' : 'market move'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`font-mono tabular-nums ${movementColor}`} dir="ltr">
                        {realizedGoalPct === null ? '—' : `${formatNumber(realizedGoalPct, 1)}%`}
                      </span>
                      <span className={`text-[11px] ${subTextClass}`}>
                        {isPersian ? 'تحقق' : 'realized'}
                      </span>
                    </div>
                    <div
                      className={`mt-1 h-1.5 w-24 overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={realizedGoalPct ?? 0}
                      aria-label={isPersian ? 'درصد تحقق هدف' : 'Goal realization percentage'}
                    >
                      <div
                        className={`h-full rounded-full transition-[width] ${movementColor.replace('text-', 'bg-')}`}
                        style={{ width: `${realizedGoalPct ?? 0}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-bold ${statusStyle}`}>
                        {record.status === 'success' ? <Check className="h-3 w-3" /> : record.status === 'failed' ? <X className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                        {statusLabel[lang]}
                      </span>
                      {record.status === 'success' && (
                        <div className="flex flex-col items-start gap-1">
                          {renderStageLabel(stageLabel, lang)}
                          {durationMinutes !== null && (
                            <span dir="ltr" className="font-mono text-[11px] tabular-nums text-emerald-400">
                              ({durationMinutes} {isPersian ? 'دقیقه' : 'min'})
                            </span>
                          )}
                          {resolvedDateTime && (
                            <span dir="ltr" className="font-mono text-[11px] tabular-nums text-slate-400">
                              {resolvedDateTime.date} {resolvedDateTime.time}
                            </span>
                          )}
                        </div>
                      )}
                      {record.status === 'pending' && (
                        <div className="flex flex-col items-start gap-1">
                          {renderStageLabel(stageLabel, lang)}
                          {evaluationDeadline && (
                            <span className="text-[11px] text-slate-400">
                              {isPersian ? 'پایان مهلت' : 'Deadline'}{' '}
                              <span dir="ltr" className="font-mono tabular-nums">
                                4h {evaluationDeadline.date} {evaluationDeadline.time}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                      {record.status === 'failed' && evaluationDeadline && (
                        <div className="flex flex-col items-start gap-1">
                          {renderStageLabel(stageLabel, lang)}
                          <span className="text-[11px] text-slate-400">
                            {isPersian ? 'پایان مهلت' : 'Deadline'}{' '}
                            <span dir="ltr" className="font-mono tabular-nums">
                              4h {evaluationDeadline.date} {evaluationDeadline.time}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={6} className={`px-4 py-10 text-center ${subTextClass}`}>
                  {records.length === 0
                    ? isPersian
                      ? 'هنوز سیگنالی ثبت نشده است؛ به محض صدور اولین سیگنال معتبر رادار، با تاریخ شمسی و درصد تضمین در این جدول ثبت می‌شود'
                      : 'No signals have been recorded yet. The first valid radar signal will appear here with its Persian date and confidence percentage.'
                    : isPersian
                      ? 'سیگنالی با این فیلترها پیدا نشد.'
                      : 'No signals match these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
