import { NextRequest, NextResponse } from 'next/server';
import { tunnelService } from '@/lib/tunnel-service';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { subdomain, port } = body;

    const url = await tunnelService.start({ subdomain, port });

    // Save tunnel settings to database
    await db
      .insert(appSettings)
      .values({ key: 'tunnel_url', value: url, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: url, updatedAt: Date.now() },
      });

    if (subdomain) {
      await db
        .insert(appSettings)
        .values({ key: 'tunnel_subdomain', value: subdomain, updatedAt: Date.now() })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: subdomain, updatedAt: Date.now() },
        });
    }

    // Mark tunnel as enabled
    await db
      .insert(appSettings)
      .values({ key: 'tunnel_enabled', value: 'true', updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: 'true', updatedAt: Date.now() },
      });

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('Failed to start tunnel:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start tunnel';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
