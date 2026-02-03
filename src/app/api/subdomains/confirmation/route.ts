import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, subdomain, confirmation_code } = body;

    if (!email || !subdomain || !confirmation_code) {
      return NextResponse.json(
        { success: false, message: 'Email, subdomain, and confirmation code are required' },
        { status: 400 }
      );
    }

    // Call claude.ws API to confirm subdomain
    const response = await fetch('https://claude.ws/api/subdomains/confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, subdomain, confirmation_code }),
    });

    const data = await response.json();

    if (data.success) {
      const newApiKey = data.ctunnel_apikey;

      // Log what we're about to save
      console.log('[Confirmation] === SAVING TO DATABASE ===');
      console.log('[Confirmation] Subdomain:', subdomain);
      console.log('[Confirmation] New API Key:', newApiKey?.substring(0, 15) + '...' + newApiKey?.substring(newApiKey.length - 5));
      console.log('[Confirmation] New API Key length:', newApiKey?.length);
      console.log('[Confirmation] ===============================');

      // Check if old key exists
      const oldKeyRecord = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, 'tunnel_apikey'))
        .limit(1);

      if (oldKeyRecord.length > 0) {
        console.log('[Confirmation] OVERWRITING old API key:', oldKeyRecord[0].value.substring(0, 15) + '...');
      } else {
        console.log('[Confirmation] No existing API key found (first time setup)');
      }

      // Save subdomain data to database
      await db
        .insert(appSettings)
        .values({ key: 'tunnel_subdomain', value: subdomain, updatedAt: Date.now() })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: subdomain, updatedAt: Date.now() },
        });

      await db
        .insert(appSettings)
        .values({ key: 'tunnel_email', value: email, updatedAt: Date.now() })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: email, updatedAt: Date.now() },
        });

      await db
        .insert(appSettings)
        .values({ key: 'tunnel_apikey', value: data.ctunnel_apikey, updatedAt: Date.now() })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: data.ctunnel_apikey, updatedAt: Date.now() },
        });

      await db
        .insert(appSettings)
        .values({
          key: 'tunnel_plan',
          value: JSON.stringify(data.plan),
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: JSON.stringify(data.plan), updatedAt: Date.now() },
        });

      // Verify the save was successful by reading it back
      const verifyRecord = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, 'tunnel_apikey'))
        .limit(1);

      if (verifyRecord.length > 0) {
        const savedKey = verifyRecord[0].value;
        const matches = savedKey === newApiKey;
        console.log('[Confirmation] === VERIFICATION ===');
        console.log('[Confirmation] Saved API key matches:', matches ? '✅ YES' : '❌ NO');
        console.log('[Confirmation] Saved key:', savedKey.substring(0, 15) + '...' + savedKey.substring(savedKey.length - 5));
        console.log('[Confirmation] =======================');
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to confirm subdomain:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to confirm subdomain';
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
