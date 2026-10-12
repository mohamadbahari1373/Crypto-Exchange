<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Accept, Content-Type');

const WALLEX_MARKETS_URL = 'https://api.wallex.ir/v1/markets';
const WALLEX_CACHE_TTL = 20;
const MONEY_FLOW_MAX_COINS = 100;

function money_flow_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function money_flow_cache_path(): string
{
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR
        . 'didehbon-wallex-markets-' . hash('sha256', __FILE__) . '.json';
}

function money_flow_read_cache(): ?array
{
    $path = money_flow_cache_path();
    if (!is_file($path)) {
        return null;
    }

    $decoded = json_decode((string) @file_get_contents($path), true);
    if (!is_array($decoded) || !isset($decoded['symbols']) || !is_array($decoded['symbols'])) {
        return null;
    }

    return $decoded;
}

function money_flow_fetch_markets(): ?array
{
    if (function_exists('curl_init')) {
        $handle = curl_init(WALLEX_MARKETS_URL);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 2,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 9,
            CURLOPT_USERAGENT => 'DidehbonMoneyFlow/1.0 (+https://didehbon.ir)',
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        curl_close($handle);
        if (!is_string($body) || $status < 200 || $status >= 300) {
            return null;
        }
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 9,
                'ignore_errors' => true,
                'header' => "User-Agent: DidehbonMoneyFlow/1.0\r\nAccept: application/json\r\n",
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $body = @file_get_contents(WALLEX_MARKETS_URL, false, $context);
        $statusLine = $http_response_header[0] ?? '';
        if (!is_string($body) || !preg_match('/\s2\d\d\s/', $statusLine)) {
            return null;
        }
    }

    $decoded = json_decode($body, true);
    $symbols = $decoded['result']['symbols'] ?? null;
    if (($decoded['success'] ?? false) !== true || !is_array($symbols)) {
        return null;
    }

    $snapshot = [
        'symbols' => $symbols,
        'fetchedAt' => time(),
    ];
    @file_put_contents(
        money_flow_cache_path(),
        json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE),
        LOCK_EX
    );

    return $snapshot;
}

function money_flow_number($value): float
{
    return is_numeric($value) ? (float) $value : 0.0;
}

function money_flow_empty_response(string $currency, int $limit, string $warning): array
{
    return [
        'success' => true,
        'timestamp' => (int) round(microtime(true) * 1000),
        'exchange' => 'Wallex',
        'usdtPriceToman' => 0,
        'totalTradesParsed' => 0,
        'summary' => [
            'totalInflowToman' => 0,
            'totalOutflowToman' => 0,
            'netFlowToman' => 0,
            'totalVolumeToman' => 0,
            'overallBuyPressure' => 0,
            'netInflowCoinsCount' => 0,
            'netOutflowCoinsCount' => 0,
            'totalCoinsTracked' => 0,
        ],
        'radar' => ['topInflows' => [], 'topOutflows' => []],
        'sankey' => ['nodes' => [], 'links' => []],
        'coinStats' => [],
        'currency' => $currency,
        'limit' => $limit,
        'isFallback' => true,
        'warning' => $warning,
    ];
}

function money_flow_build_response(array $symbols, string $currency, int $limit, bool $isFallback): array
{
    $usdtPriceToman = money_flow_number($symbols['USDTTMN']['stats']['lastPrice'] ?? 0);
    $coins = [];

    foreach ($symbols as $market) {
        if (!is_array($market)) {
            continue;
        }

        $quoteAsset = strtoupper((string) ($market['quoteAsset'] ?? ''));
        if (!in_array($quoteAsset, ['TMN', 'USDT'], true)) {
            continue;
        }
        if ($currency !== 'ALL' && $quoteAsset !== $currency) {
            continue;
        }

        $stats = $market['stats'] ?? [];
        if (!is_array($stats)) {
            continue;
        }

        $base = strtoupper((string) ($market['baseAsset'] ?? ''));
        $symbol = strtoupper((string) ($market['symbol'] ?? ''));
        $lastPrice = money_flow_number($stats['lastPrice'] ?? 0);
        if ($base === '' || $base === 'USDT' || $symbol === '' || $lastPrice <= 0) {
            continue;
        }

        $quoteVolume = money_flow_number($stats['24h_quoteVolume'] ?? 0);
        $volumeToman = $quoteAsset === 'TMN'
            ? ($quoteVolume > 0 ? $quoteVolume : money_flow_number($stats['24h_tmnVolume'] ?? 0))
            : money_flow_number($stats['24h_tmnVolume'] ?? 0);
        if ($quoteAsset === 'USDT' && $volumeToman <= 0 && $usdtPriceToman > 0) {
            $volumeToman = $quoteVolume * $usdtPriceToman;
        }
        if ($volumeToman <= 0) {
            continue;
        }

        $direction = $stats['direction'] ?? [];
        $buyPercent = money_flow_number($direction['BUY'] ?? 0);
        $sellPercent = money_flow_number($direction['SELL'] ?? 0);
        $directionTotal = $buyPercent + $sellPercent;
        if ($directionTotal <= 0) {
            $buyPercent = 50;
            $sellPercent = 50;
        } else {
            $buyPercent = ($buyPercent / $directionTotal) * 100;
            $sellPercent = ($sellPercent / $directionTotal) * 100;
        }

        $inflowToman = $volumeToman * $buyPercent / 100;
        $outflowToman = $volumeToman * $sellPercent / 100;
        $volumeUsdt = $quoteAsset === 'USDT'
            ? ($quoteVolume > 0 ? $quoteVolume : ($usdtPriceToman > 0 ? $volumeToman / $usdtPriceToman : 0))
            : ($usdtPriceToman > 0 ? $volumeToman / $usdtPriceToman : 0);
        $inflowUsdt = $volumeUsdt * $buyPercent / 100;
        $outflowUsdt = $volumeUsdt * $sellPercent / 100;

        if (!isset($coins[$base])) {
            $coins[$base] = [
                'symbol' => $base,
                'nameFa' => (string) ($market['faBaseAsset'] ?? $market['faName'] ?? $base),
                'flowStatus' => 'BALANCED',
                'verdictFa' => 'جریان متعادل',
                'verdictEn' => 'Balanced flow',
                'inflowToman' => 0,
                'outflowToman' => 0,
                'netFlowToman' => 0,
                'inflowUsdt' => 0,
                'outflowUsdt' => 0,
                'netFlowUsdt' => 0,
                'tomanMarketInflow' => 0,
                'tomanMarketOutflow' => 0,
                'usdtMarketInflow' => 0,
                'usdtMarketOutflow' => 0,
                'totalVolumeToman' => 0,
                'buyPressurePercent' => 50,
                'sellPressurePercent' => 50,
                'totalTrades' => 0,
                'lastPriceToman' => 0,
                'priceChange24h' => null,
                '_buyPercentWeighted' => 0,
                '_sellPercentWeighted' => 0,
                '_weight' => 0,
                '_marketFlows' => [],
            ];
        }

        $coins[$base]['inflowToman'] += $inflowToman;
        $coins[$base]['outflowToman'] += $outflowToman;
        $coins[$base]['inflowUsdt'] += $inflowUsdt;
        $coins[$base]['outflowUsdt'] += $outflowUsdt;
        $coins[$base]['totalVolumeToman'] += $volumeToman;
        $coins[$base]['_buyPercentWeighted'] += $buyPercent * $volumeToman;
        $coins[$base]['_sellPercentWeighted'] += $sellPercent * $volumeToman;
        $coins[$base]['_weight'] += $volumeToman;
        $coins[$base]['_marketFlows'][$quoteAsset] = [
            'inflowToman' => ($coins[$base]['_marketFlows'][$quoteAsset]['inflowToman'] ?? 0) + $inflowToman,
            'outflowToman' => ($coins[$base]['_marketFlows'][$quoteAsset]['outflowToman'] ?? 0) + $outflowToman,
        ];

        if ($quoteAsset === 'TMN') {
            $coins[$base]['tomanMarketInflow'] += $inflowToman;
            $coins[$base]['tomanMarketOutflow'] += $outflowToman;
            $coins[$base]['lastPriceToman'] = $lastPrice;
            $coins[$base]['priceChange24h'] = is_numeric($stats['24h_ch'] ?? null) ? (float) $stats['24h_ch'] : null;
        } else {
            $coins[$base]['usdtMarketInflow'] += $inflowUsdt;
            $coins[$base]['usdtMarketOutflow'] += $outflowUsdt;
            if ($coins[$base]['lastPriceToman'] <= 0 && $usdtPriceToman > 0) {
                $coins[$base]['lastPriceToman'] = $lastPrice * $usdtPriceToman;
                $coins[$base]['priceChange24h'] = is_numeric($stats['24h_ch'] ?? null) ? (float) $stats['24h_ch'] : null;
            }
        }
    }

    $allCoins = array_values($coins);
    foreach ($allCoins as &$coin) {
        $coin['netFlowToman'] = $coin['inflowToman'] - $coin['outflowToman'];
        $coin['netFlowUsdt'] = $coin['inflowUsdt'] - $coin['outflowUsdt'];
        if ($coin['_weight'] > 0) {
            $coin['buyPressurePercent'] = $coin['_buyPercentWeighted'] / $coin['_weight'];
            $coin['sellPressurePercent'] = $coin['_sellPercentWeighted'] / $coin['_weight'];
        }
        if ($coin['netFlowToman'] > 0) {
            $coin['flowStatus'] = 'NET_INFLOW';
            $coin['verdictFa'] = 'ورود خالص نقدینگی';
            $coin['verdictEn'] = 'Net inflow';
        } elseif ($coin['netFlowToman'] < 0) {
            $coin['flowStatus'] = 'NET_OUTFLOW';
            $coin['verdictFa'] = 'خروج خالص نقدینگی';
            $coin['verdictEn'] = 'Net outflow';
        }
        unset($coin['_buyPercentWeighted'], $coin['_sellPercentWeighted'], $coin['_weight'], $coin['_marketFlows']);
    }
    unset($coin);

    usort($allCoins, static function (array $left, array $right): int {
        return $right['totalVolumeToman'] <=> $left['totalVolumeToman'];
    });

    $totalInflow = array_sum(array_column($allCoins, 'inflowToman'));
    $totalOutflow = array_sum(array_column($allCoins, 'outflowToman'));
    $totalVolume = array_sum(array_column($allCoins, 'totalVolumeToman'));
    $topCoins = array_slice($allCoins, 0, $limit);
    $topInflows = $allCoins;
    usort($topInflows, static function (array $left, array $right): int {
        return $right['netFlowToman'] <=> $left['netFlowToman'];
    });
    $topInflows = array_values(array_filter($topInflows, static fn(array $coin): bool => $coin['netFlowToman'] > 0));
    $topOutflows = $allCoins;
    usort($topOutflows, static function (array $left, array $right): int {
        return $left['netFlowToman'] <=> $right['netFlowToman'];
    });
    $topOutflows = array_values(array_filter($topOutflows, static fn(array $coin): bool => $coin['netFlowToman'] < 0));

    $links = [];
    foreach ($topCoins as $coin) {
        foreach (['TMN' => 'تومان', 'USDT' => 'تتر'] as $quote => $quoteName) {
            if ($currency !== 'ALL' && $currency !== $quote) {
                continue;
            }
            $inflow = $quote === 'TMN' ? $coin['tomanMarketInflow'] : $coin['usdtMarketInflow'] * $usdtPriceToman;
            $outflow = $quote === 'TMN' ? $coin['tomanMarketOutflow'] : $coin['usdtMarketOutflow'] * $usdtPriceToman;
            if ($inflow > 0) {
                $links[] = [
                    'source' => 'ورود سرمایه (' . $quoteName . ')',
                    'target' => $coin['symbol'],
                    'value' => $inflow,
                    'rawValueQuote' => $quote === 'TMN' ? $inflow : $coin['usdtMarketInflow'],
                    'quoteCurrency' => $quote,
                ];
            }
            if ($outflow > 0) {
                $links[] = [
                    'source' => $coin['symbol'],
                    'target' => 'خروج سرمایه (' . $quoteName . ')',
                    'value' => $outflow,
                    'rawValueQuote' => $quote === 'TMN' ? $outflow : $coin['usdtMarketOutflow'],
                    'quoteCurrency' => $quote,
                ];
            }
        }
    }

    $nodes = [];
    foreach ($links as $link) {
        $nodes[$link['source']] = ['name' => $link['source']];
        $nodes[$link['target']] = ['name' => $link['target']];
    }

    return [
        'success' => true,
        'timestamp' => (int) round(microtime(true) * 1000),
        'exchange' => 'Wallex',
        'usdtPriceToman' => $usdtPriceToman,
        'totalTradesParsed' => 0,
        'summary' => [
            'totalInflowToman' => $totalInflow,
            'totalOutflowToman' => $totalOutflow,
            'netFlowToman' => $totalInflow - $totalOutflow,
            'totalVolumeToman' => $totalVolume,
            'overallBuyPressure' => $totalVolume > 0 ? $totalInflow / $totalVolume * 100 : 0,
            'netInflowCoinsCount' => count(array_filter($allCoins, static fn(array $coin): bool => $coin['netFlowToman'] > 0)),
            'netOutflowCoinsCount' => count(array_filter($allCoins, static fn(array $coin): bool => $coin['netFlowToman'] < 0)),
            'totalCoinsTracked' => count($allCoins),
        ],
        'radar' => [
            'topInflows' => array_slice($topInflows, 0, 8),
            'topOutflows' => array_slice($topOutflows, 0, 8),
        ],
        'sankey' => [
            'nodes' => array_values($nodes),
            'links' => $links,
        ],
        'coinStats' => $topCoins,
        'currency' => $currency,
        'limit' => $limit,
        'isFallback' => $isFallback,
        'warning' => $isFallback ? 'Wallex is unavailable; showing the last cached market snapshot.' : null,
    ];
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($method !== 'GET') {
    header('Allow: GET, OPTIONS');
    money_flow_json(['success' => false, 'error' => 'Method not allowed'], 405);
}

$currency = strtoupper((string) ($_GET['currency'] ?? 'ALL'));
if (!in_array($currency, ['ALL', 'TMN', 'USDT'], true)) {
    $currency = 'ALL';
}
$limit = filter_var($_GET['limit'] ?? 30, FILTER_VALIDATE_INT);
$limit = max(1, min(MONEY_FLOW_MAX_COINS, $limit === false ? 30 : $limit));

$cached = money_flow_read_cache();
$isFallback = false;
if ($cached !== null && time() - (int) ($cached['fetchedAt'] ?? 0) <= WALLEX_CACHE_TTL) {
    $snapshot = $cached;
} else {
    $snapshot = money_flow_fetch_markets();
    if ($snapshot === null) {
        $snapshot = $cached;
        $isFallback = true;
    }
}

if ($snapshot === null) {
    $response = money_flow_empty_response(
        $currency,
        $limit,
        'Wallex market data is unavailable and no cached snapshot exists yet.'
    );
    money_flow_json($response);
}

$response = money_flow_build_response($snapshot['symbols'], $currency, $limit, $isFallback);
money_flow_json($response);