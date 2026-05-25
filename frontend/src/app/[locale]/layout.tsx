import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Providers } from '@/components/providers';
import { BuiltinWorkflowsLoader } from '@/app/components/workflows/BuiltinWorkflowsLoader';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    openGraph: {
      type: 'website',
      url: 'https://app.mikeoss.com',
      siteName: 'Mike',
      title: t('meta.title'),
      description: t('meta.description'),
      images: [{ url: '/link-image.jpg', width: 1200, height: 651, alt: 'Mike' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('meta.title'),
      description: t('meta.description'),
      images: ['/link-image.jpg'],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'en' | 'pt-BR')) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <BuiltinWorkflowsLoader locale={locale}>
        <Providers>{children}</Providers>
      </BuiltinWorkflowsLoader>
    </NextIntlClientProvider>
  );
}
