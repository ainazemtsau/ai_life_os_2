import type { Metadata } from 'next';
import './globals.css';
import { TopNavbar } from '@ai-life-os/ui';

export const metadata: Metadata = {
  title: 'AI Life OS',
  description: 'Personal AI assistant for life management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen flex-col overflow-hidden">
        <TopNavbar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
