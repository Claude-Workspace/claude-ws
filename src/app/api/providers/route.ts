/**
 * Provider API Route - List available LLM providers
 *
 * GET /api/providers
 * Returns list of registered providers with availability info
 */

import { NextResponse } from 'next/server';
import {
  getProviderRegistry,
  initializeProviders,
} from '@/lib/providers';

export async function GET() {
  // Ensure providers are initialized
  initializeProviders();

  const registry = getProviderRegistry();
  const providers = await registry.listWithInfo();
  const defaultId = registry.getDefault().id;

  return NextResponse.json({
    providers,
    defaultId,
  });
}
