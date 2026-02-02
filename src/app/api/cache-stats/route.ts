/**
 * Cache Stats API - Returns proxy token cache statistics
 *
 * GET /api/cache-stats
 * Returns: { hits, misses, bypassed, size, hitRate }
 */

import { NextResponse } from 'next/server';
import { getCacheStats } from '@/lib/proxy-token-cache';

export async function GET() {
  try {
    const stats = getCacheStats();
    return NextResponse.json(stats);
  } catch (error) {
    // If cache patch not loaded (shouldn't happen)
    return NextResponse.json({
      error: 'Cache stats unavailable',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
