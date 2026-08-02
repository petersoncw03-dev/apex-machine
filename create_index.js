const { Client } = require('pg');
const client = new Client({ host: '193.111.116.40', port: 15721, user: 'postgresmachine', password: '125320pepe', database: 'apexmachine' });
client.connect()
  .then(() => {
    console.log("Criando indice na tabela results...");
    return client.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_results_timestamp ON results (timestamp DESC);");
  })
  .then(() => { console.log('Indice criado.'); client.end(); })
  .catch(console.error);
