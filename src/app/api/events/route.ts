import { Client } from 'pg';
import { EventEmitter } from 'events';

export const dynamic = 'force-dynamic';

const getGlobalEventEmitter = () => {
  if (!(globalThis as any)._sseEmitter) {
    (globalThis as any)._sseEmitter = new EventEmitter();
    (globalThis as any)._sseEmitter.setMaxListeners(0); // Ilimitado para suportar muitas abas
  }
  return (globalThis as any)._sseEmitter;
};

const getGlobalListenClient = () => {
  if (!(globalThis as any)._listenClient) {
    const client = new Client({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      ssl: false,
      connectionTimeoutMillis: 5000,
    });
    
    (globalThis as any)._listenClient = client;

    client.connect()
      .then(() => client.query('LISTEN nova_pedra'))
      .catch((err) => {
        console.error('[SSE] Falha ao conectar global listen client:', err);
        (globalThis as any)._listenClient = null;
      });

    client.on('notification', (msg) => {
      if (msg.channel === 'nova_pedra' && msg.payload) {
        getGlobalEventEmitter().emit('nova_pedra', msg.payload);
      }
    });

    client.on('error', (err) => {
      console.error('[SSE] Global Listen Client Error:', err);
      try { client.end(); } catch {}
      (globalThis as any)._listenClient = null;
    });
  }
  return (globalThis as any)._listenClient;
};

export async function GET() {
  const encoder = new TextEncoder();
  const emitter = getGlobalEventEmitter();
  
  // Assegura que o client global está ativo
  getGlobalListenClient();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'));

      const onNovaPedra = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {}
      };

      emitter.on('nova_pedra', onNovaPedra);

      const keepAlive = setInterval(() => {
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')); } catch {}
      }, 15000);

      (controller as any)._cleanup = () => {
        emitter.off('nova_pedra', onNovaPedra);
        clearInterval(keepAlive);
      };
    },
    cancel(controller) {
      if ((controller as any)._cleanup) {
        (controller as any)._cleanup();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
