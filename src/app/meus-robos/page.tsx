"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const USER_ID = "admin_master";
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/backend';

interface StrategyConfig {
  id: number;
  name: string;
  filters: {
    periodHours?: number;
    patternType?: string;
    entriesLimit?: number;
    targetFocus?: string;
    minTriggers?: number;
    minWinRate?: number;
    maxSa?: number;
    minSaFilter?: number;
    selectedSize?: number;
    useMixedMining?: boolean;
    useTrendFilter?: boolean;
    ind1Type?: string;
    ind1Period?: number;
    ind2Type?: string;
    ind2Period?: number;
    max_group_gale?: number;
  };
  target_telegram_id: string;
  auto_refresh: boolean;
  min_confluence: number;
  active_patterns: number;
  last_refresh: string | null;
  created_at: string;
}

interface GroupSession {
  id: number;
  target_telegram_id: string;
  session_start: string;
  session_end: string | null;
  is_active: boolean;
  wins: number;
  losses: number;
  gales: any;
  pnl: number;
  total_signals: number;
  ciclos: {type: 'win' | 'loss', count: number}[];
}

const targetLabel: Record<string, string> = {
  'Branco': '⚪ Branco', 'Vermelho': '🔴 Vermelho', 'Preto': '⚫ Preto', 'Ambos': '🌓 Verm/Preto'
};

const typeLabel: Record<string, string> = {
  'TODOS': '⭐ Todos', 'ONLY_COLORS': '🔴 Cores', 'ONLY_NUMBERS': '🔢 Números',
  'COLORS_1_NUM': '🎨 Cores+1Num', '1_NUM_COLORS': '🔢 1Num+Cores',
  'COLORS_2_NUM': '🎨 Cores+2Num', '2_NUM_COLORS': '🔢 2Num+Cores',
};

const Sparkline = () => {
  // Dados simulados gerando uma curva de recuperação (Martingale spike)
  const data = [20, 18, 16, 14, 28, 26, 24, 22, 20, 18, 16, 30, 28, 26, 40, 38, 36, 34, 32, 46, 44, 42, 40, 38, 36, 34, 48, 46, 44, 58, 56, 54, 52, 50, 48, 46, 44, 42, 40, 38, 36, 34, 32, 30, 28, 42, 40, 38];
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 400;
  const height = 100;
  const stepWidth = width / (data.length - 1);

  return (
    <svg width="100%" height="100%" viewBox={`0 -10 ${width} ${height + 20}`} preserveAspectRatio="none" className="overflow-visible drop-shadow-[0_0_8px_rgba(0,255,0,0.15)]">
       {data.map((val, i) => {
         if (i === 0) return null;
         const prevVal = data[i-1];
         const x1 = (i-1) * stepWidth;
         const x2 = i * stepWidth;
         const y1 = height - ((prevVal - min) / range) * height;
         const y2 = height - ((val - min) / range) * height;
         
         const isWin = val > prevVal;
         const color = isWin ? '#00ff00' : '#ff0000';
         
         return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y1} stroke={color} strokeWidth="1.5" strokeDasharray={!isWin ? "4,4" : "none"} opacity={isWin ? 1 : 0.4} />
              <line x1={x2} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2.5" />
            </g>
         )
       })}
       <circle cx={width} cy={height - ((data[data.length-1] - min) / range) * height} r="4" fill="#ff0000" className="animate-pulse" />
       {/* Linha base simulando o zero/stop */}
       <line x1="0" y1={height} x2={width} y2={height} stroke="#ff0000" strokeWidth="1" strokeDasharray="2,2" opacity="0.3" />
    </svg>
  );
};

export default function MeusRobosPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<StrategyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [filterModal, setFilterModal] = useState<StrategyConfig | null>(null);
  
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [showSessionsModal, setShowSessionsModal] = useState(false);

  const openFilterModal = (cfg: StrategyConfig) => setFilterModal(cfg);
  const closeFilterModal = () => setFilterModal(null);

  const openInFabrica = (cfg: StrategyConfig) => {
    const f = cfg.filters;
    const params = new URLSearchParams({
      periodHours:   String(f.periodHours   ?? 24),
      patternType:   String(f.patternType   ?? 'TODOS'),
      entriesLimit:  String(f.entriesLimit  ?? 3),
      targetFocus:   String(f.targetFocus   ?? 'Branco'),
      minTriggers:   String(f.minTriggers   ?? 5),
      minWinRate:    String(f.minWinRate    ?? 90),
      maxSa:         String(f.maxSa         ?? 2),
      minSaFilter:   String(f.minSaFilter   ?? 0),
      selectedSize:  String(f.selectedSize  ?? 0),
      useMixedMining: String(f.useMixedMining === true),
      useTrendFilter: String(f.useTrendFilter === true),
      ind1Type:      String(f.ind1Type      ?? 'sma'),
      ind1Period:    String(f.ind1Period    ?? 7),
      ind2Type:      String(f.ind2Type      ?? 'ema'),
      ind2Period:    String(f.ind2Period    ?? 21),
    });
    router.push(`/meus-robos/novo-bot?${params.toString()}`);
  };

  const fetchConfigs = async () => {
    try {
      const res = await fetch(`${API_URL}/strategy-configs/${USER_ID}`);
      if (res.ok) {
        const json = await res.json();
        setConfigs(json.configs || []);
      }
      const sessRes = await fetch(`${API_URL}/group-sessions`);
      if (sessRes.ok) {
        const sessJson = await sessRes.json();
        setSessions(sessJson.sessions || []);
      }
    } catch (err) {
      console.error("[SaaS] Erro ao buscar configs:", err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchConfigs(); const i = setInterval(fetchConfigs, 15000); return () => clearInterval(i); }, []);

  const toggleConfig = async (id: number) => {
    try {
      await fetch(`${API_URL}/strategy-configs/${id}/toggle`, { method: 'PATCH' });
      fetchConfigs();
    } catch(e) { console.error(e); }
  };

  const deleteConfig = async (id: number) => {
    if (!confirm("Excluir este agente e todos os robôs gerados por ele?")) return;
    try {
      await fetch(`${API_URL}/strategy-configs/${id}`, { method: 'DELETE' });
      fetchConfigs();
    } catch(e) { console.error(e); }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return 'Nunca';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  };

  const [activeCount, setActiveCount] = useState<{total:number, auto_generated:number, manual:number}>({total:0,auto_generated:0,manual:0});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<number, {name: string, target_telegram_id: string}>>({}); 

  // ── Filter Modal Labels ──
  const typeFullLabel: Record<string, string> = {
    'TODOS':         '⭐ Todos os Tipos',
    'ONLY_COLORS':   '🎨 Somente Cores',
    'ONLY_NUMBERS':  '🔢 Somente Números',
    'COLORS_1_NUM':  '🎨 Cores + 1 Número',
    '1_NUM_COLORS':  '🔢 1 Número + Cores',
    'COLORS_2_NUM':  '🎨 Cores + 2 Números',
    '2_NUM_COLORS':  '🔢 2 Números + Cores',
  };
  const targetFullLabel: Record<string, string> = {
    'Branco':   '⚪ Branco',
    'Vermelho': '🔴 Vermelho',
    'Preto':    '⚫ Preto',
    'Ambos':    '🌓 Vermelho & Preto',
  };

  const handleUpdateConfig = async (id: number) => {
    const current = configs.find(c => c.id === id);
    const updated = editData[id] || {};
    
    // Mescla os dados editados com os atuais caso o usuário não tenha mexido em um dos campos
    const finalData = {
      name: updated.name !== undefined ? updated.name : (current?.name || ""),
      target_telegram_id: updated.target_telegram_id !== undefined ? updated.target_telegram_id : (current?.target_telegram_id || "")
    };

    console.log("[SaaS] Salvando alteração para Agente", id, finalData);

    try {
      const res = await fetch(`${API_URL}/strategy-configs/${id}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });

      if (res.ok) {
        alert("✅ Configurações salvas com sucesso!");
        fetchConfigs();
      } else {
        const err = await res.text();
        console.error("[SaaS] Erro ao salvar:", err);
        alert("❌ Erro ao salvar. Verifique se o servidor está online.");
      }
    } catch(e) { 
      console.error("[SaaS] Falha na requisição:", e);
      alert("❌ Falha na conexão com o servidor.");
    }
  };

  const handleUpdateGroupConfluence = async (telegramId: string, minConf: number) => {
    try {
      const res = await fetch(`${API_URL}/strategy-configs/group/${encodeURIComponent(telegramId)}/confluence`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_confluence: minConf })
      });
      if (res.ok) {
        fetchConfigs();
        alert(`✅ Grupo ${telegramId} agora exige ${minConf}+ confluência(s).`);
      } else {
        alert("❌ Erro ao atualizar confluência do grupo.");
      }
    } catch(e) {
      alert("❌ Falha na conexão com o servidor.");
    }
  };

  const fetchActiveCount = async () => {
    try {
      const res = await fetch(`${API_URL}/user-patterns/${USER_ID}/active-count`);
      if (res.ok) setActiveCount(await res.json());
    } catch(e) {}
  };

  useEffect(() => { fetchActiveCount(); const j = setInterval(fetchActiveCount, 15000); return () => clearInterval(j); }, []);

  const startAll = async () => {
    if (!confirm("▶️ Ligar TODOS os agentes pausados?")) return;
    try {
      const pausedConfigs = configs.filter(c => !c.auto_refresh);
      for (const c of pausedConfigs) {
        await fetch(`${API_URL}/strategy-configs/${c.id}/toggle`, { method: 'PATCH' });
      }
      fetchConfigs();
      alert("✅ Todos os agentes foram ligados.");
    } catch(e) { console.error(e); }
  };

  const [trendModalGroup, setTrendModalGroup] = useState<{id: string, filters: any} | null>(null);

  const handleUpdateGroupTrend = async (telegramId: string, trendData: any) => {
    try {
      const res = await fetch(`${API_URL}/strategy-configs/group/${encodeURIComponent(telegramId)}/trend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trendData)
      });
      if (res.ok) {
        fetchConfigs();
        alert(`✅ Filtro de Tendência atualizado para o Grupo ${telegramId}.`);
      } else {
        alert("❌ Erro ao atualizar filtro de tendência.");
      }
    } catch(e) {
      console.error(e);
      alert("❌ Falha na conexão com o servidor.");
    }
  };

  const handleUpdateGroupMaxGale = async (telegramId: string, maxGale: number | null) => {
    try {
      const res = await fetch(`${API_URL}/strategy-configs/group/${encodeURIComponent(telegramId)}/max-gale`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_group_gale: maxGale })
      });
      if (res.ok) {
        fetchConfigs();
        alert(`✅ Grupo ${telegramId} atualizado com sucesso!`);
      } else {
        alert("❌ Erro ao atualizar o limite de RED do grupo.");
      }
    } catch(e) { console.error(e); }
  };
  const handleResetSession = async (telegramId: string) => {
    if (!confirm("Tem certeza que deseja finalizar a sessão atual e iniciar uma nova? O placar será zerado.")) return;
    try {
      const res = await fetch(`${API_URL}/group-sessions/${encodeURIComponent(telegramId)}/reset`, { method: 'POST' });
      if (res.ok) {
        fetchConfigs();
        alert(`✅ Nova sessão iniciada para o grupo ${telegramId}.`);
      } else {
        alert("❌ Erro ao iniciar nova sessão.");
      }
    } catch(e) { console.error(e); }
  };
const stopAll = async () => {
    if (!confirm("⚠️ Pausar TODOS os agentes e parar seus robôs?")) return;
    await fetch(`${API_URL}/user-patterns/stop-all/${USER_ID}`, { method: 'PUT' });
    fetchConfigs(); fetchActiveCount();
    alert("✅ Todos os agentes foram pausados.");
  };

  const deleteAll = async () => {
    if (!confirm("🗑️ DELETAR todos os robôs gerados? (Agentes mestres não serão afetados)")) return;
    await fetch(`${API_URL}/user-patterns/all/${USER_ID}`, { method: 'DELETE' });
    fetchActiveCount();
    alert("✅ Todos os robôs foram deletados.");
  };

  const fetchActiveSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/active-sessions`);
      if (res.ok) {
        const json = await res.json();
        setActiveSessions(json.sessions || []);
      }
    } catch(e) {}
  };

  useEffect(() => {
    if (showModal) {
      fetchActiveSessions();
      const interval = setInterval(fetchActiveSessions, 5000);
      return () => clearInterval(interval);
    }
  }, [showModal]);

  return (
    <div className="min-h-screen bg-[#0f1016] text-white p-6">
      {/* Filter Detail Modal */}
      {filterModal && (
        <FilterModal
          cfg={filterModal}
          onClose={closeFilterModal}
          onOpenFabrica={openInFabrica}
          typeFullLabel={typeFullLabel}
          targetFullLabel={targetFullLabel}
        />
      )}

      {/* Histórico de Sessões Modal */}
      {showSessionsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#15171e] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0f1016]">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">📊 Histórico de Sessões</h2>
                <p className="text-xs text-gray-500 mt-1">Ganhos e perdas separados por sessão/grupo.</p>
              </div>
              <button onClick={() => setShowSessionsModal(false)} className="text-gray-400 hover:text-white transition-colors text-xl">✕</button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {sessions.length === 0 ? (
                <p className="text-gray-500 text-center py-10">Nenhuma sessão registrada.</p>
              ) : (
                sessions.map(s => (
                  <div key={s.id} className="flex flex-col gap-2 w-full">
                    <div className={`flex flex-col md:flex-row items-center justify-between bg-[#0f1016] border ${s.is_active ? 'border-green-500/50' : 'border-white/5'} rounded-xl p-4 gap-4`}>
                      <div>
                        <div className="flex items-center gap-2">
                          {s.is_active ? <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> : <span className="w-2 h-2 rounded-full bg-gray-500"></span>}
                          <h3 className="font-bold text-white">Grupo {s.target_telegram_id}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${s.pnl >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {s.pnl >= 0 ? '+' : ''}R$ {Number(s.pnl).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Início: {formatTime(s.session_start)} {s.session_end ? `| Fim: ${formatTime(s.session_end)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-300">
                        <div className="flex flex-col items-center"><span className="text-gray-500 text-[10px] uppercase">Win</span><span className="font-bold text-green-400">{s.wins}</span></div>
                        <div className="flex flex-col items-center"><span className="text-gray-500 text-[10px] uppercase">Loss</span><span className="font-bold text-red-400">{s.losses}</span></div>
                        <div className="w-px h-6 bg-white/10"></div>
                        <div className="text-xs flex gap-2">
                          {Object.entries(s.gales || {}).map(([g, c]: any) => (
                            <span key={g} className="bg-white/5 px-2 py-1 rounded text-gray-400">{g}: {c}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Renderização dos Ciclos */}
                    {s.ciclos && s.ciclos.length > 0 && (
                      <div className="bg-[#0a0b0e] border border-white/5 rounded-lg p-3 w-full">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Sequência de Ciclos (W/L)</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {s.ciclos.map((ciclo, idx) => (
                            <div key={idx} className={`flex items-center justify-center px-3 py-1 rounded text-xs font-bold ${ciclo.type === 'win' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                              {ciclo.count}{ciclo.type === 'win' ? 'W' : 'L'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trend Modal Group */}
      {trendModalGroup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#15171e] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4">Configurar Tendência: Grupo {trendModalGroup.id}</h3>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-xs text-gray-400 font-bold uppercase block mb-1">Média Curta</label>
                  <select id="t_ind1Type" defaultValue={trendModalGroup.filters.ind1Type || 'sma'} className="bg-[#1a1c24] border border-white/10 rounded px-2 py-1.5 text-white w-full mb-2 outline-none focus:border-purple-500">
                     <option value="sma">SMA</option><option value="ema">EMA</option>
                  </select>
                  <input type="number" id="t_ind1Period" defaultValue={trendModalGroup.filters.ind1Period || 7} className="bg-[#1a1c24] border border-white/10 rounded px-2 py-1.5 text-white w-full outline-none focus:border-purple-500" />
               </div>
               <div>
                  <label className="text-xs text-gray-400 font-bold uppercase block mb-1">Média Longa</label>
                  <select id="t_ind2Type" defaultValue={trendModalGroup.filters.ind2Type || 'ema'} className="bg-[#1a1c24] border border-white/10 rounded px-2 py-1.5 text-white w-full mb-2 outline-none focus:border-purple-500">
                     <option value="sma">SMA</option><option value="ema">EMA</option>
                  </select>
                  <input type="number" id="t_ind2Period" defaultValue={trendModalGroup.filters.ind2Period || 21} className="bg-[#1a1c24] border border-white/10 rounded px-2 py-1.5 text-white w-full outline-none focus:border-purple-500" />
               </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
               <button onClick={() => setTrendModalGroup(null)} className="text-gray-400 hover:text-white px-4 py-2 text-sm font-bold">Cancelar</button>
               <button 
                 onClick={() => {
                   handleUpdateGroupTrend(trendModalGroup.id, {
                     useTrendFilter: true,
                     ind1Type: (document.getElementById('t_ind1Type') as HTMLSelectElement).value,
                     ind1Period: parseInt((document.getElementById('t_ind1Period') as HTMLInputElement).value),
                     ind2Type: (document.getElementById('t_ind2Type') as HTMLSelectElement).value,
                     ind2Period: parseInt((document.getElementById('t_ind2Period') as HTMLInputElement).value)
                   });
                   setTrendModalGroup(null);
                 }}
                 className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors"
               >
                 Salvar e Aplicar
               </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Central de Comando de Agentes
            </h1>
            <p className="text-gray-400 mt-1">Agentes IA salvos na VPS — monitoramento e recálculo a cada rodada.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-[#1a1c24] px-4 py-2 rounded-lg border border-white/5 flex flex-col items-end gap-1 shadow-inner">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm text-gray-300 font-medium">VPS Online</span>
              </div>
              <button onClick={() => setShowModal(true)} className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2">
                👁️ Ver Sinais Ativos Agora
              </button>
              <button onClick={() => setShowSessionsModal(true)} className="text-xs text-green-400 hover:text-green-300 underline underline-offset-2 mt-1">
                📊 Ver Histórico de Sessões
              </button>
            </div>
            
            {/* Botão Novo Robô (Fábrica IA movida) */}
            <button 
              onClick={() => router.push('/meus-robos/novo-bot')}
              className="h-full min-h-[70px] px-6 bg-gradient-to-r from-[#00ff41]/20 to-emerald-500/20 border border-[#00ff41]/50 hover:bg-[#00ff41]/30 rounded-xl flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(0,255,65,0.15)] group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">🤖</span>
              <div className="flex flex-col items-start">
                <span className="text-[#00ff41] font-black uppercase tracking-wider text-sm">Novo Robô IA</span>
                <span className="text-emerald-400/70 text-[10px] uppercase font-bold tracking-widest">Criar do Zero</span>
              </div>
            </button>
          </div>
        </div>

        {/* Painel de Controle */}
        <div className="bg-[#15171e] border border-white/10 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 px-4 py-2 bg-[#0f1016] rounded-lg border border-white/5">
            <div className="text-sm font-bold text-white flex items-center gap-3">
              <span className="text-gray-400 uppercase tracking-wider">Resumo:</span>
              <span>Robôs ativos: <span className="text-purple-400 text-base">{configs.filter(c => c.auto_refresh).length}</span></span>
              <span className="text-gray-600">|</span>
              <span>Estratégias ativas: <span className="text-blue-400 text-base">{activeCount.total}</span></span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={startAll} className="bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
              ▶️ Ligar Todos os Agentes
            </button>
            <button onClick={stopAll} className="bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2">
              ⏹️ Pausar Todos
            </button>
            <button onClick={deleteAll} className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2">
              🗑️ Excluir Todos
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : configs.length === 0 ? (
          <div className="bg-[#15171e] border border-white/5 rounded-2xl p-10 text-center text-gray-400">
            <div className="text-5xl mb-4">🤖</div>
            <p>Nenhum agente salvo ainda.</p>
            <p className="text-sm mt-2">Clique em <strong className="text-[#00ff41]">Novo Robô IA</strong> para criar e salvar seu primeiro agente.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {Object.entries(configs.reduce((acc, curr) => {
              const tid = curr.target_telegram_id || 'Sem Destino';
              if (!acc[tid]) acc[tid] = [];
              acc[tid].push(curr);
              return acc;
            }, {} as Record<string, StrategyConfig[]>)).map(([telegramId, groupConfigs]) => {
              
              const groupMinConf = groupConfigs[0].min_confluence || 1;

              return (
                <div key={telegramId} className="bg-[#1a1c24] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        📱 Grupo Telegram: <span className="text-purple-400">{telegramId}</span>
                      </h2>
                      <p className="text-sm text-gray-400 mt-1">
                        Este grupo contém {groupConfigs.length} agente(s). O Gale será compartilhado entre todos eles.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 bg-[#0f1016] px-4 py-2 rounded-lg border border-white/5">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Confluência:</label>
                        <select 
                          className="bg-[#1a1c24] border border-white/10 text-white rounded px-2 py-1 outline-none focus:border-purple-500 text-sm font-bold"
                          value={groupMinConf}
                          onChange={(e) => handleUpdateGroupConfluence(telegramId, parseInt(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="w-px h-6 bg-white/10"></div>
                      
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Max Gale:</label>
                        <input 
                          type="number"
                          min="1"
                          id={`maxGaleInput_${telegramId}`}
                          className="bg-[#1a1c24] border border-white/10 text-white rounded px-2 py-1 outline-none focus:border-purple-500 text-sm font-bold w-16 text-center"
                          defaultValue={(() => {
                             const cfg = groupConfigs.find(c => c.filters && c.filters.max_group_gale !== undefined);
                             return cfg && cfg.filters.max_group_gale !== null ? cfg.filters.max_group_gale : '';
                          })()}
                          placeholder="∞"
                        />
                        <button 
                          onClick={() => {
                            const val = (document.getElementById(`maxGaleInput_${telegramId}`) as HTMLInputElement).value;
                            handleUpdateGroupMaxGale(telegramId, val ? parseInt(val) : null);
                          }}
                          className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded font-bold text-[10px] uppercase transition-colors"
                        >
                          Salvar
                        </button>
                      </div>

                      <div className="w-px h-6 bg-white/10"></div>
                      
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tendência:</label>
                        <button 
                          onClick={() => {
                            const current = groupConfigs[0].filters?.useTrendFilter || false;
                            handleUpdateGroupTrend(telegramId, {
                               useTrendFilter: !current,
                               ind1Type: groupConfigs[0].filters?.ind1Type || 'sma',
                               ind1Period: groupConfigs[0].filters?.ind1Period || 7,
                               ind2Type: groupConfigs[0].filters?.ind2Type || 'ema',
                               ind2Period: groupConfigs[0].filters?.ind2Period || 21
                            });
                          }}
                          className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-colors ${groupConfigs[0].filters?.useTrendFilter ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-gray-800 text-gray-400 border border-white/10'}`}
                        >
                          {groupConfigs[0].filters?.useTrendFilter ? 'ON' : 'OFF'}
                        </button>
                        {groupConfigs[0].filters?.useTrendFilter && (
                           <button 
                             onClick={() => setTrendModalGroup({ id: telegramId, filters: groupConfigs[0].filters })}
                             className="bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/40 px-2 py-1.5 rounded font-bold text-[10px] transition-colors"
                           >
                             ⚙️
                           </button>
                        )}
                      </div>

                      <div className="w-px h-6 bg-white/10"></div>

                      <button 
                        onClick={() => handleResetSession(telegramId)}
                        className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 px-3 py-1.5 rounded font-bold text-[10px] uppercase tracking-wider transition-all"
                      >
                        🔄 Nova Sessão
                      </button>
                    </div>
                  </div>
                  
                  {(() => {
                    const activeSession = sessions.find(s => s.target_telegram_id === telegramId && s.is_active);
                    if (activeSession) {
                      return (
                        <>
                        <div className="flex items-center gap-6 bg-[#0a0b0e] border border-green-500/20 rounded-xl px-4 py-3 mb-6 shadow-inner relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Sessão Atual</span>
                          </div>
                          <div className="flex-1 flex gap-8 items-center text-sm">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-500 uppercase font-bold">Início</span>
                              <span className="text-gray-300 font-medium">{formatTime(activeSession.session_start)}</span>
                            </div>
                            <div className="w-px h-6 bg-white/10"></div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-500 uppercase font-bold">Placar</span>
                              <div className="flex gap-2 font-bold">
                                <span className="text-green-400">{activeSession.wins}W</span>
                                <span className="text-gray-500">-</span>
                                <span className="text-red-400">{activeSession.losses}L</span>
                              </div>
                            </div>
                            <div className="w-px h-6 bg-white/10"></div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-gray-500 uppercase font-bold">Lucro/Prejuízo (PnL)</span>
                              <span className={`font-black ${activeSession.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                R$ {Number(activeSession.pnl).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {activeSession.ciclos && activeSession.ciclos.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-6">
                            {activeSession.ciclos.map((ciclo, idx) => (
                              <div key={idx} className={`flex items-center justify-center px-3 py-1 rounded-md text-xs font-bold ${ciclo.type === 'win' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                Ciclo {ciclo.count}{ciclo.type === 'win' ? 'W' : 'L'}
                              </div>
                            ))}
                          </div>
                        )}
                        </>
                      );
                    }
                    return null;
                  })()}

                  <div className="flex flex-col gap-4">
                    {groupConfigs.map(cfg => {
                      const isExpanded = expandedId === cfg.id;
                      const winRate = cfg.filters.minWinRate ?? 90;

                      return (
                      <div key={cfg.id} className={`bg-[#15171e] border rounded-xl transition-all relative overflow-hidden ${cfg.auto_refresh ? 'border-purple-500/40 shadow-[0_4px_20px_rgba(168,85,247,0.05)]' : 'border-white/5 opacity-80'}`}>
                        
                        {/* Linha Lateral */}
                        <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors ${cfg.auto_refresh ? 'bg-purple-500' : 'bg-gray-600'}`}></div>

                        {/* Header Compacto (Sempre Visível) */}
                        <div 
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 pl-6 cursor-pointer hover:bg-white/[0.02] transition-colors gap-4 sm:gap-0"
                          onClick={() => setExpandedId(isExpanded ? null : cfg.id)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${cfg.auto_refresh ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500'}`}></div>
                            <div>
                              <h3 className="font-bold text-lg text-white">{cfg.name || 'Agente IA'}</h3>
                              <p className="text-xs text-gray-500">Assertividade: <span className="text-green-400 font-bold">{winRate}%</span></p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 sm:gap-4 ml-7 sm:ml-0">
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleConfig(cfg.id); }}
                              className={`p-2 rounded-lg text-sm transition-colors ${cfg.auto_refresh ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}
                              title={cfg.auto_refresh ? "Pausar Agente" : "Ligar Agente"}
                            >
                              {cfg.auto_refresh ? '⏸️ Pausar' : '▶️ Ligar'}
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteConfig(cfg.id); }}
                              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
                              title="Excluir Agente"
                            >
                              🗑️ Excluir
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); openFilterModal(cfg); }}
                              className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm"
                              title="Ver todos os filtros"
                            >
                              🔍 Filtros
                            </button>
                            <div className="hidden sm:block w-px h-6 bg-white/10 mx-1"></div>
                            <span className="text-gray-500 transform transition-transform duration-300 hidden sm:block" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                              ▼
                            </span>
                          </div>
                        </div>

                        {/* Área Expandida (Acordeão) */}
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1200px] opacity-100 border-t border-white/5' : 'max-h-0 opacity-0'}`}>
                          <div className="p-5 pl-6 bg-[#0f1016]/50">
                            
                            {/* Gráfico Sparkline de Performance */}
                            <div className="w-full h-36 bg-[#0a0b0e] border border-white/5 rounded-xl mb-6 relative overflow-hidden group px-2 pt-8 pb-4 shadow-inner">
                              <div className="absolute top-3 left-4 flex items-center gap-2 z-10">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#00ff00]"></span>
                                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Curva de Crescimento (Live)</span>
                              </div>
                              <Sparkline />
                              <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-[#0a0b0e] to-transparent pointer-events-none"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              
                              {/* Lado Esquerdo: Métricas e Edição */}
                              <div className="space-y-5">
                                {/* Métricas Rápidas */}
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="bg-[#0f1016] border border-white/5 p-3 rounded-lg text-center shadow-inner">
                                    <span className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Win / Loss</span>
                                    <span className="text-sm font-black text-white"><span className="text-green-400">142</span> <span className="text-gray-600">/</span> <span className="text-red-400">12</span></span>
                                  </div>
                                  <div className="bg-[#0f1016] border border-white/5 p-3 rounded-lg text-center shadow-inner">
                                    <span className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Max Gale</span>
                                    <span className="text-sm font-black text-yellow-400">G{(cfg.filters.entriesLimit ?? 3) - 1}</span>
                                  </div>
                                  <div className="bg-[#0f1016] border border-white/5 p-3 rounded-lg text-center shadow-inner">
                                    <span className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Último Sinal</span>
                                    <span className="text-sm font-black text-gray-300">Há 12 min</span>
                                  </div>
                                </div>

                                {/* Edição Inline */}
                                <div className="bg-[#0f1016] border border-white/5 rounded-lg p-4 space-y-4 shadow-inner">
                                  <h4 className="text-xs text-gray-400 font-bold uppercase tracking-wider border-b border-white/5 pb-2">Configurações Base</h4>
                                  <div className="flex flex-col gap-1">
                                      <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Nome do Agente</label>
                                      <div className="flex gap-2">
                                        <input 
                                          type="text" 
                                          value={editData[cfg.id]?.name ?? cfg.name} 
                                          onChange={(e) => setEditData({...editData, [cfg.id]: {...(editData[cfg.id] || {target_telegram_id: cfg.target_telegram_id}), name: e.target.value}})}
                                          className="flex-1 bg-[#1a1c24] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none transition-colors" 
                                        />
                                        <button onClick={() => handleUpdateConfig(cfg.id)} className="bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 px-4 py-2 rounded text-xs font-bold transition-colors">Salvar</button>
                                      </div>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                      <label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Mover de Grupo (Telegram ID)</label>
                                      <div className="flex gap-2">
                                        <input 
                                          type="text" 
                                          value={editData[cfg.id]?.target_telegram_id ?? cfg.target_telegram_id} 
                                          onChange={(e) => setEditData({...editData, [cfg.id]: {...(editData[cfg.id] || {name: cfg.name}), target_telegram_id: e.target.value}})}
                                          className="flex-1 bg-[#1a1c24] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-purple-500 outline-none transition-colors" 
                                        />
                                        <button onClick={() => handleUpdateConfig(cfg.id)} className="bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 px-4 py-2 rounded text-xs font-bold transition-colors">Mover</button>
                                      </div>
                                  </div>
                                </div>
                              </div>

                              {/* Lado Direito: Filtros */}
                              <div className="bg-[#0f1016] border border-white/5 rounded-lg p-4 shadow-inner h-fit">
                                <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                                  <h4 className="text-xs text-gray-400 font-bold uppercase tracking-wider">Regras de Filtro</h4>
                                </div>
                                <ul className="space-y-3">
                                  <li className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 text-xs uppercase font-bold">Alvo Primário</span>
                                    <span className="font-bold text-white bg-white/5 px-2 py-1 rounded">{targetLabel[cfg.filters.targetFocus || ''] || cfg.filters.targetFocus}</span>
                                  </li>
                                  <li className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 text-xs uppercase font-bold">Padrão</span>
                                    <span className="font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded">{typeLabel[cfg.filters.patternType || ''] || cfg.filters.patternType}</span>
                                  </li>
                                  <li className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 text-xs uppercase font-bold">Janela de Histórico</span>
                                    <span className="font-bold text-white bg-white/5 px-2 py-1 rounded">{cfg.filters.periodHours ?? 24} Horas</span>
                                  </li>
                                  <li className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 text-xs uppercase font-bold">Assertividade Mín.</span>
                                    <span className="font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded">&gt; {cfg.filters.minWinRate ?? 90}%</span>
                                  </li>
                                  <li className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 text-xs uppercase font-bold">Sequência Máx (SA)</span>
                                    <span className="font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded">Até {cfg.filters.maxSa ?? 2} Loss</span>
                                  </li>
                                </ul>
                              </div>
                              
                            </div>
                          </div>
                        </div>

                      </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-[#15171e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#0f1016]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                Sinais Sendo Enviados Agora
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors">
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {activeSessions.filter(sess => !sess.aborted).length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  <p>Nenhum sinal ativo neste exato momento.</p>
                  <p className="text-sm mt-1">Aguardando gatilhos dos agentes...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeSessions.filter(sess => !sess.aborted).map((sess, idx) => (
                    <div key={idx} className="bg-[#1a1c24] border border-white/5 rounded-xl p-4 relative overflow-hidden">
                      <div className={`absolute left-0 top-0 w-1 h-full ${sess.color === 'Vermelho' ? 'bg-red-500' : sess.color === 'Preto' ? 'bg-gray-800' : 'bg-white'}`}></div>
                      
                      <div className="flex justify-between items-start mb-3 pl-3">
                        <div>
                          <h3 className="font-bold text-lg text-white">
                            Alvo: {sess.color} {sess.color === 'Vermelho' ? '🔴' : sess.color === 'Preto' ? '⚫' : '⚪'}
                          </h3>
                          <p className="text-sm text-yellow-500 font-bold">Tentativa Atual: G{sess.gale}</p>
                        </div>
                        <div className="bg-purple-500/20 border border-purple-500/30 text-purple-400 px-3 py-1 rounded-full text-xs font-bold">
                          {sess.confluences} / {sess.min_conf || 1} Robôs
                        </div>
                      </div>

                      <div className="pl-3 mt-4 border-t border-white/5 pt-3">
                        <p className="text-xs text-gray-500 uppercase font-bold mb-2">Robôs Operando Agora:</p>
                        <div className="flex flex-col gap-2">
                          {sess.bot_details?.map((bot: any, i: number) => (
                            <div key={i} className="bg-[#0f1016] border border-white/5 rounded-lg p-3 flex flex-col gap-2">
                               <div className="flex justify-between items-center">
                                  <span className="text-sm font-bold text-white">{bot.name}</span>
                                  <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                     Max Gale: {bot.gales}
                                  </span>
                               </div>
                               <div className="bg-[#15171e] px-3 py-2 rounded flex items-center gap-2 border border-white/5">
                                  <span className="text-xs text-gray-400 font-bold">Padrão:</span>
                                  <span className="text-sm font-black tracking-widest text-gray-200">
                                     {bot.pattern} <span className="text-gray-500 mx-1">➜</span> {bot.target}
                                  </span>
                               </div>
                            </div>
                          )) || sess.bots?.map((bot: string, i: number) => (
                            <span key={i} className="text-[10px] bg-[#0f1016] text-gray-400 px-2 py-1 rounded border border-white/5">
                              {bot}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* Filter Detail Modal                                                          */
/* ──────────────────────────────────────────────────────────────────────────── */
function FilterModal({
  cfg,
  onClose,
  onOpenFabrica,
  typeFullLabel,
  targetFullLabel,
}: {
  cfg: StrategyConfig;
  onClose: () => void;
  onOpenFabrica: (cfg: StrategyConfig) => void;
  typeFullLabel: Record<string, string>;
  targetFullLabel: Record<string, string>;
}) {
  const f = cfg.filters;
  const rows: { label: string; value: string; color?: string }[] = [
    { label: '🔢 Alvo de Entrada',           value: targetFullLabel[f.targetFocus || ''] || f.targetFocus || '—' },
    { label: '🧩 Tipo de Padrão',             value: typeFullLabel[f.patternType || ''] || f.patternType || '—' },
    { label: '📊 Janela de Histórico',       value: `${f.periodHours ?? 24} horas`, color: 'text-blue-400' },
    { label: '✅ Assertividade Mín.',         value: `≥ ${f.minWinRate ?? 90}%`, color: 'text-green-400' },
    { label: '🔁 Mín. de Gatilhos',          value: `${f.minTriggers ?? 5} ocorrências`, color: 'text-yellow-400' },
    { label: '🟥 Máx. Seq. de Perdas (SA)',   value: `Até ${f.maxSa ?? 2} seguidas`, color: 'text-red-400' },
    { label: '🟩 Mín. SA (Filtro SA)',        value: f.minSaFilter ? `Mín. ${f.minSaFilter} de perda seguida` : 'Sem filtro mínimo', color: f.minSaFilter ? 'text-orange-400' : 'text-gray-500' },
    { label: '🎲 Max Gale (Entradas)',        value: `G${(f.entriesLimit ?? 3) - 1} (${f.entriesLimit ?? 3} tentativas)`, color: 'text-yellow-300' },
    { label: '📏 Tamanho de Padrão',         value: f.selectedSize ? `${f.selectedSize} elementos` : 'Todos os tamanhos' },
    { label: '⚗️ Modo de Mineração',          value: f.useMixedMining ? '🔬 Super Mineração Mista' : '🎯 Mineração Padrão', color: f.useMixedMining ? 'text-purple-400' : 'text-gray-300' },
  ];
  if (f.useTrendFilter) {
    rows.push({ label: '📈 Filtro Gráfico', value: `Média ${f.ind1Period}(${(f.ind1Type||'sma').toUpperCase()}) < ${f.ind2Period}(${(f.ind2Type||'ema').toUpperCase()})`, color: 'text-yellow-400' });
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#15171e] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0f1016]">
          <div>
            <h2 className="text-xl font-bold text-white">{cfg.name || 'Agente IA'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Telegram: <span className="text-purple-400 font-mono">{cfg.target_telegram_id}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl">✕</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3">
          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-4">Filtros Aplicados neste Agente</p>
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between bg-[#0f1016] border border-white/5 rounded-lg px-4 py-3">
              <span className="text-sm text-gray-400 font-medium">{row.label}</span>
              <span className={`text-sm font-bold ${row.color || 'text-white'}`}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-between items-center">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={() => { onClose(); onOpenFabrica(cfg); }}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-purple-500/20"
          >
            <span>🔮 Editar na Fábrica IA</span>
            <span className="text-purple-200">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
