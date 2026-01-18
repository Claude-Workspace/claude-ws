import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { SocketProvider } from '@/components/providers/socket-provider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: 'Claude Workspace',
  description: 'Workspace powered by Claude Code CLI',
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <SocketProvider>
          <ThemeProvider>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </ThemeProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
