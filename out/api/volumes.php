<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Accept, Content-Type');

const VOLUME_CACHE_TTL = 45;
const WALLEX_MARKETS_ENDPOINT = 'https://api.wallex.ir/v1/markets';
const NOBITEX_STATS_ENDPOINT = 'https://apiv2.nobitex.ir/market/stats';

function volumes_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function volumes_cache_path(): string
{
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR
        . 'didehbon-volume-comparison-' . hash('sha256', __FILE__) . '.json';
}

function volumes_read_cache(): ?array
{
    $path = volumes_cache_path();
    if (!is_file($path)) {
        return null;
    }

    $cache = json_decode((string) @file_get_contents($path), true);
    if (!is_array($cache) || !isset($cache['payload']['exchanges'], $cache['payload']['coins'])) {
        return null;
    }

    return $cache;
}

function volumes_fetch_sources(): array
{
    $urls = [
        'wallex' => WALLEX_MARKETS_ENDPOINT,
        'nobitex' => NOBITEX_STATS_ENDPOINT,
    ];
    $responses = [];

    if (function_exists('curl_multi_init')) {
        $multi = curl_multi_init();
        $handles = [];
        foreach ($urls as $key => $url) {
            $handle = curl_init($url);
            curl_setopt_array($handle, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 2,
                CURLOPT_CONNECTTIMEOUT => 4,
                CURLOPT_TIMEOUT => 9,
                CURLOPT_ENCODING => '',
                CURLOPT_USERAGENT => 'DidehbonVolumeDashboard/1.0 (+https://didehbon.ir)',
                CURLOPT_HTTPHEADER => ['Accept: application/json'],
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
            ]);
            curl_multi_add_handle($multi, $handle);
            $handles[$key] = $handle;
        }

        do {
            $multiStatus = curl_multi_exec($multi, $running);
            if ($running && $multiStatus === CURLM_OK) {
                $selected = curl_multi_select($multi, 0.25);
                if ($selected === -1) {
                    usleep(10000);
                }
            }
        } while ($running && $multiStatus === CURLM_OK);

        foreach ($handles as $key => $handle) {
            $body = curl_multi_getcontent($handle);
            $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
            $responses[$key] = is_string($body) && $status >= 200 && $status < 300
                ? json_decode($body, true)
                : null;
            curl_multi_remove_handle($multi, $handle);
            curl_close($handle);
        }
        curl_multi_close($multi);
        return $responses;
    }

    foreach ($urls as $key => $url) {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 8,
                'ignore_errors' => true,
                'header' => "User-Agent: DidehbonVolumeDashboard/1.0\r\nAccept: application/json\r\n",
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $body = @file_get_contents($url, false, $context);
        $statusLine = $http_response_header[0] ?? '';
        $responses[$key] = is_string($body) && preg_match('/\s2\d\d\s/', $statusLine)
            ? json_decode($body, true)
            : null;
    }

    return $responses;
}

function volumes_number($value): float
{
    return is_numeric($value) ? (float) $value : 0.0;
}

function volumes_exchange_template(string $id, int $rank, float $volume, float $btcVolume, float $usdtVolume, float $usdtQty, int $marketCount, string $status): array
{
    $names = [
        'wallex' => ['والکس', 'Wallex', 'والکس', 'Wallex Public Spot Markets'],
        'nobitex' => ['نوبیتکس', 'Nobitex', 'بازار اسپات عمومی', 'Public Spot Markets'],
    ];
    [$nameFa, $nameEn, $modelFa, $model] = $names[$id];

    return [
        'id' => $id,
        'nameFa' => $nameFa,
        'nameEn' => $nameEn,
        'url' => $id === 'wallex' ? 'https://wallex.ir' : 'https://nobitex.ir',
        'apiUrl' => $id === 'wallex' ? WALLEX_MARKETS_ENDPOINT : NOBITEX_STATS_ENDPOINT,
        'model' => $model,
        'modelFa' => $modelFa,
        'totalVolumeToman' => $volume,
        'btcVolumeToman' => $btcVolume,
        'usdtVolumeToman' => $usdtVolume,
        'usdtVolumeQty' => $usdtQty,
        'activeMarketsCount' => $marketCount,
        'status' => $status,
        'rank' => $rank,
        'marketSharePercent' => 0,
    ];
}

function volumes_empty_response(string $warning): array
{
    $exchanges = [
        volumes_exchange_template('wallex', 1, 0, 0, 0, 0, 0, 'cached'),
        volumes_exchange_template('nobitex', 2, 0, 0, 0, 0, 0, 'cached'),
    ];

    return [
        'success' => true,
        'lastUpdated' => gmdate('c'),
        'grandTotalToman' => 0,
        'exchanges' => $exchanges,
        'coins' => [],
        'cached' => true,
        'cacheAgeSeconds' => null,
        'warning' => $warning,
        'security' => [
            'ssrfProtected' => true,
            'protocol' => 'https',
            'cacheTtlSeconds' => VOLUME_CACHE_TTL,
            'piiSanitized' => true,
        ],
    ];
}

function volumes_build_payload(array $sourceResponses): ?array
{
    $wallexSymbols = $sourceResponses['wallex']['result']['symbols'] ?? null;
    $nobitexStats = $sourceResponses['nobitex']['stats'] ?? null;
    $wallexSuccess = ($sourceResponses['wallex']['success'] ?? false) === true && is_array($wallexSymbols);
    $nobitexSuccess = ($sourceResponses['nobitex']['status'] ?? '') === 'ok' && is_array($nobitexStats);
    if (!$wallexSuccess && !$nobitexSuccess) {
        return null;
    }

    $usdtRate = 0.0;
    if ($wallexSuccess) {
        $usdtRate = volumes_number($wallexSymbols['USDTTMN']['stats']['lastPrice'] ?? 0);
    }
    if ($usdtRate <= 0 && $nobitexSuccess) {
        $usdtRate = volumes_number($nobitexStats['usdt-rls']['latest'] ?? 0) / 10;
    }

    $exchangeTotals = [
        'wallex' => ['volume' => 0.0, 'btc' => 0.0, 'usdt' => 0.0, 'usdtQty' => 0.0, 'markets' => 0],
        'nobitex' => ['volume' => 0.0, 'btc' => 0.0, 'usdt' => 0.0, 'usdtQty' => 0.0, 'markets' => 0],
    ];
    $coins = [];

    $addMarket = static function (
        string $exchangeId,
        string $symbol,
        string $base,
        string $nameFa,
        string $nameEn,
        float $volumeToman,
        float $volumeQty,
        float $priceToman
    ) use (&$exchangeTotals, &$coins): void {
        if ($base === '' || $base === 'USDT' || $volumeToman <= 0) {
            return;
        }

        $exchangeTotals[$exchangeId]['volume'] += $volumeToman;
        $exchangeTotals[$exchangeId]['markets']++;
        if ($base === 'BTC') {
            $exchangeTotals[$exchangeId]['btc'] += $volumeToman;
        }

        if (!isset($coins[$base])) {
            $coins[$base] = [
                'symbol' => $base,
                'nameFa' => $nameFa !== '' ? $nameFa : $base,
                'nameEn' => $nameEn !== '' ? $nameEn : $base,
                'totalVolumeToman' => 0.0,
                'totalVolumeQty' => 0.0,
                'lastPriceToman' => 0.0,
                'byExchange' => [],
                'topExchangeId' => $exchangeId,
                'wallexSharePercent' => 0.0,
            ];
        }

        $coins[$base]['totalVolumeToman'] += $volumeToman;
        $coins[$base]['totalVolumeQty'] += $volumeQty;
        if ($priceToman > 0) {
            $coins[$base]['lastPriceToman'] = $priceToman;
        }
        if (!isset($coins[$base]['byExchange'][$exchangeId])) {
            $coins[$base]['byExchange'][$exchangeId] = [
                'exchangeId' => $exchangeId,
                'volumeToman' => 0.0,
                'volumeQty' => 0.0,
                'lastPriceToman' => $priceToman,
                'marketSharePercent' => 0.0,
            ];
        }
        $coins[$base]['byExchange'][$exchangeId]['volumeToman'] += $volumeToman;
        $coins[$base]['byExchange'][$exchangeId]['volumeQty'] += $volumeQty;
        if ($priceToman > 0) {
            $coins[$base]['byExchange'][$exchangeId]['lastPriceToman'] = $priceToman;
        }
    };

    if ($wallexSuccess) {
        foreach ($wallexSymbols as $market) {
            if (!is_array($market)) {
                continue;
            }
            $quote = strtoupper((string) ($market['quoteAsset'] ?? ''));
            if (!in_array($quote, ['TMN', 'USDT'], true)) {
                continue;
            }
            $stats = $market['stats'] ?? [];
            if (!is_array($stats)) {
                continue;
            }
            $base = strtoupper((string) ($market['baseAsset'] ?? ''));
            $symbol = strtoupper((string) ($market['symbol'] ?? ''));
            $price = volumes_number($stats['lastPrice'] ?? 0);
            if ($quote === 'USDT') {
                $exchangeTotals['wallex']['usdtQty'] += volumes_number($stats['24h_quoteVolume'] ?? 0);
                $exchangeTotals['wallex']['usdt'] += volumes_number($stats['24h_quoteVolume'] ?? 0) * $usdtRate;
                $price *= $usdtRate;
            }
            $volume = volumes_number($stats['24h_tmnVolume'] ?? 0);
            if ($volume <= 0) {
                $quoteVolume = volumes_number($stats['24h_quoteVolume'] ?? 0);
                $volume = $quote === 'TMN' ? $quoteVolume : $quoteVolume * $usdtRate;
            }
            if ($base === '' && $symbol !== '') {
                $base = substr($symbol, 0, -strlen($quote));
            }
            $addMarket(
                'wallex',
                $symbol,
                $base,
                (string) ($market['faBaseAsset'] ?? ''),
                (string) ($market['enBaseAsset'] ?? ''),
                $volume,
                volumes_number($stats['24h_volume'] ?? 0),
                $price
            );
        }
    }

    if ($nobitexSuccess) {
        foreach ($nobitexStats as $pair => $stats) {
            if (!is_array($stats) || !preg_match('/^([a-z0-9]+)-(rls|usdt)$/i', (string) $pair, $matches)) {
                continue;
            }
            $base = strtoupper($matches[1]);
            $quote = strtolower($matches[2]);
            $volumeQty = volumes_number($stats['volumeSrc'] ?? 0);
            $quoteVolume = volumes_number($stats['volumeDst'] ?? 0);
            if ($volumeQty <= 0 || $quoteVolume <= 0) {
                continue;
            }
            if ($quote === 'rls') {
                $volumeToman = $quoteVolume / 10;
                $priceToman = volumes_number($stats['latest'] ?? 0) / 10;
            } else {
                $volumeToman = $quoteVolume * $usdtRate;
                $priceToman = volumes_number($stats['latest'] ?? 0) * $usdtRate;
                $exchangeTotals['nobitex']['usdtQty'] += $quoteVolume;
                $exchangeTotals['nobitex']['usdt'] += $volumeToman;
            }

            $addMarket(
                'nobitex',
                strtoupper((string) $pair),
                $base,
                $base,
                $base,
                $volumeToman,
                $volumeQty,
                $priceToman
            );
        }
    }

    $grandTotal = $exchangeTotals['wallex']['volume'] + $exchangeTotals['nobitex']['volume'];
    $exchanges = [];
    foreach (['wallex', 'nobitex'] as $id) {
        $totals = $exchangeTotals[$id];
        $exchanges[] = volumes_exchange_template(
            $id,
            0,
            $totals['volume'],
            $totals['btc'],
            $totals['usdt'],
            $totals['usdtQty'],
            $totals['markets'],
            'live'
        );
    }
    usort($exchanges, static function (array $left, array $right): int {
        return $right['totalVolumeToman'] <=> $left['totalVolumeToman'];
    });
    foreach ($exchanges as $index => &$exchange) {
        $exchange['rank'] = $index + 1;
        $exchange['marketSharePercent'] = $grandTotal > 0 ? $exchange['totalVolumeToman'] / $grandTotal * 100 : 0;
    }
    unset($exchange);

    foreach ($coins as &$coin) {
        uasort($coin['byExchange'], static function (array $left, array $right): int {
            return $right['volumeToman'] <=> $left['volumeToman'];
        });
        $coin['topExchangeId'] = array_key_first($coin['byExchange']) ?: 'wallex';
        $coin['wallexSharePercent'] = $coin['totalVolumeToman'] > 0
            ? ($coin['byExchange']['wallex']['volumeToman'] ?? 0) / $coin['totalVolumeToman'] * 100
            : 0;
        foreach ($coin['byExchange'] as &$exchangeStat) {
            $exchangeStat['marketSharePercent'] = $coin['totalVolumeToman'] > 0
                ? $exchangeStat['volumeToman'] / $coin['totalVolumeToman'] * 100
                : 0;
        }
        unset($exchangeStat);
    }
    unset($coin);
    usort($coins, static function (array $left, array $right): int {
        return $right['totalVolumeToman'] <=> $left['totalVolumeToman'];
    });

    $sourceCount = (int) $wallexSuccess + (int) $nobitexSuccess;
    return [
        'success' => true,
        'lastUpdated' => gmdate('c'),
        'grandTotalToman' => $grandTotal,
        'exchanges' => $exchanges,
        'coins' => array_values($coins),
        'cached' => false,
        'cacheAgeSeconds' => 0,
        'warning' => $sourceCount < 2 ? 'Volume data is available from one exchange; the other public API is unavailable.' : null,
        'security' => [
            'ssrfProtected' => true,
            'protocol' => 'https',
            'cacheTtlSeconds' => VOLUME_CACHE_TTL,
            'piiSanitized' => true,
        ],
    ];
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($method !== 'GET') {
    header('Allow: GET, OPTIONS');
    volumes_json(['success' => false, 'error' => 'Method not allowed'], 405);
}

$cached = volumes_read_cache();
if ($cached !== null && time() - (int) ($cached['fetchedAt'] ?? 0) <= VOLUME_CACHE_TTL) {
    $payload = $cached['payload'];
    $payload['cached'] = true;
    $payload['cacheAgeSeconds'] = max(0, time() - (int) $cached['fetchedAt']);
    volumes_json($payload);
}

$payload = volumes_build_payload(volumes_fetch_sources());
if ($payload !== null) {
    $cache = ['fetchedAt' => time(), 'payload' => $payload];
    @file_put_contents(
        volumes_cache_path(),
        json_encode($cache, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE),
        LOCK_EX
    );
    volumes_json($payload);
}

if ($cached !== null) {
    $payload = $cached['payload'];
    $payload['cached'] = true;
    $payload['cacheAgeSeconds'] = max(0, time() - (int) $cached['fetchedAt']);
    $payload['warning'] = 'Exchange APIs are unavailable; showing the last saved volume snapshot.';
    foreach ($payload['exchanges'] as &$exchange) {
        $exchange['status'] = 'cached';
    }
    unset($exchange);
    volumes_json($payload);
}

$payload = volumes_empty_response('Exchange APIs are unavailable and no cached volume snapshot exists yet.');
volumes_json($payload);