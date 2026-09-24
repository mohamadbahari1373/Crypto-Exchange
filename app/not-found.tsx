import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900 text-slate-100">
      <h2 className="text-2xl font-bold mb-2">صفحه مورد نظر یافت نشد</h2>
      <p className="text-sm text-slate-400 mb-4">آدرس درخواست شده در سامانه وجود ندارد.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all"
      >
        بازگشت به صفحه اصلی
      </Link>
    </div>
  );
}
