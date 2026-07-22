import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NCCF Family House Schedules',
  description: 'Official schedule board for Prayer, Service, Cleaning, and Cooking rosters at NCCF Family House.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased watermark-bg min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
