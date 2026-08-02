const { Client } = require('pg');
const client = new Client({ host: '193.111.116.40', port: 15721, user: 'postgresmachine', password: '125320pepe', database: 'apexmachine' });
client.connect()
  .then(() => client.query(`DROP TRIGGER IF EXISTS trigger_nova_pedra ON results; DROP FUNCTION IF EXISTS notify_nova_pedra();`))
  .then(() => { console.log('Trigger dropped.'); client.end(); })
  .catch(console.error);
