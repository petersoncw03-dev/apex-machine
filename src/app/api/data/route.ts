import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import path from 'path';

export const revalidate = 15;

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1tt5KfQWrGdmfzGWPp8sv0jzxoN6LltDdN4wlL46TZ2E';
    
    // Buscar o nome da primeira aba dinamicamente
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetName = meta.data.sheets?.[0]?.properties?.title || 'Página1';
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:D`,
    });
    
    const rows = response.data.values;
    
    if (!rows || rows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Otimização: Retornar apenas as últimas 10.000 linhas
    const limitedRows = rows.slice(-10000);

    const data = limitedRows.map((row) => ({
      id: row[0] || '',
      color: row[1] || '',
      roll: row[2] || '',
      timestamp: row[3] || '',
    }));

    return NextResponse.json(
      { data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        },
      }
    );

  } catch (error: any) {
    console.error('Google Sheets API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

