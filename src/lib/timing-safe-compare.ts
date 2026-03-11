import { timingSafeEqual } from 'crypto';

/**
 * Timing-safe string comparison to prevent timing attacks on API key validation.
 * Isolated from Next.js dependencies so it can be safely imported by server.ts
 * (which runs in a tsx/Node.js context without Next.js AsyncLocalStorage).
 */
export function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
