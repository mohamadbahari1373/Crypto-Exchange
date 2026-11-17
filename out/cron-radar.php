<?php
declare(strict_types=1);

@ini_set('display_errors', '0');
@ini_set('log_errors', '1');
error_reporting(E_ALL);
if (PHP_SAPI !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');
}
if (function_exists('set_time_limit')) {
    set_time_limit(180);
}
date_default_timezone_set('Asia/Tehran');

const CRON_RADAR_SIGNAL_FILE = __DIR__ . '/didehbon_signals_log.json';
const CRON_RADAR_MAX_CANDLES = 200;
const CRON_RADAR_MAX_HISTORY = 300;

function cron_radar_number($value): float
{
    return is_numeric($value) && is_finite((float) $value) ? (float) $value : 0.0;
}

function cron_radar_symbol(string $value): string
{
    $symbol = strtoupper(trim($value));
    $symbol = preg_replace('/^1000(?=[A-Z0-9])/', '', $symbol) ?? $symbol;
    if (in_array($symbol, ['XBT', 'XXBT'], true)) return 'BTC';
    if ($symbol === 'XDG') return 'DOGE';
    if ($symbol === 'XETH') return 'ETH';
    if (in_array($symbol, ['TON', 'TONCOIN'], true)) return 'GRAM';
    return $symbol;
}

function cron_radar_fetch_many(array $urls): array
{
    $results = array_fill_keys(array_keys($urls), null);
    if (!function_exists('curl_multi_init')) {
        throw new RuntimeException('The PHP cURL extension with curl_multi support is required.');
    }

    $multi = curl_multi_init();
    if ($multi === false) {
        throw new RuntimeException('Unable to initialize the market-data cURL multi handle.');
    }
    $handles = [];
    foreach ($urls as $key => $url) {
        $handle = curl_init((string) $url);
        if ($handle === false) {
            error_log('Cron radar could not initialize request: ' . $key);
            continue;
        }
        $configured = curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 2,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 4,
            CURLOPT_USERAGENT => 'DidehbonCronRadar/1.0',
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        if (!$configured || curl_multi_add_handle($multi, $handle) !== CURLM_OK) {
            error_log('Cron radar could not add request: ' . $key);
            curl_close($handle);
            continue;
        }
        $handles[$key] = $handle;
    }

    try {
        do {
            $status = curl_multi_exec($multi, $running);
            if ($status !== CURLM_OK) {
                throw new RuntimeException('Market-data request failed: ' . curl_multi_strerror($status));
            }
            if ($running > 0 && curl_multi_select($multi, 0.2) === -1) {
                usleep(100_000);
            }
        } while ($running > 0);

        foreach ($handles as $key => $handle) {
            $body = curl_multi_getcontent($handle);
            $statusCode = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
            $error = curl_error($handle);
            $decoded = is_string($body) ? json_decode($body, true) : null;
            if ($error === '' && $statusCode >= 200 && $statusCode < 300 && is_array($decoded)) {
                $results[$key] = $decoded;
            } else {
                error_log(
                    'Cron radar upstream request failed: ' . $key .
                    ' (HTTP ' . $statusCode . ($error !== '' ? ', ' . $error : '') . ')'
                );
            }
        }
    } finally {
        foreach ($handles as $handle) {
            curl_multi_remove_handle($multi, $handle);
            curl_close($handle);
        }
        curl_multi_close($multi);
    }
    return $results;
}

function cron_radar_add_market(
    array &$markets,
    array &$prices,
    string $exchange,
    string $symbol,
    string $pair,
    float $volumeUsd,
    float $changePct,
    float $price
): void {
    $symbol = cron_radar_symbol($symbol);
    if ($symbol === '' || in_array($symbol, ['USD', 'USDT', 'USDC', 'TMN', 'IRT', 'KRW'], true)) return;
    $market = [
        'volumeUsd' => max(0, $volumeUsd),
        'changePct' => $changePct,
        'pair' => $pair,
    ];
    if (
        !isset($markets[$symbol][$exchange])
        || $market['volumeUsd'] > $markets[$symbol][$exchange]['volumeUsd']
    ) {
        $markets[$symbol][$exchange] = $market;
    }
    if ($price > 0 && (
        !isset($prices[$symbol]) ||
        $market['volumeUsd'] > ($prices[$symbol]['volumeUsd'] ?? 0)
    )) {
        $prices[$symbol] = ['price' => $price, 'volumeUsd' => $market['volumeUsd']];
    }
}

function cron_radar_quote_suffix(string $pair, array $suffixes): ?string
{
    foreach ($suffixes as $suffix) {
        if (str_ends_with($pair, $suffix)) return $suffix;
    }
    return null;
}

function cron_radar_supply_cache(): array
{
    $cachePath = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR . 'didehbon-cron-radar-supplies.json';
    $cached = json_decode((string) @file_get_contents($cachePath), true);
    if (
        is_array($cached)
        && isset($cached['fetchedAt'], $cached['supplies'])
        && is_array($cached['supplies'])
        && time() - (int) $cached['fetchedAt'] < 86400
    ) {
        return $cached['supplies'];
    }

    $payload = cron_radar_fetch_many([
        'supplies' => 'https://api.coinpaprika.com/v1/tickers',
    ])['supplies'] ?? null;
    if (!is_array($payload)) {
        return is_array($cached['supplies'] ?? null) ? $cached['supplies'] : [];
    }

    $supplies = [];
    foreach ($payload as $item) {
        if (!is_array($item) || !is_string($item['symbol'] ?? null)) continue;
        $symbol = cron_radar_symbol($item['symbol']);
        $supply = cron_radar_number($item['circulating_supply'] ?? 0);
        if ($symbol !== '' && $supply > 0) $supplies[$symbol] = $supply;
    }
    if ($supplies) {
        $written = @file_put_contents(
            $cachePath,
            json_encode(
                ['fetchedAt' => time(), 'supplies' => $supplies],
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
            ),
            LOCK_EX
        );
        if ($written === false) error_log('Cron radar could not cache circulating supplies.');
    }
    return $supplies;
}

function cron_radar_fetch_market_data(): array
{
    $payloads = cron_radar_fetch_many([
        'Binance' => 'https://data-api.binance.vision/api/v3/ticker/24hr',
        'OKX' => 'https://www.okx.com/api/v5/market/tickers?instType=SPOT',
        'Bybit' => 'https://api.bybit.com/v5/market/tickers?category=spot',
        'KrakenPairs' => 'https://api.kraken.com/0/public/AssetPairs',
        'Wallex' => 'https://api.wallex.ir/v1/markets',
    ]);

    $markets = [];
    $prices = [];
    $binancePairs = [];
    foreach (is_array($payloads['Binance']) ? $payloads['Binance'] : [] as $item) {
        if (!is_array($item)) continue;
        $pair = strtoupper((string) ($item['symbol'] ?? ''));
        $quote = cron_radar_quote_suffix($pair, ['USDT', 'USDC', 'USD']);
        $price = cron_radar_number($item['lastPrice'] ?? 0);
        if ($quote === null || $price <= 0) continue;
        $symbol = substr($pair, 0, -strlen($quote));
        cron_radar_add_market(
            $markets,
            $prices,
            'Binance',
            $symbol,
            $pair,
            cron_radar_number($item['quoteVolume'] ?? 0),
            cron_radar_number($item['priceChangePercent'] ?? 0),
            $price
        );
        if ($quote === 'USDT') $binancePairs[cron_radar_symbol($symbol)] = $pair;
    }

    foreach ($payloads['OKX']['data'] ?? [] as $item) {
        if (!is_array($item)) continue;
        $pair = strtoupper((string) ($item['instId'] ?? ''));
        $quote = cron_radar_quote_suffix($pair, ['-USDT', '-USDC', '-USD']);
        if ($quote === null) continue;
        $price = cron_radar_number($item['last'] ?? 0);
        $open = cron_radar_number($item['open24h'] ?? 0);
        cron_radar_add_market(
            $markets,
            $prices,
            'OKX',
            substr($pair, 0, -strlen($quote)),
            $pair,
            cron_radar_number($item['volCcy24h'] ?? 0) * $price,
            $open > 0 ? (($price / $open) - 1) * 100 : 0,
            $price
        );
    }

    foreach ($payloads['Bybit']['result']['list'] ?? [] as $item) {
        if (!is_array($item)) continue;
        $pair = strtoupper((string) ($item['symbol'] ?? ''));
        $quote = cron_radar_quote_suffix($pair, ['USDT', 'USDC', 'USD']);
        if ($quote === null) continue;
        cron_radar_add_market(
            $markets,
            $prices,
            'Bybit',
            substr($pair, 0, -strlen($quote)),
            $pair,
            cron_radar_number($item['turnover24h'] ?? 0),
            cron_radar_number($item['price24hPcnt'] ?? 0) * 100,
            cron_radar_number($item['lastPrice'] ?? 0)
        );
    }

    $krakenPairs = [];
    $krakenAliases = [];
    foreach ($payloads['KrakenPairs']['result'] ?? [] as $key => $item) {
        if (!is_array($item)) continue;
        [$base, $quote] = array_pad(explode('/', (string) ($item['wsname'] ?? '')), 2, '');
        if ($base === '' || !in_array(strtoupper($quote), ['USD', 'USDT', 'USDC'], true)) continue;
        $symbol = cron_radar_symbol($base);
        $pair = (string) ($item['altname'] ?? $key);
        $krakenPairs[$symbol] = $pair;
        $krakenAliases[strtolower((string) $key)] = $symbol;
        $krakenAliases[strtolower($pair)] = $symbol;
        $krakenAliases[strtolower((string) ($item['wsname'] ?? ''))] = $symbol;
    }

    $wallexSymbols = $payloads['Wallex']['result']['symbols'] ?? [];
    $wallexUsdtToman = 0.0;
    $wallexMarkets = [];
    foreach (is_array($wallexSymbols) ? $wallexSymbols : [] as $item) {
        if (!is_array($item)) continue;
        $base = cron_radar_symbol((string) ($item['baseAsset'] ?? $item['base_asset'] ?? ''));
        $quote = strtoupper((string) ($item['quoteAsset'] ?? $item['quote_asset'] ?? ''));
        $symbol = strtoupper((string) ($item['symbol'] ?? ''));
        $stats = is_array($item['stats'] ?? null) ? $item['stats'] : [];
        $price = cron_radar_number(
            $item['price'] ?? $stats['lastPrice'] ?? $stats['latestPrice'] ?? 0
        );
        if (
            $base === 'USDT'
            && in_array($quote, ['TMN', 'IRT'], true)
            && $price > 0
        ) {
            $wallexUsdtToman = $price;
        }
        if ($base === '' || $price <= 0 || !in_array($quote, ['USDT', 'TMN', 'IRT'], true)) continue;
        $wallexMarkets[$base][] = [
            'quote' => $quote,
            'price' => $price,
            'symbol' => $symbol,
            'nameFa' => (string) ($item['faBaseAsset'] ?? $item['faName'] ?? $base),
            'changePct' => cron_radar_number(
                $item['change_24h'] ?? $stats['24h_ch'] ?? $stats['percentChange24h'] ?? 0
            ),
            'quoteVolume' => cron_radar_number(
                $item['quote_volume_24h']
                    ?? $item['24h_quote_volume']
                    ?? $stats['24h_quoteVolume']
                    ?? $stats['24h_quote_volume']
                    ?? 0
            ),
        ];
    }
    foreach ($wallexMarkets as $symbol => $items) {
        foreach ($items as $item) {
            $priceUsd = $item['quote'] === 'USDT'
                ? $item['price']
                : ($wallexUsdtToman > 0 ? $item['price'] / $wallexUsdtToman : 0);
            if ($priceUsd > 0 && !isset($prices[$symbol])) {
                $prices[$symbol] = ['price' => $priceUsd, 'volumeUsd' => 0];
            }
        }
    }

    $common = array_values(array_intersect(array_keys($wallexMarkets), array_keys($markets)));
    $krakenUrls = [];
    $krakenCommonPairs = [];
    foreach ($common as $symbol) {
        if (isset($krakenPairs[$symbol])) $krakenCommonPairs[$symbol] = $krakenPairs[$symbol];
    }
    foreach (array_chunk($krakenCommonPairs, 40, true) as $index => $pairs) {
        $krakenUrls['Kraken' . $index] =
            'https://api.kraken.com/0/public/Ticker?pair=' . rawurlencode(implode(',', $pairs));
    }
    if ($krakenUrls) {
        $krakenTickers = cron_radar_fetch_many($krakenUrls);
        foreach ($krakenTickers as $tickerPayload) {
            foreach ($tickerPayload['result'] ?? [] as $pairKey => $item) {
                if (!is_array($item)) continue;
                $symbol = $krakenAliases[strtolower((string) $pairKey)] ?? '';
                $volume = is_array($item['v'] ?? null) ? $item['v'] : [];
                $price = is_array($item['p'] ?? null) ? $item['p'] : [];
                $last = cron_radar_number($price[1] ?? 0);
                $open = cron_radar_number($item['o'] ?? 0);
                if ($symbol === '' || $last <= 0) continue;
                cron_radar_add_market(
                    $markets,
                    $prices,
                    'Kraken',
                    $symbol,
                    (string) ($krakenPairs[$symbol] ?? $pairKey),
                    cron_radar_number($volume[1] ?? 0) * $last,
                    $open > 0 ? (($last / $open) - 1) * 100 : 0,
                    $last
                );
            }
        }
    }

    $currentPrices = [];
    foreach ($prices as $symbol => $market) $currentPrices[$symbol] = $market['price'];
    $common = array_values(array_intersect(array_keys($wallexMarkets), array_keys($markets)));
    usort($common, static function (string $left, string $right) use ($markets): int {
        $leftVolume = array_sum(array_column($markets[$left] ?? [], 'volumeUsd'));
        $rightVolume = array_sum(array_column($markets[$right] ?? [], 'volumeUsd'));
        return $rightVolume <=> $leftVolume;
    });

    $candleSymbols = [];
    foreach ($common as $symbol) {
        if (isset($binancePairs[$symbol])) $candleSymbols[] = $symbol;
        if (count($candleSymbols) >= CRON_RADAR_MAX_CANDLES) break;
    }
    $candleUrls = [];
    foreach ($candleSymbols as $symbol) {
        $candleUrls[$symbol] = 'https://data-api.binance.vision/api/v3/klines?symbol='
            . rawurlencode($binancePairs[$symbol]) . '&interval=1h&limit=24';
    }
    $candles = [];
    $candleBatches = array_chunk($candleUrls, 8, true);
    foreach ($candleBatches as $index => $batch) {
        $candles += cron_radar_fetch_many($batch);
        if ($index < count($candleBatches) - 1) usleep(120_000);
    }
    $supplies = cron_radar_supply_cache();

    return [
        'markets' => $markets,
        'prices' => $currentPrices,
        'wallexMarkets' => $wallexMarkets,
        'candles' => $candles,
        'supplies' => $supplies,
    ];
}

function cron_radar_average(array $values): float
{
    return count($values) > 0 ? array_sum($values) / count($values) : 0.0;
}

function cron_radar_standard_deviation(array $values, float $mean): float
{
    if (!$values) return 0.0;
    $squared = array_map(static fn (float $value): float => ($value - $mean) ** 2, $values);
    return sqrt(cron_radar_average($squared));
}

function cron_radar_median(array $values): float
{
    if (!$values) return 0.0;
    sort($values, SORT_NUMERIC);
    $middle = intdiv(count($values), 2);
    return count($values) % 2
        ? $values[$middle]
        : ($values[$middle - 1] + $values[$middle]) / 2;
}

function cron_radar_candidates(array $data): array
{
    $candidates = [];
    foreach ($data['wallexMarkets'] as $symbol => $wallexPairs) {
        $exchangeMarkets = $data['markets'][$symbol] ?? [];
        $rows = $data['candles'][$symbol] ?? [];
        if (!$exchangeMarkets || !is_array($rows) || count($rows) !== 24) continue;

        $hourlyReturns = [];
        $validRows = [];
        foreach ($rows as $row) {
            if (!is_array($row) || count($row) < 11) continue;
            $close = cron_radar_number($row[4] ?? 0);
            if ($close <= 0) continue;
            $validRows[] = $row;
        }
        for ($index = 1; $index < count($validRows); $index++) {
            $close = cron_radar_number($validRows[$index][4] ?? 0);
            $previous = cron_radar_number($validRows[$index - 1][4] ?? 0);
            if ($close > 0 && $previous > 0) $hourlyReturns[] = (($close / $previous) - 1) * 100;
        }
        if (count($validRows) !== 24 || count($hourlyReturns) !== 23) continue;

        $returnsMean = cron_radar_average($hourlyReturns);
        $returnsStdDev = cron_radar_standard_deviation($hourlyReturns, $returnsMean);
        if ($returnsStdDev <= 0) continue;
        $recentReturns = array_slice($hourlyReturns, -2);
        $recentMean = cron_radar_average($recentReturns);
        $zScore = ($recentMean - $returnsMean) / $returnsStdDev;
        $currentPrice = cron_radar_number($validRows[count($validRows) - 1][4] ?? 0);
        $latestRow = $validRows[count($validRows) - 1];
        $quoteVolume = cron_radar_number($latestRow[7] ?? 0);
        $buyVolume = cron_radar_number($latestRow[10] ?? 0);
        $netFlow = (2 * $buyVolume) - $quoteVolume;
        $supply = cron_radar_number($data['supplies'][$symbol] ?? 0);
        $marketCap = $supply > 0 ? $supply * $currentPrice : 0;
        $ratios = [];
        if ($marketCap > 0) {
            for ($index = 1; $index < count($validRows); $index++) {
                $close = cron_radar_number($validRows[$index][4] ?? 0);
                $previous = cron_radar_number($validRows[$index - 1][4] ?? 0);
                $volume = cron_radar_number($validRows[$index][7] ?? 0);
                $buy = cron_radar_number($validRows[$index][10] ?? 0);
                $flow = abs((2 * $buy) - $volume);
                if ($close <= 0 || $previous <= 0 || $flow <= 0) continue;
                $hourlyChange = (($close / $previous) - 1) * 100;
                $normalizedFlow = ($flow / $marketCap) * 100;
                $ratios[] = (abs($hourlyChange) / max($normalizedFlow, 0.000001)) * (100 / $marketCap);
            }
        }
        $beta = cron_radar_median($ratios);
        $predictedPct = $beta > 0 ? $beta * $netFlow : $recentMean;
        $alignedExchanges = 0;
        $totalVolume = 0.0;
        foreach ($exchangeMarkets as $market) {
            $totalVolume += cron_radar_number($market['volumeUsd'] ?? 0);
            if (
                $zScore !== 0
                && cron_radar_number($market['changePct'] ?? 0) !== 0
                && signum(cron_radar_number($market['changePct'])) === signum($zScore)
            ) {
                $alignedExchanges++;
            }
        }
        $confidence = min(95, max(
            55,
            55 + ($alignedExchanges / max(count($exchangeMarkets), 1)) * 25
                + (min(abs($zScore), 3) / 3) * 15
        ));
        if (
            abs($zScore) < 1.5
            || abs($predictedPct) < 1
            || abs($netFlow) < 25_000
            || signum($zScore) !== signum($predictedPct)
        ) continue;

        $nameFa = $symbol;
        foreach ($wallexPairs as $pair) {
            if (isset($pair['nameFa']) && is_string($pair['nameFa']) && $pair['nameFa'] !== '') {
                $nameFa = $pair['nameFa'];
                break;
            }
        }
        $candidates[] = [
            'symbol' => $symbol,
            'nameFa' => $nameFa,
            'direction' => $predictedPct >= 0 ? 'bullish' : 'bearish',
            'predictedUsdtPct' => $predictedPct,
            'zScore' => $zScore,
            'netFlowUsd' => $netFlow,
            'confidencePct' => (int) round($confidence),
            'entryPriceUsdt' => $currentPrice,
            'exchangeVolumeUsd' => $totalVolume,
        ];
    }
    return $candidates;
}

function signum(float $value): int
{
    return $value < 0 ? -1 : ($value > 0 ? 1 : 0);
}

function cron_radar_persian_date_time(int $timestamp): array
{
    $date = (new DateTimeImmutable('@' . $timestamp))->setTimezone(new DateTimeZone('Asia/Tehran'));
    $gy = (int) $date->format('Y');
    $gm = (int) $date->format('n');
    $gd = (int) $date->format('j');
    $monthDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    $jy = $gy > 1600 ? 979 : 0;
    $gy -= $gy > 1600 ? 1600 : 621;
    $gy2 = $gm > 2 ? $gy + 1 : $gy;
    $days = 365 * $gy
        + intdiv($gy2 + 3, 4)
        - intdiv($gy2 + 99, 100)
        + intdiv($gy2 + 399, 400)
        - 80
        + $gd
        + $monthDays[$gm - 1];
    $jy += 33 * intdiv($days, 12053);
    $days %= 12053;
    $jy += 4 * intdiv($days, 1461);
    $days %= 1461;
    if ($days > 365) {
        $jy += intdiv($days - 1, 365);
        $days = ($days - 1) % 365;
    }
    if ($days < 186) {
        $jm = 1 + intdiv($days, 31);
        $jd = 1 + ($days % 31);
    } else {
        $jm = 7 + intdiv($days - 186, 30);
        $jd = 1 + (($days - 186) % 30);
    }
    return [
        'date' => sprintf('%04d/%02d/%02d', $jy, $jm, $jd),
        'time' => $date->format('H:i:s'),
    ];
}

function cron_radar_guarantee_tier(int $confidence): string
{
    if ($confidence >= 85) return 'gold';
    if ($confidence >= 70) return 'high';
    return 'medium';
}

function cron_radar_sort_signals(array &$signals): void
{
    usort($signals, static function (array $left, array $right): int {
        return (strtotime((string) ($right['createdAt'] ?? '')) ?: 0)
            <=> (strtotime((string) ($left['createdAt'] ?? '')) ?: 0);
    });
    $signals = array_slice($signals, 0, CRON_RADAR_MAX_HISTORY);
}

function cron_radar_update_history(array $currentPrices, array $candidates): array
{
    $handle = @fopen(CRON_RADAR_SIGNAL_FILE, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Unable to open the signal history file for writing.');
    }
    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        throw new RuntimeException('Unable to lock the signal history file.');
    }

    try {
        rewind($handle);
        $raw = stream_get_contents($handle);
        $signals = json_decode(is_string($raw) && $raw !== '' ? $raw : '[]', true);
        if (!is_array($signals)) {
            throw new RuntimeException('Signal history contains invalid JSON; no changes were written.');
        }
        $now = time();
        $nowMs = (int) round(microtime(true) * 1000);
        $updated = 0;
        $checked = 0;
        foreach ($signals as &$signal) {
            if (!is_array($signal) || ($signal['status'] ?? '') !== 'pending') continue;
            $checked++;
            $createdAt = strtotime((string) ($signal['createdAt'] ?? ''));
            if ($createdAt === false || $createdAt <= 0) {
                error_log('Cron radar skipped signal with invalid createdAt: ' . (string) ($signal['id'] ?? 'unknown'));
                continue;
            }
            $age = max(0, $now - $createdAt);
            $symbol = cron_radar_symbol((string) ($signal['symbol'] ?? ''));
            $price = cron_radar_number($currentPrices[$symbol] ?? 0);
            $changed = false;
            if ($price > 0 && cron_radar_number($signal['entryPriceUsdt'] ?? 0) > 0) {
                $entry = (float) $signal['entryPriceUsdt'];
                $predicted = cron_radar_number($signal['predictedUsdtPct'] ?? 0);
                $actualMove = (($price - $entry) / $entry) * 100;
                $realizedGoal = $predicted !== 0
                    ? min(100, max(0, ($actualMove / $predicted) * 100))
                    : 0;
                foreach ([
                    'currentPriceUsdt' => $price,
                    'actualMovePct' => $actualMove,
                    'realizedGoalPct' => $realizedGoal,
                ] as $key => $value) {
                    if (!isset($signal[$key]) || abs((float) $signal[$key] - $value) > 0.0000001) {
                        $signal[$key] = $value;
                        $changed = true;
                    }
                }
                $reached = ($signal['direction'] ?? '') === 'bullish'
                    ? $price >= cron_radar_number($signal['targetPriceUsdt'] ?? 0)
                    : $price <= cron_radar_number($signal['targetPriceUsdt'] ?? 0);
                if ($reached && $age <= 4 * 3600) {
                    $durationMinutes = max(1, (int) round($age / 60));
                    $windowHours = min(4, max(1, (int) ceil($durationMinutes / 60)));
                    $resolvedDateTime = cron_radar_persian_date_time($now);
                    $signal['status'] = 'success';
                    $signal['resolvedAt'] = $nowMs;
                    $signal['resolvedPersianDate'] = $resolvedDateTime['date'];
                    $signal['resolvedPersianTime'] = $resolvedDateTime['time'];
                    $signal['durationMinutes'] = $durationMinutes;
                    $signal['realizedWindow'] = $windowHours . ' ساعته';
                    $signal['realizedLabel'] = $durationMinutes <= 60
                        ? 'موفق در بازه 1 ساعته'
                        : '1 ساعته: ناموفق • 4 ساعته: موفق';
                    $changed = true;
                }
            }
            if (($signal['status'] ?? '') === 'pending' && $age >= 4 * 3600) {
                $signal['status'] = 'failed';
                $signal['resolvedAt'] = $nowMs;
                $signal['realizedLabel'] = '1 ساعته: ناموفق • 4 ساعته: ناموفق';
                $changed = true;
            } elseif (($signal['status'] ?? '') === 'pending') {
                $label = $age < 3600
                    ? '1 ساعته: در حال بررسی • 4 ساعته: در حال بررسی'
                    : '1 ساعته: ناموفق • 4 ساعته: در حال بررسی';
                if (($signal['realizedLabel'] ?? '') !== $label) {
                    $signal['realizedLabel'] = $label;
                    $changed = true;
                }
            }
            if ($changed) {
                $signal['updatedAt'] = gmdate('c', $now);
                $updated++;
            }
        }
        unset($signal);

        $registered = 0;
        foreach ($candidates as $candidate) {
            $symbol = (string) $candidate['symbol'];
            $direction = (string) $candidate['direction'];
            $duplicate = false;
            foreach ($signals as $existing) {
                if (!is_array($existing)) continue;
                if (
                    strtoupper((string) ($existing['symbol'] ?? '')) === $symbol
                    && ($existing['direction'] ?? '') === $direction
                    && abs($now - (strtotime((string) ($existing['createdAt'] ?? '')) ?: 0)) < 7200
                ) {
                    $duplicate = true;
                    break;
                }
            }
            if ($duplicate) continue;

            $timestamp = microtime(true);
            $createdAt = gmdate('Y-m-d\TH:i:s\Z', (int) $timestamp);
            $dateTime = cron_radar_persian_date_time((int) $timestamp);
            $confidence = (int) $candidate['confidencePct'];
            $signal = [
                'id' => bin2hex(random_bytes(16)),
                'symbol' => $symbol,
                'nameFa' => (string) ($candidate['nameFa'] ?? $symbol),
                'direction' => $direction,
                'predictedUsdtPct' => (float) $candidate['predictedUsdtPct'],
                'persianDate' => $dateTime['date'],
                'persianTime' => $dateTime['time'],
                'confidencePct' => $confidence,
                'guaranteeTier' => cron_radar_guarantee_tier($confidence),
                'entryPriceUsdt' => (float) $candidate['entryPriceUsdt'],
                'targetPriceUsdt' => (float) $candidate['entryPriceUsdt']
                    * (1 + ((float) $candidate['predictedUsdtPct'] / 100)),
                'status' => 'pending',
                'createdAt' => $createdAt,
                'resolvedAt' => null,
                'updatedAt' => $createdAt,
                'currentPriceUsdt' => (float) $candidate['entryPriceUsdt'],
                'actualMovePct' => 0,
                'realizedGoalPct' => 0,
                'realizedLabel' => '1 ساعته: در حال بررسی • 4 ساعته: در حال بررسی',
            ];
            array_unshift($signals, $signal);
            $registered++;
        }

        if ($updated > 0 || $registered > 0) {
            cron_radar_sort_signals($signals);
            $encoded = json_encode(
                $signals,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
            );
            if (!is_string($encoded)) {
                throw new RuntimeException('Unable to encode updated signal history.');
            }
            rewind($handle);
            if (!ftruncate($handle, 0) || fwrite($handle, $encoded) === false || !fflush($handle)) {
                throw new RuntimeException('Unable to persist updated signal history.');
            }
        }
        return [
            'signalsChecked' => $checked,
            'signalsRegistered' => $registered,
            'signalsUpdated' => $updated,
        ];
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function cron_radar_run(): array
{
    $marketData = cron_radar_fetch_market_data();
    $candidates = cron_radar_candidates($marketData);
    return cron_radar_update_history($marketData['prices'], $candidates);
}

try {
    $summary = cron_radar_run();
    echo json_encode(
        ['success' => true] + $summary,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
} catch (Throwable $error) {
    error_log('Cron radar run failed: ' . $error->getMessage());
    if (PHP_SAPI !== 'cli') http_response_code(500);
    echo json_encode(
        ['success' => false, 'error' => $error->getMessage()],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
    exit(1);
}
