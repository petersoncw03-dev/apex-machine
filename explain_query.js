const { Client } = require('pg');
const client = new Client({ host: '193.111.116.40', port: 15721, user: 'postgresmachine', password: '125320pepe', database: 'apexmachine' });
client.connect()
  .then(() => client.query("EXPLAIN ANALYZE SELECT id, color, roll, timestamp, total_bets, total_payout, house_profit FROM results WHERE timestamp >= NOW() - INTERVAL '168 hours' ORDER BY timestamp ASC, id ASC"))
  .then(res => { console.log(res.rows.map(r => r['QUERY PLAN']).join('\n')); client.end(); })
  .catch(console.error);
