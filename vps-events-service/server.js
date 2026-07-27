const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const { EventEmitter } = require('events');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const emitter = new EventEmitter();
emitter.setMaxListeners(0); // Suporta conexões ilimitadas de clientes

let pgClient = null;

function connectPg() {
  console.log('[VPS SSE Service] Conectando ao PostgreSQL...');
  
  pgClient = new Client({
    host: process.env.DB_HOST || '151.242.25.148',
    port: parseInt(process.env.DB_PORT || '15721', 10),
    user: process.env.DB_USER || 'postgresmachine',
    password: process.env.DB_PASS || '125320pepe',
    database: process.env.DB_NAME || 'apexmachine',
    ssl: false,
    connectionTimeoutMillis: 10000,
  });

  pgClient.connect()
    .then(() => {
      console.log('[VPS SSE Service] ✅ Conectado ao PostgreSQL com sucesso! Rodando LISTEN nova_pedra...');
      return pgClient.query('LISTEN nova_pedra');
    })
    .catch((err) => {
      console.error('[VPS SSE Service] ❌ Erro ao conectar ao Postgres:', err.message);
      pgClient = null;
      setTimeout(connectPg, 5000);
    });

  pgClient.on('notification', (msg) => {
    if (msg.channel === 'nova_pedra' && msg.payload) {
      console.log('[VPS SSE Service] 📢 Nova pedra recebida do DB:', msg.payload);
      emitter.emit('nova_pedra', msg.payload);
    }
  });

  pgClient.on('error', (err) => {
    console.error('[VPS SSE Service] ⚠️ Postgres Client Error:', err.message);
    try { pgClient.end(); } catch {}
    pgClient = null;
    setTimeout(connectPg, 3000);
  });

  pgClient.on('end', () => {
    console.warn('[VPS SSE Service] ⚠️ Postgres Client finalizado. Tentando reconectar...');
    pgClient = null;
    setTimeout(connectPg, 3000);
  });
}

// Inicia escuta no Postgres
connectPg();

// Healthcheck endpoint (para Easypanel / Docker)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    dbConnected: !!pgClient,
    activeSSEClients: emitter.listenerCount('nova_pedra'),
    timestamp: new Date().toISOString()
  });
});

// Endpoint SSE contínuo para clientes conectarem sem usar limite da Vercel
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Envia confirmação inicial de conexão
  res.write(': connected\n\n');

  const onNovaPedra = (payload) => {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch (err) {
      console.error('[VPS SSE Service] Erro ao enviar dado para cliente:', err.message);
    }
  };

  emitter.on('nova_pedra', onNovaPedra);

  // Heartbeat a cada 15 segundos para manter a conexão TCP viva no cliente/proxy
  const keepAlive = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 15000);

  // Limpeza ao fechar conexão do cliente
  req.on('close', () => {
    emitter.off('nova_pedra', onNovaPedra);
    clearInterval(keepAlive);
    res.end();
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [VPS SSE Service] Servidor rodando na porta ${PORT}`);
  console.log(`📡 SSE Endpoint: http://0.0.0.0:${PORT}/api/events`);
});
