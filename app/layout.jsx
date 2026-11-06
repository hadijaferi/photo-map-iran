import './globals.css';

const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata = {
  title: 'ردِ سفر | آلبوم عکس روی نقشه',
  description: 'عکس‌های سفرت رو به شهرها وصل کن و ازشون استوری بساز.',
  manifest: base + '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'ردِ سفر' },
  icons: { apple: base + '/icon-192.png', icon: base + '/icon-192.png' },
};

export const viewport = { themeColor: '#f5f4eb' };

export default function Layout({children}) {
  return <html lang="fa" dir="rtl">
    <head><style>{`@font-face{font-family:Vazirmatn;font-weight:100 900;font-display:swap;src:url("${base}/vazirmatn.woff2") format("woff2")}`}</style></head>
    <body>{children}</body>
  </html>;
}
