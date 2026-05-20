import { NextResponse } from 'next/server';
import { ingestProgress } from '@/lib/ingestProgress';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(ingestProgress);
}
