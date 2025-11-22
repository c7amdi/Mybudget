
'use client';

import React from 'react';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider, useAuth, useFirebase } from '@/firebase';
import { TopNav } from '@/components/layout/top-nav';
import { LanguageProvider } from '@/context/language-context';
import { ThemeProvider } from 'next-themes';
import { usePathname } from 'next/navigation';

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isSessionInitialized } = useFirebase();
  
  const showNav = user && pathname !== '/login';

  if (!isSessionInitialized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
          <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      {showNav && <TopNav />}
      <main className={cn(
        "flex-1 w-full",
        showNav && "p-4 md:p-6 lg:p-8 max-w-screen-2xl mx-auto"
      )}>
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LanguageProvider>
      {({ language, direction }) => (
        <html lang={language} dir={direction} suppressHydrationWarning>
          <head>
            <title>BudgetWise</title>
            <meta name="description" content="Manage all your detailed expenses and incomes." />
            <link rel="manifest" href="/manifest.json" />
            <link rel="apple-touch-icon" href="/icon-192x192.png" />
            <meta name="theme-color" content="#1f6f6f" />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
          </head>
          <body className={cn('font-body antialiased')}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <FirebaseClientProvider>
                <AppContent>{children}</AppContent>
              </FirebaseClientProvider>
              <Toaster />
            </ThemeProvider>
          </body>
        </html>
      )}
    </LanguageProvider>
  );
}
