import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('SubdomainConfirmationAPI');

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
      log.info({ subdomain, apiKeyLength: newApiKey?.length }, 'Saving subdomain to database');

      // Check if old key exists
      const oldKeyRecord = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, 'tunnel_apikey'))
        .limit(1);

      if (oldKeyRecord.length > 0) {
        log.info('Overwriting existing API key');
      } else {
        log.info('First time setup - no existing API key');
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
        log.info({ matches }, 'API key verification complete');
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    log.error({ err: error }, 'Failed to confirm subdomain');
    const errorMessage = error instanceof Error ? error.message : 'Failed to confirm subdomain';
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
