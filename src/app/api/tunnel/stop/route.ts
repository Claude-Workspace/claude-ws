import { NextRequest, NextResponse } from 'next/server';
import { tunnelService } from '@/lib/tunnel-service';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';

export async function POST(req: NextRequest) {
  try {
    await tunnelService.stop();

    // Mark tunnel as disabled in database
    await db
      .insert(appSettings)
      .values({ key: 'tunnel_enabled', value: 'false', updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: 'false', updatedAt: Date.now() },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to stop tunnel:', error);
    return NextResponse.json({ success: false, error: 'Failed to stop tunnel' }, { status: 500 });
  }
}
