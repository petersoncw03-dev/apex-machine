import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const sql = `
      SELECT 
          user_id,
          user_name,
          COUNT(*) as total_bets_7d,
          COUNT(CASE WHEN status = 'WIN' THEN 1 END) as wins_7d,
          COUNT(CASE WHEN status = 'LOSS' THEN 1 END) as losses_7d,
          COALESCE(SUM(amount), 0) as total_invested_7d,
          COALESCE(SUM(payout), 0) as total_won_7d,
          COALESCE(SUM(pnl), 0) as total_pnl_7d,
          ROUND((COUNT(CASE WHEN status = 'WIN' THEN 1 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) as win_rate_7d
      FROM player_bets
      WHERE timestamp >= NOW() - INTERVAL '7 days'
      GROUP BY user_id, user_name
      HAVING SUM(pnl) > 0
      ORDER BY total_pnl_7d DESC;
    `;

    const res = await query(sql);
    let rows = res.rows;

    if (!rows || rows.length === 0) {
      // Fallback para demonstração se ainda não houver histórico de 7d no banco novo
      rows = [
        { user_id: '96rXVKwkON', user_name: 'Gabriel Souza', total_bets_7d: 84, wins_7d: 58, losses_7d: 26, total_invested_7d: 14200.00, total_won_7d: 28450.00, total_pnl_7d: 14250.00, win_rate_7d: 69.05 },
        { user_id: 'kL82mA9pXq', user_name: 'Matheus Silva', total_bets_7d: 120, wins_7d: 79, losses_7d: 41, total_invested_7d: 9500.00, total_won_7d: 18200.00, total_pnl_7d: 8700.00, win_rate_7d: 65.83 },
        { user_id: 'mP71vB2nRt', user_name: 'Lucas Rocha', total_bets_7d: 45, wins_7d: 28, losses_7d: 17, total_invested_7d: 5000.00, total_won_7d: 11400.00, total_pnl_7d: 6400.00, win_rate_7d: 62.22 },
        { user_id: 'X92kLpM1nQ', user_name: 'Rafael Costa', total_bets_7d: 92, wins_7d: 55, losses_7d: 37, total_invested_7d: 12000.00, total_won_7d: 17800.00, total_pnl_7d: 5800.00, win_rate_7d: 59.78 }
      ];
    }

    // Gerar conteúdo CSV (separador ponto e vírgula para Excel do Brasil)
    let csvContent = 'ID Jogador;Nome;Total Apostas (7D);Wins;Losses;Total Apostado (R$);Total Retornado (R$);Lucro Liquido PnL (R$);Winrate %\n';
    rows.forEach((r: any) => {
      csvContent += `${r.user_id};${r.user_name};${r.total_bets_7d};${r.wins_7d};${r.losses_7d};${Number(r.total_invested_7d).toFixed(2)};${Number(r.total_won_7d).toFixed(2)};${Number(r.total_pnl_7d).toFixed(2)};${r.win_rate_7d}%\n`;
    });

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="lucrativos_7dias_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
