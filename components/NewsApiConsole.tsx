'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Download,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Code2,
  Globe,
  Sliders,
  FileCode,
  Shield,
  Layers,
  Terminal,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Language } from '@/lib/types';
import { DidehbonLogoIcon } from '@/components/DidehbonLogo';

interface NewsApiConsoleProps {
  lang: Language;
  isDark: boolean;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface WebhookLogItem {
  id: string;
  method: string;
  url: string;
  timestamp: string;
  receivedAt: number;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  ip?: string;
  userAgent?: string;
  contentType?: string;
}

interface ApiDispatchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  durationMs: number;
  sizeBytes: number;
  contentType: string;
  headers: Record<string, string>;
  data: unknown;
  error?: string;
}

const METHOD_COLORS: Record<HttpMethod, { bg: string; text: string; border: string }> = {
  GET: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  POST: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  PUT: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  PATCH: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  DELETE: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  OPTIONS: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  HEAD: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30' },
};

const PRESETS = [
  {
    name: 'دریافت لیست اخبار سیستم (GET)',
    nameEn: 'Get News Articles (GET)',
    method: 'GET' as HttpMethod,
    url: '/api/news.php',
    headers: [{ id: '1', key: 'Accept', value: 'application/json', enabled: true }],
    body: '',
  },
  {
    name: 'ارسال خبر فوری به وب‌هوک (POST)',
    nameEn: 'Send Breaking News to Webhook (POST)',
    method: 'POST' as HttpMethod,
    url: '/api/webhook.php',
    headers: [{ id: '1', key: 'Content-Type', value: 'application/json', enabled: true }],
    body: JSON.stringify(
      {
        event: 'breaking_news',
        title: 'رکورد جدید حجم معاملات روزانه در بازارهای والکس',
        summary: 'حجم تبادلات جفت‌ارزهای تومانی و تتری والکس در ۲۴ ساعت گذشته رشد چشمگیری را ثبت کرد.',
        category: 'exchanges',
        source: 'wallex-api',
        timestamp: new Date().toISOString(),
      },
      null,
      2
    ),
  },
  {
    name: 'به‌روزرسانی تنظیمات فید (PUT)',
    nameEn: 'Update Feed Config (PUT)',
    method: 'PUT' as HttpMethod,
    url: '/api/webhook.php',
    headers: [{ id: '1', key: 'Content-Type', value: 'application/json', enabled: true }],
    body: JSON.stringify(
      {
        action: 'update_sync_interval',
        intervalSeconds: 60,
        enableAutoTranslate: true,
        sources: ['arzdigital', 'mihansignal', 'wallex'],
      },
      null,
      2
    ),
  },
  {
    name: 'تغییر وضعیت یا برچسب خبر (PATCH)',
    nameEn: 'Patch Article Status (PATCH)',
    method: 'PATCH' as HttpMethod,
    url: '/api/webhook.php',
    headers: [{ id: '1', key: 'Content-Type', value: 'application/json', enabled: true }],
    body: JSON.stringify(
      {
        articleId: 'art-1029',
        status: 'verified',
        pinned: true,
        priority: 'high',
      },
      null,
      2
    ),
  },
  {
    name: 'دریافت آمار بازارهای والکس (GET External)',
    nameEn: 'Fetch Wallex Market Currencies (GET)',
    method: 'GET' as HttpMethod,
    url: 'https://api.wallex.ir/v1/markets',
    headers: [{ id: '1', key: 'Accept', value: 'application/json', enabled: true }],
    body: '',
  },
  {
    name: 'حذف داده‌های لاگ وب‌هوک (DELETE)',
    nameEn: 'Delete Webhook Logs (DELETE)',
    method: 'DELETE' as HttpMethod,
    url: '/api/webhook.php?all=true',
    headers: [],
    body: '',
  },
  {
    name: 'بررسی قابلیت‌ها و متدهای مجاز (OPTIONS)',
    nameEn: 'Check Server Capabilities (OPTIONS)',
    method: 'OPTIONS' as HttpMethod,
    url: '/api/webhook.php',
    headers: [],
    body: '',
  },
  {
    name: 'بررسی متادیتای هدر پاسخ (HEAD)',
    nameEn: 'Check Response Headers (HEAD)',
    method: 'HEAD' as HttpMethod,
    url: '/api/webhook.php',
    headers: [],
    body: '',
  },
];

export default function NewsApiConsole({ lang, isDark }: NewsApiConsoleProps) {
  const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send');

  // --- Sender State ---
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState<string>('/api/news.php');
  const [headers, setHeaders] = useState<KeyValuePair[]>([
    { id: '1', key: 'Accept', value: 'application/json', enabled: true },
  ]);
  const [params, setParams] = useState<KeyValuePair[]>([]);
  const [requestBody, setRequestBody] = useState<string>('');
  const [senderActiveSubTab, setSenderActiveSubTab] = useState<'body' | 'headers' | 'params'>('headers');

  // Execution & Response State
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiDispatchResponse | null>(null);
  const [responseSubTab, setResponseSubTab] = useState<'body' | 'headers'>('body');
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // --- Receiver / Webhook State ---
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogItem[]>([]);
  const [fetchingLogs, setFetchingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookLogItem | null>(null);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
  const [testSending, setTestSending] = useState(false);

  // Load incoming webhook logs
  const fetchLogs = useCallback(async () => {
    try {
      setFetchingLogs(true);
      const res = await fetch('/api/webhook.php?logs=1', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setWebhookLogs(data.logs);
          if (data.logs.length > 0 && !selectedLog) {
            setSelectedLog(data.logs[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load webhook logs:', err);
    } finally {
      setFetchingLogs(false);
    }
  }, [selectedLog]);

  // Periodic polling for incoming logs
  useEffect(() => {
    fetchLogs();
    if (!autoRefreshLogs) return;
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, [fetchLogs, autoRefreshLogs]);

  // Clear incoming logs
  const clearLogs = async () => {
    try {
      await fetch('/api/webhook.php?clear=1', { method: 'GET' });
      setWebhookLogs([]);
      setSelectedLog(null);
    } catch (e) {
      console.error('Failed to clear logs:', e);
    }
  };

  // Quick test incoming webhook ping
  const sendTestPing = async (sampleMethod: HttpMethod = 'POST') => {
    try {
      setTestSending(true);
      await fetch('/api/webhook.php', {
        method: sampleMethod,
        headers: {
          'Content-Type': 'application/json',
          'X-Client': 'Wallex-API-Studio-Tester',
        },
        body: ['POST', 'PUT', 'PATCH'].includes(sampleMethod)
          ? JSON.stringify({
              testEvent: 'manual_ping',
              timestamp: new Date().toISOString(),
              message: `تست ارسال و دریافت متد ${sampleMethod} در بخش اخبار`,
              source: 'in-browser-tester',
            })
          : undefined,
      });
      await fetchLogs();
    } catch (e) {
      console.error('Error sending test ping:', e);
    } finally {
      setTestSending(false);
    }
  };

  // Apply a preset
  const applyPreset = (preset: typeof PRESETS[0]) => {
    setMethod(preset.method);
    setUrl(preset.url);
    setHeaders(preset.headers);
    setRequestBody(preset.body);
    if (['POST', 'PUT', 'PATCH'].includes(preset.method)) {
      setSenderActiveSubTab('body');
    } else {
      setSenderActiveSubTab('headers');
    }
  };

  // Dispatch Request (Supports all methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD)
  const handleSend = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResponse(null);

    try {
      // Build headers object
      const headerObj: Record<string, string> = {};
      headers.filter((h) => h.enabled && h.key.trim()).forEach((h) => {
        headerObj[h.key.trim()] = h.value;
      });

      // Build params object
      const paramsObj: Record<string, string> = {};
      params.filter((p) => p.enabled && p.key.trim()).forEach((p) => {
        paramsObj[p.key.trim()] = p.value;
      });

      let parsedBody: any = undefined;
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && requestBody.trim()) {
        try {
          parsedBody = JSON.parse(requestBody);
        } catch {
          parsedBody = requestBody;
        }
      }

      let data: ApiDispatchResponse;
      if (url.includes('/api/webhook.php') || url.includes('/api/news.php')) {
        const targetUrl = new URL(url, window.location.origin);
        Object.entries(paramsObj).forEach(([key, value]) => targetUrl.searchParams.set(key, value));
        const startedAt = Date.now();
        const res = await fetch(targetUrl, {
          method,
          headers: headerObj,
          body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && parsedBody !== undefined
            ? typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody)
            : undefined,
        });
        const rawBody = method === 'HEAD' ? '' : await res.text();
        let responseBody: unknown = rawBody;
        try {
          responseBody = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          // Preserve non-JSON responses as text.
        }
        data = {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
          durationMs: Date.now() - startedAt,
          sizeBytes: new TextEncoder().encode(rawBody).length,
          contentType: res.headers.get('content-type') || '',
          headers: Object.fromEntries(res.headers.entries()),
          data: responseBody,
        };
      } else {
        const targetUrl = new URL(url, window.location.origin);
        Object.entries(paramsObj).forEach(([key, value]) => targetUrl.searchParams.set(key, value));
        const startedAt = Date.now();
        const res = await fetch(targetUrl, {
          method,
          headers: headerObj,
          body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && parsedBody !== undefined
            ? typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody)
            : undefined,
        });
        const rawBody = method === 'HEAD' ? '' : await res.text();
        let responseBody: unknown = rawBody;
        try {
          responseBody = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          // Keep text responses available in the API console.
        }
        data = {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
          durationMs: Date.now() - startedAt,
          sizeBytes: new TextEncoder().encode(rawBody).length,
          contentType: res.headers.get('content-type') || '',
          headers: Object.fromEntries(res.headers.entries()),
          data: responseBody,
        };
      }
      setResponse(data);

      // If the request was sent to the internal webhook, refresh logs!
      if (url.includes('/api/webhook.php')) {
        setTimeout(fetchLogs, 500);
      }
    } catch (err: any) {
      setResponse({
        ok: false,
        status: 0,
        statusText: 'Client Network Error',
        durationMs: 0,
        sizeBytes: 0,
        contentType: 'text/plain',
        headers: {},
        data: null,
        error: err.message || 'Failed to dispatch request',
      });
    } finally {
      setLoading(false);
    }
  };

  // Helpers to add/remove rows
  const addHeaderRow = () => {
    setHeaders([...headers, { id: String(Date.now()), key: '', value: '', enabled: true }]);
  };
  const removeHeaderRow = (id: string) => {
    setHeaders(headers.filter((h) => h.id !== id));
  };
  const updateHeaderRow = (id: string, key: string, value: string, enabled: boolean) => {
    setHeaders(headers.map((h) => (h.id === id ? { ...h, key, value, enabled } : h)));
  };

  const addParamRow = () => {
    setParams([...params, { id: String(Date.now()), key: '', value: '', enabled: true }]);
  };
  const removeParamRow = (id: string) => {
    setParams(params.filter((p) => p.id !== id));
  };
  const updateParamRow = (id: string, key: string, value: string, enabled: boolean) => {
    setParams(params.map((p) => (p.id === id ? { ...p, key, value, enabled } : p)));
  };

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const webhookUrl = `${currentOrigin}/api/webhook.php`;
  const curlExample = `curl -X POST "${webhookUrl}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title": "خبر رمزارزی نمونه", "source": "wallex", "category": "market"}'`;

  return (
    <div className="flex flex-col gap-5">
      {/* TOP HEADER & MODE SELECTOR */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-slate-900/90 border-slate-800 shadow-xl shadow-black/20'
            : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DidehbonLogoIcon size={38} withGlow={isDark} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  {lang === 'fa' ? 'کنسول وب‌سرویس و داده‌های دیده بُن' : 'Didehbon API & Webhook Hub'}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  didehbon.ir • REST & Webhook
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'fa'
                  ? 'ارسال و دریافت درخواست‌های API و وب‌هوک سامانه دیده بُن با متدهای GET, POST, PUT, PATCH, DELETE'
                  : 'Dispatch and monitor Didehbon platform API & Webhook events across standard HTTP methods'}
              </p>
            </div>
          </div>

          {/* MAIN TAB SWITCHER (SEND vs RECEIVE) */}
          <div
            className={`flex items-center p-1 rounded-xl border self-stretch md:self-auto ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              onClick={() => setActiveTab('send')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'send'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'ارسال درخواست (Client)' : 'Send Request'}</span>
            </button>

            <button
              onClick={() => setActiveTab('receive')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'receive'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'دریافت و وب‌هوک زنده (Receiver)' : 'Receive & Webhook'}</span>
              {webhookLogs.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                  {webhookLogs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: SEND REQUEST (API DISPATCHER)                                  */}
      {/* ===================================================================== */}
      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT / TOP: REQUEST BUILDER (7 Cols) */}
          <div
            className={`lg:col-span-7 p-4 sm:p-5 rounded-2xl border flex flex-col gap-4 ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            {/* Quick Presets Dropdown */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                {lang === 'fa' ? 'الگوها و درخواست‌های آماده:' : 'Ready-to-use Presets:'}
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                {PRESETS.slice(0, 4).map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyPreset(p)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 border ${
                      isDark
                        ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/80'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {lang === 'fa' ? p.name.split('(')[0] : p.nameEn.split('(')[0]}
                    <span className="font-mono text-[9px] opacity-75 mr-1 ml-1">({p.method})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* URL & Method Bar */}
            <div
              dir="ltr"
              className={`flex items-center gap-2 p-1.5 rounded-xl border ${
                isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-300'
              }`}
            >
              {/* HTTP METHOD SELECTOR */}
              <select
                value={method}
                onChange={(e) => {
                  const newMethod = e.target.value as HttpMethod;
                  setMethod(newMethod);
                  if (['POST', 'PUT', 'PATCH'].includes(newMethod)) {
                    setSenderActiveSubTab('body');
                  }
                }}
                className={`px-3 py-2 rounded-lg font-mono font-black text-xs border outline-none cursor-pointer ${
                  METHOD_COLORS[method].bg
                } ${METHOD_COLORS[method].text} ${METHOD_COLORS[method].border}`}
              >
                {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as HttpMethod[]).map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-slate-100 font-bold">
                    {m}
                  </option>
                ))}
              </select>

              {/* URL INPUT */}
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.wallex.ir/... or /api/news.php"
                className={`flex-1 px-3 py-1.5 text-xs font-mono bg-transparent outline-none ${
                  isDark ? 'text-slate-100 placeholder-slate-600' : 'text-slate-900 placeholder-slate-400'
                }`}
              />

              {/* SEND BUTTON */}
              <button
                onClick={handleSend}
                disabled={loading || !url.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-md shadow-blue-600/30 transition-all shrink-0 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{lang === 'fa' ? 'ارسال (Send)' : 'Send'}</span>
              </button>
            </div>

            {/* REQUEST SUB-TABS: Headers / Body / Params */}
            <div className="flex border-b border-slate-800 gap-1 mt-1">
              <button
                onClick={() => setSenderActiveSubTab('headers')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                  senderActiveSubTab === 'headers'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3 h-3" />
                <span>هدرها (Headers)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {headers.filter((h) => h.enabled).length}
                </span>
              </button>

              <button
                onClick={() => setSenderActiveSubTab('body')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                  senderActiveSubTab === 'body'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3 h-3" />
                <span>بدنه (Body / JSON)</span>
                {['POST', 'PUT', 'PATCH'].includes(method) && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setSenderActiveSubTab('params')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all ${
                  senderActiveSubTab === 'params'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>پارامترها (Query Params)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {params.filter((p) => p.enabled).length}
                </span>
              </button>
            </div>

            {/* SUB-TAB CONTENT: HEADERS */}
            {senderActiveSubTab === 'headers' && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>هدرهای ارسالی درخواست (HTTP Request Headers)</span>
                  <button
                    onClick={addHeaderRow}
                    className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                  >
                    + افزودن هدر جدید
                  </button>
                </div>

                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {headers.map((h) => (
                    <div key={h.id} dir="ltr" className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={h.enabled}
                        onChange={(e) => updateHeaderRow(h.id, h.key, h.value, e.target.checked)}
                        className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                      />
                      <input
                        type="text"
                        placeholder="Key (e.g. Authorization)"
                        value={h.key}
                        onChange={(e) => updateHeaderRow(h.id, e.target.value, h.value, h.enabled)}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border outline-none ${
                          isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. application/json)"
                        value={h.value}
                        onChange={(e) => updateHeaderRow(h.id, h.key, e.target.value, h.enabled)}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border outline-none ${
                          isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                      <button
                        onClick={() => removeHeaderRow(h.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {headers.length === 0 && (
                    <div className="text-center py-4 text-xs text-slate-500">
                      هدری تعریف نشده است. برای افزودن روی «+ افزودن هدر جدید» کلیک کنید.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-TAB CONTENT: BODY */}
            {senderActiveSubTab === 'body' && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>بدنه خام درخواست (Raw JSON / Text Body)</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        try {
                          if (requestBody.trim()) {
                            setRequestBody(JSON.stringify(JSON.parse(requestBody), null, 2));
                          }
                        } catch {}
                      }}
                      className="text-blue-400 hover:text-blue-300 font-bold"
                    >
                      مرتب‌سازی JSON (Prettify)
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={() => setRequestBody('')}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      پاک کردن
                    </button>
                  </div>
                </div>

                <textarea
                  dir="ltr"
                  rows={8}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder={`{\n  "title": "خبر جدید",\n  "content": "متن خبر...",\n  "priority": "high"\n}`}
                  className={`w-full p-3 rounded-xl font-mono text-xs border outline-none resize-y ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-emerald-300 placeholder-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            )}

            {/* SUB-TAB CONTENT: PARAMS */}
            {senderActiveSubTab === 'params' && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>پارامترهای جستجو (Query Parameters: ?key=value)</span>
                  <button
                    onClick={addParamRow}
                    className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                  >
                    + افزودن پارامتر جدید
                  </button>
                </div>

                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {params.map((p) => (
                    <div key={p.id} dir="ltr" className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={(e) => updateParamRow(p.id, p.key, p.value, e.target.checked)}
                        className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                      />
                      <input
                        type="text"
                        placeholder="Parameter Name (e.g. limit)"
                        value={p.key}
                        onChange={(e) => updateParamRow(p.id, e.target.value, p.value, p.enabled)}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border outline-none ${
                          isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. 20)"
                        value={p.value}
                        onChange={(e) => updateParamRow(p.id, p.key, e.target.value, p.enabled)}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border outline-none ${
                          isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                      <button
                        onClick={() => removeParamRow(p.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {params.length === 0 && (
                    <div className="text-center py-4 text-xs text-slate-500">
                      پارامتری ثبت نشده است. برای تعریف روی «+ افزودن پارامتر جدید» کلیک کنید.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT / BOTTOM: RESPONSE VIEWER (5 Cols) */}
          <div
            className={`lg:col-span-5 p-4 sm:p-5 rounded-2xl border flex flex-col gap-3 min-h-[380px] ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-black">پاسخ دریافتی (Response Viewer)</span>
              </div>

              {response && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        typeof response.data === 'object'
                          ? JSON.stringify(response.data, null, 2)
                          : String(response.data || ''),
                        setCopiedResponse
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800"
                  >
                    {copiedResponse ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>کپی</span>
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                <p className="text-xs font-mono">در حال ارسال و دریافت پاسخ از سرور...</p>
              </div>
            ) : response ? (
              <div className="flex flex-col gap-3 flex-1">
                {/* STATUS BAR */}
                <div
                  dir="ltr"
                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-black ${
                        response.status >= 200 && response.status < 300
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : response.status >= 400
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      }`}
                    >
                      {response.status} {response.statusText}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {response.durationMs}ms
                    </span>
                    <span>{(response.sizeBytes / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* RESPONSE TABS */}
                <div className="flex border-b border-slate-800 gap-2">
                  <button
                    onClick={() => setResponseSubTab('body')}
                    className={`text-xs font-bold pb-1.5 border-b-2 transition-all ${
                      responseSubTab === 'body'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400'
                    }`}
                  >
                    بدنه پاسخ (Body)
                  </button>
                  <button
                    onClick={() => setResponseSubTab('headers')}
                    className={`text-xs font-bold pb-1.5 border-b-2 transition-all ${
                      responseSubTab === 'headers'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400'
                    }`}
                  >
                    هدرهای سرور (Headers) ({Object.keys(response.headers || {}).length})
                  </button>
                </div>

                {/* RESPONSE CONTENT */}
                <div className="flex-1 overflow-auto max-h-[340px]">
                  {responseSubTab === 'body' ? (
                    response.error ? (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-mono">
                        خطا در ارسال: {response.error}
                      </div>
                    ) : (
                      <pre
                        dir="ltr"
                        className="p-3 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed select-text"
                      >
                        {typeof response.data === 'object'
                          ? JSON.stringify(response.data, null, 2)
                          : String(response.data || '')}
                      </pre>
                    )
                  ) : (
                    <div dir="ltr" className="flex flex-col gap-1 text-xs font-mono">
                      {Object.entries(response.headers || {}).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-start justify-between p-1.5 rounded bg-slate-950/60 border border-slate-800/80 gap-2"
                        >
                          <span className="text-blue-400 font-bold shrink-0">{k}:</span>
                          <span className="text-slate-300 break-all text-right">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <Code2 className="w-10 h-10 opacity-30 mb-2" />
                <p className="text-xs">هنوز درخواستی ارسال نشده است.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  آدرس و متد مورد نظر خود را وارد کرده و روی دکمه «ارسال» کلیک کنید.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: RECEIVE & LIVE WEBHOOK (INCOMING API LISTENER)                  */}
      {/* ===================================================================== */}
      {activeTab === 'receive' && (
        <div className="flex flex-col gap-5">
          {/* WEBHOOK ENDPOINT INFO & CURL CARD */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <h4 className="text-sm font-black text-slate-100">
                    آدرس گیرنده وب‌هوک و دریافت API زنده (Webhook Receiver URL)
                  </h4>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  هر درخواستی با هر یک از متدهای GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD به این آدرس ارسال شود، به صورت بلادرنگ دریافت، تحلیل و ثبت می‌گردد.
                </p>
              </div>

              {/* QUICK TEST ACTION BUTTONS */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => sendTestPing('POST')}
                  disabled={testSending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>تست سریع ارسال POST به وب‌هوک</span>
                </button>
                <button
                  onClick={() => sendTestPing('GET')}
                  disabled={testSending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>تست سریع GET</span>
                </button>
              </div>
            </div>

            {/* URL Display */}
            <div
              dir="ltr"
              className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono mb-3"
            >
              <span className="text-emerald-400 font-bold select-all">{webhookUrl}</span>
              <button
                onClick={() => copyToClipboard(webhookUrl, setCopiedUrl)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800 transition-all shrink-0"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'کپی شد' : 'کپی آدرس'}</span>
              </button>
            </div>

            {/* CURL Example Generator */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-cyan-400" />
                  دستور cURL جهت تست از ترمینال، بات یا سرور خارجی:
                </span>
                <button
                  onClick={() => copyToClipboard(curlExample, setCopiedCurl)}
                  className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                >
                  {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>کپی دستور cURL</span>
                </button>
              </div>
              <pre
                dir="ltr"
                className="p-3 rounded-xl bg-slate-950 text-cyan-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap select-all"
              >
                {curlExample}
              </pre>
            </div>
          </div>

          {/* INCOMING REQUESTS LOGS VIEWER */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-black text-slate-100">
                  لاگ درخواست‌های دریافتی زنده ({webhookLogs.length} درخواست)
                </h4>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-[10px] text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>شنود زنده فعال</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchLogs}
                  disabled={fetchingLogs}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fetchingLogs ? 'animate-spin text-blue-400' : ''}`} />
                  <span>به‌روزرسانی</span>
                </button>

                <button
                  onClick={clearLogs}
                  disabled={webhookLogs.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 transition-all disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>پاک کردن لاگ‌ها</span>
                </button>
              </div>
            </div>

            {/* LOGS LIST + DETAILS VIEW */}
            {webhookLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 flex flex-col items-center justify-center gap-2">
                <Radio className="w-10 h-10 opacity-30 text-emerald-500 animate-pulse" />
                <p className="text-sm font-bold text-slate-400">در انتظار دریافت درخواست...</p>
                <p className="text-xs text-slate-500 max-w-md">
                  هر درخواست HTTP (با متدهای POST, GET, PUT, PATCH و...) که به آدرس وب‌هوک ارسال شود، به صورت زنده در این جدول ظاهر خواهد شد.
                </p>
                <button
                  onClick={() => sendTestPing('POST')}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all"
                >
                  ارسال یک درخواست نمونه تستی هم‌اکنون
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* LIST OF REQUESTS (5 Cols) */}
                <div className="lg:col-span-5 flex flex-col gap-2 max-h-[460px] overflow-y-auto pr-1">
                  {webhookLogs.map((log) => {
                    const isSelected = selectedLog?.id === log.id;
                    const colors = METHOD_COLORS[log.method as HttpMethod] || METHOD_COLORS.GET;

                    return (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-slate-800 border-blue-500 shadow-md shadow-blue-500/10'
                            : 'bg-slate-950/60 border-slate-800 hover:bg-slate-850'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border ${colors.bg} ${colors.text} ${colors.border}`}
                            >
                              {log.method}
                            </span>
                            <span className="text-xs font-mono text-slate-200 truncate max-w-[150px]">
                              {log.url}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">{log.timestamp}</span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>IP: {log.ip || '127.0.0.1'}</span>
                          <span className="truncate max-w-[140px] text-[10px]">
                            {log.headers['user-agent']?.slice(0, 20) || 'Unknown Client'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DETAILS OF SELECTED REQUEST (7 Cols) */}
                <div className="lg:col-span-7 p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-3 min-h-[320px]">
                  {selectedLog ? (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded text-xs font-mono font-black border ${
                              METHOD_COLORS[selectedLog.method as HttpMethod]?.bg || 'bg-slate-800'
                            } ${METHOD_COLORS[selectedLog.method as HttpMethod]?.text || 'text-slate-200'} ${
                              METHOD_COLORS[selectedLog.method as HttpMethod]?.border || 'border-slate-700'
                            }`}
                          >
                            {selectedLog.method}
                          </span>
                          <span className="text-xs font-mono text-slate-200 font-bold">{selectedLog.url}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-400">{selectedLog.timestamp}</span>
                      </div>

                      {/* QUERY PARAMS IF ANY */}
                      {Object.keys(selectedLog.query || {}).length > 0 && (
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block mb-1">
                            پارامترهای دریافتی (Query Parameters):
                          </span>
                          <div dir="ltr" className="p-2 rounded-lg bg-slate-900 text-xs font-mono text-blue-300">
                            {JSON.stringify(selectedLog.query, null, 2)}
                          </div>
                        </div>
                      )}

                      {/* PAYLOAD / BODY */}
                      <div className="flex-1 flex flex-col">
                        <span className="text-[11px] font-bold text-slate-400 block mb-1">
                          بدنه و محتوای ارسالی به وب‌هوک (Payload):
                        </span>
                        <pre
                          dir="ltr"
                          className="flex-1 p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-emerald-300 text-xs font-mono overflow-auto max-h-56 whitespace-pre-wrap select-text"
                        >
                          {selectedLog.body ? JSON.stringify(selectedLog.body, null, 2) : '(بدون داده بدنه)'}
                        </pre>
                      </div>

                      {/* HEADERS COLLAPSIBLE */}
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 block mb-1">
                          هدرهای درخواست ارسالی (Headers):
                        </span>
                        <div
                          dir="ltr"
                          className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] font-mono text-slate-300 max-h-32 overflow-y-auto"
                        >
                          {Object.entries(selectedLog.headers || {}).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-blue-400 font-bold shrink-0">{k}:</span>
                              <span className="text-slate-400 break-all">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                      یکی از لاگ‌های سمت چپ را برای مشاهده جزئیات انتخاب کنید.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
