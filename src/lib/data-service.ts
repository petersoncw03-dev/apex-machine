import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { query } from './db';

export interface Result {
  id: string;
  color: string;
  roll: string;
  timestamp: string;
  total_bets?: number;
  total_payout?: number;
  house_profit?: number;
}

export async function getResultsFromDB(limit: number): Promise<Result[] | null> {
  try {
    const result = await query(
      'SELECT id, color, roll, timestamp, total_bets, total_payout, house_profit FROM results ORDER BY timestamp DESC, id DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  } catch (error: any) {
    console.error('Postgres Error:', error.message || error);
    return null;
  }
}

export async function getResultsPeriodFromDB(hours: number, onlyWhites: boolean = false, compact: boolean = false, startDate?: string, endDate?: string): Promise<Result[] | null> {
  try {
    let queryStr = 'SELECT id, color, roll, timestamp, total_bets, total_payout, house_profit FROM results WHERE ';
    const params: any[] = [];
    
    if (startDate && endDate) {
      queryStr += 'timestamp >= $1 AND timestamp <= $2 ';
      params.push(new Date(startDate), new Date(endDate));
    } else {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      queryStr += 'timestamp >= $1 ';
      params.push(since);
    }
    
    if (onlyWhites) {
      queryStr = queryStr.replace(', total_bets, total_payout, house_profit', ''); // remove if onlyWhites
      queryStr += "AND (roll::text = '0' OR color ILIKE '%branco%' OR color ILIKE '%white%') ";
    } else if (compact || hours >= 720 || (startDate && endDate)) { 
      queryStr = queryStr.replace(', total_bets, total_payout, house_profit', '');
    }

    queryStr += 'ORDER BY timestamp ASC, id ASC';

    const result = await query(queryStr, params);
    return result.rows;
  } catch (error: any) {
    console.error('Postgres Error:', error.message || error);
    return null;
  }
}

export async function getResultsFromSheets(limit?: number): Promise<Result[]> {
  try {
    const keyPath = path.join(process.cwd(), 'credentials.json');
    if (!fs.existsSync(keyPath)) {
        console.error('Credentials file not found at:', keyPath);
        return [];
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1tt5KfQWrGdmfzGWPp8sv0jzxoN6LltDdN4wlL46TZ2E';
    
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetName = meta.data.sheets?.[0]?.properties?.title || 'Página1';
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:D`,
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const limitedRows = rows.slice(-10000);
    
    const data = limitedRows.map((row) => ({
      id: row[0] || '',
      color: row[1] || '',
      roll: row[2] || '',
      timestamp: row[3] || '',
    }));

    if (limit) {
      return data.slice(-limit).reverse();
    }
    return data;
  } catch (error: any) {
    console.error('Google Sheets Error:', error.message || error);
    if (error.message?.includes('invalid_grant')) {
        console.error('DICA: Erro de autenticação do Google. Verifique se o horário do sistema está correto ou se as credenciais expiraram.');
    }
    return [];
  }
}
