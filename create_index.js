const { Client } = require('pg');
const client = new Client({ host: '151.244.40.166', port: 15432, user: 'postgres', password: '12532019970607', database: 'apexmachine' });
client.connect()
  .then(() => {
    console.log("Criando indice na tabela results...");
    return client.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_results_timestamp ON results (timestamp DESC);");
  })
  .then(() => { console.log('Indice criado.'); client.end(); })
  .catch(console.error);
