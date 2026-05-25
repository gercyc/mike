import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'pt-BR'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  localeCookie: {
    name: 'MIKE_LOCALE',
    sameSite: 'lax',
    path: '/',
  },
});
