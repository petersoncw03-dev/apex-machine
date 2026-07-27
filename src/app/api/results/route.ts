import { NextResponse, NextRequest } from 'next/server';
import { getResultsFromDB } from '@/lib/data-service';

export const revalidate = 3;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '200', 10);

  // Tenta Postgres primeiro
  let data = await getResultsFromDB(limit);
  let source = 'postgres';

  // Se falhar ou estiver vazio
  if (!data || data.length === 0) {
    data = [];
  }

  return NextResponse.json(
    { data, total: data.length, source },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=10',
      },
    }
  );
}

