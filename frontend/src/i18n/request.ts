import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as 'en' | 'pt-BR')) {
    locale = routing.defaultLocale;
  }
  const namespaces = [
    'common', 'account', 'assistant', 'projects',
    'workflows', 'workflows-data', 'tabular', 'modals', 'auth'
  ];
  const messages = Object.assign(
    {},
    ...await Promise.all(
      namespaces.map(ns =>
        import(`../messages/${locale}/${ns}.json`).then(m => ({ [ns]: m.default }))
      )
    )
  );
  return { locale, messages };
});
