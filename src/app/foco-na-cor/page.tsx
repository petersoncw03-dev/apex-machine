"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useSSE } from "@/contexts/SSEContext";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Flame, BrainCircuit, Activity, Settings, ChevronDown, Check, X, Bell, Search, Layers, Trash2 } from "lucide-react";

interface Roll {
  id?: string;
  color: string;
  roll: string | number;
  timestamp: string;
}

interface PatternElement {
  t: string;
  v: string | number;
}

interface DiscoveredPattern {
  id: string;
  entries: number;
  type: string;
  target: string;
  elements: PatternElement[];
  winRate: string;
  triggers: number;
  pastWinRate?: string;
  presentWinRate?: string;
}

interface ContratoSinal {
  id: string;
  galeNivel: number;
  alvo: 'Vermelho' | 'Preto' | 'Branco';
  status: 'PENDENTE' | 'GREEN' | 'RED';
  galeMaximo: number;
  galeAtual: number;
  rodadasRestantes: number;
}

interface EstrategiaAdicionada {
  id: string;
  nome: string;
  patterns: DiscoveredPattern[];
}

interface PlacarNivel {
  id: string;
  gale: number;
  w: number;
  l: number;
  historico: ('W' | 'L')[];
  estrategias: EstrategiaAdicionada[];
  currentW?: number;
  currentL?: number;
  maxW?: number;
  maxL?: number;
}

interface PlacarMaster {
  w: number;
  l: number;
  historico: ('W' | 'L')[];
  currentW?: number;
  currentL?: number;
  maxW?: number;
  maxL?: number;
}

export default function FocoNaCorPage() {
  const [data, setData] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);

  // --- CASA EXATA STATE ---
  const [historyHours, setHistoryHours] = useState(24);
  const [threshold, setThreshold] = useState(70);
  const historyOptions = [1, 2, 3, 4, 5, 6, 9, 12, 18, 24];

  // --- MATRIZ 2 PEDRAS STATE ---
  const [matrizHours, setMatrizHours] = useState(24);
  const [matrizThreshold, setMatrizThreshold] = useState(80);

  // --- PLACARES E CONTRATOS ---
  const [placares, setPlacares] = useState<Record<number, PlacarNivel>>({
     0: { id: '0', gale: 0, w: 0, l: 0, historico: [], estrategias: [] },
     1: { id: '1', gale: 1, w: 0, l: 0, historico: [], estrategias: [] },
     2: { id: '2', gale: 2, w: 0, l: 0, historico: [], estrategias: [] },
  });
  const [masterPlacar, setMasterPlacar] = useState<PlacarMaster>({ w: 0, l: 0, historico: [] });
  const [contratos, setContratos] = useState<ContratoSinal[]>([]);

  // --- ADVANCED FILTER STATE ---
  const [showFilterMenu, setShowFilterMenu] = useState(true);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [qtdEntradas, setQtdEntradas] = useState(1); // 1 = G0, 2 = G1
  const [periodHours, setPeriodHours] = useState(24);
  const [patternType, setPatternType] = useState('TODOS');
  const [minTriggers, setMinTriggers] = useState(5);
  const [minWinRate, setMinWinRate] = useState(90);
  const [maxPastWinRate, setMaxPastWinRate] = useState(40);
  const [maxSa, setMaxSa] = useState(2);
  const [minSaFilter, setMinSaFilter] = useState(0);
  const [selectedSize, setSelectedSize] = useState(0);
  const [useMixedMining, setUseMixedMining] = useState(false);
  const [lossMode, setLossMode] = useState<'CICLO' | 'ENTRADA'>('CICLO');
  const [trendMode, setTrendMode] = useState<'OFF' | 'RECOVERY' | 'CONSOLIDATED'>('OFF');
  const [trendPresentHours, setTrendPresentHours] = useState(1);
  const [selectedStrategyForDetails, setSelectedStrategyForDetails] = useState<{ gale: number, strategy: EstrategiaAdicionada } | null>(null);

  // --- PROCESSING STATE REMOVED ---
  const [isLoaded, setIsLoaded] = useState(false);

  const lastProcessedId = useRef<string | null>(null);
  const lastTriggeredId = useRef<string | null>(null);
  const voteHistoryRef = useRef<Record<string, 'Vermelho'|'Preto'|null>>({});

  // --- PERSISTENCE ---
  useEffect(() => {
      try {
          const ceH = localStorage.getItem('robo_ce_history');
          const ceT = localStorage.getItem('robo_ce_threshold');
          const m2H = localStorage.getItem('robo_m2_history');
          const m2T = localStorage.getItem('robo_m2_threshold');
          const estrats = localStorage.getItem('robo_placares_estrategias');

          // Filter config persistence
          const f_periodHours = localStorage.getItem('robo_filter_periodHours');
          const f_patternType = localStorage.getItem('robo_filter_patternType');
          const f_minTriggers = localStorage.getItem('robo_filter_minTriggers');
          const f_minWinRate = localStorage.getItem('robo_filter_minWinRate');
          const f_maxPastWinRate = localStorage.getItem('robo_filter_maxPastWinRate');
          const f_maxSa = localStorage.getItem('robo_filter_maxSa');
          const f_minSaFilter = localStorage.getItem('robo_filter_minSaFilter');
          const f_useMixedMining = localStorage.getItem('robo_filter_useMixedMining');
          const f_lossMode = localStorage.getItem('robo_filter_lossMode');
          const f_trendMode = localStorage.getItem('robo_filter_trendMode');
          const f_trendPresentHours = localStorage.getItem('robo_filter_trendPresentHours');
          const f_qtdEntradas = localStorage.getItem('robo_filter_qtdEntradas');

          if (ceH) setHistoryHours(Number(ceH));
          if (ceT) setThreshold(Number(ceT));
          if (m2H) setMatrizHours(Number(m2H));
          if (m2T) setMatrizThreshold(Number(m2T));
          
          if (f_periodHours) setPeriodHours(Number(f_periodHours));
          if (f_patternType) setPatternType(f_patternType);
          if (f_minTriggers) setMinTriggers(Number(f_minTriggers));
          if (f_minWinRate) setMinWinRate(Number(f_minWinRate));
          if (f_maxPastWinRate) setMaxPastWinRate(Number(f_maxPastWinRate));
          if (f_maxSa) setMaxSa(Number(f_maxSa));
          if (f_minSaFilter) setMinSaFilter(Number(f_minSaFilter));
          if (f_useMixedMining) setUseMixedMining(f_useMixedMining === 'true');
          if (f_lossMode) setLossMode(f_lossMode as any);
          if (f_trendMode) setTrendMode(f_trendMode as any);
          if (f_trendPresentHours) setTrendPresentHours(Number(f_trendPresentHours));
          if (f_qtdEntradas) setQtdEntradas(Number(f_qtdEntradas));

          if (estrats) {
              const parsed = JSON.parse(estrats);
              setPlacares(prev => ({
                 0: { ...prev[0], estrategias: parsed[0] || [] },
                 1: { ...prev[1], estrategias: parsed[1] || [] },
                 2: { ...prev[2], estrategias: parsed[2] || [] }
              }));
          }
      } catch(e) {}
      setIsLoaded(true);
  }, []);

  useEffect(() => { if(isLoaded) { localStorage.setItem('robo_ce_history', historyHours.toString()); localStorage.setItem('robo_ce_threshold', threshold.toString()); } }, [historyHours, threshold, isLoaded]);
  useEffect(() => { if(isLoaded) { localStorage.setItem('robo_m2_history', matrizHours.toString()); localStorage.setItem('robo_m2_threshold', matrizThreshold.toString()); } }, [matrizHours, matrizThreshold, isLoaded]);

  // Save filter configs
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('robo_filter_periodHours', periodHours.toString());
  }, [periodHours, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('robo_filter_patternType', patternType);
  }, [patternType, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('robo_filter_minTriggers', minTriggers.toString());
  }, [minTriggers, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('robo_filter_minWinRate', minWinRate.toString());
  }, [minWinRate, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('robo_filter_maxPastWinRate', maxPastWinRate.toString());
  }, [maxPastWinRate, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('robo_filter_maxSa', maxSa.toString());
  }, [maxSa, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('robo_filter_minSaFilter', minSaFilter.toString());
  }, [minSaFilter, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('robo_filter_useMixedMining', useMixedMining.toString());
  }, [useMixedMining, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('robo_filter_lossMode', lossMode);
  }, [lossMode, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('robo_filter_trendMode', trendMode);
  }, [trendMode, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('robo_filter_trendPresentHours', trendPresentHours.toString());
  }, [trendPresentHours, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('robo_filter_qtdEntradas', qtdEntradas.toString());
  }, [qtdEntradas, isLoaded]);

  const getCicloAtual = (history: ('W'|'L')[]) => {
      if (!history || history.length === 0) return { type: null, count: 0 };
      const last = history[history.length - 1];
      let count = 0;
      for (let i = history.length - 1; i >= 0; i--) {
          if (history[i] === last) count++;
          else break;
      }
      return { type: last, count };
  };

  const resetPlacar = (gale: number | 'master') => {
       if (gale === 'master') {
           setMasterPlacar({ w: 0, l: 0, historico: [], currentW: 0, currentL: 0, maxW: 0, maxL: 0 });
       } else {
           setPlacares(prev => ({
              ...prev,
              [gale]: { ...prev[gale], w: 0, l: 0, historico: [], currentW: 0, currentL: 0, maxW: 0, maxL: 0 }
           }));
       }
  };

  // Fetch Data
  const fetchData = async () => {
    try {
      const res = await fetch(`/api/results/period?hours=24`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        const mappedData = json.data.map((r: any) => ({
          ...r,
          color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(),
          roll: r.roll?.toString()
        }));
        setData(mappedData.sort((a:any, b:any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      }
    } catch (e) {} finally { setLoading(false); }
  };

  const { subscribe } = useSSE();

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const unsub = subscribe((mappedRoll) => {
      setData(prevData => {
        if (prevData.some(r => r.id === mappedRoll.id)) return prevData;
        return [...prevData, mappedRoll].slice(-5000);
      });
    });
    return unsub;
  }, [subscribe]);


  const getCol = (r: Roll | string) => {
    if (!r) return 'B';
    const rollStr = typeof r === 'string' ? r : r.roll;
    const n = parseInt(rollStr as string);
    if ((typeof r !== 'string' && r.color.includes('Vermelho')) || (n >= 1 && n <= 7)) return 'V';
    if ((typeof r !== 'string' && r.color.includes('Preto')) || (n >= 8 && n <= 14)) return 'P';
    return 'B';
  };

  const evaluateHit = (rollObj: Roll, target: string) => {
    if (!rollObj) return false;
    const n = parseInt(rollObj.roll as string);
    const isBranco = n === 0 || rollObj.color.includes('Branco');
    const isVermelho = rollObj.color.includes('Vermelho') || (n >= 1 && n <= 7);
    const isPreto = rollObj.color.includes('Preto') || (n >= 8 && n <= 14);

    const t = target.toUpperCase();
    if (t === 'BRANCO' || t === 'BCO') return isBranco;
    if (t === 'VERMELHO' || t === 'V') return isVermelho || isBranco;
    if (t === 'PRETO' || t === 'P') return isPreto || isBranco;
    return false;
  };

  const checkPatternTrigger = (history: Roll[], elements: PatternElement[]) => {
      if (history.length < elements.length) return false;
      for(let i=0; i<elements.length; i++) {
          const roll = history[history.length - elements.length + i];
          const el = elements[i];
          if (el.t === 'c') {
              const c = getCol(roll);
              if (c !== el.v) return false;
          } else {
              if (roll.roll !== el.v) return false;
          }
      }
      return true;
  };

  // --- MOTOR MÁQUINA DE ESTADOS (PLACAR) ---
  useEffect(() => {
    if (!data.length) return;
    const latest = data[data.length - 1];
    if (lastProcessedId.current === latest.id) return;
    lastProcessedId.current = latest.id ?? null;

    const isVermelho = latest.color.includes('Vermelho') || (parseInt(latest.roll as string) >= 1 && parseInt(latest.roll as string) <= 7);
    const isPreto = latest.color.includes('Preto') || (parseInt(latest.roll as string) >= 8 && parseInt(latest.roll as string) <= 14);
    const isBranco = latest.color.includes('Branco') || parseInt(latest.roll as string) === 0;

    const resultsToRegister: { gale: number, tipo: 'W'|'L' }[] = [];
    const localPendingMaster: ('W'|'L')[] = [];
    const nextContratos = [...contratos];

    // Avaliação do Indicador Master
    const previousId = data.length > 1 ? data[data.length - 2].id : null;
    const masterVoteParaEstaRodada = previousId ? voteHistoryRef.current[previousId] : null;

    if (masterVoteParaEstaRodada) {
         let bateuMaster = false;
         if (masterVoteParaEstaRodada === 'Vermelho' && isVermelho) bateuMaster = true;
         if (masterVoteParaEstaRodada === 'Preto' && isPreto) bateuMaster = true;
         
         localPendingMaster.push(bateuMaster ? 'W' : 'L');
    }

    nextContratos.forEach(contrato => {
       if (contrato.status !== 'PENDENTE') return;

       let bateu = false;
       if (contrato.alvo === 'Vermelho' && isVermelho) bateu = true;
       if (contrato.alvo === 'Preto' && isPreto) bateu = true;

       if (bateu) {
          contrato.status = 'GREEN';
          resultsToRegister.push({ gale: contrato.galeNivel, tipo: 'W' });
       } else if (isBranco) {
          // Se cair branco, é LOSS imediato! Não vai para o Gale!
          contrato.status = 'RED';
          resultsToRegister.push({ gale: contrato.galeNivel, tipo: 'L' });
       } else {
          if (contrato.galeAtual < contrato.galeMaximo) {
             contrato.galeAtual++;
             contrato.rodadasRestantes--;
             resultsToRegister.push({ gale: contrato.galeNivel, tipo: 'L' }); // Loss na entrada
          } else {
             contrato.status = 'RED';
             resultsToRegister.push({ gale: contrato.galeNivel, tipo: 'L' }); // Loss final
          }
       }
    });

    const ativos = nextContratos.filter(c => c.status === 'PENDENTE');
    setContratos(ativos);

    if (resultsToRegister.length > 0) {
        setPlacares(prev => {
            const next = { ...prev };
            resultsToRegister.forEach(({ gale, tipo }) => {
                const p = next[gale];
                let ncw = p.currentW || 0;
                let ncl = p.currentL || 0;
                let nmw = p.maxW || 0;
                let nml = p.maxL || 0;
                
                if (tipo === 'W') {
                    ncw++; ncl = 0; if (ncw > nmw) nmw = ncw;
                } else {
                    ncl++; ncw = 0; if (ncl > nml) nml = ncl;
                }
                
                next[gale] = {
                    ...p,
                    w: tipo === 'W' ? p.w + 1 : p.w,
                    l: tipo === 'L' ? p.l + 1 : p.l,
                    currentW: ncw, currentL: ncl, maxW: nmw, maxL: nml,
                    historico: [...p.historico, tipo].slice(-50)
                };
            });
            return next;
        });
    }

    if (localPendingMaster.length > 0) {
        setMasterPlacar(prev => {
            let nw = prev.w;
            let nl = prev.l;
            let nh = [...prev.historico];
            let ncw = prev.currentW || 0;
            let ncl = prev.currentL || 0;
            let nmw = prev.maxW || 0;
            let nml = prev.maxL || 0;
            
            localPendingMaster.forEach(tipo => {
                if (tipo === 'W') {
                    nw++; ncw++; ncl = 0; if (ncw > nmw) nmw = ncw;
                }
                if (tipo === 'L') {
                    nl++; ncl++; ncw = 0; if (ncl > nml) nml = ncl;
                }
                nh.push(tipo);
            });
            return { w: nw, l: nl, historico: nh.slice(-50), currentW: ncw, currentL: ncl, maxW: nmw, maxL: nml };
        });
    }

  }, [data, contratos]);

  // ENCONTRAR NOVOS GATILHOS
  useEffect(() => {
      if (!data.length) return;
      const latest = data[data.length - 1];
      if (lastTriggeredId.current === latest.id) return;
      lastTriggeredId.current = latest.id ?? null;

      let hasNewTriggers = false;
      const novosContratos = [...contratos];
      
      [0, 1, 2].forEach(gale => {
          if (novosContratos.some(c => c.galeNivel === gale && c.status === 'PENDENTE')) return; 
          
          const estrategias = placares[gale]?.estrategias || [];
          for (const est of estrategias) {
              for (const pat of est.patterns) {
                  if (checkPatternTrigger(data, pat.elements)) {
                      novosContratos.push({
                          id: Date.now().toString() + Math.random(),
                          galeNivel: gale,
                          alvo: pat.target as any,
                          status: 'PENDENTE',
                          galeMaximo: gale,
                          galeAtual: 0,
                          rodadasRestantes: gale + 1
                      });
                      hasNewTriggers = true;
                      return;
                  }
              }
          }
      });

      if (hasNewTriggers) {
          setContratos(novosContratos);
      }
  }, [data, placares, contratos]);


  // --- MOTOR DE MINERAÇÃO (REUTILIZADO DO RADAR) ---
  const computePatternsForConfig = (config: any, currentData: Roll[]) => {
    if (!currentData || currentData.length < 10) return [];
    
    const { periodHours, patternType, entriesRange, minTriggers, minWinRate, maxPastWinRate, maxSa, minSaFilter, selectedSize, useMixedMining, lossMode, trendMode, trendPresentHours } = config;
    const [minEntries, maxEntries] = entriesRange;
    const history = currentData.slice(-periodHours * 120);
    
    const presentRolls = (trendPresentHours || 1) * 120;
    const validPresentRolls = Math.min(presentRolls, history.length - 120);
    const midIndex = trendMode && trendMode !== 'OFF' ? Math.max(0, history.length - validPresentRolls) : Math.floor(history.length / 2);
    
    const patternState: Record<string, any> = {};
    const activeKeys = new Set<string>();
    
    const typesToTest = patternType === 'TODOS' 
      ? ['ONLY_COLORS', 'ONLY_NUMBERS', 'COLORS_1_NUM', 'COLORS_2_NUM', '1_NUM_COLORS', '2_NUM_COLORS'] 
      : [patternType];

    const discoveryTargets = ['Vermelho', 'Preto'];

    for (let i = 0; i < history.length; i++) {
      for (const key of activeKeys) {
          const state = patternState[key];
          let anyActive = false;
          
          if (lossMode === 'CICLO') {
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
          } else {
              const eState = state.entriesData[maxEntries];
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
      
      if (trendMode && trendMode !== 'OFF' && i === midIndex) {
         for (const key of Object.keys(patternState)) {
             const state = patternState[key];
             for (const e in state.entriesData) {
                 state.entriesData[e].pastWins = state.entriesData[e].wins;
                 state.entriesData[e].pastTriggers = state.entriesData[e].triggers;
             }
         }
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
            if (useMixedMining && totalLen <= 4) {
               for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
            } else {
              if (type === 'ONLY_COLORS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
              } else if (type === 'COLORS_1_NUM') {
                for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
                elements.push({t:'n', v: history[i].roll});
              } else if (type === '1_NUM_COLORS') {
                elements.push({t:'n', v: history[startIdx].roll});
                for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])});
              } else {
                for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[startIdx+p])}); 
              }
            }

            if (elements.length === 0) continue;
            if (type !== 'ONLY_NUMBERS' && elements.some(e => e.t === 'n' && e.v === '0')) continue;

            const key = target + ':' + type + ':' + elements.map(e => e.t + e.v).join('|');
            if (!patternState[key]) {
                patternState[key] = { type, target, elements, entriesData: {} };
                if (lossMode === 'CICLO') {
                    for (let e = minEntries; e <= maxEntries; e++) {
                        patternState[key].entriesData[e] = { triggers: 0, wins: 0, pastWins: 0, pastTriggers: 0, sm: 0, currentSa: 0, activeEntriesLeft: 0 };
                    }
                } else {
                    patternState[key].entriesData[maxEntries] = { triggers: 0, wins: 0, pastWins: 0, pastTriggers: 0, sm: 0, currentSa: 0, activeEntriesLeft: 0 };
                }
            }
            
            if (lossMode === 'CICLO') {
                for (let e = minEntries; e <= maxEntries; e++) {
                    patternState[key].entriesData[e].triggers++;
                    patternState[key].entriesData[e].activeEntriesLeft = e;
                }
            } else {
                patternState[key].entriesData[maxEntries].triggers++;
                patternState[key].entriesData[maxEntries].activeEntriesLeft = maxEntries;
            }
            activeKeys.add(key);
          }
        }
      }
    }
    
    const results: DiscoveredPattern[] = [];
    Object.entries(patternState).forEach(([k, v]) => {
       const keysToLoop = lossMode === 'CICLO' ? Array.from({length: maxEntries - minEntries + 1}, (_, i) => minEntries + i) : [maxEntries];
       for (const e of keysToLoop) {
           const eState = v.entriesData[e];
           const totalTriggers = eState.triggers;
           const totalWins = eState.wins;
           
           let valid = false;
           
           if (!trendMode || trendMode === 'OFF') {
               const wr = totalTriggers > 0 ? (totalWins / totalTriggers) * 100 : 0;
               if (totalTriggers >= minTriggers && wr >= minWinRate && eState.sm <= maxSa && eState.currentSa >= minSaFilter) {
                   valid = true;
               }
           } else {
               const pastTriggers = eState.pastTriggers;
               const pastWins = eState.pastWins;
               const presentTriggers = totalTriggers - pastTriggers;
               const presentWins = totalWins - pastWins;
               
               const pastWr = pastTriggers > 0 ? (pastWins / pastTriggers) * 100 : 0;
               const presentWr = presentTriggers > 0 ? (presentWins / presentTriggers) * 100 : 0;
               
               if (presentTriggers >= 1 && presentWr >= minWinRate && eState.sm <= maxSa) {
                   if (trendMode === 'RECOVERY' && pastWr <= maxPastWinRate) valid = true;
                   if (trendMode === 'CONSOLIDATED' && pastWr >= minWinRate) valid = true;
               }
           }
           
           if (valid && e === maxEntries) {
              const wr = ((totalWins / Math.max(1, totalTriggers)) * 100).toFixed(1);
               
               let pastWrStr: string | undefined = undefined;
               let presentWrStr: string | undefined = undefined;
               
               if (trendMode && trendMode !== 'OFF') {
                  const pastTriggers = eState.pastTriggers;
                  const pastWins = eState.pastWins;
                  const presentTriggers = totalTriggers - pastTriggers;
                  const presentWins = totalWins - pastWins;
                  
                  pastWrStr = (pastTriggers > 0 ? (pastWins / pastTriggers) * 100 : 0).toFixed(1);
                  presentWrStr = (presentTriggers > 0 ? (presentWins / presentTriggers) * 100 : 0).toFixed(1);
               }
              results.push({
                 id: k + '|ENT_' + e,
                 entries: e,
                 type: v.type, elements: v.elements, winRate: wr,
                  pastWinRate: pastWrStr,
                  presentWinRate: presentWrStr,
                 triggers: totalTriggers, target: v.target
              });
           }
       }
    });
    
    return results;
  };

  const handleAddFilter = () => {
    setIsDiscovering(true);
    setTimeout(() => {
        const gale = qtdEntradas - 1;
        if (gale < 0 || gale > 2) { alert("Suporta apenas G0, G1 e G2!"); setIsDiscovering(false); return; }
        
        const config = { periodHours, patternType, entriesRange: [1, qtdEntradas], minTriggers, minWinRate, maxPastWinRate, maxSa, minSaFilter, selectedSize, useMixedMining, lossMode, trendMode, trendPresentHours };
        const patterns = computePatternsForConfig(config, data);
        
        if (patterns.length === 0) {
            alert(`Nenhum padrão atende a esses filtros rigorosos para G${gale}! Tente diminuir o WinRate ou Mín Triggers.`);
            setIsDiscovering(false);
            return;
        }

        const nova: EstrategiaAdicionada = {
            id: Date.now().toString(),
            nome: `Estratégia G${gale} (${minWinRate}%)`,
            patterns
        };

        setPlacares(prev => {
            const next = {
                ...prev,
                [gale]: {
                    ...prev[gale],
                    estrategias: [...prev[gale].estrategias, nova]
                }
            };
            const e = { 0: next[0].estrategias, 1: next[1].estrategias, 2: next[2].estrategias };
            localStorage.setItem('robo_placares_estrategias', JSON.stringify(e));
            return next;
        });

        setIsDiscovering(false);
        setShowFilterMenu(false);
    }, 100);
  };

  const deleteEstrategia = (gale: number, id: string) => {
      setPlacares(prev => {
          const next = {
              ...prev,
              [gale]: {
                  ...prev[gale],
                  estrategias: prev[gale].estrategias.filter(e => e.id !== id)
              }
          };
          const e = { 0: next[0].estrategias, 1: next[1].estrategias, 2: next[2].estrategias };
          localStorage.setItem('robo_placares_estrategias', JSON.stringify(e));
          return next;
      });
  };

  // --- CASA EXATA LOGIC ---
  const { stats, activeCells } = useMemo(() => {
    if (!data.length) return { stats: [], activeCells: [] };
    const rollsCount = historyHours * 120;
    const history = data.slice(-rollsCount);
    const mat: { r: number, b: number }[][] = Array.from({ length: 15 }, () => Array.from({ length: 7 }, () => ({ r: 0, b: 0 })));

    for (let i = 0; i < history.length - 1; i++) {
      const stone = parseInt(history[i].roll as string);
      if (isNaN(stone)) continue;
      for (let offset = 1; offset <= 7; offset++) {
        if (i + offset < history.length) {
          const nextCol = getCol(history[i + offset]);
          if (nextCol === 'V') mat[stone][offset - 1].r++;
          if (nextCol === 'P') mat[stone][offset - 1].b++;
        }
      }
    }
    const recent = data.slice(-7).reverse();
    const actives = recent.map((r, idx) => ({ stone: parseInt(r.roll as string), offset: idx + 1 }));
    return { stats: mat, activeCells: actives };
  }, [data, historyHours]);

  // --- MATRIZ 2 PEDRAS LOGIC ---
  const matriz2Pedras = useMemo(() => {
    if (!data.length || data.length < 2) return { actives: [] };
    const rollsCount = matrizHours * 120;
    const history = data.slice(-rollsCount);
    
    const recentPairs: {p1: number, p2: number, offset: number}[] = [];
    for(let i=0; i<7; i++) {
        if(history.length - 1 - i - 1 >= 0) {
            const r2 = parseInt(history[history.length - 1 - i].roll as string);
            const r1 = parseInt(history[history.length - 1 - i - 1].roll as string);
            if(!isNaN(r1) && !isNaN(r2)) recentPairs.push({ p1: r1, p2: r2, offset: i + 1 });
        }
    }

    const results = recentPairs.map(rp => {
        let r = 0; let b = 0;
        for (let i = 0; i < history.length - rp.offset - 1; i++) {
            if (parseInt(history[i].roll as string) === rp.p1 && parseInt(history[i+1].roll as string) === rp.p2) {
                const targetIdx = i + 1 + rp.offset;
                if (targetIdx < history.length) {
                    const nextCol = getCol(history[targetIdx]);
                    if (nextCol === 'V') r++;
                    if (nextCol === 'P') b++;
                }
            }
        }
        return { ...rp, r, b };
    });

    return { actives: results };
  }, [data, matrizHours]);

  // --- COMBINED SIGNALS (VS BALLS) E GALE SIGNALS ---
  const galeSignals = useMemo(() => {
     const gs = { 0: { r: 0, b: 0 }, 1: { r: 0, b: 0 }, 2: { r: 0, b: 0 } };
     [0, 1, 2].forEach(gale => {
        placares[gale].estrategias.forEach(est => {
            est.patterns.forEach(pat => {
                if (checkPatternTrigger(data, pat.elements)) {
                    if (pat.target === 'Vermelho') gs[gale as 0|1|2].r++;
                    if (pat.target === 'Preto') gs[gale as 0|1|2].b++;
                }
            });
        });
     });
     return gs;
  }, [data, placares]);

  const { signalsRed, signalsBlack } = useMemo(() => {
    let masterR = 0;
    let masterB = 0;

    // 1. Voto do Placar G0
    if (galeSignals[0].r > galeSignals[0].b) masterR++;
    else if (galeSignals[0].b > galeSignals[0].r) masterB++;

    // 2. Voto do Placar G1
    if (galeSignals[1].r > galeSignals[1].b) masterR++;
    else if (galeSignals[1].b > galeSignals[1].r) masterB++;

    // 3. Voto do Placar G2
    if (galeSignals[2].r > galeSignals[2].b) masterR++;
    else if (galeSignals[2].b > galeSignals[2].r) masterB++;

    // 4. Voto da Casa Exata
    let ceR = 0;
    let ceB = 0;
    activeCells.forEach(({ stone, offset }) => {
      if (stone >= 0 && stone <= 14 && offset >= 1 && offset <= 7) {
        const cell = stats[stone][offset - 1];
        const total = cell.r + cell.b;
        if (total > 0) {
          if ((cell.r / total) * 100 >= threshold) ceR++;
          else if ((cell.b / total) * 100 >= threshold) ceB++;
        }
      }
    });
    if (ceR > ceB) masterR++;
    else if (ceB > ceR) masterB++;

    // 5. Voto da Matriz 2 Pedras
    let mR = 0;
    let mB = 0;
    matriz2Pedras.actives.forEach(act => {
        const total = act.r + act.b;
        if (total > 0) {
            if ((act.r / total) * 100 >= matrizThreshold) mR++;
            else if ((act.b / total) * 100 >= matrizThreshold) mB++;
        }
    });
    if (mR > mB) masterR++;
    else if (mB > mR) masterB++;

    return { signalsRed: masterR, signalsBlack: masterB };
  }, [galeSignals, stats, activeCells, threshold, matriz2Pedras, matrizThreshold]);

  // Registro de Histórico de Votos para a próxima rodada
  const currentVote = signalsRed > signalsBlack ? 'Vermelho' : signalsBlack > signalsRed ? 'Preto' : null;
  if (data.length > 0) {
      voteHistoryRef.current[data[data.length - 1].id as string] = currentVote;
  }

  const renderCiclosGrouped = (history: ('W'|'L')[]) => {
      if (!history || history.length === 0) return <span className="text-[10px] text-gray-600">Aguardando sinais...</span>;
      const groups: {type: 'W'|'L', count: number}[] = [];
      let current = history[0];
      let count = 1;
      for(let i=1; i<history.length; i++){
          if(history[i] === current) count++;
          else {
              groups.push({ type: current, count });
              current = history[i];
              count = 1;
          }
      }
      groups.push({ type: current, count });

      return (
          <div className="flex flex-wrap gap-1 mt-1">
              {groups.slice(-12).map((g, idx) => (
                  <div key={idx} className={`flex items-center justify-center min-w-[20px] px-1.5 h-5 rounded-[4px] text-[10px] font-black border ${
                      g.type === 'W' 
                      ? 'bg-[#4ade80]/20 border-[#4ade80]/50 text-[#4ade80] shadow-[0_0_10px_rgba(74,222,128,0.2)]' 
                      : 'bg-[#f12c4c]/20 border-[#f12c4c]/50 text-[#f12c4c]'
                  }`}>
                      {g.count}
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col relative pb-20">
      <div className="bg-[#0a0a0f] border-b border-white/5 p-4 flex items-center justify-between shadow-xl z-40 sticky top-0">
        <h1 className="text-xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 flex items-center gap-2">
          <Target className="text-orange-500" />
          FOCO NA COR
        </h1>
        <div className="text-xs font-bold text-gray-500 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
          {data.length} pedras na memória
        </div>
      </div>

      <main className="flex-1 p-6 flex flex-col gap-8 max-w-7xl mx-auto w-full">

        {/* TENDÊNCIA DA MESA */}
        <section className="bg-[#0a0a0f] p-4 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-3">
          <h2 className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Tendência da Mesa</h2>
          <div className="flex flex-wrap gap-1.5 pb-2">
            {data.length === 0 ? (
               <div className="text-xs text-gray-500 font-bold px-2 py-1 animate-pulse border border-dashed border-white/10 rounded-lg w-full">Buscando as últimas pedras do servidor...</div>
            ) : (
               data.slice(-25).map((r, i) => {
                 const n = parseInt(r.roll as string);
                 let bg = 'bg-gray-800 text-white';
                 if (r.color.includes('Vermelho') || (n >= 1 && n <= 7)) bg = 'bg-[#f12c4c] text-white';
                 if (r.color.includes('Preto') || (n >= 8 && n <= 14)) bg = 'bg-[#262831] text-white border border-white/10';
                 if (n === 0 || r.color.includes('Branco')) bg = 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.4)]';
                 return (
                   <div key={i} className={`flex-shrink-0 w-7 h-7 rounded-[4px] flex items-center justify-center font-black text-[10px] ${bg}`}>
                     {r.roll}
                   </div>
                 );
               })
            )}
          </div>
        </section>

        {/* COR QUENTE MASTER CARD */}
        <section className="bg-gradient-to-b from-[#0a0a0f] to-[#07070a] p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden flex flex-col gap-8">
           <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 opacity-50"></div>
           
           {/* Processamento em tempo real, sem modal obstrutivo */}

           <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1 flex flex-col items-center">
                 <h2 className="text-sm font-black uppercase tracking-[0.3em] text-gray-400 flex items-center justify-center gap-2 mb-4">
                    <Flame size={16} className="text-orange-500" /> Indicador Master de Sinais
                 </h2>
                 <div className="flex justify-center items-center gap-12">
                    {/* RED BALL */}
                    <div className="flex flex-col items-center gap-4">
                      <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500
                        ${signalsRed > signalsBlack ? 'shadow-[0_0_50px_rgba(241,44,76,0.6)] scale-110' : 'shadow-lg scale-95 opacity-50'}
                      `}>
                        <div className={`absolute inset-0 rounded-full border-4 transition-all duration-500 ${signalsRed > signalsBlack ? 'border-[#39ff14] animate-pulse' : 'border-transparent'}`}></div>
                        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#f12c4c] to-[#90001a] border-4 border-white/10 shadow-inner flex items-center justify-center">
                          <span className="text-4xl font-black text-white drop-shadow-md">{signalsRed}</span>
                        </div>
                      </div>
                      <span className="font-black tracking-wider text-[#f12c4c] uppercase">Vermelho</span>
                    </div>

                    <div className="text-gray-600 font-black text-xl">VS</div>

                    {/* BLACK BALL */}
                    <div className="flex flex-col items-center gap-4">
                      <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500
                        ${signalsBlack > signalsRed ? 'shadow-[0_0_50px_rgba(38,40,49,0.9)] scale-110' : 'shadow-lg scale-95 opacity-50'}
                      `}>
                        <div className={`absolute inset-0 rounded-full border-4 transition-all duration-500 ${signalsBlack > signalsRed ? 'border-[#39ff14] animate-pulse' : 'border-transparent'}`}></div>
                        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#262831] to-[#121318] border-4 border-white/10 shadow-inner flex items-center justify-center">
                          <span className="text-4xl font-black text-white drop-shadow-md">{signalsBlack}</span>
                        </div>
                      </div>
                      <span className="font-black tracking-wider text-gray-300 uppercase">Preto</span>
                    </div>
                 </div>
              </div>
              
              {/* MASTER PLACAR SOMA */}
              <div className="flex-[0.6] w-full bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center shadow-xl relative overflow-hidden">
                 <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-2">Placar Mestre (Soma Geral)</span>
                 
                 <div className="flex gap-4 mt-1 mb-4">
                    <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded">
                       <span className="text-[8px] uppercase font-bold text-gray-500">Máxima Win:</span>
                       <span className="text-xs text-green-400 font-black">{masterPlacar.maxW || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded">
                       <span className="text-[8px] uppercase font-bold text-gray-500">Máxima Loss:</span>
                       <span className="text-xs text-red-400 font-black">{masterPlacar.maxL || 0}</span>
                    </div>
                 </div>

                 <div className="flex gap-8 items-center">
                    <div className="flex flex-col items-center"><span className="text-4xl font-black text-[#4ade80]">{masterPlacar.w}</span><span className="text-[10px] uppercase font-bold text-gray-500 mt-1">WINS</span></div>
                    <div className="flex flex-col items-center"><span className="text-4xl font-black text-[#f12c4c]">{masterPlacar.l}</span><span className="text-[10px] uppercase font-bold text-gray-500 mt-1">LOSS</span></div>
                 </div>
                 <div className="mt-4 w-full flex justify-center border-t border-white/5 pt-4">
                    {renderCiclosGrouped(masterPlacar.historico)}
                 </div>

                 <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5 w-full justify-center">
                     <button onClick={() => resetPlacar('master')} className="text-[9px] uppercase font-black bg-white/5 hover:bg-white/10 px-4 py-2 rounded text-gray-400 transition-colors">Resetar Placar Mestre</button>
                 </div>
              </div>
           </div>

           <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-2" />

           {/* G0, G1, G2 COLUMNS */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[0, 1, 2].map(gale => {
                 const gS = galeSignals[gale as 0|1|2];
                 const activeContract = contratos.find(c => c.galeNivel === gale && c.status === 'PENDENTE');

                 return (
                 <div key={gale} className="bg-[#12141c] border border-white/5 rounded-2xl p-4 flex flex-col gap-4 shadow-lg relative overflow-hidden transition-all">
                    
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                       <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs">G{gale}</div>
                          <span className="text-xs font-black uppercase text-white">Placar {gale===0?'Mão Fixa':`${gale} Gale`}</span>
                       </div>
                       <div className="flex gap-3 bg-black/50 px-3 py-1 rounded-lg border border-white/5">
                          <span className="text-xs font-black text-[#4ade80]">{placares[gale].w}W</span>
                          <span className="text-xs font-black text-[#f12c4c]">{placares[gale].l}L</span>
                       </div>
                    </div>
                    
                    <div className="flex justify-center gap-4 py-2 border-b border-white/5 bg-black/20 rounded-lg">
                       <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border transition-all ${gS.r > gS.b ? 'border-[#39ff14] bg-[#f12c4c] scale-110 shadow-[0_0_10px_rgba(241,44,76,0.5)]' : 'border-transparent bg-[#f12c4c]/30'}`}>
                             {gS.r}
                          </div>
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Vermelho</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <span className="text-[9px] text-gray-500 font-bold uppercase">Preto</span>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border transition-all ${gS.b > gS.r ? 'border-[#39ff14] bg-[#262831] scale-110 shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'border-transparent bg-[#262831]/50'}`}>
                             {gS.b}
                          </div>
                       </div>
                    </div>

                    <div className="min-h-[40px] flex justify-center">
                       {renderCiclosGrouped(placares[gale].historico)}
                    </div>

                    {activeContract && (
                        <div className="mt-1 bg-yellow-500/10 border border-yellow-500/50 p-2.5 rounded-xl flex justify-between items-center animate-pulse shadow-inner">
                           <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                              <span className="text-[10px] font-black text-yellow-500 uppercase">Apostando Agora</span>
                           </div>
                           <span className={`text-[10px] font-black px-2 py-1 rounded shadow-md border ${activeContract.alvo === 'Vermelho' ? 'bg-[#f12c4c] text-white border-red-400' : 'bg-[#262831] text-white border-gray-600'}`}>
                               {activeContract.alvo.toUpperCase()} (G{activeContract.galeAtual})
                           </span>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-2 mt-1 pt-3 border-t border-white/5 justify-between">
                        <button onClick={() => resetPlacar(gale)} className="text-[8px] uppercase font-black bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded text-gray-400 transition-colors">Reset</button>
                        <div className="flex gap-2">
                           <div className="flex items-center gap-1 bg-black/40 px-1.5 py-1 rounded">
                              <span className="text-[7px] uppercase font-bold text-gray-500">Máx Win:</span>
                              <span className="text-[10px] text-green-400 font-black">{placares[gale].maxW || 0}</span>
                           </div>
                           <div className="flex items-center gap-1 bg-black/40 px-1.5 py-1 rounded">
                              <span className="text-[7px] uppercase font-bold text-gray-500">Máx Loss:</span>
                              <span className="text-[10px] text-red-400 font-black">{placares[gale].maxL || 0}</span>
                           </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-1">
                       <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest border-t border-white/5 pt-2">
                          Estratégias Adicionadas ({placares[gale].estrategias.length})
                       </span>
                       {placares[gale].estrategias.map(est => (
                          <div key={est.id} onClick={() => setSelectedStrategyForDetails({ gale, strategy: est })} className="bg-[#0a0a0f] p-3 rounded-xl border border-white/5 flex justify-between items-center relative hover:border-white/20 transition-all cursor-pointer group">
                             <span className="text-[10px] font-black uppercase text-gray-400 truncate max-w-[110px]">{est.nome}</span>
                             <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{est.patterns.length} Padrões</span>
                                <button onClick={(e) => { e.stopPropagation(); deleteEstrategia(gale, est.id); }} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 p-1.5 rounded-lg transition-colors" title="Excluir estratégia">
                                   <Trash2 size={12} />
                                </button>
                             </div>
                          </div>
                       ))}
                       {placares[gale].estrategias.length === 0 && (
                          <div className="text-[10px] text-gray-600 font-bold uppercase text-center py-4 border border-dashed border-white/5 rounded-xl">
                             Vazio. Adicione filtros.
                          </div>
                       )}
                    </div>
                 </div>
                 );
              })}
           </div>
        </section>


        {/* FILTROS IA (ADVANCED) */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-300 flex items-center gap-2">
              <Search size={16} className="text-blue-500" /> FÁBRICA DE ESTRATÉGIAS
            </h2>
            <button onClick={() => setShowFilterMenu(!showFilterMenu)} className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded font-bold transition-all border border-white/5 flex items-center gap-2">
               {showFilterMenu ? 'Recolher Menu' : 'Expandir Filtros'} <ChevronDown size={12} className={showFilterMenu ? 'rotate-180' : ''}/>
            </button>
          </div>

          <AnimatePresence>
            {showFilterMenu && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="bg-[#0a0a0f] border border-white/5 rounded-xl p-5 shadow-lg flex flex-col gap-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-500">Padrão</label>
                      <select value={patternType} onChange={e => setPatternType(e.target.value)} className="bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-white font-semibold outline-none focus:border-blue-500/50">
                        <option value="TODOS">Todas as Variações</option>
                        <option value="ONLY_COLORS">Somente Cores</option>
                        <option value="ONLY_NUMBERS">Somente Números</option>
                        <option value="COLORS_1_NUM">Cores + 1 Número</option>
                        <option value="COLORS_2_NUM">Cores + 2 Números</option>
                        <option value="1_NUM_COLORS">1 Número + Cores</option>
                        <option value="2_NUM_COLORS">2 Números + Cores</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-500">Filtro Temporal</label>
                      <select value={trendMode} onChange={e => setTrendMode(e.target.value as any)} className="bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-white font-semibold outline-none focus:border-blue-500/50">
                         <option value="OFF">Desligado</option>
                         <option value="RECOVERY">Recuperação (Baixo -{'>'} Alto)</option>
                         <option value="CONSOLIDATED">Consolidado (Alto -{'>'} Alto)</option>
                      </select>
                    </div>

                    {trendMode === 'OFF' && (
                       <>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Histórico</label>
                            <select value={periodHours} onChange={e => setPeriodHours(Number(e.target.value))} className="bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-white font-semibold outline-none focus:border-blue-500/50">
                              {[1,3,6,12,18,24,48,72].map(h => <option key={h} value={h}>{h} Horas</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Modo de Validação</label>
                            <select value={lossMode} onChange={e => setLossMode(e.target.value as any)} className="bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-white font-semibold outline-none focus:border-blue-500/50">
                               <option value="CICLO">Em Ciclo</option>
                               <option value="ENTRADA">Em Entrada</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Min Sinais</label>
                            <input type="number" min="1" value={minTriggers} onChange={e => setMinTriggers(Number(e.target.value))} className="bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-white font-semibold outline-none focus:border-blue-500/50" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-gray-500">WinRate Mín (%)</label>
                            <input type="number" min="1" max="100" value={minWinRate} onChange={e => setMinWinRate(Number(e.target.value))} className="bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-white font-semibold outline-none focus:border-blue-500/50" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Tam. Exato (0=Todos)</label>
                            <input type="number" min="0" value={selectedSize} onChange={e => setSelectedSize(Number(e.target.value))} className="bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-white font-semibold outline-none focus:border-blue-500/50" />
                          </div>
                       </>
                    )}

                    {trendMode !== 'OFF' && (
                       <>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Histórico Passado</label>
                            <select value={periodHours} onChange={e => setPeriodHours(Number(e.target.value))} className="bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-white font-semibold outline-none focus:border-blue-500/50">
                              {[12,24,48,72].map(h => <option key={h} value={h}>{h} Horas</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Histórico Atual</label>
                            <select value={trendPresentHours} onChange={e => setTrendPresentHours(Number(e.target.value))} className="bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-white font-semibold outline-none focus:border-blue-500/50">
                              {[1,2,3,4].map(h => <option key={h} value={h}>Últimas {h} Hora{h>1?'s':''}</option>)}
                            </select>
                          </div>
                          {trendMode === 'RECOVERY' && (
                             <div className="flex flex-col gap-1.5">
                               <label className="text-[10px] uppercase font-bold text-gray-500">Taxa Passada (Max %)</label>
                               <input type="number" min="0" max="100" value={maxPastWinRate} onChange={e => setMaxPastWinRate(Number(e.target.value))} className="bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-fuchsia-400 font-bold outline-none focus:border-blue-500/50" />
                             </div>
                          )}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Taxa Atual (Mín %)</label>
                            <input type="number" min="1" max="100" value={minWinRate} onChange={e => setMinWinRate(Number(e.target.value))} className="bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-[#4ade80] font-bold outline-none focus:border-blue-500/50" />
                          </div>
                       </>
                    )}

                    <div className="lg:col-span-2 mt-2">
                       <label className="flex items-center gap-3 cursor-pointer bg-[#12141c] p-3 rounded-xl border border-white/5 hover:bg-white/5 transition-all">
                        <input type="checkbox" checked={useMixedMining} onChange={e => setUseMixedMining(e.target.checked)} className="w-4 h-4 rounded bg-black/50 border-white/20 accent-blue-500" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Super Mineração (Mistos + IA)</span>
                      </label>
                    </div>

                    <div className="lg:col-span-2 mt-2 flex gap-2">
                       <div className="flex flex-col gap-1 flex-1">
                          <label className="text-[10px] uppercase font-black text-blue-400">ALOCAR PARA PLACAR (GALE)</label>
                          <select value={qtdEntradas} onChange={e => setQtdEntradas(Number(e.target.value))} className="bg-blue-900/20 border border-blue-500/50 rounded-xl p-3 text-sm text-blue-400 font-black outline-none focus:border-blue-400 text-center">
                            <option value="1">G0 (Mão Fixa)</option>
                            <option value="2">G1 (1 Cobertura)</option>
                            <option value="3">G2 (2 Coberturas)</option>
                          </select>
                       </div>
                       <button 
                         onClick={handleAddFilter}
                         disabled={isDiscovering}
                         className="flex-[2] mt-[18px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 text-white font-black uppercase tracking-widest text-xs px-4 py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 border border-blue-400/30"
                       >
                         {isDiscovering ? (
                           <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div> MINEIRANDO...</>
                         ) : (
                           <><BrainCircuit size={16} /> + ADICIONAR ESTRATÉGIA</>
                         )}
                       </button>
                    </div>

                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>


        {/* COMPONENT 3: CASA EXATA (15x8 Grid) */}
        <section className="bg-[#0a0a0f] p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
             <h2 className="text-sm font-black uppercase tracking-widest text-gray-300 flex items-center gap-2">
              <Activity size={16} className="text-blue-400" /> CASA EXATA
            </h2>

             <div className="flex items-center bg-[#12141c] rounded-lg p-1 border border-white/5 shadow-inner">
                {historyOptions.map(h => (
                  <button
                    key={h}
                    onClick={() => setHistoryHours(h)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      historyHours === h ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {h}H
                  </button>
                ))}
             </div>
          </div>

          <div className="flex items-center gap-4 bg-[#12141c] p-3 rounded-lg border border-white/5">
             <div className="flex items-center gap-2">
               <Settings size={14} className="text-gray-500"/>
               <span className="text-[10px] font-bold text-gray-400 uppercase">Gatilho de Sinal (%)</span>
             </div>
             <input type="range" min="50" max="100" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-48 accent-blue-500" />
             <span className="text-sm font-black text-blue-400">{threshold}%</span>
          </div>

          <div className="overflow-x-auto custom-scrollbar pb-4">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="p-3 border-b border-white/10 text-xs font-black uppercase text-gray-500 w-20 text-center sticky left-0 bg-[#0a0a0f] z-10 shadow-[5px_0_10px_-5px_rgba(0,0,0,0.5)]">Pedra</th>
                  {[1, 2, 3, 4, 5, 6, 7].map(c => (
                    <th key={c} className="p-2 border-b border-white/10 text-[10px] font-bold uppercase text-gray-400 text-center">
                      CASA {c}
                      <div className="flex mt-1 opacity-50">
                        <div className="flex-1 text-[#f12c4c] bg-[#f12c4c]/10 rounded-l py-0.5">V</div>
                        <div className="flex-1 text-gray-300 bg-white/5 rounded-r py-0.5">P</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {stats.map((row, stone) => (
                  <tr key={stone} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 text-center border-r border-white/5 sticky left-0 bg-[#0a0a0f] z-10 shadow-[5px_0_10px_-5px_rgba(0,0,0,0.5)]">
                      <div className={`w-8 h-8 mx-auto rounded flex items-center justify-center font-black text-xs ${
                        stone === 0 ? 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.3)]' :
                        stone >= 1 && stone <= 7 ? 'bg-[#f12c4c] text-white' :
                        'bg-[#262831] text-white border border-white/10'
                      }`}>
                        {stone}
                      </div>
                    </td>

                    {row.map((cell, idx) => {
                      const total = cell.r + cell.b;
                      const pctR = total > 0 ? (cell.r / total) * 100 : 0;
                      const pctB = total > 0 ? (cell.b / total) * 100 : 0;
                      const offset = idx + 1;
                      
                      const isActive = activeCells.some(a => a.stone === stone && a.offset === offset);
                      const triggersRed = isActive && pctR >= threshold;
                      const triggersBlack = isActive && pctB >= threshold;

                      return (
                        <td key={idx} className={`p-1.5 border-r border-white/[0.02] relative transition-all duration-300
                          ${isActive ? 'bg-blue-500/5' : ''}
                          ${triggersRed ? 'bg-[#f12c4c]/20 shadow-[inset_0_0_15px_rgba(241,44,76,0.3)]' : ''}
                          ${triggersBlack ? 'bg-[#262831]/60 shadow-[inset_0_0_15px_rgba(255,255,255,0.1)]' : ''}
                        `}>
                          {isActive && <div className="absolute top-0 inset-x-0 h-0.5 bg-blue-500"></div>}
                          
                          <div className="flex h-10 rounded overflow-hidden border border-white/5">
                            <div className="flex-1 flex flex-col items-center justify-center bg-[#f12c4c]/10 relative group">
                              <span className={`text-xs font-bold ${triggersRed ? 'text-[#ff4d6a]' : 'text-[#f12c4c]/70'}`}>{cell.r}</span>
                              {total > 0 && <span className="text-[8px] opacity-50 absolute bottom-0.5">{pctR.toFixed(0)}%</span>}
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center bg-black/20 relative group">
                              <span className={`text-xs font-bold ${triggersBlack ? 'text-white' : 'text-gray-400'}`}>{cell.b}</span>
                              {total > 0 && <span className="text-[8px] opacity-50 absolute bottom-0.5">{pctB.toFixed(0)}%</span>}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </section>

        {/* COMPONENT 4: MATRIZ PREDITIVA (2 PEDRAS) */}
        <section className="bg-[#0a0a0f] p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
             <h2 className="text-sm font-black uppercase tracking-widest text-purple-300 flex items-center gap-2">
              <Layers size={16} className="text-purple-400" /> MATRIZ PREDITIVA (2 PEDRAS)
            </h2>

             <div className="flex items-center bg-[#12141c] rounded-lg p-1 border border-white/5 shadow-inner">
                {historyOptions.map(h => (
                  <button
                    key={h}
                    onClick={() => setMatrizHours(h)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      matrizHours === h ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {h}H
                  </button>
                ))}
             </div>
          </div>

          <div className="flex items-center gap-4 bg-[#12141c] p-3 rounded-lg border border-white/5">
             <div className="flex items-center gap-2">
               <Settings size={14} className="text-gray-500"/>
               <span className="text-[10px] font-bold text-gray-400 uppercase">Gatilho de Sinal (%)</span>
             </div>
             <input type="range" min="50" max="100" value={matrizThreshold} onChange={(e) => setMatrizThreshold(Number(e.target.value))} className="w-48 accent-purple-500" />
             <span className="text-sm font-black text-purple-400">{matrizThreshold}%</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
             {matriz2Pedras.actives.map((act, idx) => {
                const total = act.r + act.b;
                if (total === 0) return null;
                const pctR = (act.r / total) * 100;
                const pctB = (act.b / total) * 100;
                const triggersRed = pctR >= matrizThreshold;
                const triggersBlack = pctB >= matrizThreshold;
                
                return (
                   <div key={idx} className={`bg-[#12141c] border rounded-xl p-3 flex flex-col gap-3 relative overflow-hidden transition-all
                     ${triggersRed ? 'border-[#f12c4c]/50 shadow-[0_0_15px_rgba(241,44,76,0.1)]' : triggersBlack ? 'border-[#262831] shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'border-white/5'}
                   `}>
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-0.5">
                            <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black bg-white/10 text-white shadow-inner">{act.p1}</div>
                            <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black bg-white/10 text-white shadow-inner">{act.p2}</div>
                         </div>
                         <span className="text-[9px] font-black uppercase text-gray-500">CASA {act.offset}</span>
                      </div>
                      
                      <div className="flex h-8 rounded overflow-hidden border border-white/5">
                         <div className={`flex-1 flex flex-col items-center justify-center relative ${triggersRed ? 'bg-[#f12c4c]/30' : 'bg-[#f12c4c]/10'}`}>
                           <span className={`text-xs font-bold ${triggersRed ? 'text-white' : 'text-[#f12c4c]/70'}`}>{act.r}</span>
                           <span className="text-[8px] opacity-70 absolute bottom-0">{pctR.toFixed(0)}%</span>
                         </div>
                         <div className={`flex-1 flex flex-col items-center justify-center relative ${triggersBlack ? 'bg-black/50' : 'bg-black/20'}`}>
                           <span className={`text-xs font-bold ${triggersBlack ? 'text-white' : 'text-gray-400'}`}>{act.b}</span>
                           <span className="text-[8px] opacity-70 absolute bottom-0">{pctB.toFixed(0)}%</span>
                         </div>
                      </div>
                   </div>
                );
             })}
          </div>
        </section>

        <AnimatePresence>
          {selectedStrategyForDetails && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#12141c] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                
                {/* Header */}
                <div className="flex justify-between items-center bg-black/40 px-6 py-4 border-b border-white/5">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider">DETALHES DA ESTRATÉGIA</span>
                      <h3 className="text-sm font-black uppercase text-white tracking-widest">{selectedStrategyForDetails.strategy.nome}</h3>
                   </div>
                   <button onClick={() => setSelectedStrategyForDetails(null)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                      <X size={16} />
                   </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                   <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Padrões Ativos ({selectedStrategyForDetails.strategy.patterns.length})</span>
                   <div className="flex flex-col gap-3">
                      {selectedStrategyForDetails.strategy.patterns.map((pat, idx) => (
                         <div key={pat.id || idx} className="bg-black/30 border border-white/5 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex flex-col gap-2">
                               <div className="flex gap-1.5 items-center flex-wrap">
                                  {pat.elements.map((el, i) => (
                                     <div key={i} className={`h-6 px-2 text-[10px] font-black uppercase rounded flex items-center justify-center shadow border
                                       ${el.t === 'c' 
                                          ? el.v === 'Vermelho' ? 'bg-[#f12c4c] text-white border-red-500/20' : 'bg-[#262831] text-gray-300 border-gray-700/20' 
                                          : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/25'
                                       }
                                     `}>
                                        {el.t === 'c' ? '' : el.v}
                                     </div>
                                  ))}
                                  <span className="text-[10px] font-bold text-gray-600 px-1">➔</span>
                                  <div className={`h-6 px-2.5 text-[10px] font-black uppercase rounded flex items-center justify-center border
                                     ${pat.target === 'Vermelho' ? 'bg-red-500/10 text-red-200 border-red-500/30' : 'bg-white/5 text-gray-300 border-gray-600/30'}
                                  `}>
                                     {pat.target}
                                  </div>
                               </div>
                            </div>

                            <div className="flex items-center gap-4">
                               {pat.pastWinRate !== undefined && pat.presentWinRate !== undefined ? (
                                  <div className="flex items-center gap-3">
                                     <div className="flex flex-col items-end bg-red-950/40 border border-red-500/30 px-2.5 py-1.5 rounded-lg shadow-inner">
                                        <span className="text-[7px] font-black uppercase text-red-400 tracking-wider">Passada</span>
                                        <span className="text-[11px] font-black text-red-200">{pat.pastWinRate}%</span>
                                     </div>
                                     <div className="flex flex-col items-end bg-green-950/40 border border-green-500/30 px-2.5 py-1.5 rounded-lg shadow-inner">
                                        <span className="text-[7px] font-black uppercase text-green-400 tracking-wider">Atual</span>
                                        <span className="text-[11px] font-black text-green-200">{pat.presentWinRate}%</span>
                                     </div>
                                     <div className="flex flex-col items-end border-l border-white/5 pl-3">
                                        <span className="text-[7px] font-black text-gray-500 uppercase tracking-wider">Total</span>
                                        <span className="text-[10px] font-black text-white">{pat.triggers} S</span>
                                     </div>
                                  </div>
                               ) : (
                                  <div className="flex flex-col items-end">
                                     <span className="text-xs font-black text-green-400">{pat.winRate}% Assert.</span>
                                     <span className="text-[9px] font-bold text-gray-500 uppercase">{pat.triggers} Sinais</span>
                                  </div>
                                )}
                            </div>
                         </div>
                      ))}
                   </div>
                </div>

                {/* Footer */}
                <div className="bg-black/40 px-6 py-4 border-t border-white/5 flex justify-between items-center">
                   <button onClick={() => { deleteEstrategia(selectedStrategyForDetails.gale, selectedStrategyForDetails.strategy.id); setSelectedStrategyForDetails(null); }} className="bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase px-4 py-2 rounded-xl flex items-center gap-2 border border-red-600 transition-colors shadow-lg">
                      <Trash2 size={14} /> Excluir Estratégia
                   </button>
                   <button onClick={() => setSelectedStrategyForDetails(null)} className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-black uppercase px-4 py-2 rounded-xl border border-white/5 transition-colors">
                      Fechar
                   </button>
                </div>

              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
