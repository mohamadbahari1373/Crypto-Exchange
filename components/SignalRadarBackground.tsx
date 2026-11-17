'use client';

import { useEffect } from 'react';
import {
  fetchSevenExchangeRadar,
  normalizeAssetSymbol,
  type WallexRadarCoin,
} from '@/lib/sevenExchangeRadar';
import { syncSignalHistory, type SignalCandidate } from '@/lib/signalHistory';

interface MoneyFlowPayload {
  wallexCoins: WallexRadarCoin[];
  coinStats: Array<{ symbol: string; nameFa?: string }>;
  usdtPriceToman: number;
  usdtTmnChangePct: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMoneyFlowPayload(value: unknown): MoneyFlowPayload {
  if (!isRecord(value) || !Array.isArray(value.coinStats)) {
    throw new Error('Invalid money-flow response: coinStats is missing.');
  }

  const coinStats = value.coinStats.filter(
    (coin): coin is { symbol: string; nameFa?: string } =>
      isRecord(coin)
      && typeof coin.symbol === 'string'
      && (coin.nameFa === undefined || typeof coin.nameFa === 'string'),
  );
  const wallexCoins = Array.isArray(value.wallexCoins)
    ? value.wallexCoins.filter(
        (coin): coin is WallexRadarCoin =>
          isRecord(coin)
          && typeof coin.symbol === 'string'
          && (coin.nameFa === undefined || typeof coin.nameFa === 'string')
          && Number.isFinite(Number(coin.priceChange24h))
          && Number.isFinite(Number(coin.volume24hUsd)),
      ).map((coin) => ({
        symbol: coin.symbol,
        ...(typeof coin.nameFa === 'string' ? { nameFa: coin.nameFa } : {}),
        priceChange24h: Number(coin.priceChange24h),
        volume24hUsd: Number(coin.volume24hUsd),
      }))
    : [];
  const usdtPriceToman = Number(value.usdtPriceToman);
  const usdtTmnChangePct = Number(value.usdtTmnChangePct ?? 0);
  if (!Number.isFinite(usdtPriceToman) || !Number.isFinite(usdtTmnChangePct)) {
    throw new Error('Invalid money-flow response: USDT pricing is invalid.');
  }

  return { wallexCoins, coinStats, usdtPriceToman, usdtTmnChangePct };
}

export default function SignalRadarBackground() {
  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const scan = async () => {
      try {
        const response = await fetch('/api/money-flow.php?currency=ALL&limit=all', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`Money-flow endpoint returned HTTP ${response.status}.`);
        }
        const source = parseMoneyFlowPayload(await response.json() as unknown);
        const radar = await fetchSevenExchangeRadar(
          source.wallexCoins,
          source.usdtPriceToman,
          source.usdtTmnChangePct,
        );
        if (!active) return;

        const currentPrices: Record<string, number> = {};
        const candidates: SignalCandidate[] = [];
        for (const coin of radar.coins) {
          const symbol = normalizeAssetSymbol(coin.symbol);
          if (Number.isFinite(coin.priceUsd) && coin.priceUsd > 0) {
            currentPrices[symbol] = coin.priceUsd;
          }
          if (
            !coin.hasSignal
            || Math.abs(coin.globalNetFlow1h) < 25_000
            || Math.abs(coin.predictedUsdtPct) < 1
            || !(
              (coin.zScore >= 1.5 && coin.predictedUsdtPct > 0)
              || (coin.zScore <= -1.5 && coin.predictedUsdtPct < 0)
            )
          ) continue;

          candidates.push({
            symbol,
            nameFa: source.coinStats.find(
              (item) => normalizeAssetSymbol(item.symbol) === symbol,
            )?.nameFa ?? source.wallexCoins.find(
              (item) => normalizeAssetSymbol(item.symbol) === symbol,
            )?.nameFa ?? symbol,
            direction: coin.predictedUsdtPct >= 0 ? 'bullish' : 'bearish',
            predictedUsdtPct: coin.predictedUsdtPct,
            zScore: coin.zScore,
            netFlowUsd: coin.globalNetFlow1h,
            confidence: coin.confidence,
            entryPriceUsdt: coin.priceUsd,
          });
        }
        await syncSignalHistory(candidates, currentPrices);
      } catch (error) {
        console.error('Background radar scan failed:', error);
      } finally {
        if (active) timer = window.setTimeout(() => void scan(), 60_000);
      }
    };

    void scan();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
