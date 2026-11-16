<?php
declare(strict_types=1);

@ini_set('display_errors', '0');
@ini_set('log_errors', '1');
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const RADAR_CACHE_FILE = '/tmp/radar_6ex_cache.json';
const RADAR_CACHE_TTL = 30;
const RADAR_EXCHANGES = ['Binance', 'OKX', 'Bybit', 'Coinbase', 'Kraken', 'Upbit'];

if (function_exists('set_time_limit')) set_time_limit(120);

function radar_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function radar_number($value): float
{
    return is_numeric($value) ? (float) $value : 0.0;
}

function radar_symbol(string $value): string
{
    $symbol = strtoupper(trim($value));
    $symbol = preg_replace('/^1000(?=[A-Z0-9])/', '', $symbol) ?? $symbol;
    if (in_array($symbol, ['XBT', 'XXBT'], true)) return 'BTC';
    if ($symbol === 'XDG') return 'DOGE';
    if ($symbol === 'XETH') return 'ETH';
    if (in_array($symbol, ['TON', 'TONCOIN'], true)) return 'GRAM';
    return $symbol;
}

function radar_cache_read(): array
{
    $handle = @fopen(RADAR_CACHE_FILE, 'c+');
    if ($handle === false) return [];

    flock($handle, LOCK_SH);
    rewind($handle);
    $decoded = json_decode((string) stream_get_contents($handle), true);
    flock($handle, LOCK_UN);
    fclose($handle);
    return is_array($decoded) ? $decoded : [];
}

function radar_cache_update(array $changes): void
{
    $handle = @fopen(RADAR_CACHE_FILE, 'c+');
    if ($handle === false) {
        error_log('Unable to open the six-exchange radar cache file.');
        return;
    }

    flock($handle, LOCK_EX);
    rewind($handle);
    $cached = json_decode((string) stream_get_contents($handle), true);
    if (!is_array($cached)) $cached = [];
    foreach ($changes as $key => $value) {
        if ($key === 'candles' && is_array($value)) {
            $cached['candles'] = array_replace(
                is_array($cached['candles'] ?? null) ? $cached['candles'] : [],
                $value
            );
        } else {
            $cached[$key] = $value;
        }
    }

    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode(
        $cached,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    ));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
}

function radar_fetch_many(array $urls): array
{
    $results = array_fill_keys(array_keys($urls), null);
    if (!function_exists('curl_multi_init')) {
        error_log('PHP cURL extension is unavailable for the radar proxy.');
        return $results;
    }

    $multi = curl_multi_init();
    if ($multi === false) {
        error_log('Unable to initialize the radar cURL multi handle.');
        return $results;
    }

    $handles = [];
    foreach ($urls as $key => $url) {
        $handle = false;
        try {
            $handle = curl_init((string) $url);
            if ($handle === false) {
                error_log('Unable to initialize radar upstream request: ' . $key);
                continue;
            }
            $configured = curl_setopt_array($handle, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 2,
                CURLOPT_CONNECTTIMEOUT => 4,
                CURLOPT_TIMEOUT => 4,
                CURLOPT_USERAGENT => 'DidehbonRadar/1.0',
                CURLOPT_HTTPHEADER => ['Accept: application/json'],
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
            ]);
            if (!$configured || curl_multi_add_handle($multi, $handle) !== CURLM_OK) {
                error_log('Unable to add radar upstream request: ' . $key);
                curl_close($handle);
                $handle = false;
                continue;
            }
            $handles[$key] = $handle;
        } catch (Throwable $error) {
            error_log('Unable to prepare radar upstream request ' . $key . ': ' . $error->getMessage());
            if ($handle !== false) {
                curl_close($handle);
            }
        }
    }

    try {
        do {
            $status = curl_multi_exec($multi, $running);
            if ($status !== CURLM_OK) {
                error_log('Radar cURL multi execution failed: ' . curl_multi_strerror($status));
                break;
            }
            if ($running > 0 && curl_multi_select($multi, 0.2) === -1) {
                usleep(100_000);
            }
        } while ($running > 0);
    } catch (Throwable $error) {
        error_log('Radar cURL multi request failed: ' . $error->getMessage());
    }

    foreach ($handles as $key => $handle) {
        try {
            $body = curl_multi_getcontent($handle);
            $httpStatus = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
            $curlError = curl_error($handle);
            $decoded = is_string($body) ? json_decode($body, true) : null;
            if ($curlError === '' && $httpStatus >= 200 && $httpStatus < 300 && is_array($decoded)) {
                $results[$key] = $decoded;
            } else {
                error_log(
                    'Radar upstream request failed: ' . $key .
                    ' (HTTP ' . $httpStatus . ($curlError !== '' ? ', ' . $curlError : '') . ')'
                );
            }
        } catch (Throwable $error) {
            error_log('Unable to read radar upstream response ' . $key . ': ' . $error->getMessage());
        } finally {
            curl_multi_remove_handle($multi, $handle);
            curl_close($handle);
        }
    }
    curl_multi_close($multi);
    return $results;
}

function radar_fetch_one(string $url): ?array
{
    $results = radar_fetch_many(['response' => $url]);
    return is_array($results['response'] ?? null) ? $results['response'] : null;
}

function radar_add_market(
    array &$markets,
    string $rawSymbol,
    string $pair,
    float $volumeUsd,
    float $changePct,
    float $quoteToUsd = 1.0
): void {
    $symbol = radar_symbol($rawSymbol);
    if ($symbol === '' || in_array($symbol, ['USD', 'USDT', 'USDC', 'TMN', 'IRT', 'KRW'], true)) return;
    $market = [
        'symbol' => $symbol,
        'pair' => $pair,
        'volumeUsd' => max(0, $volumeUsd),
        'changePct' => $changePct,
        'quoteToUsd' => max(0, $quoteToUsd),
    ];
    if (!isset($markets[$symbol]) || $market['volumeUsd'] > $markets[$symbol]['volumeUsd']) {
        $markets[$symbol] = $market;
    }
}

function radar_market_response(): array
{
    $cached = radar_cache_read();
    if (
        isset($cached['markets']['fetchedAt'], $cached['markets']['exchanges']) &&
        time() - (int) $cached['markets']['fetchedAt'] < RADAR_CACHE_TTL
    ) {
        return $cached['markets']['exchanges'];
    }

    $urls = [
        'Binance' => 'https://data-api.binance.vision/api/v3/ticker/24hr',
        'OKX' => 'https://www.okx.com/api/v5/market/tickers?instType=SPOT',
        'Bybit' => 'https://api.bybit.com/v5/market/tickers?category=spot',
        'Coinbase' => 'https://api.coinbase.com/api/v3/brokerage/market/products?product_type=SPOT&limit=250',
        'KrakenPairs' => 'https://api.kraken.com/0/public/AssetPairs',
        'UpbitMarkets' => 'https://api.upbit.com/v1/market/all?isDetails=false',
    ];
    $payloads = radar_fetch_many($urls);
    $coinbase = $payloads['Coinbase'] ?? null;
    $cursor = (string) ($coinbase['pagination']['next_cursor'] ?? '');
    $pageCount = 0;
    while (
        is_array($coinbase) &&
        ($coinbase['pagination']['has_next'] ?? false) &&
        $cursor !== '' &&
        $pageCount < 20
    ) {
        $page = radar_fetch_one(
            'https://api.coinbase.com/api/v3/brokerage/market/products?product_type=SPOT&limit=250&cursor='
            . rawurlencode($cursor)
        );
        if (!is_array($page)) break;
        $coinbase['products'] = array_merge(
            is_array($coinbase['products'] ?? null) ? $coinbase['products'] : [],
            is_array($page['products'] ?? null) ? $page['products'] : []
        );
        $cursor = (string) ($page['pagination']['next_cursor'] ?? '');
        $coinbase['pagination'] = $page['pagination'] ?? [];
        $pageCount++;
    }
    $payloads['Coinbase'] = $coinbase;

    $krakenPairs = [];
    $krakenAliases = [];
    $krakenResult = $payloads['KrakenPairs']['result'] ?? [];
    if (is_array($krakenResult)) {
        foreach ($krakenResult as $key => $pairData) {
            if (!is_array($pairData)) continue;
            $wsname = explode('/', (string) ($pairData['wsname'] ?? ''));
            $base = (string) ($wsname[0] ?? '');
            $quote = strtoupper((string) ($wsname[1] ?? ''));
            if ($base === '' || !in_array($quote, ['USD', 'USDT', 'USDC'], true)) continue;
            $pair = (string) ($pairData['altname'] ?? $key);
            $krakenPairs[$base] = ['symbol' => radar_symbol($base), 'pair' => $pair];
            $krakenAliases[strtolower((string) $key)] = radar_symbol($base);
            $krakenAliases[strtolower($pair)] = radar_symbol($base);
            if ($wsname) $krakenAliases[strtolower(implode('/', $wsname))] = radar_symbol($base);
        }
    }
    $krakenUrls = [];
    foreach (array_chunk(array_values(array_unique(array_column($krakenPairs, 'pair'))), 40) as $index => $pairs) {
        if ($pairs) {
            $krakenUrls['KrakenTicker' . $index] =
                'https://api.kraken.com/0/public/Ticker?pair=' . rawurlencode(implode(',', $pairs));
        }
    }

    $upbitMarkets = $payloads['UpbitMarkets'] ?? [];
    $upbitPairs = [];
    foreach (is_array($upbitMarkets) ? $upbitMarkets : [] as $market) {
        if (!is_array($market)) continue;
        $pair = strtoupper((string) ($market['market'] ?? ''));
        if (!preg_match('/^(KRW|USDT)-([A-Z0-9]+)$/', $pair, $matches)) continue;
        $upbitPairs[$pair] = ['symbol' => radar_symbol($matches[2]), 'quote' => $matches[1]];
    }
    $upbitUrls = [];
    foreach (array_chunk(array_keys($upbitPairs), 100) as $index => $pairs) {
        if ($pairs) {
            $upbitUrls['UpbitTicker' . $index] =
                'https://api.upbit.com/v1/ticker?markets=' . rawurlencode(implode(',', $pairs));
        }
    }
    $tickerPayloads = radar_fetch_many(array_merge($krakenUrls, $upbitUrls));
    $krakenTickers = array_intersect_key($tickerPayloads, $krakenUrls);
    $upbitTickers = array_intersect_key($tickerPayloads, $upbitUrls);

    $exchanges = [];
    foreach (RADAR_EXCHANGES as $name) {
        $markets = [];
        if ($name === 'Binance') {
            foreach (is_array($payloads[$name] ?? null) ? $payloads[$name] : [] as $item) {
                if (!is_array($item)) continue;
                $pair = strtoupper((string) ($item['symbol'] ?? ''));
                $quote = null;
                foreach (['USDT', 'USDC', 'USD'] as $candidateQuote) {
                    if (str_ends_with($pair, $candidateQuote)) {
                        $quote = $candidateQuote;
                        break;
                    }
                }
                if ($quote === null) continue;
                radar_add_market(
                    $markets,
                    substr($pair, 0, -strlen($quote)),
                    $pair,
                    radar_number($item['quoteVolume'] ?? 0),
                    radar_number($item['priceChangePercent'] ?? 0)
                );
            }
        } elseif ($name === 'OKX') {
            foreach ($payloads[$name]['data'] ?? [] as $item) {
                if (!is_array($item)) continue;
                $pair = strtoupper((string) ($item['instId'] ?? ''));
                $quote = null;
                foreach (['-USDT', '-USDC', '-USD'] as $candidateQuote) {
                    if (str_ends_with($pair, $candidateQuote)) {
                        $quote = $candidateQuote;
                        break;
                    }
                }
                if ($quote === null) continue;
                $last = radar_number($item['last'] ?? 0);
                $open = radar_number($item['open24h'] ?? 0);
                radar_add_market(
                    $markets,
                    substr($pair, 0, -strlen($quote)),
                    $pair,
                    radar_number($item['volCcy24h'] ?? 0) * $last,
                    $open > 0 ? (($last / $open) - 1) * 100 : 0
                );
            }
        } elseif ($name === 'Bybit') {
            foreach ($payloads[$name]['result']['list'] ?? [] as $item) {
                if (!is_array($item)) continue;
                $pair = strtoupper((string) ($item['symbol'] ?? ''));
                $quote = null;
                foreach (['USDT', 'USDC', 'USD'] as $candidateQuote) {
                    if (str_ends_with($pair, $candidateQuote)) {
                        $quote = $candidateQuote;
                        break;
                    }
                }
                if ($quote === null) continue;
                radar_add_market(
                    $markets,
                    substr($pair, 0, -strlen($quote)),
                    $pair,
                    radar_number($item['turnover24h'] ?? 0),
                    radar_number($item['price24hPcnt'] ?? 0) * 100
                );
            }
        } elseif ($name === 'Coinbase') {
            foreach ($payloads[$name]['products'] ?? [] as $item) {
                if (!is_array($item)) continue;
                $quote = strtoupper((string) ($item['quote_currency_id'] ?? ''));
                if (!in_array($quote, ['USD', 'USDT', 'USDC'], true)) continue;
                if (($item['trading_disabled'] ?? false) || ($item['status'] ?? '') !== 'online') continue;
                radar_add_market(
                    $markets,
                    (string) ($item['base_currency_id'] ?? ''),
                    (string) ($item['product_id'] ?? ''),
                    radar_number($item['approximate_quote_24h_volume'] ?? 0),
                    radar_number($item['price_percentage_change_24h'] ?? 0)
                );
            }
        } elseif ($name === 'Kraken') {
            foreach ($krakenTickers as $tickerPayload) {
                $tickers = $tickerPayload['result'] ?? [];
                if (!is_array($tickers)) continue;
                foreach ($tickers as $pairKey => $item) {
                    if (!is_array($item)) continue;
                    $symbol = $krakenAliases[strtolower((string) $pairKey)] ?? '';
                    $pairInfo = null;
                    foreach ($krakenPairs as $candidate) {
                        if ($candidate['symbol'] === $symbol) {
                            $pairInfo = $candidate;
                            break;
                        }
                    }
                    $volume = $item['v'] ?? [];
                    $price = $item['p'] ?? [];
                    $last = radar_number($price[1] ?? 0);
                    $open = radar_number($item['o'] ?? 0);
                    if ($symbol !== '' && is_array($pairInfo) && $last > 0) {
                        radar_add_market(
                            $markets,
                            $symbol,
                            $pairInfo['pair'],
                            radar_number($volume[1] ?? 0) * $last,
                            $open > 0 ? (($last / $open) - 1) * 100 : 0
                        );
                    }
                }
            }
        } elseif ($name === 'Upbit') {
            $tickers = [];
            foreach ($upbitTickers as $tickerPayload) {
                foreach (is_array($tickerPayload) ? $tickerPayload : [] as $ticker) {
                    if (is_array($ticker)) $tickers[(string) ($ticker['market'] ?? '')] = $ticker;
                }
            }
            $usdtKrw = radar_number($tickers['KRW-USDT']['trade_price'] ?? 0);
            foreach ($tickers as $pair => $item) {
                $pairInfo = $upbitPairs[$pair] ?? null;
                if (!is_array($pairInfo)) continue;
                $quoteToUsd = $pairInfo['quote'] === 'USDT'
                    ? 1.0
                    : ($usdtKrw > 0 ? 1 / $usdtKrw : 0.0);
                radar_add_market(
                    $markets,
                    $pairInfo['symbol'],
                    $pair,
                    radar_number($item['acc_trade_price_24h'] ?? 0) * $quoteToUsd,
                    radar_number($item['signed_change_rate'] ?? 0) * 100,
                    $quoteToUsd
                );
            }
        }
        $exchanges[] = ['name' => $name, 'markets' => array_values($markets)];
    }

    radar_cache_update(['markets' => ['fetchedAt' => time(), 'exchanges' => $exchanges]]);
    return $exchanges;
}

function radar_candle_url(string $exchange, string $pair): string
{
    $patterns = [
        'Binance' => '/^[A-Z0-9]{2,30}$/',
        'OKX' => '/^[A-Z0-9-]{3,40}$/',
        'Bybit' => '/^[A-Z0-9]{2,30}$/',
        'Coinbase' => '/^[A-Z0-9-]{3,40}$/',
        'Kraken' => '/^[A-Z0-9]{3,30}$/',
        'Upbit' => '/^(KRW|USDT)-[A-Z0-9]{2,20}$/',
    ];
    if (!isset($patterns[$exchange]) || !preg_match($patterns[$exchange], $pair)) {
        throw new InvalidArgumentException('Invalid exchange market identifier.');
    }

    return match ($exchange) {
        'Binance' => 'https://data-api.binance.vision/api/v3/klines?symbol='
            . rawurlencode($pair) . '&interval=1h&limit=24',
        'OKX' => 'https://www.okx.com/api/v5/market/candles?instId='
            . rawurlencode($pair) . '&bar=1H&limit=24',
        'Bybit' => 'https://api.bybit.com/v5/market/kline?category=spot&symbol='
            . rawurlencode($pair) . '&interval=60&limit=24',
        'Coinbase' => 'https://api.exchange.coinbase.com/products/' . rawurlencode($pair)
            . '/candles?granularity=3600&start='
            . rawurlencode(gmdate('Y-m-d\TH:i:s\Z', time() - 25 * 3600))
            . '&end=' . rawurlencode(gmdate('Y-m-d\TH:i:s\Z')),
        'Kraken' => 'https://api.kraken.com/0/public/OHLC?pair='
            . rawurlencode($pair) . '&interval=60',
        'Upbit' => 'https://api.upbit.com/v1/candles/minutes/60?market='
            . rawurlencode($pair) . '&count=24',
    };
}

function radar_normalize_candles(string $exchange, ?array $payload): array
{
    if (!is_array($payload)) return [];
    $rows = [];
    if ($exchange === 'Binance') {
        foreach ($payload as $row) {
            if (is_array($row) && count($row) >= 11) {
                $rows[] = [
                    'time' => radar_number($row[0]),
                    'open' => radar_number($row[1]),
                    'high' => radar_number($row[2]),
                    'low' => radar_number($row[3]),
                    'close' => radar_number($row[4]),
                    'quoteVolume' => radar_number($row[7]),
                    'takerBuyQuoteVolume' => radar_number($row[10]),
                ];
            }
        }
    } elseif ($exchange === 'OKX') {
        foreach ($payload['data'] ?? [] as $row) {
            if (is_array($row) && count($row) >= 8) {
                $rows[] = [
                    'time' => radar_number($row[0]),
                    'open' => radar_number($row[1]),
                    'high' => radar_number($row[2]),
                    'low' => radar_number($row[3]),
                    'close' => radar_number($row[4]),
                    'quoteVolume' => radar_number($row[7]),
                ];
            }
        }
    } elseif ($exchange === 'Bybit') {
        foreach ($payload['result']['list'] ?? [] as $row) {
            if (is_array($row) && count($row) >= 7) {
                $rows[] = [
                    'time' => radar_number($row[0]),
                    'open' => radar_number($row[1]),
                    'high' => radar_number($row[2]),
                    'low' => radar_number($row[3]),
                    'close' => radar_number($row[4]),
                    'quoteVolume' => radar_number($row[6]),
                ];
            }
        }
    } elseif ($exchange === 'Coinbase') {
        foreach ($payload as $row) {
            if (is_array($row) && count($row) >= 6) {
                $volume = radar_number($row[5]);
                $close = radar_number($row[4]);
                $rows[] = [
                    'time' => radar_number($row[0]) * 1000,
                    'open' => radar_number($row[3]),
                    'high' => radar_number($row[2]),
                    'low' => radar_number($row[1]),
                    'close' => $close,
                    'quoteVolume' => $volume * $close,
                ];
            }
        }
    } elseif ($exchange === 'Kraken') {
        $result = $payload['result'] ?? [];
        if (is_array($result)) {
            foreach ($result as $pair => $candles) {
                if ($pair === 'last' || !is_array($candles)) continue;
                foreach ($candles as $row) {
                    if (!is_array($row) || count($row) < 8) continue;
                    $close = radar_number($row[4]);
                    $rows[] = [
                        'time' => radar_number($row[0]) * 1000,
                        'open' => radar_number($row[1]),
                        'high' => radar_number($row[2]),
                        'low' => radar_number($row[3]),
                        'close' => $close,
                        'quoteVolume' => radar_number($row[6]) * $close,
                    ];
                }
            }
        }
    } elseif ($exchange === 'Upbit') {
        foreach ($payload as $row) {
            if (!is_array($row)) continue;
            $close = radar_number($row['trade_price'] ?? 0);
            $rows[] = [
                'time' => radar_number($row['timestamp'] ?? 0),
                'open' => radar_number($row['opening_price'] ?? 0),
                'high' => radar_number($row['high_price'] ?? 0),
                'low' => radar_number($row['low_price'] ?? 0),
                'close' => $close,
                'quoteVolume' => radar_number($row['candle_acc_trade_price'] ?? 0),
            ];
        }
    }
    usort($rows, static fn(array $left, array $right): int => $left['time'] <=> $right['time']);
    return array_slice($rows, -24);
}

function radar_candles_response(): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        radar_json(['error' => 'POST is required for candle requests.'], 405);
    }
    if (stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) {
        radar_json(['error' => 'Content-Type application/json is required.'], 415);
    }
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 16_384) {
        radar_json(['error' => 'Candle request body is too large.'], 413);
    }
    $input = json_decode((string) file_get_contents('php://input'), true);
    $items = is_array($input) && is_array($input['items'] ?? null) ? $input['items'] : null;
    if (!is_array($items) || count($items) === 0 || count($items) > 10) {
        radar_json(['error' => 'Candle requests must contain between 1 and 10 markets.'], 400);
    }

    $cache = radar_cache_read();
    $listedPairs = [];
    foreach ($cache['markets']['exchanges'] ?? [] as $exchangeSnapshot) {
        if (!is_array($exchangeSnapshot)) continue;
        $exchangeName = (string) ($exchangeSnapshot['name'] ?? '');
        foreach ($exchangeSnapshot['markets'] ?? [] as $market) {
            if (is_array($market) && isset($market['pair'])) {
                $listedPairs[$exchangeName . '|' . strtoupper((string) $market['pair'])] = true;
            }
        }
    }
    $now = time();
    $urls = [];
    $itemByKey = [];
    $candles = [];
    foreach ($items as $item) {
        if (!is_array($item)) continue;
        $symbol = radar_symbol((string) ($item['symbol'] ?? ''));
        $exchange = (string) ($item['exchange'] ?? '');
        $pair = strtoupper((string) ($item['pair'] ?? ''));
        if ($symbol === '') continue;
        if (!isset($listedPairs[$exchange . '|' . $pair])) {
            radar_json(['error' => 'Requested market is not in the cached spot market list.'], 400);
        }
        $key = hash('sha256', $exchange . '|' . $pair);
        $cachedCandle = $cache['candles'][$key] ?? null;
        if (
            is_array($cachedCandle) &&
            isset($cachedCandle['fetchedAt'], $cachedCandle['rows']) &&
            $now - (int) $cachedCandle['fetchedAt'] < RADAR_CACHE_TTL
        ) {
            $candles[$symbol] = ['exchange' => $exchange, 'rows' => $cachedCandle['rows']];
            continue;
        }
        try {
            $urls[$key] = radar_candle_url($exchange, $pair);
        } catch (InvalidArgumentException $error) {
            radar_json(['error' => $error->getMessage()], 400);
        }
        $itemByKey[$key] = ['symbol' => $symbol, 'exchange' => $exchange];
    }

    $updates = [];
    foreach (radar_fetch_many($urls) as $key => $payload) {
        $item = $itemByKey[$key];
        $rows = radar_normalize_candles($item['exchange'], $payload);
        if (!$rows) continue;
        $candles[$item['symbol']] = ['exchange' => $item['exchange'], 'rows' => $rows];
        $updates['candles'][$key] = ['fetchedAt' => $now, 'rows' => $rows];
    }
    if ($updates) radar_cache_update($updates);
    return ['timestamp' => (int) round(microtime(true) * 1000), 'candles' => $candles];
}

try {
    $action = (string) ($_GET['action'] ?? 'markets');
    if ($action === 'candles') {
        radar_json(radar_candles_response());
    }
    if ($action !== 'markets' || (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET')) {
        radar_json(['error' => 'Unsupported radar proxy request.'], 405);
    }

    radar_json(['timestamp' => (int) round(microtime(true) * 1000), 'exchanges' => radar_market_response()]);
} catch (Throwable $error) {
    error_log('Six-exchange radar proxy failed: ' . $error->getMessage());
    radar_json(['error' => 'Unable to retrieve exchange market data.'], 502);
}
