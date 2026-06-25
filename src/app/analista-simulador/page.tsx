"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, Bell, Volume2, VolumeX, Search, Zap, X, ChevronRight, List, RefreshCw, Play, Clock } from "lucide-react";
import Link from "next/link";
import { GlobalStoneIcon } from '@/components/GlobalStoneIcon';
import { LiveHistoryCard } from '@/components/LiveHistoryCard';

// Types
interface Roll {
  id: string;
  color: string;
  roll: string;
  timestamp?: string;
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
  pa?: number;
  pm?: number;
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


const DualSlider = ({ range, setRange, min = 1, max = 30, title = "🎯 Faixa de Entradas", labelLeft = "1 Entr", labelRight = "30 Entr", formatRange = (r: [number, number]) => `${r[0]} até ${r[1]}` }: any) => {
    const getPercent = (value: number) => Math.round(((value - min) / (max - min)) * 100);

    return (
      <div className="flex flex-col gap-2 mt-2 border-t border-white/5 pt-4 mb-2">
        <label className="text-[10px] text-blue-400 uppercase font-black tracking-widest flex items-center justify-between">
          <span>{title}</span>
          <span className="text-white">{formatRange(range)}</span>
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
          <span>{labelLeft}</span>
          <span>{labelRight}</span>
        </div>
      </div>
    );
};

export default function AnalistaSimulador() {
  const [data, setData] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(false);
    const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [simTotal, setSimTotal] = useState(0);
  const [simScore, setSimScore] = useState({ wins: 0, losses: 0, currentSa: 0, maxSa: 0, triggers: 0 });
  const [cycleHistory, setCycleHistory] = useState<{type: 'W'|'L', count: number}[]>([]);
  const [simulationDays, setSimulationDays] = useState(1);
  const [trainingWindowHours, setTrainingWindowHours] = useState(24);
  const [daysToFetch, setDaysToFetch] = useState(3);
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
  const [patternType, setPatternType] = useState('TODOS'); 
    const [targetFocus, setTargetFocus] = useState('Branco'); 
    const [coverWhite, setCoverWhite] = useState(true);
    const [continuousRead, setContinuousRead] = useState(false);
    const [useWildcards, setUseWildcards] = useState(false);
    const [maxWildcards, setMaxWildcards] = useState(1);
  
  const [minTriggers, setMinTriggers] = useState(5);
  const [minWinRate, setMinWinRate] = useState(90);
  const [maxSa, setMaxSa] = useState(2);
  const [minSaFilter, setMinSaFilter] = useState(0);
  const [minPaFilter, setMinPaFilter] = useState(0);
  const [sortBy, setSortBy] = useState('WINRATE');
  const [sizeRange, setSizeRange] = useState<[number, number]>([3, 5]);
  
  // Live Monitor
  const [liveMode, setLiveMode] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [refreshMinutes, setRefreshMinutes] = useState(5);
  const [timeLeft, setTimeLeft] = useState(0);
  const [alertThreshold, setAlertThreshold] = useState(1);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
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
    const config = { lossMode, entriesRange, periodHours, patternType, targetFocus, coverWhite, continuousRead, useWildcards, maxWildcards, minTriggers, minWinRate, maxSa, minSaFilter, minPaFilter, sizeRange };
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
    
    if (config.coverWhite !== undefined) setCoverWhite(config.coverWhite);
    if (config.continuousRead !== undefined) setContinuousRead(config.continuousRead);
    if (config.useWildcards !== undefined) setUseWildcards(config.useWildcards);
    if (config.maxWildcards !== undefined) setMaxWildcards(config.maxWildcards);
    if (config.minTriggers) setMinTriggers(config.minTriggers);
    if (config.minWinRate !== undefined) setMinWinRate(config.minWinRate);
    if (config.maxSa !== undefined) setMaxSa(config.maxSa);
    if (config.minSaFilter !== undefined) setMinSaFilter(config.minSaFilter);
    if (config.minPaFilter !== undefined) setMinPaFilter(config.minPaFilter);
    if (config.sizeRange !== undefined) setSizeRange(config.sizeRange);
    setShowPresetsMenu(false);
  };
  
  // State
  const [discovered, setDiscovered] = useState<DiscoveredPattern[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const lastProcessedId = useRef<string | null>(null);

  const [globalScore, setGlobalScore] = useState({ wins: 0, losses: 0, currentSa: 0, maxSa: 0 });
  const [whiteScore, setWhiteScore] = useState({ wins: 0, losses: 0, currentSa: 0, maxSa: 0 });
  const [showWhiteScore, setShowWhiteScore] = useState(false);
  const lastScoreboardRollId = useRef<string | null>(null);

  const [isMixedMining, setIsMixedMining] = useState(false);
  const [mixedProgress, setMixedProgress] = useState(0);
  const [mixedTotal, setMixedTotal] = useState(0);
  const [useMixedMining, setUseMixedMining] = useState(false);

  // Quick Trend State
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [trendHours, setTrendHours] = useState(2);
  const [trendTarget, setTrendTarget] = useState('Vermelho');
  const [trendMaxEntries, setTrendMaxEntries] = useState(12);
  const [trendMinWinRate, setTrendMinWinRate] = useState(80);
  const [isTrending, setIsTrending] = useState(false);
  const [trendResult, setTrendResult] = useState<TrendResult[] | null>(null);

  const [showExportModal, setShowExportModal] = useState(false);

  

  const getTargetEmoji = (target: string) => {
    if (target === 'Branco') return '⚪';
    if (target === 'Vermelho') return '🔴';
    return '⚫️';
  };

  const formatPatternList = () => {
    return [...discovered].sort((a, b) => {
      if (a.activeNow && !b.activeNow) return -1;
      if (!a.activeNow && b.activeNow) return 1;
      if (sortBy === 'SA') return b.sa - a.sa;
      if (sortBy === 'PA') return (b.pa || 0) - (a.pa || 0);
      return parseFloat(b.winRate) - parseFloat(a.winRate);
    }).map(pat => {
      const hasNumbers = pat.elements.some(el => el.t === 'n');
      const patternStr = pat.elements.map(el => {
        const isWhite = el.t === 'c' ? el.v === 'B' : el.v === '0';
        if (el.t === 'c' || isWhite) {
          if (el.v === 'V') return '🔴';
          if (el.v === 'P') return '⚫️';
          if (el.v === 'DUAL') return '🌗';
          if (el.v === 'TRI') return '🔀';
          return '⚪';
        }
        return el.v;
      }).join(hasNumbers ? ' ' : '');

      const targetEmoji = getTargetEmoji(targetFocus);
      const galeLabel = `g${(pat.entries || entriesRange[1]) - 1}`;
      
      const targetStr = coverWhite && targetFocus !== 'Branco' ? `${targetEmoji} + ⚪` : targetEmoji;

      return `${patternStr} = ${targetStr} ${galeLabel}`;
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

    const startSimulation = async () => {
    setLoading(true);
    setSimulating(true);
    setDiscovered([]);
    setSimScore({ wins: 0, losses: 0, currentSa: 0, maxSa: 0, triggers: 0 });
    setCycleHistory([]);
    setSimProgress(0);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const totalHoursToFetch = (simulationDays * 24) + trainingWindowHours;
      const res = await fetch(`/api/results/period?hours=${totalHoursToFetch}`); 
      if (!res.ok) return;
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        const mappedData = [...json.data].reverse().map((r: any) => ({ 
          ...r, 
          color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(), 
          roll: r.roll?.toString() 
        }));
        
        setData(mappedData);
        const config = { lossMode, entriesRange, periodHours: trainingWindowHours, patternType, targetFocus, coverWhite, continuousRead, useWildcards, maxWildcards, minTriggers, minWinRate, maxSa, minSaFilter, minPaFilter, sizeRange, useMixedMining };
        setAppliedFilters(config);
        
        runTimeMachine(config, mappedData);
      }
    } catch (err) { 
      console.error(err);
      alert("Erro na simulação.");
      setSimulating(false);
    } finally { 
      setLoading(false);
    }
  };

  const fetchData = async () => {}; // Desabilitado


  useEffect(() => {
    // Simulador não escuta SSE
  }, []);

  
  const runTimeMachine = (config: any, fullData: Roll[]) => {
      const { periodHours, targetFocus, coverWhite, entriesRange, minTriggers, minWinRate, maxSa, minSaFilter, minPaFilter } = config;
      const totalHours = (simulationDays * 24) + periodHours;
      const trainingRecords = Math.floor(fullData.length * (periodHours / Math.max(1, totalHours)));
      const simulationRecords = fullData.length - trainingRecords;
      
      let startIdx = 0;
      
      let T = startIdx + trainingRecords;
      setSimTotal(fullData.length - T);
      
      let currentScore = { wins: 0, losses: 0, currentSa: 0, maxSa: 0, triggers: 0 };
      let localCycleHistory: {type: 'W'|'L', count: number}[] = [];
      let pendingBets: { startIdx: number, entriesLeft: number, target: string, id: string }[] = [];
      
      let activeValidPatterns: any[] = [];
      
      const step = () => {
         if (T >= fullData.length) {
            setSimulating(false);
            return;
         }
         
         // 1. Evaluate pending bets using fullData[T]
         const roll = fullData[T];
         let newlyResolved = false;
         
         const newPending = [];
         for (const bet of pendingBets) {
             const isWin = evaluateHit(roll, bet.target, coverWhite);
             if (isWin) {
                 currentScore.wins++;
                 currentScore.currentSa = 0;
                 if (localCycleHistory.length > 0 && localCycleHistory[localCycleHistory.length - 1].type === 'W') {
                     localCycleHistory[localCycleHistory.length - 1].count++;
                 } else {
                     localCycleHistory.push({ type: 'W', count: 1 });
                 }
                 newlyResolved = true;
             } else {
                 bet.entriesLeft--;
                 if (bet.entriesLeft > 0) {
                     newPending.push(bet);
                 } else {
                     currentScore.losses++;
                     currentScore.currentSa++;
                     if (currentScore.currentSa > currentScore.maxSa) currentScore.maxSa = currentScore.currentSa;
                     if (localCycleHistory.length > 0 && localCycleHistory[localCycleHistory.length - 1].type === 'L') {
                         localCycleHistory[localCycleHistory.length - 1].count++;
                     } else {
                         localCycleHistory.push({ type: 'L', count: 1 });
                     }
                     newlyResolved = true;
                 }
             }
         }
         pendingBets = newPending;

         // 2. Refresh patterns every 10 rounds (~5 minutes) to save CPU
         if (T % 10 === 0 || activeValidPatterns.length === 0) {
             const windowData = fullData.slice(T - trainingRecords, T);
             // We run a fast scan! To not freeze, we do a quick Entradas check
             // In reality, doing the full runFullDiscoveryEntrada here is what Analista does.
             // We can use the logic directly here but simplified.
             activeValidPatterns = runFastDiscovery(config, windowData);
             setDiscovered(activeValidPatterns); // Show what the AI "sees" right now!
         }

         // 3. Check for new triggers from activeValidPatterns
         // If fullData[T] completes a pattern, queue a bet!
         let triggerFound = false;
         let triggeredTarget = targetFocus;
         let maxEntriesTriggered = 0;
         
         for (const pat of activeValidPatterns) {
             let isMatch = true;
             const patLen = pat.elements.length;
             for (let p = 0; p < patLen; p++) {
                 const pastRoll = fullData[T - patLen + 1 + p];
                 const el = pat.elements[p];
                 if (el.t === 'c') {
                    const c = getCol(pastRoll);
                    if (!(el.v === 'TRI' || (el.v === 'DUAL' && c !== 'B') || c === el.v)) { isMatch = false; break; }
                 } else {
                    if (pastRoll.roll !== el.v) { isMatch = false; break; }
                 }
             }
             if (isMatch) {
                 triggerFound = true;
                 triggeredTarget = pat.target || targetFocus;
                 if (pat.entries > maxEntriesTriggered) {
                     maxEntriesTriggered = pat.entries;
                 }
             }
         }
         
         if (triggerFound) {
             if (pendingBets.length > 0) {
                 const currentBet = pendingBets[0];
                 if (currentBet.target === triggeredTarget) {
                     if (maxEntriesTriggered > currentBet.entriesLeft) {
                         currentBet.entriesLeft = maxEntriesTriggered;
                     }
                 }
             } else {
                 currentScore.triggers++;
                 pendingBets.push({ startIdx: T, entriesLeft: maxEntriesTriggered, target: triggeredTarget, id: 'BET_'+T });
             }
         }

         // UI Updates
         if (T % 5 === 0 || newlyResolved) {
             setSimScore({ ...currentScore });
             setCycleHistory([...localCycleHistory]);
             setSimProgress(T - trainingRecords);
         }
         
         T++;
         setTimeout(step, 0); // Next step
      };
      
      step();
  };

  const runFastDiscovery = (config: any, windowData: Roll[]) => {
      const { patternType, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, sizeRange, coverWhite = true, useWildcards, maxWildcards } = config;
      const [minEntries, maxEntries] = entriesRange || [1, 5];
      const patternState: Record<string, any> = {};
      const activeKeys = new Set<string>();
      
      const discoveryTargets = targetFocus === 'Ambos' ? ['Vermelho', 'Preto'] : [targetFocus];
      const typesToTest = patternType === 'TODOS' 
        ? ['ONLY_COLORS', 'ONLY_NUMBERS', 'COLORS_1_NUM', 'COLORS_2_NUM', '1_NUM_COLORS', '2_NUM_COLORS'] 
        : [patternType];
      
      for (let i = 0; i < windowData.length; i++) {
          for (const key of activeKeys) {
            const state = patternState[key];
            let anyActive = false;
            for (let e = minEntries; e <= maxEntries; e++) {
                const eState = state.entriesData[e];
                if (eState.activeEntriesLeft > 0) {
                    anyActive = true;
                    const isWin = evaluateHit(windowData[i], state.target, coverWhite);
                    if (isWin) {
                        eState.wins++;
                        eState.currentSa = 0;
                        eState.activeEntriesLeft = 0;
                    } else {
                        eState.activeEntriesLeft--;
                        eState.currentSa++;
                        if (eState.currentSa > eState.sm) eState.sm = eState.currentSa;
                    }
                }
            }
            if (!anyActive) activeKeys.delete(key);
          }
          
          for (const target of discoveryTargets) {
            for (const type of typesToTest) {
              for (let totalLen = sizeRange[0]; totalLen <= sizeRange[1]; totalLen++) {
                  const startIdx = i - totalLen + 1;
                  if (startIdx < 0) continue;
                  
                  const elements: PatternElement[] = [];
                  if (type === 'ONLY_COLORS') {
                    for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(windowData[startIdx+p])});
                  } else if (type === 'ONLY_NUMBERS') {
                    for(let p=0; p<totalLen; p++) elements.push(getNumNode(windowData[startIdx+p].roll));
                  } else if (type === 'COLORS_1_NUM') {
                    for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(windowData[startIdx+p])});
                    elements.push(getNumNode(windowData[i].roll));
                  } else if (type === 'COLORS_2_NUM') {
                    if (totalLen < 2) continue;
                    for(let p=0; p<totalLen-2; p++) elements.push({t:'c', v: getCol(windowData[startIdx+p])});
                    elements.push(getNumNode(windowData[i-1].roll));
                    elements.push(getNumNode(windowData[i].roll));
                  } else if (type === '1_NUM_COLORS') {
                    elements.push(getNumNode(windowData[startIdx].roll));
                    for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(windowData[startIdx+p])});
                  } else if (type === '2_NUM_COLORS') {
                    if (totalLen < 2) continue;
                    elements.push(getNumNode(windowData[startIdx].roll));
                    elements.push(getNumNode(windowData[startIdx+1].roll));
                    for(let p=2; p<totalLen; p++) elements.push({t:'c', v: getCol(windowData[startIdx+p])});
                  }
                  
                  if (elements.length === 0) continue;
                  if (patternType !== 'ONLY_NUMBERS' && elements.some(e => e.t === 'n' && e.v === '0')) continue;
                  
                  const variations = generateWildcardVariations(elements, useWildcards, maxWildcards);
                  for (const varElements of variations) {
                      const key = target + ':' + varElements.map(e => e.t + e.v).join('|');
                      if (!patternState[key]) {
                          patternState[key] = { type, target, elements: varElements, entriesData: {} };
                          for (let e = minEntries; e <= maxEntries; e++) {
                              patternState[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, activeEntriesLeft: 0 };
                          }
                      }
                      
                      for (let e = minEntries; e <= maxEntries; e++) {
                          if (patternState[key].entriesData[e].activeEntriesLeft > 0) continue;
                          patternState[key].entriesData[e].triggers++;
                          patternState[key].entriesData[e].activeEntriesLeft = e;
                      }
                      activeKeys.add(key);
                  }
              }
            }
          }
      }
      
      const results: any[] = [];
      Object.entries(patternState).forEach(([k, v]) => {
         for (let e = minEntries; e <= maxEntries; e++) {
             const eState = v.entriesData[e];
             const wr = ((eState.wins / (eState.triggers || 1)) * 100).toFixed(1);
             if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.sm <= maxSa && eState.currentSa >= minSaFilter) {
                results.push({
                   id: k + '|ENT_' + e, entries: e, type: v.type, elements: v.elements, winRate: wr, count: eState.wins, triggers: eState.triggers, sa: eState.currentSa, sm: eState.sm, target: v.target
                });
             }
         }
      });
      
      // Return ALL patterns that pass the filter so we don't miss signals
      return results.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate)); 
  };

  const getCol = (r: Roll) => {
    if (!r) return 'B';
    const n = parseInt(r.roll);
    if (r.color.includes('Vermelho') || (n >= 1 && n <= 7)) return 'V';
    if (r.color.includes('Preto') || (n >= 8 && n <= 14)) return 'P';
    return 'B';
  };

  const getNumNode = (rollStr: string): PatternElement => rollStr === '0' ? { t: 'c', v: 'B' } : { t: 'n', v: rollStr };

  const generateWildcardVariations = (baseElements: PatternElement[], useWildcards: boolean, maxWildcards: number): PatternElement[][] => {
    if (!useWildcards) return [baseElements];
    const results: PatternElement[][] = [baseElements];

    const generate = (current: PatternElement[], index: number, wildcardsUsed: number) => {
        if (index === baseElements.length) {
            if (wildcardsUsed > 0) results.push([...current]);
            return;
        }

        const el = baseElements[index];

        current.push(el);
        generate(current, index + 1, wildcardsUsed);
        current.pop();

        if (wildcardsUsed < maxWildcards && index > 0 && index < baseElements.length - 1 && el.t === 'c') {
            if (el.v !== 'B') {
                current.push({ t: 'c', v: 'DUAL' });
                generate(current, index + 1, wildcardsUsed + 1);
                current.pop();
            }

            current.push({ t: 'c', v: 'TRI' });
            generate(current, index + 1, wildcardsUsed + 1);
            current.pop();
        }
    };

    generate([], 0, 0);
    return results;
  };

  const evaluateHit = (rollObj: Roll, target: string, coverWhite: boolean = true) => {
    if (!rollObj) return false;
    const n = parseInt(rollObj.roll);
    const isBranco = n === 0 || rollObj.color.includes('Branco');
    const isVermelho = rollObj.color.includes('Vermelho') || (n >= 1 && n <= 7);
    const isPreto = rollObj.color.includes('Preto') || (n >= 8 && n <= 14);

    const t = target.toUpperCase();
    if (t === 'BRANCO' || t === 'BCO') return isBranco;
    if (t === 'VERMELHO' || t === 'V') return isVermelho || (coverWhite && isBranco);
    if (t === 'PRETO' || t === 'P') return isPreto || (coverWhite && isBranco);
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
      const { periodHours, patternType, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, sizeRange, coverWhite = true, continuousRead = false } = config;
      const [minEntries, maxEntries] = entriesRange || [1, 5];
      const history = currentData.slice(-periodHours * 120);
      const patternMap: Record<string, any> = {};
      
      const typesToTest = patternType === 'TODOS' 
        ? ['ONLY_COLORS', 'ONLY_NUMBERS', 'COLORS_1_NUM', 'COLORS_2_NUM', '1_NUM_COLORS', '2_NUM_COLORS'] 
        : [patternType];

      const discoveryTargets = targetFocus === 'Ambos' ? ['Vermelho', 'Preto'] : [targetFocus];

      for (const target of discoveryTargets) {
        for (const type of typesToTest) {
          let sizes: number[] = [];
          for (let s = sizeRange[0]; s <= sizeRange[1]; s++) sizes.push(s);

          for (const totalLen of sizes) {
            for (let i = 0; i <= history.length - totalLen; i++) {
              const elements: PatternElement[] = [];
              if (type === 'ONLY_COLORS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              } else if (type === 'ONLY_NUMBERS') {
                for(let p=0; p<totalLen; p++) elements.push(getNumNode(history[i+p].roll));
              } else if (type === 'COLORS_1_NUM') {
                for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(history[i+p])});
                elements.push(getNumNode(history[i+totalLen-1].roll));
              } else if (type === 'COLORS_2_NUM') {
                if (totalLen < 2) continue;
                for(let p=0; p<totalLen-2; p++) elements.push({t:'c', v: getCol(history[i+p])});
                elements.push(getNumNode(history[i+totalLen-2].roll));
                elements.push(getNumNode(history[i+totalLen-1].roll));
              } else if (type === '1_NUM_COLORS') {
                elements.push(getNumNode(history[i].roll));
                for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              } else if (type === '2_NUM_COLORS') {
                if (totalLen < 2) continue;
                elements.push(getNumNode(history[i].roll));
                elements.push(getNumNode(history[i+1].roll));
                for(let p=2; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              }

              if (elements.length === 0) continue;
              if (patternType !== 'ONLY_NUMBERS' && elements.some(e => e.t === 'n' && e.v === '0')) continue;

              const variations = generateWildcardVariations(elements, useWildcards, maxWildcards);
              for (const varElements of variations) {
                const key = target + ':' + varElements.map(e => e.t + e.v).join('|');
                if (!patternMap[key]) {
                    patternMap[key] = { elements: varElements, type, target, entriesData: {} };
                    for (let e = minEntries; e <= maxEntries; e++) {
                        patternMap[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, maxSa: 0, pa: 0, pm: 0, nextAllowedIdx: 0 };
                    }
                }
                
                for (let e = minEntries; e <= maxEntries; e++) {
                    if (i + totalLen - 1 + e >= history.length) continue;
                    if (!continuousRead && i < patternMap[key].entriesData[e].nextAllowedIdx) continue;

                    patternMap[key].entriesData[e].triggers++;
                    if (!continuousRead) {
                        patternMap[key].entriesData[e].nextAllowedIdx = i + e + 1;
                    }
                    
                    let hit = false;
                    for (let w = 1; w <= e; w++) {
                      const nxt = history[i + totalLen - 1 + w];
                      if (evaluateHit(nxt, target, coverWhite)) { hit = true; break; }
                    }
                    
                    if (hit) {
                      patternMap[key].entriesData[e].wins++;
                      patternMap[key].entriesData[e].currentSa = 0;
                      patternMap[key].entriesData[e].pa++;
                      if (patternMap[key].entriesData[e].pa > patternMap[key].entriesData[e].pm) patternMap[key].entriesData[e].pm = patternMap[key].entriesData[e].pa;
                    } else {
                      patternMap[key].entriesData[e].currentSa++;
                      patternMap[key].entriesData[e].pa = 0;
                      if (patternMap[key].entriesData[e].currentSa > patternMap[key].entriesData[e].maxSa) {
                          patternMap[key].entriesData[e].maxSa = patternMap[key].entriesData[e].currentSa;
                      }
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
             if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.maxSa <= maxSa && eState.currentSa >= minSaFilter && eState.pa >= minPaFilter) {
                results.push({
                   id: k + '|ENT_' + e, lossMode: 'CICLO',
                   entries: e,
                   type: v.type, elements: v.elements, winRate: wr, count: eState.wins,
                   triggers: eState.triggers, sa: eState.currentSa, sm: eState.maxSa, pa: eState.pa, pm: eState.pm, activeNow: false, target: v.target
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
             if (el.t === 'c') { 
               const c = getCol(r);
               if (!(el.v === 'TRI' || (el.v === 'DUAL' && c !== 'B') || c === el.v)) { isMatch = false; break; } 
             } else { if (r.roll !== el.v) { isMatch = false; break; } }
           }
           if (isMatch) {
             let alreadyHit = false;
             for (let check = 1; check <= step; check++) {
                 if (evaluateHit(currentData[patternStartIdx + pat.elements.length - 1 + check], pat.target || targetFocus, coverWhite)) {
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
        if (liveMode) playAlert();
        
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
      const { periodHours, patternType, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, sizeRange, coverWhite = true } = config;
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
                
                if (!continuousRead && eState.cooldown > 0) {
                    eState.cooldown--;
                    anyActive = true;
                }

                if (eState.activeEntriesLeft > 0) {
                    anyActive = true;
                    const isWin = evaluateHit(history[i], state.target, coverWhite);
                    if (isWin) {
                        eState.wins++;
                        eState.currentSa = 0;
                        eState.pa++;
                        if (eState.pa > eState.pm) eState.pm = eState.pa;
                        if (!continuousRead) {
                            eState.cooldown = eState.activeEntriesLeft - 1;
                        }
                        eState.activeEntriesLeft = 0;
                    } else {
                        eState.activeEntriesLeft--;
                        eState.currentSa++;
                        eState.pa = 0;
                        if (eState.currentSa > eState.sm) eState.sm = eState.currentSa;
                    }
                }
            }
            if (!anyActive) activeKeys.delete(key);
        }
        
        for (const target of discoveryTargets) {
          for (const type of typesToTest) {
            let sizes: number[] = [];
            for (let s = sizeRange[0]; s <= sizeRange[1]; s++) sizes.push(s);

            for (const totalLen of sizes) {
              const startIdx = i - totalLen + 1;
              if (startIdx < 0) continue;
              
              const elements: PatternElement[] = [];
              if (type === 'ONLY_COLORS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
              } else if (type === 'ONLY_NUMBERS') {
                for(let p=0; p<totalLen; p++) elements.push(getNumNode(history[startIdx+p].roll));
              } else if (type === 'COLORS_1_NUM') {
                for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                elements.push(getNumNode(history[i].roll));
              } else if (type === 'COLORS_2_NUM') {
                if (totalLen < 2) continue;
                for(let p=0; p<totalLen-2; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                elements.push(getNumNode(history[i-1].roll));
                elements.push(getNumNode(history[i].roll));
              } else if (type === '1_NUM_COLORS') {
                elements.push(getNumNode(history[startIdx].roll));
                for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
              } else if (type === '2_NUM_COLORS') {
                if (totalLen < 2) continue;
                elements.push(getNumNode(history[startIdx].roll));
                elements.push(getNumNode(history[startIdx+1].roll));
                for(let p=2; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
              }

              if (elements.length === 0) continue;
              if (patternType !== 'ONLY_NUMBERS' && elements.some(e => e.t === 'n' && e.v === '0')) continue;

              const variations = generateWildcardVariations(elements, useWildcards, maxWildcards);
              for (const varElements of variations) {
                const key = target + ':' + varElements.map(e => e.t + e.v).join('|');
                if (!patternState[key]) {
                    patternState[key] = { type, target, elements: varElements, entriesData: {} };
                    for (let e = minEntries; e <= maxEntries; e++) {
                        patternState[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, pa: 0, pm: 0, activeEntriesLeft: 0, cooldown: 0 };
                    }
                }
                
                for (let e = minEntries; e <= maxEntries; e++) {
                    if (!continuousRead && (patternState[key].entriesData[e].activeEntriesLeft > 0 || patternState[key].entriesData[e].cooldown > 0)) {
                        continue;
                    }

                    patternState[key].entriesData[e].triggers++;
                    patternState[key].entriesData[e].activeEntriesLeft = e;
                }
                activeKeys.add(key);
              }
          }
        }
      }
      }
      
      const results: DiscoveredPattern[] = [];
      Object.entries(patternState).forEach(([k, v]) => {
         for (let e = minEntries; e <= maxEntries; e++) {
             const eState = v.entriesData[e];
             const wr = ((eState.wins / (eState.triggers || 1)) * 100).toFixed(1);
             if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.sm <= maxSa && eState.currentSa >= minSaFilter && eState.pa >= minPaFilter) {
                results.push({
                   id: k + '|ENT_' + e, lossMode: 'ENTRADA',
                   entries: e,
                   type: v.type, elements: v.elements, winRate: wr, count: eState.wins,
                   triggers: eState.triggers, sa: eState.currentSa, sm: eState.sm, pa: eState.pa, pm: eState.pm, activeNow: eState.activeEntriesLeft > 0, target: v.target,
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
        if (liveMode) playAlert();
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
    
    const { periodHours, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, patternType, coverWhite = true, continuousRead = false } = config;
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
                
                if (!continuousRead && eState.cooldown > 0) {
                    eState.cooldown--;
                    anyActive = true;
                }

                if (eState.activeEntriesLeft > 0) {
                    anyActive = true;
                    const isWin = evaluateHit(history[i], state.target, coverWhite);
                    if (isWin) {
                        eState.wins++;
                        eState.currentSa = 0;
                        eState.pa++;
                        if (eState.pa > eState.pm) eState.pm = eState.pa;
                        if (!continuousRead) {
                            eState.cooldown = eState.activeEntriesLeft - 1;
                        }
                        eState.activeEntriesLeft = 0;
                    } else {
                        eState.activeEntriesLeft--;
                        eState.currentSa++;
                        eState.pa = 0;
                        if (eState.currentSa > eState.sm) eState.sm = eState.currentSa;
                    }
                }
            }
            if (!anyActive) activeKeys.delete(key);
        }

        for (const target of discoveryTargets) {
          for (const totalLen of sizes) {
            const startIdx = i - totalLen + 1;
            if (startIdx < 0) continue;
            const processedKeysForIndex = new Set<string>();
            
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
                    elements.push(getNumNode(rollObj.roll));
                  }
                }
                
                if (hasZeroAsNum && patternType !== 'ONLY_NUMBERS') continue;
                
                const variations = generateWildcardVariations(elements, useWildcards, maxWildcards);
                for (const varElements of variations) {
                  const key = target + ':MIXED:' + varElements.map(e => e.t + e.v).join('|');
                  if (processedKeysForIndex.has(key)) continue;
                  processedKeysForIndex.add(key);

                  if (!patternState[key]) {
                    patternState[key] = { type: 'MIXED', target, elements: varElements, entriesData: {} };
                    for (let e = minEntries; e <= maxEntries; e++) {
                        patternState[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, pa: 0, pm: 0, activeEntriesLeft: 0, cooldown: 0 };
                    }
                  }
                  
                  for (let e = minEntries; e <= maxEntries; e++) {
                      if (!continuousRead && (patternState[key].entriesData[e].activeEntriesLeft > 0 || patternState[key].entriesData[e].cooldown > 0)) {
                          continue;
                      }
                      patternState[key].entriesData[e].triggers++;
                      patternState[key].entriesData[e].activeEntriesLeft = e;
                  }
                  activeKeys.add(key);
                }
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
                  for(let p=0; p<totalLen; p++) elements.push(getNumNode(history[startIdx+p].roll));
                } else if (type === 'COLORS_1_NUM') {
                  for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                  elements.push(getNumNode(history[i].roll));
                } else if (type === 'COLORS_2_NUM') {
                  if (totalLen < 4) continue;
                  for(let p=0; p<totalLen-2; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                  elements.push(getNumNode(history[i-1].roll));
                  elements.push(getNumNode(history[i].roll));
                } else if (type === '1_NUM_COLORS') {
                  elements.push(getNumNode(history[startIdx].roll));
                  for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                } else if (type === '2_NUM_COLORS') {
                  if (totalLen < 4) continue;
                  elements.push(getNumNode(history[startIdx].roll));
                  elements.push(getNumNode(history[startIdx+1].roll));
                  for(let p=2; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                }

                if (elements.length === 0) continue;
                if (patternType !== 'ONLY_NUMBERS' && elements.some(e => e.t === 'n' && e.v === '0')) continue;

                const key = target + ':' + type + ':' + elements.map(e => e.t + e.v).join('|');
                if (!patternState[key]) {
                  patternState[key] = { type, target, elements, entriesData: {} };
                  for (let e = minEntries; e <= maxEntries; e++) {
                      patternState[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, pa: 0, pm: 0, activeEntriesLeft: 0, cooldown: 0 };
                  }
                }

                for (let e = minEntries; e <= maxEntries; e++) {
                    if (!continuousRead && (patternState[key].entriesData[e].activeEntriesLeft > 0 || patternState[key].entriesData[e].cooldown > 0)) {
                        continue;
                    }
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
               if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.sm <= maxSa && eState.currentSa >= minSaFilter && eState.pa >= minPaFilter) {
                  results.push({
                     id: k + '|ENT_' + e, lossMode: 'ENTRADA',
                     entries: e,
                     type: v.type, elements: v.elements, winRate: wr, count: eState.wins,
                     triggers: eState.triggers, sa: eState.currentSa, sm: eState.sm, pa: eState.pa, pm: eState.pm, activeNow: eState.activeEntriesLeft > 0, target: v.target,
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
          if (liveMode) playAlert();
        }
      }
    };

    processChunk();
  };

  
  const runLightUpdate = (currentData: Roll[], oldActiveIds: Set<string>, isManual: boolean = false) => {
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
                 if (el.t === 'c') {
                     const c = getCol(roll);
                     if (!(el.v === 'TRI' || (el.v === 'DUAL' && c !== 'B') || c === el.v)) { isTrigger = false; break; }
                 }
                 if (el.t === 'n' && roll.roll.toString() !== el.v) { isTrigger = false; break; }
             }
         }

         if (p.activeNow) {
             const isWin = evaluateHit(latestRoll, p.target, coverWhite);
             
             if (lossMode === 'ENTRADA') {
                 if (isWin) {
                     p.count++;
                     p.sa = 0;
                     p.pa = (p.pa || 0) + 1;
                     if (p.pa > (p.pm || 0)) p.pm = p.pa;
                     p.activeNow = false;
                     p.currentStep = 0;
                 } else {
                     p.sa++;
                     if (p.sa > p.sm) p.sm = p.sa;
                     p.pa = 0;
                     p.currentStep = (p.currentStep || 1) + 1;
                     const maxE = p.entries || entriesRange[1];
                     if (p.currentStep > maxE) {
                         p.activeNow = false;
                         p.currentStep = 0;
                     } else {
                         p.triggers++; // Novo gatilho para o próximo passo do Gale
                     }
                 }
             } else {
                 // Modo CICLO
                 if (isWin) {
                     p.count++;
                     p.sa = 0;
                     p.pa = (p.pa || 0) + 1;
                     if (p.pa > (p.pm || 0)) p.pm = p.pa;
                     p.activeNow = false;
                     p.currentStep = 0;
                 } else {
                     p.currentStep = (p.currentStep || 0) + 1;
                     const maxE = entriesRange[1];
                     if (p.currentStep > maxE) {
                         p.sa++;
                         if (p.sa > p.sm) p.sm = p.sa;
                         p.pa = 0;
                         p.activeNow = false;
                         p.currentStep = 0;
                     }
                 }
             }
         }

         if (isTrigger && !p.activeNow) {
             p.triggers++;
             p.activeNow = true;
             p.currentStep = 1;
         }

         p.winRate = ((p.count / Math.max(1, p.triggers)) * 100).toFixed(1);

         const wr = parseFloat(p.winRate);
         if (wr >= minWinRate && p.sm <= maxSa && p.sa >= minSaFilter && (p.pa || 0) >= (appliedFilters.minPaFilter || 0)) {
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
    const config = { lossMode, entriesRange, periodHours, patternType, targetFocus, coverWhite, continuousRead, useWildcards, maxWildcards, minTriggers, minWinRate, maxSa, minSaFilter, minPaFilter, sizeRange, useMixedMining };
    setAppliedFilters(config);
    if (useMixedMining) {
      runMixedDiscovery(config, data, false);
    } else {
      if (lossMode === 'ENTRADA') runFullDiscoveryEntrada(config, data, false);
      else runFullDiscoveryCiclo(config, data, false);
    }
  };

  const runMixedDiscoveryCiclo = (config: any, currentData: Roll[], isAuto: boolean, oldActiveIds: Set<string> = new Set()) => {
    if (!currentData || currentData.length < 10) return;
    
    if (!isAuto) {
      setIsMixedMining(true);
      setLiveMode(false);
    }
    
    const { periodHours, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, coverWhite = true, continuousRead = false } = config;
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
            if (i > history.length - totalLen) continue;
            const processedKeysForIndex = new Set<string>();
            
            if (totalLen <= 4) {
              const numVariations = 1 << totalLen;
              for (let mask = 0; mask < numVariations; mask++) {
                const elements: PatternElement[] = [];
                for (let p = 0; p < totalLen; p++) {
                  if ((mask & (1 << p)) === 0) {
                    elements.push({ t: 'c', v: getCol(history[i + p]) });
                  } else {
                    elements.push(getNumNode(history[i + p].roll));
                  }
                }

                const variations = generateWildcardVariations(elements, useWildcards, maxWildcards);
                for (const varElements of variations) {
                  const key = target + ':MIXED:' + varElements.map(e => e.t + e.v).join('|');
                  if (processedKeysForIndex.has(key)) continue;
                  processedKeysForIndex.add(key);

                  if (!patternMap[key]) {
                      patternMap[key] = { elements: varElements, type: 'MIXED', target, entriesData: {} };
                      for (let e = minEntries; e <= maxEntries; e++) {
                          patternMap[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, maxSa: 0, pa: 0, pm: 0, nextAllowedIdx: 0 };
                      }
                  }
                  
                  for (let e = minEntries; e <= maxEntries; e++) {
                      if (i + totalLen - 1 + e >= history.length) continue;
                      if (!continuousRead && i < patternMap[key].entriesData[e].nextAllowedIdx) continue;

                      patternMap[key].entriesData[e].triggers++;
                      if (!continuousRead) {
                          patternMap[key].entriesData[e].nextAllowedIdx = i + e + 1;
                      }
                      
                      let hit = false;
                      for (let w = 1; w <= e; w++) {
                        const nxt = history[i + totalLen - 1 + w];
                        if (evaluateHit(nxt, target, coverWhite)) { hit = true; break; }
                      }
                      if (hit) {
                        patternMap[key].entriesData[e].wins++;
                        patternMap[key].entriesData[e].currentSa = 0;
                        patternMap[key].entriesData[e].pa++;
                        if (patternMap[key].entriesData[e].pa > patternMap[key].entriesData[e].pm) patternMap[key].entriesData[e].pm = patternMap[key].entriesData[e].pa;
                      } else {
                        patternMap[key].entriesData[e].currentSa++;
                        patternMap[key].entriesData[e].pa = 0;
                        if (patternMap[key].entriesData[e].currentSa > patternMap[key].entriesData[e].maxSa) {
                            patternMap[key].entriesData[e].maxSa = patternMap[key].entriesData[e].currentSa;
                        }
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
                        patternMap[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, maxSa: 0, pa: 0, pm: 0, nextAllowedIdx: 0 };
                    }
                }
                
                for (let e = minEntries; e <= maxEntries; e++) {
                    if (i + totalLen - 1 + e >= history.length) continue;
                    if (!continuousRead && i < patternMap[key].entriesData[e].nextAllowedIdx) continue;

                    patternMap[key].entriesData[e].triggers++;
                    if (!continuousRead) {
                        patternMap[key].entriesData[e].nextAllowedIdx = i + e + 1;
                    }
                    
                    let hit = false;
                    for (let w = 1; w <= e; w++) {
                      const nxt = history[i + totalLen - 1 + w];
                      if (evaluateHit(nxt, target, coverWhite)) { hit = true; break; }
                    }
                    if (hit) {
                      patternMap[key].entriesData[e].wins++;
                      patternMap[key].entriesData[e].currentSa = 0;
                      patternMap[key].entriesData[e].pa++;
                      if (patternMap[key].entriesData[e].pa > patternMap[key].entriesData[e].pm) patternMap[key].entriesData[e].pm = patternMap[key].entriesData[e].pa;
                    } else {
                      patternMap[key].entriesData[e].currentSa++;
                      patternMap[key].entriesData[e].pa = 0;
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
               if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.maxSa <= maxSa && eState.currentSa >= minSaFilter && eState.pa >= minPaFilter) {
                  results.push({
                     id: k + '|ENT_' + e, lossMode: 'CICLO',
                     entries: e,
                     type: v.type, elements: v.elements, winRate: wr, count: eState.wins,
                     triggers: eState.triggers, sa: eState.currentSa, sm: eState.maxSa, pa: eState.pa, pm: eState.pm, activeNow: false, target: v.target
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
               if (el.t === 'c') { 
                 const c = getCol(r);
                 if (!(el.v === 'TRI' || (el.v === 'DUAL' && c !== 'B') || c === el.v)) { isMatch = false; break; } 
               } else { if (r.roll !== el.v) { isMatch = false; break; } }
             }
             if (isMatch) {
               let alreadyHit = false;
               for (let check = 1; check <= step; check++) {
                 if (evaluateHit(currentData[patternStartIdx + pat.elements.length - 1 + check], pat.target || targetFocus, coverWhite)) {
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
          if (liveMode) playAlert();
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
                if (evaluateHit(nxt, target, coverWhite)) {
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
    setSizeRange([result.bestPatternSize, result.bestPatternSize]);
    setPatternType('TODOS'); 
    setPeriodHours(trendHours);
    setUseMixedMining(true);
    setLossMode('CICLO');
    
    const wr = parseFloat(result.winRate);
    setMinWinRate(Math.max(wr - 5, trendMinWinRate)); 
    setMinTriggers(result.bestPatternSize > 5 ? 2 : 3); 
    setMaxSa(5); 
    setMinSaFilter(0);
    
    setShowTrendModal(false);
    setTimeout(() => {
       const config = {
          lossMode: 'CICLO', periodHours: trendHours, patternType: 'TODOS', entriesRange: [result.bestEntries, result.bestEntries], targetFocus: result.target || trendTarget, coverWhite, continuousRead: false, useWildcards, maxWildcards,
          minTriggers: result.bestPatternSize > 5 ? 2 : 3, minWinRate: Math.max(wr - 5, trendMinWinRate), maxSa: 5, minSaFilter: 0, minPaFilter: 0, sizeRange: [result.bestPatternSize, result.bestPatternSize], useMixedMining: true
       };
       setAppliedFilters(config);
       runMixedDiscovery(config, data, false);
    }, 300);
  };

  // Auto-Update Engine: Roda a cada pedra nova
  useEffect(() => {
    if (!data || data.length === 0) return;
    const latestId = data[data.length - 1].id;
    if (latestId === lastProcessedId.current) return;
    
    if (appliedFilters && discovered.length > 0) {
      const oldActive = new Set(discovered.filter(d => d.activeNow).map(d => d.id));
      const latestRoll = data[data.length - 1];

      // Atualizar Placar Ao Vivo
      if (lastScoreboardRollId.current !== latestRoll.id) {
          let anyActive = false;
          let anyWin = false;
          let anyWhiteWin = false;
          for (const pat of discovered) {
              if (pat.activeNow) {
                  anyActive = true;
                  if (evaluateHit(latestRoll, pat.target, appliedFilters.coverWhite)) {
                      anyWin = true;
                  }
                  if (latestRoll.roll === '0' || getCol(latestRoll) === 'B') {
                      anyWhiteWin = true;
                  }
              }
          }
          if (anyActive) {
              setGlobalScore(prev => {
                  const wins = prev.wins + (anyWin ? 1 : 0);
                  const losses = prev.losses + (anyWin ? 0 : 1);
                  const currentSa = anyWin ? 0 : prev.currentSa + 1;
                  const maxSa = Math.max(prev.maxSa, currentSa);
                  return { wins, losses, currentSa, maxSa };
              });
              setWhiteScore(prev => {
                  const wins = prev.wins + (anyWhiteWin ? 1 : 0);
                  const losses = prev.losses + (anyWhiteWin ? 0 : 1);
                  const currentSa = anyWhiteWin ? 0 : prev.currentSa + 1;
                  const maxSa = Math.max(prev.maxSa, currentSa);
                  return { wins, losses, currentSa, maxSa };
              });
          }
          lastScoreboardRollId.current = latestRoll.id;
      }
      
      if (!lightMode) {
          if (appliedFilters.useMixedMining) {
             runMixedDiscovery(appliedFilters, data, true, oldActive);
          } else {
             if (appliedFilters.lossMode === 'ENTRADA') runFullDiscoveryEntrada(appliedFilters, data, true, oldActive);
             else runFullDiscoveryCiclo(appliedFilters, data, true, oldActive);
          }
      } else {
          runLightUpdate(data, oldActive);
      }
    }
  }, [data, lightMode, appliedFilters, discovered]);

  // Timer logic for Light Mode
  useEffect(() => {
     if (!lightMode || discovered.length === 0) return;
     const iv = setInterval(() => {
        setTimeLeft(prev => {
           if (prev <= 1) {
              if (appliedFilters) {
                 const oldActive = new Set(discovered.filter(d => d.activeNow).map(d => d.id));
                 runLightUpdate(data, oldActive);
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
            <Link href="/analista" className="text-xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center gap-2 hover:scale-105 transition-transform">
              <BrainCircuit className="text-blue-500" />
              ANALISTA SIMULADOR
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowTrendModal(true)}
              className="flex items-center gap-2 bg-[#eab308]/10 hover:bg-[#eab308]/20 border border-[#eab308]/30 px-3 py-1.5 rounded-lg transition-all text-[#eab308] font-bold text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.1)]"
            >
              <Zap size={14} /> TENDÊNCIA RÁPIDA
            </button>
            <button 
              onClick={() => fetchData()}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 rounded-lg transition-all text-blue-400 font-bold text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(59,130,246,0.1)] disabled:opacity-50"
              title="Sincronizar histórico com o banco de dados sem recarregar a página"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 
              {loading ? "ATUALIZANDO..." : "ATUALIZAR DADOS"}
            </button>
          </div>
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

            <div className="mt-1">
              <DualSlider 
                range={sizeRange} 
                setRange={setSizeRange} 
                min={1} 
                max={10} 
                title="📏 Tamanho do Padrão" 
                labelLeft="1 Pedra" 
                labelRight="10 Pedras" 
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-purple-500 uppercase font-black tracking-widest" title="O robô usará este tempo para aprender antes de simular">Janela de Mineração (Treino)</label>
                <select className="bg-transparent border-b border-purple-500/50 text-white px-2 py-1 outline-none focus:border-purple-500 text-[11px] transition-all font-bold" value={trainingWindowHours} onChange={(e) => setTrainingWindowHours(Number(e.target.value))}>
                  <option className="bg-[#12141c]" value={6}>6 Horas Atrás</option>
                  <option className="bg-[#12141c]" value={12}>12 Horas Atrás</option>
                  <option className="bg-[#12141c]" value={24}>24 Horas Atrás</option>
                  <option className="bg-[#12141c]" value={48}>48 Horas Atrás</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[9px] text-[#e51e3e] uppercase font-black tracking-widest" title="Quantidade de dias que o robô vai percorrer apostando">Duração do Backtest (Dias)</label>
                <select className="bg-transparent border-b border-[#e51e3e]/50 text-white px-2 py-1 outline-none focus:border-[#e51e3e] text-[11px] transition-all font-bold" value={simulationDays} onChange={(e) => setSimulationDays(Number(e.target.value))}>
                  <option className="bg-[#12141c]" value={1}>1 Dia de Simulação</option>
                  <option className="bg-[#12141c]" value={2}>2 Dias de Simulação</option>
                  <option className="bg-[#12141c]" value={3}>3 Dias de Simulação</option>
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

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Foco Alvo</label>
              <select className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-md outline-none focus:border-blue-500 text-xs font-bold" value={targetFocus} onChange={(e) => setTargetFocus(e.target.value)}>
                <option value="Ambos">🌓 VERM/PRETO</option>
                <option value="Branco">⚪ BRANCO</option>
                <option value="Vermelho">🔴 VERMELHO</option>
                <option value="Preto">⚫ PRETO</option>
              </select>
            </div>
            
            {targetFocus !== 'Branco' && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs font-bold text-gray-400 hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={coverWhite} 
                  onChange={(e) => setCoverWhite(e.target.checked)} 
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-[#12141c] accent-blue-500"
                />
                Cobrir Branco na Análise
              </label>
            )}

            <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs font-bold text-gray-400 hover:text-white transition-colors">
              <input 
                type="checkbox" 
                checked={continuousRead} 
                onChange={(e) => setContinuousRead(e.target.checked)} 
                className="w-3.5 h-3.5 rounded border-gray-600 bg-[#12141c] accent-blue-500"
              />
              Leitura Contínua
            </label>

            <div className="flex items-center gap-3 mt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-400 hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={useWildcards} 
                  onChange={(e) => setUseWildcards(e.target.checked)} 
                  className="w-3.5 h-3.5 rounded border-gray-600 bg-[#12141c] accent-blue-500"
                />
                Curingas
              </label>
              {useWildcards && (
                <input 
                  type="number" 
                  min="1" max="5" 
                  value={maxWildcards} 
                  onChange={(e) => setMaxWildcards(parseInt(e.target.value) || 1)}
                  className="w-12 h-6 bg-[#1a1c24] border border-gray-600 rounded text-xs text-center text-white outline-none"
                />
              )}
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
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider text-green-400">PA Mín</label>
                <input type="number" min="0" value={minPaFilter} onChange={(e) => setMinPaFilter(Number(e.target.value) || 0)} className="bg-[#12141c] border border-green-500/30 text-white text-xs px-3 py-2 rounded-md outline-none focus:border-green-500" />
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
                onClick={startSimulation} 
                disabled={isDiscovering || loading || isMixedMining || simulating}
                className={`flex justify-center items-center gap-2 disabled:opacity-50 px-4 py-3 rounded-lg transition-all font-black text-xs uppercase tracking-widest shadow-lg ${useMixedMining ? 'bg-amber-600 hover:bg-amber-500 shadow-[0_0_20px_rgba(217,119,6,0.3)] text-white' : 'bg-[#e51e3e] hover:bg-red-500 shadow-[0_0_20px_rgba(229,30,62,0.3)] text-white'}`}
              >
                {isDiscovering || isMixedMining || simulating || loading ? (
                   <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                      PROCESSANDO...
                   </>
                ) : (
                   <>
                      <Play size={16} />
                      {useMixedMining ? 'SIMULAR MISTOS (IA)' : 'INICIAR SIMULAÇÃO'}
                   </>
                )}
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

                    {/* Placar Global da Simulação */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-[#0a0a0f] border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden group hover:border-[#e51e3e]/50 transition-colors shadow-lg">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400"></div>
              <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Sinais</span>
              <span className="text-3xl font-black text-white">{simScore.triggers}</span>
            </div>
            <div className="bg-[#0a0a0f] border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden group hover:border-green-500/50 transition-colors shadow-lg">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
              <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Wins</span>
              <span className="text-3xl font-black text-green-400">{simScore.wins}</span>
            </div>
            <div className="bg-[#0a0a0f] border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden group hover:border-red-500/50 transition-colors shadow-lg">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
              <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Losses</span>
              <span className="text-3xl font-black text-red-500">{simScore.losses}</span>
            </div>
            <div className="bg-[#0a0a0f] border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden group hover:border-purple-500/50 transition-colors shadow-lg">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
              <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Max SA (Sequência Loss)</span>
              <span className="text-3xl font-black text-purple-400">{simScore.maxSa}</span>
            </div>
            <div className="bg-[#0a0a0f] border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden group hover:border-yellow-500/50 transition-colors shadow-lg col-span-2 md:col-span-4 lg:col-span-1">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-amber-600"></div>
              <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Win Rate Geral</span>
              <span className="text-3xl font-black text-yellow-400">
                {simScore.triggers > 0 ? ((simScore.wins / (simScore.wins + simScore.losses)) * 100).toFixed(1) : '0'}%
              </span>
            </div>
          </div>
          
          {simulating && (
             <div className="w-full bg-[#0a0a0f] border border-white/5 p-4 rounded-xl mb-6 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-xs font-black text-[#e51e3e] uppercase tracking-widest animate-pulse flex items-center gap-2">
                     <Zap size={14} /> MÁQUINA DO TEMPO EM AÇÃO
                   </span>
                   <span className="text-xs font-bold text-gray-400">{Math.round((simProgress / (simTotal || 1)) * 100)}% ({simProgress}/{simTotal} rodadas)</span>
                </div>
                <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-white/5">
                   <div className="h-full bg-gradient-to-r from-[#e51e3e] to-purple-500 transition-all duration-100" style={{ width: `${(simProgress / (simTotal || 1)) * 100}%` }}></div>
                </div>
             </div>
          )}

          {cycleHistory.length > 0 && (
            <div className="mb-6 bg-[#0a0a0f] border border-white/5 p-5 rounded-2xl shadow-xl">
              <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4 border-b border-white/5 pb-2 flex items-center gap-2">
                <Clock size={16} className="text-blue-500" /> Linha do Tempo (Wins/Losses)
              </h2>
              <div className="flex flex-wrap gap-1 max-h-[200px] overflow-y-auto custom-scrollbar p-2 bg-[#050507] rounded-xl border border-white/5">
                {cycleHistory.map((c, i) => (
                  <div key={i} className={`flex items-center justify-center text-[10px] font-bold rounded-sm min-w-[20px] px-1.5 h-6 ${c.type === 'W' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                    {c.type}{c.count > 1 ? c.count : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tendência da Mesa ao Vivo */}
          {data.length > 0 && (
            <div className="mb-6">
              <LiveHistoryCard data={data} maxItems={35} />
            </div>
          )}

          {discovered.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
               <BrainCircuit size={64} className="text-gray-600 mb-6" />
               <h2 className="text-xl font-black text-gray-400 uppercase tracking-widest mb-2">Configure os Filtros</h2>
               <p className="text-sm text-gray-500 max-w-sm">A IA está pronta para encontrar os padrões de ouro baseados nos seus filtros personalizados.</p>
             </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between bg-[#12141c] p-4 rounded-xl border border-white/5">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">{discovered.length} Estratégias</span>
                <div className="flex items-center gap-2">
                
                {/* WHITE SCOREBOARD TOGGLE & DISPLAY */}
                <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-white/5 transition-all">
                  <button onClick={() => setShowWhiteScore(!showWhiteScore)} className="text-[10px] flex items-center gap-1 hover:text-white transition-colors" style={{ color: showWhiteScore ? 'white' : '#6b7280' }}>
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.8)]"></div>
                    <span className="font-black uppercase tracking-widest">{showWhiteScore ? 'Placar Branco' : 'Branco'}</span>
                  </button>
                  {showWhiteScore && (
                    <div className="flex items-center gap-3 border-l border-white/10 pl-3">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-white">{whiteScore.wins}</span>
                        <span className="text-[10px] text-gray-500 font-bold">W</span>
                      </div>
                      <span className="text-gray-600 font-black text-xs">x</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-red-500">{whiteScore.losses}</span>
                        <span className="text-[10px] text-gray-500 font-bold">L</span>
                      </div>
                      <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-[8px] text-white font-black tracking-widest">SA</span>
                          <span className="text-xs font-black text-white">{whiteScore.currentSa}</span>
                        </div>
                        <div className="flex flex-col items-center leading-none">
                          <span className="text-[8px] text-gray-500 font-black tracking-widest">MÁX</span>
                          <span className="text-xs font-black text-gray-400">{whiteScore.maxSa}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* GLOBAL SCOREBOARD */}
                <div className="flex items-center gap-4 bg-black/40 px-6 py-2 rounded-lg border border-white/5 relative group">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Placar Ao Vivo</span>
                    <button 
                      onClick={() => {
                        setGlobalScore({ wins: 0, losses: 0, currentSa: 0, maxSa: 0 });
                        setWhiteScore({ wins: 0, losses: 0, currentSa: 0, maxSa: 0 });
                      }}
                      className="text-sm ml-1 opacity-40 hover:opacity-100 transition-all hover:rotate-180"
                      title="Zerar Placar"
                    >
                      🔄
                    </button>
                  </div>
                  <div className="flex items-center gap-3 border-l border-white/10 pl-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black text-green-400">{globalScore.wins}</span>
                      <span className="text-[10px] text-gray-500 font-bold">W</span>
                    </div>
                    <span className="text-gray-600 font-black text-xs">x</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black text-red-500">{globalScore.losses}</span>
                      <span className="text-[10px] text-gray-500 font-bold">L</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-[8px] text-purple-400 font-black tracking-widest">SA</span>
                      <span className="text-xs font-black text-white">{globalScore.currentSa}</span>
                    </div>
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-[8px] text-gray-500 font-black tracking-widest">MÁX</span>
                      <span className="text-xs font-black text-gray-400">{globalScore.maxSa}</span>
                    </div>
                  </div>
                </div>

                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => {
                    if (appliedFilters && discovered.length > 0) {
                      const oldActive = new Set(discovered.filter(d => d.activeNow).map(d => d.id));
                      if (appliedFilters.useMixedMining) runMixedDiscoveryEntrada(appliedFilters, data, true, oldActive);
                      else if (appliedFilters.lossMode === 'ENTRADA') runFullDiscoveryEntrada(appliedFilters, data, true, oldActive);
                      else runFullDiscoveryCiclo(appliedFilters, data, true, oldActive);
                    }
                  }} className="bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all shadow-[0_0_10px_rgba(37,99,235,0.2)]">
                    🔄 Atualizar Padrões
                  </button>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Ordenar por:</span>
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-black border border-white/10 text-white text-xs font-bold px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 transition-all cursor-pointer hover:border-white/30"
                  >
                    <option value="WINRATE">Assertividade</option>
                    <option value="SA">Maior SA</option>
                    <option value="PA">Maior PA</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...discovered].sort((a, b) => {
                  if (a.activeNow && !b.activeNow) return -1;
                  if (!a.activeNow && b.activeNow) return 1;
                  if (sortBy === 'SA') return b.sa - a.sa;
                  if (sortBy === 'PA') return (b.pa || 0) - (a.pa || 0);
                  return parseFloat(b.winRate) - parseFloat(a.winRate);
                }).map((pat, i) => (
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
                      {pat.elements.map((el, idx) => {
                        const isZero = el.t === 'n' && el.v === '0';
                        const isColor = el.t === 'c' || isZero;
                        const v = isZero ? 'B' : el.v;
                        const isNumRed = el.t === 'n' && parseInt(el.v) >= 1 && parseInt(el.v) <= 7;
                        const isNumBlack = el.t === 'n' && parseInt(el.v) >= 8 && parseInt(el.v) <= 14;

                        const bgStyle = el.t === 'c' && el.v === 'DUAL' 
                          ? { background: 'linear-gradient(to right, #dc2626 50%, #27272a 50%)' } 
                          : el.t === 'c' && el.v === 'TRI' 
                            ? { background: 'linear-gradient(to right, #dc2626 33.33%, #ffffff 33.33%, #ffffff 66.66%, #27272a 66.66%)' } 
                            : {};

                        return (
                          <div key={idx} style={bgStyle} className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shadow-sm ${
                            isColor 
                              ? (v === 'V' ? 'bg-red-600 text-white' : v === 'P' ? 'bg-zinc-800 text-white' : (v === 'DUAL' || v === 'TRI') ? 'text-transparent' : 'bg-white text-black')
                              : isNumRed 
                                ? 'bg-red-600 text-white' 
                                : isNumBlack 
                                  ? 'bg-zinc-800 text-white' 
                                  : 'bg-blue-600/20 border border-blue-500/30 text-blue-400'
                          }`}>
                            {isColor ? '' : el.v}
                          </div>
                        );
                      })}
                      <span className="text-gray-500 font-bold mx-1">=</span>
                      <span className="text-lg flex items-center gap-1.5">
                         {getTargetEmoji(pat.target || targetFocus)}
                         {coverWhite && (pat.target || targetFocus) !== 'Branco' && <span className="text-sm opacity-80">+ ⚪</span>}
                      </span>
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

                  <div className="grid grid-cols-5 gap-2 pt-3 border-t border-white/5 z-10">
                    <div className="flex flex-col"><span className="text-[7px] text-gray-500 uppercase font-bold text-center">Wins</span><span className="text-xs font-black text-white text-center">{pat.count}</span></div>
                    <div className={`flex flex-col rounded-lg transition-all ${pat.sa >= pat.sm && pat.sa > 0 ? 'bg-[#8b008b] p-1 shadow-[0_0_10px_rgba(139,0,139,0.5)]' : ''}`}>
                      <span className="text-[7px] text-gray-500 uppercase font-bold text-center">MaxLoss</span>
                      <span className="text-xs font-black text-white text-center">{pat.sm}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] text-gray-400 uppercase font-bold text-center">SA</span>
                      <span className="text-xs font-black text-purple-400 text-center">{pat.sa}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] text-gray-500 uppercase font-bold text-center">PM</span>
                      <span className="text-xs font-black text-white text-center">{pat.pm || 0}</span>
                    </div>
                    <div className="flex flex-col bg-green-500/10 border border-green-500/20 rounded">
                      <span className="text-[7px] text-green-400 uppercase font-bold text-center">PA</span>
                      <span className="text-xs font-black text-green-400 text-center">{pat.pa || 0}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
              </div>
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

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Gale Máximo no Ranking</label>
                    <select className="bg-[#12141c] border border-white/5 text-white px-3 py-2.5 rounded-xl outline-none focus:border-[#eab308] font-black text-xs transition-all" value={trendMaxEntries} onChange={(e) => setTrendMaxEntries(Number(e.target.value))}>
                      <option value={1}>Somente 1 Entrada (Gale 0)</option>
                      {Array.from({ length: 29 }, (_, i) => i + 2).map(n => (
                        <option key={n} value={n}>Até Gale {n-1} ({n} Entradas)</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Win Rate Mínimo</label>
                    <select className="bg-[#12141c] border border-white/5 text-white px-3 py-2.5 rounded-xl outline-none focus:border-[#eab308] font-black text-xs transition-all" value={trendMinWinRate} onChange={(e) => setTrendMinWinRate(Number(e.target.value))}>
                      <option value={60}>60% +</option>
                      <option value={70}>70% +</option>
                      <option value={80}>80% +</option>
                      <option value={90}>90% +</option>
                      <option value={95}>95% +</option>
                      <option value={100}>100% (Perfeito)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 mb-8 px-2 bg-black/20 p-3 rounded-xl border border-white/5">
                  <label className="flex items-center gap-2 cursor-pointer text-[9px] font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest">
                    <input type="checkbox" checked={coverWhite} onChange={(e) => setCoverWhite(e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-600 bg-[#12141c] accent-[#eab308]" />
                    Proteção no Branco (+ ⚪)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[9px] font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest">
                    <input type="checkbox" checked={useWildcards} onChange={(e) => setUseWildcards(e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-600 bg-[#12141c] accent-[#eab308]" />
                    Incluir Curingas (Mistos)
                  </label>
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
