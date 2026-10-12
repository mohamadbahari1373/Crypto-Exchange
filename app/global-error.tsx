'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const msg = error?.message?.toLowerCase() || '';
    if (
      msg.includes('metamask') ||
      msg.includes('ethereum') ||
      msg.includes('chrome-extension')
    ) {
      reset();
      return;
    }
    console.error('Global Application Error:', error);
  }, [error, reset]);

  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900 text-slate-100">
        <h2 className="text-xl font-bold mb-2">خطای سیستمی</h2>
        <p className="text-xs text-slate-400 mb-4">مشکلی در بارگذاری رخ داده است.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all"
        >
          تلاش مجدد
        </button>
      </body>
    </html>
  );
}
