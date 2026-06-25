"use client";
import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import { Pickaxe, Play, Square, Trash2, ChevronDown, ChevronUp, Bell, Target, TrendingUp, AlertTriangle, X, Volume2, VolumeX } from 'lucide-react';

interface Roll {
  id: string;
  color: string;
  roll: string;
}

interface PatternElement {
  t: 'c' | 'n';
  v: string;
}

interface FoundSoroPattern {
  id: string; // pattern_string + target_string
  type: string;
  pattern: PatternElement[];
  target: string[]; // ['V', 'P']
  win: number;
  loss: number;
  winRate: number;
  sm: number; // Sequência máxima sem acertar
  sa: number; // Sequência atual (sem acerto)
  occurrences: number;
  foundAt: number;
}

interface MineracaoProps {
  data: Roll[];
  periodHours: number;
  setPeriodHours: (h: number) => void;
}

const colorEmoji = (c: string) => c === 'V' ? '🔴' : c === 'P' ? '⚫' : '⚪';
const colorLabel = (c: string) => c === 'V' ? 'Verm' : c === 'P' ? 'Preto' : 'Branco';

function getCol(r: Roll): 'V' | 'P' | 'B' {
  if (!r) return 'B';
  const n = parseInt(r.roll as string);
  if (r.color.includes('Vermelho') || (n >= 1 && n <= 7)) return 'V';
  if (r.color.includes('Preto') || (n >= 8 && n <= 14)) return 'P';
  return 'B';
}

const STORAGE_KEY = 'mineracao_soros_v1';
const VIGIA_KEY = 'vigia_soros_v1';

const DualSlider = ({ range, setRange }: { range: [number, number], setRange: (val: [number, number]) => void }) => {
  const min = 1, max = 15;
  const getPercent = (value: number) => Math.round(((value - min) / (max - min)) * 100);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center justify-between">
        <span>Tamanho do Padrão</span>
        <span className="text-white">{range[0]} até {range[1]}</span>
      </label>
      
      <div className="relative w-full h-8 flex items-center pt-2">
        {/* Base Track */}
        <div className="absolute w-full h-1.5 bg-[#12141c] rounded-md border border-white/5 z-0" />
        
        {/* Colored Range */}
        <div className="absolute h-1.5 bg-gradient-to-r from-amber-500 to-orange-400 rounded-md z-10 shadow-[0_0_10px_rgba(245,158,11,0.5)]" 
             style={{ left: `${getPercent(range[0])}%`, width: `${getPercent(range[1]) - getPercent(range[0])}%` }} />
        
        {/* Thumb 1 (Min) */}
        <input 
          type="range" min={min} max={max} value={range[0]} 
          onChange={(e) => setRange([Math.min(Number(e.target.value), range[1]), range[1]])} 
          className="absolute w-full h-1 appearance-none bg-transparent" 
          style={{ WebkitAppearance: 'none', pointerEvents: 'none', zIndex: range[0] > max - 2 ? 50 : 30 }} 
        />
        
        {/* Thumb 2 (Max) */}
        <input 
          type="range" min={min} max={max} value={range[1]} 
          onChange={(e) => setRange([range[0], Math.max(Number(e.target.value), range[0])])} 
          className="absolute w-full h-1 appearance-none bg-transparent z-40" 
          style={{ WebkitAppearance: 'none', pointerEvents: 'none' }} 
        />
        
        <style dangerouslySetInnerHTML={{__html: `
          input[type=range]::-webkit-slider-thumb {
            pointer-events: all;
            width: 18px;
            height: 18px;
            -webkit-appearance: none;
            border-radius: 50%;
            background: #0f172a;
            border: 3px solid #f59e0b;
            cursor: pointer;
            box-shadow: 0 0 10px rgba(245,158,11,0.5);
            transition: transform 0.1s;
          }
          input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.2); }
        `}} />
      </div>
      <div className="flex justify-between text-[9px] text-gray-500 font-bold mt-1">
        <span>1 Pedra</span>
        <span>15 Pedras</span>
      </div>
    </div>
  );
};

export default function MaxSoroMiner({ data, periodHours, setPeriodHours }: MineracaoProps) {
  // Filtros
  const [patternType, setPatternType] = useState('TODOS');
  const [patternSizeRange, setPatternSizeRange] = useState<[number, number]>([1, 15]);
  const [targetFocus, setTargetFocus] = useState('Cores'); // 'Cores' | 'Branco'
  const [sorosLevel, setSorosLevel] = useState(2); // 2 a 15 para Cores, 2 a 3 para Branco
  const [minOccurrences, setMinOccurrences] = useState(300);
  const [minSA, setMinSA] = useState(100);
  const [minWinRate, setMinWinRate] = useState(0);
  
  // Estado da busca
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  
  const [found, setFound] = useState<FoundSoroPattern[]>([]);
  const [vigias, setVigias] = useState<FoundSoroPattern[]>([]);

  // Carregar do localStorage apenas após a hidratação no cliente
  useEffect(() => {
    try {
      const savedFound = localStorage.getItem(STORAGE_KEY);
      if (savedFound) setFound(JSON.parse(savedFound));

      const savedVigias = localStorage.getItem(VIGIA_KEY);
      if (savedVigias) setVigias(JSON.parse(savedVigias));
    } catch (e) {
      console.error('Erro ao carregar do localStorage', e);
    }
  }, []);

  const [sortCol, setSortCol] = useState<keyof FoundSoroPattern>('sa');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloadingHistory, setDownloadingHistory] = useState(false);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const lastDataIdForAudio = useRef<string | null>(null);

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

  const abortRef = useRef(false);

  // Persistir em localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(found.slice(0, 500))); } catch {}
  }, [found]);

  useEffect(() => {
    try { localStorage.setItem(VIGIA_KEY, JSON.stringify(vigias)); } catch {}
  }, [vigias]);

  const handleSearch = useCallback(async () => {
    if (isSearching) { abortRef.current = true; return; }

    setIsSearching(true);
    setFound([]); // Resetar anteriores
    setDownloadingHistory(true);
    setProgress(0);
    setTotal(periodHours * 120);

    let rolls = data.slice(-periodHours * 120);
    if (rolls.length < periodHours * 100) { // Se não tiver a quantidade esperada, faz o fetch sob demanda
        try {
            const res = await fetch(`/api/results/period?hours=${periodHours}`);
            if (res.ok) {
                const json = await res.json();
                if (json.data && json.data.length > 0) {
                    rolls = json.data.map((r: any) => ({
                      ...r,
                      color: r.color ? String(r.color).charAt(0).toUpperCase() + String(r.color).slice(1).toLowerCase() : 'Branco',
                      roll: r.roll ? String(r.roll) : '0'
                    }));
                }
            }
        } catch(err) {
            console.error("Erro ao baixar historico:", err);
        }
    }
    
    setDownloadingHistory(false);

    if (rolls.length < patternSizeRange[1] + sorosLevel) {
      alert('Dados insuficientes. Aguarde mais giros ou tente novamente.');
      setIsSearching(false);
      return;
    }

    abortRef.current = false;

    // Extrair histórico em formato simples (Array de 'V', 'P', 'B') para máxima velocidade
    const historyColors = rolls.map(r => getCol(r));
    setTotal(historyColors.length - sorosLevel);
    setProgress(0);

    const patternMap: Record<string, {
      type: string;
      elements: PatternElement[];
      occurrences: number;
      targets: Record<string, { wins: number; lastWinAt: number; sm: number }>;
    }> = {};

    const chunkSize = 5000;
    const isBrancoFocus = targetFocus === 'Branco';
    const brancoTargetStr = 'B'.repeat(sorosLevel);
    let currentIndex = 0;

    function processChunk() {
      if (abortRef.current) {
        setIsSearching(false);
        return;
      }

      const end = Math.min(currentIndex + chunkSize, rolls.length - sorosLevel);
      
      for (let i = currentIndex; i < end; i++) {
        // Testa todos os tamanhos de padrão do intervalo simultaneamente
        for (let totalLen = patternSizeRange[0]; totalLen <= patternSizeRange[1]; totalLen++) {
          if (i + totalLen + sorosLevel > rolls.length) break;

          const startIdx = i;
          const keysToUpdate = new Set<string>();
          const generatedElements: Record<string, {type: string, elements: PatternElement[]}> = {};

          if (totalLen <= 4 && (patternType === 'TODOS' || patternType === 'MIXED')) {
            const numVariations = 1 << totalLen;
            for (let mask = 0; mask < numVariations; mask++) {
              const elements: PatternElement[] = [];
              let hasZeroAsNum = false;
              for (let p = 0; p < totalLen; p++) {
                const rollObj = rolls[startIdx + p];
                if ((mask & (1 << p)) === 0) {
                  elements.push({ t: 'c', v: getCol(rollObj) });
                } else {
                  if (rollObj.roll === '0') hasZeroAsNum = true;
                  elements.push({ t: 'n', v: rollObj.roll });
                }
              }
              if (hasZeroAsNum && (patternType as string) !== 'ONLY_NUMBERS') continue;
              const patKey = 'MIXED:' + elements.map(e => e.t + e.v).join('|');
              keysToUpdate.add(patKey);
              generatedElements[patKey] = { type: 'MIXED', elements };
            }
          } else {
            const typesToTest = patternType === 'TODOS' 
              ? ['ONLY_COLORS', 'COLORS_1_NUM', '1_NUM_COLORS'] 
              : [patternType];
              
            for (const type of typesToTest) {
              const elements: PatternElement[] = [];
              if (type === 'ONLY_COLORS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(rolls[startIdx+p])});
              } else if (type === 'ONLY_NUMBERS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'n', v: rolls[startIdx+p].roll});
              } else if (type === 'COLORS_1_NUM') {
                for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(rolls[startIdx+p])});
                elements.push({t:'n', v: rolls[startIdx+totalLen-1].roll});
              } else if (type === 'COLORS_2_NUM') {
                if (totalLen < 4) continue;
                for(let p=0; p<totalLen-2; p++) elements.push({t:'c', v: getCol(rolls[startIdx+p])});
                elements.push({t:'n', v: rolls[startIdx+totalLen-2].roll});
                elements.push({t:'n', v: rolls[startIdx+totalLen-1].roll});
              } else if (type === '1_NUM_COLORS') {
                elements.push({t:'n', v: rolls[startIdx].roll});
                for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(rolls[startIdx+p])});
              } else if (type === '2_NUM_COLORS') {
                if (totalLen < 4) continue;
                elements.push({t:'n', v: rolls[startIdx].roll});
                elements.push({t:'n', v: rolls[startIdx+1].roll});
                for(let p=2; p<totalLen; p++) elements.push({t:'c', v: getCol(rolls[startIdx+p])});
              }

              if (elements.length === 0) continue;
              let hasZeroAsNum = false;
              for (const e of elements) {
                if (e.t === 'n' && e.v === '0') hasZeroAsNum = true;
              }
              if (hasZeroAsNum && patternType !== 'ONLY_NUMBERS') continue;

              const patKey = type + ':' + elements.map(e => e.t + e.v).join('|');
              keysToUpdate.add(patKey);
              generatedElements[patKey] = { type, elements };
            }
          }

          for (const patKey of keysToUpdate) {
            if (!patternMap[patKey]) {
              patternMap[patKey] = { occurrences: 0, targets: {}, type: generatedElements[patKey].type, elements: generatedElements[patKey].elements };
              // Para Branco, inicializamos o único alvo possível para garantir que a gap seja calculada mesmo se nunca sair
              if (isBrancoFocus) {
                patternMap[patKey].targets[brancoTargetStr] = { wins: 0, lastWinAt: 0, sm: 0 };
              }
            }
            const pStat = patternMap[patKey];
            pStat.occurrences++;

            // O resultado real que aconteceu após esse padrão
            let actualOutcome = '';
            let hasBranco = false;
            for (let s = 0; s < sorosLevel; s++) {
              const c = historyColors[i + totalLen + s];
              if (c === 'B') hasBranco = true;
              actualOutcome += c;
            }

            let isValidOutcome = false;
            if (isBrancoFocus) {
              isValidOutcome = (actualOutcome === brancoTargetStr);
            } else {
              isValidOutcome = !hasBranco; // Cores: não pode ter branco
            }

            if (isValidOutcome) {
              if (!pStat.targets[actualOutcome]) {
                pStat.targets[actualOutcome] = { wins: 0, lastWinAt: 0, sm: 0 };
              }
              const tStat = pStat.targets[actualOutcome];
              const gap = pStat.occurrences - tStat.lastWinAt - 1;
              if (gap > tStat.sm) tStat.sm = gap;
              
              tStat.lastWinAt = pStat.occurrences;
              tStat.wins++;
            }
          }
        }
      }

      currentIndex = end;
      setProgress(currentIndex);

      if (currentIndex < historyColors.length - sorosLevel) {
        setTimeout(processChunk, 10);
      } else {
        // Finalizou, processar resultados
        const results: FoundSoroPattern[] = [];
        
        Object.entries(patternMap).forEach(([patStr, pStat]) => {
          if (pStat.occurrences >= minOccurrences) {
            Object.entries(pStat.targets).forEach(([targetStr, tStat]) => {
              // Calcular o gap final desde o último win até o fim do histórico
              const finalSa = pStat.occurrences - tStat.lastWinAt;
              let sm = tStat.sm;
              if (finalSa > sm) sm = finalSa;

              if (finalSa >= minSA) {
                const losses = pStat.occurrences - tStat.wins;
                const wr = tStat.wins / (pStat.occurrences || 1);
                const winRatePercent = Math.round(wr * 1000) / 10;
                
                if (winRatePercent >= minWinRate) {
                  results.push({
                  id: patStr + '|' + targetStr,
                  type: pStat.type,
                  pattern: pStat.elements,
                  target: targetStr.split(''),
                    win: tStat.wins,
                    loss: losses,
                    winRate: winRatePercent,
                    sm: sm,
                    sa: finalSa,
                    occurrences: pStat.occurrences,
                    foundAt: Date.now(),
                  });
                }
              }
            });
          }
        });

        // Ordenar por SA (maior atraso) por padrão
        results.sort((a, b) => b.sa - a.sa);
        
        setFound(results);
        setIsSearching(false);
      }
    }

    processChunk();
  }, [isSearching, data, patternSizeRange, patternType, sorosLevel, targetFocus, minOccurrences, minSA, minWinRate, periodHours]);

  const toggleSort = (col: keyof FoundSoroPattern) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const sortedFound = [...found].sort((a, b) => {
    const mul = sortDir === 'desc' ? -1 : 1;
    const valA = a[sortCol] as number;
    const valB = b[sortCol] as number;
    return (valA - valB) * mul;
  });

  const toggleVigia = (pattern: FoundSoroPattern) => {
    setVigias(prev => {
      const exists = prev.find(p => p.id === pattern.id);
      if (exists) return prev.filter(p => p.id !== pattern.id);
      return [...prev, pattern];
    });
  };

  const isVigia = (id: string) => vigias.some(v => v.id === id);

  // Calcular confluência atual (quantos padrões estão mandando entrar)
  let vigiaRed = 0;
  let vigiaBlack = 0;
  const latestHistory = data.slice(-15);
  
  vigias.forEach(v => {
     const patLen = v.pattern.length;
     if (latestHistory.length < patLen) return;
     
     let matches = true;
     for(let i = 0; i < patLen; i++) {
       const roll = latestHistory[latestHistory.length - patLen + i];
       const el = v.pattern[i];
       if (el.t === 'c' && getCol(roll) !== el.v) { matches = false; break; }
       if (el.t === 'n' && String(roll.roll) !== String(el.v)) { matches = false; break; }
     }
     
     if (matches) {
       if (v.target[0] === 'V') vigiaRed++;
       if (v.target[0] === 'P') vigiaBlack++;
     }
  });

  useEffect(() => {
     if (data.length === 0) return;
     const currentLastId = data[data.length - 1].id;
     if (lastDataIdForAudio.current !== currentLastId) {
        lastDataIdForAudio.current = currentLastId;
        if (vigiaRed > 0 || vigiaBlack > 0) {
           playAlert();
        }
     }
  }, [data, vigiaRed, vigiaBlack, audioEnabled]);

  return (
    <>
      {/* PAINEL DE FILTROS LATERAIS */}
      <aside className="w-80 bg-[#0a0a0f] border-r border-white/5 flex flex-col shadow-2xl overflow-y-auto custom-scrollbar p-6 gap-6 shrink-0">
        <div className="flex flex-col gap-1 border-b border-white/5 pb-4 relative z-50">
          <h2 className="text-xs font-black uppercase text-amber-400 tracking-widest flex items-center justify-between">
            <span className="flex items-center gap-2"><Pickaxe size={14} /> Filtros Soros</span>
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Padrão (Tipo)</label>
            <select value={patternType} onChange={e => setPatternType(e.target.value)}
              className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-md text-xs font-bold outline-none focus:border-amber-500 transition-colors">
              <option value="TODOS">⭐ Todos (Misturado)</option>
              <option value="ONLY_COLORS">🔴 Somente Cores</option>
              <option value="ONLY_NUMBERS">🔢 Somente Números</option>
              <option value="COLORS_1_NUM">🎨 Cores + 1 Número</option>
              <option value="COLORS_2_NUM">🎨 Cores + 2 Números</option>
              <option value="1_NUM_COLORS">🔢 1 Número + Cores</option>
              <option value="2_NUM_COLORS">🔢 2 Números + Cores</option>
            </select>
          </div>
          
          <DualSlider range={patternSizeRange} setRange={setPatternSizeRange} />

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Foco Alvo</label>
              <select value={targetFocus} onChange={e => {
                setTargetFocus(e.target.value);
                if (e.target.value === 'Branco' && sorosLevel > 3) setSorosLevel(3);
              }} className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-md text-xs font-bold outline-none focus:border-amber-500 transition-colors">
                <option value="Cores">🔴/⚫ Cores</option>
                <option value="Branco">⚪ Branco</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Nível do Soro</label>
              <select value={sorosLevel} onChange={e => setSorosLevel(Number(e.target.value))}
                className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-md text-xs font-bold outline-none focus:border-amber-500 transition-colors">
                {Array.from({ length: (targetFocus === 'Branco' ? 2 : 14) }, (_, i) => i + 2).map(n => (
                  <option key={n} value={n}>Soro {n}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Histórico</label>
              <select value={periodHours} onChange={e => setPeriodHours(Number(e.target.value))}
                className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-md text-xs outline-none focus:border-amber-500 transition-colors">
                {[3, 6, 12, 18, 24, 48, 72, 168, 336, 720].map(h => {
                  let label = `${h} horas`;
                  if (h >= 24) {
                    const days = h / 24;
                    label = days === 1 ? '1 dia' : `${days} dias`;
                  }
                  return <option key={h} value={h}>{label}</option>;
                })}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Tentativas Mín.</label>
              <input type="number" min={1} value={minOccurrences} onChange={e => setMinOccurrences(Number(e.target.value))}
                className="bg-[#12141c] border border-white/10 text-amber-400 px-3 py-2 rounded-md text-xs outline-none focus:border-amber-500 transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Atraso Mín. (SA)</label>
              <input type="number" min={0} value={minSA} onChange={e => setMinSA(Number(e.target.value))}
                className="bg-[#12141c] border border-white/10 text-amber-400 px-3 py-2 rounded-md text-xs outline-none focus:border-amber-500 transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">WinRate Mín.</label>
              <input type="number" min={0} max={100} value={minWinRate} onChange={e => setMinWinRate(Number(e.target.value))}
                className="bg-[#12141c] border border-white/10 text-green-400 px-3 py-2 rounded-md text-xs outline-none focus:border-amber-500 transition-colors" />
            </div>
          </div>

          <button onClick={handleSearch}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all mt-4 ${isSearching ? 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]'}`}>
            {isSearching ? (downloadingHistory ? <><div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin"></div> Baixando...</> : <><Square size={14} /> Parar</>) : <><Play size={14} /> Iniciar Varredura</>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-6 relative">



      {/* BARRA DE PROGRESSO */}
      {(isSearching || (progress > 0 && progress < total)) && (
        <div className="bg-[#0a0a0f] border border-amber-500/20 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                {downloadingHistory ? 'Baixando Histórico da API...' : isSearching ? 'Varrendo Histórico Completo...' : 'Busca pausada'}
              </span>
            </div>
            <span className="text-xs font-mono text-gray-400">
              {progress.toLocaleString()} / {total.toLocaleString()} giros
            </span>
          </div>
          <div className="w-full h-3 bg-black rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 rounded-full transition-all duration-300 relative overflow-hidden"
              style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
            >
               <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]" style={{ transform: 'skewX(-20deg)' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* PAINEL DE VIGIAS (Ao Vivo) */}
      {vigias.length > 0 && (
        <div className="bg-blue-900/10 border border-blue-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10"><Bell size={100} /></div>
           <div className="flex items-center justify-between mb-8 relative z-10">
             <div className="flex items-center gap-3 w-1/3">
               <Bell className="text-blue-400 animate-bounce" size={20} />
               <h3 className="text-base font-black text-blue-400 uppercase tracking-widest">Vigias Ao Vivo ({vigias.length})</h3>
             </div>
             
             {/* Confluência Centralizada Gigante */}
             <div className="w-1/3 flex justify-center">
               <div className="flex items-center gap-4 bg-black/40 border border-white/5 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-sm">
                 <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex flex-col items-end leading-none">
                    <span>Entradas</span>
                    <span className="text-white text-sm">Agora</span>
                 </span>
                 <div className="flex items-center gap-4">
                   <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black transition-all duration-300 ${vigiaRed > 0 ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.8)]' : 'bg-red-900/20 text-red-500/30 border border-red-500/20'} ${(vigiaRed > vigiaBlack && vigiaRed > 0) ? 'ring-4 ring-green-500 ring-offset-4 ring-offset-[#0a0a0f]' : ''}`}>
                     {vigiaRed}
                   </div>
                   <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black transition-all duration-300 ${vigiaBlack > 0 ? 'bg-zinc-800 text-white shadow-[0_0_20px_rgba(63,63,70,0.8)]' : 'bg-zinc-900/40 text-zinc-500/30 border border-zinc-500/20'} ${(vigiaBlack > vigiaRed && vigiaBlack > 0) ? 'ring-4 ring-green-500 ring-offset-4 ring-offset-[#0a0a0f]' : ''}`}>
                     {vigiaBlack}
                   </div>
                 </div>
               </div>
             </div>

             <div className="flex items-center justify-end gap-4 w-1/3">
               <button onClick={() => setAudioEnabled(!audioEnabled)} className="text-gray-400 hover:text-white transition-colors" title="Aviso Sonoro">
                 {audioEnabled ? <Volume2 size={20} className="text-blue-400" /> : <VolumeX size={20} />}
               </button>
               <button onClick={() => setVigias([])} className="text-[10px] text-gray-500 hover:text-red-400 uppercase font-bold tracking-widest border border-white/5 px-3 py-1 rounded-lg">Limpar Vigias</button>
             </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative z-10">
              {vigias.map((v) => (
                 <div key={v.id} className="bg-black/40 border border-blue-500/30 rounded-xl p-4 flex flex-col gap-3 group hover:border-blue-500/60 transition-colors">
                    <div className="flex justify-between items-start">
                       <div className="flex gap-1 flex-wrap">
                          {v.pattern.map((el, i) => {
                             if (el.t === 'c') {
                               return (
                                 <div key={i} className={`w-6 h-6 rounded flex items-center justify-center text-xs shadow-lg ${el.v === 'V' ? 'bg-red-600' : el.v === 'P' ? 'bg-zinc-800' : 'bg-white'}`}>
                                   {colorEmoji(el.v)}
                                 </div>
                               );
                             } else {
                               const n = parseInt(el.v);
                               const isRed = n >= 1 && n <= 7;
                               return (
                                 <div key={i} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black shadow-lg text-black ${el.v === '0' ? 'bg-white' : isRed ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white'}`}>
                                   {el.v}
                                 </div>
                               );
                             }
                          })}
                       </div>
                       <button onClick={() => toggleVigia(v)} className="text-gray-500 hover:text-red-500"><X size={14} /></button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                       <div className="flex flex-col">
                          <span className="text-[9px] uppercase text-gray-500 font-bold tracking-widest">Soro Alvo</span>
                          <div className="flex items-center gap-1">
                             <Target size={12} className="text-green-400" />
                             <span className="text-sm font-black text-white">{v.target.map(t => colorEmoji(t)).join(' → ')}</span>
                          </div>
                       </div>
                       <div className="flex flex-col items-end">
                          <span className="text-[9px] uppercase text-gray-500 font-bold tracking-widest">Status/Gap</span>
                          <span className="text-sm font-black text-amber-400">{v.sa} <span className="text-gray-600 text-xs font-normal">/ {v.sm}</span></span>
                       </div>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {/* RESULTADOS */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base font-black text-white uppercase tracking-widest">Padrões Encontrados</span>
            <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">{found.length}</span>
          </div>
          {found.length > 0 && (
             <button onClick={() => setFound([])} className="text-xs text-red-400 hover:text-red-300 font-bold tracking-widest uppercase flex items-center gap-1">
                <Trash2 size={14} /> Limpar
             </button>
          )}
        </div>

        {found.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 bg-[#0a0a0f] border border-white/5 rounded-3xl shadow-2xl">
            <AlertTriangle size={48} className="text-gray-700" />
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest text-center">
              Nenhum padrão na mira.<br />
              <span className="text-gray-600 text-[10px]">Ajuste os filtros ou reduza o SA Mínimo para ver mais resultados.</span>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#0a0a0f] shadow-2xl">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-black/40 text-gray-400 border-b border-white/10 uppercase text-[10px] font-black tracking-widest">
                  <th className="p-4 text-center">Padrão Gatilho</th>
                  <th className="p-4 text-center">Cor da Entrada (Soro)</th>
                  <th className="p-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('occurrences')}>
                    Tentativas {sortCol === 'occurrences' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="p-4 text-center cursor-pointer hover:text-amber-400 text-amber-500 transition-colors" onClick={() => toggleSort('sa')}>
                    Atraso Atual (AA) {sortCol === 'sa' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="p-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('sm')}>
                    Recorde Gap (MS) {sortCol === 'sm' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="p-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('winRate')}>
                    WinRate {sortCol === 'winRate' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="p-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {sortedFound.map(row => {
                  const isVigiando = isVigia(row.id);
                  const isCritical = row.sa >= row.sm * 0.9; // 90% do recorde = crítico
                  
                  return (
                  <Fragment key={row.id}>
                    <tr className={`border-b border-white/5 last:border-b-0 transition-colors ${isCritical ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/[0.02]'}`}>
                      {/* Padrão */}
                      <td className="p-3">
                        <div className="flex gap-1 justify-center flex-wrap max-w-[200px]">
                          {row.pattern.map((el, i) => {
                             if (el.t === 'c') {
                               return (
                                 <div key={i} className={`w-7 h-7 rounded-md flex items-center justify-center text-base shadow-lg ${el.v === 'V' ? 'bg-red-600' : el.v === 'P' ? 'bg-zinc-800' : 'bg-white'}`}>
                                   {colorEmoji(el.v)}
                                 </div>
                               );
                             } else {
                               const n = parseInt(el.v);
                               const isRed = n >= 1 && n <= 7;
                               return (
                                 <div key={i} className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-black shadow-lg text-black ${el.v === '0' ? 'bg-white' : isRed ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white'}`}>
                                   {el.v}
                                 </div>
                               );
                             }
                          })}
                        </div>
                      </td>
                      {/* Alvo do Soro */}
                      <td className="p-3 text-center font-black">
                        <div className="flex items-center justify-center gap-1">
                          {row.target.map((t, i) => (
                            <Fragment key={i}>
                              <span className="text-lg">{colorEmoji(t)}</span>
                              {i < row.target.length - 1 && <span className="text-gray-600 text-[10px]">→</span>}
                            </Fragment>
                          ))}
                        </div>
                      </td>
                      {/* Tentativas */}
                      <td className="p-3 text-center text-blue-400 font-black">{row.occurrences}</td>
                      {/* Atraso Atual */}
                      <td className="p-3 text-center">
                         <span className={`px-2 py-1 rounded-md font-black ${isCritical ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse' : 'text-amber-400 bg-amber-500/10'}`}>
                            {row.sa}
                         </span>
                      </td>
                      {/* Máxima sem Soro */}
                      <td className="p-3 text-center text-gray-300 font-bold">{row.sm}</td>
                      {/* WinRate */}
                      <td className="p-3 text-center text-green-400 font-mono font-bold">{row.winRate.toFixed(1)}%</td>
                      {/* Ações */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                           <button onClick={() => toggleVigia(row)}
                             className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isVigiando ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-white/5 text-gray-400 hover:bg-blue-500/20 hover:text-blue-400 border border-white/5'}`}>
                             {isVigiando ? 'Vigiando' : 'Vigiar'}
                           </button>
                           <button onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                             className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-400">
                             {expandedId === row.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                           </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === row.id && (
                      <tr className="bg-black/50 border-b border-white/5">
                        <td colSpan={7} className="p-4">
                           <div className="flex items-center gap-6 text-[10px] uppercase font-bold tracking-widest">
                              <div className="flex items-center gap-2 text-green-400"><TrendingUp size={14} /> Soro Completos: {row.win}</div>
                              <div className="flex items-center gap-2 text-red-400"><X size={14} /> Soro Falhos: {row.loss}</div>
                              <div className="flex-1"></div>
                              <div className="text-gray-500 bg-white/5 px-3 py-1 rounded border border-white/5 font-mono">
                                ID: {row.id}
                              </div>
                           </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </main>
    </>
  );
}
