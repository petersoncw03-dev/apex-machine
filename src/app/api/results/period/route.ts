import { NextResponse, NextRequest } from 'next/server';
import { getResultsPeriodFromDB } from '@/lib/data-service';

export const revalidate = 3;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hours = parseInt(searchParams.get('hours') || '24', 10);
  const onlyWhites = searchParams.get('onlyWhites') === 'true';
  const compact = searchParams.get('compact') === 'true';
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  // Tenta Postgres primeiro
  let data = await getResultsPeriodFromDB(hours, onlyWhites, compact, startDate, endDate);
  let source = 'postgres';

  if (!data || data.length === 0) {
    data = [];
  }

  return NextResponse.json(
    { data, total: data.length, period_hours: hours, source },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=10',
      },
    }
  );
}

