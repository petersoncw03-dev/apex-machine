'use client';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, Plus, Minus, BarChart2, TrendingUp, AlertCircle } from 'lucide-react';
import { GlobalStoneIcon } from '@/components/GlobalStoneIcon';
import type { TickerData } from '@/components/Ticker';

type CC='V'|'P'|'B';
type Item={kind:'color';val:CC}|{kind:'number';val:number}|{kind:'wildcard';val:'DUAL'|'TRI'};
type Target='B'|'V'|'P'|'A';

const PERIOD_DAYS_OPTS = [3, 5, 7, 14, 21, 30];

function getCC(r:TickerData):CC{const n=parseInt(r.roll as string);if(r.color.includes('Branco')||n===0)return'B';if(r.color.includes('Vermelho')||(n>=1&&n<=7))return'V';return'P';}

export default function PatternBuilder({data}:{data:TickerData[]}){
  const[pattern,setPattern]=useState<Item[]>([]);
  const[entradas,setEntradas]=useState(1);
  const[gales,setGales]=useState(2);
  const[target,setTarget]=useState<Target>('B');
  const[protectWhite,setProtectWhite]=useState(false);
  const[periodDays,setPeriodDays]=useState(3);
  const[historicalData,setHistoricalData]=useState<TickerData[]>([]);
  const[loadingHistory,setLoadingHistory]=useState(false);
  const[results,setResults]=useState<{triggers:number;wins:number;losses:number;galeDist:number[];sm:number;sa:number;pa:number;pm:number;winStreak:number;lossStreak:number;recentWins:{win:boolean,count:number}[]}|null>(null);
  const[cycleMode,setCycleMode]=useState<'GALE'|'ENTRADA'>('GALE');


  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/results/period?hours=${periodDays * 24}&compact=true`);
        const j = await res.json();
        if (j.data && j.data.length > 0) {
           const mapped = j.data.map((r:any) => ({
             ...r, 
             color: r.color ? String(r.color).charAt(0).toUpperCase() + String(r.color).slice(1).toLowerCase() : 'Branco', 
             roll: r.roll ? String(r.roll) : '0'
           }));
           setHistoricalData(mapped);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [periodDays]);

  const analyze=(modeOverride?: 'GALE'|'ENTRADA')=>{
    if(!pattern.length||!historicalData.length)return;
    const slice=historicalData;
    const cc=slice.map(getCC);
    const rolls=slice.map(r=>parseInt(r.roll as string));
    const currentMode = modeOverride || cycleMode;
    
    const checkWin = (c: CC) => {
        let isW = c === target;
        if (target === 'A') isW = (c==='V'||c==='P');
        if (protectWhite && (target === 'V' || target === 'P') && c === 'B') isW = true;
        return isW;
    };

    const triggerIndices: number[] = [];
    for(let i=pattern.length-1; i<slice.length-entradas; i++){
      let match=true;
      for(let p=0;p<pattern.length;p++){
          const di=i-(pattern.length-1)+p;const it=pattern[p];
          if(it.kind==='color'&&cc[di]!==it.val){match=false;break;}
          if(it.kind==='number'&&rolls[di]!==it.val){match=false;break;}
          if(it.kind==='wildcard'&&it.val==='DUAL'&&(cc[di]!=='V'&&cc[di]!=='P')){match=false;break;}
          if(it.kind==='wildcard'&&it.val==='TRI'&&(cc[di]==='B')){match=false;break;}
      }
      if(match) triggerIndices.push(i);
    }

    let triggers=0,wins=0,losses=0,sa=0,sm=0,pa=0,pm=0,winStreak=0,maxWS=0;
    const recentWins:boolean[]=[];
    let finalGaleDist: number[] = [];
    let lastBusyIndex = -1;

    if (currentMode === 'ENTRADA') {
        finalGaleDist = Array(entradas).fill(0);
        for (const t of triggerIndices) {
            if (t <= lastBusyIndex) continue;
            let won = false;
            for (let g = 0; g < entradas; g++) {
                const ni = t + 1 + g;
                if (ni >= slice.length) break;
                lastBusyIndex = ni;
                if (checkWin(cc[ni])) {
                    wins++; finalGaleDist[g]++; won = true; sa=0; winStreak++; pa++; if(pa>pm)pm=pa; if(winStreak>maxWS)maxWS=winStreak; break;
                }
            }
            if(!won){losses++;sa++;if(sa>sm)sm=sa;pa=0;winStreak=0;}
            recentWins.push(won);
            triggers++;
        }
    } else {
        finalGaleDist = Array(gales + 1).fill(0);
        let currentGaleLevel = 0;
        for (let i = 0; i < triggerIndices.length; i++) {
            const t = triggerIndices[i];
            if (t <= lastBusyIndex) continue;
            let wonInThisTrigger = false;
            for (let g = 0; g < entradas; g++) {
                const ni = t + 1 + g;
                if (ni >= slice.length) break;
                lastBusyIndex = ni;
                if (checkWin(cc[ni])) { wonInThisTrigger = true; break; }
            }
            
            if (wonInThisTrigger) {
                wins++; finalGaleDist[currentGaleLevel]++; sa=0; winStreak++; pa++; if(pa>pm)pm=pa; if(winStreak>maxWS)maxWS=winStreak;
                recentWins.push(true);
                triggers++;
                currentGaleLevel = 0;
            } else {
                if (currentGaleLevel >= gales) {
                    losses++; sa++; if(sa>sm)sm=sa; pa=0; winStreak=0;
                    recentWins.push(false);
                    triggers++;
                    currentGaleLevel = 0;
                } else {
                    currentGaleLevel++;
                }
            }
        }
    }

    const groupedWins: {win:boolean, count:number}[] = [];
    if (recentWins.length > 0) {
       let curr = recentWins[0], count = 1;
       for (let i = 1; i < recentWins.length; i++) {
          if (recentWins[i] === curr) count++;
          else { groupedWins.push({win:curr, count}); curr = recentWins[i]; count = 1; }
       }
       groupedWins.push({win:curr, count});
    }

    setResults({triggers,wins,losses,galeDist:finalGaleDist,sm,sa,pa,pm,winStreak:maxWS,lossStreak:sm,recentWins:groupedWins.slice(-20)});
  };

  const wr=results?(results.wins/(results.wins+results.losses||1)*100):0;
  const grade=wr>=70?{l:'EXCELENTE',c:'text-green-400',bg:'bg-green-500/10 border-green-500/30'}:wr>=55?{l:'BOM',c:'text-yellow-400',bg:'bg-yellow-500/10 border-yellow-500/30'}:wr>=40?{l:'MODERADO',c:'text-orange-400',bg:'bg-orange-500/10 border-orange-500/30'}:{l:'FRACO',c:'text-red-400',bg:'bg-red-500/10 border-red-500/30'};
  const risk=results?.sm&&results.sm<=3?{l:'BAIXO',c:'text-green-400'}:results?.sm&&results.sm<=6?{l:'MÉDIO',c:'text-yellow-400'}:{l:'ALTO',c:'text-red-400'};



  return(
    <div className="flex gap-4 h-full">
      {/* LEFT: compact builder */}
      <div className="w-80 shrink-0 flex flex-col gap-3">
        {/* Pattern sequence */}
        <div className="bg-[#0d0f1a] border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">Padrão</span>
            <div className="flex gap-1">
              <button onClick={()=>setPattern(p=>p.slice(0,-1))} disabled={!pattern.length} className="text-[9px] px-2 py-0.5 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10">←</button>
              <button onClick={()=>{setPattern([]);setResults(null);}} disabled={!pattern.length} className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 disabled:opacity-30"><RotateCcw size={10}/></button>
            </div>
          </div>
          <div className="min-h-[64px] flex items-center gap-2 flex-wrap bg-black/50 rounded-xl p-3 border border-white/10 mb-3 shadow-inner">
            {!pattern.length&&<span className="text-gray-500 text-xs italic font-semibold">Monte seu padrão clicando nas opções abaixo...</span>}
            {pattern.map((it,i)=><motion.div key={i} initial={{scale:0}} animate={{scale:1}} className="shrink-0 relative group">
              <button onClick={() => setPattern(p => p.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-110">✕</button>
              {it.kind==='number' ? <GlobalStoneIcon n={it.val} size="sm" /> : it.kind==='wildcard' ? <div className="w-7 h-7 rounded-lg border flex items-center justify-center font-black text-[7px] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)] border-white/20" style={{ background: it.val === 'DUAL' ? 'linear-gradient(to right, #dc2626 50%, #27272a 50%)' : 'linear-gradient(to right, #dc2626 33.33%, #ffffff 33.33%, #ffffff 66.66%, #27272a 66.66%)' }}></div> : it.val==='B' ? <GlobalStoneIcon n={0} size="sm" /> : <div className={`w-7 h-7 rounded-lg border flex items-center justify-center font-black text-[10px] ${it.val==='V'?'bg-red-600/80 border-red-500/50 text-white':'bg-zinc-800/80 border-zinc-600/50 text-white'}`}>{it.val}</div>}
            </motion.div>)}
          </div>
          {/* Colors */}
          <div className="text-[8px] text-gray-600 uppercase tracking-widest mb-1">Cores</div>
          <div className="flex gap-1 mb-2">
            <button onClick={()=>setPattern(p=>[...p,{kind:'color',val:'V'}])} className="flex-1 py-2 rounded-lg bg-red-700/80 text-white font-black text-[9px] hover:bg-red-600 transition-all">V</button>
            <button onClick={()=>setPattern(p=>[...p,{kind:'color',val:'P'}])} className="flex-1 py-2 rounded-lg bg-zinc-700 text-white font-black text-[9px] hover:bg-zinc-600 transition-all">P</button>
            <button onClick={()=>setPattern(p=>[...p,{kind:'color',val:'B'}])} className="flex-1 py-1 rounded-lg bg-white text-black flex items-center justify-center hover:bg-gray-100 transition-all"><GlobalStoneIcon n={0} size="sm" /></button>
            <button onClick={()=>setPattern(p=>[...p,{kind:'wildcard',val:'DUAL'}])} className="flex-1 py-2 rounded-lg text-white font-black text-[7px] hover:opacity-80 transition-all drop-shadow-md" style={{ background: 'linear-gradient(to right, #dc2626 50%, #27272a 50%)' }}></button>
            <button onClick={()=>setPattern(p=>[...p,{kind:'wildcard',val:'TRI'}])} className="flex-1 py-2 rounded-lg text-white font-black text-[7px] hover:opacity-80 transition-all drop-shadow-md" style={{ background: 'linear-gradient(to right, #dc2626 33.33%, #d4d4d8 33.33%, #d4d4d8 66.66%, #27272a 66.66%)' }}></button>
          </div>
          {/* Numbers */}
          <div className="text-[8px] text-gray-600 uppercase tracking-widest mb-1">Números</div>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({length:15},(_,n)=>(
              <button key={n} onClick={()=>setPattern(p=>[...p,{kind:'number',val:n}])}
                className={`h-7 rounded-lg font-black text-[10px] transition-all hover:scale-105 ${n===0?'bg-white text-black':n<=7?'bg-red-700/80 text-white':'bg-zinc-700 text-white'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Entradas / Gales */}
        <div className="bg-[#0d0f1a] border border-white/10 rounded-xl p-3">
          <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Entradas</div>
          <div className="flex items-center justify-between mb-3">
            <button onClick={()=>setEntradas(g=>Math.max(1,g-1))} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10"><Minus size={12}/></button>
            <span className="text-xl font-black">{entradas}</span>
            <button onClick={()=>setEntradas(g=>g+1)} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10"><Plus size={12}/></button>
          </div>
          <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-2 font-bold border-t border-white/5 pt-2">Gales</div>
          <div className="flex items-center justify-between">
            <button onClick={()=>setGales(g=>Math.max(0,g-1))} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10"><Minus size={12}/></button>
            <span className="text-xl font-black">{gales}</span>
            <button onClick={()=>setGales(g=>g+1)} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10"><Plus size={12}/></button>
          </div>
        </div>

        {/* Period */}
        <div className="bg-[#0d0f1a] border border-white/10 rounded-xl p-3">
          <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Histórico</div>
          <select className="w-full bg-black/40 border border-white/10 text-white text-[10px] rounded-lg px-2 py-1.5 outline-none mb-2" value={periodDays} onChange={e=>setPeriodDays(Number(e.target.value))}>
            {PERIOD_DAYS_OPTS.map(d=><option key={d} value={d}>{d} dias (~{d*2880} giros)</option>)}
          </select>
          {loadingHistory && (
             <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center justify-between text-[8px] text-amber-400 font-bold uppercase tracking-widest animate-pulse">
                   <span>Baixando {periodDays} dias...</span>
                </div>
                <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
                   <div className="h-full bg-amber-500 w-full animate-[shimmer_1s_infinite] relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/20 w-full" style={{ transform: 'skewX(-20deg)' }}></div>
                   </div>
                </div>
             </div>
          )}
          {!loadingHistory && historicalData.length > 0 && (
             <div className="text-[8px] text-green-400 font-bold uppercase tracking-widest text-right">
                {historicalData.length.toLocaleString()} giros prontos
             </div>
          )}
        </div>

        {/* Target */}
        <div className="bg-[#0d0f1a] border border-white/10 rounded-xl p-3">
          <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Buscar</div>
          <div className="flex flex-col gap-1 mb-2">
            {([['B','⚪ Branco'],['V','🔴 Vermelho'],['P','⚫ Preto']] as const).map(([v,l])=>(
              <button key={v} onClick={()=>setTarget(v)} className={`px-2 py-1.5 rounded-lg text-[10px] font-black transition-all border ${target===v?'bg-white/10 border-white/30 text-white':'border-white/5 text-gray-500 hover:text-gray-300'}`}>{l}</button>
            ))}
          </div>
          {(target==='V'||target==='P') && (
            <button onClick={()=>setProtectWhite(!protectWhite)} className={`w-full px-2 py-1.5 rounded-lg text-[10px] font-black transition-all border flex items-center justify-center gap-2 ${protectWhite?'bg-blue-600/20 border-blue-500/50 text-blue-400':'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'}`}>
              <div className={`w-3 h-3 rounded-sm border ${protectWhite?'bg-blue-500 border-blue-400':'border-gray-500'}`}/> Proteção no Branco
            </button>
          )}
        </div>

        {/* Analyze */}
        <button onClick={() => analyze()} disabled={!pattern.length}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white font-black text-xs uppercase tracking-widest disabled:opacity-30 hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
          <Play size={14}/> Analisar
        </button>
      </div>

      {/* RIGHT: detailed results */}
      <div className="flex-1 flex flex-col gap-3">
        {!results?(
          <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-30">
            <BarChart2 size={48}/>
            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Monte um padrão e clique em Analisar</span>
          </div>
        ):(
          <AnimatePresence>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col gap-3">
              {/* Verdict */}
              <div className={`border rounded-xl p-4 ${grade.bg}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1">Veredicto do Padrão</div>
                    <div className={`text-2xl font-black ${grade.c}`}>{grade.l}</div>
                    <div className="text-xs text-gray-400 mt-1">{results.triggers} gatilhos · {results.wins}W / {results.losses}L</div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black text-white">{wr.toFixed(1)}<span className="text-lg text-gray-400">%</span></div>
                    <div className="text-[9px] text-gray-500 uppercase">assertividade</div>
                  </div>
                </div>
                {/* Win bar */}
                <div className="mt-3 h-2 bg-black/30 rounded-full overflow-hidden">
                  <motion.div initial={{width:0}} animate={{width:`${wr}%`}} className="h-full bg-gradient-to-r from-green-600 to-emerald-400 rounded-full"/>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  {l:'SM',v:results.sm,c:results.sm<=3?'text-green-400':results.sm<=6?'text-yellow-400':'text-red-400',d:'Máx. Loss Seq.'},
                  {l:'SA',v:results.sa,c:results.sa===0?'text-green-400':results.sa<=3?'text-yellow-400':'text-red-400',d:'Loss Atual'},
                  {l:'Risco',v:risk?.l,c:risk?.c,d:'Nível de Risco'},
                  {l:'PA',v:`${results.pa} / ${results.pm}`,c:results.pa>0?'text-green-400':'text-gray-500',d:'PAG. SEQUÊNCIA'},
                  {l:'Ciclos',v:results.triggers,c:'text-blue-400',d:'Total Gatilhos'},
                ].map(({l,v,c,d})=>(
                  <div key={l} className="bg-[#0d0f1a] border border-white/10 rounded-xl p-2 flex flex-col justify-center items-center text-center">
                    <div className="text-[8px] text-gray-500 uppercase tracking-widest leading-tight mb-1">{d}</div>
                    <div className={`text-sm font-black ${c}`}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Gale distribution */}
              <div className="bg-[#0d0f1a] border border-white/10 rounded-xl p-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">Distribuição por Gale — onde as vitórias acontecem</div>
                <div className="flex gap-2 items-end" style={{height:'80px'}}>
                  {results.galeDist.map((count,g)=>{
                    const pct=results.wins>0?count/results.wins*100:0;
                    const bar=Math.max(4,pct);
                    return(
                      <div key={g} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black text-white">{count}</span>
                        <div className="w-full bg-white/5 rounded-md flex items-end overflow-hidden" style={{height:'50px'}}>
                          <motion.div initial={{height:0}} animate={{height:`${bar}%`}} className="w-full bg-gradient-to-t from-purple-700 to-pink-500 rounded-md"/>
                        </div>
                        <span className="text-[9px] text-gray-500 font-bold">{cycleMode === 'ENTRADA' ? `E${g+1}` : `G${g}`}</span>
                        <span className="text-[8px] text-gray-700">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black text-red-400">{results.losses}</span>
                    <div className="w-full bg-white/5 rounded-md flex items-end overflow-hidden" style={{height:'50px'}}>
                      <motion.div initial={{height:0}} animate={{height:`${results.triggers>0?results.losses/results.triggers*100:0}%`}} className="w-full bg-gradient-to-t from-red-800 to-red-500 rounded-md"/>
                    </div>
                    <span className="text-[9px] text-red-500 font-bold">LOSS</span>
                    <span className="text-[8px] text-gray-700">{results.triggers>0?(results.losses/results.triggers*100).toFixed(0):0}%</span>
                  </div>
                </div>
              </div>

              {/* Recent history */}
              <div className="bg-[#0d0f1a] border border-white/10 rounded-xl p-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center justify-between">
                   <span>Últimos 20 Ciclos</span>
                   <div className="flex bg-black/40 border border-white/10 rounded-lg p-0.5">
                      <button onClick={()=>{setCycleMode('ENTRADA'); analyze('ENTRADA');}} className={`px-2 py-1 text-[8px] font-bold rounded-md uppercase transition-colors ${cycleMode==='ENTRADA'?'bg-white/10 text-white':'text-gray-500 hover:text-gray-300'}`}>Por Entrada</button>
                      <button onClick={()=>{setCycleMode('GALE'); analyze('GALE');}} className={`px-2 py-1 text-[8px] font-bold rounded-md uppercase transition-colors ${cycleMode==='GALE'?'bg-white/10 text-white':'text-gray-500 hover:text-gray-300'}`}>Por Gale</button>
                   </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {results.recentWins.map((grp,i)=>(
                    <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-black border ${grp.win?'bg-green-600/20 border-green-500/40 text-green-400':'bg-red-600/20 border-red-500/40 text-red-400'}`}>
                      {grp.count}
                    </div>
                  ))}
                </div>
                {results.sa>0&&(
                  <div className="mt-3 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle size={14} className="text-red-400 shrink-0"/>
                    <span className="text-[10px] text-red-300">Sequência atual de <strong>{results.sa} derrotas</strong>. Máximo histórico: {results.sm}.</span>
                  </div>
                )}
                {results.sa===0&&results.wins>0&&(
                  <div className="mt-3 flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <TrendingUp size={14} className="text-green-400 shrink-0"/>
                    <span className="text-[10px] text-green-300">Padrão na vitória — sem sequência de loss no momento.</span>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
