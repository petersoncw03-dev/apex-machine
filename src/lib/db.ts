import { Pool } from 'pg';

const OLD_IPS = ['151.242.25.148', '151.244.40.166', '185.225.22.221'];

const getHost = () => {
  let envHost = process.env.DB_HOST?.trim() || '193.111.116.40';
  envHost = envHost.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim();
  if (!envHost || OLD_IPS.includes(envHost)) {
    return '193.111.116.40';
  }
  return envHost;
};

const getPort = () => {
  const envPort = process.env.DB_PORT?.trim();
  if (!envPort || envPort === '5432' || envPort === '15432') {
    return 15721;
  }
  return parseInt(envPort, 10) || 15721;
};

const getUser = () => {
  const envUser = process.env.DB_USER?.trim();
  if (!envUser || envUser === 'postgres') {
    return 'postgresmachine';
  }
  return envUser;
};

const getPass = () => {
  const envPass = process.env.DB_PASS?.trim();
  if (!envPass || envPass === '12532019970607') {
    return '125320pepe';
  }
  return envPass;
};

const getPool = () => {
  if (!(globalThis as any)._pgPool) {
    (globalThis as any)._pgPool = new Pool({
      host: getHost(),
      port: getPort(),
      user: getUser(),
      password: getPass(),
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
