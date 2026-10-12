<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Accept, Content-Type');

const NEWS_CACHE_TTL = 180;
const NEWS_LIMIT_PER_SOURCE = 12;

const FALLBACK_NEWS = [
    [
        'id' => 'fallback-arzdigital',
        'title' => 'خبر تازه‌ای در دسترس نیست',
        'summary' => 'در حال حاضر دریافت فید ارزدیجیتال ممکن نشد. برای مشاهده آخرین خبرها به وب‌سایت منبع مراجعه کنید.',
        'url' => 'https://arzdigital.com/',
        'source' => 'arzdigital',
        'sourceNameFa' => 'ارزدیجیتال',
        'sourceNameEn' => 'ArzDigital',
        'category' => 'general',
        'categoryFa' => 'عمومی',
        'publishedAt' => '2020-01-01T00:00:00+00:00',
        'author' => 'ArzDigital',
        'imageUrl' => '',
    ],
    [
        'id' => 'fallback-mihansignal',
        'title' => 'خبر تازه‌ای در دسترس نیست',
        'summary' => 'در حال حاضر دریافت فید میهن سیگنال ممکن نشد. برای مشاهده آخرین خبرها به وب‌سایت منبع مراجعه کنید.',
        'url' => 'https://mihansignal.com/',
        'source' => 'mihansignal',
        'sourceNameFa' => 'میهن سیگنال',
        'sourceNameEn' => 'MihanSignal',
        'category' => 'general',
        'categoryFa' => 'عمومی',
        'publishedAt' => '2020-01-01T00:00:00+00:00',
        'author' => 'MihanSignal',
        'imageUrl' => '',
    ],
    [
        'id' => 'fallback-mihanblockchain',
        'title' => 'خبر تازه‌ای در دسترس نیست',
        'summary' => 'در حال حاضر دریافت فید میهن بلاکچین ممکن نشد. برای مشاهده آخرین خبرها به وب‌سایت منبع مراجعه کنید.',
        'url' => 'https://mihanblockchain.com/',
        'source' => 'mihanblockchain',
        'sourceNameFa' => 'میهن بلاکچین',
        'sourceNameEn' => 'MihanBlockchain',
        'category' => 'general',
        'categoryFa' => 'عمومی',
        'publishedAt' => '2020-01-01T00:00:00+00:00',
        'author' => 'MihanBlockchain',
        'imageUrl' => '',
    ],
    [
        'id' => 'fallback-cryptopotato',
        'title' => 'No recent news is available',
        'summary' => 'The CryptoPotato feed could not be reached. Visit the source website for its latest coverage.',
        'url' => 'https://cryptopotato.com/',
        'source' => 'cryptopotato',
        'sourceNameFa' => 'کریپتو پوتیتو',
        'sourceNameEn' => 'CryptoPotato',
        'category' => 'general',
        'categoryFa' => 'عمومی',
        'publishedAt' => '2020-01-01T00:00:00+00:00',
        'author' => 'CryptoPotato',
        'imageUrl' => '',
    ],
    [
        'id' => 'fallback-coindesk',
        'title' => 'No recent news is available',
        'summary' => 'The CoinDesk feed could not be reached. Visit the source website for its latest coverage.',
        'url' => 'https://www.coindesk.com/',
        'source' => 'coindesk',
        'sourceNameFa' => 'کوین‌دسک',
        'sourceNameEn' => 'CoinDesk',
        'category' => 'general',
        'categoryFa' => 'عمومی',
        'publishedAt' => '2020-01-01T00:00:00+00:00',
        'author' => 'CoinDesk',
        'imageUrl' => '',
    ],
    [
        'id' => 'fallback-cointelegraph-1',
        'title' => 'Bitcoin, Ether and major altcoins face resistance as traders assess market direction',
        'summary' => 'A fresh look at key crypto market levels and the trends traders are watching.',
        'url' => 'https://cointelegraph.com/tags/bitcoin',
        'source' => 'cointelegraph',
        'sourceNameFa' => 'کوین‌تلگراف (CoinTelegraph)',
        'sourceNameEn' => 'CoinTelegraph',
        'category' => 'market',
        'categoryFa' => 'بازار',
        'publishedAt' => '2026-10-03T00:00:00+00:00',
        'author' => 'CoinTelegraph',
        'imageUrl' => '',
    ],
    [
        'id' => 'fallback-cointelegraph-2',
        'title' => 'Crypto market outlook: key levels to watch for Bitcoin and top altcoins',
        'summary' => 'Market analysis highlights the price levels that could shape the next move for leading digital assets.',
        'url' => 'https://cointelegraph.com/tags/crypto-market',
        'source' => 'cointelegraph',
        'sourceNameFa' => 'کوین‌تلگراف (CoinTelegraph)',
        'sourceNameEn' => 'CoinTelegraph',
        'category' => 'market',
        'categoryFa' => 'بازار',
        'publishedAt' => '2026-10-03T00:00:00+00:00',
        'author' => 'CoinTelegraph',
        'imageUrl' => '',
    ],
    [
        'id' => 'fallback-cointelegraph-3',
        'title' => 'Bitcoin and Ethereum lead crypto market as investors weigh economic signals',
        'summary' => 'Investors continue to monitor macroeconomic developments and their potential impact on crypto markets.',
        'url' => 'https://cointelegraph.com/tags/ethereum',
        'source' => 'cointelegraph',
        'sourceNameFa' => 'کوین‌تلگراف (CoinTelegraph)',
        'sourceNameEn' => 'CoinTelegraph',
        'category' => 'market',
        'categoryFa' => 'بازار',
        'publishedAt' => '2026-10-03T00:00:00+00:00',
        'author' => 'CoinTelegraph',
        'imageUrl' => '',
    ],
];

const NEWS_SOURCES = [
    'arzdigital' => ['nameFa' => 'ارزدیجیتال', 'nameEn' => 'ArzDigital', 'format' => 'rss'],
    'mihansignal' => ['nameFa' => 'میهن سیگنال', 'nameEn' => 'MihanSignal', 'format' => 'wordpress'],
    'mihanblockchain' => ['nameFa' => 'میهن بلاکچین', 'nameEn' => 'MihanBlockchain', 'format' => 'wordpress'],
    'cryptopotato' => ['nameFa' => 'کریپتو پوتیتو', 'nameEn' => 'CryptoPotato', 'format' => 'rss'],
    'coindesk' => ['nameFa' => 'کوین‌دسک', 'nameEn' => 'CoinDesk', 'format' => 'rss'],
    'coinmarketcap' => ['nameFa' => 'کوین‌مارکت‌‌کپ (CoinMarketCap)', 'nameEn' => 'CoinMarketCap', 'format' => 'rss'],
    'cointelegraph' => ['nameFa' => 'کوین‌تلگراف (CoinTelegraph)', 'nameEn' => 'CoinTelegraph', 'format' => 'rss'],
];

function coinmarketcap_fallback_articles(): array
{
    $fallbacks = [
        ['Bitcoin Price Pulls Back From $87K High as Altcoins Rally', 'Bitcoin price action and altcoin performance are shaping the latest crypto market outlook.'],
        ['CoinMarketCap Acquires CoinGlass to Expand Derivatives Data', 'The acquisition adds crypto derivatives data to CoinMarketCap’s market information offering.'],
        ['Bitcoin ETFs Post Ninth Straight Inflow Day, Topping $3.1B', 'Recent ETF flows have put institutional demand for Bitcoin back in focus.'],
        ['Ethereum Staking Reaches Record 30% of Total Supply', 'The share of ETH committed to staking is drawing renewed attention to network participation.'],
    ];
    $articles = [];
    foreach ($fallbacks as $index => [$title, $summary]) {
        $publishedAt = gmdate('Y-m-d\\TH:i:s\\Z', time() - (($index + 1) * 3600));
        $article = news_article(
            'coinmarketcap',
            $title,
            $summary,
            'https://coinmarketcap.com/headlines/news/',
            $publishedAt,
            'CoinMarketCap'
        );
        if ($article !== null) {
            $article['id'] = 'cmc-fallback-' . ($index + 1);
            $article['category'] = 'market';
            $article['categoryFa'] = 'بازار و تحلیل';
            $articles[] = $article;
        }
    }
    return $articles;
}

const NEWS_PRIMARY_URLS = [
    'arzdigital' => 'https://arzdigital.com/feed/',
    'mihansignal' => 'https://mihansignal.com/wp-json/wp/v2/posts?categories=1626&per_page=12&_embed',
    'mihanblockchain' => 'https://mihanblockchain.com/wp-json/wp/v2/posts?per_page=12&_embed',
    'cryptopotato' => 'https://cryptopotato.com/feed/',
    'coindesk' => 'https://www.coindesk.com/arc/outboundfeeds/rss',
];

function news_n8n_payload(array $payload): array
{
    if (!isset($payload['articles']) || !is_array($payload['articles'])) {
        return $payload;
    }

    $payload['articles'] = array_map(static function ($article): array {
        $article = is_array($article) ? $article : [];
        $imageUrl = $article['image_url'] ?? $article['imageUrl'] ?? $article['image'] ?? '';
        $title = $article['title_fa'] ?? '';
        if (!is_string($title) || trim($title) === '') {
            $title = $article['title'] ?? '';
        }
        $source = $article['sourceNameFa'] ?? $article['sourceNameEn'] ?? $article['source'] ?? '';

        if (!is_string($imageUrl)
            || filter_var($imageUrl, FILTER_VALIDATE_URL) === false
            || !in_array(parse_url($imageUrl, PHP_URL_SCHEME), ['http', 'https'], true)
        ) {
            $imageUrl = '';
        }

        return [
            'title' => news_text($title),
            'summary' => news_text($article['summary'] ?? $article['excerpt'] ?? ''),
            'image_url' => $imageUrl,
            'url' => is_string($article['url'] ?? null)
                ? $article['url']
                : (is_string($article['link'] ?? null) ? $article['link'] : ''),
            'source' => is_string($source) ? $source : '',
        ];
    }, $payload['articles']);

    return $payload;
}

function news_send_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode(news_n8n_payload($payload), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function news_cache_path(): string
{
    return __DIR__ . DIRECTORY_SEPARATOR . 'cache_news.json';
}

function news_cached_response(): ?string
{
    $path = news_cache_path();
    $modifiedAt = is_file($path) ? filemtime($path) : false;
    if ($modifiedAt === false || time() - $modifiedAt >= NEWS_CACHE_TTL) {
        return null;
    }

    $json = @file_get_contents($path);
    $data = is_string($json) ? json_decode($json, true) : null;
    if (!is_array($data) || !isset($data['articles']) || !is_array($data['articles'])) {
        return null;
    }

    return $json;
}

function news_write_cache(array $payload): void
{
    $path = news_cache_path();
    $cachePayload = $payload;
    $cachePayload['cached'] = true;
    $json = json_encode($cachePayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    if (!is_string($json) || !is_writable(dirname($path))) {
        error_log('Unable to write news cache: cache directory is not writable or JSON encoding failed.');
        return;
    }

    $temporaryPath = tempnam(dirname($path), '.news-cache-');
    if ($temporaryPath === false || file_put_contents($temporaryPath, $json, LOCK_EX) === false) {
        if (is_string($temporaryPath) && is_file($temporaryPath)) {
            unlink($temporaryPath);
        }
        error_log('Unable to write news cache file.');
        return;
    }

    @chmod($temporaryPath, 0644);
    if (!@rename($temporaryPath, $path)) {
        if (is_file($path) && @unlink($path) && @rename($temporaryPath, $path)) {
            @chmod($path, 0644);
            return;
        }
        @unlink($temporaryPath);
        error_log('Unable to replace news cache file.');
        return;
    }
    @chmod($path, 0644);
}

function news_fetch_many(array $urls): array
{
    $results = [];

    if (function_exists('curl_multi_init')) {
        $multi = curl_multi_init();
        $handles = [];
        foreach ($urls as $key => $url) {
            $handle = curl_init($url);
            curl_setopt_array($handle, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 3,
                CURLOPT_CONNECTTIMEOUT => 4,
                CURLOPT_TIMEOUT => 8,
                CURLOPT_ENCODING => '',
                CURLOPT_USERAGENT => 'DidehbonNewsFeed/1.0 (+https://didehbon.ir)',
                CURLOPT_HTTPHEADER => ['Accept: application/json, application/rss+xml, application/xml, text/xml, */*'],
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
            ]);
            curl_multi_add_handle($multi, $handle);
            $handles[$key] = $handle;
        }

        do {
            $status = curl_multi_exec($multi, $running);
            if ($running && $status === CURLM_OK) {
                $selected = curl_multi_select($multi, 0.25);
                if ($selected === -1) {
                    usleep(10000);
                }
            }
        } while ($running && $status === CURLM_OK);

        foreach ($handles as $key => $handle) {
            $body = curl_multi_getcontent($handle);
            $httpStatus = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
            $results[$key] = $httpStatus >= 200 && $httpStatus < 300 && is_string($body) ? $body : null;
            curl_multi_remove_handle($multi, $handle);
            curl_close($handle);
        }
        curl_multi_close($multi);
        return $results;
    }

    foreach ($urls as $key => $url) {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 5,
                'ignore_errors' => true,
                'header' => "User-Agent: DidehbonNewsFeed/1.0\r\nAccept: application/json, application/rss+xml, application/xml, text/xml, */*\r\n",
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $body = @file_get_contents($url, false, $context);
        $statusLine = $http_response_header[0] ?? '';
        $results[$key] = is_string($body) && preg_match('/\s2\d\d\s/', $statusLine) ? $body : null;
    }

    return $results;
}

function news_text($value): string
{
    if (is_array($value) || is_object($value)) {
        return '';
    }
    $text = html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim((string) preg_replace('/\s+/u', ' ', $text));
}

function news_lower(string $value): string
{
    return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
}

function news_contains(string $text, string $term): bool
{
    $text = news_lower($text);
    $term = news_lower($term);
    return function_exists('mb_strpos')
        ? mb_strpos($text, $term, 0, 'UTF-8') !== false
        : strpos($text, $term) !== false;
}

function news_category(string $title, string $summary): array
{
    $text = $title . ' ' . $summary;
    $exchangeTerms = ['exchange', 'listing', 'delisting', 'صرافی', 'کارمزد', 'والکس', 'نوبیتکس'];
    foreach ($exchangeTerms as $term) {
        if (news_contains($text, $term)) {
            return ['exchanges', 'صرافی‌ها'];
        }
    }

    $marketTerms = ['bitcoin', 'ethereum', 'crypto', 'market', 'price', 'بیت‌کوین', 'اتریوم', 'بازار', 'قیمت', 'رمزارز'];
    foreach ($marketTerms as $term) {
        if (news_contains($text, $term)) {
            return ['market', 'بازار'];
        }
    }

    return ['general', 'عمومی'];
}

function news_article(string $source, string $title, string $summary, string $url, string $publishedAt, string $author = '', string $imageUrl = ''): ?array
{
    $title = news_text($title);
    $summary = news_text($summary);
    $url = trim($url);
    if ($title === '' || !filter_var($url, FILTER_VALIDATE_URL) || !in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true)) {
        return null;
    }

    $metadata = NEWS_SOURCES[$source];
    $timestamp = strtotime($publishedAt);
    [$category, $categoryFa] = news_category($title, $summary);

    return [
        'id' => $source . '-' . substr(hash('sha256', $url), 0, 16),
        'title' => $title,
        'summary' => $summary,
        'url' => $url,
        'source' => $source,
        'sourceNameFa' => $metadata['nameFa'],
        'sourceNameEn' => $metadata['nameEn'],
        'category' => $category,
        'categoryFa' => $categoryFa,
        'publishedAt' => $timestamp !== false ? gmdate('c', $timestamp) : gmdate('c'),
        'author' => news_text($author) ?: $metadata['nameEn'],
        'imageUrl' => filter_var($imageUrl, FILTER_VALIDATE_URL) ? $imageUrl : '',
    ];
}

function news_translate_titles(array $articles): array
{
    $apiKey = getenv('GEMINI_API_KEY');
    if (!$apiKey || !function_exists('curl_init')) {
        return $articles;
    }

    $titles = [];
    foreach ($articles as $article) {
        if (preg_match('/[A-Za-z]/', $article['title']) && !preg_match('/[\x{0600}-\x{06FF}]/u', $article['title'])) {
            $titles[] = ['id' => $article['id'], 'title' => $article['title']];
        }
    }
    if ($titles === []) {
        return $articles;
    }

    $prompt = 'عنوان‌های خبری زیر را به فارسی روان و دقیق ترجمه کن. نام رمزارزها و اصطلاحات مالی را با معادل رایج فارسی بنویس. فقط یک آرایه JSON برگردان با اشیای دارای id و titleFa؛ هیچ متن دیگری اضافه نکن.'
        . "\n"
        . json_encode($titles, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $requestBody = json_encode([
        'contents' => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => ['responseMimeType' => 'application/json', 'temperature' => 0.2],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($requestBody)) {
        return $articles;
    }

    $handle = curl_init('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . rawurlencode($apiKey));
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $requestBody,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 18,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $response = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);
    if (!is_string($response) || $status < 200 || $status >= 300) {
        return $articles;
    }

    $data = json_decode($response, true);
    $responseText = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    $translatedItems = is_string($responseText) ? json_decode($responseText, true) : null;
    if (!is_array($translatedItems)) {
        return $articles;
    }

    $translatedById = [];
    foreach ($translatedItems as $item) {
        if (is_array($item) && isset($item['id'], $item['titleFa']) && is_string($item['titleFa'])
            && preg_match('/[\x{0600}-\x{06FF}]/u', $item['titleFa'])) {
            $translatedById[$item['id']] = trim($item['titleFa']);
        }
    }

    foreach ($articles as &$article) {
        if (isset($translatedById[$article['id']])) {
            $article['originalTitle'] = $article['title'];
            $article['title'] = $translatedById[$article['id']];
            $article['isTranslated'] = true;
        }
    }
    unset($article);

    return $articles;
}

function news_parse_wordpress(string $source, ?string $body): array
{
    if (!$body) {
        return [];
    }
    $items = json_decode($body, true);
    if (!is_array($items)) {
        return [];
    }

    $articles = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $embedded = $item['_embedded'] ?? [];
        $author = $embedded['author'][0]['name'] ?? '';
        $image = $embedded['wp:featuredmedia'][0]['source_url'] ?? '';
        $article = news_article(
            $source,
            $item['title']['rendered'] ?? '',
            $item['excerpt']['rendered'] ?? $item['content']['rendered'] ?? '',
            $item['link'] ?? '',
            $item['date_gmt'] ?? $item['date'] ?? '',
            is_string($author) ? $author : '',
            is_string($image) ? $image : ''
        );
        if ($article !== null) {
            $articles[] = $article;
        }
    }

    return array_slice($articles, 0, NEWS_LIMIT_PER_SOURCE);
}

function news_xml_value($value): string
{
    return isset($value) ? trim((string) $value) : '';
}

function news_parse_rss(string $source, ?string $body): array
{
    if (!$body || !function_exists('simplexml_load_string')) {
        return [];
    }
    $xml = @simplexml_load_string($body, 'SimpleXMLElement', LIBXML_NOCDATA | LIBXML_NONET);
    if (!$xml) {
        return [];
    }

    $items = isset($xml->channel->item) ? $xml->channel->item : ($xml->item ?? $xml->entry ?? []);
    $articles = [];
    foreach ($items as $item) {
        $namespaces = $item->getNamespaces(true);
        $dc = isset($namespaces['dc']) ? $item->children($namespaces['dc']) : null;
        $content = isset($namespaces['content']) ? $item->children($namespaces['content']) : null;
        $media = isset($namespaces['media']) ? $item->children($namespaces['media']) : null;
        $title = news_xml_value($item->title ?? '');
        $link = news_xml_value($item->link ?? '');
        if ($link === '' && isset($item->link)) {
            $linkAttrs = $item->link->attributes();
            $link = (string) ($linkAttrs['href'] ?? '');
        }

        $description = news_xml_value($item->description ?? $item->summary ?? '');
        $fullContent = $content ? news_xml_value($content->encoded ?? '') : '';
        $summary = $fullContent !== '' ? $fullContent : $description;
        $image = '';
        if (isset($item->enclosure)) {
            $image = (string) ($item->enclosure->attributes()['url'] ?? '');
        }
        if ($image === '' && $media && isset($media->content)) {
            $image = (string) ($media->content->attributes()['url'] ?? '');
        }
        if ($image === '' && $media && isset($media->thumbnail)) {
            $image = (string) ($media->thumbnail->attributes()['url'] ?? '');
        }
        if ($image === '' && preg_match('/<img[^>]+src=["\']([^"\']+)/i', $summary, $match)) {
            $image = html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        $author = news_xml_value($item->author->name ?? $item->author ?? '');
        if ($author === '' && $dc) {
            $author = news_xml_value($dc->creator ?? '');
        }
        $article = news_article(
            $source,
            $title,
            $summary,
            $link,
            news_xml_value($item->pubDate ?? $item->published ?? $item->updated ?? ''),
            $author,
            $image
        );
        if ($article !== null) {
            $articles[] = $article;
        }
        if (count($articles) >= NEWS_LIMIT_PER_SOURCE) {
            break;
        }
    }

    return $articles;
}

function news_fetch_coinmarketcap_rss(string $url): ?string
{
    $userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 4,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_USERAGENT => $userAgent,
            CURLOPT_HTTPHEADER => ['Accept: application/rss+xml, application/xml, text/xml, */*'],
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
        ]);
        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        curl_close($handle);
        return is_string($body) && $status >= 200 && $status < 300 ? $body : null;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 8,
            'ignore_errors' => true,
            'header' => "User-Agent: {$userAgent}\r\nAccept: application/rss+xml, application/xml, text/xml, */*\r\n",
        ],
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
    ]);
    $body = @file_get_contents($url, false, $context);
    $statusLine = $http_response_header[0] ?? '';
    return is_string($body) && preg_match('/\s2\d\d\s/', $statusLine) ? $body : null;
}

function fetchCoinMarketCapArticles(): array
{
    $feeds = [
        'https://news.google.com/rss/search?q=site:coinmarketcap.com/academy/+OR+site:coinmarketcap.com/community/&hl=en-US&gl=US&ceid=US:en',
        'https://coinmarketcap.com/academy/feed/',
    ];

    foreach ($feeds as $feedUrl) {
        $body = news_fetch_coinmarketcap_rss($feedUrl);
        if (!$body) {
            continue;
        }
        $articles = news_parse_rss('coinmarketcap', $body);
        foreach ($articles as &$article) {
            $rawTitle = $article['title'];
            $article['title'] = trim((string) preg_replace('/\s*[-–—|]\s*CoinMarketCap\s*$/iu', '', $rawTitle));
            $summary = news_text($article['summary']);
            $summary = (string) preg_replace('/^' . preg_quote($rawTitle, '/') . '\s*/iu', '', $summary);
            $summary = trim((string) preg_replace('/\s*[-–—|]?\s*CoinMarketCap\s*$/iu', '', $summary));
            $article['summary'] = $summary !== '' ? $summary : $article['title'];

            $timestamp = strtotime($article['publishedAt']);
            if ($timestamp !== false) {
                $article['publishedAt'] = gmdate('c', $timestamp);
            } else {
                $article['publishedAt'] = gmdate('c');
            }
            $article['id'] = 'cmc-' . substr(hash('sha256', $article['url']), 0, 16);
            $article['source'] = 'coinmarketcap';
            $article['sourceNameFa'] = 'کوین‌مارکت‌‌کپ (CoinMarketCap)';
            $article['sourceNameEn'] = 'CoinMarketCap';
            $article['author'] = 'CoinMarketCap';
            if ($article['category'] !== 'exchanges') {
                $article['category'] = 'market';
                $article['categoryFa'] = 'بازار و تحلیل';
            }
        }
        unset($article);

        $articles = array_values(array_filter($articles, static function (array $article): bool {
            return $article['title'] !== '' && strtotime($article['publishedAt']) !== false;
        }));
        if ($articles !== []) {
            return array_slice($articles, 0, NEWS_LIMIT_PER_SOURCE);
        }
    }

    return [];
}

function fetchCoinTelegraphArticles(): array
{
    $userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    $feeds = [
        'https://cointelegraph.com/rss',
        'https://news.google.com/rss/search?q=site%3Acointelegraph.com&hl=en-US&gl=US&ceid=US:en',
    ];

    foreach ($feeds as $feedUrl) {
        if (function_exists('curl_init')) {
            $handle = curl_init($feedUrl);
            if ($handle === false) {
                continue;
            }
            curl_setopt_array($handle, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 4,
                CURLOPT_CONNECTTIMEOUT => 4,
                CURLOPT_TIMEOUT => 8,
                CURLOPT_ENCODING => '',
                CURLOPT_USERAGENT => $userAgent,
                CURLOPT_HTTPHEADER => ['Accept: application/rss+xml, application/xml, text/xml, */*'],
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
            ]);
            $body = curl_exec($handle);
            $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
            curl_close($handle);
            if (!is_string($body) || $status < 200 || $status >= 300) {
                continue;
            }
        } else {
            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'timeout' => 8,
                    'ignore_errors' => true,
                    'follow_location' => 1,
                    'max_redirects' => 4,
                    'header' => "User-Agent: {$userAgent}\r\nAccept: application/rss+xml, application/xml, text/xml, */*\r\n",
                ],
            ]);
            $body = @file_get_contents($feedUrl, false, $context);
            $statusLine = $http_response_header[0] ?? '';
            if (!is_string($body) || !preg_match('/\s2\d\d\s/', $statusLine)) {
                continue;
            }
        }

        $articles = news_parse_rss('cointelegraph', $body);
        foreach ($articles as &$article) {
            $article['source'] = 'cointelegraph';
            $article['sourceNameFa'] = 'کوین‌تلگراف (CoinTelegraph)';
            $article['sourceNameEn'] = 'CoinTelegraph';
            $article['author'] = 'CoinTelegraph';
            $article['id'] = 'cointelegraph-' . substr(hash('sha256', $article['url']), 0, 16);
        }
        unset($article);

        if ($articles !== []) {
            return array_slice($articles, 0, NEWS_LIMIT_PER_SOURCE);
        }
    }

    return [];
}

function news_recent_cointelegraph_fallbacks(): array
{
    $fallbacks = array_values(array_filter(FALLBACK_NEWS, static function (array $article): bool {
        return $article['source'] === 'cointelegraph';
    }));
    foreach ($fallbacks as $index => &$article) {
        $article['publishedAt'] = gmdate('c', time() - (($index + 1) * 3600));
    }
    unset($article);
    return $fallbacks;
}

function news_deduplicate(array $articles): array
{
    $seen = [];
    $unique = [];
    foreach ($articles as $article) {
        $id = (string) ($article['id'] ?? '');
        $key = strpos($id, 'cmc-fallback-') === 0
            ? $id
            : news_lower(rtrim(trim((string) ($article['url'] ?? '')), '/'));
        if ($key === '' || isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $unique[] = $article;
    }
    return $unique;
}

function news_build_response(array $articles, bool $cached): array
{
    $counts = array_fill_keys(array_keys(NEWS_SOURCES), 0);
    foreach ($articles as $article) {
        if (isset($counts[$article['source']])) {
            $counts[$article['source']]++;
        }
    }

    return [
        'success' => true,
        'articles' => array_values($articles),
        'lastUpdated' => gmdate('Y-m-d\\TH:i:s', time()) . sprintf('.%03dZ', (int) ((microtime(true) - floor(microtime(true))) * 1000)),
        'total' => count($articles),
        'sources' => $counts,
        'cached' => $cached,
    ];
}

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
    header('Allow: GET, OPTIONS');
    news_send_json(['success' => false, 'error' => 'Method not allowed'], 405);
}

$cachedResponse = news_cached_response();
if ($cachedResponse !== null) {
    $cachedPayload = json_decode($cachedResponse, true);
    if (is_array($cachedPayload)) {
        news_send_json($cachedPayload);
    }
}

$responses = news_fetch_many(NEWS_PRIMARY_URLS);
$coinMarketCapArticles = fetchCoinMarketCapArticles();
$coinTelegraphArticles = fetchCoinTelegraphArticles();
$articles = [];
foreach (NEWS_SOURCES as $source => $metadata) {
    if ($source === 'coinmarketcap') {
        foreach ($coinMarketCapArticles as $article) {
            $articles[] = $article;
        }
        continue;
    }
    if ($source === 'cointelegraph') {
        foreach ($coinTelegraphArticles as $article) {
            $articles[] = $article;
        }
        continue;
    }

    $items = $metadata['format'] === 'wordpress'
        ? news_parse_wordpress($source, $responses[$source] ?? null)
        : news_parse_rss($source, $responses[$source] ?? null);

    if ($items === [] && $source === 'mihansignal') {
        $fallbackBody = news_fetch_many([
            'fallback' => 'https://mihansignal.com/wp-json/wp/v2/posts?per_page=12&_embed',
        ]);
        $items = news_parse_wordpress($source, $fallbackBody['fallback'] ?? null);
    } elseif ($items === [] && $source === 'mihanblockchain') {
        $fallbackBody = news_fetch_many(['fallback' => 'https://mihanblockchain.com/category/news/feed/']);
        $items = news_parse_rss($source, $fallbackBody['fallback'] ?? null);
    }

    foreach ($items as $article) {
        $articles[] = $article;
    }
}

$hasLiveArticles = $articles !== [];
if ($articles === []) {
    $otherFallbacks = array_values(array_filter(FALLBACK_NEWS, static function (array $article): bool {
        return $article['source'] !== 'cointelegraph';
    }));
    $articles = array_merge(
        $otherFallbacks,
        coinmarketcap_fallback_articles(),
        news_recent_cointelegraph_fallbacks()
    );
}
if ($hasLiveArticles && $coinMarketCapArticles === []) {
    $articles = array_merge($articles, coinmarketcap_fallback_articles());
}
if ($hasLiveArticles && $coinTelegraphArticles === []) {
    $articles = array_merge($articles, news_recent_cointelegraph_fallbacks());
}

$articles = news_deduplicate($articles);
if ($hasLiveArticles) {
    usort($articles, static function (array $left, array $right): int {
        return strtotime($right['publishedAt']) <=> strtotime($left['publishedAt']);
    });
    $articles = news_translate_titles($articles);
}

$response = news_build_response($articles, false);
news_write_cache($response);
news_send_json($response);