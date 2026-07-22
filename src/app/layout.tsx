import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/authContext';
import { ToastProvider } from '@/lib/toastContext';
import { ThemeProvider } from '@/lib/themeContext';
import { RostersProvider } from '@/lib/rostersContext';

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
        <ThemeProvider>
          <AuthProvider>
            <RostersProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </RostersProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
