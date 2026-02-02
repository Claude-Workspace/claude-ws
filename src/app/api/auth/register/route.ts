import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, userApiKeys } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

/**
 * Register new user
 * POST /api/auth/register
 * Body: { email: string, name: string, apiKey: string }
 * Returns: { user: { id, email, name }, success: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, apiKey } = body;

    if (!email || !name || !apiKey) {
      return NextResponse.json(
        { error: 'Email, name, and API key are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Create new user
    const userId = nanoid();
    const now = Date.now();

    db.insert(users).values({
      id: userId,
      email,
      name,
      createdAt: now,
      updatedAt: now,
    }).run();

    // Insert API key
    db.insert(userApiKeys).values({
      id: nanoid(),
      userId,
      apiKey, // Note: Should be hashed in production!
      provider: 'claude',
      isActive: true,
      createdAt: now,
    }).run();

    const newUser = db.select().from(users).where(eq(users.id, userId)).get();

    return NextResponse.json({
      user: {
        id: newUser?.id,
        email: newUser?.email,
        name: newUser?.name,
      },
      success: true,
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Failed to register user' },
      { status: 500 }
    );
  }
}
