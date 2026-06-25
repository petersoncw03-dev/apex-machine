'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

export interface Roll {
  id?: string;
  color: string;
  roll: string | number;
  timestamp: string;
  total_bets?: number;
  total_payout?: number;
  house_profit?: number;
}

type Listener = (roll: Roll) => void;

interface SSEContextValue {
  /** Último giro recebido ao vivo */
  latestRoll: Roll | null;
  /** Assina eventos de pedra nova. Retorna função de cancelamento. */
  subscribe: (fn: Listener) => () => void;
}

const SSEContext = createContext<SSEContextValue>({
  latestRoll: null,
  subscribe: () => () => {},
});

/**
 * SSEProvider — cria UMA ÚNICA conexão EventSource para todo o app.
 * Todas as páginas consomem esse mesmo canal, nunca abrindo conexões extras.
 * Isso evita o estouro do limite de 6 conexões HTTP por domínio do browser.
 */
export function SSEProvider({ children }: { children: React.ReactNode }) {
  const [latestRoll, setLatestRoll] = useState<Roll | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());

  const subscribe = useCallback((fn: Listener) => {
    listenersRef.current.add(fn);
    return () => { listenersRef.current.delete(fn); };
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;
    let retryDelay = 2000;      // começa em 2s
    const MAX_DELAY = 30000;    // máximo 30s entre tentativas
    let mounted = true;

    const connect = () => {
      if (!mounted) return;
      try {
        es = new EventSource('/api/events');

        es.onopen = () => {
          retryDelay = 2000; // reseta o backoff ao conectar com sucesso
        };

        es.onmessage = (event) => {
          try {
            const raw = JSON.parse(event.data);
            const roll: Roll = {
              ...raw,
              color: raw.color?.toString().charAt(0).toUpperCase() + raw.color?.toString().slice(1).toLowerCase(),
              roll: raw.roll?.toString(),
            };
            setLatestRoll(roll);
            listenersRef.current.forEach(fn => fn(roll));
          } catch {}
        };

        es.onerror = () => {
          if (!mounted) return;
          console.log(`🔄 [SSE Global] Reconectando em ${retryDelay / 1000}s...`);
          es?.close();
          es = null;
          retryTimer = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 1.5, MAX_DELAY); // backoff exponencial
            connect();
          }, retryDelay);
        };
      } catch (err) {
        // Fallback caso EventSource lance síncronamente
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 1.5, MAX_DELAY);
      }
    };

    connect();

    return () => {
      mounted = false;
      clearTimeout(retryTimer);
      es?.close();
    };
  }, []);


  return (
    <SSEContext.Provider value={{ latestRoll, subscribe }}>
      {children}
    </SSEContext.Provider>
  );
}

/** Hook para consumir a conexão SSE global */
export function useSSE() {
  return useContext(SSEContext);
}
