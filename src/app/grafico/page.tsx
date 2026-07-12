"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries } from "lightweight-charts";
import { motion, AnimatePresence } from "framer-motion";
import { GlobalStoneIcon } from '@/components/GlobalStoneIcon';
import { LiveHistoryCard } from '@/components/LiveHistoryCard';

function calcSMA(v: number[], p: number) { return v.map((_, i) => i < p - 1 ? null : v.slice(i-p+1,i+1).reduce((a,b)=>a+b,0)/p); }
function calcEMA(v: number[], p: number) { const k=2/(p+1); let e: number|null=null; return v.map((x,i)=>{ if(i<p-1)return null; e=e===null?v.slice(0,p).reduce((a,b)=>a+b,0)/p:x*k+e*(1-k); return parseFloat(e.toFixed(2)); }); }

export function calculateComboStats(combo: any, processedData: any[], accs: number[], preV1?: (number|null)[], preV2?: (number|null)[], preV3?: (number|null)[]) {
   const p1 = combo.m1.period;
   const p2 = combo.m2.period;
   const p3 = combo.m3 ? combo.m3.period : 0;
   
   const v1 = preV1 || (combo.m1.type.toLowerCase() === 'sma' ? calcSMA(accs, p1) : calcEMA(accs, p1));
   const v2 = preV2 || (combo.m2.type.toLowerCase() === 'sma' ? calcSMA(accs, p2) : calcEMA(accs, p2));
   const v3 = combo.m3 ? (preV3 || (combo.m3.type.toLowerCase() === 'sma' ? calcSMA(accs, p3) : calcEMA(accs, p3))) : null;

   let score = 0, currentBet = 1.0;
   let wins = 0, losses = 0, maxLossStreak = 0, currentLossStreak = 0, totalTrades = 0;
   let previousPagando = false;
   let maxScore = 0, minScore = 0;
   
   const startIdx = Math.max(p1, p2, p3);
   const len = accs.length;
   const isV3 = v3 !== null;
   
   for (let i = startIdx; i < len; i++) {
      if (previousPagando) {
         totalTrades++;
         const { roll, color } = processedData[i];
         if (roll === 0 || color.toLowerCase() === "branco") {
            wins++;
            currentLossStreak = 0;
            score += currentBet * 13;
            currentBet = 1.0;
         } else {
            losses++;
            currentLossStreak++;
            if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
            score -= currentBet;
            currentBet *= 1.078;
         }
         if (score > maxScore) maxScore = score;
         if (score < minScore) minScore = score;
      }

      if (isV3) {
         previousPagando = (v1[i]! < v2[i]! && v2[i]! < v3[i]!);
      } else {
         previousPagando = (v1[i]! < v2[i]!);
      }
   }
   const winRate = wins / (wins + losses || 1);
   return { score, winRate, isPagando: previousPagando, stats: { wins, losses, maxLossStreak, totalTrades, currentLossStreak, maxScore, minScore } };
}

const CPOOL = ["#facc15","#f97316","#60a5fa","#34d399","#a78bfa","#ec4899","#22d3ee","#fb923c","#e879f9","#10b981","#ef4444","#8b5cf6"];
const LIMITS = [500,1000,1500,2000,3000,5000,10000];
const CMAP: Record<string,string> = {BRANCO:"#ffffff",VERMELHO:"#e51e3e",PRETO:"#555566"};
const TFS = [{k:"tick",l:"Tick",m:0},{k:"5m",l:"5m",m:5},{k:"10m",l:"10m",m:10},{k:"15m",l:"15m",m:15},{k:"30m",l:"30m",m:30},{k:"1h",l:"1h",m:60},{k:"2h",l:"2h",m:120},{k:"3h",l:"3h",m:180},{k:"5h",l:"5h",m:300}];

interface R { id:string; color:string; house_profit:string; timestamp:string; roll?:string|number; }
interface Ind { key:string; type:"sma"|"ema"; period:number; color:string; thickness:number; }

function buildTick(data: R[]) {
  let acc=0; const times: number[]=[];
  return data.map(r=>{ let t=Math.floor(new Date(r.timestamp).getTime()/1000); if(times.length&&t<=times[times.length-1])t=times[times.length-1]+1; times.push(t); const prev=acc; acc=parseFloat((acc+parseFloat(r.house_profit||"0")).toFixed(2)); const c=CMAP[r.color]??"#555566"; return {candle:{time:t,open:prev,high:Math.max(prev,acc),low:Math.min(prev,acc),close:acc,color:c,wickColor:c,borderColor:c},acc,time:t}; });
}

function buildAgg(data: R[], minutes: number) {
  let acc=0; const bMap=new Map<number,{open:number,high:number,low:number,close:number}>();
  const bOrder: number[]=[];
  data.forEach(r=>{ const ms=new Date(r.timestamp).getTime(); const bs=Math.floor(ms/(minutes*60000))*(minutes*60); acc=parseFloat((acc+parseFloat(r.house_profit||"0")).toFixed(2)); if(!bMap.has(bs)){bMap.set(bs,{open:acc-(parseFloat(r.house_profit||"0")),high:acc,low:acc,close:acc});bOrder.push(bs);}else{const b=bMap.get(bs)!;b.close=acc;b.high=Math.max(b.high,acc);b.low=Math.min(b.low,acc);} });
  return bOrder.map(bs=>{ const b=bMap.get(bs)!; const up=b.close>=b.open; const c=up?"#e51e3e":"rgba(200,200,220,0.8)"; return {candle:{time:bs as number,open:b.open,high:b.high,low:b.low,close:b.close,color:c,wickColor:c,borderColor:c},acc:b.close,time:bs}; });
}

export default function FinanceiroPage() {
  const cRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chart=useRef<any>(null), candle=useRef<any>(null), sMap=useRef<Map<string,any>>(new Map());
  const dataRef=useRef<R[]>([]), seenIds=useRef<Set<string>>(new Set()), cidx=useRef(0);
  const isInitial=useRef(true);

  const [limit,setLimit]=useState(500);
  const [tf,setTf]=useState("tick");
  const [inds,setInds]=useState<Ind[]>([]);
  
  // -- INTEGRAÇÃO SUPABASE (SALVAMENTO NA NUVEM) --
  const supabase = createClient();
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setIsSettingsLoaded(true);
        return;
      }
      
      const { data, error } = await supabase.from('profiles').select('chart_settings').eq('id', session.user.id).single();
      if (!error && data?.chart_settings?.inds) {
        setInds(data.chart_settings.inds);
      }
      setIsSettingsLoaded(true);
    };
    loadSettings();
  }, [supabase.auth]);

  const saveSettingsToCloud = async (newInds: Ind[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    await supabase.from('profiles').update({ chart_settings: { inds: newInds } }).eq('id', session.user.id);
  };
  // ------------------------------------------------

  const [showSide,setShowSide]=useState(false);
  const [showPeriod,setShowPeriod]=useState(false);
  const [showTf,setShowTf]=useState(false);
  const [indType,setIndType]=useState<"sma"|"ema">("ema");
  const [indPer,setIndPer]=useState("");
  const [indColor,setIndColor]=useState("#facc15");
  const [indThick,setIndThick]=useState(1.5);
  const [loading,setLoading]=useState(true);
  const [profit,setProfit]=useState(0);
  const [rounds,setRounds]=useState(0);
  const [historyData, setHistoryData] = useState<R[]>([]);

  const [testAverages, setTestAverages] = useState<2|3>(2);
  const [sortBy, setSortBy] = useState<"score"|"winRate"|"maxRed">("score");
  const [isTesting, setIsTesting] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [top10Results, setTop10Results] = useState<any[]>([]);

  const [favorites, setFavorites] = useState<any[]>([]);
  const [favoritesResults, setFavoritesResults] = useState<any[]>([]);

  const favoritesRef = useRef<any[]>([]);
  useEffect(() => { favoritesRef.current = favorites; }, [favorites]);

  useEffect(() => {
     try {
       const saved = localStorage.getItem("@roboblaze_favorites");
       if (saved) setFavorites(JSON.parse(saved));
     } catch {}
  }, []);

  const toggleFavorite = (combo: any) => {
     const str = JSON.stringify(combo);
     const exists = favorites.some(c => JSON.stringify(c) === str);
     let newFavs;
     if (exists) {
        newFavs = favorites.filter(c => JSON.stringify(c) !== str);
     } else {
        newFavs = [...favorites, combo];
     }
     setFavorites(newFavs);
     localStorage.setItem("@roboblaze_favorites", JSON.stringify(newFavs));
  };

  const runBacktest = useCallback(async () => {
    setIsTesting(true);
    setTop10Results([]);
    setTestProgress(0);
    
    // Allow UI to update before blocking
    await new Promise(r => setTimeout(r, 50));
      const MAX_PERIOD = 100;
      const TYPES = ['sma', 'ema'];
      const built = buildTick(dataRef.current);
      const accs = built.map(b => b.acc);
      // Simulate realistic player bets: Base R$ 1.00 with Gale 1.078x.
      const processedData = dataRef.current.map((r: any) => ({
         hp: parseFloat(r.house_profit || "0"),
         roll: r.roll !== undefined && r.roll !== null ? parseInt(r.roll.toString()) : -1,
         color: r.color || ""
      }));

      const cache: Record<string, (number|null)[]> = {};
      TYPES.forEach(t => {
        for (let p = 2; p <= MAX_PERIOD; p++) {
          cache[`${t}_${p}`] = t === 'sma' ? calcSMA(accs, p) : calcEMA(accs, p);
        }
      });

      let top10: any[] = [];
      const insertResult = (combo: any, score: number, stats: any) => {
         if (stats.wins === 0 || score <= 0) return;
         
         const winRate = stats.wins / (stats.wins + stats.losses || 1);
         const item = { combo, score, stats, winRate };
         
         if (top10.length < 10) {
            top10.push(item);
         } else {
            let beatsWorst = false;
            const worst = top10[top10.length - 1];
            
            if (sortBy === "score") {
               if (score > worst.score) beatsWorst = true;
               else if (score === worst.score && stats.maxLossStreak < worst.stats.maxLossStreak) beatsWorst = true;
            } else if (sortBy === "winRate") {
               if (winRate > worst.winRate) beatsWorst = true;
               else if (winRate === worst.winRate && score > worst.score) beatsWorst = true;
            } else if (sortBy === "maxRed") {
               if (stats.maxLossStreak < worst.stats.maxLossStreak) beatsWorst = true;
               else if (stats.maxLossStreak === worst.stats.maxLossStreak && score > worst.score) beatsWorst = true;
            }
            
            if (beatsWorst) {
               top10.pop();
               top10.push(item);
            }
         }
         
         top10.sort((a, b) => {
            if (sortBy === "score") {
               if (a.score !== b.score) return b.score - a.score;
               return a.stats.maxLossStreak - b.stats.maxLossStreak;
            }
            if (sortBy === "winRate") {
               if (a.winRate !== b.winRate) return b.winRate - a.winRate;
               return b.score - a.score;
            }
            if (sortBy === "maxRed") {
               if (a.stats.maxLossStreak !== b.stats.maxLossStreak) return a.stats.maxLossStreak - b.stats.maxLossStreak;
               return b.score - a.score;
            }
            return 0;
         });
      };

      let combinationsTested = 0;
      let yieldCounter = 0;
      let totalCombinations = testAverages === 2 ? 19602 : 368000;

      if (testAverages === 2) {
        for (let p1 = 2; p1 < MAX_PERIOD; p1++) {
          for (let t1 of TYPES) {
             const cV1 = cache[`${t1}_${p1}`];
             for (let t2 of TYPES) {
                for (let p2 = p1 + 1; p2 <= MAX_PERIOD; p2++) {
                   const combo = { m1: {type: t1, period: p1}, m2: {type: t2, period: p2} };
                   const res = calculateComboStats(combo, processedData, accs, cV1, cache[`${t2}_${p2}`]);
                   insertResult(combo, res.score, res.stats);
                   
                   combinationsTested++;
                   yieldCounter++;
                   if (yieldCounter > 4000) {
                      yieldCounter = 0;
                      setTestProgress(Math.min(99, Math.round((combinationsTested / totalCombinations) * 100)));
                      await new Promise(r => setTimeout(r, 0));
                   }
                }
             }
          }
        }
      } else {
        totalCombinations = 368000; 
        for (let p1 = 2; p1 <= 25; p1++) { // Limitado para performance
          for (let t1 of TYPES) {
             const cV1 = cache[`${t1}_${p1}`];
             for (let t2 of TYPES) {
                for (let p2 = p1 + 1; p2 <= 60; p2++) { // Limitado para performance
                   const cV2 = cache[`${t2}_${p2}`];
                   for (let t3 of TYPES) {
                      for (let p3 = p2 + 1; p3 <= MAX_PERIOD; p3++) {
                         const combo = { m1: {type: t1, period: p1}, m2: {type: t2, period: p2}, m3: {type: t3, period: p3} };
                         const res = calculateComboStats(combo, processedData, accs, cV1, cV2, cache[`${t3}_${p3}`]);
                         insertResult(combo, res.score, res.stats);
                         
                         combinationsTested++;
                         yieldCounter++;
                         if (yieldCounter > 6000) {
                            yieldCounter = 0;
                            setTestProgress(Math.min(99, Math.round((combinationsTested / totalCombinations) * 100)));
                            await new Promise(r => setTimeout(r, 0));
                         }
                      }
                   }
                }
             }
          }
        }
      }

      setTop10Results(top10);
      setTestProgress(100);
      setIsTesting(false);
  }, [testAverages, sortBy]);

  const applyCombo = (c: any) => {
    if (!c) return;
    inds.forEach(ind => removeInd(ind.key));
    
    setTimeout(() => {
      // Add new
      const add = (type: string, p: number, color: string) => {
        setIndType(type as 'sma'|'ema'); setIndPer(p.toString()); setIndColor(color); setIndThick(2);
        // We simulate a click by manually adding
        if(!chart.current)return; 
        const key=`${type}_${p}_${Date.now()}_${Math.random()}`;
        const s=chart.current.addSeries(LineSeries,{color,lineWidth:2,lineStyle:type==="ema"?1:0,crosshairMarkerVisible:false,priceLineVisible:false,lastValueVisible:true});
        sMap.current.set(key,s);
        const built=getBuilt(dataRef.current); const accs=built.map(b=>b.acc); const times=built.map(b=>b.time);
        const vals=type==="sma"?calcSMA(accs,p):calcEMA(accs,p);
        s.setData(times.map((t,i)=>vals[i]!==null&&!isNaN(vals[i] as number)&&!isNaN(t)?{time:t,value:vals[i]}:null).filter(Boolean) as any);
        setInds(prev=>[...prev,{key,type:type as any,period:p,color,thickness:2}]);
      };
      add(c.m1.type, c.m1.period, '#facc15'); // Yellow
      add(c.m2.type, c.m2.period, '#60a5fa'); // Blue
      if (c.m3) add(c.m3.type, c.m3.period, '#a78bfa'); // Purple
    }, 100);
  };

  const getBuilt = useCallback((data: R[]) => {
    const tfObj=TFS.find(t=>t.k===tf)!;
    return tfObj.m===0?buildTick(data):buildAgg(data,tfObj.m);
  },[tf]);

  const updateInds = useCallback((accumulated: number[], times: number[], indList: Ind[]) => {
    indList.forEach(ind=>{
      const s=sMap.current.get(ind.key); if(!s)return;
      const vals=ind.type==="sma"?calcSMA(accumulated,ind.period):calcEMA(accumulated,ind.period);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      s.setData(times.map((t,i)=>vals[i]!==null&&!isNaN(vals[i] as number)&&!isNaN(t)?{time:t,value:vals[i]}:null).filter(Boolean) as any);
    });
  },[]);

  const renderAll = useCallback((fit=false) => {
    if(!candle.current||!dataRef.current.length)return;
    const built=getBuilt(dataRef.current);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safeCandles = built.map(b=>b.candle).filter(c => !isNaN(c.time) && !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.close));
    candle.current.setData(safeCandles as any);
    if(fit)chart.current?.timeScale().fitContent();
    const accs=built.map(b=>b.acc), times=built.map(b=>b.time);
    setProfit(accs[accs.length-1]??0); setRounds(dataRef.current.length);
    setHistoryData(dataRef.current.slice(-40));
    setInds(prev=>{ updateInds(accs,times,prev); return prev; });

    if (favoritesRef.current.length > 0) {
      const pData = dataRef.current.map((r: any) => ({
         hp: parseFloat(r.house_profit || "0"),
         roll: r.roll !== undefined && r.roll !== null ? parseInt(r.roll.toString()) : -1,
         color: r.color || ""
      }));
      setFavoritesResults(favoritesRef.current.map(combo => {
         const st = calculateComboStats(combo, pData, accs);
         return { combo, ...st };
      }));
    } else {
      setFavoritesResults([]);
    }
  },[getBuilt,updateInds]);

  const loadInitial=useCallback(async(l:number)=>{
    setLoading(true);
    try{ const res=await fetch(`/api/results?limit=${l}`); const j=await res.json();
      if(j.data){const s=[...j.data].reverse();dataRef.current=s;seenIds.current=new Set(s.map((r:R)=>r.id));} }
    catch(e){console.error(e);}
    setLoading(false);
  },[]);

  const pollNew=useCallback(async()=>{
    try{ const res=await fetch(`/api/results?limit=20`); const j=await res.json();
      if(!j.data)return; const nw=(j.data as R[]).filter(r=>!seenIds.current.has(r.id)); if(!nw.length)return;
      nw.forEach(r=>seenIds.current.add(r.id)); dataRef.current=[...dataRef.current,...nw.reverse()]; }
    catch(e){console.error(e);}
  },[]);

  // Init chart
  useEffect(()=>{
    if(!cRef.current)return;
    const c=createChart(cRef.current,{layout:{background:{type:ColorType.Solid,color:"#0d0d0f"},textColor:"#6b7280",fontSize:12},grid:{vertLines:{color:"rgba(255,255,255,0.04)"},horzLines:{color:"rgba(255,255,255,0.04)"}},crosshair:{mode:CrosshairMode.Normal,vertLine:{labelBackgroundColor:"#1f2937"},horzLine:{labelBackgroundColor:"#e51e3e"}},rightPriceScale:{borderColor:"rgba(255,255,255,0.06)",scaleMargins:{top:0.06,bottom:0.06}},timeScale:{borderColor:"rgba(255,255,255,0.06)",timeVisible:true,secondsVisible:false},handleScroll:true,handleScale:true});
    chart.current=c;
    candle.current=c.addSeries(CandlestickSeries,{upColor:"#e51e3e",downColor:"rgba(200,200,220,0.8)",borderVisible:false,wickVisible:true});
    const ro=new ResizeObserver(()=>{ if(cRef.current && chart.current) chart.current.applyOptions({width:cRef.current.clientWidth,height:cRef.current.clientHeight}); });
    if(cRef.current)ro.observe(cRef.current);
    return()=>{ro.disconnect();try{c.remove();}catch(e){}chart.current=null;candle.current=null;};
  },[]);

  useEffect(()=>{ isInitial.current=true; loadInitial(limit).then(()=>{renderAll(true);isInitial.current=false;}); },[limit,loadInitial,renderAll]);
  useEffect(()=>{ renderAll(true); },[tf,renderAll]);
  useEffect(()=>{ const id=setInterval(async()=>{await pollNew();renderAll(false);},10000); return()=>clearInterval(id); },[pollNew,renderAll]);


  const addInd=()=>{
    if(!chart.current)return; const p=parseInt(indPer); if(isNaN(p)||p<2)return;
    const key=`${indType}_${p}_${Date.now()}`;
    const s=chart.current.addSeries(LineSeries,{color:indColor,lineWidth:indThick,lineStyle:indType==="ema"?1:0,crosshairMarkerVisible:false,priceLineVisible:false,lastValueVisible:true});
    sMap.current.set(key,s);
    const built=getBuilt(dataRef.current); const accs=built.map(b=>b.acc); const times=built.map(b=>b.time);
    const vals=indType==="sma"?calcSMA(accs,p):calcEMA(accs,p);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s.setData(times.map((t,i)=>vals[i]!==null?{time:t,value:vals[i]}:null).filter(Boolean) as any);
    const color=CPOOL[cidx.current%CPOOL.length]; cidx.current++;
    setInds(prev=>{
      const novo = [...prev,{key,type:indType,period:p,color:indColor||color,thickness:indThick}];
      saveSettingsToCloud(novo);
      return novo;
    });
    setIndPer("");
  };

  const removeInd=(key:string)=>{
    const s=sMap.current.get(key);
    if(s&&chart.current){try{s.applyOptions({visible:false});s.setData([]);chart.current.removeSeries(s);}catch{}}
    sMap.current.delete(key); setInds(prev=>{
      const novo = prev.filter(i=>i.key!==key);
      saveSettingsToCloud(novo);
      return novo;
    });
  };

  const zoomIn=()=>{ const r=chart.current?.timeScale().getVisibleLogicalRange(); if(!r)return; const c=(r.from+r.to)/2,sz=(r.to-r.from)*0.35; chart.current.timeScale().setVisibleLogicalRange({from:c-sz,to:c+sz}); };
  const zoomOut=()=>{ const r=chart.current?.timeScale().getVisibleLogicalRange(); if(!r)return; const c=(r.from+r.to)/2,sz=(r.to-r.from)*0.7; chart.current.timeScale().setVisibleLogicalRange({from:c-sz,to:c+sz}); };
  const resetZoom=()=>chart.current?.timeScale().fitContent();

  const FloatBtn=({onClick,children,active=false}:{onClick:()=>void,children:React.ReactNode,active?:boolean})=>(
    <button onClick={onClick} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all backdrop-blur-sm border ${active?"bg-white/20 border-white/30 text-white":"bg-black/50 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"}`}>{children}</button>
  );


  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white flex flex-col">
      <style dangerouslySetInnerHTML={{__html: `
        #tv-attr-logo, .tv-lightweight-charts-watermark, a[href*="tradingview"] {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `}} />
      {/* Top summary */}
      <div className="flex items-center gap-4 px-6 py-2 border-b border-white/5 text-xs">
        <span className="text-gray-500 uppercase tracking-widest">House P&L</span>
        <span className={`font-bold font-mono ${profit>=0?"text-green-400":"text-red-400"}`}>{profit>=0?"+":""}R${profit.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span>
        <span className="text-gray-600">{rounds} rodadas</span>
        {loading&&<span className="text-gray-600 animate-pulse">carregando...</span>}
        {/* TF selector */}
        <div className="ml-auto flex bg-[#161618] rounded-lg p-0.5 border border-white/5 gap-0.5">
          {TFS.map(t=>(
            <button key={t.k} onClick={()=>setTf(t.k)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${tf===t.k?"bg-[#e51e3e] text-white":"text-gray-500 hover:text-white"}`}>{t.l}</button>
          ))}
        </div>
      </div>

      {/* Chart wrapper */}
      <div ref={wrapRef} className="relative flex-1" style={{minHeight:580}}>
        {/* Chart */}
        <div ref={cRef} style={{width:"100%",height:"100%",position:"absolute",inset:0}} />

        {/* Indicator Sidebar */}
        {showSide&&(
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-[#0d0d0f]/95 backdrop-blur-md border-l border-white/10 z-20 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="font-bold text-sm uppercase tracking-widest text-white flex items-center gap-2">
                Ferramentas
              </h3>
              <button onClick={()=>setShowSide(false)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs hover:bg-white/20">✕</button>
            </div>
            <div className="p-5 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
              
              <div className="pt-2">
                <h4 className="text-xs font-black uppercase text-white mb-3 tracking-widest">Adicionar Média Móvel</h4>
                <div className="space-y-3">
                <label className="text-xs text-gray-400 block mb-1.5">Tipo</label>
                <select value={indType} onChange={e=>setIndType(e.target.value as "sma"|"ema")} className="w-full bg-[#161618] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="ema">EMA</option><option value="sma">SMA</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-400 block mb-1.5">Período</label><input type="number" value={indPer} onChange={e=>setIndPer(e.target.value)} placeholder="ex: 20" className="w-full bg-[#161618] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"/></div>
                <div><label className="text-xs text-gray-400 block mb-1.5">Espessura</label><input type="number" value={indThick} onChange={e=>setIndThick(parseFloat(e.target.value)||1.5)} min="0.5" max="5" step="0.5" className="w-full bg-[#161618] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"/></div>
              </div>
              <div><label className="text-xs text-gray-400 block mb-1.5">Cor</label><input type="color" value={indColor} onChange={e=>setIndColor(e.target.value)} className="w-full h-9 rounded-lg border border-white/10 bg-[#161618] cursor-pointer"/></div>
              <button onClick={addInd} className="w-full py-2.5 bg-[#e51e3e] hover:bg-red-600 rounded-lg text-sm font-semibold transition-colors">✓ Aplicar indicador</button>
              {inds.length>0&&(
                <div>
                  <p className="text-xs text-gray-400 mb-2 uppercase tracking-widest">Indicadores Aplicados</p>
                  <div className="space-y-2">
                    {inds.map(ind=>(
                      <div key={ind.key} className="flex items-center justify-between bg-[#161618] rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{backgroundColor:ind.color}}/><span className="text-xs font-medium">{ind.type.toUpperCase()} {ind.period}</span></div>
                        <button onClick={()=>removeInd(ind.key)} className="text-gray-500 hover:text-red-400 text-xs transition-colors">✕ Remover</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-white/10">
              <button onClick={()=>setShowSide(false)} className="text-xs text-gray-500 hover:text-white flex items-center gap-2 transition-colors">✕ Fechar</button>
            </div>
          </div>
        )}

        {/* Floating Buttons */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
          {/* Period */}
          <div className="relative">
            <FloatBtn onClick={()=>{setShowPeriod(v=>!v);setShowTf(false);}} active={showPeriod}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </FloatBtn>
            {showPeriod&&(
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-[#161618]/95 backdrop-blur-sm border border-white/10 rounded-xl p-2 flex flex-col gap-1 min-w-[90px]" style={{boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
                {LIMITS.map(l=>(
                  <button key={l} onClick={()=>{setLimit(l);setShowPeriod(false);setTop10Results([]);}} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${limit===l?"bg-[#e51e3e] text-white":"text-gray-400 hover:text-white hover:bg-white/5"}`}>{l>=1000?`${l/1000}k`:l} resultados</button>
                ))}
              </div>
            )}
          </div>

          <FloatBtn onClick={zoomOut}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </FloatBtn>
          <FloatBtn onClick={resetZoom}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </FloatBtn>
          <FloatBtn onClick={zoomIn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </FloatBtn>
          <FloatBtn onClick={()=>setShowSide(v=>!v)} active={showSide}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </FloatBtn>
        </div>
        </div>

        {/* History Strip */}
        <div className="bg-[#0a0a0f] border-b border-t border-white/5 p-4 shrink-0 shadow-lg z-10 flex flex-col gap-2 w-full">
           <h2 className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Histórico Ao Vivo</h2>
           <LiveHistoryCard data={dataRef.current.map(d => ({ ...d, roll: d.roll || 0, timestamp: d.timestamp || new Date().toISOString() })) as any[]} maxItems={100} />
        </div>

      {/* Bottom legend */}
      <div className="flex items-center gap-5 px-6 py-2 border-t border-white/5 text-[11px] text-gray-600 flex-wrap">
        {tf==="tick"?(<>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white inline-block"/>Branco</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#e51e3e] inline-block"/>Vermelho</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#555566] inline-block"/>Preto</span>
        </>):(<>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#e51e3e] inline-block"/>Lucro (Casa ganhou)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white/50 inline-block"/>Prejuízo (Casa perdeu)</span>
        </>)}
        <span className="ml-auto">Scroll=pan · Ctrl+Scroll=zoom</span>
      </div>
    </div>
  );
}
