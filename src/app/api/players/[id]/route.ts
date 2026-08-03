import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
    }

    const playerRes = await query(
      `SELECT id, name, total_bets_count, wins_count, losses_count, 
              total_invested, total_won, total_pnl, win_rate, updated_at
       FROM players WHERE id = $1`,
      [userId]
    );

    if (playerRes.rows.length === 0) {
      return NextResponse.json({ success: true, player: null, history: [] });
    }

    const p = playerRes.rows[0];
    const player = {
      id: p.id,
      name: p.name || 'Jogador Anônimo',
      total_bets_count: Number(p.total_bets_count || 0),
      wins_count: Number(p.wins_count || 0),
      losses_count: Number(p.losses_count || 0),
      total_invested: Number(p.total_invested || 0),
      total_won: Number(p.total_won || 0),
      total_pnl: Number(p.total_pnl || 0),
      win_rate: Number(p.win_rate || 0),
      updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : null
    };

    const betsRes = await query(
      `SELECT id, roll_id, color, amount, payout, pnl, status, timestamp
       FROM player_bets
       WHERE user_id = $1
       ORDER BY timestamp DESC NULLS LAST
       LIMIT 30`,
      [userId]
    );

    const history = betsRes.rows.map(b => ({
      id: b.id,
      roll_id: b.roll_id,
      color: b.color,
      amount: Number(b.amount || 0),
      payout: Number(b.payout || 0),
      pnl: Number(b.pnl || 0),
      status: b.status,
      timestamp: b.timestamp ? new Date(b.timestamp).toISOString() : null
    }));

    return NextResponse.json({ success: true, player, history });
  } catch (error: any) {
    return NextResponse.json({ success: true, player: null, history: [] });
  }
}
