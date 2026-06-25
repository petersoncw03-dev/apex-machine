import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(
      'SELECT * FROM results ORDER BY timestamp DESC LIMIT 200'
    );
    
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Erro ao buscar dados do banco', details: error.message }, { status: 500 });
  }
}
