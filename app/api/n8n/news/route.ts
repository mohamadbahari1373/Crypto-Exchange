import { NextRequest, NextResponse } from 'next/server';
import { NewsArticle, NewsApiResponse } from '@/lib/types';
import { formatNewsForTelegram, TelegramPayload } from '@/lib/n8n-telegram-formatter';

export const dynamic = 'force-dynamic';

// Sample pre-built n8n workflow JSON blueprint that users can import into n8n directly
function generateN8nWorkflowJson(apiUrl: string, channelUsername: string) {
  return {
    name: 'Wallex News to Telegram Channel',
    nodes: [
      {
        parameters: {
          rule: {
            interval: [
              {
                field: 'minutes',
                minutesInterval: 15,
              },
            ],
          },
        },
        id: '1a2b3c4d-schedule-trigger',
        name: 'Every 15 Minutes',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1.2,
        position: [240, 300],
      },
      {
        parameters: {
          url: `${apiUrl}?since_minutes=20&channel_username=${encodeURIComponent(channelUsername)}`,
          options: {
            response: {
              response: {
                responseFormat: 'json',
              },
            },
          },
        },
        id: '2b3c4d5e-http-request',
        name: 'Fetch Crypto News',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [460, 300],
      },
      {
        parameters: {
          fieldToSplitOut: 'items',
          options: {},
        },
        id: '3c4d5e6f-item-lists',
        name: 'Split News Items',
        type: 'n8n-nodes-base.itemLists',
        typeVersion: 3,
        position: [680, 300],
      },
      {
        parameters: {
          conditions: {
            options: {
              caseSensitive: true,
              leftValue: '',
              typeValidation: 'strict',
            },
            conditions: [
              {
                id: 'check-image',
                leftValue: '={{ $json.imageUrl }}',
                rightValue: '',
                operator: {
                  type: 'string',
                  operation: 'notEmpty',
                },
              },
            ],
            combinator: 'and',
          },
        },
        id: '4d5e6f7g-if-has-image',
        name: 'Has Image?',
        type: 'n8n-nodes-base.if',
        typeVersion: 2,
        position: [900, 300],
      },
      {
        parameters: {
          chatId: channelUsername,
          operation: 'sendPhoto',
          file: '={{ $json.imageUrl }}',
          additionalFields: {
            caption: '={{ $json.telegram.caption_html }}',
            parse_mode: 'HTML',
          },
        },
        id: '5e6f7g8h-telegram-photo',
        name: 'Telegram Send Photo',
        type: 'n8n-nodes-base.telegram',
        typeVersion: 1.2,
        position: [1120, 200],
      },
      {
        parameters: {
          chatId: channelUsername,
          text: '={{ $json.telegram.html }}',
          additionalFields: {
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          },
        },
        id: '6f7g8h9i-telegram-text',
        name: 'Telegram Send Message',
        type: 'n8n-nodes-base.telegram',
        typeVersion: 1.2,
        position: [1120, 420],
      },
    ],
    connections: {
      'Every 15 Minutes': {
        main: [
          [
            {
              node: 'Fetch Crypto News',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'Fetch Crypto News': {
        main: [
          [
            {
              node: 'Split News Items',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'Split News Items': {
        main: [
          [
            {
              node: 'Has Image?',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
      'Has Image?': {
        main: [
          [
            {
              node: 'Telegram Send Photo',
              type: 'main',
              index: 0,
            },
          ],
          [
            {
              node: 'Telegram Send Message',
              type: 'main',
              index: 0,
            },
          ],
        ],
      },
    },
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const searchParams = url.searchParams;

  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50) : 10;

  const sinceMinutesParam = searchParams.get('since_minutes');
  const sinceMinutes = sinceMinutesParam ? parseInt(sinceMinutesParam, 10) : null;

  const sinceTimestampParam = searchParams.get('since_timestamp');
  const sinceTimestamp = sinceTimestampParam ? new Date(sinceTimestampParam).getTime() : null;

  const categoryFilter = searchParams.get('category') || 'all';
  const sourceFilter = searchParams.get('source') || 'all';
  const channelUsername = searchParams.get('channel_username') || '@WallexExchange';
  const channelTitle = searchParams.get('channel_title') || 'والکس | Wallex';
  const onlyWithImages = searchParams.get('only_with_images') === 'true';
  const breakingOnly = searchParams.get('breaking_only') === 'true';

  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const currentBaseUrl = `${protocol}://${host}`;

  try {
    // Call the internal news API to leverage the cached, deduplicated & Persian-translated articles
    const internalNewsRes = await fetch(`${currentBaseUrl}/api/news`, {
      cache: 'no-store',
    });

    if (!internalNewsRes.ok) {
      throw new Error(`Failed to fetch upstream news feed: status ${internalNewsRes.status}`);
    }

    const newsData: NewsApiResponse = await internalNewsRes.json();
    let rawArticles: NewsArticle[] = newsData.articles || [];

    // 1. Filter by category
    if (categoryFilter !== 'all') {
      rawArticles = rawArticles.filter((a) => a.category === categoryFilter);
    }

    // 2. Filter by source
    if (sourceFilter !== 'all') {
      rawArticles = rawArticles.filter((a) => a.source === sourceFilter);
    }

    // 3. Filter by images
    if (onlyWithImages) {
      rawArticles = rawArticles.filter((a) => Boolean(a.imageUrl));
    }

    // 4. Filter by time window (for n8n cron schedules)
    if (sinceMinutes && !isNaN(sinceMinutes) && sinceMinutes > 0) {
      const cutoffTime = Date.now() - sinceMinutes * 60 * 1000;
      rawArticles = rawArticles.filter((a) => new Date(a.publishedAt).getTime() >= cutoffTime);
    } else if (sinceTimestamp && !isNaN(sinceTimestamp)) {
      rawArticles = rawArticles.filter((a) => new Date(a.publishedAt).getTime() >= sinceTimestamp);
    }

    // 5. Format all items for Telegram & n8n
    let formattedItems: TelegramPayload[] = rawArticles.map((article) =>
      formatNewsForTelegram(article, {
        channelUsername,
        channelTitle,
      })
    );

    // 6. Filter breaking news if requested
    if (breakingOnly) {
      formattedItems = formattedItems.filter((i) => i.isBreaking);
    }

    // 7. Apply limit
    const finalItems = formattedItems.slice(0, limit);

    // Build self-contained API documentation & ready-to-import n8n workflow
    const apiUrlForBlueprint = `${currentBaseUrl}/api/n8n/news`;
    const n8nBlueprint = generateN8nWorkflowJson(apiUrlForBlueprint, channelUsername);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: finalItems.length,
      total_available: rawArticles.length,
      meta: {
        channel_username: channelUsername,
        channel_title: channelTitle,
        category: categoryFilter,
        source: sourceFilter,
        limit,
        since_minutes: sinceMinutes,
        only_with_images: onlyWithImages,
      },
      items: finalItems,
      // Sample single item ready for instant n8n testing
      sample_telegram_post: finalItems[0]?.telegram || null,
      n8n_integration_guide: {
        step_1: 'Create a Schedule Trigger in n8n (e.g. interval: 15 minutes)',
        step_2: `Add HTTP Request Node with GET: ${apiUrlForBlueprint}?since_minutes=20&channel_username=${encodeURIComponent(channelUsername)}`,
        step_3: 'Add Item Lists Node to split by "items"',
        step_4: 'Add Telegram Node (Operation: sendMessage or sendPhoto) using fields $json.telegram.html or $json.telegram.caption_html with parse_mode: "HTML"',
        n8n_workflow_json_blueprint: n8nBlueprint,
      },
    });
  } catch (error: any) {
    console.error('Error in n8n news API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to generate n8n news payload',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// POST endpoint to test forwarding news directly to an n8n webhook URL
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { webhookUrl, articleId, limit = 1, channelUsername = '@WallexExchange', channelTitle = 'والکس | Wallex' } = body;

    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
      return NextResponse.json(
        {
          success: false,
          error: 'یک آدرس وب‌هوک معتبر برای n8n الزامی است (webhookUrl must be a valid HTTP/HTTPS URL)',
        },
        { status: 400 }
      );
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const currentBaseUrl = `${protocol}://${host}`;

    const newsRes = await fetch(`${currentBaseUrl}/api/news`, { cache: 'no-store' });
    if (!newsRes.ok) throw new Error('Failed to load news');

    const newsData: NewsApiResponse = await newsRes.json();
    let articles: NewsArticle[] = newsData.articles || [];

    if (articleId) {
      articles = articles.filter((a) => a.id === articleId);
    }

    if (articles.length === 0) {
      return NextResponse.json({ success: false, error: 'خبری یافت نشد' }, { status: 404 });
    }

    const selectedArticles = articles.slice(0, limit);
    const payloads = selectedArticles.map((a) =>
      formatNewsForTelegram(a, {
        channelUsername,
        channelTitle,
      })
    );

    // Send payload to user's n8n webhook
    const startTime = Date.now();
    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Wallex-Crypto-News-Bridge/1.0',
      },
      body: JSON.stringify({
        event: 'crypto_news_dispatch',
        dispatched_at: new Date().toISOString(),
        channel_username: channelUsername,
        count: payloads.length,
        items: payloads,
        // Single item shortcut for simple n8n webhooks
        item: payloads[0],
      }),
    });

    const elapsedMs = Date.now() - startTime;
    const responseText = await webhookRes.text();

    return NextResponse.json({
      success: webhookRes.ok,
      status: webhookRes.status,
      statusText: webhookRes.statusText,
      elapsedMs,
      message: webhookRes.ok
        ? 'خبر با موفقیت به وب‌هوک n8n ارسال شد!'
        : `خطا در دریافت پاسخ از وب‌هوک n8n (کد ${webhookRes.status})`,
      n8nResponsePreview: responseText.slice(0, 300),
      sentItemsCount: payloads.length,
      sampleSent: payloads[0],
    });
  } catch (err: any) {
    console.error('Webhook dispatch error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'خطا در برقراری ارتباط با وب‌هوک n8n',
      },
      { status: 500 }
    );
  }
}
