// Builds the flat label map passed to ctunnel wizard step views
// Centralises all translation key references in one place

import type { useTranslations } from 'next-intl';

type T = ReturnType<typeof useTranslations<'accessAnywhere'>>;

export function buildCtunnelLabels(t: T): Record<string, string> {
  return {
    email: t('email'),
    emailPlaceholder: t('emailPlaceholder'),
    subdomain: t('subdomain'),
    subdomainPlaceholder: t('subdomainPlaceholder'),
    subdomainHint: t('subdomainHint'),
    subdomainBelongsToYou: t('subdomainBelongsToYou'),
    subdomainAvailable: t('subdomainAvailable'),
    notAvailable: t('notAvailable'),
    back: t('back'),
    checking: t('checking'),
    registering: t('registering'),
    continue: t('continue'),
    confirmationCodeSent: t('confirmationCodeSent'),
    confirmationCode: t('confirmationCode'),
    confirmationCodePlaceholder: t('confirmationCodePlaceholder'),
    verifying: t('verifying'),
    verifyAndStart: t('verifyAndStart'),
    subdomainRegistered: t('subdomainRegistered'),
    workspaceAccessibleAt: t('workspaceAccessibleAt'),
    yourPublicUrl: t('yourPublicUrl'),
    copyUrl: t('copyUrl'),
    urlCopied: t('urlCopied'),
    testYourUrl: t('testYourUrl'),
    testYourUrlDescription: t('testYourUrlDescription'),
    finish: t('finish'),
    error: t('error'),
    tryAgain: t('tryAgain'),
    connecting: t('connecting'),
  };
}
