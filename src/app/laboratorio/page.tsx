'use client';
import { useEffect, useState, useMemo } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { GlobalStoneIcon } from '@/components/GlobalStoneIcon';
import { LiveHistoryCard } from '@/components/LiveHistoryCard';
import { TickerData } from '@/components/Ticker';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, ArrowUpDown, Sigma, Hammer, TrendingUp, PlaySquare, Copy, Sparkles } from 'lucide-react';
import Link from 'next/link';
import PatternBuilder from '@/components/lab/PatternBuilder';
import LeiGrandesNumeros from '@/components/lab/LeiGrandesNumeros';

// Pattern generators
function genColor(len:number):string[][]{const r:string[][]=[];const t=Math.pow(2,len);for(let i=0;i<t;i++){const p:string[]=[];for(let j=len-1;j>=0;j--)p.push((i&(1<<j))!==0?'P':'V');r.push(p);}return r;}
function genNum(len:number):number[][]{const ns=Array.from({length:15},(_,i)=>i);if(len===1)return ns.map(n=>[n]);if(len===2){const r:number[][]=[];for(const a of ns)for(const b of ns)r.push([a,b]);return r;}if(len===3){const r:number[][]=[];for(const a of ns)for(const b of ns)for(const c of ns)r.push([a,b,c]);return r;}return[];}
const CP:{[k:number]:string[][]}={3:genColor(3),4:genColor(4),5:genColor(5),6:genColor(6),7:genColor(7),8:genColor(8)};
const NP:{[k:number]:number[][]}={1:genNum(1),2:genNum(2),3:genNum(3)};
type SortCol='TX'|'SA'|'SM';

function getCC(r:TickerData):'V'|'P'|'B'{const n=parseInt(r.roll as string);if(r.color.includes('Branco')||n===0)return'B';if(r.color.includes('Vermelho')||(n>=1&&n<=7))return'V';return'P';}

function ColorTable({pats,data,requireHours}:{pats:string[][];data:TickerData[];requireHours?:(hours:number)=>void}){
  const[casas,setCasas]=useState(3);const[ph,setPh]=useState(10);const[mw,setMw]=useState(0);
  const[sc,setSc]=useState<SortCol>('TX');const[sd,setSd]=useState<'desc'|'asc'>('desc');
  const[snapshot,setSnapshot]=useState<TickerData[]>([]);
  const[isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string|null>(null);
  
  const handleCopy = (pat: string[], id: string) => {
    const formula = `${pat.join(' ')} = branco g${casas - 1}`;
    navigator.clipboard.writeText(formula);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const hs=(c:SortCol)=>{if(sc===c)setSd(d=>d==='desc'?'asc':'desc');else{setSc(c);setSd('desc');}};
  const proc=useMemo(()=>snapshot.map(r=>{const n=parseInt(r.roll as string);let c='B';if(r.color.includes('Vermelho')||(n>=1&&n<=7))c='V';if(r.color.includes('Preto')||(n>=8&&n<=14))c='P';return{isBranco:r.color.includes('Branco')||r.roll==='0',colorCode:c};}),[snapshot]);
  const stats=useMemo(()=>{
    if(!snapshot.length)return[];
    const an=proc.slice(-ph*120);
    return pats.map(pat=>{
      let win=0,loss=0,sa=0,sm=0;let tr:{el:number;st:number}[]=[];const cs=Array(casas).fill(0);
      for(let i=0;i<an.length;i++){const cur=an[i];if(tr.length>0){if(cur.isBranco){win++;cs[tr[0].st]++;tr=[];sa=0;}else{for(let t=tr.length-1;t>=0;t--){tr[t].el--;tr[t].st++;if(tr[t].el===0){loss++;sa++;if(sa>sm)sm=sa;tr.splice(t,1);}}}}
      const pL=pat.length;if(i>=pL-1){let m=true;for(let p=0;p<pL;p++){if(an[i-(pL-1)+p].colorCode!==pat[p]){m=false;break;}}if(m)tr.push({el:casas,st:0});}}
      return{id:pat.join(''),pat,win,loss,sm,sa,cs};
    }).filter(s=>s.win>=mw).sort((a,b)=>{if(sc==='SA')return sd==='desc'?b.sa-a.sa:a.sa-b.sa;if(sc==='SM')return sd==='desc'?b.sm-a.sm:a.sm-b.sm;const aR=a.win/(a.win+a.loss||1),bR=b.win/(b.win+b.loss||1);return sd==='desc'?bR-aR:aR-bR;}).slice(0,50);
  },[snapshot,proc,casas,ph,pats,mw,sc,sd]);

  const handleProcess = () => {
     setIsProcessing(true);
     setTimeout(() => {
        setSnapshot(data);
        setIsProcessing(false);
     }, 100);
  };

  return(<div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-end gap-3 p-4 bg-[#0d0f1a] border border-white/5 rounded-2xl">
      {[['Casas',casas,setCasas,[1,2,3,4,5,6,7,8,9,10],(v:number)=>`${v}x`],['Período',ph,setPh,[1,2,3,6,9,12,24,48,72,168,336,720],(v:number)=>v>=168?`${v/24}d`:`${v}h`]].map(([l,v,s,o,f]:any)=>(
        <div key={l} className="flex flex-col gap-1"><label className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{l}</label>
        <select className="bg-black/40 border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none focus:border-purple-500/50 transition-colors" value={v} onChange={e=>{
          const val = Number(e.target.value);
          s(val);
          if(l==='Período') requireHours?.(val);
        }}>{o.map((x:number)=><option key={x} value={x}>{f(x)}</option>)}</select></div>
      ))}
      <div className="flex flex-col gap-1"><label className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Min W</label>
      <input type="number" min="0" value={mw} onChange={e=>setMw(Number(e.target.value))} className="bg-black/40 border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none w-20 focus:border-purple-500/50 transition-colors"/></div>
      
      <button onClick={handleProcess} disabled={isProcessing} className="ml-auto flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50">
         {isProcessing ? <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"/> : <Sigma size={14}/>}
         Analisar Mercado
      </button>
    </div>
    
    {!snapshot.length ? (
        <div className="py-20 text-center opacity-30 flex flex-col items-center gap-3">
           <FlaskConical size={48} className="text-blue-500" />
           <div className="text-[10px] font-black uppercase tracking-widest text-white">Clique em Analisar Mercado para calcular os padrões</div>
        </div>
    ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5"><table className="w-full text-left border-collapse min-w-max">
          <thead><tr className="bg-gradient-to-r from-blue-900/40 to-indigo-900/30 text-white border-b border-white/10">
            <th className="p-3 text-center w-12"></th>
            <th className="p-3 text-center text-xs font-bold uppercase">Padrão</th>
            {(['TX','WIN','LOSS','SM','SA'] as const).map(c=><th key={c} onClick={c==='WIN'||c==='LOSS'?undefined:()=>hs(c as SortCol)} className={`p-3 text-center text-xs font-bold uppercase ${c==='WIN'||c==='LOSS'?'':'cursor-pointer hover:bg-white/10'} transition-colors`}><span className="flex items-center justify-center gap-1">{c}{(c==='TX'||c==='SM'||c==='SA')&&sc===c&&<ArrowUpDown size={10}/>}</span></th>)}
            {Array.from({length:casas}).map((_,i)=><th key={i} className="p-3 text-center text-xs font-bold uppercase text-blue-400">C{i+1}</th>)}
          </tr></thead>
          <tbody>{stats.map(s=>{const wr=((s.win/(s.win+s.loss||1))*100).toFixed(1);const al=s.sm>0&&s.sa>0&&s.sm-s.sa<=2;return(
            <motion.tr layout key={s.id} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.025] transition-colors">
              <td className="p-2 text-center">
                <button onClick={() => handleCopy(s.pat, s.id)} className="bg-white/5 hover:bg-white/10 p-1.5 rounded transition-colors text-gray-400 hover:text-white" title="Copiar fórmula">
                  {copiedId === s.id ? <span className="text-[9px] font-black text-green-400">OK</span> : <Copy size={14}/>}
                </button>
              </td>
              <td className="p-2"><div className="flex gap-1 justify-center">{s.pat.map((c:string,i:number)=><div key={i} className={`w-6 h-6 rounded-md border ${c==='V'?'bg-red-600/80 border-red-500/50':'bg-zinc-800/80 border-zinc-600/50'}`}/>)}</div></td>
              <td className="p-3 text-center font-bold text-green-400">{wr}%</td>
              <td className="p-3 text-center text-blue-400">{s.win}</td>
              <td className="p-3 text-center text-blue-400">{s.loss}</td>
              <td className={`p-3 text-center font-bold ${al?'text-purple-300 bg-purple-900/30':''}`}>{s.sm}</td>
              <td className={`p-3 text-center font-bold ${al?'text-purple-300 bg-purple-900/30':''}`}>{s.sa}</td>
              {s.cs.map((v:number,i:number)=><td key={i} className="p-3 text-center text-gray-400 text-xs">{v}</td>)}
            </motion.tr>);})}</tbody>
        </table></div>
    )}
  </div>);
}


function NumberTable({pats,data,requireHours}:{pats:number[][];data:TickerData[];requireHours?:(hours:number)=>void}){
  const[casas,setCasas]=useState(3);const[ph,setPh]=useState(12);const[mw,setMw]=useState(0);
  const[sc,setSc]=useState<SortCol>('TX');const[sd,setSd]=useState<'desc'|'asc'>('desc');
  const[snapshot,setSnapshot]=useState<TickerData[]>([]);
  const[isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string|null>(null);
  
  const handleCopy = (pat: number[], id: string) => {
    const formula = `${pat.join(' ')} = branco g${casas - 1}`;
    navigator.clipboard.writeText(formula);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const hs=(c:SortCol)=>{if(sc===c)setSd(d=>d==='desc'?'asc':'desc');else{setSc(c);setSd('desc');}};
  const stats=useMemo(()=>{
    if(!snapshot.length)return[];
    const an=snapshot.slice(-ph*120);
    return pats.map(pat=>{
      let win=0,loss=0,sa=0,sm=0;let tr:{el:number;st:number}[]=[];const cs=Array(casas).fill(0);
      for(let i=0;i<an.length;i++){const cur=an[i];const iB=cur.color.includes('Branco')||cur.roll==='0';if(tr.length>0){if(iB){win++;cs[tr[0].st]++;tr=[];sa=0;}else{for(let t=tr.length-1;t>=0;t--){tr[t].el--;tr[t].st++;if(tr[t].el===0){loss++;sa++;if(sa>sm)sm=sa;tr.splice(t,1);}}}}
      const pL=pat.length;if(i>=pL-1){let m=true;for(let p=0;p<pL;p++){if(parseInt(an[i-(pL-1)+p].roll as string)!==pat[p]){m=false;break;}}if(m)tr.push({el:casas,st:0});}}
      return{id:pat.join('-'),pat,win,loss,sm,sa,cs};
    }).filter(s=>s.win>=mw).sort((a,b)=>{if(sc==='SA')return sd==='desc'?b.sa-a.sa:a.sa-b.sa;if(sc==='SM')return sd==='desc'?b.sm-a.sm:a.sm-b.sm;const aR=a.win/(a.win+a.loss||1),bR=b.win/(b.win+b.loss||1);return sd==='desc'?bR-aR:aR-bR;}).slice(0,50);
  },[snapshot,casas,ph,pats,mw,sc,sd]);

  const nc=(n:number)=>n===0?'bg-white text-black':n<=7?'bg-red-600 text-white':'bg-zinc-800 text-white';

  const handleProcess = () => {
     setIsProcessing(true);
     setTimeout(() => {
        setSnapshot(data);
        setIsProcessing(false);
     }, 100);
  };

  return(<div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-end gap-3 p-4 bg-[#0d0f1a] border border-white/5 rounded-2xl">
      {[['Casas',casas,setCasas,[1,2,3,4,5,6,7,8,9,10],(v:number)=>`${v}x`],['Período',ph,setPh,[1,2,3,6,9,12,24,48,72,168,336,720],(v:number)=>v>=168?`${v/24}d`:`${v}h`]].map(([l,v,s,o,f]:any)=>(
        <div key={l} className="flex flex-col gap-1"><label className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{l}</label>
        <select className="bg-black/40 border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none focus:border-purple-500/50 transition-colors" value={v} onChange={e=>{
          const val = Number(e.target.value);
          s(val);
          if(l==='Período') requireHours?.(val);
        }}>{o.map((x:number)=><option key={x} value={x}>{f(x)}</option>)}</select></div>
      ))}
      <div className="flex flex-col gap-1"><label className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Min W</label>
      <input type="number" min="0" value={mw} onChange={e=>setMw(Number(e.target.value))} className="bg-black/40 border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none w-20 focus:border-purple-500/50 transition-colors"/></div>
      
      <button onClick={handleProcess} disabled={isProcessing} className="ml-auto flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50">
         {isProcessing ? <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"/> : <Sigma size={14}/>}
         Analisar Mercado
      </button>
    </div>
    
    {!snapshot.length ? (
        <div className="py-20 text-center opacity-30 flex flex-col items-center gap-3">
           <FlaskConical size={48} className="text-blue-500" />
           <div className="text-[10px] font-black uppercase tracking-widest text-white">Clique em Analisar Mercado para calcular os padrões</div>
        </div>
    ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5"><table className="w-full text-left border-collapse min-w-max">
          <thead><tr className="bg-gradient-to-r from-blue-900/40 to-indigo-900/30 text-white border-b border-white/10">
            <th className="p-3 text-center w-12"></th>
            <th className="p-3 text-center text-xs font-bold uppercase">Padrão</th>
            {(['TX','WIN','LOSS','SM','SA'] as const).map(c=><th key={c} onClick={c==='WIN'||c==='LOSS'?undefined:()=>hs(c as SortCol)} className={`p-3 text-center text-xs font-bold uppercase ${c==='WIN'||c==='LOSS'?'':'cursor-pointer hover:bg-white/10'} transition-colors`}><span className="flex items-center justify-center gap-1">{c}{(c==='TX'||c==='SM'||c==='SA')&&sc===c&&<ArrowUpDown size={10}/>}</span></th>)}
            {Array.from({length:casas}).map((_,i)=><th key={i} className="p-3 text-center text-xs font-bold uppercase text-blue-400">C{i+1}</th>)}
          </tr></thead>
          <tbody>{stats.map(s=>{const wr=((s.win/(s.win+s.loss||1))*100).toFixed(1);const al=s.sm>0&&s.sa>0&&s.sm-s.sa<=2;return(
            <motion.tr layout key={s.id} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.025] transition-colors">
              <td className="p-2 text-center">
                <button onClick={() => handleCopy(s.pat, s.id)} className="bg-white/5 hover:bg-white/10 p-1.5 rounded transition-colors text-gray-400 hover:text-white" title="Copiar fórmula">
                  {copiedId === s.id ? <span className="text-[9px] font-black text-green-400">OK</span> : <Copy size={14}/>}
                </button>
              </td>
              <td className="p-2"><div className="flex gap-1 justify-center">{s.pat.map((n:number,i:number)=><div key={i} className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs ${nc(n)}`}>{n}</div>)}</div></td>
              <td className="p-3 text-center font-bold text-green-400">{wr}%</td>
              <td className="p-3 text-center text-blue-400">{s.win}</td>
              <td className="p-3 text-center text-blue-400">{s.loss}</td>
              <td className={`p-3 text-center font-bold ${al?'text-purple-300 bg-purple-900/30':''}`}>{s.sm}</td>
              <td className={`p-3 text-center font-bold ${al?'text-purple-300 bg-purple-900/30':''}`}>{s.sa}</td>
              {s.cs.map((v:number,i:number)=><td key={i} className="p-3 text-center text-gray-400 text-xs">{v}</td>)}
            </motion.tr>);})}</tbody>
        </table></div>
    )}
  </div>);
}


type Tab='cores'|'numeros'|'construtor';
const TABS:{id:Tab;label:string;icon:string}[]=[
  {id:'construtor',label:'Construtor Visual',icon:'🔨'},
  {id:'cores',label:'Padrões de Cores',icon:'🎨'},
  {id:'numeros',label:'Padrões Numéricos',icon:'🔢'}
];

export default function LaboratorioPage(){
  const[data,setData]=useState<TickerData[]>([]);
  const[loading,setLoading]=useState(true);
  const[tab,setTab]=useState<Tab>('cores');
  const[colorSize,setColorSize]=useState(3);
  const[numSize,setNumSize]=useState(1);
  const[loadedHours,setLoadedHours]=useState(72);

  const fetchPeriod = async (hours: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/results/period?hours=${hours}&compact=true`);
      if (!res.ok) return;
      const j = await res.json();
      if (j.data && j.data.length > 0) {
        setData(j.data.map((r:any) => ({
          ...r,
          color: r.color ? String(r.color).charAt(0).toUpperCase() + String(r.color).slice(1).toLowerCase() : 'Branco',
          roll: r.roll ? String(r.roll) : '0'
        })));
        setLoadedHours(hours);
      }
    } catch (e) { console.warn(e); } finally { setLoading(false); }
  };

  const requireHours = (hours: number) => {
    if (hours > loadedHours) {
      fetchPeriod(hours);
    }
  };

  const { subscribe } = useSSE();

  useEffect(() => { fetchPeriod(72); }, []);

  useEffect(() => {
    const unsub = subscribe((mappedRoll) => {
      setData(prev => {
        if (prev.some(r => r.id === mappedRoll.id)) return prev;
        const next = [...prev, mappedRoll];
        if (next.length > 100000) return next.slice(-100000);
        return next;
      });
    });
    return unsub;
  }, [subscribe]);


  return(
    <main className="min-h-screen bg-[#050507] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#0a0a0f] border-b border-white/5 h-[72px] px-6 flex items-center justify-between shadow-2xl shrink-0 z-50">
        <div className="flex items-center gap-4">
           <h1 className="text-xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center gap-2">
             <FlaskConical className="text-blue-500" size={22}/>Laboratório de Padrões
           </h1>
           <Link href="/laboratorio/avancado" className="bg-purple-950/40 border border-purple-500/30 hover:border-purple-500/60 text-xs font-bold px-3 py-1.5 rounded-lg text-purple-300 hover:text-white transition-colors flex items-center gap-2 uppercase tracking-wider shadow-sm">
               <Sparkles size={14} className="text-purple-400" /> Ciclos Avançados
           </Link>
        </div>
        <div className="flex items-center gap-2">
          {loading&&<div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"/>}
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{data.length} giros · 15s</span>
        </div>
      </div>

      {/* Histórico */}
      <div className="px-6 pt-4 shrink-0 z-10 w-full">
         <LiveHistoryCard data={data} maxItems={35} />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-0 overflow-x-auto">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>{
              setTab(t.id as Tab);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-black whitespace-nowrap transition-all border-b-2 ${tab===t.id?'bg-[#0d0f1a] border-blue-500 text-white shadow-lg':'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="h-px bg-white/5 mx-6"/>

      {/* Size selector for patterns */}
      {(tab==='cores'||tab==='numeros')&&(
        <div className="flex items-center gap-3 px-6 pt-4">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Tamanho:</span>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            {(tab==='cores'?[3,4,5,6,7,8]:[1,2]).map(s=>(
              <button key={s} onClick={()=>tab==='cores'?setColorSize(s):setNumSize(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${(tab==='cores'?colorSize:numSize)===s?'bg-white/15 text-white':'text-gray-500 hover:text-white'}`}>
                {s}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-gray-600">
            {tab==='cores'?`${CP[colorSize]?.length} combinações`:tab==='numeros'?`${NP[numSize]?.length} combinações`:''}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-6">
        <AnimatePresence mode="wait">
          {loading&&data.length===0?(
            <motion.div key="load" initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"/>
              <span className="text-gray-500 text-xs font-bold uppercase tracking-widest animate-pulse">Carregando dados...</span>
            </motion.div>
          ):tab==='construtor'?(
            <motion.div key="construtor" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
              <PatternBuilder data={data}/>
            </motion.div>
          ):tab==='cores'?(
            <motion.div key="cores" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
              <ColorTable pats={CP[colorSize]||[]} data={data} requireHours={requireHours}/>
            </motion.div>
          ):tab==='numeros'?(
            <motion.div key="numeros" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
              <NumberTable pats={NP[numSize]||[]} data={data} requireHours={requireHours}/>
            </motion.div>
          ):tab==='probabilidades'?(
            <motion.div key="prob" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
              <LeiGrandesNumeros data={data}/>
            </motion.div>
          ):null}
        </AnimatePresence>
      </div>
    </main>
  );
}
