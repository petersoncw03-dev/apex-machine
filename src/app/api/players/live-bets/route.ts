import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const enableElite = searchParams.get('enableElite') === 'true';
    const minWinRateColor = enableElite ? parseFloat(searchParams.get('minWinRateColor') || '60') : 0;
    const minWinRateWhite = enableElite ? parseFloat(searchParams.get('minWinRateWhite') || '20') : 0;
    const period = searchParams.get('period') || '7d';
    const minPnl = parseFloat(searchParams.get('minPnl') || '0');
    const minAmount = parseFloat(searchParams.get('minAmount') || '0');
    const searchName = (searchParams.get('name') || '').trim();
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const color = (searchParams.get('color') || 'all').toLowerCase();

    let colorFilter = '';
    if (color === 'vermelho') {
      colorFilter = "AND b.color = 'VERMELHO'";
    } else if (color === 'preto') {
      colorFilter = "AND b.color = 'PRETO'";
    } else if (color === 'branco') {
      colorFilter = "AND b.color = 'BRANCO'";
    } else if (color === 'cores') {
      colorFilter = "AND b.color IN ('VERMELHO', 'PRETO')";
    }

    let nameFilter = '';
    const queryParams: any[] = [enableElite, minWinRateColor, minWinRateWhite, minPnl, limit];
    
    if (searchName) {
      queryParams.push(`%${searchName}%`);
      nameFilter = `AND b.user_name ILIKE $${queryParams.length}`;
    }

    let amountFilter = '';
    if (minAmount > 0) {
      queryParams.push(minAmount);
      amountFilter = `AND b.amount >= $${queryParams.length}`;
    }

    let daysInterval = "7 days";
    if (period === '1d') daysInterval = "1 day";
    else if (period === '3d') daysInterval = "3 days";
    else if (period === '30d') daysInterval = "30 days";

    const sql = `
      WITH period_stats AS (
        SELECT 
          user_id,
          ROUND((COUNT(CASE WHEN status = 'WIN' THEN 1 END)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1) as period_win_rate,
          SUM(pnl) as period_pnl,
          COUNT(*) as period_total_bets
        FROM player_bets
        WHERE timestamp >= NOW() - INTERVAL '${daysInterval}'
        GROUP BY user_id
      )
      SELECT 
          b.id,
          b.user_id,
          b.user_name,
          b.roll_id,
          b.color,
          b.amount,
          b.payout,
          b.pnl,
          b.status,
          b.timestamp,
          COALESCE(ps.period_win_rate, p.win_rate, 50.0) as player_win_rate,
          COALESCE(ps.period_pnl, p.total_pnl, 0) as player_total_pnl,
          COALESCE(p.wins_count, 0) as player_wins_count,
          COALESCE(ps.period_total_bets, p.total_bets_count, 0) as player_total_bets_count,
          COALESCE(p.total_invested, 0) as player_total_invested
      FROM player_bets b
      LEFT JOIN players p ON b.user_id = p.id
      LEFT JOIN period_stats ps ON b.user_id = ps.user_id
      WHERE (
        $1::boolean = false
        OR (b.color IN ('VERMELHO', 'PRETO') AND COALESCE(ps.period_win_rate, p.win_rate, 50.0) >= $2)
        OR (b.color = 'BRANCO' AND COALESCE(ps.period_win_rate, p.win_rate, 50.0) >= $3)
        OR ($4 > 0 AND COALESCE(ps.period_pnl, p.total_pnl, 0) >= $4)
      ) ${colorFilter} ${nameFilter} ${amountFilter}
      ORDER BY b.timestamp DESC
      LIMIT $5
    `;

    const res = await query(sql, queryParams);

    const data = res.rows.map((b: any) => ({
      id: String(b.id),
      user_id: String(b.user_id),
      user_name: b.user_name || 'Jogador',
      roll_id: String(b.roll_id),
      color: b.color,
      amount: Number(b.amount || 0),
      payout: Number(b.payout || 0),
      pnl: Number(b.pnl || 0),
      status: b.status,
      timestamp: b.timestamp ? new Date(b.timestamp).toISOString() : new Date().toISOString(),
      player_win_rate: Number(b.player_win_rate || 0),
      player_total_pnl: Number(b.player_total_pnl || 0),
      player_wins_count: Number(b.player_wins_count || 0),
      player_total_bets_count: Number(b.player_total_bets_count || 0),
      player_total_invested: Number(b.player_total_invested || 0),
    }));

    return NextResponse.json({ success: true, count: data.length, data });
  } catch (err: any) {
    console.error("Erro na API de live-bets:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
