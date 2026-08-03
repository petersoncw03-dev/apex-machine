import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, Time } from "lightweight-charts";
import * as htmlToImage from 'html-to-image';
import { useSSESubscribe } from '@/contexts/SSEContext';

function calcSMA(v: number[], p: number) { return v.map((_, i) => i < p - 1 ? null : v.slice(i-p+1,i+1).reduce((a,b)=>a+b,0)/p); }
function calcEMA(v: number[], p: number) { const k=2/(p+1); let e: number|null=null; return v.map((x,i)=>{ if(i<p-1)return null; e=e===null?v.slice(0,p).reduce((a,b)=>a+b,0)/p:x*k+e*(1-k); return parseFloat(e.toFixed(2)); }); }
function calcBB(v: number[], p: number, mult: number) { return v.map((_, i) => { if (i < p - 1) return null; const sl = v.slice(i-p+1, i+1); const m = sl.reduce((a,b)=>a+b,0)/p; const variance = sl.reduce((a,b)=>a+Math.pow(b-m,2),0)/p; const dev = Math.sqrt(variance); return { upper: parseFloat((m + mult*dev).toFixed(2)), middle: parseFloat(m.toFixed(2)), lower: parseFloat((m - mult*dev).toFixed(2)) }; }); }

interface Ind { key:string; type:"sma"|"ema"|"bb"; period:number; color:string; thickness:number; }
const CPOOL = ["#facc15","#f97316","#60a5fa","#34d399","#a78bfa","#ec4899","#22d3ee","#fb923c","#e879f9","#10b981","#ef4444","#8b5cf6"];

interface Roll {
  id?: string;
  color: string;
  roll: number;
  timestamp: string;
  house_profit?: string | number;
}

const CMAP: Record<string, string> = { BRANCO: "#ffffff", VERMELHO: "#e51e3e", PRETO: "#555566" };
const TFS = [
  { k: "tick", l: "Tick", m: 0 },
  { k: "1m", l: "1m", m: 1 },
  { k: "2m", l: "2m", m: 2 },
  { k: "5m", l: "5m", m: 5 },
  { k: "10m", l: "10m", m: 10 },
  { k: "15m", l: "15m", m: 15 },
  { k: "1h", l: "1h", m: 60 }
];
const LIMITS = [200, 500, 1000, 1500, 2000, 3000, 5000, 10000];

function getRollProfit(r: any): number {
  if (r.house_profit !== undefined && r.house_profit !== null && Number(r.house_profit) !== 0) {
    return parseFloat(String(r.house_profit));
  }
  const bets = Number(r.total_bets || 0);
  const payout = Number(r.total_payout || 0);
  if (bets > 0 || payout > 0) {
    return bets - payout;
  }
  // Fallback estatístico para registros históricos antigos sem total_bets gravado
  const colorUpper = String(r.color || '').toUpperCase();
  const isWhite = colorUpper.includes('BRANCO') || colorUpper.includes('WHITE') || String(r.roll) === '0';
  return isWhite ? -650.0 : 150.0;
}

function buildTick(data: Roll[]) {
  let acc = 0; const times: number[] = [];
  let lastT = 0;
  return data.map(r => {
    if (!r || !r.timestamp) return null;
    const key = r.id || (r.timestamp + String(r.color || '') + String(r.roll || ''));
    let t = globalTimeCache.get(key);
    if (t === undefined) {
      const tsDate = new Date(r.timestamp);
      if (isNaN(tsDate.getTime())) return null;
      const offsetSeconds = tsDate.getTimezoneOffset() * 60;
      const rawT = Math.floor(tsDate.getTime() / 1000) - offsetSeconds;
      t = Math.max(rawT, lastT + 1);
      globalTimeCache.set(key, t);
    }
    lastT = t;
    globalLastT = t;
    times.push(t);
    const prev = acc;
    const profit = getRollProfit(r);
    acc = parseFloat((acc + profit).toFixed(2));
    const c = CMAP[(r.color || '').toString().toUpperCase()] ?? "#555566";
    return { candle: { time: t as Time, open: prev, high: Math.max(prev, acc), low: Math.min(prev, acc), close: acc, color: c, wickColor: c, borderColor: c }, acc, time: t };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}

function buildAgg(data: Roll[], minutes: number) {
  let acc = 0; const bMap = new Map<number, { open: number, high: number, low: number, close: number }>();
  const bOrder: number[] = [];
  const interval = minutes * 60;
  data.forEach(r => {
    if (!r || !r.timestamp) return;
    const tsDate = new Date(r.timestamp);
    if (isNaN(tsDate.getTime())) return;
    const offsetSeconds = tsDate.getTimezoneOffset() * 60;
    const t = Math.floor(tsDate.getTime() / 1000) - offsetSeconds;
    const bs = Math.floor(t / interval) * interval;
    const profit = getRollProfit(r);
    acc = parseFloat((acc + profit).toFixed(2));
    if (!bMap.has(bs)) {
      bMap.set(bs, { open: acc - profit, high: acc, low: acc, close: acc });
      bOrder.push(bs);
    } else {
      const b = bMap.get(bs)!;
      b.close = acc; b.high = Math.max(b.high, acc); b.low = Math.min(b.low, acc);
    }
  });
  return bOrder.map(bs => {
    const b = bMap.get(bs)!;
    if (!b) return null;
    const up = b.close >= b.open; const c = up ? "#e51e3e" : "rgba(200,200,220,0.8)";
    return { candle: { time: bs as Time, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c, borderColor: c }, acc: b.close, time: bs };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}

function LiveBettingStatus() {
  const [status, setStatus] = useState("Conectando...");
  const [red, setRed] = useState({ amt: 0, count: 0 });
  const [white, setWhite] = useState({ amt: 0, count: 0 });
  const [black, setBlack] = useState({ amt: 0, count: 0 });
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<{color: number, payout: number} | null>(null);

  const timerRef = useRef<any>(null);
  const pingRef = useRef<any>(null);

  useEffect(() => {
    let ws: WebSocket;
    
    const connect = () => {
      ws = new WebSocket("wss://api-gaming.blaze.bet.br/replication/?EIO=3&transport=websocket");
      
      ws.onopen = () => {
        setStatus("Aguardando...");
        ws.send("40");
        ws.send('420["cmd",{"id":"subscribe","payload":{"room":"double_room_1"}}]');
        pingRef.current = setInterval(() => {
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
               if (p.status === "waiting") {
                  setStatus("Apostas Abertas");
                  setResult(null);
                  if (!timerRef.current) {
                     setTimeLeft(15);
                     timerRef.current = setInterval(() => setTimeLeft(t => t > 0 ? t - 1 : 0), 1000);
                  }
               } else if (p.status === "rolling") {
                  setStatus("Girando...");
                  clearInterval(timerRef.current);
                  timerRef.current = null;
                  setTimeLeft(0);

                  if (p.color !== undefined && p.color !== null) {
                     const c = p.color;
                     let payout = 0;
                     if (c === 1) payout = parseFloat(p.total_red_bet ?? p.total_red_eur_bet ?? "0") * 2;
                     if (c === 2) payout = parseFloat(p.total_black_bet ?? p.total_black_eur_bet ?? "0") * 2;
                     if (c === 0) payout = parseFloat(p.total_white_bet ?? p.total_white_eur_bet ?? "0") * 14;
                     setResult({ color: c, payout });
                  }
               } else if (p.status === "complete") {
                  setStatus("Rodada Finalizada");
                  clearInterval(timerRef.current);
                  timerRef.current = null;
                  setTimeLeft(0);
                  
                  if (p.color !== undefined && p.color !== null) {
                     const c = p.color;
                     let payout = 0;
                     if (c === 1) payout = parseFloat(p.total_red_bet ?? p.total_red_eur_bet ?? "0") * 2;
                     if (c === 2) payout = parseFloat(p.total_black_bet ?? p.total_black_eur_bet ?? "0") * 2;
                     if (c === 0) payout = parseFloat(p.total_white_bet ?? p.total_white_eur_bet ?? "0") * 14;
                     setResult({ color: c, payout });
                  }
               }
               
               if (p.total_red_bet !== undefined || p.total_red_eur_bet !== undefined) {
                  setRed({ amt: parseFloat(p.total_red_bet ?? p.total_red_eur_bet ?? "0"), count: p.total_red_bets_placed || 0 });
                  setWhite({ amt: parseFloat(p.total_white_bet ?? p.total_white_eur_bet ?? "0"), count: p.total_white_bets_placed || 0 });
                  setBlack({ amt: parseFloat(p.total_black_bet ?? p.total_black_eur_bet ?? "0"), count: p.total_black_bets_placed || 0 });
               }
            }
          }
        } catch (err) {}
      };
      
      ws.onclose = () => {
        clearInterval(pingRef.current);
        clearInterval(timerRef.current);
        timerRef.current = null;
        setTimeout(connect, 2000);
      };
    };
    
    connect();
    
    return () => {
      clearInterval(pingRef.current);
      clearInterval(timerRef.current);
      if (ws) ws.close();
    };
    // eurRate via ref para evitar reconexão do WebSocket 
    // a cada mudança de câmbio
  }, []);

  const totalAmt = red.amt + white.amt + black.amt;
  const getPct = (amt: number) => totalAmt > 0 ? (amt / totalAmt) * 100 : 0;

  return (
    <div className="bg-[#12141c] border-b border-[#00c83a]/20 px-4 py-2 flex flex-col gap-2 shrink-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-20">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status da Rodada:</span>
          <div className="text-white font-black text-xs uppercase tracking-wider flex items-center gap-2">
            {status === "Apostas Abertas" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>}
            {status === "Girando..." && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>}
            {status}
          </div>
        </div>
        {status === "Apostas Abertas" && timeLeft > 0 && (
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#0a0a0f] border border-white/10 text-[10px] font-bold text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]">{timeLeft}</div>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-6">
        <div className={`flex flex-col gap-1.5 p-1.5 rounded-lg transition-colors ${result?.color === 1 ? 'bg-[#f12c4c]/20 border border-[#f12c4c]/50 shadow-[0_0_15px_rgba(241,44,76,0.2)]' : 'border border-transparent'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-[#f12c4c] flex shrink-0 shadow-[0_0_8px_rgba(241,44,76,0.3)]"></div>
              <div className="flex flex-col">
                <span className="text-white font-black text-[12px] leading-tight">R$ {red.amt.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">{red.count} apostas</span>
              </div>
            </div>
            {result?.color === 1 && (
              <span className="text-[#f12c4c] font-black text-[10px] bg-[#f12c4c]/10 px-1.5 py-0.5 rounded shadow-sm">+ R$ {result.payout.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
            )}
          </div>
          <div className="h-1 w-full bg-[#0a0a0f] rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-[#f12c4c]/50 to-[#f12c4c] rounded-full transition-all duration-300" style={{ width: `${getPct(red.amt)}%` }}></div>
          </div>
        </div>

        <div className={`flex flex-col gap-1.5 p-1.5 rounded-lg transition-colors ${result?.color === 0 ? 'bg-white/20 border border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'border border-transparent'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-white flex shrink-0 items-center justify-center shadow-[0_0_10px_rgba(255,255,255,0.3)] overflow-hidden">
                <img src="/blaze-white.png" alt="W" className="w-[14px] h-[14px] object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-black text-[12px] leading-tight">R$ {white.amt.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">{white.count} apostas</span>
              </div>
            </div>
            {result?.color === 0 && (
              <span className="text-white font-black text-[10px] bg-white/10 px-1.5 py-0.5 rounded shadow-sm">+ R$ {result.payout.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
            )}
          </div>
          <div className="h-1 w-full bg-[#0a0a0f] rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-white/50 to-white rounded-full transition-all duration-300" style={{ width: `${getPct(white.amt)}%` }}></div>
          </div>
        </div>

        <div className={`flex flex-col gap-1.5 p-1.5 rounded-lg transition-colors ${result?.color === 2 ? 'bg-slate-500/20 border border-slate-500/50 shadow-[0_0_15px_rgba(100,116,139,0.2)]' : 'border border-transparent'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-[#262831] border border-white/20 flex shrink-0 shadow-lg"></div>
              <div className="flex flex-col">
                <span className="text-white font-black text-[12px] leading-tight">R$ {black.amt.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">{black.count} apostas</span>
              </div>
            </div>
            {result?.color === 2 && (
              <span className="text-slate-300 font-black text-[10px] bg-slate-500/20 px-1.5 py-0.5 rounded shadow-sm">+ R$ {result.payout.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
            )}
          </div>
          <div className="h-1 w-full bg-[#0a0a0f] rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-slate-600 to-slate-400 rounded-full transition-all duration-300" style={{ width: `${getPct(black.amt)}%` }}></div>
          </div>
        </div>

      </div>
    </div>
  );
}

const globalTimeCache = new Map<string, number>();
let globalLastT = 0;

export default function GraficoPnlPanel({ globalData, isVip = false }: { globalData: Roll[], isVip?: boolean }) {
  const isMounted = useRef(true);
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  const cRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chart = useRef<any>(null), candle = useRef<any>(null);
  const sMap = useRef<Map<string, any>>(new Map());
  const cidx = useRef(0);

  const [tf, setTf] = useState("tick");
  const [inds, setInds] = useState<Ind[]>([]);
  
  // -- INTEGRAÇÃO SUPABASE (SALVAMENTO NA NUVEM) --
  const supabase = createClient();
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setIsSettingsLoaded(true);
        return;
      }
      
      const { data, error } = await supabase.from('profiles').select('chart_settings').eq('id', session.user.id).single();
      if (!error && data?.chart_settings?.inds) {
        setInds(data.chart_settings.inds);
      }
      setIsSettingsLoaded(true);
    };
    loadSettings();
  }, [supabase.auth]);

  const saveSettingsToCloud = async (newInds: Ind[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    await supabase.from('profiles').update({ chart_settings: { inds: newInds } }).eq('id', session.user.id);
  };
  
  // ------------------------------------------------

  const [showSide, setShowSide] = useState(false);
  const [indType, setIndType] = useState<"sma" | "ema" | "bb">("ema");
  const [indPer, setIndPer] = useState("");
  const [indColor, setIndColor] = useState("#facc15");
  const [indThick, setIndThick] = useState(1.5);
  const [profit, setProfit] = useState(0);
  const [limitLabel, setLimitLabel] = useState(500);
  const [showPeriod, setShowPeriod] = useState(false);
  const [startUnix, setStartUnix] = useState<number | null>(null);
  const [toast, setToast] = useState<{show: boolean, msg: string, type: 'success' | 'error'}>({show: false, msg: "", type: 'success'});

  useEffect(() => {
    if (startUnix === null && globalData.length > 0) {
      const idx = Math.max(0, globalData.length - limitLabel);
      if (globalData[idx]) {
        const offsetSeconds = new Date(globalData[idx].timestamp).getTimezoneOffset() * 60;
        setStartUnix(Math.floor(new Date(globalData[idx].timestamp).getTime() / 1000) - offsetSeconds);
      }
    }
  }, [globalData.length, startUnix, limitLabel]);

  const applyLimit = (l: number) => {
    setLimitLabel(l);
    const idx = Math.max(0, globalData.length - l);
    if (globalData[idx]) {
      const offsetSeconds = new Date(globalData[idx].timestamp).getTimezoneOffset() * 60;
      setStartUnix(Math.floor(new Date(globalData[idx].timestamp).getTime() / 1000) - offsetSeconds);
    } else {
      setStartUnix(0);
    }
    setShowPeriod(false);
  };
  
  // -- DRAWING MODE --
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const drawnLinesMap = useRef<Map<string, any>>(new Map());
  const drawingStartPt = useRef<{time: any, value: number} | null>(null);
  const previewLine = useRef<any>(null);

  useEffect(() => {
    if (!chart.current) return;

    chart.current.applyOptions({
      handleScroll: !isDrawingMode,
      handleScale: !isDrawingMode,
    });

    const resolveTime = (param: any) => {
      let time = param.time;
      if (time === undefined && param.point && chart.current) {
        const t = chart.current.timeScale().coordinateToTime(param.point.x);
        if (t !== null && t !== undefined) {
          time = t;
        } else if (param.logical !== null && param.logical !== undefined) {
          time = globalLastT + (param.logical * 60);
        }
      }
      return typeof time === 'number' ? time : undefined;
    };

    const handleClick = (param: any) => {
      if (!isDrawingMode || !param.point) return;
      const time = resolveTime(param);
      if (time === undefined) return;
      
      const price = candle.current?.coordinateToPrice(param.point.y);
      if (price === null || price === undefined || Math.abs(price) > 10000000) return;

      if (!drawingStartPt.current) {
        drawingStartPt.current = { time, value: price };
          previewLine.current = chart.current.addSeries(LineSeries, { 
            color: '#00c83a', 
            lineWidth: 2, 
            lineStyle: 0, 
            crosshairMarkerVisible: true, 
            priceLineVisible: false, 
            lastValueVisible: false
          });
        previewLine.current.setData([{ time: time, value: price }]);
      } else {
        const pt2 = { time, value: price };
        const pt1 = drawingStartPt.current;
        
        if (Number(pt1.time) === Number(pt2.time)) {
          return;
        }

        drawingStartPt.current = null;
        
        if (previewLine.current) {
          const sorted = [pt1, pt2].sort((a, b) => Number(a.time) - Number(b.time));
          previewLine.current.setData(sorted);
          previewLine.current.applyOptions({ crosshairMarkerVisible: false });
          
          const id = 'line_' + Date.now();
          drawnLinesMap.current.set(id, previewLine.current);
          
          previewLine.current = null;
          
          // Sai do modo de desenho automaticamente após criar 1 linha
          setIsDrawingMode(false);
        }
      }
    };

    // ... local vars for loop prevention
    let lastX: any = null;
    let lastY: any = null;

    const handleMove = (param: any) => {
      if (!isDrawingMode || !drawingStartPt.current || !previewLine.current) return;
      if (!param.point) return;
      
      const time = resolveTime(param);
      if (time === undefined) return;
      
      if (lastX === param.point.x && lastY === param.point.y) return;
      lastX = param.point.x;
      lastY = param.point.y;

      const price = candle.current?.coordinateToPrice(param.point.y);
      if (price === null || price === undefined || Math.abs(price) > 10000000) return;
      
      const pt1 = drawingStartPt.current;
      const pt2 = { time: time, value: price };
      
      if (Number(pt1.time) === Number(pt2.time)) {
        previewLine.current.setData([{ time: pt1.time, value: pt1.value }]);
        return;
      }
      
      const sorted = [pt1, pt2].sort((a, b) => Number(a.time) - Number(b.time));
      previewLine.current.setData(sorted);
    };

    chart.current.subscribeClick(handleClick);
    chart.current.subscribeCrosshairMove(handleMove);

    return () => {
      if (chart.current) {
        chart.current.unsubscribeClick(handleClick);
        chart.current.unsubscribeCrosshairMove(handleMove);
      }
    };
  }, [isDrawingMode]);

  const clearDrawnLines = () => {
    drawnLinesMap.current.forEach(s => {
      if (chart.current) {
        try { chart.current.removeSeries(s); } catch {}
      }
    });
    drawnLinesMap.current.clear();
  };
  // -------------------

  const getBuilt = useCallback((data: Roll[]) => {
    const tfObj = TFS.find(t => t.k === tf)!;
    return tfObj.m === 0 ? buildTick(data) : buildAgg(data, tfObj.m);
  }, [tf]);

  const updateInds = useCallback((accumulated: number[], times: number[], indList: Ind[]) => {
    indList.forEach(ind => {
      if (ind.type === "bb") {
        const su = sMap.current.get(ind.key + "_upper");
        const sm = sMap.current.get(ind.key + "_middle");
        const sl = sMap.current.get(ind.key + "_lower");
        if (!su || !sm || !sl) return;
        const vals = calcBB(accumulated, ind.period, 2);
        su.setData(times.map((t, i) => vals[i] !== null ? { time: t, value: (vals[i] as any).upper } : null).filter(Boolean) as any);
        sm.setData(times.map((t, i) => vals[i] !== null ? { time: t, value: (vals[i] as any).middle } : null).filter(Boolean) as any);
        sl.setData(times.map((t, i) => vals[i] !== null ? { time: t, value: (vals[i] as any).lower } : null).filter(Boolean) as any);
      } else {
        const s = sMap.current.get(ind.key); if (!s) return;
        const vals = ind.type === "sma" ? calcSMA(accumulated, ind.period) : calcEMA(accumulated, ind.period);
        s.setData(times.map((t, i) => vals[i] !== null && !isNaN(vals[i] as number) && !isNaN(t) ? { time: t, value: vals[i] } : null).filter(Boolean) as any);
      }
    });
  }, []);

  const getActiveData = useCallback(() => {
    if (!globalData || globalData.length === 0) return [];
    // Garantir que os dados passem sempre em ordem cronológica CRESCENTE (antigo -> novo)
    const sorted = [...globalData].sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      return (isNaN(tA) ? 0 : tA) - (isNaN(tB) ? 0 : tB);
    });

    if (startUnix) {
      const filtered = sorted.filter(r => {
        const offsetSeconds = new Date(r.timestamp).getTimezoneOffset() * 60;
        const t = Math.floor(new Date(r.timestamp).getTime() / 1000) - offsetSeconds;
        return t >= startUnix;
      });
      if (filtered.length > 0) return filtered;
    }
    return limitLabel ? sorted.slice(-limitLabel) : sorted;
  }, [globalData, startUnix, limitLabel]);

  const renderAll = useCallback((fit = false) => {
    if (!isMounted.current || !candle.current || !globalData.length) return;
    const activeData = getActiveData();
    const built = getBuilt(activeData);
    
    const rawCandles = built.map(b => b.candle).filter(c => c && !isNaN(Number(c.time)) && !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.close));
    
    // Garantir timestamps estritamente crescentes e sem duplicatas para a biblioteca
    const safeCandles: any[] = [];
    let lastTSeen = -1;
    for (const c of rawCandles) {
      const t = Number(c.time);
      if (t > lastTSeen) {
        safeCandles.push(c);
        lastTSeen = t;
      }
    }
    
    const lastTime = safeCandles.length > 0 ? Number(safeCandles[safeCandles.length - 1].time) : 0;

    try {
      const timeScale = chart.current?.timeScale();
      const oldRange = timeScale?.getVisibleLogicalRange();

      candle.current.setData(safeCandles as any);
      
      const accs = built.map(b => b.acc); const times = built.map(b => b.time);
      setProfit(accs[accs.length - 1] ?? 0);
      setInds(prev => { updateInds(accs, times, prev); return prev; });
      
      if (fit) {
        timeScale?.fitContent();
      } else if (oldRange && oldRange.to < safeCandles.length - 2) {
        timeScale?.setVisibleLogicalRange(oldRange);
      }
    } catch (e) {
      console.warn("RenderAll Error Suppressed:", e);
    }
  }, [getBuilt, getActiveData, globalData.length, updateInds]);

  // Init chart
  useEffect(() => {
    if (!cRef.current) return;
    const c = createChart(cRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#6b7280", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { labelBackgroundColor: "#1f2937" }, horzLine: { labelBackgroundColor: "#e51e3e" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.05)", scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: "rgba(255,255,255,0.05)", timeVisible: true, secondsVisible: false, rightOffset: 20 },
      handleScroll: true, handleScale: true
    });
    chart.current = c;
    candle.current = c.addSeries(CandlestickSeries, { upColor: "#e51e3e", downColor: "rgba(200,200,220,0.8)", borderVisible: false, wickVisible: true });
    
    // Forçar a primeira renderização dos dados assim que a série estiver pronta
    setTimeout(() => {
      renderAll(true);
    }, 50);

    const ro = new ResizeObserver(() => { if (cRef.current && chart.current) chart.current.applyOptions({ width: cRef.current.clientWidth, height: cRef.current.clientHeight }); });
    if (cRef.current) ro.observe(cRef.current);
  
  return () => { 
    ro.disconnect(); 
    try { c.remove(); } catch (e) { } 
    chart.current = null; 
    candle.current = null; 
    sMap.current.clear(); 
    drawnLinesMap.current.clear();
  };
  }, []);

  const addInd = () => {
    if (!chart.current) return; const p = parseInt(indPer); if (isNaN(p) || p < 2) return;
    const key = `${indType}_${p}_${Date.now()}`;
    const color = indColor || CPOOL[cidx.current % CPOOL.length]; cidx.current++;
    
    if (indType === "bb") {
      const su = chart.current.addSeries(LineSeries, { color, lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: true });
      const sm = chart.current.addSeries(LineSeries, { color, lineWidth: indThick, lineStyle: 0, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: true });
      const sl = chart.current.addSeries(LineSeries, { color, lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: true });
      sMap.current.set(key + "_upper", su);
      sMap.current.set(key + "_middle", sm);
      sMap.current.set(key + "_lower", sl);
      
      const activeData = getActiveData();
      const built = getBuilt(activeData);
      const accs = built.map(b => b.acc); const times = built.map(b => b.time);
      const vals = calcBB(accs, p, 2);
      su.setData(times.map((t, i) => vals[i] !== null ? { time: t, value: (vals[i] as any).upper } : null).filter(Boolean) as any);
      sm.setData(times.map((t, i) => vals[i] !== null ? { time: t, value: (vals[i] as any).middle } : null).filter(Boolean) as any);
      sl.setData(times.map((t, i) => vals[i] !== null ? { time: t, value: (vals[i] as any).lower } : null).filter(Boolean) as any);
    } else {
      const s = chart.current.addSeries(LineSeries, { color, lineWidth: indThick, lineStyle: indType === "ema" ? 1 : 0, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: true });
      sMap.current.set(key, s);
      const activeData = getActiveData();
      const built = getBuilt(activeData);
      const accs = built.map(b => b.acc); const times = built.map(b => b.time);
      const vals = indType === "sma" ? calcSMA(accs, p) : calcEMA(accs, p);
      s.setData(times.map((t, i) => vals[i] !== null ? { time: t, value: vals[i] } : null).filter(Boolean) as any);
    }
    
    setInds(prev=>{
      const novo = [...prev,{key,type:indType,period:p,color,thickness:indThick}];
      saveSettingsToCloud(novo);
      return novo;
    });
    setIndPer("");
  };

  const removeInd = (key: string) => {
    const ind = inds.find(i => i.key === key);
    if (ind && ind.type === "bb") {
      ["_upper", "_middle", "_lower"].forEach(suffix => {
        const s = sMap.current.get(key + suffix);
        if (s && chart.current) { try { s.applyOptions({ visible: false }); s.setData([]); chart.current.removeSeries(s); } catch { } }
        sMap.current.delete(key + suffix);
      });
    } else {
      const s = sMap.current.get(key);
      if (s && chart.current) { try { s.applyOptions({ visible: false }); s.setData([]); chart.current.removeSeries(s); } catch { } }
      sMap.current.delete(key);
    }
    setInds(prev=>{
      const novo = prev.filter(i=>i.key!==key);
      saveSettingsToCloud(novo);
      return novo;
    });
  };

  const prevTf = useRef(tf);
  const prevLen = useRef(0);

  // Update when activeData or tf changes
  useEffect(() => {
    let shouldFit = false;
    if (tf !== prevTf.current) {
      shouldFit = true;
      prevTf.current = tf;
    } else if (globalData.length > 0 && prevLen.current === 0) {
      shouldFit = true;
    }
    prevLen.current = globalData.length;

    renderAll(shouldFit);
  }, [tf, globalData, renderAll]);

  const zoomIn = () => { const r = chart.current?.timeScale().getVisibleLogicalRange(); if (!r) return; const c = (r.from + r.to) / 2, sz = (r.to - r.from) * 0.35; chart.current.timeScale().setVisibleLogicalRange({ from: c - sz, to: c + sz }); };
  const zoomOut = () => { const r = chart.current?.timeScale().getVisibleLogicalRange(); if (!r) return; const c = (r.from + r.to) / 2, sz = (r.to - r.from) * 0.7; chart.current.timeScale().setVisibleLogicalRange({ from: c - sz, to: c + sz }); };
  const resetZoom = () => chart.current?.timeScale().fitContent();

  const handlePrint = async () => {
    if (!wrapRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(wrapRef.current, { backgroundColor: '#050507', pixelRatio: 2 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      setToast({ show: true, msg: "Print do gráfico tirado, compartilhe com amigos! 🚀", type: 'success' });
      setTimeout(() => setToast(t => ({...t, show: false})), 3000);
    } catch (e) {
      console.error("Erro no html-to-image", e);
      setToast({ show: true, msg: "Erro ao copiar o gráfico.", type: 'error' });
      setTimeout(() => setToast(t => ({...t, show: false})), 3000);
    }
  };

  const FloatBtn = ({ onClick, children, active, title }: { onClick: any, children: React.ReactNode, active?: boolean, title?: string }) => (
    <button onClick={onClick} title={title} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all backdrop-blur-md shadow-[0_4px_15px_rgba(0,98,255,0.2)] ${active ? 'bg-[#00c83a]/30 border-[#00c83a]/50 text-white' : 'bg-[#00c83a]/10 border-[#00c83a]/30 text-white hover:bg-[#00c83a]/30 hover:border-[#00c83a]/50'}`}>
      {children}
    </button>
  );


  useEffect(() => {
    if (!chart.current || !isSettingsLoaded) return;
    let changed = false;
    inds.forEach(ind => {
      if (!sMap.current.has(ind.key)) {
        const s = chart.current.addSeries(LineSeries, {
          color: ind.color,
          lineWidth: ind.thickness,
          lineStyle: ind.type === "ema" ? 1 : 0,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: true
        });
        sMap.current.set(ind.key, s);
        changed = true;
      }
    });
    // Remove series that are in sMap but not in inds
    sMap.current.forEach((s, key) => {
      if (!inds.find(i => i.key === key)) {
        try { chart.current.removeSeries(s); } catch {}
        sMap.current.delete(key);
      }
    });
    if (changed) renderAll(false);
  }, [inds, isSettingsLoaded, renderAll]);

  return (
    <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative w-full h-[700px]">
      <style>{`
        #tv-attr-logo { display: none !important; opacity: 0 !important; pointer-events: none !important; }
      `}</style>
      {/* TOAST NOTIFICATION */}
      {toast.show && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full font-bold text-sm tracking-widest uppercase shadow-2xl border backdrop-blur-md transition-all animate-bounce flex items-center gap-2 ${toast.type === 'success' ? 'bg-[#00c83a]/20 border-[#00c83a] text-[#00c83a]' : 'bg-rose-500/20 border-rose-500 text-rose-500'}`}>
          {toast.type === 'success' ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
          {toast.msg}
        </div>
      )}
      {/* HEADER PREMIUM */}
      <div className="px-5 py-4 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[3px] border-t-[#00c83a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] shrink-0 z-10">
        <div className="flex items-center gap-4">
          <span className="text-[14px] font-black uppercase tracking-widest text-white flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#00c83a]"><path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" /></svg>
            Gráfico de Lucros (PNL)
          </span>
          <span className={`px-2.5 py-1 rounded-md text-[12px] font-bold tracking-widest ${profit >= 0 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}>
            {profit >= 0 ? "+" : ""}R$ {profit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* TF Selector */}
        <div className="flex bg-black/40 rounded-lg p-1 border border-white/10 gap-1 overflow-x-auto custom-scrollbar max-w-full">
          {TFS.map(t => (
            <button key={t.k} onClick={() => {
              if (!isVip && t.k !== 'tick') {
                alert('Tempo gráfico customizado é exclusivo para usuários VIP!');
                return;
              }
              setTf(t.k);
            }} className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${tf === t.k ? "bg-[#00c83a] text-white shadow-[0_2px_10px_rgba(0,98,255,0.4)]" : "text-slate-500 hover:text-white"} ${!isVip && t.k !== 'tick' ? "opacity-50 cursor-not-allowed" : ""}`} title={!isVip && t.k !== 'tick' ? "Exclusivo VIP" : ""}>{t.l}</button>
          ))}
        </div>
      </div>

      <LiveBettingStatus />

      {/* CHART WRAPPER */}
      <div ref={wrapRef} className="relative flex-1 bg-[#050507]">
        {/* WATERMARK APEX MACHINE */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-5 z-0 select-none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-48 h-48 text-[#00c83a] mb-2">
            <path d="M3 3v18h18" />
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
          <h1 className="text-[5rem] font-black tracking-tighter text-white leading-none">APEX MACHINE</h1>
          <p className="text-[1.5rem] font-bold tracking-widest text-[#00c83a] uppercase mt-2">apexmachine.com.br</p>
        </div>

        <div ref={cRef} className="z-10" style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />

        {/* FLOATING BUTTONS */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
          {/* Period */}
          <div className="relative">
            <FloatBtn onClick={() => setShowPeriod(v => !v)} active={showPeriod}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </FloatBtn>
            {showPeriod && (
              <div className="absolute bottom-12 right-0 bg-[#0f141e]/95 backdrop-blur-md border border-[#00c83a]/30 rounded-xl p-2 flex flex-col gap-1 min-w-[110px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                {[250, 500, 1000, 2000, 3000, 5000, 10000].map(l => (
                  <button key={l} onClick={() => { applyLimit(l); renderAll(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-left uppercase tracking-widest ${limitLabel === l ? "bg-[#00c83a] text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>{l >= 1000 ? `${l / 1000}k` : l} result.</button>
                ))}
              </div>
            )}
          </div>
          <FloatBtn onClick={zoomOut}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </FloatBtn>
          <FloatBtn onClick={resetZoom}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          </FloatBtn>
          <FloatBtn onClick={handlePrint} title="Copiar Imagem">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </FloatBtn>
          <FloatBtn onClick={zoomIn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </FloatBtn>

          <FloatBtn onClick={() => { 
              setIsDrawingMode(!isDrawingMode); 
              if(isDrawingMode && previewLine.current) { 
                try { chart.current.removeSeries(previewLine.current); } catch {} 
                previewLine.current=null; drawingStartPt.current=null; 
              } 
            }} active={isDrawingMode} title="Desenhar Linha Livre">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="4" /><circle cx="4" cy="20" r="2" fill="currentColor"/><circle cx="20" cy="4" r="2" fill="currentColor"/></svg>
          </FloatBtn>
          <FloatBtn onClick={clearDrawnLines} title="Limpar Desenhos">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
          </FloatBtn>

          <FloatBtn onClick={() => setShowSide(v => !v)} active={showSide} title="Indicadores Analíticos">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
          </FloatBtn>
        </div>

        {/* SIDE PANEL */}
        {showSide && (
          <div className="absolute right-0 top-0 bottom-0 w-[300px] bg-[#0f141e]/95 backdrop-blur-xl border-l border-[#00c83a]/30 z-20 flex flex-col shadow-[-8px_0_32px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#00c83a]/20">
              <h3 className="font-black text-xs uppercase tracking-widest text-[#00c83a] flex items-center gap-2">Indicadores</h3>
              <button onClick={() => setShowSide(false)} className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs text-white transition-colors">✕</button>
            </div>
            <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="pt-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Adicionar Média Móvel</h4>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">Tipo</label>
                  <select value={indType} onChange={e => setIndType(e.target.value as "sma" | "ema" | "bb")} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#00c83a]">
                    <option value="ema">EMA (Exponencial)</option><option value="sma">SMA (Simples)</option><option value="bb">BB (Bandas de Bollinger)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div><label className="text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">Período</label><input type="number" value={indPer} onChange={e => setIndPer(e.target.value)} placeholder="ex: 20" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#00c83a]" /></div>
                  <div><label className="text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">Espessura</label><input type="number" value={indThick} onChange={e => setIndThick(parseFloat(e.target.value) || 1.5)} min="0.5" max="5" step="0.5" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#00c83a]" /></div>
                </div>
                <div className="mt-3"><label className="text-[10px] font-bold text-slate-500 block mb-1.5 uppercase">Cor</label><input type="color" value={indColor} onChange={e => setIndColor(e.target.value)} className="w-full h-9 rounded-lg border border-white/10 bg-black/40 cursor-pointer" /></div>
                <button onClick={addInd} className="w-full mt-4 py-2.5 bg-[#00c83a] hover:bg-blue-600 rounded-lg text-xs font-black uppercase tracking-widest transition-colors shadow-[0_4px_15px_rgba(0,98,255,0.4)] text-white">Adicionar</button>
                
                {inds.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[10px] text-slate-400 font-bold mb-2 uppercase tracking-widest">Ativos</p>
                    <div className="space-y-2">
                      {inds.map(ind => (
                        <div key={ind.key} className="flex items-center justify-between bg-black/40 border border-white/5 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: ind.color }} /><span className="text-xs font-bold text-white">{ind.type.toUpperCase()} {ind.period}</span></div>
                          <button onClick={() => removeInd(ind.key)} className="text-slate-500 hover:text-rose-400 text-[10px] font-black uppercase tracking-widest transition-colors">Remover</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
