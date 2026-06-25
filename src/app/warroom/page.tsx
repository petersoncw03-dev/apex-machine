"use client";
import { useSSE } from "@/contexts/SSEContext";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Activity, ShieldAlert, Eye, EyeOff, Crosshair, BarChart2, Zap, BrainCircuit, Plus, Trash2, ChevronDown, ChevronUp, Save } from "lucide-react";
import { createChart, ColorType, CandlestickSeries, LineSeries, CrosshairMode } from "lightweight-charts";

interface Roll {
  id?: string;
  color: string;
  roll: string | number;
  house_profit?: string;
  timestamp?: string;
}

const CMAP: Record<string,string> = {BRANCO:"#ffffff",VERMELHO:"#e51e3e",PRETO:"#555566"};

function calcSMA(v: number[], p: number) { return v.map((_, i) => i < p - 1 ? null : v.slice(i-p+1,i+1).reduce((a,b)=>a+b,0)/p); }
function calcEMA(v: number[], p: number) { 
  const k=2/(p+1); let e: number|null=null; 
  return v.map((x,i)=>{ 
    if(i<p-1)return null; 
    e=e===null?v.slice(0,p).reduce((a,b)=>a+b,0)/p:x*k+e*(1-k); 
    return parseFloat(e.toFixed(2)); 
  }); 
}

function buildTick(data: any[]) {
  let acc=0; const times: number[]=[];
  return data.map(r=>{ 
    let t=Math.floor(new Date(r.timestamp || new Date()).getTime()/1000); 
    if(times.length&&t<=times[times.length-1])t=times[times.length-1]+1; 
    times.push(t); 
    const prev=acc; acc=parseFloat((acc+parseFloat(r.house_profit||"0")).toFixed(2)); 
    const c=CMAP[r.color.toUpperCase()]??"#555566"; 
    return {candle:{time:t,open:prev,high:Math.max(prev,acc),low:Math.min(prev,acc),close:acc,color:c,wickColor:c,borderColor:c},acc,time:t}; 
  });
}

export default function WarRoomPage() {
  const [data, setData] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscribe } = useSSE();

  // Settings
  const [useGraph, setUseGraph] = useState(true);
  const [numAverages, setNumAverages] = useState(2); // 1, 2, or 3
  const [showChart, setShowChart] = useState(true);
  const [showRadar, setShowRadar] = useState(true);
  const [showAnalista, setShowAnalista] = useState(true);

  // Analista Filters
  interface AnalistaFilter { id: string; name: string; patternType: 'color' | 'number' | 'mixed'; targetFocus: 'ALL' | 'B' | 'V' | 'P'; lossMode: 'CICLO' | 'ENTRADA'; size: number; casasLimit: [number, number]; periodHours: number; minWinRate: number; minOcorrencias: number; maxSa: number; minSaFilter: number; isExpanded?: boolean; }
  const [analistaFilters, setAnalistaFilters] = useState<AnalistaFilter[]>([
     { id: 'default_1', name: 'IA Robô 1 (5 Casas)', patternType: 'mixed', targetFocus: 'B', lossMode: 'ENTRADA', size: 0, casasLimit: [1, 5], periodHours: 24, minWinRate: 90, minOcorrencias: 5, maxSa: 5, minSaFilter: 0, isExpanded: false }
  ]);

  const addAnalistaFilter = () => setAnalistaFilters(prev => [...prev, { id: Math.random().toString(), name: `IA Robô ${prev.length + 1}`, patternType: 'mixed', targetFocus: 'B', lossMode: 'ENTRADA', size: 0, casasLimit: [1, 5], periodHours: 24, minWinRate: 90, minOcorrencias: 5, maxSa: 5, minSaFilter: 0, isExpanded: true }]);
  const updateAnalistaFilter = (id: string, field: keyof AnalistaFilter, val: any) => setAnalistaFilters(prev => prev.map(f => f.id === id ? { ...f, [field]: val } : f));
  const removeAnalistaFilter = (id: string) => setAnalistaFilters(prev => prev.filter(f => f.id !== id));

  // Confluence Filters (Radar)
  interface ConfluenceFilter { id: string; name: string; casasLimit: number; periodHours: number; minOcorrencias: number; minWinRate: number; maxWinRate: number; minSa: number; isExpanded?: boolean; }
  const [confluenceFilters, setConfluenceFilters] = useState<ConfluenceFilter[]>([
     { id: 'conf_1', name: 'Radar de 3 Entradas', casasLimit: 3, periodHours: 24, minOcorrencias: 5, minWinRate: 85, maxWinRate: 100, minSa: 0, isExpanded: false },
     { id: 'conf_2', name: 'Radar de 5 Entradas', casasLimit: 5, periodHours: 48, minOcorrencias: 10, minWinRate: 90, maxWinRate: 100, minSa: 0, isExpanded: false }
  ]);
  
  const addConfluenceFilter = () => setConfluenceFilters(prev => [...prev, { id: Math.random().toString(), name: `Radar de 5 Entradas`, casasLimit: 5, periodHours: 24, minOcorrencias: 5, minWinRate: 90, maxWinRate: 100, minSa: 0, isExpanded: true }]);
  const updateConfluenceFilter = (id: string, field: keyof ConfluenceFilter, val: any) => setConfluenceFilters(prev => prev.map(f => f.id === id ? { ...f, [field]: val } : f));
  const removeConfluenceFilter = (id: string) => setConfluenceFilters(prev => prev.filter(f => f.id !== id));

  // Status
  const [marketStatus, setMarketStatus] = useState<'PAGANDO' | 'RETENDO' | 'NEUTRO'>('NEUTRO');
  const [warRoomStatus, setWarRoomStatus] = useState<'AGUARDANDO' | 'ATIRAR' | 'PERIGO'>('AGUARDANDO');

  // Chart Settings
  const [ind1Type, setInd1Type] = useState<'sma' | 'ema'>('sma');
  const [ind1Period, setInd1Period] = useState(7);
  const [ind2Type, setInd2Type] = useState<'sma' | 'ema'>('ema');
  const [ind2Period, setInd2Period] = useState(21);
  const [ind3Type, setInd3Type] = useState<'sma' | 'ema'>('sma');
  const [ind3Period, setInd3Period] = useState(50);
  const [crossCondition, setCrossCondition] = useState<'SHORT_OVER_LONG' | 'SHORT_UNDER_LONG'>('SHORT_OVER_LONG');

  // Radar Settings
  const [casasLimit, setCasasLimit] = useState(14);
  const [periodHours, setPeriodHours] = useState(24);
  const [confMinOcorrencias, setConfMinOcorrencias] = useState(5);
  const [confMinWinRate, setConfMinWinRate] = useState(90);
  const [confMaxWinRate, setConfMaxWinRate] = useState(100);
  const [confMinSa, setConfMinSa] = useState(0);

  const [confluences, setConfluences] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Scoreboard
  const [sessionWins, setSessionWins] = useState(0);
  const [sessionLosses, setSessionLosses] = useState(0);
  const [sessionPnl, setSessionPnl] = useState(0);
  const [initialStake, setInitialStake] = useState(1.0);
  const [activeSessionPatterns, setActiveSessionPatterns] = useState<Record<string, { id: string, step: number, target: string, currentValue: number, totalInvested: number, limit: number }>>({});

  // Chart Refs
  const cRef = useRef<HTMLDivElement>(null);
  const chart = useRef<any>(null);
  const candleSeries = useRef<any>(null);
  const ind1Series = useRef<any>(null);
  const ind2Series = useRef<any>(null);
  const ind3Series = useRef<any>(null);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/results/period?hours=2`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        setData(json.data.map((r: any) => ({ ...r, color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(), roll: r.roll?.toString() })));
      }
    } catch (err) {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const unsub = subscribe((mappedRoll) => {
      setData((prevData: any) => {
        if (prevData.some((r: any) => r.id === mappedRoll.id)) return prevData;
        const next = [...prevData, mappedRoll as any];
        if (next.length > 5000) return next.slice(-5000);
        return next;
      });
    });
    return unsub;
  }, [subscribe]);

  // Init Chart
  useEffect(() => {
    if (!cRef.current || !showChart) return;
    const c = createChart(cRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#050507" }, textColor: "#6b7280", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,0.02)" }, horzLines: { color: "rgba(255,255,255,0.02)" } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderColor: "rgba(255,255,255,0.05)", timeVisible: true },
    });
    chart.current = c;
    candleSeries.current = c.addSeries(CandlestickSeries, { upColor: "#e51e3e", downColor: "rgba(200,200,220,0.8)", borderVisible: false });
    ind1Series.current = c.addSeries(LineSeries, { color: "#facc15", lineWidth: 2, crosshairMarkerVisible: false });
    ind2Series.current = c.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2, crosshairMarkerVisible: false });
    ind3Series.current = c.addSeries(LineSeries, { color: "#a855f7", lineWidth: 2, crosshairMarkerVisible: false });
    
    const ro = new ResizeObserver(() => { if (cRef.current && chart.current) chart.current.applyOptions({ width: cRef.current.clientWidth, height: cRef.current.clientHeight }); });
    ro.observe(cRef.current);
    
    return () => { ro.disconnect(); try { c.remove(); } catch(e){} chart.current = null; candleSeries.current = null; ind1Series.current = null; ind2Series.current = null; ind3Series.current = null; };
  }, [showChart]);

  // Sync Chart & Market Status
  useEffect(() => {
    if (!data.length) return;
    
    const built = buildTick(data);
    const accs = built.map((b: any) => b.acc), times = built.map((b: any) => b.time);
    
    const v1 = ind1Type === 'sma' ? calcSMA(accs, ind1Period) : calcEMA(accs, ind1Period);
    const v2 = ind2Type === 'sma' ? calcSMA(accs, ind2Period) : calcEMA(accs, ind2Period);
    const v3 = ind3Type === 'sma' ? calcSMA(accs, ind3Period) : calcEMA(accs, ind3Period);

    if (chart.current && showChart) {
      candleSeries.current?.setData(built.map((b: any) => b.candle));
      ind1Series.current?.setData(times.map((t: any, i: any) => v1[i] !== null ? { time: t, value: v1[i] } : null).filter(Boolean));
      if (numAverages >= 2) ind2Series.current?.setData(times.map((t: any, i: any) => v2[i] !== null ? { time: t, value: v2[i] } : null).filter(Boolean));
      else ind2Series.current?.setData([]);
      if (numAverages >= 3) ind3Series.current?.setData(times.map((t: any, i: any) => v3[i] !== null ? { time: t, value: v3[i] } : null).filter(Boolean));
      else ind3Series.current?.setData([]);
    }

    if (useGraph && v1.length > 1 && v2.length > 1) {
      const f = v1[v1.length - 1]!, s = v2[v2.length - 1]!, l = v3[v3.length - 1]!;
      let pagando = false;
      if (numAverages === 1) pagando = crossCondition === 'SHORT_OVER_LONG' ? accs[accs.length-1] > f : accs[accs.length-1] < f;
      else if (numAverages === 2) pagando = crossCondition === 'SHORT_OVER_LONG' ? f > s : f < s;
      else if (numAverages === 3) pagando = crossCondition === 'SHORT_OVER_LONG' ? f > s && s > l : f < s && s < l;
      
      let retendo = false;
      if (numAverages === 1) retendo = crossCondition === 'SHORT_OVER_LONG' ? accs[accs.length-1] < f : accs[accs.length-1] > f;
      else if (numAverages === 2) retendo = crossCondition === 'SHORT_OVER_LONG' ? f < s : f > s;
      else if (numAverages === 3) retendo = crossCondition === 'SHORT_OVER_LONG' ? f < s && s < l : f > s && s > l;

      if (pagando) setMarketStatus('PAGANDO');
      else if (retendo) setMarketStatus('RETENDO');
      else setMarketStatus('NEUTRO');
    } else {
      setMarketStatus('NEUTRO');
    }
  }, [data, numAverages, showChart, useGraph, ind1Type, ind1Period, ind2Type, ind2Period, ind3Type, ind3Period, crossCondition]);

  // DualSlider Component (Helper)
  const DualSlider = ({ range, setRange }: { range: [number, number], setRange: (val: [number, number]) => void }) => {
    const min = 1, max = 30;
    const [local, setLocal] = useState(range);
    useEffect(() => { setLocal(range); }, [range]);

    const getPercent = (value: number) => Math.round(((value - min) / (max - min)) * 100);
    const handleCommit = () => setRange(local);

    return (
      <div className="flex flex-col gap-2 mt-2 mb-2 w-full">
        <label className="text-[10px] text-blue-500 uppercase font-black tracking-widest flex items-center justify-between">
          <span className="flex items-center gap-1"><Target size={12} /> Faixa de Entradas</span>
          <span className="text-white">{local[0]} ATÉ {local[1]}</span>
        </label>
        
        <div className="relative w-full h-8 flex items-center pt-2">
          <div className="absolute w-full h-1.5 bg-[#12141c] rounded-md border border-white/5 z-0" />
          <div className="absolute h-1.5 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-md z-10 shadow-[0_0_10px_rgba(59,130,246,0.5)] pointer-events-none" 
               style={{ left: `${getPercent(local[0])}%`, width: `${getPercent(local[1]) - getPercent(local[0])}%` }} />
          
          <input 
            type="range" min={min} max={max} value={local[0]} 
            onChange={(e) => setLocal([Math.min(Number(e.target.value), local[1]), local[1]])} 
            onMouseUp={handleCommit} onTouchEnd={handleCommit}
            className="absolute w-full h-1 appearance-none bg-transparent" 
            style={{ WebkitAppearance: 'none', zIndex: local[0] > max - 2 ? 50 : 30 }} 
          />
          
          <input 
            type="range" min={min} max={max} value={local[1]} 
            onChange={(e) => setLocal([local[0], Math.max(Number(e.target.value), local[0])])} 
            onMouseUp={handleCommit} onTouchEnd={handleCommit}
            className="absolute w-full h-1 appearance-none bg-transparent z-40" 
            style={{ WebkitAppearance: 'none' }} 
          />
          
          <style dangerouslySetInnerHTML={{__html: `
            input[type=range]::-webkit-slider-thumb {
              pointer-events: all; width: 16px; height: 16px; -webkit-appearance: none;
              border-radius: 50%; background: #0f172a; border: 3px solid #38bdf8;
              cursor: pointer; box-shadow: 0 0 10px rgba(56,189,248,0.5); transition: transform 0.1s;
            }
            input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.2); }
          `}} />
        </div>
        
        <div className="flex justify-between text-[9px] text-gray-500 font-bold px-1 mt-1">
          <span>1 Entr</span>
          <span>{max} Entr</span>
        </div>
      </div>
    );
  };

  // Radar Logic Driven by Confluence Filters
  useEffect(() => {
     if (!showRadar || data.length < 50 || confluenceFilters.length === 0) return;
     const timeout = setTimeout(() => {
        setIsProcessing(true);
        let allApproved: any[] = [];
        
        confluenceFilters.forEach(filter => {
           const maxPeriod = Math.max(filter.periodHours || 24, 1);
           const history = data.slice(-maxPeriod * 120);
           const last10 = history.slice(-10);
           
           const discovered: any[] = [];
           for (let len = 3; len <= 6; len++) {
              const slice = last10.slice(-len);
              discovered.push({ filterId: filter.id, type: 'color', valArray: slice.map(r => {
                const n = parseInt(r.roll as string);
                if (r.color.includes('Vermelho') || (n >= 1 && n <= 7)) return 'V';
                if (r.color.includes('Preto') || (n >= 8 && n <= 14)) return 'P';
                return 'B';
              }) });
           }
           
           const stats = discovered.map(trigger => {
              let win = 0, loss = 0, maxL = 0, curL = 0;
              let active: any[] = [];
              const maxEntr = filter.casasLimit;
              for (let i = 0; i < history.length - 1; i++) {
                 const hR = history[i]; const isW = hR.color.includes('Branco') || hR.roll === '0';
                 if (active.length > 0) {
                    if (isW) { win++; active = []; curL = 0; }
                    else {
                       for (let t = active.length - 1; t >= 0; t--) {
                          active[t].entriesLeft--;
                          if (active[t].entriesLeft === 0) { loss++; curL++; if(curL > maxL) maxL=curL; active.splice(t, 1); }
                       }
                    }
                 }
                 if (i >= trigger.valArray.length - 1) {
                    let m = true;
                    for (let p = 0; p < trigger.valArray.length; p++) {
                       const r = history[i - (trigger.valArray.length - 1) + p]; if (!r) { m = false; break; }
                       const rN = parseInt(r.roll as string); const valP = trigger.valArray[p];
                       let rC = 'B'; if (r.color.includes('Vermelho') || (rN >= 1 && rN <= 7)) rC = 'V';
                       if (r.color.includes('Preto') || (rN >= 8 && rN <= 14)) rC = 'P';
                       if (rC !== valP) { m = false; break; }
                    }
                    if (m) active.push({ entriesLeft: maxEntr });
                 }
              }
              const winRate = ((win / (win + loss || 1)) * 100).toFixed(1);
              return { id: trigger.valArray.join(',') + '_' + maxEntr, limit: maxEntr, win, loss, sa: curL, sm: maxL, winRate };
           });

           const approved = stats.filter(s => {
              const wr = parseFloat(s.winRate);
              return wr >= filter.minWinRate && wr <= filter.maxWinRate && s.sa >= filter.minSa && (s.win + s.loss) >= filter.minOcorrencias;
           });
           
           allApproved.push(...approved);
        });
        
        // Dedup by exact confluence and limit
        const unique = Array.from(new Map(allApproved.map(item => [item.id, item])).values());
        
        setConfluences(unique);
        setIsProcessing(false);
     }, 100);
     return () => clearTimeout(timeout);
  }, [data, showRadar, confluenceFilters]);

  // War Room Status Logic
  useEffect(() => {
    if (useGraph) {
       if (marketStatus === 'PAGANDO') setWarRoomStatus('ATIRAR');
       else if (marketStatus === 'RETENDO') setWarRoomStatus('PERIGO');
       else setWarRoomStatus('AGUARDANDO');
    } else {
       setWarRoomStatus('ATIRAR'); 
    }
  }, [marketStatus, useGraph]);

  // Scoreboard Execution Logic
  const lastScoreboardId = useRef<string | null>(null);
  useEffect(() => {
    if (data.length === 0) return;
    const lastRoll = data[data.length - 1];
    if (lastRoll.id === lastScoreboardId.current) return;
    lastScoreboardId.current = lastRoll.id ?? null;

    const newActive = { ...activeSessionPatterns };
    let newWins = 0, newLosses = 0, stonePnl = 0;
    
    Object.values(newActive).forEach(ap => {
       const isHit = ap.target === 'B' ? (lastRoll.roll === '0' || lastRoll.color.includes('Branco')) : false; // Only target Branco in this simplified logic, or we can assume it hits if Branco. Actually, let's just use Branco hits.
       const isHitColor = ap.target === 'V' ? (lastRoll.color.includes('Vermelho')) : ap.target === 'P' ? (lastRoll.color.includes('Preto')) : false;
       
       if (isHit || isHitColor || (lastRoll.roll === '0' || lastRoll.color.includes('Branco'))) {
          newWins++;
          const payout = 14; // Simplified to 14 for Branco, let's just assume we hunt Branco for confluences
          stonePnl += (ap.currentValue * payout) - ap.totalInvested;
          delete newActive[ap.id];
       } else {
          const nextStep = ap.step + 1;
          if (warRoomStatus === 'PERIGO' && useGraph) {
             newLosses++;
             stonePnl -= ap.totalInvested;
             delete newActive[ap.id];
          } else if (nextStep > ap.limit) {
             newLosses++;
             stonePnl -= ap.totalInvested;
             delete newActive[ap.id];
          } else {
             const nextVal = ap.currentValue * 1.078;
             newActive[ap.id].step = nextStep;
             newActive[ap.id].currentValue = nextVal;
             newActive[ap.id].totalInvested += nextVal;
          }
       }
    });

    if (warRoomStatus === 'ATIRAR' && confluences.length > 0) {
       confluences.forEach(c => {
          if (!newActive[c.id]) {
             newActive[c.id] = { id: c.id, step: 1, limit: c.limit, target: 'B', currentValue: initialStake, totalInvested: initialStake };
          }
       });
    }

    if (newWins > 0) setSessionWins(prev => prev + newWins);
    if (newLosses > 0) setSessionLosses(prev => prev + newLosses);
    if (stonePnl !== 0) setSessionPnl(prev => prev + stonePnl);
    setActiveSessionPatterns(newActive);
  }, [data, warRoomStatus, confluences, initialStake, useGraph]);


  return (
    <div className="min-h-screen bg-[#020202] text-white flex flex-col font-sans">
      <div className="bg-[#050507] border-b border-white/5 p-4 flex items-center justify-between shadow-2xl relative z-40">
        <h1 className="text-xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 flex items-center gap-3">
          <Target className="text-green-500" />
          WAR ROOM <span className="text-[10px] text-white/50 bg-white/5 px-2 py-1 rounded-full ml-2">SNIPER MODE</span>
        </h1>
        <div className="flex gap-4">
           <button onClick={() => setShowAnalista(!showAnalista)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all ${showAnalista ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-gray-600'}`}>
             {showAnalista ? <Eye size={14} /> : <EyeOff size={14} />} Filtros Analista
           </button>
           <button onClick={() => setShowRadar(!showRadar)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all ${showRadar ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-gray-600'}`}>
             {showRadar ? <Eye size={14} /> : <EyeOff size={14} />} Confluências
           </button>
           <button onClick={() => setShowChart(!showChart)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all ${showChart ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-gray-600'}`}>
             {showChart ? <Eye size={14} /> : <EyeOff size={14} />} Fluxo
           </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
        
        {/* Painel Central de Controle */}
        <div className={`p-8 rounded-3xl border flex flex-col items-center justify-center relative overflow-hidden transition-all duration-500 ${
          warRoomStatus === 'ATIRAR' ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_50px_rgba(34,197,94,0.1)]' :
          warRoomStatus === 'PERIGO' ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.1)]' :
          'bg-white/5 border-white/10'
        }`}>
           <div className="absolute top-4 left-4 flex gap-2">
              <label className="flex items-center gap-2 cursor-pointer bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-white/5 transition-all">
                <input type="checkbox" checked={useGraph} onChange={e => setUseGraph(e.target.checked)} className="accent-blue-500" />
                <span className="text-[10px] font-black uppercase text-gray-400">Respeitar Gráfico</span>
              </label>
              
              {useGraph && (
                <select 
                  value={numAverages} 
                  onChange={e => setNumAverages(Number(e.target.value))}
                  className="bg-black/40 text-gray-400 text-[10px] font-black uppercase outline-none cursor-pointer border border-white/5 rounded-lg px-2"
                >
                  <option value={1}>1 Média (Curta)</option>
                  <option value={2}>2 Médias (Cruzamento)</option>
                  <option value={3}>3 Médias (Triplo)</option>
                </select>
              )}
           </div>

           <div className="flex flex-col items-center gap-4 z-10">
              {warRoomStatus === 'ATIRAR' && <Target size={64} className="text-green-500 animate-pulse" />}
              {warRoomStatus === 'PERIGO' && <ShieldAlert size={64} className="text-red-500 animate-bounce" />}
              {warRoomStatus === 'AGUARDANDO' && <Activity size={64} className="text-gray-600" />}
              
              <h2 className={`text-4xl font-black uppercase tracking-tighter ${
                warRoomStatus === 'ATIRAR' ? 'text-green-500' :
                warRoomStatus === 'PERIGO' ? 'text-red-500' :
                'text-gray-500'
              }`}>
                {warRoomStatus === 'ATIRAR' ? 'JANELA ABERTA (PAGANDO)' :
                 warRoomStatus === 'PERIGO' ? 'MERCADO TÓXICO (RETENDO)' :
                 'AGUARDANDO SINAIS...'}
              </h2>
              <p className="text-sm text-gray-400 font-bold max-w-lg text-center">
                {warRoomStatus === 'ATIRAR' ? 'O gráfico e as confluências estão alinhados. As ordens serão executadas com segurança máxima.' :
                 warRoomStatus === 'PERIGO' ? 'O gráfico entrou em retenção pesada. Todas as operações automáticas foram abortadas.' :
                 'Monitorando o fluxo do cassino e aguardando alinhamento de confluências para atirar.'}
              </p>
           </div>
        </div>

        {/* Módulos Ocultáveis */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
           <AnimatePresence mode="popLayout">
             {showRadar && (
               <motion.div key="radar-module" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-[#050507] border border-white/5 rounded-2xl p-6 min-h-[400px]">
                 <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Zap className="text-purple-500" />
                      <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Radares de Confluência</h3>
                    </div>
                    <button onClick={addConfluenceFilter} className="bg-white/5 hover:bg-white/10 text-yellow-500 p-2 rounded transition-colors flex items-center gap-1 text-[10px] font-black uppercase"><Plus size={14}/> Add Radar</button>
                 </div>

                 {/* Lista de Filtros de Radar */}
                 <div className="flex flex-col gap-3 mb-6">
                   {confluenceFilters.map(f => (
                      <div key={f.id} className="bg-black/40 border border-white/5 rounded-xl p-4 shadow-inner">
                         <div className="flex items-center justify-between">
                            <input value={f.name} onChange={e => updateConfluenceFilter(f.id, 'name', e.target.value)} className="bg-transparent text-white font-black uppercase tracking-widest text-[12px] outline-none w-2/3" />
                            <div className="flex items-center gap-2">
                               <button onClick={() => updateConfluenceFilter(f.id, 'isExpanded', !f.isExpanded)} className="text-gray-400 hover:text-white transition-colors">{f.isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>
                               <button onClick={() => removeConfluenceFilter(f.id)} className="text-red-500/50 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                            </div>
                         </div>
                         {f.isExpanded && (
                           <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                              <div className="flex flex-col gap-1">
                                 <label className="text-[10px] font-black uppercase text-gray-400">Gales Limit</label>
                                 <input type="number" min="1" value={f.casasLimit} onChange={e => updateConfluenceFilter(f.id, 'casasLimit', Number(e.target.value))} className="bg-[#12141c] text-white text-[13px] font-bold p-3 rounded-lg border border-white/5 outline-none focus:border-white/10" />
                              </div>
                              <div className="flex flex-col gap-1">
                                 <label className="text-[10px] font-black uppercase text-gray-400">Período (Horas)</label>
                                 <div className="relative">
                                   <select value={f.periodHours} onChange={e => updateConfluenceFilter(f.id, 'periodHours', Number(e.target.value))} className="w-full bg-[#12141c] text-white text-[13px] font-bold p-3 rounded-lg border border-white/5 appearance-none outline-none">
                                     <option value={24}>24 Horas</option>
                                     <option value={48}>48 Horas</option>
                                     <option value={72}>72 Horas</option>
                                   </select>
                                   <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-500 pointer-events-none" />
                                 </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                 <label className="text-[10px] font-black uppercase text-gray-400">Min Ocorrencias</label>
                                 <input type="number" min="1" value={f.minOcorrencias} onChange={e => updateConfluenceFilter(f.id, 'minOcorrencias', Number(e.target.value))} className="bg-[#12141c] text-white text-[13px] font-bold p-3 rounded-lg border border-white/5 outline-none focus:border-white/10" />
                              </div>
                              <div className="flex flex-col gap-1">
                                 <label className="text-[10px] font-black uppercase text-gray-400">Win Rate (%)</label>
                                 <div className="flex items-center gap-1">
                                   <input type="number" min="0" value={f.minWinRate} onChange={e => updateConfluenceFilter(f.id, 'minWinRate', Number(e.target.value))} className="w-full bg-[#12141c] text-white text-[13px] font-bold p-3 rounded-lg border border-white/5 outline-none text-center" />
                                   <span className="text-gray-500 font-bold">-</span>
                                   <input type="number" max="100" value={f.maxWinRate} onChange={e => updateConfluenceFilter(f.id, 'maxWinRate', Number(e.target.value))} className="w-full bg-[#12141c] text-white text-[13px] font-bold p-3 rounded-lg border border-white/5 outline-none text-center" />
                                 </div>
                              </div>
                              <div className="flex flex-col gap-1 col-span-2">
                                 <label className="text-[10px] font-black uppercase text-purple-400">SA Mín (Filtro)</label>
                                 <input type="number" min="0" value={f.minSa} onChange={e => updateConfluenceFilter(f.id, 'minSa', Number(e.target.value))} className="bg-[#12141c] text-white text-[13px] font-bold p-3 rounded-lg border border-purple-500/30 outline-none focus:border-purple-500/50" />
                              </div>
                           </div>
                         )}
                      </div>
                   ))}
                 </div>

                 <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">Resultado do Cruzamento</span>
                 </div>
                    {isProcessing ? (
                    <div className="flex justify-center items-center h-[200px]"><Activity className="animate-spin text-purple-500" /></div>
                 ) : (
                    <div className="flex flex-col items-center justify-center h-[200px]">
                       <Target size={48} className={confluences.length > 0 ? "text-green-500 mb-4" : "text-gray-600 mb-4"} />
                       <h2 className={`text-6xl font-black tracking-tighter ${confluences.length > 0 ? 'text-white' : 'text-gray-600'}`}>{confluences.length}</h2>
                       <p className="text-xs text-gray-500 font-bold uppercase text-center mt-2">
                         Confluências Aprovadas no Radar
                       </p>
                    </div>
                 )}
               </motion.div>
             )}

             {showChart && (
               <motion.div key="chart-module" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-[#050507] border border-white/5 rounded-2xl p-6 min-h-[400px] flex flex-col">
                 <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-3">
                     <BarChart2 className="text-blue-500" />
                     <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Monitor de Fluxo Gráfico</h3>
                   </div>
                   <div className="flex gap-2">
                      <span className="text-[10px] text-yellow-500 font-black uppercase bg-black/50 border border-yellow-500/50 px-2 py-1 rounded shadow-md">{ind1Type} {ind1Period}</span>
                      {numAverages >= 2 && <span className="text-[10px] text-blue-500 font-black uppercase bg-black/50 border border-blue-500/50 px-2 py-1 rounded shadow-md">{ind2Type} {ind2Period}</span>}
                      {numAverages >= 3 && <span className="text-[10px] text-purple-500 font-black uppercase bg-black/50 border border-purple-500/50 px-2 py-1 rounded shadow-md">{ind3Type} {ind3Period}</span>}
                   </div>
                 </div>
                 
                 <div className="flex flex-wrap items-center gap-2 mb-4 bg-black/40 p-2 rounded-lg border border-white/5 w-fit">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
                      <select value={ind1Type} onChange={e => setInd1Type(e.target.value as 'sma'|'ema')} className="bg-[#12141c] border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded px-1 py-1 outline-none"><option value="sma">SMA</option><option value="ema">EMA</option></select>
                      <input type="number" min="2" value={ind1Period} onChange={e => setInd1Period(Number(e.target.value))} className="w-12 bg-[#12141c] border border-white/10 text-white text-[10px] font-black rounded px-1 py-1 outline-none text-center" />
                    </div>
                    {numAverages >= 2 && (
                      <>
                        <span className="text-white/10">|</span>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div>
                          <select value={ind2Type} onChange={e => setInd2Type(e.target.value as 'sma'|'ema')} className="bg-[#12141c] border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded px-1 py-1 outline-none"><option value="sma">SMA</option><option value="ema">EMA</option></select>
                          <input type="number" min="2" value={ind2Period} onChange={e => setInd2Period(Number(e.target.value))} className="w-12 bg-[#12141c] border border-white/10 text-white text-[10px] font-black rounded px-1 py-1 outline-none text-center" />
                        </div>
                      </>
                    )}
                    {numAverages >= 3 && (
                      <>
                        <span className="text-white/10">|</span>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-purple-500 mr-1"></div>
                          <select value={ind3Type} onChange={e => setInd3Type(e.target.value as 'sma'|'ema')} className="bg-[#12141c] border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded px-1 py-1 outline-none"><option value="sma">SMA</option><option value="ema">EMA</option></select>
                          <input type="number" min="2" value={ind3Period} onChange={e => setInd3Period(Number(e.target.value))} className="w-12 bg-[#12141c] border border-white/10 text-white text-[10px] font-black rounded px-1 py-1 outline-none text-center" />
                        </div>
                      </>
                    )}
                    
                    <span className="text-white/10 ml-2">|</span>
                    <select value={crossCondition} onChange={e => setCrossCondition(e.target.value as any)} className="bg-[#12141c] text-white text-[10px] uppercase font-black px-2 py-1 rounded border border-white/10 ml-2 outline-none">
                       <option value="SHORT_OVER_LONG">PAGANDO = Curta {">"} Longa</option>
                       <option value="SHORT_UNDER_LONG">PAGANDO = Curta {"<"} Longa</option>
                    </select>
                 </div>

                 <div ref={cRef} className="flex-1 w-full min-h-[300px]" />
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* Placar Financeiro (Scoreboard) */}
        <div className="flex items-center gap-6 bg-black/40 px-6 py-4 rounded-2xl border border-white/5 relative z-10 shadow-inner mt-4">
           <div className="flex flex-col items-center">
             <span className="text-[9px] text-gray-500 font-black uppercase mb-1 flex items-center gap-1">WINS (SNIPER) <Target size={10} className="text-green-500" /></span>
             <span className="text-xl font-black text-green-400">{sessionWins}</span>
           </div>
           <div className="h-8 w-px bg-white/10"></div>
           <div className="flex flex-col items-center">
             <span className="text-[9px] text-gray-500 font-black uppercase mb-1">LOSS (SNIPER)</span>
             <span className="text-xl font-black text-red-500">{sessionLosses}</span>
           </div>
           <div className="h-8 w-px bg-white/10"></div>
           <div className="flex flex-col items-center min-w-[80px]">
             <span className="text-[9px] text-gray-500 font-black uppercase mb-1">PNL TOTAL</span>
             <span className={`text-2xl font-black ${sessionPnl >= 0 ? 'text-green-400' : 'text-red-500'}`}>
               {sessionPnl >= 0 ? '+' : '-'}R$ {Math.abs(sessionPnl).toFixed(2)}
             </span>
           </div>
           <div className="flex flex-col items-center ml-auto border-l border-white/10 pl-4">
             <span className="text-[9px] text-gray-500 font-black uppercase mb-1">STAKE INICIAL</span>
             <input type="number" min="1" step="1" value={initialStake} onChange={e => setInitialStake(Number(e.target.value))} className="w-16 bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-blue-500" />
           </div>
           <div className="flex flex-col items-center border-l border-white/10 pl-4">
             <span className="text-[9px] text-gray-500 font-black uppercase mb-1">RESET</span>
             <button onClick={() => { setSessionWins(0); setSessionLosses(0); setSessionPnl(0); }} className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-xs font-bold text-gray-400 transition-all">Zerar</button>
           </div>
        </div>
        </div>

        {/* Analista Sidebar */}
        {showAnalista && (
          <div className="w-[350px] border-l border-white/5 bg-[#050507] flex flex-col shrink-0 shadow-2xl relative z-30">
             <div className="p-4 border-b border-white/5 flex items-center justify-between">
               <div className="flex items-center gap-2 text-blue-500">
                 <BrainCircuit size={14} />
                 <span className="text-[11px] font-black uppercase tracking-widest text-white">FILTROS IA (ROBÔS)</span>
               </div>
               <button onClick={addAnalistaFilter} className="bg-white/5 hover:bg-white/10 text-yellow-500 p-1.5 rounded transition-colors"><Plus size={14}/></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
               {analistaFilters.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-50 mt-10">
                     <BrainCircuit size={48} className="text-gray-600 mb-4" />
                     <p className="text-[10px] text-gray-500 text-center uppercase font-bold mt-2">Nenhum robô analista ativo.<br/>Adicione um para cruzar com o fluxo.</p>
                  </div>
               ) : (
                  analistaFilters.map((f) => (
                    <div key={f.id} className="bg-black/40 border border-white/5 rounded-xl p-3 relative shadow-inner">
                       <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                          <input value={f.name} onChange={e => updateAnalistaFilter(f.id, 'name', e.target.value)} className="bg-transparent text-white font-black uppercase tracking-widest text-[10px] outline-none w-2/3" />
                          <div className="flex items-center gap-1">
                             <button onClick={() => updateAnalistaFilter(f.id, 'isExpanded', !f.isExpanded)} className="text-gray-400 hover:text-white transition-colors">{f.isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</button>
                             <button onClick={() => removeAnalistaFilter(f.id)} className="text-red-500/50 hover:text-red-500 transition-colors ml-1"><Trash2 size={12} /></button>
                          </div>
                       </div>
                       
                       {f.isExpanded ? (
                         <div className="flex flex-col gap-4 mt-4 border-t border-white/5 pt-4">
                           {/* Padrão */}
                           <div className="flex flex-col gap-1">
                              <label className="text-xs font-black uppercase text-gray-500">Padrão</label>
                              <div className="relative">
                                 <select value={f.patternType} onChange={e => updateAnalistaFilter(f.id, 'patternType', e.target.value)} className="w-full bg-[#0a0a0c] text-white text-[13px] font-bold p-3 rounded-lg border border-white/5 appearance-none outline-none">
                                   <option value="mixed">🌟 Todos (Misturado)</option>
                                   <option value="color">🎨 Somente Cores</option>
                                   <option value="number">🔢 Somente Números</option>
                                 </select>
                                 <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-500 pointer-events-none" />
                              </div>
                           </div>

                           {/* Tamanho */}
                           <div className="flex flex-col gap-1">
                              <label className="text-xs font-black uppercase text-gray-500">Tamanho do Padrão</label>
                              <div className="relative">
                                 <select value={f.size} onChange={e => updateAnalistaFilter(f.id, 'size', Number(e.target.value))} className="w-full bg-[#0a0a0c] text-white text-[13px] font-bold p-3 rounded-lg border border-white/5 appearance-none outline-none">
                                   <option value={0}>🔍 Selecionar Todos</option>
                                   <option value={2}>2 Pedras</option>
                                   <option value={3}>3 Pedras</option>
                                   <option value={4}>4 Pedras</option>
                                   <option value={5}>5 Pedras</option>
                                   <option value={6}>6 Pedras</option>
                                 </select>
                                 <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-500 pointer-events-none" />
                              </div>
                           </div>
                           
                           {/* Histórico */}
                           <div className="flex flex-col gap-1">
                              <label className="text-xs font-black uppercase text-gray-500">Histórico</label>
                              <div className="relative">
                                 <select value={f.periodHours} onChange={e => updateAnalistaFilter(f.id, 'periodHours', Number(e.target.value))} className="w-full bg-[#0a0a0c] text-white text-[13px] font-bold p-3 rounded-lg border border-white/5 appearance-none outline-none">
                                   <option value={24}>24 Horas</option>
                                   <option value={48}>48 Horas</option>
                                   <option value={72}>72 Horas</option>
                                 </select>
                                 <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-500 pointer-events-none" />
                              </div>
                           </div>

                           {/* Modo de Loss */}
                           <div className="flex flex-col gap-2 mt-2">
                              <label className="text-xs font-black uppercase text-gray-500">Modo de Loss</label>
                              <div className="flex items-center bg-[#12141c] p-1 rounded-lg border border-white/5 w-full">
                                 <button onClick={() => updateAnalistaFilter(f.id, 'lossMode', 'CICLO')} className={`flex-1 text-[11px] font-black uppercase py-2.5 rounded-md transition-all ${f.lossMode === 'CICLO' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}>Por Ciclo</button>
                                 <button onClick={() => updateAnalistaFilter(f.id, 'lossMode', 'ENTRADA')} className={`flex-1 text-[11px] font-black uppercase py-2.5 rounded-md transition-all ${f.lossMode === 'ENTRADA' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}>Por Entrada</button>
                              </div>
                           </div>

                           {/* Faixa de Entradas Dual Slider */}
                           <DualSlider range={f.casasLimit} setRange={(val) => updateAnalistaFilter(f.id, 'casasLimit', val)} />

                           {/* Foco Alvo */}
                           <div className="flex flex-col gap-1">
                              <label className="text-xs font-black uppercase text-gray-500">Foco Alvo</label>
                              <div className="relative">
                                 <select value={f.targetFocus} onChange={e => updateAnalistaFilter(f.id, 'targetFocus', e.target.value)} className="w-full bg-[#0a0a0c] text-white text-[13px] font-bold p-3 rounded-lg border border-white/5 appearance-none outline-none">
                                   <option value="B">⚪ BRANCO</option>
                                   <option value="V">🔴 VERMELHO</option>
                                   <option value="P">⚫ PRETO</option>
                                   <option value="ALL">🌟 AMBOS</option>
                                 </select>
                                 <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-500 pointer-events-none" />
                              </div>
                           </div>
                           
                           {/* Grade de 4 Filtros */}
                           <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                             <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-gray-400">Min Sinais</label>
                                <input type="number" min="1" value={f.minOcorrencias} onChange={e => updateAnalistaFilter(f.id, 'minOcorrencias', Number(e.target.value))} className="bg-[#12141c] text-white text-[13px] font-bold p-3 rounded-lg border border-white/5 outline-none focus:border-white/10" />
                             </div>
                             <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-gray-400">Tx Mín (%)</label>
                                <input type="number" min="0" max="100" value={f.minWinRate} onChange={e => updateAnalistaFilter(f.id, 'minWinRate', Number(e.target.value))} className="bg-[#12141c] text-white text-[13px] font-bold p-3 rounded-lg border border-white/5 outline-none focus:border-white/10" />
                             </div>
                             <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-gray-400">Max Loss</label>
                                <input type="number" min="0" value={f.maxSa} onChange={e => updateAnalistaFilter(f.id, 'maxSa', Number(e.target.value))} className="bg-[#12141c] text-white text-[13px] font-bold p-3 rounded-lg border border-white/5 outline-none focus:border-white/10" />
                             </div>
                             <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-purple-400">SA Mín</label>
                                <input type="number" min="0" value={f.minSaFilter} onChange={e => updateAnalistaFilter(f.id, 'minSaFilter', Number(e.target.value))} className="bg-[#12141c] text-white text-[13px] font-bold p-3 rounded-lg border border-purple-500/50 outline-none focus:border-purple-500/80" />
                             </div>
                           </div>

                           <button onClick={() => updateAnalistaFilter(f.id, 'isExpanded', false)} className="mt-6 bg-orange-600/90 text-white font-black text-[12px] uppercase tracking-widest py-3 rounded-lg hover:bg-orange-500 transition-colors flex items-center justify-center gap-2">
                             <Zap size={16} /> PROCESSAR DADOS
                           </button>
                         </div>
                       ) : (
                         <div className="flex items-center justify-between opacity-70">
                            <span className="text-xs text-gray-400 font-bold uppercase">{f.patternType === 'mixed' ? 'Misto' : f.patternType === 'color' ? 'Cores' : 'Nº'} - {f.casasLimit[1]} Casas</span>
                            <span className="text-xs text-green-500 font-black tracking-tighter">{f.minWinRate}% WR</span>
                         </div>
                       )}
                    </div>
                  ))
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
