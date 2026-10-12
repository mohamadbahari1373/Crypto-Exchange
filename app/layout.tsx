import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'دیده بُن | سامانه رصد و مقایسه صرافی‌های ارز دیجیتال (didehbon.ir)',
  description: 'سامانه دیده بُن (didehbon.ir) - ابزار تحلیل، پایش و مقایسه زنده حجم معاملات صرافی‌های ارز دیجیتال، جریان نقدینگی و اخبار',
  icons: {
    icon: '/favicon.svg',
    apple: '/didehbon-logo.svg',
  },
  openGraph: {
    title: 'دیده بُن | سامانه رصد و مقایسه صرافی‌های ارز دیجیتال (didehbon.ir)',
    description: 'سامانه دیده بُن (didehbon.ir) - ابزار تحلیل، پایش و مقایسه زنده حجم معاملات صرافی‌های ارز دیجیتال، جریان نقدینگی و اخبار',
    type: 'website',
    images: ['/didehbon-logo.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'دیده بُن | سامانه رصد و مقایسه صرافی‌های ارز دیجیتال (didehbon.ir)',
    description: 'سامانه دیده بُن (didehbon.ir) - ابزار تحلیل، پایش و مقایسه زنده حجم معاملات صرافی‌های ارز دیجیتال، جریان نقدینگی و اخبار',
    images: ['/didehbon-logo.svg'],
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

