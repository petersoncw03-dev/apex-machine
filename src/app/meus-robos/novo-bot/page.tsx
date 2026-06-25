"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { VirtuosoGrid } from "react-virtuoso";
import { BrainCircuit, Search, Zap, X, ChevronRight, List, CloudUpload, Send } from "lucide-react";

// Types
interface Roll {
  id?: string;
  color: string;
  roll: string | number;
}

interface PatternElement {
  t: 'c' | 'n'; // color or number
  v: string | number;
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

const USER_ID = "admin_master";
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/backend';

export default function GeradorSaaSPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050507] text-white flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    }>
      <GeradorSaaSPageInner />
    </Suspense>
  );
}

function GeradorSaaSPageInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);
  const [importToast, setImportToast] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  
  // Discovery Filters
  const [periodHours, setPeriodHours] = useState(24);
  const [patternType, setPatternType] = useState('TODOS'); 
  const [lossMode, setLossMode] = useState<'CICLO' | 'ENTRADA'>('CICLO');
  const [entriesRange, setEntriesRange] = useState<[number, number]>([1, 5]);
  const [sortBy, setSortBy] = useState<'WINRATE' | 'SA'>('WINRATE');
  const [targetFocus, setTargetFocus] = useState('Branco'); 
  
  const [minTriggers, setMinTriggers] = useState(5);
  const [minWinRate, setMinWinRate] = useState(90);
  const [maxSa, setMaxSa] = useState(2);
  const [minSaFilter, setMinSaFilter] = useState(0);
  const [minPaFilter, setMinPaFilter] = useState(0);
  const [sizeRange, setSizeRange] = useState<[number, number]>([3, 5]);
  const [coverWhite, setCoverWhite] = useState(true);
  const [useWildcards, setUseWildcards] = useState(false);
  const [maxWildcards, setMaxWildcards] = useState(1);
  const [continuousRead, setContinuousRead] = useState(false);
  
  // Trend Filter
  const [useTrendFilter, setUseTrendFilter] = useState(false);
  const [ind1Type, setInd1Type] = useState<'sma' | 'ema'>('sma');
  const [ind1Period, setInd1Period] = useState(7);
  const [ind2Type, setInd2Type] = useState<'sma' | 'ema'>('ema');
  const [ind2Period, setInd2Period] = useState(21);
  
  // Stake Management
  const [initialStake, setInitialStake] = useState<number>(2.0);
  const [martingaleMultiplier, setMartingaleMultiplier] = useState<number>(1.078);
  
  // Presets
  interface SavedPreset { name: string; config: any; }
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // ── Load filters from URL params (coming from Meus Robôs) ──
  useEffect(() => {
    const p = searchParams;
    if (!p || !p.get('targetFocus')) return; // Only apply if came with params
    if (p.get('periodHours'))    setPeriodHours(Number(p.get('periodHours')));
    if (p.get('patternType'))    setPatternType(p.get('patternType')!);
    if (p.get('entriesRange'))   setEntriesRange(JSON.parse(p.get('entriesRange') as string));
    if (p.get('targetFocus'))    setTargetFocus(p.get('targetFocus')!);
    if (p.get('minTriggers'))    setMinTriggers(Number(p.get('minTriggers')));
    if (p.get('minWinRate'))     setMinWinRate(Number(p.get('minWinRate')));
    if (p.get('maxSa'))          setMaxSa(Number(p.get('maxSa')));
    if (p.get('minSaFilter'))    setMinSaFilter(Number(p.get('minSaFilter')));
    if (p.get('sizeRange'))      setSizeRange(JSON.parse(p.get('sizeRange') as string));
    if (p.get('coverWhite'))     setCoverWhite(p.get('coverWhite') === 'true');
    if (p.get('useWildcards'))   setUseWildcards(p.get('useWildcards') === 'true');
    if (p.get('useMixedMining')) setUseMixedMining(p.get('useMixedMining') === 'true');
    if (p.get('useTrendFilter')) setUseTrendFilter(p.get('useTrendFilter') === 'true');
    if (p.get('ind1Type'))       setInd1Type(p.get('ind1Type') as any);
    if (p.get('ind1Period'))     setInd1Period(Number(p.get('ind1Period')));
    if (p.get('ind2Type'))       setInd2Type(p.get('ind2Type') as any);
    if (p.get('ind2Period'))     setInd2Period(Number(p.get('ind2Period')));
    setImportToast(true);
    setTimeout(() => setImportToast(false), 4000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loaded = localStorage.getItem('fabrica_presets');
    if (loaded) {
      try { setSavedPresets(JSON.parse(loaded)); } catch(e){}
    }
  }, []);

  const playAlert = () => {
    try {
      const audio = new Audio('/alert.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio blocked:', e));
    } catch(e) {}
  };

  const savePreset = () => {
    if (!newPresetName.trim()) return;
    const config = { periodHours, patternType, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, sizeRange, coverWhite, useWildcards, maxWildcards, continuousRead, initialStake, martingaleMultiplier };
    const updated = [...savedPresets, { name: newPresetName, config }];
    setSavedPresets(updated);
    localStorage.setItem('fabrica_presets', JSON.stringify(updated));
    setNewPresetName('');
  };

  const deletePreset = (idx: number) => {
    const updated = savedPresets.filter((_, i) => i !== idx);
    setSavedPresets(updated);
    localStorage.setItem('fabrica_presets', JSON.stringify(updated));
  };

  const loadPreset = (config: any) => {
    if (config.periodHours) setPeriodHours(config.periodHours);
    if (config.patternType) setPatternType(config.patternType);
    if (config.entriesRange) setEntriesRange(config.entriesRange);
    if (config.targetFocus) setTargetFocus(config.targetFocus);
    if (config.minTriggers) setMinTriggers(config.minTriggers);
    if (config.minWinRate !== undefined) setMinWinRate(config.minWinRate);
    if (config.maxSa !== undefined) setMaxSa(config.maxSa);
    if (config.minSaFilter !== undefined) setMinSaFilter(config.minSaFilter);
    if (config.sizeRange !== undefined) setSizeRange(config.sizeRange);
    if (config.coverWhite !== undefined) setCoverWhite(config.coverWhite);
    if (config.useWildcards !== undefined) setUseWildcards(config.useWildcards);
    if (config.maxWildcards !== undefined) setMaxWildcards(config.maxWildcards);
    if (config.continuousRead !== undefined) setContinuousRead(config.continuousRead);
    if (config.initialStake !== undefined) setInitialStake(config.initialStake);
    if (config.martingaleMultiplier !== undefined) setMartingaleMultiplier(config.martingaleMultiplier);
    setShowPresetsMenu(false);
  };
  
  // Update default multiplier when target changes
  useEffect(() => {
    if (targetFocus === 'Branco') setMartingaleMultiplier(1.078);
    else if (targetFocus === 'Vermelho' || targetFocus === 'Preto' || targetFocus === 'Ambos') setMartingaleMultiplier(2.0);
  }, [targetFocus]);
  
  // SaaS States
  const [telegramId, setTelegramId] = useState('');
  const [isSavingVPS, setIsSavingVPS] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  
  // State
  const [discovered, setDiscovered] = useState<DiscoveredPattern[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const lastProcessedId = useRef<string | null>(null);

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

  const handleSaveAllToVPS = async () => {
    if (!telegramId) { alert('Preencha o Chat ID do Telegram!'); return; }
    if (discovered.length === 0) { alert('Processe a IA primeiro!'); return; }
    setIsSavingVPS(true);

    const filters = { periodHours, patternType, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, sizeRange, coverWhite, useWildcards, maxWildcards, continuousRead, initialStake, martingaleMultiplier, useTrendFilter, ind1Type, ind1Period, ind2Type, ind2Period, useMixedMining };
    const targetEmoji = targetFocus === 'Branco' ? '⚪' : targetFocus === 'Vermelho' ? '🔴' : targetFocus === 'Preto' ? '⚫' : '🌓';
    const name = `${targetEmoji} ${targetFocus} | G${(entriesRange[1] - 1)} | R$${initialStake}`;

    try {
      const res = await fetch(`${API_URL}/save-strategy-config`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ user_id: USER_ID, target_telegram_id: telegramId, filters, name, min_confluence: 1 })
      });
      const data = await res.json();
      if (res.ok) {
        setSavedCount(discovered.length);
        alert(`✅ Estratégia salva na VPS!\n\n${discovered.length} padrões encontrados com esses filtros.\nA VPS vai recalcular a cada rodada automaticamente.\n\nVeja em "Central SaaS" para gerenciar.`);
      } else {
        alert(`Erro: ${JSON.stringify(data)}`);
      }
    } catch(e) {
      console.error('Erro ao salvar config:', e);
      alert('Erro de conexão com a API.');
    }

    setIsSavingVPS(false);
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
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getCol = (r: Roll) => {
    if (!r) return 'B';
    const n = parseInt(r.roll as string);
    if (r.color.includes('Vermelho') || (n >= 1 && n <= 7)) return 'V';
    if (r.color.includes('Preto') || (n >= 8 && n <= 14)) return 'P';
    return 'B';
  };



  const checkTrend = (rolls: Roll[], trendConfig: any) => {
    if (!trendConfig || !trendConfig.enabled) return true;
    let acc = 0;
    const accValues: number[] = [];
    // rolls is ASC (oldest first). detector.py iterates from oldest to newest.
    for (const r of rolls) {
      acc += (r as any).house_profit ? parseFloat((r as any).house_profit) : 0;
      accValues.push(acc);
    }
    const p1 = parseInt(trendConfig.ind1Period || 7);
    const p2 = parseInt(trendConfig.ind2Period || 21);
    
    if (accValues.length < Math.max(p1, p2)) return true;

    const calcSma = (data: number[], p: number) => {
      let sum = 0;
      for (let i = data.length - p; i < data.length; i++) sum += data[i];
      return sum / p;
    };
    const calcEma = (data: number[], p: number) => {
      const k = 2 / (p + 1);
      let ema = data[0];
      for (let i = 1; i < data.length; i++) ema = (data[i] - ema) * k + ema;
      return ema;
    };

    const v1 = trendConfig.ind1Type === 'sma' ? calcSma(accValues, p1) : calcEma(accValues, p1);
    const v2 = trendConfig.ind2Type === 'sma' ? calcSma(accValues, p2) : calcEma(accValues, p2);
    return v1 < v2;
  };
  const getNumNode = (rollStr: string | number): PatternElement => String(rollStr) === '0' ? { t: 'c', v: 'B' } : { t: 'n', v: String(rollStr) };

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
    const n = parseInt(rollObj.roll as string);
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
      lastProcessedId.current = currentData[currentData.length - 1].id || null;
      
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
      lastProcessedId.current = currentData[currentData.length - 1].id || null;
      
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
        lastProcessedId.current = currentData[currentData.length - 1].id || null;
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
     lastProcessedId.current = latestRoll.id || null;

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
        lastProcessedId.current = currentData[currentData.length - 1].id || null;
        if (!isAuto) setIsMixedMining(false);
        
        if (isAuto && anyNewTrigger) {
          if (liveMode) playAlert();
        }
      }
    };

    processChunk();
  };


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
        .filter(r => parseFloat(r.winRate) >= trendMinWinRate)
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
    
    const wr = parseFloat(result.winRate);
    setMinWinRate(Math.max(wr - 5, 75)); 
    setMinTriggers(result.bestPatternSize > 5 ? 2 : 3); 
    setMaxSa(5); 
    setMinSaFilter(0);
    
    setShowTrendModal(false);
    setTimeout(() => {
       const config = {
          periodHours: trendHours, patternType: 'TODOS', entriesRange: result.bestEntries, targetFocus: result.target || trendTarget,
          minTriggers: result.bestPatternSize > 5 ? 2 : 3, minWinRate: Math.max(wr - 5, 75), maxSa: 5, minSaFilter: 0, sizeRange: [result.bestPatternSize, result.bestPatternSize]
       };
       setAppliedFilters(config);
       runFullDiscovery(config, data, false);
    }, 300);
  };

  // Auto-Update Engine: Roda a cada pedra nova com os filtros salvos no Snapshot
  useEffect(() => {
    if (!data || data.length === 0) return;
    const latestId = data[data.length - 1].id;
    if (latestId === lastProcessedId.current) return;
    
    if (appliedFilters) {
      const oldActive = new Set(discovered.filter(d => d.activeNow).map(d => d.id as string));
      if (appliedFilters.useMixedMining) {
        runMixedDiscovery(appliedFilters, data, true, oldActive);
      } else {
        runFullDiscovery(appliedFilters, data, true, oldActive);
      }
    }
  }, [data]);

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col relative">
      {/* Import toast */}
      {importToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] bg-gradient-to-r from-purple-700 to-blue-700 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-purple-400/30 animate-bounce">
          <span className="text-xl">🔮</span>
          <span className="font-bold text-sm">Filtros importados do Agente! Clique em <strong>Processar IA</strong> para gerar novas estratégias.</span>
        </div>
      )}
      <div className="bg-[#0a0a0f] border-b border-white/5 p-4 flex items-center justify-between shadow-2xl z-40">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 flex items-center gap-2">
            <CloudUpload className="text-purple-500" />
            FÁBRICA IA
          </h1>
          <button 
            onClick={() => setShowTrendModal(true)}
            className="flex items-center gap-2 bg-[#eab308]/10 hover:bg-[#eab308]/20 border border-[#eab308]/30 px-3 py-1.5 rounded-lg transition-all text-[#eab308] font-bold text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.1)]"
          >
            <Zap size={14} /> TENDÊNCIA RÁPIDA
          </button>
        </div>
        <div className="flex items-center gap-3">
          {discovered.length > 0 && <span className="text-xs text-gray-400 font-bold">{discovered.length} padrões</span>}
          {savedCount > 0 && <span className="text-xs text-green-400 font-bold">✅ {savedCount} salvos</span>}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Filters */}
        <aside className="w-80 bg-[#0a0a0f] border-r border-white/5 flex flex-col shadow-2xl overflow-y-auto custom-scrollbar p-6 gap-6">
          <div className="flex flex-col gap-1 border-b border-white/5 pb-4 relative z-50">
            <h2 className="text-xs font-black uppercase text-purple-400 tracking-widest flex items-center justify-between">
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
                        <button onClick={() => loadPreset(p.config)} className="text-xs text-white hover:text-purple-400 truncate flex-1 text-left font-bold transition-colors">{p.name}</button>
                        <button onClick={() => deletePreset(i)} className="text-gray-500 hover:text-red-500 ml-2 opacity-50 group-hover:opacity-100 transition-opacity">🗑️</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-1 focus-within:border-purple-500/50 transition-colors">
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
              <DualSlider 
                range={sizeRange} 
                setRange={setSizeRange} 
                min={1} max={10} 
                title="📏 Tamanho do Padrão" 
                labelLeft="1 Pedra" 
                labelRight="10 Pedras" 
                formatRange={(r: any) => r[0] === r[1] ? `${r[0]} Pedra${r[0]>1?'s':''}` : `${r[0]} até ${r[1]} Pedras`} 
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Histórico</label>
                <select className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-md outline-none focus:border-blue-500 text-xs" value={periodHours} onChange={(e) => setPeriodHours(Number(e.target.value))}>
                  {[1,2,3,4,6,9,12,18,24,36,48,60].map(h => (
                    <option key={h} value={h}>{h} Horas</option>
                  ))}
                </select>
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
                  type="number" min="1" max="5" 
                  value={maxWildcards} 
                  onChange={(e) => setMaxWildcards(Number(e.target.value) || 1)} 
                  className="bg-[#12141c] border border-white/10 text-white text-[10px] px-2 py-1 rounded outline-none focus:border-blue-500 w-12"
                  title="Máximo de Curingas"
                />
              )}
            </div>
            
            <div className="flex flex-col gap-1 mt-2">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Modo de Loss</label>
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

            <DualSlider 
              range={entriesRange} 
              setRange={setEntriesRange} 
              min={1} max={30}
              title="🎯 Faixa de Entradas"
              labelLeft="1 Entr"
              labelRight="30 Entr"
            />

            

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

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-green-400 uppercase font-bold tracking-wider">Aposta Inicial (R$)</label>
                <input type="number" step="0.01" min="0.1" value={initialStake} onChange={(e) => setInitialStake(Number(e.target.value) || 0)} className="bg-[#12141c] border border-green-500/30 text-white text-xs px-3 py-2 rounded-md outline-none focus:border-green-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-green-400 uppercase font-bold tracking-wider">Multiplicador Gale</label>
                <input type="number" step="0.001" min="1.0" value={martingaleMultiplier} onChange={(e) => setMartingaleMultiplier(Number(e.target.value) || 1)} className="bg-[#12141c] border border-green-500/30 text-white text-xs px-3 py-2 rounded-md outline-none focus:border-green-500" />
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-4">

              <div className="flex items-center gap-2 mb-2 bg-[#12141c] border border-blue-500/30 p-2 rounded-lg cursor-pointer hover:bg-[#12141c]/80 transition-colors" onClick={() => setUseMixedMining(!useMixedMining)}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${useMixedMining ? 'border-blue-500 bg-blue-500' : 'border-gray-500'}`}>
                  {useMixedMining && <div className="w-2 h-2 bg-white rounded-full"></div>}
                </div>
                <span className="text-[10px] font-bold uppercase text-blue-400 tracking-widest">ATIVAR SUPER MINERAÇÃO MISTA</span>
              </div>

              <button 
                onClick={handleProcessIAClick} 
                disabled={isDiscovering || isMixedMining || loading}
                className="flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-3 rounded-lg transition-all font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(37,99,235,0.3)] relative overflow-hidden"
              >
                {isMixedMining ? (
                  <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                    <div className="h-full bg-blue-400 transition-all duration-300 absolute left-0 opacity-20" style={{ width: `${(mixedProgress / Math.max(mixedTotal, 1)) * 100}%` }}></div>
                    <span className="relative z-10 text-[10px]">{(mixedProgress / Math.max(mixedTotal, 1) * 100).toFixed(0)}%</span>
                  </div>
                ) : isDiscovering ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                ) : <BrainCircuit size={16} />}
                {isMixedMining ? 'MINERANDO...' : 'PROCESSAR IA'}
              </button>

              {discovered.length > 0 && (
                <>
                  <button 
                    onClick={() => setShowExportModal(true)}
                    className="flex justify-center items-center gap-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-400 px-4 py-2 rounded-lg transition-all font-black text-[10px] uppercase tracking-[0.2em]"
                  >
                    <List size={14} /> GERAR PADRÕES
                  </button>

                  <hr className="border-white/5 my-1" />
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] text-purple-400 uppercase font-bold tracking-wider">Chat ID Telegram</label>
                    <input type="text" value={telegramId} onChange={(e) => setTelegramId(e.target.value)} placeholder="Ex: 5163579768" className="bg-[#12141c] border border-purple-500/30 text-white text-xs px-3 py-2 rounded-md outline-none focus:border-purple-500" />
                  </div>
                  <button 
                    onClick={handleSaveAllToVPS}
                    disabled={isSavingVPS || !telegramId}
                    className="flex justify-center items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                  >
                    {isSavingVPS ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div> : <Send size={14} />}
                    {isSavingVPS ? 'SALVANDO...' : `SALVAR ${discovered.length} NA VPS`}
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gradient-to-br from-[#050507] via-[#08080c] to-[#050507]">
          {discovered.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
               <BrainCircuit size={64} className="text-gray-600 mb-6" />
               <h2 className="text-xl font-black text-gray-400 uppercase tracking-widest mb-2">Configure os Filtros</h2>
               <p className="text-sm text-gray-500 max-w-sm">A IA está pronta para encontrar os padrões de ouro baseados nos seus filtros personalizados.</p>
             </div>
          ) : (
            <VirtuosoGrid useWindowScroll data={discovered} listClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" itemContent={(i, pat) => (

                <motion.div 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} 
                  key={pat.id} 
                  className={`bg-[#0a0a0f] border rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group shadow-lg transition-all ${pat.activeNow ? 'border-red-500 bg-red-600/5 scale-[1.02] shadow-[0_0_30px_rgba(239,68,68,0.25)] ring-1 ring-red-500/50' : 'border-white/5 hover:border-blue-500/30'}`}
                >
                  {pat.activeNow && (
                     <div className="absolute top-0 right-0 left-0 bg-red-600 text-white px-4 py-2.5 flex items-center justify-center gap-3 z-20 shadow-2xl border-b border-white/20 animate-pulse">
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">🔥 Estratégia em Operação</span>
                       <div className="flex items-center gap-2 bg-white text-red-600 px-3 py-1 rounded-lg font-black text-xs shadow-inner">
                         ENTRADA <span className="text-sm border-l border-red-100 pl-2 ml-1">{(pat.currentStep || 0) + 1}</span> / {pat.entries || entriesRange[1]}
                       </div>
                     </div>
                  )}
                  
                  <div className="flex flex-col z-10">
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-2 italic">
                      {pat.type === 'ONLY_COLORS' ? 'Cores Puras' : 
                       pat.type === 'ONLY_NUMBERS' ? 'Números Puros' : 
                       pat.type === 'COLORS_1_NUM' ? 'Cores + 1 Número' : 
                       pat.type === 'COLORS_2_NUM' ? 'Cores + 2 Números' :
                       pat.type === '1_NUM_COLORS' ? '1 Número + Cores' : '2 Números + Cores'}
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
              )}
            />
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


