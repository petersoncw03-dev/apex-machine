const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkOldest() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  const res = await client.query('SELECT MIN(timestamp) as oldest FROM results');
  console.log('Oldest record:', res.rows[0].oldest);
  await client.end();
}

checkOldest();
