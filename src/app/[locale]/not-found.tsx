'use client';

// Force dynamic rendering to avoid Next.js 16 Turbopack build bug
export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', textAlign: 'center' }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/" style={{ color: '#0070f3', textDecoration: 'underline' }}>
        Go back home
      </a>
    </div>
  );
}
