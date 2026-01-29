import { NextRequest, NextResponse } from 'next/server';
import { tunnelService } from '@/lib/tunnel-service';

export async function GET(req: NextRequest) {
  try {
    const state = tunnelService.getState();
    return NextResponse.json(state);
  } catch (error) {
    console.error('Failed to get tunnel status:', error);
    return NextResponse.json({ error: 'Failed to get tunnel status' }, { status: 500 });
  }
}
