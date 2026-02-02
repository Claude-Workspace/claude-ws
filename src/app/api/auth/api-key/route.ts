import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, userApiKeys } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

/**
 * Update user's API key
 * POST /api/auth/api-key
 * Headers: x-user-id: <user_id>
 * Body: { apiKey: string, provider: 'claude' | 'anthropic' | 'custom' }
 * Returns: { success: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID header required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { apiKey, provider = 'claude' } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user already has API key
    const existingKey = db
      .select()
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, userId))
      .get();

    const now = Date.now();

    if (existingKey) {
      // Update existing API key
      db.update(userApiKeys)
        .set({
          apiKey, // Note: Should be hashed in production!
          provider,
          createdAt: now,
        })
        .where(eq(userApiKeys.id, existingKey.id))
        .run();
    } else {
      // Create new API key
      db.insert(userApiKeys).values({
        id: nanoid(),
        userId,
        apiKey, // Note: Should be hashed in production!
        provider,
        isActive: true,
        createdAt: now,
      }).run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update API key error:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}

/**
 * Get user's API key (masked for security)
 * GET /api/auth/api-key
 * Headers: x-user-id: <user_id>
 * Returns: { apiKeyMasked: string, provider: string }
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID header required' },
        { status: 401 }
      );
    }

    const keyRecord = db
      .select()
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, userId))
      .get();

    if (!keyRecord) {
      return NextResponse.json({
        apiKeyMasked: null,
        provider: null,
      });
    }

    // Mask API key (show only first 8 and last 4 characters)
    const maskedKey = `${keyRecord.apiKey.slice(0, 8)}${'*'.repeat(Math.max(0, keyRecord.apiKey.length - 12))}${keyRecord.apiKey.slice(-4)}`;

    return NextResponse.json({
      apiKeyMasked: maskedKey,
      provider: keyRecord.provider,
    });
  } catch (error) {
    console.error('Get API key error:', error);
    return NextResponse.json(
      { error: 'Failed to get API key' },
      { status: 500 }
    );
  }
}
