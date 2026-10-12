import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface WebhookLogItem {
  id: string;
  method: string;
  url: string;
  timestamp: string;
  receivedAt: number;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
  ip?: string;
  userAgent?: string;
  contentType?: string;
}

// Global in-memory storage for incoming webhook requests (stores last 60 requests)
declare global {
  // eslint-disable-next-line no-var
  var __incomingWebhookLogs: WebhookLogItem[] | undefined;
}

if (!global.__incomingWebhookLogs) {
  global.__incomingWebhookLogs = [
    {
      id: 'init-sample-webhook-1',
      method: 'POST',
      url: '/api/news/webhook',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      receivedAt: Date.now() - 1000 * 60 * 5,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Wallex-News-Bot/2.4',
        'x-webhook-event': 'article.published',
      },
      query: { source: 'wallex-internal', priority: 'high' },
      body: {
        event: 'news_update',
        title: 'راه‌اندازی سرویس دریافت وب‌هوک هوشمند اخبار و رویدادهای رمزارزی',
        summary: 'سیستم دریافت API و وب‌هوک زنده با قابلیت پشتیبانی از تمامی متدهای HTTP در پلتفرم فعال شد.',
        category: 'exchanges',
        source: 'wallex',
      },
      ip: '127.0.0.1',
      userAgent: 'Wallex-News-Bot/2.4',
      contentType: 'application/json',
    },
  ];
}

const getLogs = () => global.__incomingWebhookLogs || [];

// CORS headers helper
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, x-webhook-secret',
  };
}

// Extract headers to object
function getHeadersObject(req: NextRequest): Record<string, string> {
  const headersObj: Record<string, string> = {};
  req.headers.forEach((val, key) => {
    headersObj[key] = val;
  });
  return headersObj;
}

// Extract query parameters to object
function getQueryParams(req: NextRequest): Record<string, string> {
  const queryObj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((val, key) => {
    queryObj[key] = val;
  });
  return queryObj;
}

// Helper to parse body safely
async function parseRequestBody(req: NextRequest): Promise<any> {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await req.json();
    }
    const text = await req.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

// Record an incoming request into memory
function recordIncoming(
  method: string,
  req: NextRequest,
  body: any
): WebhookLogItem {
  const headers = getHeadersObject(req);
  const query = getQueryParams(req);
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Unknown';
  const contentType = req.headers.get('content-type') || 'none';

  const logItem: WebhookLogItem = {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    method,
    url: req.nextUrl.pathname + req.nextUrl.search,
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    receivedAt: Date.now(),
    headers,
    query,
    body,
    ip,
    userAgent,
    contentType,
  };

  global.__incomingWebhookLogs = [logItem, ...(global.__incomingWebhookLogs || []).slice(0, 59)];
  return logItem;
}

// -----------------------------------------------------------------------------
// GET: Handles both listing logs (when ?logs=1) OR receiving GET API calls
// -----------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  // If UI requests logs
  if (searchParams.get('logs') === '1' || searchParams.get('action') === 'logs') {
    return NextResponse.json(
      {
        success: true,
        count: getLogs().length,
        logs: getLogs(),
      },
      { headers: getCorsHeaders() }
    );
  }

  // If UI requests clear logs
  if (searchParams.get('clear') === '1' || searchParams.get('action') === 'clear') {
    global.__incomingWebhookLogs = [];
    return NextResponse.json(
      { success: true, message: 'All webhook logs cleared successfully', logs: [] },
      { headers: getCorsHeaders() }
    );
  }

  // Otherwise, this is an incoming GET API request!
  const record = recordIncoming('GET', req, null);

  return NextResponse.json(
    {
      success: true,
      message: 'Incoming GET API request received and logged successfully',
      requestId: record.id,
      timestamp: record.timestamp,
      queryReceived: record.query,
      status: 200,
    },
    { headers: getCorsHeaders() }
  );
}

// -----------------------------------------------------------------------------
// POST: Receives incoming POST API calls / Webhook payloads
// -----------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  // Clear action via POST if needed
  if (searchParams.get('action') === 'clear') {
    global.__incomingWebhookLogs = [];
    return NextResponse.json({ success: true, message: 'Logs cleared' }, { headers: getCorsHeaders() });
  }

  const body = await parseRequestBody(req);
  const record = recordIncoming('POST', req, body);

  return NextResponse.json(
    {
      success: true,
      message: 'Incoming POST API request / webhook payload received successfully',
      requestId: record.id,
      timestamp: record.timestamp,
      payloadReceived: body,
      status: 201,
    },
    { status: 201, headers: getCorsHeaders() }
  );
}

// -----------------------------------------------------------------------------
// PUT: Receives incoming PUT API calls
// -----------------------------------------------------------------------------
export async function PUT(req: NextRequest) {
  const body = await parseRequestBody(req);
  const record = recordIncoming('PUT', req, body);

  return NextResponse.json(
    {
      success: true,
      message: 'Incoming PUT API request received and resource updated/logged',
      requestId: record.id,
      timestamp: record.timestamp,
      payloadReceived: body,
      status: 200,
    },
    { headers: getCorsHeaders() }
  );
}

// -----------------------------------------------------------------------------
// PATCH: Receives incoming PATCH API calls
// -----------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const body = await parseRequestBody(req);
  const record = recordIncoming('PATCH', req, body);

  return NextResponse.json(
    {
      success: true,
      message: 'Incoming PATCH API request received and partially applied',
      requestId: record.id,
      timestamp: record.timestamp,
      payloadReceived: body,
      status: 200,
    },
    { headers: getCorsHeaders() }
  );
}

// -----------------------------------------------------------------------------
// DELETE: Receives incoming DELETE API calls
// -----------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  // If deleting all logs
  if (searchParams.get('all') === 'true' || searchParams.get('logs') === '1') {
    global.__incomingWebhookLogs = [];
    return NextResponse.json(
      { success: true, message: 'All webhook history deleted successfully', count: 0 },
      { headers: getCorsHeaders() }
    );
  }

  // Deleting a specific log item
  const targetId = searchParams.get('id');
  if (targetId) {
    global.__incomingWebhookLogs = (global.__incomingWebhookLogs || []).filter((l) => l.id !== targetId);
    return NextResponse.json(
      { success: true, message: `Request ${targetId} deleted`, remainingCount: getLogs().length },
      { headers: getCorsHeaders() }
    );
  }

  const record = recordIncoming('DELETE', req, null);
  return NextResponse.json(
    {
      success: true,
      message: 'Incoming DELETE API request processed and logged',
      requestId: record.id,
      timestamp: record.timestamp,
      status: 200,
    },
    { headers: getCorsHeaders() }
  );
}

// -----------------------------------------------------------------------------
// OPTIONS: Preflight and Capabilities Check
// -----------------------------------------------------------------------------
export async function OPTIONS(req: NextRequest) {
  recordIncoming('OPTIONS', req, null);
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(),
      Allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
    },
  });
}

// -----------------------------------------------------------------------------
// HEAD: Headers only check
// -----------------------------------------------------------------------------
export async function HEAD(req: NextRequest) {
  recordIncoming('HEAD', req, null);
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...getCorsHeaders(),
      'X-Webhook-Service': 'Wallex-Crypto-News-API',
      'X-Logged-Count': String(getLogs().length),
    },
  });
}
