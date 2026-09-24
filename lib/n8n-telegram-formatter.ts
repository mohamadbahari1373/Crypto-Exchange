import { NewsArticle } from '@/lib/types';

export interface TelegramPayload {
  id: string;
  guid: string;
  title: string;
  summary: string;
  url: string;
  imageUrl?: string;
  source: string;
  sourceNameFa: string;
  sourceNameEn: string;
  category: string;
  categoryFa: string;
  publishedAt: string;
  publishedAtShamsi: string;
  timeAgoFa: string;
  author?: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentFa: string;
  sentimentEmoji: string;
  isBreaking: boolean;
  hashtags: string[];
  hashtagsString: string;
  coinsMentioned: string[];
  telegram: {
    html: string;
    caption_html: string;
    plain_text: string;
    markdown_v2: string;
    inline_keyboard: {
      inline_keyboard: Array<Array<{ text: string; url: string }>>;
    };
  };
}

// Convert Gregorian ISO date to Shamsi string
export function formatToShamsiTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '';
  }
}

export function getTimeAgoFa(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'لحظاتی پیش';
    if (diffMin < 60) return `${diffMin} دقیقه پیش`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} ساعت پیش`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} روز پیش`;
  } catch {
    return '';
  }
}

// Extract coin mentions and hashtags
export function extractCoinsAndHashtags(text: string): { coins: string[]; hashtags: string[] } {
  const lower = text.toLowerCase();
  const coins: string[] = [];
  const hashtagsSet = new Set<string>();

  hashtagsSet.add('#اخبار_رمزارز');
  hashtagsSet.add('#کریپتو');

  const coinPatterns = [
    { key: 'BTC', name: 'بیت‌کوین', tags: ['#بیت_کوین', '#BTC', '#Bitcoin'], regex: /بیت[\s‌-]?کوین|bitcoin|\bbtc\b/i },
    { key: 'ETH', name: 'اتریوم', tags: ['#اتریوم', '#ETH', '#Ethereum'], regex: /اتریوم|ethereum|\beth\b/i },
    { key: 'USDT', name: 'تتر', tags: ['#تتر', '#USDT', '#Tether'], regex: /تتر|tether|\busdt\b/i },
    { key: 'SOL', name: 'سولانا', tags: ['#سولانا', '#SOL', '#Solana'], regex: /سولانا|solana|\bsol\b/i },
    { key: 'TON', name: 'تون‌کوین', tags: ['#تون_کوین', '#TON', '#Toncoin'], regex: /تون[\s‌-]?کوین|toncoin|\bton\b/i },
    { key: 'XRP', name: 'ریپل', tags: ['#ریپل', '#XRP', '#Ripple'], regex: /ریپل|ripple|\bxrp\b/i },
    { key: 'DOGE', name: 'دوج‌کوین', tags: ['#دوج_کوین', '#DOGE', '#Dogecoin'], regex: /دوج[\s‌-]?کوین|dogecoin|\bdoge\b/i },
    { key: 'SHIB', name: 'شیبا', tags: ['#شیبا', '#SHIB', '#Shiba'], regex: /شیبا|shiba|\bshib\b/i },
    { key: 'ADA', name: 'کاردانو', tags: ['#کاردانو', '#ADA', '#Cardano'], regex: /کاردانو|cardano|\bada\b/i },
    { key: 'BNB', name: 'بایننس', tags: ['#بایننس', '#BNB', '#Binance'], regex: /بایننس|binance|\bbnb\b/i },
    { key: 'WALLEX', name: 'والکس', tags: ['#والکس', '#Wallex', '#صرافی_والکس'], regex: /والکس|wallex/i },
    { key: 'NOBITEX', name: 'نوبیتکس', tags: ['#نوبیتکس', '#Nobitex'], regex: /نوبیتکس|nobitex/i },
    { key: 'FED', name: 'فدرال رزرو', tags: ['#فدرال_رزرو', '#اقتصاد_جهانی', '#FED'], regex: /فدرال[\s‌-]?رزرو|نرخ بهره|تورم آمریکا|\bfed\b/i },
  ];

  for (const item of coinPatterns) {
    if (item.regex.test(text) || lower.includes(item.key.toLowerCase())) {
      coins.push(item.key);
      item.tags.forEach((t) => hashtagsSet.add(t));
    }
  }

  return {
    coins: Array.from(new Set(coins)),
    hashtags: Array.from(hashtagsSet).slice(0, 6),
  };
}

// Detect sentiment heuristics
export function detectSentiment(text: string): { sentiment: 'bullish' | 'bearish' | 'neutral'; sentimentFa: string; emoji: string } {
  const bullishKeywords = [
    'صعود', 'جهش', 'رشد', 'افزایش', 'شکست مقاومت', 'سقف تاریخی', 'رالی', 'سبزپوش', 'رکورد جدید', 'پامپ',
    'ورود سرمایه', 'انباشت', 'خرید نهنگ', 'خوش‌بینانه', 'bullish', 'surge', 'rally', 'gain', 'skyrocket', 'high'
  ];
  const bearishKeywords = [
    'سقوط', 'ریزش', 'کاهش', 'افت شدید', 'شکست حمایت', 'قرمزپوش', 'دامپ', 'خروج سرمایه', 'فروش سنگین',
    'وحشت بازار', 'بدبینانه', 'bearish', 'drop', 'plunge', 'crash', 'down', 'liquidation', 'dump'
  ];

  let bullScore = 0;
  let bearScore = 0;

  for (const w of bullishKeywords) {
    if (text.includes(w)) bullScore++;
  }
  for (const w of bearishKeywords) {
    if (text.includes(w)) bearScore++;
  }

  if (bullScore > bearScore) {
    return { sentiment: 'bullish', sentimentFa: 'صعودی / مثبت', emoji: '🟢' };
  }
  if (bearScore > bullScore) {
    return { sentiment: 'bearish', sentimentFa: 'نزولی / منفی', emoji: '🔴' };
  }
  return { sentiment: 'neutral', sentimentFa: 'خنثی / تحلیلی', emoji: '⚪' };
}

// Check if breaking news
export function isBreakingNews(title: string): boolean {
  const breakingKeys = ['فوری', 'مهم', 'هشدار', 'خبر فوری', 'breaking', 'urgent', 'alert', 'تازه'];
  return breakingKeys.some((k) => title.toLowerCase().includes(k));
}

// Escape special characters for Telegram MarkdownV2
export function escapeMarkdownV2(text: string): string {
  if (!text) return '';
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

// Escape HTML tags for safe Telegram HTML parsing
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface FormatOptions {
  channelUsername?: string;
  channelTitle?: string;
  wallexRefUrl?: string;
}

/**
 * Formats a raw NewsArticle into a comprehensive, Telegram-ready payload for n8n
 */
export function formatNewsForTelegram(article: NewsArticle, options: FormatOptions = {}): TelegramPayload {
  const combinedText = `${article.title} ${article.summary}`;
  const { coins, hashtags } = extractCoinsAndHashtags(combinedText);
  const { sentiment, sentimentFa, emoji: sentimentEmoji } = detectSentiment(combinedText);
  const isBreaking = isBreakingNews(article.title);

  const channelTag = options.channelUsername
    ? options.channelUsername.startsWith('@')
      ? options.channelUsername
      : `@${options.channelUsername}`
    : '@WallexExchange';

  const channelName = options.channelTitle || 'والکس | Wallex';
  const shamsiTime = formatToShamsiTime(article.publishedAt);
  const timeAgo = getTimeAgoFa(article.publishedAt);
  const hashtagsString = hashtags.join(' ');

  const titleHtml = escapeHtml(article.title.trim());
  const summaryHtml = escapeHtml(article.summary.trim());
  const safeSource = escapeHtml(article.sourceNameFa || article.source);
  const safeUrl = article.url.trim();

  const breakingHeader = isBreaking ? '🚨 <b>#فوری | BREAKING NEWS</b>\n\n' : '';

  // 1. Full Telegram HTML Message (sendMessage)
  const telegramHtml = [
    breakingHeader ? breakingHeader.trim() : null,
    `🔥 <b>${titleHtml}</b>`,
    '',
    `📝 ${summaryHtml}`,
    '',
    `📊 <b>سیگنال بازار:</b> ${sentimentEmoji} ${sentimentFa}`,
    `📰 <b>منبع:</b> ${safeSource} | ⏱ ${shamsiTime || timeAgo}`,
    `🔗 <a href="${safeUrl}">مطالعه متن کامل خبر در منبع</a>`,
    '',
    hashtagsString,
    `🆔 <b>${channelName}:</b> ${channelTag}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  // 2. Telegram Caption HTML for sendPhoto (strictly max 1024 characters)
  const maxCaptionSummaryLen = 220;
  const shortSummary = article.summary.length > maxCaptionSummaryLen
    ? article.summary.slice(0, maxCaptionSummaryLen).trim() + '...'
    : article.summary;

  const captionHtml = [
    isBreaking ? '🚨 <b>#فوری</b>' : null,
    `📌 <b>${titleHtml}</b>`,
    '',
    `📝 ${escapeHtml(shortSummary)}`,
    '',
    `📊 ${sentimentEmoji} ${sentimentFa} | ⏱ ${shamsiTime || timeAgo}`,
    `📰 ${safeSource}`,
    '',
    hashtagsString,
    `🆔 ${channelTag}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  // 3. Plain Text Format
  const plainText = [
    isBreaking ? '🚨 فوری | BREAKING' : '',
    `📌 ${article.title}`,
    '',
    article.summary,
    '',
    `📊 سیگنال بازار: ${sentimentEmoji} ${sentimentFa}`,
    `📰 منبع: ${article.sourceNameFa} | ⏱ ${shamsiTime || timeAgo}`,
    `🔗 لینک: ${article.url}`,
    '',
    hashtagsString,
    `🆔 ${channelTag}`,
  ]
    .filter(Boolean)
    .join('\n');

  // 4. MarkdownV2 format
  const mdTitle = escapeMarkdownV2(article.title);
  const mdSummary = escapeMarkdownV2(shortSummary);
  const mdSource = escapeMarkdownV2(article.sourceNameFa || article.source);
  const mdChannel = escapeMarkdownV2(channelTag);
  const mdHashtags = escapeMarkdownV2(hashtagsString);

  const markdownV2 = [
    isBreaking ? '🚨 *\\#فوری*' : '',
    `🔥 *${mdTitle}*`,
    '',
    `${mdSummary}`,
    '',
    `📊 *سیگنال:* ${sentimentEmoji} ${escapeMarkdownV2(sentimentFa)}`,
    `📰 *منبع:* ${mdSource}`,
    `🔗 [مطالعه کامل خبر](${safeUrl})`,
    '',
    mdHashtags,
    `🆔 ${mdChannel}`,
  ]
    .filter(Boolean)
    .join('\n');

  // 5. Pre-built Inline Keyboard for Telegram
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '📖 مطالعه کامل در منبع', url: article.url },
        { text: '📈 ترید در والکس', url: options.wallexRefUrl || 'https://wallex.ir' },
      ],
    ],
  };

  return {
    id: article.id,
    guid: article.id,
    title: article.title,
    summary: article.summary,
    url: article.url,
    imageUrl: article.imageUrl,
    source: article.source,
    sourceNameFa: article.sourceNameFa,
    sourceNameEn: article.sourceNameEn,
    category: article.category,
    categoryFa: article.categoryFa,
    publishedAt: article.publishedAt,
    publishedAtShamsi: shamsiTime,
    timeAgoFa: timeAgo,
    author: article.author,
    sentiment,
    sentimentFa,
    sentimentEmoji,
    isBreaking,
    hashtags,
    hashtagsString,
    coinsMentioned: coins,
    telegram: {
      html: telegramHtml,
      caption_html: captionHtml,
      plain_text: plainText,
      markdown_v2: markdownV2,
      inline_keyboard: inlineKeyboard,
    },
  };
}
