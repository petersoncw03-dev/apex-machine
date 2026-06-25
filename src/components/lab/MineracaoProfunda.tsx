'use client';
import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import { Pickaxe, Play, Square, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Element = { type: 'color'; value: 'V' | 'P' | 'B' } | { type: 'number'; value: number };
type Pattern = Element[];

interface FoundPattern {
  id: string;
  elements: Element[];
  win: number;
  loss: number;
  winRate: number;
  sm: number;   // Sequência máxima sem acertar
  sa: number;   // Sequência atual (sem acerto)
  occurrences: number;
  foundAt: number; // timestamp
}

interface MineracaoProps {
  data: { color: string; roll: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const COLORS: ('V' | 'P' | 'B')[] = ['V', 'P', 'B'];
const NUMBERS = Array.from({ length: 14 }, (_, i) => i + 1);

const colorEmoji = (c: 'V' | 'P' | 'B') =>
  c === 'V' ? '🔴' : c === 'P' ? '⚫' : '⚪';

const colorLabel = (c: 'V' | 'P' | 'B') =>
  c === 'V' ? 'Vermelho' : c === 'P' ? 'Preto' : 'Branco';

function numColor(n: number) {
  if (n === 0) return 'bg-white text-black';
  if (n <= 7) return 'bg-red-600 text-white';
  return 'bg-zinc-700 text-white';
}

function getCC(roll: string, color: string): 'V' | 'P' | 'B' {
  const n = parseInt(roll);
  if (n === 0 || color.includes('Branco')) return 'B';
  if (n >= 1 && n <= 7 || color.includes('Vermelho')) return 'V';
  return 'P';
}

function patternId(p: Pattern): string {
  return p.map(e => e.type === 'color' ? e.value : String(e.value)).join('-');
}

/** Gera todas as combinações mistas de tamanho `size` */
function* generatePatterns(size: number): Generator<Pattern> {
  const options: Element[] = [
    ...COLORS.map(c => ({ type: 'color' as const, value: c })),
    ...NUMBERS.map(n => ({ type: 'number' as const, value: n })),
  ];
  // total options per slot = 3 colors + 14 numbers = 17
  const total = options.length;
  const count = Math.pow(total, size);
  for (let i = 0; i < count; i++) {
    const pattern: Pattern = [];
    let x = i;
    for (let s = 0; s < size; s++) {
      pattern.unshift(options[x % total]);
      x = Math.floor(x / total);
    }
    yield pattern;
  }
}

function totalPatternCount(size: number): number {
  return Math.pow(17, size);
}

/** Avalia um padrão contra o histórico, retorna estatísticas */
function evalPattern(
  pattern: Pattern,
  rolls: { color: string; roll: string }[],
  maxGale: number
): { win: number; loss: number; sm: number; sa: number; occurrences: number } | null {
  const pLen = pattern.length;
  if (rolls.length < pLen + 1) return null;

  let win = 0, loss = 0, sm = 0, sa = 0, curLoss = 0, occurrences = 0;

  for (let i = pLen - 1; i < rolls.length - 1; i++) {
    // Check if pattern matches at position i (i is last element of pattern)
    let match = true;
    for (let p = 0; p < pLen; p++) {
      const roll = rolls[i - (pLen - 1) + p];
      const el = pattern[p];
      if (el.type === 'color') {
        if (getCC(roll.roll, roll.color) !== el.value) { match = false; break; }
      } else {
        if (parseInt(roll.roll as string) !== el.value) { match = false; break; }
      }
    }
    if (!match) continue;

    occurrences++;
    // Look ahead up to maxGale+1 rolls for a Branco
    let found = false;
    for (let g = 1; g <= maxGale + 1 && i + g < rolls.length; g++) {
      const next = rolls[i + g];
      if (getCC(next.roll, next.color) === 'B') {
        win++;
        curLoss = 0;
        found = true;
        i += g; // skip checked rolls
        break;
      }
    }
    if (!found) {
      loss++;
      curLoss++;
      if (curLoss > sm) sm = curLoss;
    }
  }

  // A sequência atual (sa) é o valor de curLoss após processar todo o histórico
  sa = curLoss;

  return { win, loss, sm, sa, occurrences };
}

const STORAGE_KEY = 'mineracao_results_v1';

// ─── Componente Principal ────────────────────────────────────────────────────
export default function MineracaoProfunda({ data }: MineracaoProps) {
  // Filtros
  const [patternSize, setPatternSize] = useState(2);
  const [periodDays, setPeriodDays] = useState(7);
  const [minWinRate, setMinWinRate] = useState(70);
  const [minOccurrences, setMinOccurrences] = useState(5);
  const [maxGale, setMaxGale] = useState(1);
  const [minSA, setMinSA] = useState(0);
  const [maxLossLimit, setMaxLossLimit] = useState(99);

  // Estado da busca
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [found, setFound] = useState<FoundPattern[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [sortCol, setSortCol] = useState<'winRate' | 'occurrences' | 'sm' | 'sa'>('winRate');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const abortRef = useRef(false);
  const chunkSize = 200; // patterns per chunk

  // Persistir em localStorage sempre que found mudar
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(found.slice(-500))); } catch {}
  }, [found]);

  // Preparar dados filtrados
  const filteredData = useCallback(() => {
    const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    return data.filter(r => {
      // Tenta filtrar por timestamp se disponível, senão usa tudo
      return true;
    });
    // Como os dados do ticker não têm timestamp front-end, usamos todos os dados disponíveis
    // Para busca mais profunda, a API precisaria retornar mais histórico
  }, [data, periodDays]);

  const handleSearch = useCallback(() => {
    if (isSearching) { abortRef.current = true; return; }

    const rolls = filteredData();
    if (rolls.length < patternSize + 1) {
      alert('Dados insuficientes. Aguarde mais giros ou reduza o tamanho do padrão.');
      return;
    }

    abortRef.current = false;
    setIsSearching(true);
    const t = totalPatternCount(patternSize);
    setTotal(t);
    setProgress(0);

    const gen = generatePatterns(patternSize);
    let checked = 0;
    const newResults: FoundPattern[] = [];

    function processChunk() {
      if (abortRef.current) {
        setIsSearching(false);
        return;
      }

      for (let i = 0; i < chunkSize; i++) {
        const next = gen.next();
        if (next.done) {
          // Finalizado
          setFound(prev => {
            const combined = [...prev];
            for (const r of newResults) {
              if (!combined.find(x => x.id === r.id)) combined.push(r);
            }
            return combined;
          });
          setIsSearching(false);
          return;
        }

        checked++;
        const pattern = next.value;
        const stats = evalPattern(pattern, rolls, maxGale);
        if (!stats) continue;

        const { win, loss, sm, sa, occurrences } = stats;
        
        // Filtros
        if (occurrences < minOccurrences) continue;
        const wr = win / (win + loss || 1);
        if (wr * 100 < minWinRate) continue;
        if (sa < minSA) continue;
        if (sm > maxLossLimit) continue;

        newResults.push({
          id: patternId(pattern),
          elements: pattern,
          win,
          loss,
          winRate: Math.round(wr * 1000) / 10,
          sm,
          sa,
          occurrences,
          foundAt: Date.now(),
        });
      }

      setProgress(checked);
      setTimeout(processChunk, 0);
    }

    processChunk();
  }, [isSearching, filteredData, patternSize, minWinRate, minOccurrences, maxGale, minSA, maxLossLimit]);

  const handleClear = () => {
    setFound([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const sortedFound = [...found].sort((a, b) => {
    const mul = sortDir === 'desc' ? -1 : 1;
    const valA = a[sortCol] ?? 0;
    const valB = b[sortCol] ?? 0;
    return (valA - valB) * mul;
  });

  const pct = total > 0 ? Math.min(100, (progress / total) * 100) : 0;
  const totalCombinations = totalPatternCount(patternSize);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  return (
    <div className="flex flex-col gap-6">

      {/* Filtros */}
      <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Pickaxe size={16} className="text-amber-400" />
          <h2 className="text-sm font-black uppercase tracking-widest text-amber-400">Configurar Mineração</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-4">
          {/* Tamanho do Padrão */}
          <div className="flex flex-col gap-1.5 xl:col-span-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Pedras</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(s => (
                <button key={s} onClick={() => setPatternSize(s)}
                  className={`flex-1 py-2 rounded-lg text-xs font-black transition-all border ${patternSize === s ? 'bg-amber-500/20 border-amber-500/60 text-amber-300' : 'border-white/10 text-gray-500 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Período */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Período</label>
            <select value={periodDays} onChange={e => setPeriodDays(Number(e.target.value))}
              className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none">
              {[3, 5, 7, 10, 15].map(d => <option key={d} value={d}>{d} dias</option>)}
            </select>
          </div>

          {/* Win Rate Mínimo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">TX Mín %</label>
            <input type="number" min={0} max={100} value={minWinRate} onChange={e => setMinWinRate(Number(e.target.value))}
              className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none" />
          </div>

          {/* Min Ocorrências */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Min Ocorr.</label>
            <input type="number" min={1} value={minOccurrences} onChange={e => setMinOccurrences(Number(e.target.value))}
              className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none" />
          </div>

          {/* Max Gale */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Max Gale</label>
            <select value={maxGale} onChange={e => setMaxGale(Number(e.target.value))}
              className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(g => <option key={g} value={g}>G{g}</option>)}
            </select>
          </div>

          {/* SA Min */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">SA Mín</label>
            <input type="number" min={0} value={minSA} onChange={e => setMinSA(Number(e.target.value))}
              className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none" />
          </div>

          {/* Max Loss */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Max Loss</label>
            <input type="number" min={0} value={maxLossLimit} onChange={e => setMaxLossLimit(Number(e.target.value))}
              className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none" />
          </div>

          {/* Botões */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Ações</label>
            <div className="flex gap-2">
              <button onClick={handleSearch}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all ${isSearching ? 'bg-red-500/20 border border-red-500/50 text-red-300 hover:bg-red-500/30' : 'bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30'}`}>
                {isSearching ? <><Square size={12} /> Parar</> : <><Play size={12} /> Buscar</>}
              </button>
              <button onClick={handleClear} title="Limpar resultados"
                className="p-2 rounded-lg border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-500/30 transition-all">
                <Trash2 size={14} />
              </button>
            </div>
            <span className="text-[9px] text-gray-600 text-center">{totalCombinations.toLocaleString()} combos</span>
          </div>
        </div>
      </div>

      {/* Barra de Progresso */}
      {(isSearching || (progress > 0 && progress < total)) && (
        <div className="bg-[#0d0f1a] border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                {isSearching ? 'Minerando padrões...' : 'Busca pausada'}
              </span>
            </div>
            <span className="text-xs font-mono text-gray-400">
              {progress.toLocaleString()} / {total.toLocaleString()} padrões
            </span>
          </div>
          <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-gray-600">{pct.toFixed(1)}% completo</span>
            <span className="text-[10px] text-green-400 font-bold">{found.length} encontrados</span>
          </div>
        </div>
      )}

      {/* Resultados */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-white">Padrões Encontrados</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">{found.length}</span>
            {found.length > 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/20 border border-blue-500/50 text-blue-300 text-[10px] font-black uppercase hover:bg-blue-500/30 transition-all"
              >
                <Download size={12} /> Gerar Lista
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-600">
            <span>Os resultados acumulam entre buscas.</span>
            <button onClick={handleClear} className="text-red-400 hover:text-red-300 underline transition-colors">Limpar tudo</button>
          </div>
        </div>

        {/* Modal de Exportação */}
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0d0f1a] border border-white/10 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-900/20 to-purple-900/20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                    <Download size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Padrões Gerados</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">IA Formatada para copiar e colar</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white transition-colors">
                  <Square size={18} className="rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-2 bg-black/40">
                {sortedFound.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm font-mono text-gray-300 bg-white/[0.02] p-2 rounded-lg border border-white/5">
                    <div className="flex gap-1 items-center">
                      {f.elements.map((el, i) => (
                        <span key={i}>
                          {el.type === 'color' ? colorEmoji(el.value) : el.value}
                        </span>
                      ))}
                    </div>
                    <span className="text-gray-600 font-bold">=</span>
                    <span className="text-white">⚪</span>
                    <span className="text-blue-400 font-bold italic">g{maxGale}</span>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-white/5 bg-[#0a0c14] flex flex-col gap-3">
                <button
                  onClick={() => {
                    const text = sortedFound.map(f => {
                      const els = f.elements.map(e => e.type === 'color' ? colorEmoji(e.value) : e.value).join(' ');
                      return `${els} = ⚪ g${maxGale}`;
                    }).join('\n');
                    navigator.clipboard.writeText(text);
                    alert('Lista copiada para a área de transferência!');
                  }}
                  className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all shadow-lg"
                >
                  Copiar Lista Completa
                </button>
                <button onClick={() => setShowModal(false)} className="w-full py-3 bg-white/5 text-gray-400 font-bold uppercase text-[10px] tracking-widest rounded-xl hover:bg-white/10 transition-all">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {found.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white/[0.02] border border-white/5 rounded-2xl">
            <Pickaxe size={40} className="text-gray-700" />
            <p className="text-gray-500 text-sm text-center">
              Nenhum padrão encontrado ainda.<br />
              <span className="text-gray-600 text-xs">Configure os filtros e clique em Buscar para iniciar a mineração.</span>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-gradient-to-r from-amber-900/30 to-yellow-900/20 text-white border-b border-white/10">
                  <th className="p-3 text-center text-xs font-bold uppercase">Padrão</th>
                  <th className="p-3 text-center text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition-colors" onClick={() => toggleSort('winRate')}>
                    TX {sortCol === 'winRate' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="p-3 text-center text-xs font-bold uppercase text-green-400">WIN</th>
                  <th className="p-3 text-center text-xs font-bold uppercase text-red-400">LOSS</th>
                  <th className="p-3 text-center text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition-colors" onClick={() => toggleSort('occurrences')}>
                    OCC {sortCol === 'occurrences' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="p-3 text-center text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition-colors" onClick={() => toggleSort('sm')}>
                    SM {sortCol === 'sm' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="p-3 text-center text-xs font-bold uppercase cursor-pointer hover:bg-white/10 transition-colors" onClick={() => toggleSort('sa')}>
                    SA {sortCol === 'sa' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="p-3 text-center text-xs font-bold uppercase text-gray-500">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {sortedFound.map(row => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors">
                      {/* Padrão visual */}
                      <td className="p-2">
                        <div className="flex gap-1 justify-center flex-wrap">
                          {row.elements.map((el, i) =>
                            el.type === 'color' ? (
                              <div key={i} className={`w-7 h-7 rounded-md flex items-center justify-center text-base ${el.value === 'V' ? 'bg-red-600/80' : el.value === 'P' ? 'bg-zinc-800' : 'bg-white/90'}`}>
                                {colorEmoji(el.value)}
                              </div>
                            ) : (
                              <div key={i} className={`w-7 h-7 rounded-md flex items-center justify-center font-black text-xs ${numColor(el.value)}`}>
                                {el.value}
                              </div>
                            )
                          )}
                        </div>
                      </td>
                      {/* Stats */}
                      <td className={`p-3 text-center font-black text-sm ${row.winRate >= 80 ? 'text-green-400' : row.winRate >= 70 ? 'text-yellow-400' : 'text-orange-400'}`}>
                        {row.winRate.toFixed(1)}%
                      </td>
                      <td className="p-3 text-center text-green-400 font-bold">{row.win}</td>
                      <td className="p-3 text-center text-red-400">{row.loss}</td>
                      <td className="p-3 text-center text-blue-300">{row.occurrences}</td>
                      <td className="p-3 text-center text-purple-300">{row.sm}</td>
                      <td className="p-3 text-center text-amber-300 font-bold">{row.sa}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-400">
                          {expandedId === row.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </td>
                    </tr>
                    {/* Linha expandida */}
                    {expandedId === row.id && (
                      <tr key={`${row.id}-expand`} className="bg-amber-500/5 border-b border-amber-500/20">
                        <td colSpan={7} className="p-4">
                          <div className="flex flex-wrap gap-4 text-xs">
                            <div>
                              <span className="text-gray-500 uppercase font-bold">Padrão texto: </span>
                              <span className="font-mono text-amber-300">
                                {row.elements.map(e => e.type === 'color' ? colorLabel(e.value) : `Número ${e.value}`).join(' → ')}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 uppercase font-bold">Exportar: </span>
                              <code className="text-green-300 bg-black/30 px-2 py-0.5 rounded font-mono">
                                [{row.elements.map(e => e.type === 'color' ? `"${e.value}"` : e.value).join(', ')}]
                              </code>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Aviso anti-refresh */}
      <div className="flex items-center gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
        <span className="text-blue-400 text-lg">💾</span>
        <p className="text-[11px] text-blue-300/70">
          Os padrões encontrados são salvos automaticamente no seu navegador. Se atualizar a página, os resultados da última busca serão restaurados.
        </p>
      </div>
    </div>
  );
}
