import { Pool } from 'pg';

const getPool = () => {
  if (!(globalThis as any)._pgPool) {
    (globalThis as any)._pgPool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      ssl: false,
      max: 10, // Limit pool size
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000
    });

    (globalThis as any)._pgPool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  return (globalThis as any)._pgPool;
};

const pool = getPool();

export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;
