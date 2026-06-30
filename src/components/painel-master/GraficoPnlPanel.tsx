import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries } from "lightweight-charts";

function calcSMA(v: number[], p: number) { return v.map((_, i) => i < p - 1 ? null : v.slice(i-p+1,i+1).reduce((a,b)=>a+b,0)/p); }
function calcEMA(v: number[], p: number) { const k=2/(p+1); let e: number|null=null; return v.map((x,i)=>{ if(i<p-1)return null; e=e===null?v.slice(0,p).reduce((a,b)=>a+b,0)/p:x*k+e*(1-k); return parseFloat(e.toFixed(2)); }); }

interface Ind { key:string; type:"sma"|"ema"; period:number; color:string; thickness:number; }
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
  { k: "5m", l: "5m", m: 5 },
  { k: "10m", l: "10m", m: 10 },
  { k: "15m", l: "15m", m: 15 },
  { k: "30m", l: "30m", m: 30 },
  { k: "1h", l: "1h", m: 60 },
  { k: "2h", l: "2h", m: 120 },
  { k: "3h", l: "3h", m: 180 },
  { k: "5h", l: "5h", m: 300 }
];
const LIMITS = [200, 500, 1000, 1500, 2000, 3000, 5000, 10000];

function buildTick(data: Roll[]) {
  let acc = 0; const times: number[] = [];
  return data.map(r => {
    let t = Math.floor(new Date(r.timestamp).getTime() / 1000);
    if (times.length && t <= times[times.length - 1]) t = times[times.length - 1] + 1;
    times.push(t);
    const prev = acc;
    acc = parseFloat((acc + parseFloat(String(r.house_profit || 0))).toFixed(2));
    const c = CMAP[r.color?.toUpperCase()] ?? "#555566";
    return { candle: { time: t, open: prev, high: Math.max(prev, acc), low: Math.min(prev, acc), close: acc, color: c, wickColor: c, borderColor: c }, acc, time: t };
  });
}

function buildAgg(data: Roll[], minutes: number) {
  let acc = 0; const bMap = new Map<number, { open: number, high: number, low: number, close: number }>();
  const bOrder: number[] = [];
  data.forEach(r => {
    const ms = new Date(r.timestamp).getTime();
    const bs = Math.floor(ms / (minutes * 60000)) * (minutes * 60);
    acc = parseFloat((acc + parseFloat(String(r.house_profit || 0))).toFixed(2));
    if (!bMap.has(bs)) {
      bMap.set(bs, { open: acc - (parseFloat(String(r.house_profit || 0))), high: acc, low: acc, close: acc });
      bOrder.push(bs);
    } else {
      const b = bMap.get(bs)!;
      b.close = acc; b.high = Math.max(b.high, acc); b.low = Math.min(b.low, acc);
    }
  });
  return bOrder.map(bs => {
    const b = bMap.get(bs)!; const up = b.close >= b.open; const c = up ? "#e51e3e" : "rgba(200,200,220,0.8)";
    return { candle: { time: bs as number, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c, borderColor: c }, acc: b.close, time: bs };
  });
}

export default function GraficoPnlPanel({ globalData }: { globalData: Roll[] }) {
  const cRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chart = useRef<any>(null), candle = useRef<any>(null);
  const sMap = useRef<Map<string, any>>(new Map());
  const cidx = useRef(0);

  const [tf, setTf] = useState("tick");
  const [inds, setInds] = useState<Ind[]>([]);
  const [showSide, setShowSide] = useState(false);
  const [indType, setIndType] = useState<"sma" | "ema">("ema");
  const [indPer, setIndPer] = useState("");
  const [indColor, setIndColor] = useState("#facc15");
  const [indThick, setIndThick] = useState(1.5);
  const [profit, setProfit] = useState(0);
  const [limit, setLimit] = useState(500);
  const [showPeriod, setShowPeriod] = useState(false);
  
  const activeData = globalData.slice(-limit);

  const getBuilt = useCallback((data: Roll[]) => {
    const tfObj = TFS.find(t => t.k === tf)!;
    return tfObj.m === 0 ? buildTick(data) : buildAgg(data, tfObj.m);
  }, [tf]);

  const updateInds = useCallback((accumulated: number[], times: number[], indList: Ind[]) => {
    indList.forEach(ind => {
      const s = sMap.current.get(ind.key); if (!s) return;
      const vals = ind.type === "sma" ? calcSMA(accumulated, ind.period) : calcEMA(accumulated, ind.period);
      s.setData(times.map((t, i) => vals[i] !== null && !isNaN(vals[i] as number) && !isNaN(t) ? { time: t, value: vals[i] } : null).filter(Boolean) as any);
    });
  }, []);

  const renderAll = useCallback((fit = false) => {
    if (!candle.current || !activeData.length) return;
    const built = getBuilt(activeData);
    const safeCandles = built.map(b => b.candle).filter(c => !isNaN(c.time) && !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.close));
    candle.current.setData(safeCandles as any);
    if (fit) chart.current?.timeScale().fitContent();
    const accs = built.map(b => b.acc); const times = built.map(b => b.time);
    setProfit(accs[accs.length - 1] ?? 0);
    setInds(prev => { updateInds(accs, times, prev); return prev; });
  }, [getBuilt, activeData, updateInds]);

  // Init chart
  useEffect(() => {
    if (!cRef.current) return;
    const c = createChart(cRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#6b7280", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { labelBackgroundColor: "#1f2937" }, horzLine: { labelBackgroundColor: "#e51e3e" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.05)", scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: "rgba(255,255,255,0.05)", timeVisible: true, secondsVisible: false },
      handleScroll: true, handleScale: true
    });
    chart.current = c;
    candle.current = c.addSeries(CandlestickSeries, { upColor: "#e51e3e", downColor: "rgba(200,200,220,0.8)", borderVisible: false, wickVisible: true });
    const ro = new ResizeObserver(() => { if (cRef.current && chart.current) chart.current.applyOptions({ width: cRef.current.clientWidth, height: cRef.current.clientHeight }); });
    if (cRef.current) ro.observe(cRef.current);
    return () => { ro.disconnect(); try { c.remove(); } catch (e) { } chart.current = null; candle.current = null; sMap.current.clear(); };
  }, []);

  const addInd = () => {
    if (!chart.current) return; const p = parseInt(indPer); if (isNaN(p) || p < 2) return;
    const key = `${indType}_${p}_${Date.now()}`;
    const s = chart.current.addSeries(LineSeries, { color: indColor, lineWidth: indThick, lineStyle: indType === "ema" ? 1 : 0, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: true });
    sMap.current.set(key, s);
    const built = getBuilt(activeData); const accs = built.map(b => b.acc); const times = built.map(b => b.time);
    const vals = indType === "sma" ? calcSMA(accs, p) : calcEMA(accs, p);
    s.setData(times.map((t, i) => vals[i] !== null ? { time: t, value: vals[i] } : null).filter(Boolean) as any);
    const color = CPOOL[cidx.current % CPOOL.length]; cidx.current++;
    setInds(prev => [...prev, { key, type: indType, period: p, color: indColor || color, thickness: indThick }]);
    setIndPer("");
  };

  const removeInd = (key: string) => {
    const s = sMap.current.get(key);
    if (s && chart.current) { try { s.applyOptions({ visible: false }); s.setData([]); chart.current.removeSeries(s); } catch { } }
    sMap.current.delete(key); setInds(prev => prev.filter(i => i.key !== key));
  };

  const prevTf = useRef(tf);
  const prevLen = useRef(0);

  // Update when activeData or tf changes
  useEffect(() => {
    let shouldFit = false;
    if (tf !== prevTf.current) {
      shouldFit = true;
      prevTf.current = tf;
    } else if (activeData.length > 0 && prevLen.current === 0) {
      shouldFit = true;
    }
    prevLen.current = activeData.length;

    renderAll(shouldFit);
  }, [tf, activeData, renderAll]);

  const zoomIn = () => { const r = chart.current?.timeScale().getVisibleLogicalRange(); if (!r) return; const c = (r.from + r.to) / 2, sz = (r.to - r.from) * 0.35; chart.current.timeScale().setVisibleLogicalRange({ from: c - sz, to: c + sz }); };
  const zoomOut = () => { const r = chart.current?.timeScale().getVisibleLogicalRange(); if (!r) return; const c = (r.from + r.to) / 2, sz = (r.to - r.from) * 0.7; chart.current.timeScale().setVisibleLogicalRange({ from: c - sz, to: c + sz }); };
  const resetZoom = () => chart.current?.timeScale().fitContent();

  const FloatBtn = ({ onClick, children, active }: { onClick: () => void, children: React.ReactNode, active?: boolean }) => (
    <button onClick={onClick} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all backdrop-blur-md shadow-[0_4px_15px_rgba(0,98,255,0.2)] ${active ? 'bg-[#00c83a]/30 border-[#00c83a]/50 text-white' : 'bg-[#00c83a]/10 border-[#00c83a]/30 text-white hover:bg-[#00c83a]/30 hover:border-[#00c83a]/50'}`}>
      {children}
    </button>
  );

  return (
    <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative w-full h-[700px]">
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
            <button key={t.k} onClick={() => setTf(t.k)} className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${tf === t.k ? "bg-[#00c83a] text-white shadow-[0_2px_10px_rgba(0,98,255,0.4)]" : "text-slate-500 hover:text-white"}`}>{t.l}</button>
          ))}
        </div>
      </div>

      {/* CHART WRAPPER */}
      <div ref={wrapRef} className="relative flex-1 bg-[#050507]">
        <div ref={cRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />

        {/* FLOATING BUTTONS */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
          {/* Period */}
          <div className="relative">
            <FloatBtn onClick={() => setShowPeriod(v => !v)} active={showPeriod}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </FloatBtn>
            {showPeriod && (
              <div className="absolute bottom-12 right-0 bg-[#0f141e]/95 backdrop-blur-md border border-[#00c83a]/30 rounded-xl p-2 flex flex-col gap-1 min-w-[110px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                {LIMITS.map(l => (
                  <button key={l} onClick={() => { setLimit(l); setShowPeriod(false); renderAll(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-left uppercase tracking-widest ${limit === l ? "bg-[#00c83a] text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>{l >= 1000 ? `${l / 1000}k` : l} result.</button>
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
          <FloatBtn onClick={zoomIn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </FloatBtn>
          <FloatBtn onClick={() => setShowSide(v => !v)} active={showSide}>
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
                  <select value={indType} onChange={e => setIndType(e.target.value as "sma" | "ema")} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#00c83a]">
                    <option value="ema">EMA (Exponencial)</option><option value="sma">SMA (Simples)</option>
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
