export type SignalDirection = 'bullish' | 'bearish';
export type SignalStatus = 'pending' | 'success' | 'failed';
export type SignalGuaranteeTier = 'gold' | 'high' | 'medium';
export type RealizedSignalWindow = '1 ساعته' | '2 ساعته' | '3 ساعته' | '4 ساعته';

export const SIGNAL_EVALUATION_WINDOW_MS = 4 * 60 * 60 * 1000;

export interface SignalHistoryRecord {
  id: string;
  symbol: string;
  nameFa: string;
  direction: SignalDirection;
  predictedUsdtPct: number;
  persianDate: string;
  persianTime: string;
  confidencePct: number;
  guaranteeTier: SignalGuaranteeTier;
  entryPriceUsdt: number;
  targetPriceUsdt: number;
  status: SignalStatus;
  createdAt: string;
  resolvedAt: number | string | null;
  resolvedPersianDate?: string | null;
  resolvedPersianTime?: string | null;
  durationMinutes?: number | null;
  realizedWindow?: RealizedSignalWindow | null;
  realizedLabel?: string | null;
  updatedAt?: string;
  currentPriceUsdt?: number | null;
  actualMovePct?: number | null;
  realizedGoalPct?: number | null;
}

export interface SignalCandidate {
  symbol: string;
  nameFa: string;
  direction: SignalDirection;
  predictedUsdtPct: number;
  zScore: number;
  netFlowUsd: number;
  confidence: number;
  entryPriceUsdt: number;
}

interface ResolveUpdate {
  id: string;
  status?: SignalStatus;
  resolvedAt?: number | null;
  resolvedPersianDate?: string | null;
  resolvedPersianTime?: string | null;
  durationMinutes?: number | null;
  realizedWindow?: RealizedSignalWindow | null;
  realizedLabel?: string | null;
  updatedAt: string;
  currentPriceUsdt?: number | null;
  actualMovePct?: number | null;
  realizedGoalPct?: number | null;
}

const STORAGE_KEY = 'didehbon.signal-history.v1';
const MAX_RECORDS = 300;
const DUPLICATE_WINDOW_MS = 2 * 60 * 60 * 1000;
const MAX_PENDING_MS = SIGNAL_EVALUATION_WINDOW_MS;
const API_URL = '/signal-history.php';
let serverWarningShown = false;
let storageWarningShown = false;

export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

function isSignalRecord(value: unknown): value is SignalHistoryRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<SignalHistoryRecord>;
  return typeof record.id === 'string'
    && typeof record.symbol === 'string'
    && typeof record.nameFa === 'string'
    && (record.direction === 'bullish' || record.direction === 'bearish')
    && typeof record.predictedUsdtPct === 'number'
    && typeof record.persianDate === 'string'
    && typeof record.persianTime === 'string'
    && typeof record.confidencePct === 'number'
    && (record.guaranteeTier === 'gold' || record.guaranteeTier === 'high' || record.guaranteeTier === 'medium')
    && typeof record.entryPriceUsdt === 'number'
    && typeof record.targetPriceUsdt === 'number'
    && (record.status === 'pending' || record.status === 'success' || record.status === 'failed')
    && typeof record.createdAt === 'string'
    && (record.resolvedAt === null || typeof record.resolvedAt === 'string' || (typeof record.resolvedAt === 'number' && Number.isFinite(record.resolvedAt)))
    && (record.resolvedPersianDate === undefined || record.resolvedPersianDate === null || typeof record.resolvedPersianDate === 'string')
    && (record.resolvedPersianTime === undefined || record.resolvedPersianTime === null || typeof record.resolvedPersianTime === 'string')
    && (record.durationMinutes === undefined || record.durationMinutes === null || Number.isFinite(record.durationMinutes))
    && (record.realizedWindow === undefined || record.realizedWindow === null || ['1 ساعته', '2 ساعته', '3 ساعته', '4 ساعته'].includes(record.realizedWindow))
    && (record.realizedLabel === undefined || record.realizedLabel === null || typeof record.realizedLabel === 'string')
    && (record.currentPriceUsdt === undefined || record.currentPriceUsdt === null || Number.isFinite(record.currentPriceUsdt))
    && (record.actualMovePct === undefined || record.actualMovePct === null || Number.isFinite(record.actualMovePct))
    && (record.realizedGoalPct === undefined || record.realizedGoalPct === null || Number.isFinite(record.realizedGoalPct))
    && (record.updatedAt === undefined || typeof record.updatedAt === 'string');
}

function normalizeSignalRecord(record: SignalHistoryRecord): SignalHistoryRecord {
  const resolvedAt = typeof record.resolvedAt === 'string'
    ? Date.parse(record.resolvedAt)
    : record.resolvedAt;
  return {
    ...record,
    persianDate: toLatinDigits(record.persianDate),
    persianTime: toLatinDigits(record.persianTime),
    resolvedAt: typeof resolvedAt === 'number' && Number.isFinite(resolvedAt) ? resolvedAt : null,
    resolvedPersianDate: record.resolvedPersianDate
      ? toLatinDigits(record.resolvedPersianDate)
      : record.resolvedPersianDate,
    resolvedPersianTime: record.resolvedPersianTime
      ? toLatinDigits(record.resolvedPersianTime)
      : record.resolvedPersianTime,
    realizedLabel: record.realizedLabel ? toLatinDigits(record.realizedLabel) : record.realizedLabel,
  };
}

export function formatPersianDateTime(timestamp: number): { date: string; time: string } {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return { date: '', time: '' };
  const dateParts = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((value) => value.type === type)?.value ?? '';
  return {
    date: `${part('year')}/${part('month')}/${part('day')}`,
    time: new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
      timeZone: 'Asia/Tehran',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(date),
  };
}

export function getRealizedSignalWindow(durationMinutes: number): RealizedSignalWindow | null {
  if (durationMinutes <= 60) return '1 ساعته';
  if (durationMinutes <= 120) return '2 ساعته';
  if (durationMinutes <= 180) return '3 ساعته';
  if (durationMinutes <= 240) return '4 ساعته';
  return null;
}

export function getSignalStageLabel(
  status: SignalStatus,
  elapsedMinutes: number,
): string {
  if (status === 'success') {
    return elapsedMinutes <= 60
      ? 'موفق در بازه 1 ساعته'
      : '1 ساعته: ناموفق • 4 ساعته: موفق';
  }
  if (status === 'failed') return '1 ساعته: ناموفق • 4 ساعته: ناموفق';
  if (elapsedMinutes < 60) return '1 ساعته: در حال بررسی • 4 ساعته: در حال بررسی';
  return '1 ساعته: ناموفق • 4 ساعته: در حال بررسی';
}

function readLocalHistory(): SignalHistoryRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(isSignalRecord).map(normalizeSignalRecord)
      : [];
  } catch (error) {
    if (!storageWarningShown) {
      console.warn('Signal history could not be read from localStorage.', error);
      storageWarningShown = true;
    }
    return [];
  }
}

function writeLocalHistory(records: SignalHistoryRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch (error) {
    if (!storageWarningShown) {
      console.warn('Signal history could not be saved to localStorage.', error);
      storageWarningShown = true;
    }
  }
}

function mergeHistory(...collections: SignalHistoryRecord[][]): SignalHistoryRecord[] {
  const byId = new Map<string, SignalHistoryRecord>();
  for (const record of collections.flat()) {
    const previous = byId.get(record.id);
    const previousUpdatedAt = Date.parse(previous?.updatedAt ?? previous?.createdAt ?? '');
    const recordUpdatedAt = Date.parse(record.updatedAt ?? record.createdAt);
    if (
      !previous
      || recordUpdatedAt > previousUpdatedAt
      || (recordUpdatedAt === previousUpdatedAt && previous.status === 'pending' && record.status !== 'pending')
    ) {
      byId.set(record.id, record);
    }
  }

  const chronological = [...byId.values()].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const deduplicated: SignalHistoryRecord[] = [];
  for (const record of chronological) {
    const timestamp = Date.parse(record.createdAt);
    const duplicate = [...deduplicated].reverse().find((existing) =>
      existing.symbol === record.symbol
      && existing.direction === record.direction
      && timestamp - Date.parse(existing.createdAt) < DUPLICATE_WINDOW_MS,
    );
    if (!duplicate) deduplicated.push(record);
    else if (duplicate.status === 'pending' && record.status !== 'pending') {
      deduplicated[deduplicated.indexOf(duplicate)] = record;
    }
  }

  return deduplicated
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_RECORDS);
}

async function requestServer<T>(body?: Record<string, unknown>): Promise<T | null> {
  if (typeof window === 'undefined') return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(API_URL, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Signal history endpoint returned HTTP ${response.status}.`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || (payload as { success?: unknown }).success !== true) {
      throw new Error('Signal history endpoint returned an invalid response.');
    }
    return payload as T;
  } catch (error) {
    if (!serverWarningShown) {
      console.warn('Signal history server is unavailable; using localStorage.', error);
      serverWarningShown = true;
    }
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function guaranteeTier(confidencePct: number): SignalGuaranteeTier {
  if (confidencePct >= 85) return 'gold';
  if (confidencePct >= 70) return 'high';
  return 'medium';
}

function createRecord(candidate: SignalCandidate): SignalHistoryRecord | null {
  const symbol = candidate.symbol.trim().toUpperCase();
  const entryPriceUsdt = candidate.entryPriceUsdt;
  const predictedUsdtPct = candidate.predictedUsdtPct;
  const confidencePct = Math.round(candidate.confidence);
  if (
    !symbol
    || !Number.isFinite(entryPriceUsdt)
    || entryPriceUsdt <= 0
    || !Number.isFinite(predictedUsdtPct)
    || Math.abs(predictedUsdtPct) < 1
    || !Number.isFinite(candidate.zScore)
    || Math.abs(candidate.zScore) < 1.5
    || !Number.isFinite(candidate.netFlowUsd)
    || Math.abs(candidate.netFlowUsd) < 25_000
    || !Number.isFinite(confidencePct)
  ) return null;

  const now = new Date();
  const dateParts = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((value) => value.type === type)?.value ?? '';
  const persianDate = `${part('year')}/${part('month')}/${part('day')}`;
  const persianTime = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  const cryptoApi = globalThis.crypto;
  const id = typeof cryptoApi?.randomUUID === 'function'
    ? cryptoApi.randomUUID()
    : `${now.getTime()}-${Math.random().toString(36).slice(2)}`;

  return {
    id,
    symbol,
    nameFa: candidate.nameFa || symbol,
    direction: candidate.direction,
    predictedUsdtPct,
    persianDate,
    persianTime,
    confidencePct,
    guaranteeTier: guaranteeTier(confidencePct),
    entryPriceUsdt,
    targetPriceUsdt: entryPriceUsdt * (1 + predictedUsdtPct / 100),
    status: 'pending',
    createdAt: now.toISOString(),
    resolvedAt: null,
    updatedAt: now.toISOString(),
    currentPriceUsdt: entryPriceUsdt,
    actualMovePct: 0,
    realizedGoalPct: 0,
    realizedLabel: '1 ساعته: در حال بررسی • 4 ساعته: در حال بررسی',
  };
}

function isRecentDuplicate(
  records: SignalHistoryRecord[],
  candidate: Pick<SignalHistoryRecord, 'symbol' | 'direction' | 'createdAt'>,
): boolean {
  const timestamp = Date.parse(candidate.createdAt);
  return records.some((record) =>
    record.symbol === candidate.symbol
    && record.direction === candidate.direction
    && timestamp >= Date.parse(record.createdAt)
    && timestamp - Date.parse(record.createdAt) < DUPLICATE_WINDOW_MS,
  );
}

function updateTrackedSignals(
  records: SignalHistoryRecord[],
  currentPrices: Record<string, number>,
  now: Date,
): { records: SignalHistoryRecord[]; updates: ResolveUpdate[] } {
  const updates: ResolveUpdate[] = [];
  const updatedRecords = records.map((record) => {
    const createdAt = Date.parse(record.createdAt);
    if (!Number.isFinite(createdAt)) return record;
    const price = currentPrices[record.symbol];
    const validPrice = Number.isFinite(price) && price > 0;
    const age = now.getTime() - createdAt;
    const elapsedMinutes = age / 60_000;
    const shouldTrack = record.status === 'pending'
      || record.currentPriceUsdt == null
      || record.actualMovePct == null
      || record.realizedGoalPct == null;
    if (!shouldTrack) return record;

    const actualMovePct = validPrice
      ? ((price - record.entryPriceUsdt) / record.entryPriceUsdt) * 100
      : record.actualMovePct ?? null;
    const realizedGoalPct = validPrice
      ? Math.min(100, Math.max(0, (actualMovePct! / record.predictedUsdtPct) * 100))
      : record.realizedGoalPct ?? null;
    const reachedTarget = validPrice && (
      record.direction === 'bullish'
        ? price >= record.targetPriceUsdt
        : price <= record.targetPriceUsdt
    );

    let status: ResolveUpdate['status'];
    let resolvedAt: number | string | null = record.resolvedAt;
    let completionDetails: Pick<
      ResolveUpdate,
      'resolvedPersianDate' | 'resolvedPersianTime' | 'durationMinutes' | 'realizedWindow'
    > = {};
    if (record.status === 'pending') {
      if (reachedTarget && age <= MAX_PENDING_MS) status = 'success';
      else if (age >= MAX_PENDING_MS) status = 'failed';
      if (status) resolvedAt = now.getTime();
      if (status === 'success') {
        const durationMinutes = Math.max(1, Math.round((now.getTime() - createdAt) / 60_000));
        const resolvedDateTime = formatPersianDateTime(now.getTime());
        completionDetails = {
          resolvedPersianDate: resolvedDateTime.date,
          resolvedPersianTime: resolvedDateTime.time,
          durationMinutes,
          realizedWindow: getRealizedSignalWindow(durationMinutes) ?? '4 ساعته',
        };
      }
    }
    const nextStatus = status ?? record.status;
    const realizedLabel = getSignalStageLabel(nextStatus, elapsedMinutes);

    const metricsChanged = validPrice && (
      record.currentPriceUsdt !== price
      || record.actualMovePct !== actualMovePct
      || record.realizedGoalPct !== realizedGoalPct
    );
    const statusChanged = status !== undefined;
    const labelChanged = record.realizedLabel !== realizedLabel;
    if (!metricsChanged && !statusChanged && !labelChanged) return record;

    const updatedAt = now.toISOString();
    const updatedRecord: SignalHistoryRecord = {
      ...record,
      ...(status ? { status } : {}),
      ...(statusChanged ? { resolvedAt } : {}),
      ...completionDetails,
      currentPriceUsdt: validPrice ? price : record.currentPriceUsdt ?? null,
      actualMovePct,
      realizedGoalPct,
      realizedLabel,
      updatedAt,
    };
    updates.push({
      id: record.id,
      ...(status ? { status, resolvedAt: typeof resolvedAt === 'number' ? resolvedAt : now.getTime() } : {}),
      ...completionDetails,
      updatedAt,
      currentPriceUsdt: updatedRecord.currentPriceUsdt ?? null,
      actualMovePct: updatedRecord.actualMovePct ?? null,
      realizedGoalPct: updatedRecord.realizedGoalPct ?? null,
      realizedLabel,
    });
    return updatedRecord;
  });
  return { records: updatedRecords, updates };
}

function normalizeStoredStatuses(
  records: SignalHistoryRecord[],
  now: Date,
): { records: SignalHistoryRecord[]; updates: ResolveUpdate[] } {
  const updates: ResolveUpdate[] = [];
  const updatedRecords = records.map((record) => {
    const createdAt = Date.parse(record.createdAt);
    if (!Number.isFinite(createdAt)) return record;
    const elapsedMinutes = (now.getTime() - createdAt) / 60_000;
    const reopen = record.status === 'failed' && now.getTime() - createdAt < MAX_PENDING_MS;
    const status: SignalStatus = reopen ? 'pending' : record.status;
    const storedResolvedAt = typeof record.resolvedAt === 'string'
      ? Date.parse(record.resolvedAt)
      : record.resolvedAt;
    const resolvedAt = reopen
      ? null
      : typeof storedResolvedAt === 'number' && Number.isFinite(storedResolvedAt)
        ? storedResolvedAt
        : null;
    const durationMinutes = reopen ? null : record.durationMinutes;
    const realizedWindow = reopen ? null : record.realizedWindow;
    const resolvedPersianDate = reopen ? null : record.resolvedPersianDate;
    const resolvedPersianTime = reopen ? null : record.resolvedPersianTime;
    const resolvedAtMs = typeof resolvedAt === 'number'
      ? resolvedAt
      : typeof resolvedAt === 'string'
        ? Date.parse(resolvedAt)
        : null;
    const resolvedDuration = status === 'success'
      ? durationMinutes ?? (
          resolvedAtMs !== null && Number.isFinite(resolvedAtMs)
            ? Math.max(1, Math.round((resolvedAtMs - createdAt) / 60_000))
            : undefined
        )
      : durationMinutes;
    const completionTime = status === 'success' && resolvedAtMs !== null && Number.isFinite(resolvedAtMs)
      ? formatPersianDateTime(resolvedAtMs)
      : null;
    const nextResolvedDate = status === 'success'
      ? resolvedPersianDate ?? completionTime?.date ?? null
      : resolvedPersianDate;
    const nextResolvedTime = status === 'success'
      ? resolvedPersianTime ?? completionTime?.time ?? null
      : resolvedPersianTime;
    const nextDuration = status === 'success' ? resolvedDuration ?? null : durationMinutes;
    const nextWindow = status === 'success'
      ? realizedWindow ?? (nextDuration ? getRealizedSignalWindow(nextDuration) : null)
      : realizedWindow;
    const stageElapsed = status === 'success' && resolvedAtMs !== null && Number.isFinite(resolvedAtMs)
      ? (resolvedAtMs - createdAt) / 60_000
      : elapsedMinutes;
    const nextLabel = getSignalStageLabel(status, stageElapsed);
    const changed = status !== record.status
      || resolvedAt !== record.resolvedAt
      || nextResolvedDate !== record.resolvedPersianDate
      || nextResolvedTime !== record.resolvedPersianTime
      || nextDuration !== record.durationMinutes
      || nextWindow !== record.realizedWindow
      || nextLabel !== record.realizedLabel;
    if (!changed) return record;

    const updatedAt = now.toISOString();
    const updatedRecord: SignalHistoryRecord = {
      ...record,
      status,
      resolvedAt,
      resolvedPersianDate: nextResolvedDate,
      resolvedPersianTime: nextResolvedTime,
      durationMinutes: nextDuration,
      realizedWindow: nextWindow,
      realizedLabel: nextLabel,
      updatedAt,
    };
    updates.push({
      id: record.id,
      ...(status !== record.status ? { status } : {}),
      ...(resolvedAt !== record.resolvedAt ? { resolvedAt } : {}),
      resolvedPersianDate: nextResolvedDate,
      resolvedPersianTime: nextResolvedTime,
      durationMinutes: nextDuration,
      realizedWindow: nextWindow,
      realizedLabel: nextLabel,
      updatedAt,
    });
    return updatedRecord;
  });
  return { records: updatedRecords, updates };
}

export async function getSignalHistory(): Promise<SignalHistoryRecord[]> {
  const initialLocalRecords = readLocalHistory();
  const response = await requestServer<{ signals?: unknown }>();
  const latestLocalRecords = readLocalHistory();
  const serverRecords = Array.isArray(response?.signals)
    ? response.signals.filter(isSignalRecord).map(normalizeSignalRecord)
    : [];
  const mergedRecords = mergeHistory(initialLocalRecords, latestLocalRecords, serverRecords);
  const normalized = normalizeStoredStatuses(mergedRecords, new Date());
  let records = normalized.records;
  writeLocalHistory(records);
  if (normalized.updates.length > 0) {
    const updateResponse = await requestServer<{ signals?: unknown }>({
      action: 'resolve',
      signals: normalized.updates,
    });
    if (Array.isArray(updateResponse?.signals)) {
      records = mergeHistory(
        records,
        updateResponse.signals.filter(isSignalRecord).map(normalizeSignalRecord),
      );
      writeLocalHistory(records);
    }
  }
  return records;
}

export async function syncSignalHistory(
  candidates: SignalCandidate[],
  currentPrices: Record<string, number>,
): Promise<SignalHistoryRecord[]> {
  let records = await getSignalHistory();
  const now = new Date();
  const resolution = updateTrackedSignals(records, currentPrices, now);
  if (resolution.updates.length > 0) {
    records = resolution.records;
    writeLocalHistory(records);
    const response = await requestServer<{ signals?: unknown }>({
      action: 'resolve',
      signals: resolution.updates,
    });
    if (Array.isArray(response?.signals)) {
      records = mergeHistory(
        records,
        response.signals.filter(isSignalRecord).map(normalizeSignalRecord),
      );
      writeLocalHistory(records);
    }
  }

  for (const candidate of candidates) {
    const record = createRecord(candidate);
    if (!record || isRecentDuplicate(records, record)) continue;
    records = mergeHistory([record], records);
    writeLocalHistory(records);
    const response = await requestServer<{ signal?: unknown }>({
      action: 'create',
      signal: record,
    });
    if (isSignalRecord(response?.signal)) {
      records = mergeHistory(records, [normalizeSignalRecord(response.signal)]);
      writeLocalHistory(records);
    }
  }

  return getSignalHistory();
}
