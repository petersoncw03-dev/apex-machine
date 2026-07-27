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
  /** Taxa de câmbio dinâmica de Euro para Real */
  eurRate: number;
}

const SSEContext = createContext<SSEContextValue>({
  latestRoll: null,
  subscribe: () => () => {},
  eurRate: 5.8362,
});

/**
 * SSEProvider — cria UMA ÚNICA conexão EventSource para todo o app.
 * Todas as páginas consomem esse mesmo canal, nunca abrindo conexões extras.
 * Isso evita o estouro do limite de 6 conexões HTTP por domínio do browser.
 */
export function SSEProvider({ children }: { children: React.ReactNode }) {
  const [latestRoll, setLatestRoll] = useState<Roll | null>(null);
  const [eurRate, setEurRate] = useState<number>(5.8362);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const latestTimeRef = useRef<number>(0);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const subscribe = useCallback((fn: Listener) => {
    listenersRef.current.add(fn);
    return () => { listenersRef.current.delete(fn); };
  }, []);

  // Busca a taxa de câmbio Euro -> Real atualizada
  useEffect(() => {
    fetch('https://economia.awesomeapi.com.br/last/EUR-BRL')
      .then(res => res.json())
      .then(data => {
        if (data?.EURBRL?.ask) {
          setEurRate(parseFloat(data.EURBRL.ask));
        }
      })
      .catch(() => console.warn("Usando taxa de câmbio EUR-BRL de fallback"));
  }, []);

  // HYBRID EDGE: WebSocket Direto com a Blaze (Delay Zero)
  useEffect(() => {
    let ws: WebSocket;
    let pingInterval: any;
    let mounted = true;
    
    const connectBlaze = () => {
      if (!mounted) return;
      ws = new WebSocket("wss://api-gaming.blaze.bet.br/replication/?EIO=3&transport=websocket");
      
      ws.onopen = () => {
        ws.send("40");
        ws.send('420["cmd",{"id":"subscribe","payload":{"room":"double_room_1"}}]');
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("2");
        }, 20000);
      };
      
      ws.onmessage = (e) => {
        const msg = e.data;
        if (msg === "2") { ws.send("3"); return; }
        if (!msg.startsWith("42")) return;
        
        try {
          const raw = msg.substring(msg.indexOf("["));
          const data = JSON.parse(raw);
          if (data && data.length >= 2) {
            const ev = data[1];
            if (ev.id === "double.tick" || ev.id === "double.update") {
               const p = ev.payload;
               // Captura a pedra no exato milissegundo em que as apostas fecham e ela começa a rolar!
               if ((p.status === "rolling" || p.status === "complete") && p.color !== undefined && p.roll !== undefined) {
                   const rollId = String(p.id);
                   if (!seenIdsRef.current.has(rollId)) {
                       seenIdsRef.current.add(rollId);
                       // Manter o cache pequeno
                       if (seenIdsRef.current.size > 100) {
                           const arr = Array.from(seenIdsRef.current);
                           seenIdsRef.current = new Set(arr.slice(arr.length - 30));
                       }
                       
                       let colorStr = "Preto";
                       if (p.color === 0) colorStr = "Branco";
                       else if (p.color === 1) colorStr = "Vermelho";

                       const redBets = parseFloat(p.total_red_bet ?? p.total_red_eur_bet ?? "0");
                       const whiteBets = parseFloat(p.total_white_bet ?? p.total_white_eur_bet ?? "0");
                       const blackBets = parseFloat(p.total_black_bet ?? p.total_black_eur_bet ?? "0");
                       const tb = redBets + whiteBets + blackBets;
                       
                       let tp = 0;
                       if (p.color === 1) tp = redBets * 2;
                       if (p.color === 2) tp = blackBets * 2;
                       if (p.color === 0) tp = whiteBets * 14;
                       
                       const rollObj: Roll = {
                         id: rollId,
                         color: colorStr,
                         roll: String(p.roll),
                         timestamp: p.created_at || new Date().toISOString(),
                         total_bets: tb,
                         total_payout: tp,
                         house_profit: tb - tp
                       };
                       
                       const rollTime = new Date(rollObj.timestamp).getTime();
                       if (rollTime > latestTimeRef.current) {
                           latestTimeRef.current = rollTime;
                       }
                       setLatestRoll(rollObj);
                       listenersRef.current.forEach(fn => fn(rollObj));
                   }
               }
            }
          }
        } catch(err) {}
      };
      
      ws.onclose = () => {
         clearInterval(pingInterval);
         if (mounted) setTimeout(connectBlaze, 2000);
      };
    };
    
    connectBlaze();
    
    return () => {
      mounted = false;
      clearInterval(pingInterval);
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;
    let retryDelay = 2000;      // começa em 2s
    const MAX_DELAY = 30000;    // máximo 30s entre tentativas
    let mounted = true;
    let reconnectCount = 0;

    const vpsRaw = process.env.NEXT_PUBLIC_VPS_URL;
    if (!vpsRaw) {
      console.log('⚡ [SSE Global] Conexão em Tempo Real ativa 100% no cliente via WebSocket direto (Blaze). NEXT_PUBLIC_VPS_URL não configurada.');
      return;
    }

    const vpsUrl = vpsRaw.replace(/\/$/, '');
    const sseEndpoint = `${vpsUrl}/api/events`;

    const connect = () => {
      if (!mounted) return;
      try {
        es = new EventSource(sseEndpoint);

        es.onopen = async () => {
          retryDelay = 2000; // reseta o backoff ao conectar com sucesso
          console.log(`[SSE Global] Conectado à VPS em ${sseEndpoint}`);
          if (reconnectCount > 0) {
            try {
              const res = await fetch('/api/results?limit=20');
              if (res.ok) {
                const json = await res.json();
                const data = json.data || [];
                const sorted = data.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                sorted.forEach((raw: any) => {
                  const roll: Roll = {
                    ...raw,
                    color: raw.color?.toString().charAt(0).toUpperCase() + raw.color?.toString().slice(1).toLowerCase(),
                    roll: raw.roll?.toString(),
                    timestamp: raw.timestamp || raw.created_at,
                  };
                  const rollTime = new Date(roll.timestamp).getTime();
                  if (rollTime > latestTimeRef.current) {
                    latestTimeRef.current = rollTime;
                    listenersRef.current.forEach(fn => fn(roll));
                  }
                });
              }
            } catch(e) {}
          }
          reconnectCount++;
        };

        es.onmessage = (event) => {
          try {
            const raw = JSON.parse(event.data);
            const rollId = String(raw.id);
            // FALLBACK: Se o WebSocket direto com a Blaze já pegou, ignoramos o sinal atrasado
            if (seenIdsRef.current.has(rollId)) return;
            seenIdsRef.current.add(rollId);

            const roll: Roll = {
              ...raw,
              color: raw.color?.toString().charAt(0).toUpperCase() + raw.color?.toString().slice(1).toLowerCase(),
              roll: raw.roll?.toString(),
              timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
            };
            const rollTime = new Date(roll.timestamp).getTime();
            if (rollTime > latestTimeRef.current) {
              latestTimeRef.current = rollTime;
            }
            setLatestRoll(roll);
            listenersRef.current.forEach(fn => fn(roll));
          } catch {}
        };

        es.onerror = () => {
          if (!mounted) return;
          console.log(`🔄 [SSE VPS] Reconectando em ${retryDelay / 1000}s...`);
          es?.close();
          es = null;
          retryTimer = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 1.5, MAX_DELAY); // backoff exponencial
            connect();
          }, retryDelay);
        };
      } catch (err) {
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
    <SSEContext.Provider value={{ latestRoll, subscribe, eurRate }}>
      {children}
    </SSEContext.Provider>
  );
}

/** Hook para consumir a conexão SSE global */
export function useSSE() {
  return useContext(SSEContext);
}
