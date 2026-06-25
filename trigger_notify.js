const { Client } = require('pg');
const client = new Client({ host: '151.244.40.166', port: 15432, user: 'postgres', password: '12532019970607', database: 'apexmachine' });
client.connect()
  .then(() => {
    const payload = JSON.stringify({
      id: 'test' + Date.now(),
      color: 'PRETO',
      roll: 8,
      timestamp: new Date().toISOString(),
      total_bets: 100,
      total_payout: 0,
      house_profit: 100
    });
    return client.query(`NOTIFY nova_pedra, '${payload}'`);
  })
  .then(() => { console.log('Notification sent.'); client.end(); })
  .catch(console.error);
