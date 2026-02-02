import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, userApiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Login user with email and API key
 * POST /api/auth/login
 * Body: { email: string, apiKey: string }
 * Returns: { user: { id, email, name }, success: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, apiKey } = body;

    if (!email || !apiKey) {
      return NextResponse.json(
        { error: 'Email and API key are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please register first.' },
        { status: 404 }
      );
    }

    // Check if API key matches (simple check for now - should use hash in production)
    const keyRecord = db
      .select()
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, user.id))
      .get();

    if (!keyRecord || keyRecord.apiKey !== apiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Store user session in localStorage (client-side)
    // In production, use secure cookies/JWT

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      success: true,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}
