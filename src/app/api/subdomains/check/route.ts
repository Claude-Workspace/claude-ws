import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subdomain = searchParams.get('subdomain');
    const email = searchParams.get('email');

    if (!subdomain || !email) {
      return NextResponse.json(
        { success: false, message: 'Subdomain and email are required' },
        { status: 400 }
      );
    }

    // Call claude.ws API to check subdomain availability
    const response = await fetch(
      `https://claude.ws/api/subdomains/${encodeURIComponent(subdomain)}/check?email=${encodeURIComponent(email)}`
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to check subdomain:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check subdomain availability';
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
