'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Copy,
  Check,
  Zap,
  Terminal,
  ExternalLink,
  Code2,
  Workflow,
  Sparkles,
  Bot,
  Layers,
  MessageSquare,
  Flame,
  CheckCircle2,
  AlertCircle,
  Clock,
  Hash,
  Share2,
} from 'lucide-react';
import { NewsArticle } from '@/lib/types';

interface N8nTelegramNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sampleArticle?: NewsArticle;
  isDark: boolean;
}

export default function N8nTelegramNewsModal({
  isOpen,
  onClose,
  sampleArticle,
  isDark,
}: N8nTelegramNewsModalProps) {
  const [activeTab, setActiveTab] = useState<'endpoint' | 'preview' | 'webhook' | 'blueprint'>('endpoint');
  const [channelUsername, setChannelUsername] = useState<string>('@WallexCryptoNews');
  const [channelTitle, setChannelTitle] = useState<string>('اخبار والکس');
  const [sinceMinutes, setSinceMinutes] = useState<string>('20');
  const [limit, setLimit] = useState<string>('5');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [onlyWithImages, setOnlyWithImages] = useState<boolean>(false);

  // Webhook Tester
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [dispatchLoading, setDispatchLoading] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<any | null>(null);

  // Copy states
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedCurl, setCopiedCurl] = useState<boolean>(false);
  const [copiedBlueprint, setCopiedBlueprint] = useState<boolean>(false);
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Build query string
  const queryParams = new URLSearchParams();
  if (limit) queryParams.set('limit', limit);
  if (sinceMinutes) queryParams.set('since_minutes', sinceMinutes);
  if (categoryFilter !== 'all') queryParams.set('category', categoryFilter);
  if (onlyWithImages) queryParams.set('only_with_images', 'true');
  if (channelUsername) queryParams.set('channel_username', channelUsername);
  if (channelTitle) queryParams.set('channel_title', channelTitle);

  const apiEndpointUrl = `${origin || ''}/api/n8n/news?${queryParams.toString()}`;
  const curlCommand = `curl -X GET "${apiEndpointUrl}" -H "Accept: application/json"`;

  const copyToClipboard = (text: string, type: 'url' | 'curl' | 'blueprint' | 'html') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === 'curl') {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else if (type === 'blueprint') {
      setCopiedBlueprint(true);
      setTimeout(() => setCopiedBlueprint(false), 2000);
    } else if (type === 'html') {
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) return;
    setDispatchLoading(true);
    setDispatchResult(null);

    try {
      const res = await fetch('/api/n8n/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          articleId: sampleArticle?.id,
          limit: 1,
          channelUsername,
          channelTitle,
        }),
      });

      const data = await res.json();
      setDispatchResult(data);
    } catch (err: any) {
      setDispatchResult({
        success: false,
        error: err?.message || 'خطا در برقراری ارتباط با وب‌هوک',
      });
    } finally {
      setDispatchLoading(false);
    }
  };

  const sampleTitle = sampleArticle?.title || 'رشد چشمگیر حجم معاملات بیت‌کوین و رکوردشکنی نقدینگی در صرافی‌های داخلی';
  const sampleSummary = sampleArticle?.summary || 'بررسی روند معاملات ۲۴ ساعته نشان می‌دهد جریان نقدینگی به بازارهای تومانی و تتری افزایش یافته و خریداران کنترل روند را در دست دارند.';
  const sampleSource = sampleArticle?.sourceNameFa || 'میهن بلاکچین';
  const sampleImage = sampleArticle?.imageUrl || 'https://images.unsplash.com/photo-1622979135225-d2ba269bc1df?w=800&auto=format&fit=crop&q=80';

  const n8nWorkflowJsonString = JSON.stringify(
    {
      name: 'Wallex News to Telegram Channel (Auto Dispatch)',
      nodes: [
        {
          parameters: {
            rule: {
              interval: [
                {
                  field: 'minutes',
                  minutesInterval: parseInt(sinceMinutes, 10) || 15,
                },
              ],
            },
          },
          id: 'schedule-trigger-wallex',
          name: 'هر ۱۵ دقیقه (Schedule Trigger)',
          type: 'n8n-nodes-base.scheduleTrigger',
          typeVersion: 1.2,
          position: [240, 300],
        },
        {
          parameters: {
            url: apiEndpointUrl,
            options: {
              response: {
                response: {
                  responseFormat: 'json',
                },
              },
            },
          },
          id: 'http-fetch-wallex-news',
          name: 'دریافت اخبار والکس (HTTP Request)',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 4.2,
          position: [460, 300],
        },
        {
          parameters: {
            fieldToSplitOut: 'items',
            options: {},
          },
          id: 'split-news-items',
          name: 'تفکیک آیتم‌ها (Item Lists)',
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
          id: 'check-has-image',
          name: 'بررسی داشتن تصویر؟ (If)',
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
          id: 'telegram-send-photo',
          name: 'ارسال عکس با کپشن (Telegram)',
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
          id: 'telegram-send-message',
          name: 'ارسال پیام متنی (Telegram)',
          type: 'n8n-nodes-base.telegram',
          typeVersion: 1.2,
          position: [1120, 420],
        },
      ],
      connections: {
        'هر ۱۵ دقیقه (Schedule Trigger)': {
          main: [[{ node: 'دریافت اخبار والکس (HTTP Request)', type: 'main', index: 0 }]],
        },
        'دریافت اخبار والکس (HTTP Request)': {
          main: [[{ node: 'تفکیک آیتم‌ها (Item Lists)', type: 'main', index: 0 }]],
        },
        'تفکیک آیتم‌ها (Item Lists)': {
          main: [[{ node: 'بررسی داشتن تصویر؟ (If)', type: 'main', index: 0 }]],
        },
        'بررسی داشتن تصویر؟ (If)': {
          main: [
            [{ node: 'ارسال عکس با کپشن (Telegram)', type: 'main', index: 0 }],
            [{ node: 'ارسال پیام متنی (Telegram)', type: 'main', index: 0 }],
          ],
        },
      },
    },
    null,
    2
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 text-slate-100 rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  اتصال API اخبار به n8n و کانال تلگرام
                </h3>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  آماده اتصال
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                طراحی شده اختصاصی جهت دریافت، ترجمه و فرمت‌بندی هوشمند اخبار کریپتو برای ارسال خودکار به تلگرام
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 px-5 gap-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('endpoint')}
            className={`py-3 px-3 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'endpoint'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            آدرس API و تنظیمات فیلتر
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-3 px-3 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'preview'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-4 h-4" />
            پیش‌نمایش در تلگرام (Telegram View)
          </button>
          <button
            onClick={() => setActiveTab('blueprint')}
            className={`py-3 px-3 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'blueprint'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            کد آماده ایمپورت در n8n (Blueprint)
          </button>
          <button
            onClick={() => setActiveTab('webhook')}
            className={`py-3 px-3 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'webhook'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            تست آنلاین وب‌هوک n8n
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-6">
          {/* TAB 1: ENDPOINT & QUERY CONFIG */}
          {activeTab === 'endpoint' && (
            <div className="space-y-5">
              {/* Endpoint Card */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-mono text-[10px] font-bold">
                      GET
                    </span>
                    <span className="text-xs font-bold text-slate-300">
                      آدرس اندپوینت HTTP برای نود n8n:
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(apiEndpointUrl, 'url')}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-bold bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-lg transition-all"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'کپی شد!' : 'کپی آدرس API'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 font-mono text-xs text-cyan-300 select-all break-all text-left dir-ltr">
                  {apiEndpointUrl}
                </div>
              </div>

              {/* Interactive Config Form */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60">
                <h4 className="text-xs font-extrabold text-amber-300 mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  تنظیم پارامترهای ارسالی به تلگرام (Live Query Builder)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Channel Username */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      آیدی کانال تلگرام (جهت واترمارک و فوتر)
                    </label>
                    <input
                      type="text"
                      value={channelUsername}
                      onChange={(e) => setChannelUsername(e.target.value)}
                      placeholder="@Wallex_Crypto"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  {/* Channel Title */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      عنوان نمایشی کانال در پیام
                    </label>
                    <input
                      type="text"
                      value={channelTitle}
                      onChange={(e) => setChannelTitle(e.target.value)}
                      placeholder="کانال والکس"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Time Window (since_minutes) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      بازه زمانی خبرها (مناسب کران‌جاب n8n)
                    </label>
                    <select
                      value={sinceMinutes}
                      onChange={(e) => setSinceMinutes(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                    >
                      <option value="15">۱۵ دقیقه اخیر (کران ۱۵ دقیقه‌ای)</option>
                      <option value="20">۲۰ دقیقه اخیر (پیشنهادی با اورلپ)</option>
                      <option value="30">۳۰ دقیقه اخیر</option>
                      <option value="60">۱ ساعت اخیر</option>
                      <option value="180">۳ ساعت اخیر</option>
                      <option value="">همه خبرهای جدید بدون فیلتر زمان</option>
                    </select>
                  </div>

                  {/* Limit */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      تعداد خبر دریافتی در هر بار فراخوانی
                    </label>
                    <select
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                    >
                      <option value="1">۱ خبر (جدیدترین)</option>
                      <option value="3">۳ خبر برتر</option>
                      <option value="5">۵ خبر</option>
                      <option value="10">۱۰ خبر</option>
                    </select>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">دسته‌بندی خبرها</label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                    >
                      <option value="all">همه دسته‌ها (صرافی‌ها و تحلیل بازار)</option>
                      <option value="exchanges">فقط اخبار صرافی‌ها (کارمزد، لیست ارز...)</option>
                      <option value="market">فقط اخبار بازار و قیمت‌ها</option>
                    </select>
                  </div>

                  {/* Image only check */}
                  <div className="flex items-center mt-5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={onlyWithImages}
                        onChange={(e) => setOnlyWithImages(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                      />
                      <span className="text-xs text-slate-300 font-medium">
                        فقط خبرهای دارای تصویر شاخص
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* cURL Example Card */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    دستور تست cURL برای ترمینال:
                  </span>
                  <button
                    onClick={() => copyToClipboard(curlCommand, 'curl')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded transition-all"
                  >
                    {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCurl ? 'کپی شد' : 'کپی دستور'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-slate-900 rounded font-mono text-[11px] text-slate-300 text-left dir-ltr overflow-x-auto">
                  {curlCommand}
                </div>
              </div>

              {/* Key Features for Telegram */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
                  <div className="font-bold text-xs text-emerald-400 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    فرمت‌بندی آماده تلگرام
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    فیلد <code>$json.telegram.html</code> با ایموجی‌های جذاب، بولد، ایتالیک و تگ‌های HTML بهینه آماده ارسال به ربات تلگرام است.
                  </p>
                </div>

                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
                  <div className="font-bold text-xs text-amber-400 mb-1 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" />
                    هشتگ‌گذاری و تشخیص ارزها
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    استخراج خودکار رمزارزهای موجود در متن مانند <code>#BTC</code>، <code>#ETH</code>، <code>#والکس</code> جهت سرچ در تلگرام.
                  </p>
                </div>

                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
                  <div className="font-bold text-xs text-cyan-400 mb-1 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    کپشن مخصوص عکس (sendPhoto)
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    فیلد <code>$json.telegram.caption_html</code> زیر ۱۰۲۴ کاراکتر تضمین شده برای ارسال به همراه عکس شاخص بدون خطا.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TELEGRAM MESSAGE PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300">
                  پیش‌نمایش زنده ظاهر پیام داخل کانال تلگرام شما:
                </h4>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `🔥 ${sampleTitle}\n\n📝 ${sampleSummary}\n\n📊 سیگنال بازار: 🟢 صعودی\n📰 منبع: ${sampleSource} | ⏱ ۱۴:۳۰\n🔗 مطالعه کامل در منبع: ${sampleArticle?.url || 'https://wallex.ir'}\n\n#بیت_کوین #BTC #اخبار_رمزارز\n🆔 ${channelUsername}`,
                      'html'
                    )
                  }
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                >
                  {copiedHtml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedHtml ? 'کپی شد!' : 'کپی متن پیام تلگرام'}</span>
                </button>
              </div>

              {/* Telegram Channel Mockup */}
              <div className="max-w-md mx-auto bg-[#0f1926] rounded-2xl p-4 border border-slate-700 shadow-2xl relative overflow-hidden">
                {/* Header Mockup */}
                <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                    W
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{channelTitle}</div>
                    <div className="text-[10px] text-slate-400">{channelUsername} • 14,200 members</div>
                  </div>
                </div>

                {/* Message Bubble */}
                <div className="bg-[#182533] rounded-2xl p-3.5 border border-slate-700/60 text-slate-100 shadow-md">
                  {/* Photo if available */}
                  {sampleImage && (
                    <div className="w-full h-44 rounded-xl overflow-hidden mb-3 bg-slate-900 border border-slate-700/40">
                      <img
                        src={sampleImage}
                        alt="News preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Title */}
                  <div className="font-extrabold text-sm text-white mb-2 leading-snug">
                    🔥 {sampleTitle}
                  </div>

                  {/* Summary */}
                  <div className="text-xs text-slate-300 leading-relaxed mb-3">
                    📝 {sampleSummary}
                  </div>

                  {/* Metadata & Signals */}
                  <div className="text-[11px] text-slate-400 space-y-1 mb-3 pt-2 border-t border-slate-700/50">
                    <div className="flex items-center gap-1.5">
                      <span>📊 <b>سیگنال بازار:</b></span>
                      <span className="text-emerald-400 font-bold">🟢 صعودی / مثبت</span>
                    </div>
                    <div>
                      📰 <b>منبع:</b> {sampleSource} | ⏱ ۱۴:۳۰
                    </div>
                    <div>
                      🔗 <span className="text-blue-400 underline cursor-pointer">مطالعه متن کامل خبر در منبع</span>
                    </div>
                  </div>

                  {/* Hashtags */}
                  <div className="text-[11px] font-mono text-cyan-400 mb-2">
                    #بیت_کوین #BTC #والکس #اخبار_رمزارز #کریپتو
                  </div>

                  {/* Channel Signature */}
                  <div className="text-[11px] font-bold text-blue-400 flex items-center justify-between pt-2 border-t border-slate-700/50">
                    <span>🆔 {channelTitle}: {channelUsername}</span>
                    <span className="text-[10px] text-slate-500 font-mono">14:32</span>
                  </div>
                </div>

                {/* Inline Buttons Mockup */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="bg-[#243447] text-cyan-300 text-[11px] font-bold py-1.5 text-center rounded-xl border border-cyan-500/30">
                    📖 مطالعه کامل در منبع
                  </div>
                  <div className="bg-[#243447] text-emerald-300 text-[11px] font-bold py-1.5 text-center rounded-xl border border-emerald-500/30">
                    📈 ترید در والکس
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: READY-TO-IMPORT N8N BLUEPRINT */}
          {activeTab === 'blueprint' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-extrabold text-white">
                    کد آماده ورک‌فلو کامل در n8n (نصب با یک کلیک):
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    این کد JSON را کپی کنید، وارد نرم‌افزار n8n شوید و کلیدهای <code>Ctrl + V</code> را روی بوم خالی فشار دهید.
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(n8nWorkflowJsonString, 'blueprint')}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg transition-all"
                >
                  {copiedBlueprint ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedBlueprint ? 'ورک‌فلو کپی شد!' : 'کپی ورک‌فلو n8n (JSON)'}</span>
                </button>
              </div>

              {/* Step by step guide */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs mb-1.5">
                    ۱
                  </div>
                  <div className="text-xs font-bold text-white mb-0.5">Schedule Trigger</div>
                  <p className="text-[10px] text-slate-400">اجرای خودکار هر ۱۵ الی ۲۰ دقیقه</p>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs mb-1.5">
                    ۲
                  </div>
                  <div className="text-xs font-bold text-white mb-0.5">HTTP Request</div>
                  <p className="text-[10px] text-slate-400">فراخوانی این API جهت دریافت خبرها</p>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs mb-1.5">
                    ۳
                  </div>
                  <div className="text-xs font-bold text-white mb-0.5">Item Lists</div>
                  <p className="text-[10px] text-slate-400">تفکیک آرایه خبرها به آیتم‌های مجزا</p>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs mb-1.5">
                    ۴
                  </div>
                  <div className="text-xs font-bold text-white mb-0.5">Telegram Bot</div>
                  <p className="text-[10px] text-slate-400">ارسال با فرمت HTML به کانال تلگرام</p>
                </div>
              </div>

              {/* JSON Viewer */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-72 overflow-y-auto">
                <pre className="text-[11px] font-mono text-cyan-300/90 text-left dir-ltr whitespace-pre-wrap">
                  {n8nWorkflowJsonString}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: WEBHOOK TEST DISPATCHER */}
          {activeTab === 'webhook' && (
            <div className="space-y-4">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60">
                <h4 className="text-xs font-extrabold text-white mb-1 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  تست ارسال مستقیم خبر به وب‌هوک n8n شما:
                </h4>
                <p className="text-[11px] text-slate-400 mb-3">
                  اگر در n8n یک نود <b>Webhook</b> ایجاد کرده‌اید، آدرس Test Webhook URL یا Production Webhook URL آن را اینجا وارد کنید و دکمه ارسال را بزنید تا خروجی را بررسی کنید:
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://n8n.yourdomain.com/webhook/test-crypto-news"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 font-mono text-left dir-ltr"
                  />
                  <button
                    onClick={handleTestWebhook}
                    disabled={dispatchLoading || !webhookUrl.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-lg shadow-emerald-600/20"
                  >
                    {dispatchLoading ? (
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>{dispatchLoading ? 'در حال ارسال...' : 'ارسال خبر تست به n8n'}</span>
                  </button>
                </div>
              </div>

              {/* Dispatch Result Card */}
              {dispatchResult && (
                <div
                  className={`p-4 rounded-xl border animate-in fade-in duration-200 ${
                    dispatchResult.success
                      ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                      : 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2 font-bold text-xs">
                    {dispatchResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>{dispatchResult.message || dispatchResult.error}</span>
                    {dispatchResult.status && (
                      <span className="font-mono text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        Status: {dispatchResult.status} ({dispatchResult.elapsedMs}ms)
                      </span>
                    )}
                  </div>

                  {dispatchResult.sampleSent && (
                    <div className="mt-2 text-[11px] bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-slate-300">
                      <div className="font-bold text-white mb-1">متن ارسال‌شده به وب‌هوک:</div>
                      <div className="font-mono text-[10px] text-cyan-300">{dispatchResult.sampleSent.title}</div>
                      <div className="mt-1 text-slate-400">{dispatchResult.sampleSent.summary}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>داده‌ها شامل ترجمه فارسی، استخراج هشتگ و تحلیل صعودی/نزولی هستند.</span>
          </div>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-1.5 rounded-xl transition-all"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
