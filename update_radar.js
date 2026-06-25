const fs = require('fs');

let code = fs.readFileSync('src/app/radar-avancado/page.tsx', 'utf8');

// 1. Add new state / memo
const statsInjection = `
  // ── NOVAS ESTATÍSTICAS (BRANCOS, DUPLOS, TRIPLOS, HORAS) ──────────────
  const [analiseBrancos, setAnaliseBrancos] = useState({ minAtras: 0, rodadasAtras: 0, maxima24h: 0 });
  const [seqDuplos, setSeqDuplos] = useState({ minAtras: 0, rodadasAtras: 0, brancosSem: 0, maxima: 0 });
  const [seqTriplos, setSeqTriplos] = useState({ minAtras: 0, rodadasAtras: 0, brancosSem: 0, maxima: 0 });
  const [coresPorHora, setCoresPorHora] = useState(Array.from({length: 24}, () => ({ r:0, b:0, w:0 })));

  useEffect(() => {
    if (!globalData || globalData.length === 0) return;
    
    const now = Date.now();
    const data24h = globalData.filter(d => (now - new Date(d.timestamp).getTime()) <= 24 * 3600 * 1000);
    const data72h = globalData.slice(0, 5000); // Approximation for 72h to avoid heavy looping if globalData is huge

    // Cores por Hora (Hoje)
    const todayStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const cph = Array.from({length: 24}, () => ({ r:0, b:0, w:0 }));
    for (const roll of data24h) {
      const d = new Date(roll.timestamp);
      // Convert to BRT
      const brt = new Date(d.getTime() - 3 * 3600 * 1000);
      if (brt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) === todayStr) {
        const h = brt.getHours();
        if (roll.color === 'red') cph[h].r++;
        else if (roll.color === 'black') cph[h].b++;
        else cph[h].w++;
      }
    }
    setCoresPorHora(cph);

    // Análise de Brancos (último e máxima 24h)
    let lastWIdx = -1;
    let maxW = 0;
    let currentDelay = 0;
    
    for (let i = 0; i < data24h.length; i++) {
      if (data24h[i].color === 'white' || data24h[i].roll === 0 || data24h[i].roll === '0') {
        if (lastWIdx === -1) lastWIdx = i;
        if (currentDelay > maxW) maxW = currentDelay;
        currentDelay = 0;
      } else {
        currentDelay++;
      }
    }
    if (currentDelay > maxW) maxW = currentDelay; // Include current ongoing delay
    
    let minAtrasW = 0;
    if (lastWIdx !== -1) {
      minAtrasW = Math.floor((now - new Date(data24h[lastWIdx].timestamp).getTime()) / 60000);
    }
    setAnaliseBrancos({ minAtras: minAtrasW, rodadasAtras: lastWIdx === -1 ? 0 : lastWIdx, maxima24h: maxW });

    // Sequências (Duplos e Triplos)
    const findSeq = (count) => {
      let lastIdx = -1;
      let maxDelay = 0;
      let currentDelay = 0;
      let brancosSem = 0;
      let tempBrancos = 0;

      for (let i = 0; i < data72h.length - count + 1; i++) {
        let isSeq = true;
        const color = data72h[i].color;
        if (color === 'white' || data72h[i].roll === 0 || data72h[i].roll === '0') {
           currentDelay++;
           tempBrancos++;
           continue;
        }
        for (let j = 1; j < count; j++) {
          if (data72h[i+j].color !== color) { isSeq = false; break; }
        }
        
        if (isSeq) {
          if (lastIdx === -1) {
             lastIdx = i;
             brancosSem = tempBrancos; // Brancos since last sequence
          }
          if (currentDelay > maxDelay) maxDelay = currentDelay;
          currentDelay = 0;
          tempBrancos = 0;
          i += count - 1; // skip the rest of the sequence
        } else {
          currentDelay++;
        }
      }
      if (currentDelay > maxDelay) maxDelay = currentDelay;
      
      let minAtras = 0;
      if (lastIdx !== -1) {
        minAtras = Math.floor((now - new Date(data72h[lastIdx].timestamp).getTime()) / 60000);
      }
      return { minAtras, rodadasAtras: lastIdx === -1 ? -1 : lastIdx, brancosSem, maxima: maxDelay };
    };

    setSeqDuplos(findSeq(2));
    setSeqTriplos(findSeq(3));

  }, [globalData]);
`;

code = code.replace('// SOMA', statsInjection + '\n  // SOMA');

// 2. Change Layout structure
const layoutMatch = code.indexOf('<div className="flex flex-col xl:flex-row gap-8 pb-32 items-stretch">');
if (layoutMatch === -1) {
  console.log("Layout not found");
  process.exit(1);
}

const newLayout = `
<div className="flex flex-col xl:flex-row gap-6 pb-32 items-stretch">
  {/* ── LEFT COLUMN: NOVAS INFORMAÇÕES ──────────────────────────────────── */}
  <div className="flex flex-col gap-6 w-full xl:w-[300px] shrink-0">
    
    {/* Análise de Brancos */}
    <div className="bg-[#0a0a0f] border border-slate-700/50 rounded-xl overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50 text-center">
        <span className="text-[11px] font-black uppercase tracking-widest text-white">Análise de Brancos</span>
      </div>
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <span className="text-red-500 font-black text-xl">W</span>
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[11px] text-slate-300 font-medium">O último Branco foi há <strong className="text-white">{analiseBrancos.minAtras} minutos</strong></span>
            <span className="text-[11px] text-white font-bold">{analiseBrancos.rodadasAtras} rodadas atrás</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
             <span className="text-red-500 font-black text-xl">W</span>
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[11px] text-slate-300 font-medium">A máxima de Brancos (24h) é de</span>
            <span className="text-[11px] text-white font-bold">{analiseBrancos.maxima24h} rodadas</span>
          </div>
        </div>
      </div>
    </div>

    {/* Sequência de Brancos (Duplos/Triplos) */}
    <div className="bg-[#0a0a0f] border border-slate-700/50 rounded-xl overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50 text-center">
        <span className="text-[11px] font-black uppercase tracking-widest text-white">Sequência de Cores</span>
      </div>
      <div className="p-4 flex flex-col gap-6">
        
        {/* Duplos */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <div className="flex flex-col gap-1 shrink-0">
              <div className="w-8 h-8 rounded bg-white text-black font-black flex items-center justify-center text-xs">X2</div>
              <div className="w-8 h-8 rounded bg-white text-black font-black flex items-center justify-center text-xs">X2</div>
            </div>
            <div className="flex flex-col justify-center gap-1">
              <span className="text-[10px] text-slate-300 leading-tight">O último Duplo foi há <strong className="text-white">{seqDuplos.minAtras} min</strong></span>
              <span className="text-[10px] text-white font-bold leading-tight">{seqDuplos.rodadasAtras} rodadas atrás</span>
              <span className="text-[10px] text-rose-400 font-bold leading-tight mt-1">{seqDuplos.brancosSem} brancos sem duplo</span>
              <span className="text-[10px] text-slate-400 leading-tight mt-1">A máxima de Duplos é <strong className="text-white">{seqDuplos.maxima} rodadas</strong></span>
            </div>
          </div>
        </div>

        {/* Triplos */}
        <div className="flex flex-col gap-3 pt-4 border-t border-slate-700/50">
          <div className="flex items-start gap-4">
            <div className="flex flex-col gap-1 shrink-0">
              <div className="w-8 h-8 rounded bg-white text-black font-black flex items-center justify-center text-xs">X3</div>
              <div className="w-8 h-8 rounded bg-white text-black font-black flex items-center justify-center text-xs">X3</div>
            </div>
            <div className="flex flex-col justify-center gap-1">
              {seqTriplos.rodadasAtras === -1 ? (
                 <span className="text-[10px] text-slate-300">Não houve triplo nas últimas 72h.</span>
              ) : (
                <>
                  <span className="text-[10px] text-slate-300 leading-tight">O último Triplo foi há <strong className="text-white">{seqTriplos.minAtras} min</strong></span>
                  <span className="text-[10px] text-white font-bold leading-tight">{seqTriplos.rodadasAtras} rodadas atrás</span>
                  <span className="text-[10px] text-rose-400 font-bold leading-tight mt-1">{seqTriplos.brancosSem} brancos sem triplo</span>
                  <span className="text-[10px] text-slate-400 leading-tight mt-1">A máxima de Triplos é <strong className="text-white">{seqTriplos.maxima} rodadas</strong></span>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>

    {/* Cores por Hora */}
    <div className="bg-[#0a0a0f] border border-slate-700/50 rounded-xl overflow-hidden shadow-xl flex-1 flex flex-col min-h-[500px]">
      <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50 text-center shrink-0">
        <span className="text-[11px] font-black uppercase tracking-widest text-white flex justify-center gap-2">
           Cores por Hora <span className="text-slate-400">{new Date().toLocaleDateString('pt-BR')}</span>
        </span>
      </div>
      <div className="flex-1 p-3 bg-slate-950/30">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 h-full content-start">
          {coresPorHora.map((c, h) => (
            <div key={h} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded p-1.5">
              <span className="text-[10px] font-black text-slate-300 w-10">{h.toString().padStart(2,'0')}:00</span>
              <div className="flex gap-1">
                <div className="w-6 h-5 rounded bg-slate-800 text-slate-300 text-[9px] font-black flex items-center justify-center">{c.b}</div>
                <div className="w-6 h-5 rounded bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">{c.r}</div>
                <div className="w-6 h-5 rounded border border-slate-600 bg-white text-slate-800 text-[9px] font-black flex items-center justify-center">{c.w}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

  </div>

  {/* ── MIDDLE COLUMN: SCANNER + SOMA ───────────────────────────────────── */}
  <div className="flex flex-col gap-6 w-full xl:w-[320px] shrink-0">
`;

// Replace `<div className="flex flex-col xl:flex-row gap-8 pb-32 items-stretch">` and the first column start.
code = code.replace(
  '<div className="flex flex-col xl:flex-row gap-8 pb-32 items-stretch">\n            <div className="flex flex-col gap-8 w-full xl:w-[360px] shrink-0">',
  newLayout
);

// Reduce heights of Scanner and Soma
code = code.replace('flex-1 overflow-hidden h-[600px] max-h-[600px]', 'flex-1 overflow-hidden h-[500px] max-h-[500px]');
code = code.replace('flex-1 overflow-hidden min-h-[500px]', 'flex-1 overflow-hidden h-[400px] max-h-[400px]');

// Find `<div className="flex-1 flex flex-col gap-8 min-w-0">` which is the right column.
code = code.replace(
  '<div className="flex-1 flex flex-col gap-8 min-w-0">',
  '{/* ── RIGHT COLUMN: PAINEL DE MINUTO + CASAS + ENTRADAS ───────────── */}\n        <div className="flex-1 flex flex-col gap-6 min-w-0">'
);

fs.writeFileSync('src/app/radar-avancado/page.tsx', code);
console.log('Done');
