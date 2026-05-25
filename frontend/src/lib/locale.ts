export const LOCALE_COOKIE = 'MIKE_LOCALE';
export const SUPPORTED_LOCALES = ['en', 'pt-BR'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function getLocaleCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
  return match ? match.split('=')[1] : undefined;
}

export function setLocaleCookie(locale: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; SameSite=Lax`;
}
