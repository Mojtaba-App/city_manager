import type { Metadata } from 'next';
import './globals.css';
import { BrandingHead } from '@/components/BrandingHead';

export const metadata: Metadata = {
  title: 'سامانه مدیریت بازآفرینی شهری',
  description: 'پلتفرم سازمانی مدیریت محلات هدف و خانوارهای تحت حمایت',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

const themeBootScript = `
(function(){
  try {
    var t = localStorage.getItem('cm-theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <BrandingHead />
        {children}
      </body>
    </html>
  );
}
