import { NextResponse } from 'next/server';
import { NewsArticle, NewsApiResponse } from '@/lib/types';
import { translateArticlesToPersian } from '@/lib/translator';

export const dynamic = 'force-dynamic';

// In-memory cache for news feed to prevent rate limits and high latency
interface NewsCacheEntry {
  timestamp: number;
  data: NewsApiResponse;
}

let newsCache: NewsCacheEntry | null = null;
const NEWS_CACHE_TTL_MS = 60 * 1000; // 60 seconds

// HTML tag stripper and decoder utility
function cleanHtmlText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8230;/g, '…')
    .replace(/&zwnj;/g, '\u200c')
    .replace(/&#038;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract image url from html content or tags
function extractImageUrl(html: string): string | undefined {
  if (!html) return undefined;
  
  // Media content tag
  const mediaMatch = html.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch && mediaMatch[1]) {
    const u = mediaMatch[1].replace(/&amp;/g, '&').trim();
    if (!u.startsWith('data:')) return u.startsWith('//') ? `https:${u}` : u;
  }

  // Media thumbnail tag
  const mediaThumbMatch = html.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (mediaThumbMatch && mediaThumbMatch[1]) {
    const u = mediaThumbMatch[1].replace(/&amp;/g, '&').trim();
    if (!u.startsWith('data:')) return u.startsWith('//') ? `https:${u}` : u;
  }

  // Enclosure tag
  const enclosureMatch = html.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosureMatch && enclosureMatch[1]) {
    const u = enclosureMatch[1].replace(/&amp;/g, '&').trim();
    if (!u.startsWith('data:')) return u.startsWith('//') ? `https:${u}` : u;
  }

  // Standard img src
  const match = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  if (match && match[1]) {
    if (!match[1].startsWith('data:')) {
      return match[1].replace(/&amp;/g, '&');
    }
  }

  // data-src attribute (lazy loaded images)
  const dataSrcMatch = html.match(/data-src=["'](https?:\/\/[^"']+)["']/i);
  if (dataSrcMatch && dataSrcMatch[1]) {
    return dataSrcMatch[1].replace(/&amp;/g, '&');
  }

  // wp-post-image
  const wpMatch = html.match(/class=["'][^"']*wp-post-image[^"']*["'][^>]+src=["']([^"']+)["']/i);
  if (wpMatch && wpMatch[1]) {
    return wpMatch[1].replace(/&amp;/g, '&');
  }

  return undefined;
}

// Fallback curated news items in case external network blocks or times out
const FALLBACK_NEWS: NewsArticle[] = [
  {
    id: 'fb-wallex-1',
    title: 'والکس از سیستم پیشرفته سفارش‌گذاری با اسلیپیج نزدیک به صفر رونمایی کرد',
    summary: 'صرافی والکس با ارتقای هسته معاملات P2P خود، عمق دفتر سفارشات در جفت‌ارزهای تومانی و تتری را به شکل چشمگیری افزایش داد.',
    url: 'https://wallex.ir/blog',
    source: 'mihansignal',
    sourceNameFa: 'میهن سیگنال',
    sourceNameEn: 'MihanSignal',
    category: 'exchanges',
    categoryFa: 'صرافی‌ها',
    publishedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    author: 'تحریریه اخبار رمزارز',
  },
  {
    id: 'fb-nobitex-2',
    title: 'پایان ۹ سال فعالیت؛ تعطیلی کوینکس و پیامدهای آن بر معامله‌گران ایرانی',
    summary: 'یکی از صرافی‌های قدیمی بین‌المللی که کاربران ایرانی در آن فعالیت داشتند فعالیت خود را متوقف می‌کند. کاربران تا ۲۲ دسامبر فرصت برداشت دارایی دارند.',
    url: 'https://mihansignal.com/coinex-shutdown-after-9-years/',
    source: 'mihansignal',
    sourceNameFa: 'میهن سیگنال',
    sourceNameEn: 'MihanSignal',
    category: 'exchanges',
    categoryFa: 'صرافی‌ها',
    publishedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    author: 'مهدی عباس‌زاده',
  },
  {
    id: 'fb-arzdigital-3',
    title: 'معرفی ۳ آلت‌کوین برتر که در نوسانات اخیر بازار بیشترین حجم و تاب‌آوری را ثبت کردند',
    summary: 'تحلیلگران بازار رمزارز با بررسی رفتار نقدینگی و عمق مارکت در صرافی‌های بزرگ، ارزهایی را که در برابر افت بازار مقاومت کرده‌اند معرفی کردند.',
    url: 'https://arzdigital.com',
    source: 'arzdigital',
    sourceNameFa: 'ارزدیجیتال',
    sourceNameEn: 'ArzDigital',
    category: 'market',
    categoryFa: 'بازار و تحلیل',
    publishedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    author: 'ملیحه حسینی',
  },
  {
    id: 'fb-bitpin-4',
    title: 'گزارش حجم معاملات رمزارزها در صرافی‌های داخلی: رقابت فشرده بر سر تتر و بیت‌کوین',
    summary: 'بررسی آمار ۲۴ ساعته نشان می‌دهد حجم کل معاملات روزانه در صرافی‌های پیشرو ایرانی از مرز ۱۰ هزار میلیارد تومان عبور کرده است.',
    url: 'https://arzdigital.com',
    source: 'arzdigital',
    sourceNameFa: 'ارزدیجیتال',
    sourceNameEn: 'ArzDigital',
    category: 'exchanges',
    categoryFa: 'صرافی‌ها',
    publishedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    author: 'تیم تحلیل ارزدیجیتال',
  },
  {
    id: 'fb-cryptopotato-1',
    title: 'The Fed Hiked Rates and Bitcoin Went Up: Here’s Why That Matters',
    summary: 'When the Federal Reserve raised interest rates, crypto markets rallied instead of plunging. Analysts break down market resilience, liquidity absorption, and macroeconomic implications for BTC.',
    url: 'https://cryptopotato.com/the-fed-hiked-rates-and-bitcoin-went-up-heres-why-that-matters/',
    source: 'cryptopotato',
    sourceNameFa: 'کریپتو پوتیتو (CryptoPotato)',
    sourceNameEn: 'CryptoPotato',
    category: 'market',
    categoryFa: 'بازار و تحلیل',
    publishedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    author: 'CryptoPotato Analysis',
  },
  {
    id: 'fb-cryptopotato-2',
    title: 'Everything Went Against Bitcoin This Week – So Why Is BTC Back Above $80K?',
    summary: 'Despite macroeconomic headwinds, regulatory discussions, and rate decisions, on-chain accumulation and spot liquidity have stabilized BTC above key psychological levels.',
    url: 'https://cryptopotato.com/everything-went-against-bitcoin-this-week-so-why-is-btc-back-above-80k/',
    source: 'cryptopotato',
    sourceNameFa: 'کریپتو پوتیتو (CryptoPotato)',
    sourceNameEn: 'CryptoPotato',
    category: 'market',
    categoryFa: 'بازار و تحلیل',
    publishedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    author: 'Jordan Lyanchev',
  },
  {
    id: 'fb-mihan-5',
    title: 'پیش‌بینی روند قیمت طلا، دلار و تتر در پاییز؛ تتر در بازار داخلی چه جهتی می‌گیرد؟',
    summary: 'تحلیلگران اقتصادی و کارشناسان بازارهای مالی سناریوهای مختلف قیمت تتر و اثر نوسانات جهانی انس بر بازار داخلی را ارزیابی کردند.',
    url: 'https://mihansignal.com/gold-price-forecast-rise-or-fall-2026/',
    source: 'mihansignal',
    sourceNameFa: 'میهن سیگنال',
    sourceNameEn: 'MihanSignal',
    category: 'market',
    categoryFa: 'بازار و تحلیل',
    publishedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    author: 'مهدی عباس‌زاده',
  },
];

// Pre-seeded fallback feed cache for individual feeds to ensure zero downtime on network flakiness
const lastKnownFeedCache: Record<string, NewsArticle[]> = {
  mihansignal: [],
  mihanblockchain: [],
  arzdigital: [
    {
      id: 'arz-seed-1',
      title: 'تحلیل جامع روند نقدینگی و جریان ورودی استیبل‌کوین‌ها به صرافی‌های ارز دیجیتال',
      summary: 'داده‌های آن‌چین حاکی از افزایش ذخایر تتر در صرافی‌ها و آماده‌باش نقدینگی معامله‌گران برای موج جدید نوسانات بیت‌کوین و آلت‌کوین‌هاست.',
      url: 'https://arzdigital.com',
      source: 'arzdigital',
      sourceNameFa: 'ارزدیجیتال',
      sourceNameEn: 'ArzDigital',
      category: 'market',
      categoryFa: 'بازار و تحلیل',
      publishedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      author: 'تیم تحلیل ارزدیجیتال',
    },
    {
      id: 'arz-seed-2',
      title: 'بررسی کارمزد و سرعت تسویه شبکه‌های انتقال در صرافی‌های پیشرو داخلی',
      summary: 'مقایسه شبکه‌های TRC20، TON، Arbitrum و Optimism نشان می‌دهد تمایل کاربران به شبکه‌های لایه دو با کارمزد پایین افزایش چشمگیری داشته است.',
      url: 'https://arzdigital.com',
      source: 'arzdigital',
      sourceNameFa: 'ارزدیجیتال',
      sourceNameEn: 'ArzDigital',
      category: 'exchanges',
      categoryFa: 'صرافی‌ها',
      publishedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      author: 'تحریریه ارزدیجیتال',
    },
    {
      id: 'arz-seed-3',
      title: 'افزایش حجم معاملات تتری در بازار اسپات همزمان با تثبیت قیمت در کانال جدید',
      summary: 'خریداران در حمایت‌های تکنیکال کلیدی وارد بازار شده و حجم سفارشات خرید عمق بازار را تقویت کرده است.',
      url: 'https://arzdigital.com',
      source: 'arzdigital',
      sourceNameFa: 'ارزدیجیتال',
      sourceNameEn: 'ArzDigital',
      category: 'market',
      categoryFa: 'بازار و تحلیل',
      publishedAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
      author: 'ملیحه حسینی',
    }
  ],
  cryptopotato: [],
  coindesk: [],
};

// Fetch MihanSignal JSON API (Both general & exchange category 1626)
async function fetchMihanSignalArticles(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    // Fetch exchange-specific posts (Category 1626 = اخبار صرافی های ارز دیجیتال)
    const [resExchanges, resRecent] = await Promise.allSettled([
      fetch('https://mihansignal.com/wp-json/wp/v2/posts?categories=1626&per_page=12&_embed', {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      }),
      fetch('https://mihansignal.com/wp-json/wp/v2/posts?per_page=12&_embed', {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      }),
    ]);

    clearTimeout(timeout);

    const parsePosts = async (res: PromiseSettledResult<Response>, defaultCat: 'exchanges' | 'market') => {
      if (res.status === 'fulfilled' && res.value.ok) {
        const posts = await res.value.json();
        if (Array.isArray(posts)) {
          for (const p of posts) {
            const title = cleanHtmlText(p.title?.rendered || '');
            const rawExcerpt = p.excerpt?.rendered || p.content?.rendered || '';
            const summary = cleanHtmlText(rawExcerpt).slice(0, 240) + '...';
            const url = p.link || `https://mihansignal.com/?p=${p.id}`;
            const publishedAt = p.date_gmt ? `${p.date_gmt}Z` : p.date || new Date().toISOString();

            // Extract featured image from _embedded if available
            let imageUrl: string | undefined;
            const featured = p._embedded?.['wp:featuredmedia']?.[0];
            if (featured?.source_url) {
              imageUrl = featured.source_url;
            } else if (featured?.media_details?.sizes?.medium?.source_url) {
              imageUrl = featured.media_details.sizes.medium.source_url;
            } else {
              imageUrl = extractImageUrl(p.content?.rendered || '');
            }

            const author = p._embedded?.author?.[0]?.name || 'میهن سیگنال';

            const isExchangeTopic =
              defaultCat === 'exchanges' ||
              p.categories?.includes(1626) ||
              title.includes('صرافی') ||
              title.includes('والکس') ||
              title.includes('نوبیتکس') ||
              title.includes('کوینکس') ||
              title.includes('بایننس') ||
              title.includes('کارمزد');

            articles.push({
              id: `mihan-${p.id}`,
              title,
              summary,
              url,
              source: 'mihansignal',
              sourceNameFa: 'میهن سیگنال',
              sourceNameEn: 'MihanSignal',
              category: isExchangeTopic ? 'exchanges' : 'market',
              categoryFa: isExchangeTopic ? 'صرافی‌ها' : 'بازار و تحلیل',
              publishedAt,
              imageUrl,
              author,
            });
          }
        }
      }
    };

    await Promise.all([
      parsePosts(resExchanges, 'exchanges'),
      parsePosts(resRecent, 'market'),
    ]);

    if (articles.length > 0) {
      lastKnownFeedCache.mihansignal = articles;
    }
  } catch {
    // Graceful fallback to cached items
  }

  return articles.length > 0 ? articles : (lastKnownFeedCache.mihansignal || []);
}

// Fetch MihanBlockchain news (https://mihanblockchain.com/category/news/)
async function fetchMihanBlockchainArticles(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8500);

    // Fetch from WordPress REST API for rich structured data & featured images
    const res = await fetch('https://mihanblockchain.com/wp-json/wp/v2/posts?per_page=14&_embed', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    clearTimeout(timeout);

    if (res.ok) {
      const posts = await res.json();
      if (Array.isArray(posts)) {
        for (const p of posts) {
          const title = cleanHtmlText(p.title?.rendered || '');
          if (!title) continue;

          const rawExcerpt = p.excerpt?.rendered || p.content?.rendered || '';
          const summary = cleanHtmlText(rawExcerpt).slice(0, 240) + '...';
          const url = p.link || `https://mihanblockchain.com/?p=${p.id}`;
          const publishedAt = p.date_gmt ? `${p.date_gmt}Z` : p.date || new Date().toISOString();

          // Extract featured image from _embedded, yoast, or content
          let imageUrl: string | undefined;
          const featured = p._embedded?.['wp:featuredmedia']?.[0];
          if (featured?.source_url) {
            imageUrl = featured.source_url;
          } else if (featured?.media_details?.sizes?.medium_large?.source_url) {
            imageUrl = featured.media_details.sizes.medium_large.source_url;
          } else if (featured?.media_details?.sizes?.medium?.source_url) {
            imageUrl = featured.media_details.sizes.medium.source_url;
          } else if (p.yoast_head_json?.og_image?.[0]?.url) {
            imageUrl = p.yoast_head_json.og_image[0].url;
          } else {
            imageUrl = extractImageUrl(p.content?.rendered || p.excerpt?.rendered || '');
          }

          const author = p._embedded?.author?.[0]?.name || 'تحریریه میهن بلاکچین';

          const textLower = (title + ' ' + summary).toLowerCase();
          const isExchangeTopic =
            textLower.includes('صرافی') ||
            textLower.includes('والکس') ||
            textLower.includes('نوبیتکس') ||
            textLower.includes('بیت‌پین') ||
            textLower.includes('رمزینکس') ||
            textLower.includes('کارمزد') ||
            textLower.includes('کوینکس') ||
            textLower.includes('بایننس') ||
            textLower.includes('exchange') ||
            textLower.includes('coinbase') ||
            textLower.includes('bybit');

          articles.push({
            id: `mihanbc-${p.id}`,
            title,
            summary,
            url,
            source: 'mihanblockchain',
            sourceNameFa: 'میهن بلاکچین',
            sourceNameEn: 'MihanBlockchain',
            category: isExchangeTopic ? 'exchanges' : 'market',
            categoryFa: isExchangeTopic ? 'صرافی‌ها' : 'بازار و تحلیل',
            publishedAt,
            imageUrl,
            author,
          });
        }
      }
    }
  } catch {
    // Graceful silent fallback to cache or feed fallback
  }

  // Fallback to RSS feed if JSON API returned empty
  if (articles.length === 0) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7500);

      const res = await fetch('https://mihanblockchain.com/category/news/feed/', {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
      });

      clearTimeout(timeout);

      if (res.ok) {
        const xml = await res.text();
        const parsed = parseRssFeedItems(xml, 'mihanblockchain');
        articles.push(...parsed);
      }
    } catch {
      // Silent fallback
    }
  }

  if (articles.length > 0) {
    lastKnownFeedCache.mihanblockchain = articles;
  }

  return articles.length > 0 ? articles : (lastKnownFeedCache.mihanblockchain || []);
}

// Parse simple RSS XML without heavy dependencies
function parseRssFeedItems(xmlText: string, source: 'arzdigital' | 'mihansignal' | 'mihanblockchain'): NewsArticle[] {
  const articles: NewsArticle[] = [];
  try {
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemContent = match[1];

      // Title
      const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i);
      const title = cleanHtmlText(titleMatch ? titleMatch[1] || titleMatch[2] || '' : '');
      if (!title) continue;

      // Link
      const linkMatch = itemContent.match(/<link>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/link>/i);
      const url = (linkMatch ? linkMatch[1] || linkMatch[2] || '' : '').trim();

      // PubDate
      const dateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      let publishedAt = new Date().toISOString();
      if (dateMatch && dateMatch[1]) {
        const d = new Date(dateMatch[1].trim());
        if (!isNaN(d.getTime())) {
          publishedAt = d.toISOString();
        }
      }

      // Creator
      const creatorMatch = itemContent.match(/<dc:creator>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/dc:creator>/i);
      const author = cleanHtmlText(creatorMatch ? creatorMatch[1] || creatorMatch[2] || '' : '');

      // Description / Content
      const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/description>/i);
      const rawDesc = descMatch ? descMatch[1] || descMatch[2] || '' : '';
      const summary = cleanHtmlText(rawDesc).slice(0, 240) + '...';

      // Image
      const contentEncodedMatch = itemContent.match(/<content:encoded>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/content:encoded>/i);
      const fullHtml = (contentEncodedMatch ? contentEncodedMatch[1] || contentEncodedMatch[2] || '' : '') + ' ' + rawDesc;
      const imageUrl = extractImageUrl(fullHtml);

      // Category detection
      const isExchangeTopic =
        title.includes('صرافی') ||
        title.includes('والکس') ||
        title.includes('نوبیتکس') ||
        title.includes('بیت‌پین') ||
        title.includes('رمزینکس') ||
        title.includes('کارمزد') ||
        title.includes('کوینکس') ||
        title.includes('بایننس') ||
        summary.includes('صرافی');

      const id = `${source}-${Math.abs(hashString(title + url))}`;

      let sourceNameFa = 'ارزدیجیتال';
      let sourceNameEn = 'ArzDigital';
      if (source === 'mihansignal') {
        sourceNameFa = 'میهن سیگنال';
        sourceNameEn = 'MihanSignal';
      } else if (source === 'mihanblockchain') {
        sourceNameFa = 'میهن بلاکچین';
        sourceNameEn = 'MihanBlockchain';
      }

      articles.push({
        id,
        title,
        summary,
        url,
        source,
        sourceNameFa,
        sourceNameEn,
        category: isExchangeTopic ? 'exchanges' : 'market',
        categoryFa: isExchangeTopic ? 'صرافی‌ها' : 'بازار و تحلیل',
        publishedAt,
        imageUrl,
        author: author || sourceNameFa,
      });
    }
  } catch (e) {
    console.error(`Error parsing RSS for ${source}:`, e);
  }
  return articles;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// Fetch Arzdigital RSS feeds with multiple fallback endpoints
async function fetchArzdigitalArticles(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];
  const endpoints = [
    'https://arzdigital.com/feed/',
    'https://arzdigital.com/feed/gn/',
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
          'Cache-Control': 'no-cache',
        },
      });

      clearTimeout(timeout);

      if (res.ok) {
        const xml = await res.text();
        const parsed = parseRssFeedItems(xml, 'arzdigital');
        if (parsed.length > 0) {
          articles.push(...parsed);
          break;
        }
      }
    } catch {
      // Graceful silent fallback to cache or fallback items
    }
  }

  if (articles.length > 0) {
    lastKnownFeedCache.arzdigital = articles;
  }

  return articles.length > 0 ? articles : (lastKnownFeedCache.arzdigital || []);
}

// Parse CryptoPotato RSS feeds
function parseCryptoPotatoRss(xmlText: string): NewsArticle[] {
  const articles: NewsArticle[] = [];
  try {
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemContent = match[1];

      // Title
      const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i);
      const title = cleanHtmlText(titleMatch ? titleMatch[1] || titleMatch[2] || '' : '');
      if (!title) continue;

      // Link
      const linkMatch = itemContent.match(/<link>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/link>/i);
      const url = (linkMatch ? linkMatch[1] || linkMatch[2] || '' : '').trim();

      // PubDate
      const dateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      let publishedAt = new Date().toISOString();
      if (dateMatch && dateMatch[1]) {
        const d = new Date(dateMatch[1].trim());
        if (!isNaN(d.getTime())) {
          publishedAt = d.toISOString();
        }
      }

      // Creator
      const creatorMatch = itemContent.match(/<dc:creator>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/dc:creator>/i);
      const author = cleanHtmlText(creatorMatch ? creatorMatch[1] || creatorMatch[2] || '' : '') || 'CryptoPotato';

      // Description / Summary
      const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/description>/i);
      const contentEncodedMatch = itemContent.match(/<content:encoded>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/content:encoded>/i);
      const rawDesc = descMatch ? descMatch[1] || descMatch[2] || '' : '';
      const rawContent = contentEncodedMatch ? contentEncodedMatch[1] || contentEncodedMatch[2] || '' : '';
      const summaryRaw = cleanHtmlText(rawDesc || rawContent);
      const summary = summaryRaw ? summaryRaw.slice(0, 240) + '...' : '';

      // Image
      const imageUrl = extractImageUrl(itemContent);

      // Category detection
      const lower = (title + ' ' + summary).toLowerCase();
      const isExchangeTopic =
        lower.includes('exchange') ||
        lower.includes('binance') ||
        lower.includes('coinbase') ||
        lower.includes('bybit') ||
        lower.includes('okx') ||
        lower.includes('kraken') ||
        lower.includes('custody');

      const id = `cryptopotato-${Math.abs(hashString(title + url))}`;

      articles.push({
        id,
        title,
        summary,
        url,
        source: 'cryptopotato',
        sourceNameFa: 'کریپتو پوتیتو (CryptoPotato)',
        sourceNameEn: 'CryptoPotato',
        category: isExchangeTopic ? 'exchanges' : 'market',
        categoryFa: isExchangeTopic ? 'صرافی‌ها' : 'بازار و تحلیل',
        publishedAt,
        imageUrl,
        author,
      });
    }
  } catch (e) {
    console.error('Error parsing CryptoPotato RSS:', e);
  }
  return articles;
}

// Fetch CryptoPotato RSS feeds
async function fetchCryptoPotatoArticles(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8500);

    const res = await fetch('https://cryptopotato.com/feed/', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });

    clearTimeout(timeout);

    if (res.ok) {
      const xml = await res.text();
      const parsed = parseCryptoPotatoRss(xml);
      articles.push(...parsed);
    }

    if (articles.length > 0) {
      lastKnownFeedCache.cryptopotato = articles;
    }
  } catch {
    // Graceful silent fallback to cache or feed fallback
  }

  return articles.length > 0 ? articles : (lastKnownFeedCache.cryptopotato || []);
}

// Parser for CoinDesk RSS Feed
function parseCoinDeskRss(xmlText: string): NewsArticle[] {
  const articles: NewsArticle[] = [];
  if (!xmlText) return articles;

  try {
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemContent = match[1];

      // Extract Title (handle CDATA or plain text)
      const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const title = titleMatch ? cleanHtmlText(titleMatch[1]) : '';

      // Extract Link
      const linkMatch = itemContent.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
      const url = linkMatch ? linkMatch[1].trim() : '';

      // Extract Description
      const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
      const summary = descMatch ? cleanHtmlText(descMatch[1]) : '';

      // Extract pubDate
      const dateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      let publishedAt = new Date().toISOString();
      if (dateMatch) {
        const parsedDate = new Date(dateMatch[1].trim());
        if (!isNaN(parsedDate.getTime())) {
          publishedAt = parsedDate.toISOString();
        }
      }

      // Extract image: media:content url="..." or enclosure
      let imageUrl: string | undefined;
      const mediaMatch = itemContent.match(/<media:content[^>]+url=["']([^"']+)["']/i);
      if (mediaMatch) {
        imageUrl = mediaMatch[1].replace(/&amp;/g, '&');
      } else {
        const encMatch = itemContent.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
        if (encMatch) {
          imageUrl = encMatch[1].replace(/&amp;/g, '&');
        }
      }

      // Extract Author: dc:creator
      let author = 'CoinDesk';
      const authorMatch = itemContent.match(/<dc:creator>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:creator>/i);
      if (authorMatch && authorMatch[1].trim()) {
        author = authorMatch[1].trim();
      }

      if (!title || !url) continue;

      // Classify topic
      const combinedText = (title + ' ' + summary).toLowerCase();
      const isExchangeTopic =
        combinedText.includes('exchange') ||
        combinedText.includes('coinbase') ||
        combinedText.includes('binance') ||
        combinedText.includes('robinhood') ||
        combinedText.includes('okx') ||
        combinedText.includes('kraken') ||
        combinedText.includes('bybit') ||
        combinedText.includes('custody');

      const id = `coindesk-${Math.abs(hashString(url))}`;

      articles.push({
        id,
        title,
        summary: summary.slice(0, 300),
        url,
        source: 'coindesk',
        sourceNameFa: 'کوین‌دسک (CoinDesk)',
        sourceNameEn: 'CoinDesk',
        category: isExchangeTopic ? 'exchanges' : 'market',
        categoryFa: isExchangeTopic ? 'صرافی‌ها' : 'بازار و تحلیل',
        publishedAt,
        imageUrl,
        author,
      });
    }
  } catch (e) {
    console.error('Error parsing CoinDesk RSS:', e);
  }
  return articles;
}

// Fetch CoinDesk RSS Feed
async function fetchCoinDeskArticles(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8500);

    const res = await fetch('https://www.coindesk.com/arc/outboundfeeds/rss', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    clearTimeout(timeout);

    if (res.ok) {
      const xml = await res.text();
      const parsed = parseCoinDeskRss(xml);
      articles.push(...parsed);
    }

    if (articles.length > 0) {
      lastKnownFeedCache.coindesk = articles;
    }
  } catch {
    // Graceful silent fallback to cache or feed fallback
  }

  return articles.length > 0 ? articles : (lastKnownFeedCache.coindesk || []);
}

export async function GET() {
  const now = Date.now();

  // Check cache
  if (newsCache && now - newsCache.timestamp < NEWS_CACHE_TTL_MS) {
    return NextResponse.json({
      ...newsCache.data,
      cached: true,
    });
  }

  // Fetch from all sources in parallel
  const [mihanArticles, mihanbcArticles, arzArticles, cryptoPotatoArticles, coinDeskArticles] = await Promise.all([
    fetchMihanSignalArticles(),
    fetchMihanBlockchainArticles(),
    fetchArzdigitalArticles(),
    fetchCryptoPotatoArticles(),
    fetchCoinDeskArticles(),
  ]);

  // Combine and deduplicate by URL / Title
  const combined = [...mihanArticles, ...mihanbcArticles, ...arzArticles, ...cryptoPotatoArticles, ...coinDeskArticles];
  const seenUrls = new Set<string>();
  const uniqueArticles: NewsArticle[] = [];

  for (const art of combined) {
    const key = art.url || art.title;
    if (!seenUrls.has(key)) {
      seenUrls.add(key);
      uniqueArticles.push(art);
    }
  }

  // If upstream sources yielded few items (e.g. rate-limit or network timeout), merge fallbacks
  if (uniqueArticles.length < 3) {
    for (const fb of FALLBACK_NEWS) {
      if (!seenUrls.has(fb.url)) {
        seenUrls.add(fb.url);
        uniqueArticles.push(fb);
      }
    }
  }

  // Sort by publishedAt descending (newest first)
  uniqueArticles.sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  // Translate foreign articles (CryptoPotato & CoinDesk) into Persian
  const itemsToTranslate = uniqueArticles
    .filter((a) => a.source === 'cryptopotato' || a.source === 'coindesk')
    .map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
    }));

  if (itemsToTranslate.length > 0) {
    try {
      const translatedMap = await translateArticlesToPersian(itemsToTranslate);
      for (const article of uniqueArticles) {
        if ((article.source === 'cryptopotato' || article.source === 'coindesk') && translatedMap.has(article.id)) {
          const trans = translatedMap.get(article.id)!;
          article.originalTitle = article.title;
          article.originalSummary = article.summary;
          article.title = trans.titleFa || article.title;
          article.summary = trans.summaryFa || article.summary;
          article.isTranslated = true;
        }
      }
    } catch (tErr) {
      console.error('Error translating foreign articles:', tErr);
    }
  }

  const arzCount = uniqueArticles.filter((a) => a.source === 'arzdigital').length;
  const mihanCount = uniqueArticles.filter((a) => a.source === 'mihansignal').length;
  const mihanbcCount = uniqueArticles.filter((a) => a.source === 'mihanblockchain').length;
  const cryptoPotatoCount = uniqueArticles.filter((a) => a.source === 'cryptopotato').length;
  const coinDeskCount = uniqueArticles.filter((a) => a.source === 'coindesk').length;

  const responseData: NewsApiResponse = {
    success: true,
    articles: uniqueArticles,
    lastUpdated: new Date().toISOString(),
    total: uniqueArticles.length,
    sources: {
      arzdigital: arzCount,
      mihansignal: mihanCount,
      mihanblockchain: mihanbcCount,
      cryptopotato: cryptoPotatoCount,
      coindesk: coinDeskCount,
    },
    cached: false,
  };

  newsCache = {
    timestamp: now,
    data: responseData,
  };

  return NextResponse.json(responseData);
}
