import { Pool } from 'pg';

const getPool = () => {
  if (!(globalThis as any)._pgPool) {
    (globalThis as any)._pgPool = new Pool({
      host: process.env.DB_HOST || '193.111.116.40',
      port: parseInt(process.env.DB_PORT || '15721', 10),
      user: process.env.DB_USER || 'postgresmachine',
      password: process.env.DB_PASS || '125320pepe',
      database: process.env.DB_NAME || 'apexmachine',
      ssl: false,
      max: 10, // Limit pool size
      connectionTimeoutMillis: 10000,
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
