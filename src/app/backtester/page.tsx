'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, LineSeries } from 'lightweight-charts';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, ChevronLeft, Zap, Trash2, List, Play, Plus, X, Flame, Undo2, RotateCcw } from 'lucide-react';
import { GlobalStoneIcon } from '@/components/GlobalStoneIcon';

interface SimulationResult {
  roll: any;
  isTrigger: boolean;
  isEntry: boolean;
  isWin: boolean;
  pnl: number;
  galeLevel: number;
  isSoro: boolean;
  isVirtual?: boolean;
  remainingEntries?: number;
}

function LineChart({ data, markers, color }: { data: {x: number, y: number}[], markers: {x: number, y: number, type: 'win' | 'loss'}[], color: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const markersRef = useRef(markers);
  const [renderedMarkers, setRenderedMarkers] = useState<{x: number, y: number, type: 'win' | 'loss'}[]>([]);

  useEffect(() => {
    markersRef.current = markers;
    if (chartRef.current && (chartRef.current as any).updateMarkers) {
      (chartRef.current as any).updateMarkers();
    }
  }, [markers]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#6b7280', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { labelBackgroundColor: '#1f2937' }, horzLine: { labelBackgroundColor: color } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.05)', timeVisible: true },
      handleScroll: true,
      handleScale: true,
    });
    chartRef.current = chart;

    const series = chart.addSeries(LineSeries, {
      color: color,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      priceLineVisible: false,
      lineType: 1,
    });
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
      }
    });
    ro.observe(chartContainerRef.current);

    const updateMarkers = () => {
      if (!chartRef.current || !seriesRef.current) return;
      const ts = chartRef.current.timeScale();
      const newMarkers = markersRef.current.map(m => {
        const time = 1600000000 + (m.x * 3600);
        const x = ts.timeToCoordinate(time);
        const y = seriesRef.current.priceToCoordinate(m.y);
        return { x: x as number, y: y as number, type: m.type };
      }).filter(m => m.x !== null && m.y !== null);
      setRenderedMarkers(newMarkers);
    };

    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(updateMarkers);
    chartRef.current.timeScale().subscribeSizeChange(updateMarkers);
    
    // Attach updateMarkers to ref to call on data change
    chartRef.current.updateMarkers = updateMarkers;

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(updateMarkers);
        chartRef.current.timeScale().unsubscribeSizeChange(updateMarkers);
        try { chartRef.current.remove(); } catch (e) {}
        chartRef.current = null;
      }
    };
  }, [color]);

  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0 || !chartRef.current) return;

    // Use a fixed base timestamp and increment by 1 hour per step
    const BASE_TS = 1600000000;
    
    // Some data points might have identical x if the logic isn't strictly sequential. 
    // We enforce strictly increasing time to prevent lightweight-charts errors.
    let lastTime = 0;
    const formattedData = data.map((d) => {
      let t = BASE_TS + (d.x * 3600);
      if (t <= lastTime) t = lastTime + 1;
      lastTime = t;
      return { time: t, value: d.y };
    });

    seriesRef.current.setData(formattedData);
    chartRef.current.timeScale().fitContent();
    if (chartRef.current.updateMarkers) chartRef.current.updateMarkers();
  }, [data]);

  if (data.length < 2) return (
    <div className="w-full h-full flex items-center justify-center text-gray-500 italic text-xs">
      Aguardando processamento de dados...
    </div>
  );

  return (
    <div className="w-full h-full relative overflow-hidden">
       <style dangerouslySetInnerHTML={{__html: `
        #tv-attr-logo, .tv-lightweight-charts-watermark, a[href*="tradingview"] {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
       `}} />
       <div ref={chartContainerRef} className="w-full h-full absolute inset-0" />
       
       <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {renderedMarkers.map((m, i) => (
             <div 
               key={i} 
               className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none"
               style={{ left: m.x, top: m.type === 'win' ? m.y - 12 : m.y + 12 }}
             >
                <span className={`text-[10px] ${m.type === 'win' ? 'text-[#4ade80]' : 'text-[#f12c4c]'}`}>
                   {m.type === 'win' ? '▼' : '▲'}
                </span>
                <span className="text-[8px] font-black text-white">{m.type === 'win' ? 'WIN' : 'LOSS'}</span>
             </div>
          ))}
       </div>

       <div className="absolute top-4 right-4 flex gap-2 z-20 opacity-0 hover:opacity-100 transition-opacity">
         <button onClick={() => chartRef.current?.timeScale().fitContent()} className="bg-black/60 backdrop-blur border border-white/10 px-3 py-1 rounded text-[10px] uppercase font-black hover:bg-white/10 text-white transition-all">Resetar Zoom</button>
       </div>
    </div>
  );
}

export default function SimuladorPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Padrão
  const [patternStones, setPatternStones] = useState<string[]>(['V', 'V', 'V']);
  const [targetType, setTargetType] = useState<'Branco' | 'Preto' | 'Vermelho'>('Branco');
  const [continuousReading, setContinuousReading] = useState(false);
  const [entriesPerTrigger, setEntriesPerTrigger] = useState(5);
  
  // Teste e Setup
  const [initialBet, setInitialBet] = useState(1.0);
  const [historyLimit, setHistoryLimit] = useState(500);
  const [stopWin, setStopWin] = useState(50.0);
  const [stopLoss, setStopLoss] = useState(100.0);

  // Gale e Soro (Dinâmicos)
  const [galeConfig, setGaleConfig] = useState([{ quantity: 1, multiplier: 2.0 }]);
  const [soroConfig, setSoroConfig] = useState([{ quantity: 0, multiplier: 0 }]);

  // Zona
  const [zonaEnabled, setZonaEnabled] = useState(false);
  const [zonaRange, setZonaRange] = useState(50);
  const [zonaMin, setZonaMin] = useState(0);
  const [zonaMax, setZonaMax] = useState(50);

  // Ciclos
  const [lossCyclesStop, setLossCyclesStop] = useState(10);
  const [winCyclesTarget, setWinCyclesTarget] = useState(1);
  const [ciclosEnabled, setCiclosEnabled] = useState(false);
  const [cicloStartType, setCicloStartType] = useState<'green'|'red'>('green');
  const [cicloStopType, setCicloStopType] = useState<'green'|'red'>('red');
  const [simulationCount, setSimulationCount] = useState(2000);
  const [targetDropdownOpen, setTargetDropdownOpen] = useState(false);

  const [savedStrategies, setSavedStrategies] = useState<{name: string, config: any}[]>([]);
  const [chartView, setChartView] = useState<'global' | 'cycle'>('global');

  const [hasRun, setHasRun] = useState(false);
  const [results, setResults] = useState({
    globalBalance: 0, cycleBalance: 0, 
    globalWins: 0, globalLosses: 0, cycleWins: 0, cycleLosses: 0,
    globalMaxGale: 0, cycleMaxGale: 0,
    totalTrades: 0, virtualPlays: 0,
    stopWinsHit: 0, stopLossesHit: 0,
    globalMaxBalance: 0, globalMinBalance: 0, cycleMaxBalance: 0, cycleMinBalance: 0,
    globalHistory: [] as any[], cycleHistory: [] as any[], markers: [] as any[],
    simulationHistory: [] as SimulationResult[]
  });

  const periodHoursRef = useRef(Math.ceil(simulationCount / 120));
  useEffect(() => { periodHoursRef.current = Math.ceil(simulationCount / 120); }, [simulationCount]);

  const fetchData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      // Fetch at least 72 hours, or more if requested by the user
      const hoursToFetch = Math.max(periodHoursRef.current, 72);
      const res = await fetch(`/api/results/period?hours=${hoursToFetch}`);
      if (!res.ok) { console.warn('Falha na API de resultados'); return; }
      const json = await res.json();
      if (json.data) {
        setData(json.data.map((r: any) => ({ ...r, color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(), roll: r.roll?.toString() })));
      }
    } catch (err) { console.warn('Erro de rede ou timeout ao buscar dados.'); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const saved = localStorage.getItem('roboBlaze_strategies');
    if (saved) setSavedStrategies(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (hasRun && data && data.length > 0) {
      runSimulation(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const saveStrategy = () => {
    const name = window.prompt('Nome da Estratégia:');
    if (!name) return;
    const newConfig = { patternStones, targetType, entriesPerTrigger, simulationCount, initialBet, galeConfig, soroConfig, stopWin, stopLoss, zonaRange, zonaMin, zonaMax, lossCyclesStop, winCyclesTarget, continuousReading };
    const updated = [...savedStrategies, { name, config: newConfig }];
    setSavedStrategies(updated);
    localStorage.setItem('roboBlaze_strategies', JSON.stringify(updated));
  };

  const loadStrategy = (name: string) => {
    const strategy = savedStrategies.find(s => s.name === name);
    if (!strategy) return;
    const c = strategy.config;
    if (c.patternStones) setPatternStones(c.patternStones);
    if (c.targetType) setTargetType(c.targetType);
    if (c.entriesPerTrigger !== undefined) setEntriesPerTrigger(c.entriesPerTrigger);
    if (c.simulationCount) setSimulationCount(c.simulationCount);
    if (c.initialBet) setInitialBet(c.initialBet);
    if (c.galeConfig) setGaleConfig(c.galeConfig);
    if (c.soroConfig) setSoroConfig(c.soroConfig);
    if (c.stopWin) setStopWin(c.stopWin);
    if (c.stopLoss) setStopLoss(c.stopLoss);
    if (c.zonaRange !== undefined) setZonaRange(c.zonaRange);
    if (c.zonaMin !== undefined) setZonaMin(c.zonaMin);
    if (c.zonaMax !== undefined) setZonaMax(c.zonaMax);
    if (c.lossCyclesStop !== undefined) setLossCyclesStop(c.lossCyclesStop);
    if (c.winCyclesTarget !== undefined) setWinCyclesTarget(c.winCyclesTarget);
    setContinuousReading(c.continuousReading || false);
  };

  const runSimulation = (isAuto: boolean = false) => {
    if (!data || data.length === 0) return;
    const recordsNeeded = simulationCount;
    const analysisData = data.slice(-recordsNeeded);
    
    let gB = 0; let cB = 0; let curB = initialBet; let sessionBalance = 0;
    let gMaxB = 0; let gMinB = 0; let cMaxB = 0; let cMinB = 0;
    let gW = 0; let gL = 0; let cWin = 0; let cLoss = 0;
    let maxGG = 0; let maxCG = 0;
    let tT = 0; let vP = 0;
    let gS = 0; let tE = 0; let cW = 0;
    
    let consecutiveRealCycles = 0;
    let consecutiveVirtualCycles = 0;
    let isVirtualMode = ciclosEnabled && winCyclesTarget > 0; // If cycles are enabled and target > 0, start in virtual waiting for the start trigger

    let gH = [{x: 0, y: 0}]; let cH = [{x: 0, y: 0}]; let markers = [] as any[];
    let simHist: SimulationResult[] = [];
    
    let stopWinsCount = 0;
    let stopLossesCount = 0;

    const getGaleMultiplier = (galeIndex: number) => {
      let cumulative = 0;
      for (const gc of galeConfig) {
        cumulative += gc.quantity;
        if (galeIndex < cumulative) return gc.multiplier;
      }
      return galeConfig.length > 0 ? galeConfig[galeConfig.length - 1].multiplier : 2.0;
    };
    
    const getSoroMultiplier = (soroIndex: number) => {
      let cumulative = 0;
      for (const sc of soroConfig) {
        cumulative += sc.quantity;
        if (soroIndex < cumulative) return sc.multiplier;
      }
      return soroConfig.length > 0 ? soroConfig[soroConfig.length - 1].multiplier : 1.0;
    };

    for (let i = 0; i < analysisData.length; i++) {
       const roll = analysisData[i];
       const num = parseInt(roll.roll);
       const isBranco = roll.color.includes('Branco') || num === 0;
       const isVermelho = roll.color.includes('Vermelho') || (num >= 1 && num <= 7);
       const isPreto = roll.color.includes('Preto') || (num >= 8 && num <= 14);

       let isTargetWin = false;
       if (targetType === 'Branco' && isBranco) isTargetWin = true;
       if (targetType === 'Vermelho' && isVermelho) isTargetWin = true;
       if (targetType === 'Preto' && isPreto) isTargetWin = true;

       const wasInSessionAtStart = (tE > 0);
       const wasVirtualThisStone = isVirtualMode;
       let isTriggerThisStone = false;
       let isPartOfActiveSearch = false;
       let thisPnl = 0;
       let thisGale = gS;
       let thisSoro = (cW > 0);

       if (wasInSessionAtStart) {
         isPartOfActiveSearch = true;
         tE--;
         
         if (isTargetWin) {
           // WIN
           let profitMultiplier = 1;
           if (targetType === 'Branco') profitMultiplier = 13;
           
           thisPnl = curB * profitMultiplier;
           
           if (!isVirtualMode) {
             cW++; gW++; cWin++; tT++;
             curB = Math.max(0.10, curB * getSoroMultiplier(cW - 1));
             gB += thisPnl; cB += thisPnl; sessionBalance += thisPnl;
             if (gB > gMaxB) gMaxB = gB; if (gB < gMinB) gMinB = gB;
             if (cB > cMaxB) cMaxB = cB; if (cB < cMinB) cMinB = cB;
             
             if (cicloStopType === 'green') {
               consecutiveRealCycles++;
               if (ciclosEnabled && lossCyclesStop > 0 && consecutiveRealCycles >= lossCyclesStop) {
                 isVirtualMode = true;
                 consecutiveVirtualCycles = 0;
               }
             } else {
               consecutiveRealCycles = 0;
             }
             gS = 0;
           } else {
             vP++;
             if (cicloStartType === 'green') {
               consecutiveVirtualCycles++;
               if (ciclosEnabled && winCyclesTarget > 0 && consecutiveVirtualCycles >= winCyclesTarget) {
                 isVirtualMode = false;
                 consecutiveRealCycles = 0;
               }
             } else {
               consecutiveVirtualCycles = 0;
             }
           }
           
           tE = 0; 
         } else {
           // LOSS
           thisPnl = -curB;
           
           if (!isVirtualMode) {
             cW = 0; gL++; cLoss++; tT++; gS++;
             if (gS > maxGG) maxGG = gS;
             if (gS > maxCG) maxCG = gS;
             
             gB += thisPnl; cB += thisPnl; sessionBalance += thisPnl;
             if (gB > gMaxB) gMaxB = gB; if (gB < gMinB) gMinB = gB;
             if (cB > cMaxB) cMaxB = cB; if (cB < cMinB) cMinB = cB;

             if (cicloStopType === 'red') {
                consecutiveRealCycles++;
                if (ciclosEnabled && lossCyclesStop > 0 && consecutiveRealCycles >= lossCyclesStop) {
                   isVirtualMode = true;
                   consecutiveVirtualCycles = 0;
                }
             } else {
                consecutiveRealCycles = 0;
             }
           } else {
             vP++;
             
             if (cicloStartType === 'red') {
               consecutiveVirtualCycles++;
               if (ciclosEnabled && winCyclesTarget > 0 && consecutiveVirtualCycles >= winCyclesTarget) {
                 isVirtualMode = false;
                 consecutiveRealCycles = 0;
               }
             } else {
               consecutiveVirtualCycles = 0;
             }
           }
           
           if (!wasVirtualThisStone) {
             let totalGales = 0;
             for (const gc of galeConfig) totalGales += gc.quantity;
             if (gS > totalGales) {
                curB = initialBet;
                gS = 0;
                tE = 0;
                cW = 0;
             } else {
                curB = Math.max(0.10, curB * getGaleMultiplier(gS - 1));
                cW = 0;
             }
           }
         }
       }

       if (!isVirtualMode && sessionBalance >= stopWin) { 
         markers.push({x: i, y: gB, type: 'win'}); 
         sessionBalance = 0; 
         stopWinsCount++; 
         curB = initialBet; gS = 0; cW = 0; cB = 0; 
       }
       if (!isVirtualMode && sessionBalance <= -stopLoss) { 
         markers.push({x: i, y: gB, type: 'loss'}); 
         sessionBalance = 0; 
         stopLossesCount++; 
         curB = initialBet; gS = 0; cW = 0; cB = 0; 
       }

       let match = false;
       if (patternStones.length > 0 && i >= patternStones.length - 1) {
          match = true;
          for (let p = 0; p < patternStones.length; p++) {
             const hIdx = i - (patternStones.length - 1) + p;
             const hR = analysisData[hIdx];
             const hN = parseInt(hR.roll);
             let hC = 'B';
             if (hR.color.includes('Vermelho') || (hN >= 1 && hN <= 7)) hC = 'V';
             if (hR.color.includes('Preto') || (hN >= 8 && hN <= 14)) hC = 'P';
             
             const req = patternStones[p];
             if (req === 'V' && hC !== 'V') match = false;
             else if (req === 'P' && hC !== 'P') match = false;
             else if (req === 'B' && hC !== 'B') match = false;
             else if (req === 'DUAL' && hC === 'B') match = false;
             else if (req === 'TRI') { /* Any stone passes TRI since TRI is universal trigger? Let's assume yes or ignore */ }
             else if (!['V', 'P', 'B', 'DUAL', 'TRI'].includes(req)) {
               if (hN.toString() !== req) match = false;
             }
             if (!match) break;
          }
       }
       
       if (match && (continuousReading || !wasInSessionAtStart)) {
          let zonaValid = true;
          if (zonaEnabled && zonaRange > 0) {
            let brancosInZona = 0;
            const startZ = Math.max(0, i - zonaRange + 1);
            for (let z = startZ; z <= i; z++) {
              if (analysisData[z].color.includes('Branco') || parseInt(analysisData[z].roll) === 0) brancosInZona++;
            }
            if (brancosInZona < zonaMin || brancosInZona > zonaMax) zonaValid = false;
          }

          if (zonaValid) {
             tE = entriesPerTrigger;
             isTriggerThisStone = true;
             if (!isVirtualMode) {
               let totalSoroLimit = 0;
               for (const sc of soroConfig) totalSoroLimit += sc.quantity;
               if (gS === 0 && (cW === 0 || cW > totalSoroLimit)) {
                   cB = 0;
                   curB = initialBet; cW = 0;
                   cH = [{ x: i, y: 0 }];
               }
             }
          }
       }

       if (!isVirtualMode) {
          cH.push({ x: i, y: cB });
          gH.push({ x: i, y: gB });
       }

       simHist.push({ 
          roll, isTrigger: isTriggerThisStone, isEntry: isPartOfActiveSearch, isWin: isTargetWin && isPartOfActiveSearch, 
          pnl: wasVirtualThisStone ? 0 : thisPnl, galeLevel: thisGale, isSoro: thisSoro,
          isVirtual: wasVirtualThisStone, remainingEntries: tE
       });
    }

    setResults({ 
       globalBalance: gB, cycleBalance: cB, 
       globalWins: gW, globalLosses: gL, cycleWins: cWin, cycleLosses: cLoss,
       globalMaxGale: maxGG, cycleMaxGale: maxCG,
       totalTrades: tT, virtualPlays: vP, stopWinsHit: stopWinsCount, stopLossesHit: stopLossesCount, 
       globalMaxBalance: gMaxB, globalMinBalance: gMinB, cycleMaxBalance: cMaxB, cycleMinBalance: cMinB,
       globalHistory: gH, cycleHistory: cH, markers, simulationHistory: simHist 
    });
    setHasRun(true);
    if (!isAuto) setIsSidebarOpen(false);
  };

  const addPattern = (stone: string) => setPatternStones([...patternStones, stone]);
  const removePattern = (idx: number) => setPatternStones(patternStones.filter((_, i) => i !== idx));

  return (
    <main className="min-h-screen bg-[#050507] text-gray-200 font-sans flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden relative">
        <motion.aside initial={false} animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }} className="bg-[#0a0a0f] border-r border-white/5 overflow-hidden flex flex-col shadow-2xl z-50">
          <div className="p-6 flex flex-col gap-4 w-[320px] h-full overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-black uppercase tracking-tighter text-white">Configurações</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <ChevronLeft size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black uppercase text-gray-500">Favoritos</span>
                <button onClick={saveStrategy} className="text-[9px] bg-[#4ade80]/20 text-[#4ade80] px-2 py-0.5 rounded-full font-bold">SALVAR</button>
              </div>
              <div className="max-h-[100px] overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                {savedStrategies.map(s => (
                  <div key={s.name} className="flex justify-between group items-center">
                    <button onClick={() => loadStrategy(s.name)} className="text-[10px] text-gray-400 hover:text-white truncate flex-1 text-left">{s.name}</button>
                    <button onClick={() => {if(window.confirm('Excluir?')){ const updated = savedStrategies.filter(x=>x.name!==s.name); setSavedStrategies(updated); localStorage.setItem('roboBlaze_strategies', JSON.stringify(updated));}}} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">

              {/* PADRAO VISUAL - copia do /laboratorio PatternBuilder */}
              <div className="bg-[#0d0f1a] border border-white/10 rounded-xl p-3">
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">Padrão</span>
                    <div className="flex gap-1">
                       <button onClick={() => setPatternStones(p => p.slice(0,-1))} disabled={!patternStones.length} className="text-[9px] px-2 py-0.5 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10">←</button>
                       <button onClick={() => setPatternStones([])} disabled={!patternStones.length} className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 disabled:opacity-30"><RotateCcw size={10}/></button>
                    </div>
                 </div>
                 <div className="min-h-[64px] flex items-center gap-2 flex-wrap bg-black/50 rounded-xl p-3 border border-white/10 mb-3 shadow-inner">
                    {!patternStones.length && <span className="text-gray-500 text-xs italic font-semibold">Monte seu padrão clicando nas opções abaixo...</span>}
                    {patternStones.map((s, i) => (
                      <motion.div key={i} initial={{scale:0}} animate={{scale:1}} className="shrink-0 relative group">
                         <button onClick={() => setPatternStones(p => p.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-110">✕</button>
                         {s === 'B' ? <GlobalStoneIcon n={0} size="sm" /> :
                          (s === 'DUAL' || s === 'TRI') ? <div className="w-7 h-7 rounded-lg border flex items-center justify-center font-black text-[7px] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)] border-white/20" style={{ background: s === 'DUAL' ? 'linear-gradient(to right, #dc2626 50%, #27272a 50%)' : 'linear-gradient(to right, #dc2626 33.33%, #d4d4d8 33.33%, #d4d4d8 66.66%, #27272a 66.66%)' }}>{s}</div> :
                          /^\d+$/.test(s) ? <GlobalStoneIcon n={parseInt(s)} size="sm" /> :
                          <div className={`w-7 h-7 rounded-lg border flex items-center justify-center font-black text-[10px] ${s === 'V' ? 'bg-red-600/80 border-red-500/50 text-white' : 'bg-zinc-800/80 border-zinc-600/50 text-white'}`}>{s}</div>
                         }
                      </motion.div>
                    ))}
                 </div>
                 <div className="text-[8px] text-gray-600 uppercase tracking-widest mb-1">Cores</div>
                 <div className="flex gap-1 mb-2">
                    <button onClick={()=>addPattern('V')} className="flex-1 py-2 rounded-lg bg-red-700/80 text-white font-black text-[9px] hover:bg-red-600 transition-all">V</button>
                    <button onClick={()=>addPattern('P')} className="flex-1 py-2 rounded-lg bg-zinc-700 text-white font-black text-[9px] hover:bg-zinc-600 transition-all">P</button>
                    <button onClick={()=>addPattern('B')} className="flex-1 py-1 rounded-lg bg-white text-black flex items-center justify-center hover:bg-gray-100 transition-all"><GlobalStoneIcon n={0} size="sm" /></button>
                    <button onClick={()=>addPattern('DUAL')} className="flex-1 py-2 rounded-lg text-white font-black text-[7px] hover:opacity-80 transition-all drop-shadow-md" style={{ background: 'linear-gradient(to right, #dc2626 50%, #27272a 50%)' }}>DUAL</button>
                    <button onClick={()=>addPattern('TRI')} className="flex-1 py-2 rounded-lg text-white font-black text-[7px] hover:opacity-80 transition-all drop-shadow-md" style={{ background: 'linear-gradient(to right, #dc2626 33.33%, #d4d4d8 33.33%, #d4d4d8 66.66%, #27272a 66.66%)' }}>TRI</button>
                 </div>
                 <div className="text-[8px] text-gray-600 uppercase tracking-widest mb-1">Números</div>
                 <div className="grid grid-cols-5 gap-1">
                    {Array.from({length:15},(_,n) => (
                      <button key={n} onClick={()=>addPattern(n.toString())}
                        className={`h-7 rounded-lg font-black text-[10px] transition-all hover:scale-105 ${n===0?'bg-white text-black':n<=7?'bg-red-700/80 text-white':'bg-zinc-700 text-white'}`}>
                        {n}
                      </button>
                    ))}
                 </div>
              </div>

              {/* LEITURA CONTINUA */}
              <div className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                 <span className="text-[10px] font-bold text-gray-400">Leitura Contínua</span>
                 <button onClick={() => setContinuousReading(!continuousReading)} className={`relative w-9 h-5 rounded-full transition-all ${continuousReading ? 'bg-blue-600' : 'bg-gray-700'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${continuousReading ? 'left-4' : 'left-0.5'}`}/>
                 </button>
              </div>

              {/* QUANTIDADE DE HISTORICO */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                 <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Histórico de Análise</label>
                 <input type="number" step="500" min="500" max="100000"
                    className="bg-[#12141c] border border-white/10 text-white text-xs p-2 rounded-lg font-bold text-center"
                    value={simulationCount} onChange={e=>setSimulationCount(Number(e.target.value))} />
                 <div className="flex flex-wrap gap-1">
                    {[{v:720,l:'~5h'},{v:1440,l:'~12h'},{v:2880,l:'~24h'},{v:8640,l:'~3d'},{v:20160,l:'~7d'},{v:43200,l:'~15d'}].map(({v,l})=>(
                      <button key={v} onClick={()=>setSimulationCount(v)}
                        className={`text-[8px] px-1.5 py-0.5 rounded font-bold transition-all ${simulationCount===v?'bg-blue-600 text-white':'bg-white/5 text-gray-500 hover:text-white'}`}>
                        {v.toLocaleString('pt-BR')} {l}
                      </button>
                    ))}
                 </div>
              </div>

              {/* ENTRAR EM */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                 <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 shrink-0">Entrar em:</span>
                    <div className="relative flex-1">
                       <button onClick={()=>setTargetDropdownOpen(!targetDropdownOpen)}
                          className="w-full flex items-center justify-between bg-[#12141c] border border-white/10 text-xs p-2 rounded-lg font-bold text-white">
                          <span className={`w-2 h-2 rounded-full mr-1.5 inline-block ${targetType==='Branco'?'bg-white':targetType==='Vermelho'?'bg-red-500':'bg-zinc-400'}`}/>
                          {targetType}
                          <ChevronLeft size={12} className={`transition-transform ${targetDropdownOpen?'rotate-90':'rotate-270'}`}/>
                       </button>
                       {targetDropdownOpen && (
                         <div className="absolute z-50 top-full mt-1 w-full bg-[#12141c] border border-white/10 rounded-lg overflow-hidden shadow-2xl">
                            {(['Branco','Vermelho','Preto'] as const).map(t=>(
                              <button key={t} onClick={()=>{setTargetType(t);setTargetDropdownOpen(false);}}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-white/10 text-left">
                                 <span className={`w-2 h-2 rounded-full ${t==='Branco'?'bg-white':t==='Vermelho'?'bg-red-500':'bg-zinc-400'}`}/>
                                 {t}
                              </button>
                            ))}
                         </div>
                       )}
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 shrink-0">Quantidade:</span>
                    <input type="number" min="1" className="flex-1 min-w-0 bg-[#12141c] border border-white/10 text-white text-xs p-1.5 rounded-lg font-bold text-center" value={entriesPerTrigger} onChange={e=>setEntriesPerTrigger(Number(e.target.value))} />
                    <span className="text-[9px] text-gray-600 shrink-0">rodadas</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 shrink-0">Valor de entrada:</span>
                    <input type="number" step="0.1" min="0.1" className="flex-1 min-w-0 bg-[#12141c] border border-[#4ade80]/30 text-[#4ade80] text-xs p-1.5 rounded-lg font-bold text-center" value={initialBet} onChange={e=>setInitialBet(Number(e.target.value))} />
                 </div>
              </div>

              {/* GALE */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                 <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Gale</label>
                 {galeConfig.map((g, i) => (
                   <div key={i} className="flex items-center gap-2">
                      <span className="text-[8px] text-gray-600 w-4">G{i+1}</span>
                      <span className="text-[8px] text-gray-600">Qtd</span>
                      <input type="number" min="1" className="w-14 bg-[#12141c] border border-white/10 text-[10px] p-1.5 rounded-lg font-bold text-center" value={g.quantity} onChange={e=>{const cfg=[...galeConfig];cfg[i].quantity=Number(e.target.value);setGaleConfig(cfg);}} />
                      <span className="text-[8px] text-gray-600">x</span>
                      <input type="number" step="0.1" min="1" className="w-14 bg-[#12141c] border border-red-500/20 text-red-400 text-[10px] p-1.5 rounded-lg font-bold text-center" value={g.multiplier} onChange={e=>{const cfg=[...galeConfig];cfg[i].multiplier=Number(e.target.value);setGaleConfig(cfg);}} />
                      <button onClick={()=>{const cfg=[...galeConfig];cfg.splice(i,1);setGaleConfig(cfg);}} className="text-gray-700 hover:text-red-500 ml-auto"><X size={12}/></button>
                   </div>
                 ))}
                 <button onClick={()=>setGaleConfig([...galeConfig,{quantity:1,multiplier:2.0}])} className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold"><Plus size={10}/> Adicionar nível</button>
              </div>

              {/* SORO */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                 <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Soro</label>
                 {soroConfig.map((g, i) => (
                   <div key={i} className="flex items-center gap-2">
                      <span className="text-[8px] text-gray-600 w-4">S{i+1}</span>
                      <span className="text-[8px] text-gray-600">Qtd</span>
                      <input type="number" min="1" className="w-14 bg-[#12141c] border border-white/10 text-[10px] p-1.5 rounded-lg font-bold text-center" value={g.quantity} onChange={e=>{const cfg=[...soroConfig];cfg[i].quantity=Number(e.target.value);setSoroConfig(cfg);}} />
                      <span className="text-[8px] text-gray-600">x</span>
                      <input type="number" step="0.1" min="1" className="w-14 bg-[#12141c] border border-green-500/20 text-green-400 text-[10px] p-1.5 rounded-lg font-bold text-center" value={g.multiplier} onChange={e=>{const cfg=[...soroConfig];cfg[i].multiplier=Number(e.target.value);setSoroConfig(cfg);}} />
                      <button onClick={()=>{const cfg=[...soroConfig];cfg.splice(i,1);setSoroConfig(cfg);}} className="text-gray-700 hover:text-red-500 ml-auto"><X size={12}/></button>
                   </div>
                 ))}
                 <button onClick={()=>setSoroConfig([...soroConfig,{quantity:1,multiplier:1.5}])} className="text-[9px] text-green-400 hover:text-green-300 flex items-center gap-1 font-bold"><Plus size={10}/> Adicionar nível</button>
              </div>

              {/* ZONA */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                 <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Zona</label>
                    <button onClick={() => setZonaEnabled(!zonaEnabled)} className={`relative w-9 h-5 rounded-full transition-all ${zonaEnabled ? 'bg-blue-600' : 'bg-gray-700'}`}>
                       <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${zonaEnabled ? 'left-4' : 'left-0.5'}`} />
                    </button>
                 </div>
                 {zonaEnabled && (
                   <>
                     <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-400 w-20 shrink-0">Quantidade:</span>
                        <input type="number" className="w-12 bg-[#12141c] border border-white/10 text-[10px] p-1.5 rounded-lg font-bold text-center" placeholder="Min" value={zonaMin} onChange={e=>setZonaMin(Number(e.target.value))} />
                        <span className="text-[9px] text-gray-600">-</span>
                        <input type="number" className="w-12 bg-[#12141c] border border-white/10 text-[10px] p-1.5 rounded-lg font-bold text-center" placeholder="Max" value={zonaMax} onChange={e=>setZonaMax(Number(e.target.value))} />
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-400 w-20 shrink-0">Histórico em:</span>
                        <input type="number" className="flex-1 bg-[#12141c] border border-white/10 text-[10px] p-1.5 rounded-lg font-bold text-center" value={zonaRange} onChange={e=>setZonaRange(Number(e.target.value))} />
                        <span className="text-[9px] text-gray-600">rodadas</span>
                     </div>
                   </>
                 )}
              </div>

              {/* CICLO */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                 <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black uppercase tracking-widest text-purple-400">Ciclo</label>
                    <button onClick={()=>setCiclosEnabled(!ciclosEnabled)} className={`relative w-9 h-5 rounded-full transition-all ${ciclosEnabled?'bg-purple-600':'bg-gray-700'}`}>
                       <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${ciclosEnabled?'left-4':'left-0.5'}`}/>
                    </button>
                 </div>
                 {ciclosEnabled && (
                   <div className="flex flex-col gap-3 pt-1 border-t border-white/5 mt-1">
                      <div className="flex flex-col gap-1.5">
                         <span className="text-[9px] text-gray-400 font-bold">Começar com ciclo:</span>
                         <div className="flex gap-1.5">
                            <button onClick={()=>setCicloStartType('green')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all border ${cicloStartType==='green'?'bg-green-600/30 border-green-500/50 text-green-400':'bg-white/5 border-white/10 text-gray-500'}`}>Verde</button>
                            <button onClick={()=>setCicloStartType('red')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all border ${cicloStartType==='red'?'bg-red-600/30 border-red-500/50 text-red-400':'bg-white/5 border-white/10 text-gray-500'}`}>Vermelho</button>
                         </div>
                         <input type="number" min="0" className="bg-[#12141c] border border-white/10 text-white text-[10px] p-1.5 rounded-lg font-bold text-center" value={winCyclesTarget} onChange={e=>setWinCyclesTarget(Number(e.target.value))} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                         <span className="text-[9px] text-gray-400 font-bold">Parar no ciclo:</span>
                         <div className="flex gap-1.5">
                            <button onClick={()=>setCicloStopType('red')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all border ${cicloStopType==='red'?'bg-red-600/30 border-red-500/50 text-red-400':'bg-white/5 border-white/10 text-gray-500'}`}>Vermelho</button>
                            <button onClick={()=>setCicloStopType('green')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all border ${cicloStopType==='green'?'bg-green-600/30 border-green-500/50 text-green-400':'bg-white/5 border-white/10 text-gray-500'}`}>Verde</button>
                         </div>
                         <input type="number" min="0" className="bg-[#12141c] border border-white/10 text-white text-[10px] p-1.5 rounded-lg font-bold text-center" value={lossCyclesStop} onChange={e=>setLossCyclesStop(Number(e.target.value))} />
                      </div>
                   </div>
                 )}
              </div>

              {/* STOP WIN / STOP LOSS */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                 <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase text-gray-500">Stop Win</label>
                    <input type="number" className="bg-[#12141c] border border-green-500/30 text-green-400 text-xs p-2 rounded-lg font-bold" value={stopWin} onChange={e=>setStopWin(Number(e.target.value))} />
                 </div>
                 <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase text-gray-500">Stop Loss</label>
                    <input type="number" className="bg-[#12141c] border border-red-500/30 text-red-400 text-xs p-2 rounded-lg font-bold" value={stopLoss} onChange={e=>setStopLoss(Number(e.target.value))} />
                 </div>
              </div>
            </div>

            <button 
              disabled={loading}
              onClick={() => {
                periodHoursRef.current = Math.ceil(simulationCount / 120);
                setHasRun(true);
                setLoading(true);
                fetchData().then(() => runSimulation(false));
              }} 
              className={`w-full ${loading ? 'bg-blue-600/50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'} text-white font-black py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center gap-3 relative overflow-hidden group mt-4`}
            >
               {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <Play size={16} />} 
               {loading ? 'Carregando Dados...' : 'Executar'}
            </button>
          </div>
        </motion.aside>

        <section className="flex-1 flex flex-col relative overflow-y-auto custom-scrollbar bg-gradient-to-br from-[#050507] via-[#0a0a0f] to-[#050507]">
          {!isSidebarOpen && (
            <button onClick={() => setIsSidebarOpen(true)} className="absolute top-4 left-4 z-40 bg-white/5 border border-white/10 p-3 rounded-full hover:bg-white/10 transition-all text-white"><Settings size={20} /></button>
          )}

          <AnimatePresence>
            {hasRun && (
              <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex gap-4 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-2xl border border-white/10 px-8 py-4 rounded-2xl flex flex-col items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                  <span className="text-[9px] font-black uppercase text-gray-500 tracking-[0.3em] mb-1">GANHO ATUAL</span>
                  <span className={`text-4xl font-black tracking-tighter ${chartView === 'global' ? (results.globalBalance >= 0 ? 'text-[#4ade80]' : 'text-[#f12c4c]') : (results.cycleBalance >= 0 ? 'text-[#4ade80]' : 'text-[#f12c4c]')}`}>
                    R$ {chartView === 'global' ? results.globalBalance.toFixed(2).replace('.', ',') : results.cycleBalance.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="bg-black/60 backdrop-blur-2xl border border-white/10 px-6 py-4 rounded-2xl flex gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                  <div className="flex flex-col"><span className="text-[8px] font-black text-[#4ade80]">GANHO MÁXIMO</span><span className="text-xl font-black text-[#4ade80]">R$ {chartView === 'global' ? results.globalMaxBalance.toFixed(2).replace('.', ',') : results.cycleMaxBalance.toFixed(2).replace('.', ',')}</span></div>
                  <div className="flex flex-col"><span className="text-[8px] font-black text-[#f12c4c]">PERCA MÁXIMA</span><span className="text-xl font-black text-[#f12c4c]">R$ {chartView === 'global' ? results.globalMinBalance.toFixed(2).replace('.', ',') : results.cycleMinBalance.toFixed(2).replace('.', ',')}</span></div>
                  <div className="w-px bg-white/10 mx-2"></div>
                  <div className="flex flex-col"><span className="text-[8px] font-black text-gray-500">WINS</span><span className="text-xl font-black text-[#4ade80]">{chartView === 'global' ? results.globalWins : results.cycleWins}</span></div>
                  <div className="flex flex-col"><span className="text-[8px] font-black text-gray-500">LOSSES</span><span className="text-xl font-black text-[#f12c4c]">{chartView === 'global' ? results.globalLosses : results.cycleLosses}</span></div>
                  <div className="flex flex-col"><span className="text-[8px] font-black text-gray-500">MÁX GALE</span><span className="text-xl font-black text-purple-400">G{chartView === 'global' ? results.globalMaxGale : results.cycleMaxGale}</span></div>
                  <div className="w-px bg-white/10 mx-2"></div>
                  <div className="flex flex-col"><span className="text-[8px] font-black text-green-500">STOP WINS</span><span className="text-xl font-black text-green-400">{results.stopWinsHit}</span></div>
                  <div className="flex flex-col"><span className="text-[8px] font-black text-red-500">STOPS LOSS</span><span className="text-xl font-black text-red-400">{results.stopLossesHit}</span></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-28 px-12 flex justify-between items-end">
            <div className="flex flex-col">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full animate-pulse ${chartView === 'global' ? 'bg-[#f12c4c]' : 'bg-blue-500'}`}></div>
                {chartView === 'global' ? 'Mercado Global' : 'Ciclo Estratégico'}
              </h3>
              <p className="text-xs text-gray-500 font-medium">Histórico de {simulationCount.toLocaleString('pt-BR')} pedras processado (~{Math.ceil(simulationCount/120)}h)</p>
            </div>
            
            {hasRun && (
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                <button onClick={() => setChartView('global')} className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${chartView === 'global' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>GLOBAL</button>
                <button onClick={() => setChartView('cycle')} className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${chartView === 'cycle' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>CICLO</button>
              </div>
            )}
          </div>

          <div className="h-[400px] flex-shrink-0 px-8 pb-8 mt-6">
            <div className="h-full w-full bg-black/20 rounded-[2rem] border border-white/5 overflow-hidden relative shadow-inner">
              <LineChart 
                data={chartView === 'global' ? results.globalHistory : results.cycleHistory} 
                markers={chartView === 'global' ? results.markers : []}
                color={chartView === 'global' ? (results.globalBalance >= 0 ? "#4ade80" : "#f12c4c") : (results.cycleBalance >= 0 ? "#3b82f6" : "#f12c4c")} 
              />
            </div>
          </div>

          <div className="px-8 pb-12">
            <div className="bg-[#0a0a0f] border border-white/5 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-sm font-black uppercase text-white flex items-center gap-2"><List size={16} className="text-blue-500" /> Histórico de Execução (Novos Primeiro)</h4>
                <div className="flex gap-4 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-red-500 rounded-full border border-white shadow-sm"></div> Gatilho</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 border-2 border-red-500 rounded-lg"></div> Busca (Loss)</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 border-2 border-green-500 rounded-lg"></div> Vitória (Win)</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 border-2 border-blue-500 rounded-lg"></div> Ciclo Fictício</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 max-h-[600px] overflow-y-auto custom-scrollbar p-2">
                {results.simulationHistory.length > 0 ? (
                  [...results.simulationHistory].reverse().slice(0, historyLimit).map((item, idx) => {
                    const n = parseInt(item.roll.roll as string);
                    const ts = item.roll.timestamp ? new Date(item.roll.timestamp).getTime() : Date.now();
                    const dt = new Date(ts);
                    const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

                    let borderClass = 'border-white/5';
                    let ringClass = '';
                    if (item.isVirtual) {
                      borderClass = 'border-blue-500/50 opacity-50';
                      ringClass = 'ring-1 ring-blue-500 border-dashed';
                    } else if (item.isWin) {
                      borderClass = 'border-green-500/50';
                      ringClass = 'ring-1 ring-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]';
                    } else if (item.isEntry) {
                      borderClass = 'border-red-500/50';
                      ringClass = 'ring-1 ring-red-500';
                    }

                    return (
                      <div key={idx} className="relative group shrink-0">
                        <div className={`flex flex-col items-center shrink-0 w-[54px] pt-1 pb-1.5 px-0.5 gap-[3px] bg-[#12141c]/80 rounded-lg border ${borderClass} ${ringClass}`}>
                          <div className="flex justify-center w-full relative z-0 pointer-events-none mb-0.5 mt-0.5">
                             <GlobalStoneIcon n={n} size="lg" />
                          </div>
                          
                          <div className="flex flex-col items-center w-full relative z-0 pointer-events-none gap-0.5">
                             <span className="text-center whitespace-nowrap text-[9px] font-black tracking-widest leading-none text-white">
                                {timeStr}
                             </span>
                             {item.isEntry && (
                               <>
                                 <span className={`text-[8px] font-bold ${item.isVirtual ? 'text-blue-400' : (item.pnl >= 0 ? 'text-[#4ade80]' : 'text-[#f12c4c]')}`}>
                                    {item.isVirtual ? 'FICTÍCIO' : `R$ ${item.pnl.toFixed(2)}`}
                                 </span>
                                 <span className="text-[8px] font-black text-gray-400">
                                    E{entriesPerTrigger - (item.remainingEntries || 0)} {item.isVirtual ? '' : (item.isSoro ? 'S1' : `G${item.galeLevel}`)}
                                 </span>
                               </>
                             )}
                          </div>
                        </div>
                        {item.isTrigger && (
                           <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-[#0a0a0f] shadow-[0_0_10px_rgba(239,68,68,0.8)] z-10 animate-pulse"></div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full py-20 flex flex-col items-center opacity-30">
                    <Play size={48} className="mb-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Execute a simulação para ver o histórico</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}