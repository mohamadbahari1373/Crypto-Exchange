import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface ApiDispatchRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
}

export interface ApiDispatchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  durationMs: number;
  sizeBytes: number;
  contentType: string;
  headers: Record<string, string>;
  data: any;
  error?: string;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let targetUrl = '';
  let method: ApiDispatchRequest['method'] = 'GET';

  try {
    const payload: ApiDispatchRequest = await req.json();
    targetUrl = payload.url?.trim() || '';
    method = (payload.method || 'GET').toUpperCase() as ApiDispatchRequest['method'];

    if (!targetUrl) {
      return NextResponse.json(
        {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          durationMs: 0,
          sizeBytes: 0,
          contentType: 'application/json',
          headers: {},
          data: null,
          error: 'URL is required',
        },
        { status: 400 }
      );
    }

    // Support relative URLs (e.g. /api/news or /api/news/webhook)
    if (targetUrl.startsWith('/')) {
      targetUrl = `http://127.0.0.1:3000${targetUrl}`;
    } else if (targetUrl.startsWith('http://localhost:')) {
      targetUrl = targetUrl.replace('http://localhost:', 'http://127.0.0.1:');
    }

    // Append query params if any
    const parsedUrl = new URL(targetUrl);
    if (payload.params && typeof payload.params === 'object') {
      Object.entries(payload.params).forEach(([k, v]) => {
        if (k && v !== undefined) {
          parsedUrl.searchParams.set(k, String(v));
        }
      });
    }

    // Build headers
    const reqHeaders = new Headers();
    if (payload.headers && typeof payload.headers === 'object') {
      Object.entries(payload.headers).forEach(([k, v]) => {
        if (k && v !== undefined) {
          reqHeaders.set(k, String(v));
        }
      });
    }

    // Set default headers if missing
    if (!reqHeaders.has('User-Agent')) {
      reqHeaders.set('User-Agent', 'Wallex-API-Studio-Client/1.0 (NextJS-Proxy)');
    }
    if (!reqHeaders.has('Accept')) {
      reqHeaders.set('Accept', 'application/json, text/plain, */*');
    }

    // Prepare body
    let fetchBody: string | undefined = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method) && payload.body !== undefined && payload.body !== null) {
      if (typeof payload.body === 'object') {
        fetchBody = JSON.stringify(payload.body);
        if (!reqHeaders.has('Content-Type')) {
          reqHeaders.set('Content-Type', 'application/json');
        }
      } else {
        fetchBody = String(payload.body);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), payload.timeoutMs || 15000);

    const res = await fetch(parsedUrl.toString(), {
      method,
      headers: reqHeaders,
      body: fetchBody,
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeout);
    const durationMs = Date.now() - startTime;

    // Extract response headers
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      resHeaders[key] = val;
    });

    const contentType = res.headers.get('content-type') || '';
    let responseData: any = null;
    let sizeBytes = 0;

    if (method === 'HEAD') {
      responseData = null;
    } else {
      const rawText = await res.text();
      sizeBytes = new Blob([rawText]).size;

      if (contentType.includes('application/json')) {
        try {
          responseData = JSON.parse(rawText);
        } catch {
          responseData = rawText;
        }
      } else {
        try {
          responseData = JSON.parse(rawText);
        } catch {
          responseData = rawText;
        }
      }
    }

    const result: ApiDispatchResponse = {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
      durationMs,
      sizeBytes,
      contentType,
      headers: resHeaders,
      data: responseData,
    };

    return NextResponse.json(result);
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';

    return NextResponse.json(
      {
        ok: false,
        status: isTimeout ? 504 : 500,
        statusText: isTimeout ? 'Gateway Timeout' : 'Client Error',
        durationMs,
        sizeBytes: 0,
        contentType: 'application/json',
        headers: {},
        data: null,
        error: isTimeout ? 'Request timed out after 15 seconds' : err.message || 'Failed to dispatch API request',
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
