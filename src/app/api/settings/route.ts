import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('Settings');

// GET /api/settings?keys=key1,key2,key3
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const keys = searchParams.get('keys');

    if (keys) {
      // Batch get for multiple keys
      const keyList = keys.split(',');
      const settings = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, keyList[0])); // Drizzle doesn't have `in` helper, we'll use raw query or multiple selects

      // For multiple keys, we need to query each or use a different approach
      const result: Record<string, string> = {};
      for (const key of keyList) {
        const setting = await db
          .select()
          .from(appSettings)
          .where(eq(appSettings.key, key))
          .limit(1);
        if (setting.length > 0) {
          result[key] = setting[0].value;
        }
      }
      return NextResponse.json(result);
    }

    // Get all settings
    const allSettings = await db.select().from(appSettings);
    const result: Record<string, string> = {};
    for (const setting of allSettings) {
      result[setting.key] = setting.value;
    }
    return NextResponse.json(result);
  } catch (error) {
    log.error({ error }, 'Error fetching settings');
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST /api/settings { key: string, value: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 });
    }

    // Upsert setting
    await db
      .insert(appSettings)
      .values({ key, value, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: Date.now() },
      });

    return NextResponse.json({ success: true, key, value });
  } catch (error) {
    log.error({ error }, 'Error saving setting');
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 });
  }
}

// DELETE /api/settings?keys=key1,key2,key3
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const keys = searchParams.get('keys');

    if (!keys) {
      return NextResponse.json({ error: 'keys parameter is required' }, { status: 400 });
    }

    // Delete all specified keys
    const keyList = keys.split(',');
    for (const key of keyList) {
      await db.delete(appSettings).where(eq(appSettings.key, key.trim()));
    }

    return NextResponse.json({ success: true, deleted: keyList });
  } catch (error) {
    log.error({ error }, 'Error deleting settings');
    return NextResponse.json({ error: 'Failed to delete settings' }, { status: 500 });
  }
}
