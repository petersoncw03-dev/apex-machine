"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, Bell, Volume2, VolumeX, Search, Zap, X, ChevronRight, List } from "lucide-react";
import Link from "next/link";
import { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries } from "lightweight-charts";
import { Save, FolderOpen, Trash2, Check, Plus, RotateCcw } from 'lucide-react';


// Types
interface Roll {
  id: string;
  color: string;
  roll: string;
}

interface PatternElement {
  t: 'c' | 'n'; // color or number
  v: string;
}

interface DiscoveredPattern {
  id: string;
  type: string;
  elements: PatternElement[];
  winRate: string;
  count: number;
  triggers: number;
  sa: number;
  sm: number;
  activeNow: boolean;
  target: string;
  currentStep?: number;
  entries?: number;
  lossMode?: string;
}

interface TrendResult {
  bestPatternSize: number;
  bestEntries: number;
  winRate: string;
  wins: number;
  losses: number;
  target?: string;
  patternCount?: number;
}


const DualSlider = ({ range, setRange }: { range: [number, number], setRange: (val: [number, number]) => void }) => {
    const min = 1, max = 15;
    const getPercent = (value: number) => Math.round(((value - min) / (max - min)) * 100);

    return (
      <div className="flex flex-col gap-2 mt-2 border-t border-white/5 pt-4 mb-2">
        <label className="text-[10px] text-blue-400 uppercase font-black tracking-widest flex items-center justify-between">
          <span>🎯 Faixa de Entradas</span>
          <span className="text-white">{range[0]} até {range[1]}</span>
        </label>
        
        <div className="relative w-full h-8 flex items-center pt-2">
          <div className="absolute w-full h-1.5 bg-[#12141c] rounded-md border border-white/5 z-0" />
          <div className="absolute h-1.5 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-md z-10 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
               style={{ left: `${getPercent(range[0])}%`, width: `${getPercent(range[1]) - getPercent(range[0])}%` }} />
          
          <input 
            type="range" min={min} max={max} value={range[0]} 
            onChange={(e) => setRange([Math.min(Number(e.target.value), range[1]), range[1]])} 
            className="absolute w-full h-1 appearance-none bg-transparent" 
            style={{ WebkitAppearance: 'none', pointerEvents: 'none', zIndex: range[0] > max - 2 ? 50 : 30 }} 
          />
          
          <input 
            type="range" min={min} max={max} value={range[1]} 
            onChange={(e) => setRange([range[0], Math.max(Number(e.target.value), range[0])])} 
            className="absolute w-full h-1 appearance-none bg-transparent z-40" 
            style={{ WebkitAppearance: 'none', pointerEvents: 'none' }} 
          />
          
          <style dangerouslySetInnerHTML={{__html: `
            input[type=range]::-webkit-slider-thumb {
              pointer-events: all; width: 18px; height: 18px; -webkit-appearance: none;
              border-radius: 50%; background: #0f172a; border: 3px solid #38bdf8;
              cursor: pointer; box-shadow: 0 0 10px rgba(56,189,248,0.5); transition: transform 0.1s;
            }
            input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.2); }
          `}} />
        </div>
        
        <div className="flex justify-between text-[9px] text-gray-500 font-bold px-1 mt-1">
          <span>1 Entr</span>
          <span>15 Entr</span>
        </div>
      </div>
    );
};


const CMAP: Record<string,string> = {BRANCO:"#ffffff",VERMELHO:"#e51e3e",PRETO:"#555566"};
const TFS = [
  {k:"tick",l:"Tick",m:0},
  {k:"2m",l:"2m",m:2},
  {k:"3m",l:"3m",m:3},
  {k:"5m",l:"5m",m:5},
  {k:"10m",l:"10m",m:10},
  {k:"15m",l:"15m",m:15}
];
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
function buildAgg(data: any[], minutes: number) {
  let acc=0; const bMap=new Map<number,{open:number,high:number,low:number,close:number}>();
  const bOrder: number[]=[];
  data.forEach(r=>{ 
    const ms=new Date(r.timestamp || new Date()).getTime(); 
    const bs=Math.floor(ms/(minutes*60000))*(minutes*60); 
    acc=parseFloat((acc+parseFloat(r.house_profit||"0")).toFixed(2)); 
    if(!bMap.has(bs)){bMap.set(bs,{open:acc-(parseFloat(r.house_profit||"0")),high:acc,low:acc,close:acc});bOrder.push(bs);}
    else{const b=bMap.get(bs)!;b.close=acc;b.high=Math.max(b.high,acc);b.low=Math.min(b.low,acc);} 
  });
  return bOrder.map(bs=>{ 
    const b=bMap.get(bs)!; const up=b.close>=b.open; 
    const c=up?"#e51e3e":"rgba(200,200,220,0.8)"; 
    return {candle:{time:bs as number,open:b.open,high:b.high,low:b.low,close:b.close,color:c,wickColor:c,borderColor:c},acc:b.close,time:bs}; 
  });
}

export default function AnalistaGrafico2Page() {
  const [data, setData] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data]);
  
  // Discovery Filters
  const [lossMode, setLossMode] = useState<'CICLO' | 'ENTRADA'>('CICLO');
  const [entriesRange, setEntriesRange] = useState<[number, number]>([1, 5]);
  const [periodHours, setPeriodHours] = useState(24);
  const [patternType, setPatternType] = useState('COLORS_1_NUM'); 
    const [targetFocus, setTargetFocus] = useState('Branco'); 
  
  const [minTriggers, setMinTriggers] = useState(5);
  const [minWinRate, setMinWinRate] = useState(90);
  const [maxSa, setMaxSa] = useState(2);
  const [minSaFilter, setMinSaFilter] = useState(0);
  const [selectedSize, setSelectedSize] = useState(0); // 0 = Todos
  
  // Live Monitor
  const [liveMode, setLiveMode] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [refreshMinutes, setRefreshMinutes] = useState(5);
  const [timeLeft, setTimeLeft] = useState(0);
  const [alertThreshold, setAlertThreshold] = useState(1);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const [tf, setTf] = useState("tick");
  const [marketStatus, setMarketStatus] = useState<'PAGANDO' | 'RETENDO' | 'NEUTRO'>('NEUTRO');
  const [ind1Type, setInd1Type] = useState<'sma' | 'ema'>('sma');
  const [ind1Period, setInd1Period] = useState(7);
  const [ind2Type, setInd2Type] = useState<'sma' | 'ema'>('ema');
  const [ind2Period, setInd2Period] = useState(21);
  const [sessionWins, setSessionWins] = useState(0);
  const [sessionLosses, setSessionLosses] = useState(0);

  const [activeSessionPatterns, setActiveSessionPatterns] = useState<Record<string, { id: string, step: number, target: string, elements: any[], entries?: number }>>({});
  
  const lastScoreboardId = useRef<string | null>(null);
  useEffect(() => {
    if (!liveMode || data.length === 0 || !appliedFilters) return;
    const lastRoll = data[data.length - 1];
    if (lastRoll.id === lastScoreboardId.current) return;
    lastScoreboardId.current = lastRoll.id;

    const newActive: typeof activeSessionPatterns = { ...activeSessionPatterns };
    
    let newWins = 0;
    let newLosses = 0;
    
    // Check currently active patterns
    Object.values(newActive).forEach(ap => {
       if (evaluateHit(lastRoll, ap.target)) {
          newWins++;
          delete newActive[ap.id]; // Won
       } else {
          const nextStep = ap.step + 1;
          const maxE = appliedFilters.lossMode === 'ENTRADA' ? (ap.entries || appliedFilters.entriesRange[1]) : appliedFilters.entriesRange[1];
          if (nextStep > maxE) {
             newLosses++;
             delete newActive[ap.id]; // Lost
          } else {
             newActive[ap.id].step = nextStep; // Continued
          }
       }
    });
    
    // Add new triggers from discovered
    if (marketStatus === 'PAGANDO') {
        discovered.forEach(d => {
            if (d.activeNow && !newActive[d.id] && d.currentStep === 1) {
                newActive[d.id] = { id: d.id, step: 1, target: d.target, elements: d.elements, entries: d.entries };
            }
        });
    }

    if (newWins > 0) setSessionWins(prev => prev + newWins);
    if (newLosses > 0) setSessionLosses(prev => prev + newLosses);
    
    setActiveSessionPatterns(newActive);
  }, [data, liveMode]);

  const cRef = useRef<HTMLDivElement>(null);
  const chart = useRef<any>(null);
  const candleSeries = useRef<any>(null);
  const ind1Series = useRef<any>(null);
  const ind2Series = useRef<any>(null);
  
  const resetSession = () => { setSessionWins(0); setSessionLosses(0); };

  
  // Presets
  interface SavedPreset { name: string; config: any; }
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  useEffect(() => {
    const loaded = localStorage.getItem('analista_presets');
    if (loaded) {
      try { setSavedPresets(JSON.parse(loaded)); } catch(e){}
    }
  }, []);

  const savePreset = () => {
    if (!newPresetName.trim()) return;
    const config = { lossMode, entriesRange, periodHours, patternType, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, selectedSize };
    const updated = [...savedPresets, { name: newPresetName, config }];
    setSavedPresets(updated);
    localStorage.setItem('analista_presets', JSON.stringify(updated));
    setNewPresetName('');
  };

  const deletePreset = (idx: number) => {
    const updated = savedPresets.filter((_, i) => i !== idx);
    setSavedPresets(updated);
    localStorage.setItem('analista_presets', JSON.stringify(updated));
  };

  const loadPreset = (config: any) => {
    if (config.lossMode) setLossMode(config.lossMode);
    if (config.entriesRange) setEntriesRange(config.entriesRange);
    if (config.periodHours) setPeriodHours(config.periodHours);
    if (config.patternType) setPatternType(config.patternType);
    
    if (config.targetFocus) setTargetFocus(config.targetFocus);
    if (config.minTriggers) setMinTriggers(config.minTriggers);
    if (config.minWinRate !== undefined) setMinWinRate(config.minWinRate);
    if (config.maxSa !== undefined) setMaxSa(config.maxSa);
    if (config.minSaFilter !== undefined) setMinSaFilter(config.minSaFilter);
    if (config.selectedSize !== undefined) setSelectedSize(config.selectedSize);
    setShowPresetsMenu(false);
  };
  
  // State
  const [discovered, setDiscovered] = useState<DiscoveredPattern[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const lastProcessedId = useRef<string | null>(null);
  const lastDiscoveryStoneId = useRef<string | null>(null);




  const [isMixedMining, setIsMixedMining] = useState(false);
  const [mixedProgress, setMixedProgress] = useState(0);
  const [mixedTotal, setMixedTotal] = useState(0);
  const [useMixedMining, setUseMixedMining] = useState(false);

  // Quick Trend State
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [trendHours, setTrendHours] = useState(2);
  const [trendTarget, setTrendTarget] = useState('Vermelho');
  const [trendMaxEntries, setTrendMaxEntries] = useState(12);
  const [isTrending, setIsTrending] = useState(false);
  const [trendResult, setTrendResult] = useState<TrendResult[] | null>(null);

  const [showExportModal, setShowExportModal] = useState(false);

  

  const getTargetEmoji = (target: string) => {
    if (target === 'Branco') return '⚪';
    if (target === 'Vermelho') return '🔴';
    return '⚫️';
  };

  const formatPatternList = () => {
    return discovered.map(pat => {
      const hasNumbers = pat.elements.some(el => el.t === 'n');
      const patternStr = pat.elements.map(el => {
        if (el.t === 'c') {
          if (el.v === 'V') return '🔴';
          if (el.v === 'P') return '⚫️';
          return '⚪';
        }
        return el.v;
      }).join(hasNumbers ? ' ' : '');

      const targetEmoji = getTargetEmoji(targetFocus);
      const galeLabel = `g${(pat.entries || entriesRange[1]) - 1}`;

      return `${patternStr} = ${targetEmoji} ${galeLabel}`;
    }).join('\n');
  };

  const playAlert = () => {
    if (!audioEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 2.0); 
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.0);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 2.0);
    } catch(e) { console.error("Erro ao tocar áudio", e); }
  };

  const fetchData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
      const res = await fetch(`/api/results/period?hours=${Math.max(periodHours, 72)}`); 
      if (!res.ok) return;
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        const mappedData = json.data.map((r: any) => ({ 
          ...r, 
          color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(), 
          roll: r.roll?.toString() 
        }));
        setData(mappedData);
      }
    } catch (err) { /* Silent catch to prevent UI crash */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const healingInterval = setInterval(fetchData, 10000);

    const eventSource = new EventSource('/api/events');
    
    eventSource.onmessage = (event) => {
      try {
        const newRoll = JSON.parse(event.data);
        const mappedRoll = {
          ...newRoll,
          color: newRoll.color?.toString().charAt(0).toUpperCase() + newRoll.color?.toString().slice(1).toLowerCase(),
          roll: newRoll.roll?.toString()
        };
        
        setData(prevData => {
          if (prevData.some(r => r.id === mappedRoll.id)) return prevData;
          return [...prevData, mappedRoll];
        });
      } catch (e) {
        console.error("Erro ao processar pedra em tempo real", e);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error("Conexão SSE caiu na IA Analista, tentando reconectar...", err);
    };

    return () => {
      clearInterval(healingInterval);
      eventSource.close();
    };
  }, []);

  const getCol = (r: Roll) => {
    if (!r) return 'B';
    const n = parseInt(r.roll);
    if (r.color.includes('Vermelho') || (n >= 1 && n <= 7)) return 'V';
    if (r.color.includes('Preto') || (n >= 8 && n <= 14)) return 'P';
    return 'B';
  };

  
  // --- Chart Setup ---
  useEffect(() => {
    if (!cRef.current) return;
    const c = createChart(cRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#0a0a0f" }, textColor: "#6b7280", fontSize: 11 },
      grid: { vertLines: { color: "rgba(255,255,255,0.02)" }, horzLines: { color: "rgba(255,255,255,0.02)" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.05)" },
      timeScale: { borderColor: "rgba(255,255,255,0.05)", timeVisible: true },
      handleScroll: true, handleScale: true
    });
    chart.current = c;
    candleSeries.current = c.addSeries(CandlestickSeries, { upColor: "#e51e3e", downColor: "rgba(200,200,220,0.8)", borderVisible: false, wickVisible: true });
    ind1Series.current = c.addSeries(LineSeries, { color: "#facc15", lineWidth: 2, crosshairMarkerVisible: false });
    ind2Series.current = c.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2, crosshairMarkerVisible: false });
    const ro = new ResizeObserver(() => { if (cRef.current && chart.current) chart.current.applyOptions({ width: cRef.current.clientWidth, height: cRef.current.clientHeight }); });
    ro.observe(cRef.current);
    return () => { ro.disconnect(); try { c.remove(); } catch(e){} chart.current = null; candleSeries.current = null; ind1Series.current = null; ind2Series.current = null; };
  }, []);

  // --- Sync Data ---
  useEffect(() => {
    if (!chart.current || !data.length) return;
    const tfObj = TFS.find(t => t.k === tf)!;
    const built = tfObj.m === 0 ? buildTick(data) : buildAgg(data, tfObj.m);
    candleSeries.current.setData(built.map((b: any) => b.candle));
    const accs = built.map((b: any) => b.acc), times = built.map((b: any) => b.time);
    const v1 = ind1Type === 'sma' ? calcSMA(accs, ind1Period) : calcEMA(accs, ind1Period);
    const v2 = ind2Type === 'sma' ? calcSMA(accs, ind2Period) : calcEMA(accs, ind2Period);
    ind1Series.current.setData(times.map((t: any, i: any) => v1[i] !== null ? { time: t, value: v1[i] } : null).filter(Boolean));
    ind2Series.current.setData(times.map((t: any, i: any) => v2[i] !== null ? { time: t, value: v2[i] } : null).filter(Boolean));
    if (v1.length > 1 && v2.length > 1) {
      const f = v1[v1.length - 1]!, s = v2[v2.length - 1]!;
      if (f !== null && s !== null) {
        if (f < s) setMarketStatus('PAGANDO'); else if (f > s) setMarketStatus('RETENDO'); else setMarketStatus('NEUTRO');
      }
    }
  }, [data, tf, ind1Type, ind1Period, ind2Type, ind2Period]);

  const evaluateHit = (rollObj: Roll, target: string) => {
    if (!rollObj) return false;
    const n = parseInt(rollObj.roll);
    const isBranco = n === 0 || rollObj.color.includes('Branco');
    const isVermelho = rollObj.color.includes('Vermelho') || (n >= 1 && n <= 7);
    const isPreto = rollObj.color.includes('Preto') || (n >= 8 && n <= 14);

    if (target === 'Branco' && isBranco) return true;
    if (target === 'Vermelho' && isVermelho) return true;
    if (target === 'Preto' && isPreto) return true;
    return false;
  };

  // Discovery Engine com Snapshot
  const [appliedFilters, setAppliedFilters] = useState<any>(null);

  const runFullDiscoveryCiclo = (config: any, currentData: Roll[], isAuto: boolean, oldActiveIds: Set<string> = new Set()) => {
    if (!currentData || currentData.length < 10) return;
    if (!isAuto) {
      setIsDiscovering(true);
      setLiveMode(false);
    }
    
    const execute = () => {
      const { periodHours, patternType, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, selectedSize } = config;
      const [minEntries, maxEntries] = entriesRange || [1, 5];
      const history = currentData.slice(-periodHours * 120);
      const patternMap: Record<string, any> = {};
      
      const typesToTest = patternType === 'TODOS' 
        ? ['ONLY_COLORS', 'ONLY_NUMBERS', 'COLORS_1_NUM', 'COLORS_2_NUM', '1_NUM_COLORS', '2_NUM_COLORS'] 
        : [patternType];

      const discoveryTargets = targetFocus === 'Ambos' ? ['Vermelho', 'Preto'] : [targetFocus];

      for (const target of discoveryTargets) {
        for (const type of typesToTest) {
          let sizes = [3];
          if (selectedSize > 0) sizes = [selectedSize];
          else {
            if (type === 'ONLY_COLORS') sizes = [2, 3, 4, 5, 6];
            if (type === 'ONLY_NUMBERS') sizes = [1, 2, 3];
            if (type === 'COLORS_1_NUM') sizes = [3, 4, 5];
            if (type === 'COLORS_2_NUM') sizes = [4, 5];
            if (type === '1_NUM_COLORS') sizes = [3, 4, 5];
            if (type === '2_NUM_COLORS') sizes = [4, 5];
          }

          for (const totalLen of sizes) {
            for (let i = 0; i <= history.length - maxEntries - totalLen; i++) {
              const elements: PatternElement[] = [];
              if (type === 'ONLY_COLORS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              } else if (type === 'ONLY_NUMBERS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'n', v: history[i+p].roll});
              } else if (type === 'COLORS_1_NUM') {
                for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(history[i+p])});
                elements.push({t:'n', v: history[i+totalLen-1].roll});
              } else if (type === 'COLORS_2_NUM') {
                for(let p=0; p<totalLen-2; p++) elements.push({t:'c', v: getCol(history[i+p])});
                elements.push({t:'n', v: history[i+totalLen-2].roll});
                elements.push({t:'n', v: history[i+totalLen-1].roll});
              } else if (type === '1_NUM_COLORS') {
                elements.push({t:'n', v: history[i].roll});
                for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              } else if (type === '2_NUM_COLORS') {
                elements.push({t:'n', v: history[i].roll});
                elements.push({t:'n', v: history[i+1].roll});
                for(let p=2; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              }

              if (elements.length === 0) continue;
              if (patternType !== 'ONLY_NUMBERS' && elements.some(e => e.t === 'n' && e.v === '0')) continue;

              const key = target + ':' + type + ':' + elements.map(e => e.t + e.v).join('|');
              if (!patternMap[key]) {
                  patternMap[key] = { elements, type, target, entriesData: {} };
                  for (let e = minEntries; e <= maxEntries; e++) {
                      patternMap[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, maxSa: 0 };
                  }
              }
              
              for (let e = minEntries; e <= maxEntries; e++) {
                  patternMap[key].entriesData[e].triggers++;
                  
                  let hit = false;
                  for (let w = 1; w <= e; w++) {
                    const nxt = history[i + totalLen - 1 + w];
                    if (evaluateHit(nxt, target)) { hit = true; break; }
                  }
                  
                  if (hit) {
                    patternMap[key].entriesData[e].wins++;
                    patternMap[key].entriesData[e].currentSa = 0;
                  } else {
                    patternMap[key].entriesData[e].currentSa++;
                    if (patternMap[key].entriesData[e].currentSa > patternMap[key].entriesData[e].maxSa) {
                        patternMap[key].entriesData[e].maxSa = patternMap[key].entriesData[e].currentSa;
                    }
                  }
              }
            }
          }
        }
      }
      
      const results: DiscoveredPattern[] = [];
      Object.entries(patternMap).forEach(([k, v]) => {
         for (let e = minEntries; e <= maxEntries; e++) {
             const eState = v.entriesData[e];
             const wr = ((eState.wins / (eState.triggers || 1)) * 100).toFixed(1);
             if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.maxSa <= maxSa && eState.currentSa >= minSaFilter) {
                results.push({
                   id: k + '|ENT_' + e, lossMode: 'CICLO',
                   entries: e,
                   type: v.type, elements: v.elements, winRate: wr, count: eState.wins,
                   triggers: eState.triggers, sa: eState.currentSa, sm: eState.maxSa, activeNow: false, target: v.target
                });
             }
         }
      });
      
      let anyNewTrigger = false;
      const finalResults = results.map(pat => {
         let currentStep = 0;
         let activeNow = false;
         for (let step = 0; step < (pat.entries || maxEntries); step++) {
           const triggerIdx = currentData.length - 1 - step;
           const patternStartIdx = triggerIdx - pat.elements.length + 1;
           if (patternStartIdx < 0) continue;
           let isMatch = true;
           for (let p = 0; p < pat.elements.length; p++) {
             const r = currentData[patternStartIdx + p];
             const el = pat.elements[p];
             if (el.t === 'c') { if (getCol(r) !== el.v) { isMatch = false; break; } } 
             else { if (r.roll !== el.v) { isMatch = false; break; } }
           }
           if (isMatch) {
             let alreadyHit = false;
             for (let check = 1; check <= step; check++) {
               if (evaluateHit(currentData[patternStartIdx + pat.elements.length - 1 + check], pat.target || targetFocus)) {
                 alreadyHit = true; break;
               }
             }
             if (!alreadyHit) {
               activeNow = true;
               currentStep = step + 1;
               if (!oldActiveIds.has(pat.id)) anyNewTrigger = true;
               break; 
             }
           }
         }
         return { ...pat, activeNow, currentStep };
      });
      
      finalResults.sort((a, b) => {
        if (a.activeNow && !b.activeNow) return -1;
        if (!a.activeNow && b.activeNow) return 1;
        return parseFloat(b.winRate) - parseFloat(a.winRate);
      });
      
      setDiscovered(finalResults);
      if (!isAuto) setIsDiscovering(false);
      lastProcessedId.current = currentData[currentData.length - 1].id;
      
      if (isAuto && anyNewTrigger) {
        if (liveMode && marketStatus === "PAGANDO") playAlert();
        
      }
    };

    if (isAuto) { execute(); } else { setTimeout(execute, 800); }
  };


const runFullDiscoveryEntrada = (config: any, currentData: Roll[], isAuto: boolean, oldActiveIds: Set<string> = new Set()) => {
    if (!currentData || currentData.length < 10) return;
    if (!isAuto) {
      setIsDiscovering(true);
      setLiveMode(false);
    }
    
    const execute = () => {
      const { periodHours, patternType, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, selectedSize } = config;
      const [minEntries, maxEntries] = entriesRange || [1, 5];
      const history = currentData.slice(-periodHours * 120);
      const patternState: Record<string, any> = {};
      const activeKeys = new Set<string>();
      
      const typesToTest = patternType === 'TODOS' 
        ? ['ONLY_COLORS', 'ONLY_NUMBERS', 'COLORS_1_NUM', 'COLORS_2_NUM', '1_NUM_COLORS', '2_NUM_COLORS'] 
        : [patternType];

      const discoveryTargets = targetFocus === 'Ambos' ? ['Vermelho', 'Preto'] : [targetFocus];

      for (let i = 0; i < history.length; i++) {
        for (const key of activeKeys) {
            const state = patternState[key];
            let anyActive = false;
            for (let e = minEntries; e <= maxEntries; e++) {
                const eState = state.entriesData[e];
                if (eState.activeEntriesLeft > 0) {
                    anyActive = true;
                    const isWin = evaluateHit(history[i], state.target);
                    if (isWin) {
                        eState.wins++;
                        eState.currentSa = 0;
                        eState.activeEntriesLeft = 0;
                    } else {
                        eState.activeEntriesLeft--;
                        if (eState.activeEntriesLeft === 0) {
                            eState.currentSa++;
                            if (eState.currentSa > eState.sm) eState.sm = eState.currentSa;
                        }
                    }
                }
            }
            if (!anyActive) activeKeys.delete(key);
        }
        
        for (const target of discoveryTargets) {
          for (const type of typesToTest) {
            let sizes = [3];
            if (selectedSize > 0) sizes = [selectedSize];
            else {
              if (type === 'ONLY_COLORS') sizes = [2, 3, 4, 5, 6];
              if (type === 'ONLY_NUMBERS') sizes = [1, 2, 3];
              if (type === 'COLORS_1_NUM') sizes = [3, 4, 5];
              if (type === 'COLORS_2_NUM') sizes = [4, 5];
              if (type === '1_NUM_COLORS') sizes = [3, 4, 5];
              if (type === '2_NUM_COLORS') sizes = [4, 5];
            }

            for (const totalLen of sizes) {
              const startIdx = i - totalLen + 1;
              if (startIdx < 0) continue;
              
              const elements: PatternElement[] = [];
              if (type === 'ONLY_COLORS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
              } else if (type === 'ONLY_NUMBERS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'n', v: history[startIdx+p].roll});
              } else if (type === 'COLORS_1_NUM') {
                for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                elements.push({t:'n', v: history[i].roll});
              } else if (type === 'COLORS_2_NUM') {
                for(let p=0; p<totalLen-2; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                elements.push({t:'n', v: history[i-1].roll});
                elements.push({t:'n', v: history[i].roll});
              } else if (type === '1_NUM_COLORS') {
                elements.push({t:'n', v: history[startIdx].roll});
                for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
              } else if (type === '2_NUM_COLORS') {
                elements.push({t:'n', v: history[startIdx].roll});
                elements.push({t:'n', v: history[startIdx+1].roll});
                for(let p=2; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
              }

              if (elements.length === 0) continue;
              if (patternType !== 'ONLY_NUMBERS' && elements.some(e => e.t === 'n' && e.v === '0')) continue;

              const key = target + ':' + type + ':' + elements.map(e => e.t + e.v).join('|');
              if (!patternState[key]) {
                  patternState[key] = { type, target, elements, entriesData: {} };
                  for (let e = minEntries; e <= maxEntries; e++) {
                      patternState[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, activeEntriesLeft: 0 };
                  }
              }
              
              for (let e = minEntries; e <= maxEntries; e++) {
                  patternState[key].entriesData[e].triggers++;
                  patternState[key].entriesData[e].activeEntriesLeft = e;
              }
              activeKeys.add(key);
            }
          }
        }
      }
      
      const results: DiscoveredPattern[] = [];
      Object.entries(patternState).forEach(([k, v]) => {
         for (let e = minEntries; e <= maxEntries; e++) {
             const eState = v.entriesData[e];
             const wr = ((eState.wins / (eState.triggers || 1)) * 100).toFixed(1);
             if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.sm <= maxSa && eState.currentSa >= minSaFilter) {
                results.push({
                   id: k + '|ENT_' + e, lossMode: 'ENTRADA',
                   entries: e,
                   type: v.type, elements: v.elements, winRate: wr, count: eState.wins,
                   triggers: eState.triggers, sa: eState.currentSa, sm: eState.sm, activeNow: eState.activeEntriesLeft > 0, target: v.target,
                   currentStep: eState.activeEntriesLeft > 0 ? (e - eState.activeEntriesLeft + 1) : 0
                });
             }
         }
      });
      
      let anyNewTrigger = false;
      const finalResults = results.sort((a, b) => {
        if (a.activeNow && !b.activeNow) return -1;
        if (!a.activeNow && b.activeNow) return 1;
        return parseFloat(b.winRate) - parseFloat(a.winRate);
      });
      
      finalResults.forEach(r => {
          if (r.activeNow && !oldActiveIds.has(r.id)) anyNewTrigger = true;
      });
      
      setDiscovered(finalResults);
      if (!isAuto) setIsDiscovering(false);
      lastProcessedId.current = currentData[currentData.length - 1].id;
      
      if (isAuto && anyNewTrigger) {
        if (liveMode && marketStatus === "PAGANDO") playAlert();
      }
    };

    if (isAuto) { execute(); } else { setTimeout(execute, 800); }
};

const runMixedDiscoveryEntrada = (config: any, currentData: Roll[], isAuto: boolean, oldActiveIds: Set<string> = new Set()) => {
    if (!currentData || currentData.length < 10) return;
    
    if (!isAuto) {
      setIsMixedMining(true);
      setLiveMode(false);
    }
    
    const { periodHours, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, patternType } = config;
    const [minEntries, maxEntries] = entriesRange || [1, 5];
    const history = currentData.slice(-periodHours * 120);
    const patternState: Record<string, any> = {};
    const activeKeys = new Set<string>();
    const discoveryTargets = targetFocus === 'Ambos' ? ['Vermelho', 'Preto'] : [targetFocus];
    
    const sizes = [1, 2, 3, 4, 5, 6, 7];
    
    if (!isAuto) {
      setMixedTotal(history.length);
      setMixedProgress(0);
    }

    let currentIndex = 0;
    const chunkSize = 1500;

    const processChunk = () => {
      const end = Math.min(currentIndex + chunkSize, history.length);
      
      for (let i = currentIndex; i < end; i++) {
        for (const key of activeKeys) {
            const state = patternState[key];
            let anyActive = false;
            for (let e = minEntries; e <= maxEntries; e++) {
                const eState = state.entriesData[e];
                if (eState.activeEntriesLeft > 0) {
                    anyActive = true;
                    const isWin = evaluateHit(history[i], state.target);
                    if (isWin) {
                        eState.wins++;
                        eState.currentSa = 0;
                        eState.activeEntriesLeft = 0;
                    } else {
                        eState.activeEntriesLeft--;
                        if (eState.activeEntriesLeft === 0) {
                            eState.currentSa++;
                            if (eState.currentSa > eState.sm) eState.sm = eState.currentSa;
                        }
                    }
                }
            }
            if (!anyActive) activeKeys.delete(key);
        }

        for (const target of discoveryTargets) {
          for (const totalLen of sizes) {
            const startIdx = i - totalLen + 1;
            if (startIdx < 0) continue;
            
            if (totalLen <= 5) {
              const numVariations = 1 << totalLen;
              for (let mask = 0; mask < numVariations; mask++) {
                const elements: PatternElement[] = [];
                let hasZeroAsNum = false;
                for (let p = 0; p < totalLen; p++) {
                  const rollObj = history[startIdx + p];
                  if ((mask & (1 << p)) === 0) {
                    elements.push({ t: 'c', v: getCol(rollObj) });
                  } else {
                    if (rollObj.roll === '0') hasZeroAsNum = true;
                    elements.push({ t: 'n', v: rollObj.roll });
                  }
                }
                
                if (hasZeroAsNum && patternType !== 'ONLY_NUMBERS') continue;
                
                const key = target + ':MIXED:' + elements.map(e => e.t + e.v).join('|');
                if (!patternState[key]) {
                  patternState[key] = { type: 'MIXED', target, elements, entriesData: {} };
                  for (let e = minEntries; e <= maxEntries; e++) {
                      patternState[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, activeEntriesLeft: 0 };
                  }
                }
                
                for (let e = minEntries; e <= maxEntries; e++) {
                    patternState[key].entriesData[e].triggers++;
                    patternState[key].entriesData[e].activeEntriesLeft = e;
                }
                activeKeys.add(key);
              }
            } else {
              const typesToTest = patternType === 'TODOS' 
                ? ['ONLY_COLORS', 'COLORS_1_NUM', '1_NUM_COLORS'] 
                : [patternType];
                
              for (const type of typesToTest) {
                const elements: PatternElement[] = [];
                if (type === 'ONLY_COLORS') {
                  for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                } else if (type === 'ONLY_NUMBERS') {
                  for(let p=0; p<totalLen; p++) elements.push({t:'n', v: history[startIdx+p].roll});
                } else if (type === 'COLORS_1_NUM') {
                  for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                  elements.push({t:'n', v: history[i].roll});
                } else if (type === 'COLORS_2_NUM') {
                  if (totalLen < 4) continue;
                  for(let p=0; p<totalLen-2; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                  elements.push({t:'n', v: history[i-1].roll});
                  elements.push({t:'n', v: history[i].roll});
                } else if (type === '1_NUM_COLORS') {
                  elements.push({t:'n', v: history[startIdx].roll});
                  for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                } else if (type === '2_NUM_COLORS') {
                  if (totalLen < 4) continue;
                  elements.push({t:'n', v: history[startIdx].roll});
                  elements.push({t:'n', v: history[startIdx+1].roll});
                  for(let p=2; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                }

                if (elements.length === 0) continue;
                if (patternType !== 'ONLY_NUMBERS' && elements.some(e => e.t === 'n' && e.v === '0')) continue;

                const key = target + ':' + type + ':' + elements.map(e => e.t + e.v).join('|');
                if (!patternState[key]) {
                  patternState[key] = { type, target, elements, entriesData: {} };
                  for (let e = minEntries; e <= maxEntries; e++) {
                      patternState[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, activeEntriesLeft: 0 };
                  }
                }

                for (let e = minEntries; e <= maxEntries; e++) {
                    patternState[key].entriesData[e].triggers++;
                    patternState[key].entriesData[e].activeEntriesLeft = e;
                }
                activeKeys.add(key);
              }
            }
          }
        }
      }

      currentIndex = end;
      if (!isAuto) setMixedProgress(currentIndex);

      if (currentIndex < history.length) {
        setTimeout(processChunk, isAuto ? 10 : 0);
      } else {
        const results: DiscoveredPattern[] = [];
        Object.entries(patternState).forEach(([k, v]) => {
           for (let e = minEntries; e <= maxEntries; e++) {
               const eState = v.entriesData[e];
               const wr = ((eState.wins / (eState.triggers || 1)) * 100).toFixed(1);
               if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.sm <= maxSa && eState.currentSa >= minSaFilter) {
                  results.push({
                     id: k + '|ENT_' + e, lossMode: 'ENTRADA',
                     entries: e,
                     type: v.type, elements: v.elements, winRate: wr, count: eState.wins,
                     triggers: eState.triggers, sa: eState.currentSa, sm: eState.sm, activeNow: eState.activeEntriesLeft > 0, target: v.target,
                     currentStep: eState.activeEntriesLeft > 0 ? (e - eState.activeEntriesLeft + 1) : 0
                  });
               }
           }
        });

        let anyNewTrigger = false;
        const finalResults = results.sort((a, b) => {
          if (a.activeNow && !b.activeNow) return -1;
          if (!a.activeNow && b.activeNow) return 1;
          return parseFloat(b.winRate) - parseFloat(a.winRate);
        });

        finalResults.forEach(r => {
            if (r.activeNow && !oldActiveIds.has(r.id)) anyNewTrigger = true;
        });

        setDiscovered(finalResults);
        lastProcessedId.current = currentData[currentData.length - 1].id;
        if (!isAuto) setIsMixedMining(false);
        
        if (isAuto && anyNewTrigger) {
          if (liveMode && marketStatus === "PAGANDO") playAlert();
        }
      }
    };

    processChunk();
  };

  
  const runLightUpdate = (currentData: Roll[], oldActiveIds: Set<string>) => {
     if (currentData.length === 0) return;
     const latestRoll = currentData[currentData.length - 1];
     if (!appliedFilters) return;
     const { minWinRate, maxSa, minSaFilter, lossMode, entriesRange } = appliedFilters;
     
     let anyNewTrigger = false;
     const updatedDiscovered = [];

     for (const pat of discovered) {
         let p = { ...pat };
         const len = p.elements.length;
         
         let isTrigger = false;
         if (currentData.length >= len) {
             const slice = currentData.slice(-len);
             isTrigger = true;
             for (let j=0; j<len; j++) {
                 const el = p.elements[j];
                 const roll = slice[j];
                 if (el.t === 'c' && getCol(roll) !== el.v) { isTrigger = false; break; }
                 if (el.t === 'n' && roll.roll.toString() !== el.v) { isTrigger = false; break; }
             }
         }

         if (p.activeNow) {
             const isWin = evaluateHit(latestRoll, p.target);
             if (isWin) {
                 p.count++;
                 p.sa = 0;
                 p.activeNow = false;
                 p.currentStep = 0;
             } else {
                 p.currentStep = (p.currentStep || 0) + 1;
                 const maxE = lossMode === 'ENTRADA' ? (p.entries || entriesRange[1]) : entriesRange[1];
                 if (p.currentStep > maxE) {
                     p.sa++;
                     if (p.sa > p.sm) p.sm = p.sa;
                     p.activeNow = false;
                     p.currentStep = 0;
                 }
             }
         }

         if (isTrigger) {
             p.triggers++;
             p.activeNow = true;
             p.currentStep = 1;
         }

         p.winRate = ((p.count / Math.max(1, p.triggers)) * 100).toFixed(1);

         const wr = parseFloat(p.winRate);
         if (wr >= minWinRate && p.sm <= maxSa && p.sa >= minSaFilter) {
             updatedDiscovered.push(p);
             if (p.activeNow && !oldActiveIds.has(p.id)) anyNewTrigger = true;
         }
     }

     updatedDiscovered.sort((a, b) => {
         if (a.activeNow && !b.activeNow) return -1;
         if (!a.activeNow && b.activeNow) return 1;
         return parseFloat(b.winRate) - parseFloat(a.winRate);
     });

     setDiscovered(updatedDiscovered);
     lastProcessedId.current = latestRoll.id;

     if (anyNewTrigger && liveMode) {
         playAlert();
     }
  };

const runFullDiscovery = (config: any, currentData: Roll[], isAuto: boolean, oldActiveIds: Set<string> = new Set()) => {
      if (config.lossMode === 'ENTRADA') {
          runFullDiscoveryEntrada(config, currentData, isAuto, oldActiveIds);
      } else {
          runFullDiscoveryCiclo(config, currentData, isAuto, oldActiveIds);
      }
  };

  const runMixedDiscovery = (config: any, currentData: Roll[], isAuto: boolean, oldActiveIds: Set<string> = new Set()) => {
      if (config.lossMode === 'ENTRADA') {
          runMixedDiscoveryEntrada(config, currentData, isAuto, oldActiveIds);
      } else {
          runMixedDiscoveryCiclo(config, currentData, isAuto, oldActiveIds);
      }
  };

  const handleProcessIAClick = () => {
    const config = { lossMode, entriesRange, periodHours, patternType, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, selectedSize, useMixedMining };
    setAppliedFilters(config);
    if (useMixedMining) {
      runMixedDiscovery(config, data, false);
    } else {
      runFullDiscovery(config, data, false);
    }
  };

  const runMixedDiscoveryCiclo = (config: any, currentData: Roll[], isAuto: boolean, oldActiveIds: Set<string> = new Set()) => {
    if (!currentData || currentData.length < 10) return;
    
    if (!isAuto) {
      setIsMixedMining(true);
      setLiveMode(false);
    }
    
    const { periodHours, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter } = config;
    const [minEntries, maxEntries] = entriesRange || [1, 5];
    const history = currentData.slice(-periodHours * 120);
    const patternMap: Record<string, any> = {};
    const discoveryTargets = targetFocus === 'Ambos' ? ['Vermelho', 'Preto'] : [targetFocus];
    
    const sizes = [1, 2, 3, 4, 5, 6, 7];
    
    if (!isAuto) {
      setMixedTotal(history.length);
      setMixedProgress(0);
    }

    let currentIndex = 0;
    const chunkSize = 1500;

    const processChunk = () => {
      const end = Math.min(currentIndex + chunkSize, history.length);
      
      for (let i = currentIndex; i < end; i++) {
        for (const target of discoveryTargets) {
          for (const totalLen of sizes) {
            if (i > history.length - maxEntries - totalLen) continue;
            
            if (totalLen <= 4) {
              const numVariations = 1 << totalLen;
              for (let mask = 0; mask < numVariations; mask++) {
                const elements: PatternElement[] = [];
                for (let p = 0; p < totalLen; p++) {
                  if ((mask & (1 << p)) === 0) {
                    elements.push({ t: 'c', v: getCol(history[i + p]) });
                  } else {
                    elements.push({ t: 'n', v: history[i + p].roll });
                  }
                }

                const key = target + ':MIXED:' + elements.map(e => e.t + e.v).join('|');
                if (!patternMap[key]) {
                    patternMap[key] = { elements, type: 'MIXED', target, entriesData: {} };
                    for (let e = minEntries; e <= maxEntries; e++) {
                        patternMap[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, maxSa: 0 };
                    }
                }
                
                for (let e = minEntries; e <= maxEntries; e++) {
                    patternMap[key].entriesData[e].triggers++;
                    
                    let hit = false;
                    for (let w = 1; w <= e; w++) {
                      const nxt = history[i + totalLen - 1 + w];
                      if (evaluateHit(nxt, target)) { hit = true; break; }
                    }
                    if (hit) {
                      patternMap[key].entriesData[e].wins++;
                      patternMap[key].entriesData[e].currentSa = 0;
                    } else {
                      patternMap[key].entriesData[e].currentSa++;
                      if (patternMap[key].entriesData[e].currentSa > patternMap[key].entriesData[e].maxSa) {
                          patternMap[key].entriesData[e].maxSa = patternMap[key].entriesData[e].currentSa;
                      }
                    }
                }
              }
            } else {
                // Larger patterns logic (simplified to ONLY_COLORS for speed in mixed)
                const elements: PatternElement[] = [];
                for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
                
                const key = target + ':ONLY_COLORS:' + elements.map(e => e.t + e.v).join('|');
                if (!patternMap[key]) {
                    patternMap[key] = { elements, type: 'ONLY_COLORS', target, entriesData: {} };
                    for (let e = minEntries; e <= maxEntries; e++) {
                        patternMap[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, maxSa: 0 };
                    }
                }
                
                for (let e = minEntries; e <= maxEntries; e++) {
                    patternMap[key].entriesData[e].triggers++;
                    
                    let hit = false;
                    for (let w = 1; w <= e; w++) {
                      const nxt = history[i + totalLen - 1 + w];
                      if (evaluateHit(nxt, target)) { hit = true; break; }
                    }
                    if (hit) {
                      patternMap[key].entriesData[e].wins++;
                      patternMap[key].entriesData[e].currentSa = 0;
                    } else {
                      patternMap[key].entriesData[e].currentSa++;
                      if (patternMap[key].entriesData[e].currentSa > patternMap[key].entriesData[e].maxSa) {
                          patternMap[key].entriesData[e].maxSa = patternMap[key].entriesData[e].currentSa;
                      }
                    }
                }
            }
          }
        }
      }

      currentIndex = end;
      if (!isAuto) setMixedProgress(currentIndex);

      if (currentIndex < history.length) {
        setTimeout(processChunk, isAuto ? 10 : 0);
      } else {
        const results: DiscoveredPattern[] = [];
        Object.entries(patternMap).forEach(([k, v]) => {
           for (let e = minEntries; e <= maxEntries; e++) {
               const eState = v.entriesData[e];
               const wr = ((eState.wins / (eState.triggers || 1)) * 100).toFixed(1);
               if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.maxSa <= maxSa && eState.currentSa >= minSaFilter) {
                  results.push({
                     id: k + '|ENT_' + e, lossMode: 'CICLO',
                     entries: e,
                     type: v.type, elements: v.elements, winRate: wr, count: eState.wins,
                     triggers: eState.triggers, sa: eState.currentSa, sm: eState.maxSa, activeNow: false, target: v.target
                  });
               }
           }
        });

        let anyNewTrigger = false;
        const finalResults = results.map(pat => {
           let currentStep = 0;
           let activeNow = false;
           for (let step = 0; step < (pat.entries || maxEntries); step++) {
             const triggerIdx = currentData.length - 1 - step;
             const patternStartIdx = triggerIdx - pat.elements.length + 1;
             if (patternStartIdx < 0) continue;
             let isMatch = true;
             for (let p = 0; p < pat.elements.length; p++) {
               const r = currentData[patternStartIdx + p];
               const el = pat.elements[p];
               if (el.t === 'c') { if (getCol(r) !== el.v) { isMatch = false; break; } } 
               else { if (r.roll !== el.v) { isMatch = false; break; } }
             }
             if (isMatch) {
               let alreadyHit = false;
               for (let check = 1; check <= step; check++) {
                 if (evaluateHit(currentData[patternStartIdx + pat.elements.length - 1 + check], pat.target || targetFocus)) {
                   alreadyHit = true; break;
                 }
               }
               if (!alreadyHit) {
                 activeNow = true;
                 currentStep = step + 1;
                 if (!oldActiveIds.has(pat.id)) anyNewTrigger = true;
                 break; 
               }
             }
           }
           return { ...pat, activeNow, currentStep };
        });

        finalResults.sort((a, b) => {
          if (a.activeNow && !b.activeNow) return -1;
          if (!a.activeNow && b.activeNow) return 1;
          return parseFloat(b.winRate) - parseFloat(a.winRate);
        });

        setDiscovered(finalResults);
        lastProcessedId.current = currentData[currentData.length - 1].id;
        if (!isAuto) setIsMixedMining(false);
        
        if (isAuto && anyNewTrigger) {
          if (liveMode && marketStatus === "PAGANDO") playAlert();
        }
      }
    };

    processChunk();
  };

  // Quick Trend Engine (Enhanced Scoring & Auto-Loader)
  const runQuickTrend = () => {
    if (!data || data.length < 10) return;
    setIsTrending(true);

    setTimeout(() => {
      const history = data.slice(-trendHours * 120);
      const results: (TrendResult & { score: number })[] = [];

      const testSizes = [2, 3, 4, 5, 6, 7, 8];
      const testEntries = Array.from({ length: trendMaxEntries }, (_, i) => i + 1);
      
      const targetsToTest = trendTarget === 'Ambos' ? ['Vermelho', 'Preto'] : [trendTarget];

      for (const target of targetsToTest) {
        for (const seqLen of testSizes) {
          for (const limit of testEntries) {
            let wins = 0;
            let total = 0;
            const patternMap: Record<string, { w: number, t: number }> = {};

            for (let i = 0; i <= history.length - limit - seqLen; i++) {
              // Get local pattern key
              const elements: string[] = [];
              for(let p=0; p<seqLen; p++) elements.push(getCol(history[i+p]));
              const pKey = elements.join('');

              if(!patternMap[pKey]) patternMap[pKey] = { w:0, t:0 };
              patternMap[pKey].t++;

              let hit = false;
              for (let w = 1; w <= limit; w++) {
                const nxt = history[i + seqLen - 1 + w];
                if (evaluateHit(nxt, target)) {
                  hit = true; break;
                }
              }
              if(hit) {
                wins++;
                patternMap[pKey].w++;
              }
              total++;
            }

            if (total > 0) {
              const wr = wins / total;
              let score = wr * 100;
              
              // Ajuste de precisão: No ranking real, a IA testa mistos. 
              // Multiplicamos por um fator de diversidade (1.8x) para estimar o total de padrões mistos/numéricos
              const basePCount = Object.values(patternMap).filter(v => (v.w/v.t) >= (wr * 0.9) && v.t >= 2).length;
              const estimatedTotalCount = Math.floor(basePCount * 2.2); // Fator para cobrir padrões mistos

              if (target !== 'Branco') {
                score -= Math.pow(limit, 1.8) * 0.4; 
                if (limit > 5) score -= 10; 
              } else {
                score -= (limit * 1.2);
              }
              score += (seqLen * 0.8) + (estimatedTotalCount * 1.5);

              results.push({
                bestPatternSize: seqLen,
                bestEntries: limit,
                target,
                winRate: (wr * 100).toFixed(1),
                wins,
                losses: total - wins,
                patternCount: estimatedTotalCount,
                score
              });
            }
          }
        }
      }

      const top5 = results
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      setTrendResult(top5);
      setIsTrending(false);
    }, 1000);
  };

  const applyTrend = (result: TrendResult) => {
    if (!result) return;
    setTargetFocus(result.target || trendTarget);
    setEntriesRange([result.bestEntries, result.bestEntries]);
    setSelectedSize(result.bestPatternSize);
    setPatternType('TODOS'); 
    setPeriodHours(trendHours);
    
    const wr = parseFloat(result.winRate);
    setMinWinRate(Math.max(wr - 5, 75)); 
    setMinTriggers(result.bestPatternSize > 5 ? 2 : 3); 
    setMaxSa(5); 
    setMinSaFilter(0);
    
    setShowTrendModal(false);
    setTimeout(() => {
       const config = {
          periodHours: trendHours, patternType: 'TODOS', entriesLimit: result.bestEntries, targetFocus: result.target || trendTarget,
          minTriggers: result.bestPatternSize > 5 ? 2 : 3, minWinRate: Math.max(wr - 5, 75), maxSa: 5, minSaFilter: 0, selectedSize: result.bestPatternSize
       };
       setAppliedFilters(config);
       runFullDiscovery(config, data, false);
    }, 300);
  };

  // Auto-Update Engine: Roda a cada pedra nova
  useEffect(() => {
    if (!data || data.length === 0) return;
    const latestId = data[data.length - 1].id;
    if (latestId === lastProcessedId.current) return;
    
    if (appliedFilters) {
      const oldActive = new Set(discovered.filter(d => d.activeNow).map(d => d.id));
      if (lightMode && discovered.length > 0) {
        runLightUpdate(data, oldActive);
      } else if (appliedFilters.useMixedMining) {
        runMixedDiscovery(appliedFilters, data, true, oldActive);
      } else {
        runFullDiscovery(appliedFilters, data, true, oldActive);
      }
    }
  }, [data]);

  // Timer logic for Light Mode
  useEffect(() => {
     if (!lightMode || discovered.length === 0) return;
     const iv = setInterval(() => {
        setTimeLeft(prev => {
           if (prev <= 1) {
              if (appliedFilters) {
                 const oldActive = new Set(discovered.filter(d => d.activeNow).map(d => d.id));
                 if (appliedFilters.useMixedMining) runMixedDiscovery(appliedFilters, data, true, oldActive);
                 else runFullDiscovery(appliedFilters, data, true, oldActive);
              }
              return refreshMinutes * 60;
           }
           return prev - 1;
        });
     }, 1000);
     return () => clearInterval(iv);
  }, [lightMode, refreshMinutes, appliedFilters, data]);


  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col relative">
      <div className="bg-[#0a0a0f] border-b border-white/5 p-4 flex items-center justify-between shadow-2xl z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 border-r border-white/10 pr-6">
            <Link href="/analista2" className="text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
              IA ANALISTA
            </Link>
            <Link href="/analista2/grafico" className="text-xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center gap-2 hover:scale-105 transition-transform">
              <BrainCircuit className="text-blue-500" />
              IA GRÁFICO
            </Link>
            <Link href="/analista2/maxsoro" className="text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-amber-400 transition-colors">
              IA MAXSORO
            </Link>
            <Link href="/analista2/foco-na-cor" className="text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-red-400 transition-colors">
              FOCO NA COR
            </Link>
          </div>
          <button 
            onClick={() => setShowTrendModal(true)}
            className="flex items-center gap-2 bg-[#eab308]/10 hover:bg-[#eab308]/20 border border-[#eab308]/30 px-3 py-1.5 rounded-lg transition-all text-[#eab308] font-bold text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.1)]"
          >
            <Zap size={14} /> TENDÊNCIA RÁPIDA
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setAudioEnabled(!audioEnabled)} className="text-gray-400 hover:text-white transition-colors" title="Aviso Sonoro">
            {audioEnabled ? <Volume2 size={20} className="text-blue-400" /> : <VolumeX size={20} />}
          </button>
          
                    <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
            <button 
              onClick={() => {
                 const newVal = !lightMode;
                 setLightMode(newVal);
                 if (newVal) setTimeLeft(refreshMinutes * 60);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all font-bold text-[10px] uppercase tracking-widest ${lightMode ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'text-gray-500 hover:text-white'}`}
            >
              <div className="relative">
                {lightMode && <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>}
                ❄️ Modo Leve
              </div>
            </button>
            {lightMode && (
               <div className="flex items-center gap-1">
                 <select 
                   value={refreshMinutes} 
                   onChange={(e) => {
                      setRefreshMinutes(Number(e.target.value));
                      setTimeLeft(Number(e.target.value) * 60);
                   }}
                   className="bg-transparent text-cyan-400 text-[10px] font-black outline-none cursor-pointer appearance-none text-center"
                 >
                   <option value={5}>5m</option>
                   <option value={10}>10m</option>
                   <option value={15}>15m</option>
                 </select>
                 <span className="text-[10px] text-gray-400 font-mono w-10 text-right">
                   {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                 </span>
               </div>
            )}
          </div>
<button 
            onClick={() => { if(discovered.length > 0) setLiveMode(!liveMode); }} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-bold text-xs uppercase tracking-widest border ${liveMode ? 'bg-red-500/20 text-red-500 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.25)]' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}
            disabled={discovered.length === 0}
          >
            {liveMode ? <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> : <Bell size={14} />}
            {liveMode ? 'Vigia Ao Vivo' : 'Ativar Vigia'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Filters */}
        <aside className="w-80 bg-[#0a0a0f] border-r border-white/5 flex flex-col shadow-2xl overflow-y-auto custom-scrollbar p-6 gap-6">
          <div className="flex flex-col gap-1 border-b border-white/5 pb-4 relative z-50">
            <h2 className="text-xs font-black uppercase text-blue-400 tracking-widest flex items-center justify-between">
              <span className="flex items-center gap-2"><Search size={14} /> Filtros IA</span>
              <button onClick={() => setShowPresetsMenu(!showPresetsMenu)} className="hover:scale-110 transition-transform cursor-pointer" title="Estratégias Salvas">📂</button>
            </h2>

            <AnimatePresence>
              {showPresetsMenu && (
                <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="absolute top-8 left-0 right-0 bg-[#12141c] border border-white/10 rounded-xl p-3 shadow-2xl">
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto mb-3 custom-scrollbar">
                    {savedPresets.length === 0 && <span className="text-gray-500 text-[10px] text-center italic py-2">Nenhuma salva.</span>}
                    {savedPresets.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-black/30 px-2 py-1.5 rounded-lg border border-white/5 group">
                        <button onClick={() => loadPreset(p.config)} className="text-xs text-white hover:text-blue-400 truncate flex-1 text-left font-bold transition-colors">{p.name}</button>
                        <button onClick={() => deletePreset(i)} className="text-gray-500 hover:text-red-500 ml-2 opacity-50 group-hover:opacity-100 transition-opacity">🗑️</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-1 focus-within:border-blue-500/50 transition-colors">
                    <input 
                      type="text" 
                      placeholder="Nome da estratégia..." 
                      value={newPresetName} 
                      onChange={(e) => setNewPresetName(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                      className="bg-transparent text-white text-[10px] font-bold w-full outline-none px-2 py-1 placeholder-gray-600" 
                    />
                    <button onClick={savePreset} disabled={!newPresetName.trim()} className="hover:scale-110 disabled:opacity-30 transition-all pr-1 cursor-pointer">💾</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Padrão</label>
              <select className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-md outline-none focus:border-blue-500 text-xs font-bold" value={patternType} onChange={(e) => setPatternType(e.target.value)}>
                <option value="TODOS">⭐ Todos (Misturado)</option>
                <option value="ONLY_COLORS">🔴 Somente Cores</option>
                <option value="ONLY_NUMBERS">🔢 Somente Números</option>
                <option value="COLORS_1_NUM">🎨 Cores + 1 Número</option>
                <option value="COLORS_2_NUM">🎨 Cores + 2 Números</option>
                <option value="1_NUM_COLORS">🔢 1 Número + Cores</option>
                <option value="2_NUM_COLORS">🔢 2 Números + Cores</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Tamanho do Padrão</label>
              <select className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-md outline-none focus:border-blue-500 text-xs font-bold" value={selectedSize} onChange={(e) => setSelectedSize(Number(e.target.value))}>
                <option value={0}>🔍 Selecionar Todos</option>
                {[1,2,3,4,5,6,7,8,9,10].map(s => (
                  <option key={s} value={s}>{s} {s === 1 ? 'Pedra' : 'Pedras'}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Histórico</label>
                <select className="bg-transparent border-b border-white/10 text-white px-2 py-1 outline-none focus:border-blue-500 text-[11px] transition-all" value={periodHours} onChange={(e) => setPeriodHours(Number(e.target.value))}>
                  {[1,2,3,4,6,9,12,18,24,36,48,60,72].map(h => (
                    <option className="bg-[#12141c]" key={h} value={h}>{h} Horas</option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Modo de Loss</label>
                <div className="flex items-center bg-[#12141c] rounded-lg border border-white/5 p-1 relative w-full h-8">
                  <div className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-blue-600 rounded-md transition-all duration-300 ease-in-out" 
                       style={{ left: lossMode === 'CICLO' ? '4px' : 'calc(50%)' }}></div>
                  <button onClick={() => setLossMode('CICLO')} className={`flex-1 text-[9px] font-black uppercase tracking-widest py-1 rounded-md relative z-10 transition-colors ${lossMode === 'CICLO' ? 'text-white' : 'text-gray-500 hover:text-white'}`}>
                    Por Ciclo
                  </button>
                  <button onClick={() => setLossMode('ENTRADA')} className={`flex-1 text-[9px] font-black uppercase tracking-widest py-1 rounded-md relative z-10 transition-colors ${lossMode === 'ENTRADA' ? 'text-white' : 'text-gray-500 hover:text-white'}`}>
                    Por Entrada
                  </button>
                </div>
              </div>
              
              <div className="mt-1">
                <DualSlider range={entriesRange} setRange={setEntriesRange} />
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Tempo Gráfico</label>
              <div className="grid grid-cols-3 gap-1 bg-[#12141c] p-1 rounded-xl">
                 {TFS.map((t: any) => (
                   <button key={t.k} onClick={() => setTf(t.k)} className={`py-1.5 rounded-lg text-[9px] font-black transition-all ${tf===t.k?"bg-blue-500 text-white shadow-lg":"text-gray-500 hover:text-white"}`}>{t.l}</button>
                 ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 py-4 border-y border-white/5 my-2">
              <div className="flex flex-col gap-3">
                 <div className="flex justify-between items-center">
                    <span className="text-[9px] text-yellow-500 font-black uppercase tracking-tighter">Média 1 (Fast)</span>
                    <select className="bg-transparent text-[9px] font-bold outline-none cursor-pointer text-gray-300" value={ind1Type} onChange={e=>setInd1Type(e.target.value as any)}>
                       <option value="sma" className="bg-[#12141c]">SMA</option>
                       <option value="ema" className="bg-[#12141c]">EMA</option>
                    </select>
                 </div>
                 <div className="flex items-center gap-3">
                    <input type="range" min="2" max="50" className="flex-1 accent-yellow-500" value={ind1Period} onChange={e=>setInd1Period(Number(e.target.value))} />
                    <span className="text-xs font-black text-yellow-500 w-6">{ind1Period}</span>
                 </div>
              </div>
              <div className="flex flex-col gap-3">
                 <div className="flex justify-between items-center">
                    <span className="text-[9px] text-blue-500 font-black uppercase tracking-tighter">Média 2 (Slow)</span>
                    <select className="bg-transparent text-[9px] font-bold outline-none cursor-pointer text-gray-300" value={ind2Type} onChange={e=>setInd2Type(e.target.value as any)}>
                       <option value="sma" className="bg-[#12141c]">SMA</option>
                       <option value="ema" className="bg-[#12141c]">EMA</option>
                    </select>
                 </div>
                 <div className="flex items-center gap-3">
                    <input type="range" min="5" max="100" className="flex-1 accent-blue-500" value={ind2Period} onChange={e=>setInd2Period(Number(e.target.value))} />
                    <span className="text-xs font-black text-blue-500 w-6">{ind2Period}</span>
                 </div>
              </div>
            </div>


            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Foco Alvo</label>
              <select className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-md outline-none focus:border-blue-500 text-xs font-bold" value={targetFocus} onChange={(e) => setTargetFocus(e.target.value)}>
                <option value="Ambos">🌓 VERM/PRETO</option>
                <option value="Branco">⚪ BRANCO</option>
                <option value="Vermelho">🔴 VERMELHO</option>
                <option value="Preto">⚫ PRETO</option>
              </select>
            </div>
            
            <hr className="border-white/5 my-2" />

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Min Sinais</label>
                <input type="number" min="1" value={minTriggers} onChange={(e) => setMinTriggers(Number(e.target.value) || 1)} className="bg-[#12141c] border border-white/10 text-white text-xs px-3 py-2 rounded-md outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">TX Mín (%)</label>
                <input type="number" min="0" max="100" value={minWinRate} onChange={(e) => setMinWinRate(Number(e.target.value) || 0)} className="bg-[#12141c] border border-white/10 text-white text-xs px-3 py-2 rounded-md outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Max Loss</label>
                <input type="number" min="0" value={maxSa} onChange={(e) => setMaxSa(Number(e.target.value) || 0)} className="bg-[#12141c] border border-white/10 text-white text-xs px-3 py-2 rounded-md outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider text-purple-400">SA Mín</label>
                <input type="number" min="0" value={minSaFilter} onChange={(e) => setMinSaFilter(Number(e.target.value) || 0)} className="bg-[#12141c] border border-purple-500/30 text-white text-xs px-3 py-2 rounded-md outline-none focus:border-purple-500" />
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={() => setUseMixedMining(!useMixedMining)}
                className={`flex items-center justify-between p-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${useMixedMining ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_15px_rgba(217,119,6,0.2)]' : 'bg-[#12141c] text-gray-500 border-white/5 hover:border-white/10 hover:bg-white/5'}`}
              >
                <span>Super Mineração (Mistos + IA)</span>
                <div className={`w-3 h-3 rounded-sm border ${useMixedMining ? 'bg-amber-400 border-amber-400' : 'border-gray-500'}`}></div>
              </button>

              <button 
                onClick={handleProcessIAClick} 
                disabled={isDiscovering || loading || isMixedMining}
                className={`flex justify-center items-center gap-2 disabled:opacity-50 px-4 py-3 rounded-lg transition-all font-black text-xs uppercase tracking-widest shadow-lg ${useMixedMining ? 'bg-amber-600 hover:bg-amber-500 shadow-[0_0_20px_rgba(217,119,6,0.3)] text-white' : 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)] text-white'}`}
              >
                {isDiscovering || isMixedMining ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div> : <BrainCircuit size={16} />}
                {useMixedMining ? 'PROCESSAR MISTOS' : 'PROCESSAR IA'}
              </button>

              {(isMixedMining) && (
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-amber-400 font-bold uppercase">
                    <span>Minerando Mistos...</span>
                    <span>{mixedTotal > 0 ? Math.round((mixedProgress / mixedTotal) * 100) : 0}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${mixedTotal > 0 ? Math.min(100, (mixedProgress / mixedTotal) * 100) : 0}%` }}></div>
                  </div>
                </div>
              )}

              {discovered.length > 0 && (
                <button 
                  onClick={() => setShowExportModal(true)}
                  className="flex justify-center items-center gap-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-400 px-4 py-2 rounded-lg transition-all font-black text-[10px] uppercase tracking-[0.2em]"
                >
                  <List size={14} /> GERAR PADRÕES
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gradient-to-br from-[#050507] via-[#08080c] to-[#050507]">

          {/* Tendência da Mesa ao Vivo */}
          {data.length > 0 && (
            <div className="flex flex-col gap-2 bg-[#0a0a0f] p-4 rounded-xl border border-white/5 shadow-xl mb-6">
              <h2 className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Tendência da Mesa Ao Vivo</h2>
              <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 justify-start items-center custom-scrollbar">
                <AnimatePresence initial={false}>
                  {data.slice(-30).map((roll, i) => {
                    const n = parseInt(roll.roll); let bg = 'bg-gray-800';
                    if (roll.color.includes('Vermelho') || (n >= 1 && n <= 7)) bg = 'bg-[#f12c4c]';
                    if (roll.color.includes('Preto') || (n >= 8 && n <= 14)) bg = 'bg-[#262831] border border-white/10';
                    if (n === 0 || roll.color.includes('Branco')) bg = 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.3)]';
                    return (
                      <motion.div 
                        key={roll.id} 
                        initial={{ opacity: 0, x: 50, scale: 0.5 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center font-black text-[10px] ${bg}`}
                      >
                        {roll.roll}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}


          <section className="bg-[#0a0a0f] border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden mb-6">
             {marketStatus === 'PAGANDO' && <div className="absolute inset-0 bg-green-500/5 animate-pulse pointer-events-none"></div>}
             
             <div className="flex items-center gap-4 relative z-10 flex-1">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg border ${
                  marketStatus === 'PAGANDO' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {marketStatus === 'PAGANDO' ? '📉' : '📈'}
                </div>
                <div className="flex flex-col">
                   <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Estratégia de Cruzamento</span>
                   <div className="text-xl font-black tracking-tighter flex items-center gap-3">
                     {marketStatus === 'PAGANDO' ? 'SINAL LIBERADO' : 'SINAL RETIDO'}
                     <div className={`px-2 py-0.5 rounded text-[9px] font-black ${marketStatus === 'PAGANDO' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
                       {marketStatus === 'PAGANDO' ? 'PAGANDO' : 'RETENDO'}
                     </div>
                   </div>
                </div>
             </div>

             <div className="flex items-center gap-8 bg-black/40 px-8 py-3 rounded-2xl border border-white/5 relative z-10 shadow-inner">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-gray-500 font-black uppercase mb-1 flex items-center gap-1">LIVE WINS <Check size={10} className="text-green-500" /></span>
                  <span className="text-xl font-black text-green-400">{sessionWins}</span>
                </div>
                <div className="h-8 w-px bg-white/10"></div>
                <div className="flex flex-col items-center group relative">
                   <span className="text-[9px] text-gray-500 font-black uppercase mb-1">ASSERTIVIDADE</span>
                   <span className="text-2xl font-black text-white italic tracking-tighter">
                     {sessionWins + sessionLosses > 0 ? ((sessionWins / (sessionWins + sessionLosses)) * 100).toFixed(1) : "0.0"}%
                   </span>
                   <button onClick={resetSession} className="absolute -bottom-5 opacity-0 group-hover:opacity-100 transition-all text-gray-500 hover:text-white flex items-center gap-1 text-[8px] font-black uppercase"><RotateCcw size={8} /> Resetar</button>
                </div>
                <div className="h-8 w-px bg-white/10"></div>
                <div className="flex flex-col items-center">
                   <span className="text-[9px] text-gray-500 font-black uppercase mb-1 flex items-center gap-1">LIVE LOSS <Trash2 size={10} className="text-red-500" /></span>
                   <span className="text-xl font-black text-red-500">{sessionLosses}</span>
                </div>
             </div>

             <div className="flex items-center gap-3 relative z-10 flex-1 justify-end">
                <button onClick={() => setLiveMode(!liveMode)} className={`px-6 py-3 rounded-2xl font-black text-[10px] transition-all border flex items-center gap-2 ${liveMode ? 'bg-red-500/10 border-red-500/40 text-red-400' : 'bg-white text-black border-transparent hover:scale-105 shadow-xl shadow-white/5'}`}>
                  {liveMode ? 'PARAR VIGIA' : 'LIGAR VIGIA'}
                </button>
             </div>
          </section>

          <section className="bg-[#0a0a0f] border border-white/5 rounded-3xl p-4 h-[400px] relative overflow-hidden group shadow-2xl mb-6">
             <div className="absolute top-6 left-6 z-10 flex items-center gap-4">
               <div className="flex flex-col gap-0.5">
                 <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Fluxo Gráfico</span>
                 <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                     <span className="text-[9px] text-yellow-500 font-black uppercase">{ind1Type} {ind1Period}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                     <span className="text-[9px] text-blue-500 font-black uppercase">{ind2Type} {ind2Period}</span>
                   </div>
                 </div>
               </div>
             </div>
             <div ref={cRef} className="w-full h-full" />
             <div className="absolute bottom-6 right-6 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => chart.current?.timeScale().fitContent()} className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-xs hover:bg-white/20 shadow-lg transition-all">⟲</button>
             </div>
          </section>

          {discovered.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
               <BrainCircuit size={64} className="text-gray-600 mb-6" />
               <h2 className="text-xl font-black text-gray-400 uppercase tracking-widest mb-2">Configure os Filtros</h2>
               <p className="text-sm text-gray-500 max-w-sm">A IA está pronta para encontrar os padrões de ouro baseados nos seus filtros personalizados.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {discovered.map((pat, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  key={pat.id} 
                  className={`bg-[#0a0a0f] border rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group shadow-lg transition-all ${pat.activeNow ? 'border-red-500 bg-red-600/5 scale-[1.02] shadow-[0_0_30px_rgba(239,68,68,0.25)] ring-1 ring-red-500/50' : 'border-white/5 hover:border-blue-500/30'}`}
                >
                  {pat.activeNow && (
                     <div className="absolute top-0 right-0 left-0 bg-red-600 text-white px-4 py-2.5 flex items-center justify-center gap-3 z-20 shadow-2xl border-b border-white/20 animate-pulse">
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">🔥 Estratégia em Operação</span>
                       <div className="flex items-center gap-2 bg-white text-red-600 px-3 py-1 rounded-lg font-black text-xs shadow-inner">
                         ENTRADA <span className="text-sm border-l border-red-100 pl-2 ml-1">{pat.currentStep}</span> / {pat.entries || entriesRange[1]}
                       </div>
                     </div>
                  )}
                  
                  <div className="flex flex-col z-10">
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-2 italic">
                      {pat.type === 'ONLY_COLORS' ? 'Cores Puras' : 
                       pat.type === 'ONLY_NUMBERS' ? 'Números Puros' : 
                       pat.type === 'COLORS_1_NUM' ? 'Cores + 1 Número' : 
                       pat.type === 'COLORS_2_NUM' ? 'Cores + 2 Números' :
                       pat.type === '1_NUM_COLORS' ? '1 Número + Cores' : 
                       pat.type === '2_NUM_COLORS' ? '2 Números + Cores' : 'Misto (Cores/Núm)'}
                    </span>
                    <div className="flex flex-wrap gap-1 items-center bg-black/40 p-3 rounded-xl border border-white/5 group-hover:border-blue-500/20 transition-all">
                      {pat.elements.map((el, idx) => (
                        <div key={idx} className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shadow-sm ${
                          el.t === 'c' 
                            ? (el.v === 'V' ? 'bg-red-600 text-white' : el.v === 'P' ? 'bg-zinc-800 text-white' : 'bg-white text-black')
                            : 'bg-blue-600/20 border border-blue-500/30 text-blue-400'
                        }`}>
                          {el.t === 'c' ? '' : el.v}
                        </div>
                      ))}
                      <span className="text-gray-500 font-bold mx-1">=</span>
                      <span className="text-lg">{getTargetEmoji(pat.target || targetFocus)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-2 z-10">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">Win Rate</span>
                      <span className="text-lg font-black text-[#4ade80]">{pat.winRate}%</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">Gale Máx</span>
                      <span className="text-lg font-black text-white">{(pat.entries || entriesRange[1]) - 1}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5 z-10">
                    <div className="flex flex-col"><span className="text-[7px] text-gray-500 uppercase font-bold">Wins</span><span className="text-xs font-black text-white">{pat.count}</span></div>
                    <div className={`flex flex-col rounded-lg transition-all ${pat.sa >= pat.sm && pat.sa > 0 ? 'bg-[#8b008b] p-1 shadow-[0_0_10px_rgba(139,0,139,0.5)]' : ''}`}>
                      <span className="text-[7px] text-gray-500 uppercase font-bold text-center">MaxLoss</span>
                      <span className="text-xs font-black text-white text-center">{pat.sm}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] text-gray-400 uppercase font-bold text-center">SA</span>
                      <span className="text-xs font-black text-purple-400 text-center">{pat.sa}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* MODAL EXPORTAR PADRÕES */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0a0a0f] border border-purple-500/30 rounded-[2.5rem] p-8 flex flex-col max-w-2xl w-full max-h-[85vh] shadow-[0_30px_100px_rgba(168,85,247,0.15)] relative overflow-hidden">
                <button onClick={() => setShowExportModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"><X size={24} /></button>
                
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg"><List size={28} /></div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Padrões Gerados</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">IA Formatada para Copiar e Colar</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/40 rounded-3xl p-6 border border-white/5 mb-6">
                   <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {formatPatternList()}
                   </pre>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(formatPatternList());
                      const btn = document.getElementById('copy-btn');
                      if (btn) {
                        const originalText = btn.innerText;
                        btn.innerText = 'COPIADO!';
                        setTimeout(() => btn.innerText = originalText, 2000);
                      }
                    }}
                    id="copy-btn"
                    className="flex-1 bg-white text-black hover:bg-gray-200 transition-all font-black text-xs py-4 rounded-2xl uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    Copiar Lista Completa
                  </button>
                  <button 
                    onClick={() => setShowExportModal(false)}
                    className="px-8 bg-white/5 hover:bg-white/10 text-white transition-all font-black text-xs py-4 rounded-2xl uppercase tracking-widest"
                  >
                    Fechar
                  </button>
                </div>

                {/* Decorative background elements */}
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px]"></div>
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px]"></div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL TENDÊNCIA RÁPIDA */}
      <AnimatePresence>
        {showTrendModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0a0a0f] border border-[#eab308]/30 rounded-[2.5rem] p-8 flex flex-col max-w-md w-full shadow-[0_0_50px_rgba(234,179,8,0.15)] relative overflow-hidden">
                <button onClick={() => setShowTrendModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white"><X size={20} /></button>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-[#eab308]/10 flex items-center justify-center text-[#eab308] shadow-lg"><Zap size={24} /></div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-widest">Ranking IA</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Top 5 Melhores Configurações</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex flex-col gap-1.5"><label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Período</label>
                    <select className="bg-[#12141c] border border-white/5 text-white px-3 py-2.5 rounded-xl outline-none focus:border-[#eab308] text-xs font-bold transition-all" value={trendHours} onChange={(e) => setTrendHours(Number(e.target.value))}>
                      {[1,2,3,4,6,9,12,18,24,36,48,60].map(h => (
                        <option key={h} value={h}>{h} Horas</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5"><label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Apostar em?</label>
                    <select className="bg-[#12141c] border border-white/5 text-white px-3 py-2.5 rounded-xl outline-none focus:border-[#eab308] font-black text-xs transition-all" value={trendTarget} onChange={(e) => setTrendTarget(e.target.value)}>
                      <option value="Ambos">VERM/PRETO</option>
                      <option value="Vermelho">🔴 Vermelho</option>
                      <option value="Preto">⚫ Preto</option>
                      <option value="Branco">⚪ Branco</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mb-8">
                  <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Gale Máximo no Ranking</label>
                  <select className="bg-[#12141c] border border-white/5 text-white px-3 py-2.5 rounded-xl outline-none focus:border-[#eab308] font-black text-xs transition-all" value={trendMaxEntries} onChange={(e) => setTrendMaxEntries(Number(e.target.value))}>
                    <option value={1}>Somente 1 Entrada (Gale 0)</option>
                    {Array.from({ length: 29 }, (_, i) => i + 2).map(n => (
                      <option key={n} value={n}>Até Gale {n-1} ({n} Entradas)</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-3 mb-8 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                  {trendResult && !isTrending ? (
                    trendResult.map((res, idx) => (
                      <div key={idx} className="bg-white/[0.03] border border-white/5 hover:border-[#eab308]/30 rounded-2xl p-4 flex items-center justify-between group transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-[#eab308] font-black text-xs">#{idx + 1}</div>
                          <div className="flex flex-col">
                            <span className="text-lg font-black text-white leading-none flex items-center gap-2">
                               {res.winRate}% {res.target && <span className="text-sm">{getTargetEmoji(res.target)}</span>}
                            </span>
                            <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mt-1">Tamanho {res.bestPatternSize} • Gale {res.bestEntries - 1}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="flex flex-col items-end">
                              <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">Estratégias</span>
                              <span className="text-xs font-black text-[#eab308] leading-none">{res.patternCount} Achadas</span>
                           </div>
                           <button 
                             onClick={() => applyTrend(res)}
                             className="bg-[#eab308]/10 hover:bg-[#eab308] text-[#eab308] hover:text-black p-2 rounded-xl transition-all"
                           >
                             <ChevronRight size={18} />
                           </button>
                        </div>
                      </div>
                    ))
                  ) : isTrending ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="w-10 h-10 rounded-full border-2 border-[#eab308] border-t-transparent animate-spin"></div>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest animate-pulse">Calculando Top 5...</span>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-600 text-xs font-bold uppercase tracking-widest italic">Aguardando cálculo...</div>
                  )}
                </div>

                <button onClick={runQuickTrend} disabled={isTrending} className="w-full flex justify-center items-center gap-2 bg-[#eab308] hover:bg-[#ca8a04] text-black px-4 py-4 rounded-2xl transition-all font-black text-sm uppercase tracking-widest shadow-[0_10px_30px_rgba(234,179,8,0.2)]">
                  {isTrending ? 'Processando...' : 'Recalcular Ranking'}
                </button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      <AnimatePresence>
        {isDiscovering && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
             <div className="bg-[#0a0a0f] border border-blue-500/30 rounded-2xl p-8 flex flex-col items-center shadow-[0_0_50px_rgba(37,99,235,0.15)] max-w-sm">
                <BrainCircuit size={48} className="text-blue-500 mb-4 animate-pulse" />
                <h2 className="text-xl font-black text-white uppercase tracking-widest mb-2 text-center">Processando Hipóteses</h2>
                <p className="text-gray-400 text-xs text-center">Vagando pelas linhas do tempo...</p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
