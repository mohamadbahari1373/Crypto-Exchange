import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'سامانه مقایسه حجم صرافی‌های ارز دیجیتال',
  description: 'ابزار تحلیل و مقایسه زنده حجم معاملات صرافی‌های ارز دیجیتال به تفکیک تومان جهت بهبود تجربه مشتری و ارزیابی رقابتی',
  openGraph: {
    title: 'سامانه مقایسه حجم صرافی‌های ارز دیجیتال',
    description: 'ابزار تحلیل و مقایسه زنده حجم معاملات صرافی‌های ارز دیجیتال به تفکیک تومان جهت بهبود تجربه مشتری و ارزیابی رقابتی',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'سامانه مقایسه حجم صرافی‌های ارز دیجیتال',
    description: 'ابزار تحلیل و مقایسه زنده حجم معاملات صرافی‌های ارز دیجیتال به تفکیک تومان جهت بهبود تجربه مشتری و ارزیابی رقابتی',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Intercept unhandled extension errors (e.g. MetaMask injected script connection failures in iframe)
                if (typeof window !== 'undefined') {
                  var isExtensionError = function(msg) {
                    if (!msg) return false;
                    var str = String(msg).toLowerCase();
                    return (
                      str.indexOf('metamask') !== -1 ||
                      str.indexOf('failed to connect to metamask') !== -1 ||
                      str.indexOf('chrome-extension://') !== -1 ||
                      str.indexOf('moz-extension://') !== -1 ||
                      str.indexOf('ethereum') !== -1 ||
                      str.indexOf('inpage.js') !== -1
                    );
                  };

                  window.addEventListener('unhandledrejection', function(event) {
                    var reason = event.reason;
                    var message = (reason && (reason.message || reason.toString())) || '';
                    if (isExtensionError(message)) {
                      event.preventDefault();
                      event.stopPropagation();
                    }
                  }, true);

                  window.addEventListener('error', function(event) {
                    var message = event.message || (event.error && event.error.message) || '';
                    var filename = event.filename || '';
                    if (isExtensionError(message) || isExtensionError(filename)) {
                      event.preventDefault();
                      event.stopPropagation();
                    }
                  }, true);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen selection:bg-slate-700 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

