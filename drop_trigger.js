const { Client } = require('pg');
const client = new Client({ host: '151.244.40.166', port: 15432, user: 'postgres', password: '12532019970607', database: 'apexmachine' });
client.connect()
  .then(() => client.query(`DROP TRIGGER IF EXISTS trigger_nova_pedra ON results; DROP FUNCTION IF EXISTS notify_nova_pedra();`))
  .then(() => { console.log('Trigger dropped.'); client.end(); })
  .catch(console.error);
