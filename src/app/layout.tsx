import { ApplePwaSplash } from '@/app/apple-pwa-splash'
import { ProgressBar } from '@/components/progress-bar'
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { Analytics } from '@/lib/analytics/analytics'
import { getAnalyticsConfig } from '@/lib/analytics/config'
import { effectiveBaseUrl } from '@/lib/env'
import { TRPCProvider } from '@/trpc/client'
import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(effectiveBaseUrl),
    title: {
      default: 'Expenses',
      template: '%s · Expenses',
    },
    description:
      'Split expenses, track balances, and settle up with your groups.',
    openGraph: {
      title: 'Expenses',
      description:
        'Split expenses, track balances, and settle up with your groups.',
      type: 'website',
      url: '/',
    },
    twitter: {
      card: 'summary',
      title: 'Expenses',
      description:
        'Split expenses, track balances, and settle up with your groups.',
    },
    appleWebApp: {
      capable: true,
      title: 'Expenses',
    },
    applicationName: 'Expenses',
    icons: [
      {
        url: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

export const viewport: Viewport = {
  themeColor: '#047857',
}

function Content({ children }: { children: React.ReactNode }) {
  const t = useTranslations()
  return (
    <TRPCProvider>
      <header className="fixed top-0 left-0 right-0 h-16 flex justify-between bg-white dark:bg-gray-950 bg-opacity-50 dark:bg-opacity-50 p-2 border-b backdrop-blur-sm z-50">
        <Link
          className="flex items-center gap-2 hover:scale-105 transition-transform"
          href="/"
          aria-label={t('Header.groups')}
        >
          <Image
            src="/logo/192x192.png"
            className="m-1 h-[35px] w-[35px]"
            width={35}
            height={35}
            alt=""
          />
        </Link>
        <div role="navigation" aria-label="Menu" className="flex">
          <ul className="flex items-center text-sm">
            <li>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="-my-3 text-primary"
              >
                <Link href="/groups">{t('Header.groups')}</Link>
              </Button>
            </li>
            <li>
              <ThemeToggle />
            </li>
          </ul>
        </div>
      </header>

      <div className="pt-16 flex-1 flex flex-col">{children}</div>

      <Toaster />
    </TRPCProvider>
  )
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()
  const analyticsConfig = await getAnalyticsConfig()
  return (
    <html
      lang={locale}
      dir={['ar', 'he'].includes(locale) ? 'rtl' : 'ltr'}
      suppressHydrationWarning
    >
      <ApplePwaSplash icon="/logo/192x192.png" color="#047857" />
      <body className="min-h-[100dvh] flex flex-col items-stretch bg-slate-50 bg-opacity-30 dark:bg-background">
        <NextIntlClientProvider messages={messages}>
          {/* Rendered inside the provider because it reads translations via
              `useTranslations`, which needs NextIntlClientProvider in its
              ancestor tree. */}
          <ServiceWorkerRegistration />
          <Analytics config={analyticsConfig}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <Suspense>
                <ProgressBar />
              </Suspense>
              <Content>{children}</Content>
            </ThemeProvider>
          </Analytics>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
