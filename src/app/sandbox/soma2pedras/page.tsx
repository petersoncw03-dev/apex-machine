'use client';

import { useState, useMemo, useEffect } from 'react';
import { Calculator, Play, Settings2, Target, History, RefreshCw, BarChart2, Download } from 'lucide-react';

interface TickerData {
  id: string;
  color: string;
  roll: string;
  timestamp: string;
}

interface BacktestResult {
  totalRoundsTested: number;
  signalsGenerated: number;
  hits: number;
  misses: number;
  winRate: number;
  maxDrawdown: number; // Max Consecutive Losses (SM)
  maxConsecutiveWins: number;
  currentSA: number;
  cycleHistory: { type: 'W' | 'L', count: number }[];
}

export default function Soma2PedrasSimulator() {
  const [data, setData] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedCycles, setExpandedCycles] = useState(false);
  
  // Configs da Máquina do Tempo
  const [daysHistory, setDaysHistory] = useState(3);
  const [lookbackHours, setLookbackHours] = useState(24);
  
  // Filtros da Estratégia
  const [targetMode, setTargetMode] = useState<'branco'>('branco'); // Futuramente pode ter cores
  const [minWinRate, setMinWinRate] = useState(10);
  const [maxWinRate, setMaxWinRate] = useState(100);
  const [minWhites, setMinWhites] = useState(2);
  const [minSA, setMinSA] = useState(0);
  const [maxSA, setMaxSA] = useState(999);
  const [maxSM, setMaxSM] = useState(15);
  
  // Filtro de Zona
  const [zoneMode, setZoneMode] = useState<'off' | 'has_white' | 'no_white'>('off');
  const [zoneRounds, setZoneRounds] = useState(10);

  const [results, setResults] = useState<BacktestResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
     fetchData(1, true); // Silent mode on mount
  }, []);

  const fetchData = async (days: number, silent = false): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/results/period?hours=${days * 24}`);
      if (!res.ok) {
         const errData = await res.json().catch(() => null);
         if (!silent) alert(errData?.error || 'Falha ao baixar dados da nuvem.');
         return false;
      }
      const json = await res.json();
      if (json.data) {
        const parsed = json.data.map((r: any) => ({ 
          ...r, 
          color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(), 
          roll: r.roll?.toString() 
        }));
        setData(parsed);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Fetch Data Error:", err);
      if (!silent) alert("Erro de conexão ao buscar histórico.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async () => {
    setIsSimulating(true);
    setHasRun(false);
    setResults(null);
    setProgress(0);
    
    // Sempre baixa o histórico necessário no momento do clique
    const success = await fetchData(daysHistory);
    if (!success) {
        setIsSimulating(false);
        return;
    }

    // Delay curto para renderizar UI de loading antes de travar a thread
    setTimeout(() => {
      executeBacktest();
    }, 100);
  };

  const executeBacktest = async () => {
      const lookbackRecords = lookbackHours * 120; // 1h = 120 giros aprox
      
      // Use os dados atuais do estado
      const dataset = data;

      if (dataset.length <= lookbackRecords) {
        alert(`O período selecionado (${dataset.length} giros) tem menos dados do que a janela de análise (${lookbackRecords} giros). Aumente os dias de histórico.`);
        setIsSimulating(false);
        return;
      }

      let wins = 0;
      let losses = 0;
      let consecutiveWins = 0;
      let consecutiveLosses = 0;
      let maxConsecutiveWins = 0;
      let maxConsecutiveLosses = 0;
      let signalsGenerated = 0;
      let currentGlobalSA = 0;

      let cycleHistory: { type: 'W' | 'L', count: number }[] = [];
      let currentCycleType: 'W' | 'L' | null = null;
      let currentCycleCount = 0;

      // Percorre a linha do tempo começando DEPOIS de preencher a janela de memória
      for (let T = lookbackRecords; T < dataset.length; T++) {
        
        // Atualiza a barrinha a cada 500 pedras para não travar o navegador
        if (T % 500 === 0) {
            setProgress(Math.round(((T - lookbackRecords) / (dataset.length - lookbackRecords)) * 100));
            await new Promise(resolve => setTimeout(resolve, 0)); // Yield to UI
        }

        const stone1 = parseInt(dataset[T-1].roll);
        const stone2 = parseInt(dataset[T-2].roll);
        
        if (isNaN(stone1) || isNaN(stone2)) continue;
        const currentSum = stone1 + stone2;

        // -------------------------------------------------------------
        // ENGINE: Analisar o que aconteceu com essa soma nas últimas X horas
        // -------------------------------------------------------------
        let sumTotal = 0;
        let sumHits = 0;
        let sumSA = 0;
        let sumSM = 0;

        const lookbackStart = T - lookbackRecords;
        
        // Loop pela janela de memória
        for (let i = lookbackStart + 2; i < T; i++) {
           const pastS1 = parseInt(dataset[i-1].roll);
           const pastS2 = parseInt(dataset[i-2].roll);
           if (isNaN(pastS1) || isNaN(pastS2)) continue;
           
           if (pastS1 + pastS2 === currentSum) {
               sumTotal++;
               const hitRoll = dataset[i];
               const isBranco = hitRoll.color.includes('Branco') || hitRoll.roll === '0';

               if (isBranco) {
                   sumHits++;
                   sumSA = 0;
               } else {
                   sumSA++;
                   if (sumSA > sumSM) sumSM = sumSA;
               }
           }
        }

        // Se essa soma nunca caiu nas últimas X horas, ignora
        if (sumTotal === 0) continue;

        // Calcula as métricas atuais da soma no tempo 'T'
        const winRate = (sumHits / sumTotal) * 100;
        
        // CHECA OS FILTROS DA ESTRATÉGIA
        const passedFilters = winRate >= minWinRate && winRate <= maxWinRate && sumHits >= minWhites && sumSA >= minSA && sumSA <= maxSA && sumSM <= maxSM;

        let zoneApproved = true;
        if (passedFilters && zoneMode !== 'off') {
            let whitesInZone = 0;
            const zStart = Math.max(0, T - zoneRounds);
            for (let z = zStart; z < T; z++) {
                if (dataset[z].color.includes('Branco') || dataset[z].roll === '0') {
                    whitesInZone++;
                }
            }
            if (zoneMode === 'has_white' && whitesInZone === 0) zoneApproved = false;
            if (zoneMode === 'no_white' && whitesInZone > 0) zoneApproved = false;
        }

        if (passedFilters && zoneApproved) {
           signalsGenerated++;
           const latestStone = dataset[T]; // O que caiu na rodada apostada
           const isHit = latestStone.color.includes('Branco') || latestStone.roll === '0';

           if (isHit) {
              wins++;
              consecutiveWins++;
              if (consecutiveWins > maxConsecutiveWins) maxConsecutiveWins = consecutiveWins;
              
              consecutiveLosses = 0;
              currentGlobalSA = 0;
              
              if (currentCycleType === 'L') {
                 cycleHistory.push({ type: 'L', count: currentCycleCount });
                 currentCycleType = 'W';
                 currentCycleCount = 1;
              } else {
                 currentCycleType = 'W';
                 currentCycleCount++;
              }
           } else {
              losses++;
              consecutiveLosses++;
              currentGlobalSA++;
              
              if (consecutiveLosses > maxConsecutiveLosses) maxConsecutiveLosses = consecutiveLosses;
              consecutiveWins = 0;
              
              if (currentCycleType === 'W') {
                 cycleHistory.push({ type: 'W', count: currentCycleCount });
                 currentCycleType = 'L';
                 currentCycleCount = 1;
              } else if (currentCycleType === null) {
                 currentCycleType = 'L';
                 currentCycleCount = 1;
              } else {
                 currentCycleCount++;
              }
           }
        }
      }

      // Finaliza o último ciclo após o fim do dataset
      if (currentCycleCount > 0) {
         cycleHistory.push({ type: currentCycleType!, count: currentCycleCount });
      }

      setResults({
          totalRoundsTested: dataset.length - lookbackRecords,
          signalsGenerated,
          hits: wins,
          misses: losses,
          winRate: signalsGenerated > 0 ? (wins / signalsGenerated) * 100 : 0,
          maxDrawdown: maxConsecutiveLosses,
          maxConsecutiveWins,
          currentSA: currentGlobalSA,
          cycleHistory: cycleHistory
      });
      
      setProgress(100);
      setIsSimulating(false);
      setHasRun(true);
  };

  const downloadReport = () => {
      if (!results) return;
      
      const txt = `========================================
RELATÓRIO DE BACKTEST - SOMA DE 2 PEDRAS
========================================
Data do Teste: ${new Date().toLocaleString()}

PARÂMETROS UTILIZADOS:
- Base de Dados: Últimos ${daysHistory} Dias
- Janela de Análise: ${lookbackHours} Horas
- Alvo: ${targetMode.toUpperCase()}
- Assertividade: ${minWinRate}% a ${maxWinRate}%
- Mín. Brancos (Hits): ${minWhites}
- SA Atual Permitido: ${minSA} a ${maxSA}
- Max SM (Limite): ${maxSM}
- Bloqueio de Zona: ${zoneMode !== 'off' ? `${zoneMode} (${zoneRounds} rodadas)` : 'OFF'}

RESULTADOS DA PERFORMANCE:
- Rodadas Testadas: ${results.totalRoundsTested}
- Total de Sinais: ${results.signalsGenerated}
- Win Rate: ${results.winRate.toFixed(2)}%
- Acertos (G0): ${results.hits}
- Erros (Loss): ${results.misses}
- Máximo de Wins Seguidos: ${results.maxConsecutiveWins}
- Maior Quebra (Max Loss Streak): ${results.maxDrawdown}
- SA Restante no Final: ${results.currentSA}
========================================`;

      const blob = new Blob([txt], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Soma2Pedras_Config_${new Date().getTime()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-[1400px] w-full mx-auto flex flex-col gap-6 bg-[#030303]">
        {/* HEADER */}
        <section className="flex flex-wrap justify-between items-center bg-[#0a0a0f] p-4 rounded-lg border border-white/5 gap-4 shadow-lg shadow-purple-900/10">
            <div className="flex flex-col">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 flex items-center gap-2">
                    <Calculator className="text-purple-500" />
                    Soma de 2 Pedras
                    </h2>
                    <span className="bg-[#12141c] border border-white/10 text-[10px] font-bold px-2 py-1 rounded text-purple-400">
                    SIMULADOR
                    </span>
                </div>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Máquina do Tempo - Entrada Seca (G0)</span>
            </div>

            <button 
                onClick={runSimulation}
                disabled={isSimulating || loading}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-black text-sm uppercase px-6 py-3 rounded-lg flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)]"
            >
                {isSimulating || loading ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} />}
                {isSimulating ? 'Viajando no Tempo...' : loading ? 'Baixando Histórico...' : 'Iniciar Backtest'}
            </button>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* PAINEL DE CONFIGURAÇÕES (FILTROS) */}
            <section className="lg:col-span-1 bg-[#0a0a0f] border border-[#2a2a35] rounded-xl p-5 flex flex-col gap-6 shadow-xl">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                    <Settings2 size={16} className="text-purple-500" /> Parâmetros
                </h3>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Base de Dados (Histórico)</label>
                        <select 
                            className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-sm font-bold outline-none focus:border-purple-500 w-full"
                            value={daysHistory}
                            onChange={(e) => setDaysHistory(Number(e.target.value))}
                            disabled={isSimulating}
                        >
                            <option value={1}>Últimas 24 Horas</option>
                            <option value={3}>Últimos 3 Dias</option>
                            <option value={5}>Últimos 5 Dias</option>
                            <option value={7}>Últimos 7 Dias</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-[#e85dff] font-bold uppercase tracking-widest" title="Ao simular uma rodada no passado, quantas horas para trás o robô deve olhar para calcular a assertividade?">
                            Janela de Análise (Olhar p/ Trás)
                        </label>
                        <select 
                            className="bg-[#12141c] border border-white/10 text-[#e85dff] px-3 py-2 rounded-lg text-sm font-bold outline-none focus:border-[#e85dff] w-full"
                            value={lookbackHours}
                            onChange={(e) => setLookbackHours(Number(e.target.value))}
                            disabled={isSimulating}
                        >
                            <option value={1}>Última 1 Hora</option>
                            <option value={2}>Últimas 2 Horas</option>
                            <option value={3}>Últimas 3 Horas</option>
                            <option value={4}>Últimas 4 Horas</option>
                            <option value={6}>Últimas 6 Horas</option>
                            <option value={9}>Últimas 9 Horas</option>
                            <option value={12}>Últimas 12 Horas</option>
                            <option value={24}>Últimas 24 Horas</option>
                            <option value={36}>Últimas 36 Horas</option>
                            <option value={48}>Últimas 48 Horas</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Alvo</label>
                        <select 
                            className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-sm font-bold outline-none focus:border-purple-500 w-full"
                            value={targetMode}
                            onChange={(e) => setTargetMode(e.target.value as any)}
                            disabled={isSimulating}
                        >
                            <option value="branco">BRANCOS</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Assertividade (Mín / Máx %)</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" min="0" max="100" placeholder="Mín %"
                                className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-sm font-bold outline-none focus:border-green-500 w-full transition-colors"
                                value={minWinRate}
                                onChange={e => setMinWinRate(Number(e.target.value))}
                                disabled={isSimulating}
                            />
                            <input 
                                type="number" min="0" max="100" placeholder="Máx %"
                                className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-sm font-bold outline-none focus:border-green-500 w-full transition-colors"
                                value={maxWinRate}
                                onChange={e => setMaxWinRate(Number(e.target.value))}
                                disabled={isSimulating}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Mínimo de Brancos na Janela (Hits)</label>
                        <input 
                            type="number" min="0"
                            className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-sm font-bold outline-none focus:border-purple-500 w-full transition-colors"
                            value={minWhites}
                            onChange={e => setMinWhites(Number(e.target.value))}
                            disabled={isSimulating}
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="flex flex-col gap-1.5 w-1/2">
                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">SA Atual (Mín / Máx)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="number" min="0" placeholder="Mín"
                                    className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-sm font-bold outline-none focus:border-purple-500 w-full transition-colors"
                                    value={minSA}
                                    onChange={e => setMinSA(Number(e.target.value))}
                                    disabled={isSimulating}
                                />
                                <input 
                                    type="number" min="0" placeholder="Máx"
                                    className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-sm font-bold outline-none focus:border-purple-500 w-full transition-colors"
                                    value={maxSA}
                                    onChange={e => setMaxSA(Number(e.target.value))}
                                    disabled={isSimulating}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5 w-1/2">
                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Max SM (Lim)</label>
                            <input 
                                type="number" min="0"
                                className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-sm font-bold outline-none focus:border-purple-500 w-full transition-colors"
                                value={maxSM}
                                onChange={e => setMaxSM(Number(e.target.value))}
                                disabled={isSimulating}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
                        <label className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest flex items-center gap-2">
                           Bloqueio de Zona (Antes da Entrada)
                        </label>
                        <div className="flex gap-2">
                            <select 
                                className="bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-xs font-bold outline-none focus:border-yellow-500 w-2/3"
                                value={zoneMode}
                                onChange={(e) => setZoneMode(e.target.value as any)}
                                disabled={isSimulating}
                            >
                                <option value="off">Desativado (OFF)</option>
                                <option value="no_white">Sem Branco nas Últimas...</option>
                                <option value="has_white">Com Branco nas Últimas...</option>
                            </select>
                            <select 
                                className={`bg-[#12141c] border border-white/10 text-white px-3 py-2 rounded-lg text-xs font-bold outline-none w-1/3 ${zoneMode !== 'off' ? 'focus:border-yellow-500 opacity-100' : 'opacity-30'}`}
                                value={zoneRounds}
                                onChange={(e) => setZoneRounds(Number(e.target.value))}
                                disabled={isSimulating || zoneMode === 'off'}
                            >
                                {[5, 10, 15, 20, 30].map(r => <option key={r} value={r}>{r} Rodadas</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            {/* RESULTADOS DA SIMULAÇÃO */}
            <section className="lg:col-span-3 bg-[#121214] border border-[#2a2a35] rounded-xl shadow-xl flex flex-col relative overflow-hidden min-h-[500px]">
                {!hasRun && !isSimulating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10 p-6 text-center">
                        <History size={48} className="text-purple-500/50 mb-4" />
                        <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-2">Aguardando Parâmetros</h3>
                        <p className="text-gray-500 text-sm max-w-md">
                            Ajuste os filtros de assertividade e a janela horária. Em seguida inicie a Máquina do Tempo.
                        </p>
                    </div>
                ) : null}

                {isSimulating && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f]/90 backdrop-blur-sm z-20 p-8 text-center">
                        <div className="flex flex-col gap-4 w-full max-w-md">
                            <div className="flex justify-between items-center text-xs font-bold text-purple-400 uppercase tracking-widest">
                                <span>Progresso da Simulação</span>
                                <span className="text-white">{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-800 h-4 rounded-full overflow-hidden shadow-inner">
                                <div 
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-200"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-2 animate-pulse font-bold tracking-widest uppercase">
                                Calculando milhares de rodadas no passado...
                            </p>
                        </div>
                   </div>
                )}

                <div className={`p-6 flex flex-col gap-6 transition-opacity duration-500 ${!hasRun && !isSimulating ? 'opacity-20 blur-sm pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <BarChart2 size={20} className="text-purple-500" /> Relatório Oficial de Performance
                        </h3>
                        {results && (
                            <button onClick={downloadReport} className="flex items-center gap-2 text-xs font-bold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 px-3 py-2 rounded-lg border border-purple-500/20 transition-colors uppercase tracking-widest">
                                <Download size={14} /> Salvar Configuração
                            </button>
                        )}
                    </div>

                    {results && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-[#0a0a0f] border border-white/5 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Win Rate</span>
                                    <span className={`text-3xl font-black ${results.winRate >= 80 ? 'text-green-500' : results.winRate >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                                        {results.winRate.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="bg-[#0a0a0f] border border-white/5 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Sinais Gerados</span>
                                    <span className="text-3xl font-black text-white">{results.signalsGenerated}</span>
                                </div>
                                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest mb-1">Acertos (G0)</span>
                                    <span className="text-3xl font-black text-green-400">{results.hits}</span>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest mb-1">Erros (Loss)</span>
                                    <span className="text-3xl font-black text-red-400">{results.misses}</span>
                                </div>
                                
                                <div className="bg-[#12141c] border border-white/5 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Max Wins Seguidos</span>
                                    <span className="text-2xl font-black text-green-400">{results.maxConsecutiveWins}</span>
                                </div>
                                <div className="bg-[#12141c] border border-white/5 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Maior Streak de Erros (Max SM)</span>
                                    <span className="text-2xl font-black text-red-400">{results.maxDrawdown}</span>
                                </div>
                                <div className="bg-[#12141c] border border-white/5 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">SA Atual do Sistema</span>
                                    <span className="text-2xl font-black text-purple-400">{results.currentSA}</span>
                                </div>
                                <div className="bg-[#12141c] border border-white/5 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Rodadas Testadas</span>
                                    <span className="text-lg font-black text-gray-400">{results.totalRoundsTested} giros</span>
                                </div>
                            </div>

                            <div className="mt-2 border-t border-white/5 pt-6 flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                   <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Sequência de Ciclos (W/L)</h4>
                                   <button 
                                      onClick={() => setExpandedCycles(!expandedCycles)}
                                      className="text-[9px] uppercase font-black tracking-widest bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 px-3 py-1.5 rounded-full transition-colors border border-purple-500/30"
                                   >
                                      {expandedCycles ? 'Recolher Grade' : 'Expandir Grade'}
                                   </button>
                                </div>

                                <div className="bg-[#0a0a0f] border border-white/5 rounded-lg p-4 min-h-[80px]">
                                    {results.cycleHistory.length === 0 ? (
                                        <div className="text-center text-gray-500 font-bold text-sm h-full flex items-center justify-center">Nenhum ciclo gerado (Sem sinais)</div>
                                    ) : (
                                        <div className={`flex gap-2 ${expandedCycles ? 'flex-wrap' : 'overflow-x-auto custom-scrollbar pb-2 items-center'}`}>
                                            {[...results.cycleHistory].reverse().map((c, i) => (
                                                <div key={i} className={`flex items-center justify-center shrink-0 w-10 h-10 rounded-lg border font-black text-sm shadow-lg
                                                    ${c.type === 'W' ? 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(74,222,128,0.1)]' : 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(248,113,113,0.1)]'}
                                                `} title={`${c.count} ${c.type === 'W' ? 'Vitórias' : 'Derrotas'} consecutivas`}>
                                                    {c.count}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </section>
        </div>
    </main>
  );
}
