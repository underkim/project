import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Life Dashboard',
  description: '5년 라이프 로드맵 대시보드',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full antialiased bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
