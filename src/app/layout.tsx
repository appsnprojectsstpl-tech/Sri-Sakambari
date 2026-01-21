import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase';
import { LanguageProvider } from '@/context/language-context';
import { ThemeProvider } from '@/components/theme-provider';
import { FlyToCartProvider } from '@/components/fly-to-cart-context';
import FlyToCartOverlay from '@/components/fly-to-cart-overlay';
import CrashReporter from '@/components/crash-reporter';
import { BottomNav } from '@/components/bottom-nav';
import AuthGuard from '@/components/auth-guard';
import ServiceWorkerRegister from '@/components/service-worker-register';
import OrderUpdatesListener from '@/components/order-updates-listener';
import { UpdateChecker } from '@/components/update-checker';

export const metadata: Metadata = {
  title: 'Sri Sakambari',
  description: 'Fresh vegetables and groceries, delivered to your doorstep.',
};

import { Outfit } from 'next/font/google';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />
      </head>
      <body
        suppressHydrationWarning
        className={cn(
          'min-h-screen bg-background antialiased',
          outfit.className,
          'font-extrabold'
        )}
      >
        <FirebaseClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <LanguageProvider>
              <FlyToCartProvider>
                <CrashReporter />
                <ServiceWorkerRegister />
                <AuthGuard>
                  <FlyToCartOverlay />
                  <OrderUpdatesListener />
                  <UpdateChecker headless />
                  {children}
                </AuthGuard>
              </FlyToCartProvider>
            </LanguageProvider>
          </ThemeProvider>
        </FirebaseClientProvider>
        <BottomNav />
        <Toaster />
      </body>
    </html>
  );
}

