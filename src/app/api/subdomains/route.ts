import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, subdomain } = body;

    if (!email || !subdomain) {
      return NextResponse.json(
        { success: false, message: 'Email and subdomain are required' },
        { status: 400 }
      );
    }

    // Call claude.ws API to register subdomain
    const response = await fetch('https://claude.ws/api/subdomains/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, subdomain }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to register subdomain:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to register subdomain';
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
