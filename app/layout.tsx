import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: '내도?돼!',
  description:
    '제출 요강과 제출물을 넣으면, 요강에서 요건을 뽑아내고 텍스트로 확인 가능한 항목만 판정해요.',
  icons: {
    icon: ['/icons/favicon-16.png', '/icons/favicon-32.png', '/icons/favicon.ico'],
    apple: '/icons/apple-touch-icon_180.png',
    other: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
