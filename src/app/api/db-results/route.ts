import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(
      'SELECT id, color, roll, timestamp FROM results ORDER BY timestamp DESC LIMIT 10'
    );
    
    return NextResponse.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error: any) {
    console.error('Database Error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Erro ao buscar dados do banco', 
      details: error.message || String(error),
      code: error.code
    }, { status: 500 });
  }
}
