import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
