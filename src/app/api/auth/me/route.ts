import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, userApiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Get current user info
 * GET /api/auth/me
 * Headers: x-user-id: <user_id>
 * Returns: { user: { id, email, name }, apiKeyExists: boolean }
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

    // Get user
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

    // Check if user has API key
    const apiKeyRecord = db
      .select()
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, userId))
      .get();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      apiKeyExists: !!apiKeyRecord,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to get user info' },
      { status: 500 }
    );
  }
}
