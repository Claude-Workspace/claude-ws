'use client';

// Force dynamic rendering to avoid Next.js 16 Turbopack build bug
export const dynamic = 'force-dynamic';

import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('notFound');
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', textAlign: 'center' }}>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <a href="/" style={{ color: '#0070f3', textDecoration: 'underline' }}>
        {t('goHome')}
      </a>
    </div>
  );
}
