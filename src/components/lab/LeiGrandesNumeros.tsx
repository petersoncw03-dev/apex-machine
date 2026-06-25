'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, Minus as MFlat, AlertTriangle, Target, ArrowRight } from 'lucide-react';
import type { TickerData } from '@/components/Ticker';

const THEO={B:1/15,V:7/15,P:7/15};

function getCC(r:TickerData):'V'|'P'|'B'{
  const n=parseInt(r.roll as string);
  if(r.color.includes('Branco')||n===0)return'B';
  if(r.color.includes('Vermelho')||(n>=1&&n<=7))return'V';
  return'P';
}

// Z-score for binomial: how many std deviations from expected
function zScore(observed:number,n:number,p:number):number{
  if(n===0)return 0;
  const expected=n*p;
  const stddev=Math.sqrt(n*p*(1-p));
  return stddev===0?0:(observed-expected)/stddev;
}

// Interpret Z-score for color deviation
function momentum(z_macro:number,z_micro:number):'acelerando'|'recuperando'|'estavel'{
  // Negative Z = below expected (more "due")
  if(z_macro<-1&&z_micro<z_macro*1.2)return'acelerando'; // debt deepening
  if(z_macro<-1&&z_micro>-0.5)return'recuperando'; // debt being paid
  return'estavel';
}

function analyzeColor(data:TickerData[],color:'B'|'V'|'P',p:number){
  const MACRO=Math.min(data.length,1000);
  const MEDIO=Math.min(data.length,250);
  const MICRO=Math.min(data.length,50);

  const count=(sl:TickerData[])=>sl.filter(r=>getCC(r)===color).length;

  const slMacro=data.slice(-MACRO);
  const slMedio=data.slice(-MEDIO);
  const slMicro=data.slice(-MICRO);

  const cMacro=count(slMacro);
  const cMedio=count(slMedio);
  const cMicro=count(slMicro);

  const zMacro=zScore(cMacro,MACRO,p);
  const zMedio=zScore(cMedio,MEDIO,p);
  const zMicro=zScore(cMicro,MICRO,p);

  // Debt = how many MORE we need to reach theoretical
  const debtMacro=Math.round(MACRO*p-cMacro);
  const debtMedio=Math.round(MEDIO*p-cMedio);

  // Last seen
  let lastSeen=0;
  for(let i=data.length-1;i>=0;i--){if(getCC(data[i])===color)break;lastSeen++;}

  const mom=momentum(zMacro,zMicro);

  // Signal strength: align all 3 windows pointing same direction
  const allDue=zMacro<-1&&zMedio<-1&&zMicro<-0.5;
  const macroMicroAlign=zMacro<-1&&zMicro<-1;
  const strongSignal=allDue&&debtMacro>3;

  return{
    zMacro,zMedio,zMicro,
    freqMacro:cMacro/MACRO*100,freqMedio:cMedio/MEDIO*100,freqMicro:cMicro/MICRO*100,
    debtMacro,debtMedio,lastSeen,mom,
    nMacro:MACRO,nMedio:MEDIO,nMicro:MICRO,
    cMacro,cMedio,cMicro,
    signalStrength:strongSignal?3:macroMicroAlign?2:zMacro<-1?1:0,
  };
}

function ZBar({z,label}:{z:number;label:string}){
  const pct=Math.min(Math.abs(z)/3*100,100);
  const isNeg=z<0;
  const col=Math.abs(z)>2?isNeg?'bg-blue-500':'bg-orange-500':Math.abs(z)>1?isNeg?'bg-blue-400/60':'bg-orange-400/60':'bg-gray-600/40';
  return(
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-gray-500 w-10 text-right font-bold">{label}</span>
      <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden relative flex items-center">
        {isNeg?(
          <div className="absolute right-1/2 h-full flex items-end justify-end" style={{width:'50%'}}>
            <motion.div initial={{width:0}} animate={{width:`${pct}%`}} className={`h-full ${col} rounded-l-full`}/>
          </div>
        ):(
          <div className="absolute left-1/2 h-full" style={{width:'50%'}}>
            <motion.div initial={{width:0}} animate={{width:`${pct}%`}} className={`h-full ${col} rounded-r-full`}/>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-px h-full bg-white/20"/>
        </div>
      </div>
      <span className={`text-[9px] font-black w-10 ${isNeg?'text-blue-400':'text-orange-400'}`}>{z>0?'+':''}{z.toFixed(2)}</span>
    </div>
  );
}

function ColorAnalysisCard({label,emoji,analysis,theo}:{label:string;emoji:string;analysis:ReturnType<typeof analyzeColor>;theo:number}){
  const{zMacro,zMedio,zMicro,freqMacro,freqMedio,freqMicro,debtMacro,lastSeen,mom,signalStrength}=analysis;
  const isDue=zMacro<-1;
  const isHot=zMacro>1;

  const momIcon=mom==='acelerando'?<TrendingDown size={12} className="text-blue-400"/>:mom==='recuperando'?<TrendingUp size={12} className="text-yellow-400"/>:<MFlat size={12} className="text-gray-500"/>;
  const momLabel=mom==='acelerando'?'Dívida Aumentando':mom==='recuperando'?'Dívida Diminuindo':'Estável';

  const signalColors=['bg-white/5','bg-blue-500/20','bg-blue-500/40','bg-blue-500/60'];
  const borderColors=['border-white/10','border-blue-500/30','border-blue-500/50','border-blue-400/70'];
  const signalTexts=['Sem sinal','Fraco','Moderado','FORTE'];
  const signalTextColors=['text-gray-600','text-blue-400','text-blue-300','text-blue-200'];

  return(
    <div className={`border rounded-2xl p-4 flex flex-col gap-3 transition-all ${isDue?borderColors[signalStrength]:'border-white/10'} ${isDue&&signalStrength>0?signalColors[signalStrength]:'bg-[#0d0f1a]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <div>
            <div className="text-xs font-black text-white">{label}</div>
            <div className="flex items-center gap-1 mt-0.5">{momIcon}<span className="text-[9px] text-gray-500">{momLabel}</span></div>
          </div>
        </div>
        <div className="text-right">
          {isDue&&signalStrength>0?(
            <div className={`text-xs font-black ${signalTextColors[signalStrength]} uppercase tracking-widest`}>
              {signalStrength===3?'🎯':signalStrength===2?'📊':'📉'} {signalTexts[signalStrength]}
            </div>
          ):isHot?(
            <div className="text-[9px] font-black text-orange-400 uppercase">⚠️ Acima esperado</div>
          ):(
            <div className="text-[9px] font-black text-gray-600 uppercase">Neutro</div>
          )}
        </div>
      </div>

      {/* 3-window Z-score bars */}
      <div className="flex flex-col gap-1">
        <div className="text-[8px] text-gray-600 uppercase tracking-widest mb-0.5 flex justify-between">
          <span>← Abaixo do esperado</span><span>Acima →</span>
        </div>
        <ZBar z={zMacro} label={`${analysis.nMacro}g`}/>
        <ZBar z={zMedio} label={`${analysis.nMedio}g`}/>
        <ZBar z={zMicro} label={`${analysis.nMicro}g`}/>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <div className="text-[8px] text-gray-600 uppercase">Freq. Macro</div>
          <div className={`text-sm font-black ${zMacro<-1?'text-blue-400':zMacro>1?'text-orange-400':'text-gray-300'}`}>{freqMacro.toFixed(1)}%</div>
          <div className="text-[8px] text-gray-700">esp: {(theo*100).toFixed(1)}%</div>
        </div>
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <div className="text-[8px] text-gray-600 uppercase">Dívida</div>
          <div className={`text-sm font-black ${debtMacro>5?'text-blue-400':debtMacro>0?'text-yellow-400':'text-orange-400'}`}>{debtMacro>0?'+':''}{debtMacro}</div>
          <div className="text-[8px] text-gray-700">giros "devendo"</div>
        </div>
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <div className="text-[8px] text-gray-600 uppercase">Ausente há</div>
          <div className={`text-sm font-black ${lastSeen>30?'text-red-400':lastSeen>15?'text-yellow-400':'text-gray-300'}`}>{lastSeen}</div>
          <div className="text-[8px] text-gray-700">giros</div>
        </div>
      </div>

      {/* Freq trend: Macro → Medio → Micro */}
      <div className="flex items-center gap-1 text-[9px]">
        <span className="text-gray-600">Freq:</span>
        <span className={freqMacro<theo*100*0.9?'text-blue-400':'text-gray-300'}>{freqMacro.toFixed(1)}%</span>
        <ArrowRight size={10} className="text-gray-700"/>
        <span className={freqMedio<theo*100*0.9?'text-blue-400':'text-gray-300'}>{freqMedio.toFixed(1)}%</span>
        <ArrowRight size={10} className="text-gray-700"/>
        <span className={freqMicro<theo*100*0.9?'text-blue-300 font-black':'text-gray-300'}>{freqMicro.toFixed(1)}%</span>
        <span className="text-gray-700 ml-1">(macro→médio→micro)</span>
      </div>
    </div>
  );
}

export default function LeiGrandesNumeros({data}:{data:TickerData[]}){
  const analysis=useMemo(()=>{
    if(data.length<50)return null;
    const B=analyzeColor(data,'B',THEO.B);
    const V=analyzeColor(data,'V',THEO.V);
    const P=analyzeColor(data,'P',THEO.P);

    // Best signal: strongest & most aligned
    const all=[
      {key:'B',label:'Branco',emoji:'⭐',a:B,theo:THEO.B},
      {key:'V',label:'Vermelho',emoji:'🔴',a:V,theo:THEO.V},
      {key:'P',label:'Preto',emoji:'⚫',a:P,theo:THEO.P},
    ].sort((a,b)=>b.a.signalStrength-a.a.signalStrength||(a.a.zMacro-b.a.zMacro));

    // Current streak
    let streak=0,streakCC='';
    for(let i=data.length-1;i>=0;i--){const c=getCC(data[i]);if(i===data.length-1){streak=1;streakCC=c;}else if(getCC(data[i])===streakCC)streak++;else break;}

    return{B,V,P,all,streak,streakCC};
  },[data]);

  if(!analysis)return<div className="flex items-center justify-center py-20 text-gray-600 text-xs">Aguardando dados...</div>;

  const best=analysis.all[0];
  const hasSignal=best.a.signalStrength>0;
  const streakLabel=analysis.streakCC==='B'?'⭐ Branco':analysis.streakCC==='V'?'🔴 Vermelho':'⚫ Preto';

  return(
    <div className="flex flex-col gap-4">
      {/* Concept explanation */}
      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl px-4 py-3">
        <div className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">📐 Método de Análise em 3 Tempos</div>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <strong className="text-white">Macro (1000g)</strong> = tendência estrutural da sessão. &nbsp;
          <strong className="text-white">Médio (250g)</strong> = transição atual. &nbsp;
          <strong className="text-white">Micro (50g)</strong> = o que está acontecendo agora. &nbsp;
          O <strong className="text-white">Z-score</strong> mede quantos desvios padrão o resultado está do esperado. Valores &lt;-1 indicam cor estatisticamente "atrasada".
        </p>
      </div>

      {/* Main recommendation */}
      <div className={`border rounded-2xl p-5 ${hasSignal?'bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border-blue-500/40':'bg-[#0d0f1a] border-white/10'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Target size={16} className={hasSignal?'text-blue-400':'text-gray-600'}/>
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Recomendação Principal</span>
          {hasSignal&&<span className="text-[8px] font-black px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30 animate-pulse">ATIVO</span>}
        </div>
        {hasSignal?(
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-black text-white">{best.emoji} {best.label}</div>
              <div className="text-xs text-blue-300 mt-1">
                Z-score macro: <strong>{best.a.zMacro.toFixed(2)}</strong> · Dívida: <strong>+{best.a.debtMacro} giros</strong>
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                {best.a.mom==='acelerando'?'⚠️ Dívida acelerando — sinal forte':'✅ Em convergência — sinal presente'}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-gray-500 uppercase mb-2">Força do sinal</div>
              <div className="flex flex-col gap-1">
                {['Macro alinhado','Médio alinhado','Micro alinhado'].map((l,i)=>(
                  <div key={l} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${best.a.signalStrength>i?'bg-blue-400':'bg-white/10'}`}/>
                    <span className={`text-[9px] ${best.a.signalStrength>i?'text-blue-300':'text-gray-600'}`}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ):(
          <div className="text-sm text-gray-400">Nenhuma cor com desvio significativo. Aguarde alinhamento dos 3 tempos.</div>
        )}
      </div>

      {/* Streak warning */}
      {analysis.streak>=5&&(
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-2.5">
          <AlertTriangle size={14} className="text-orange-400 shrink-0"/>
          <span className="text-[10px] text-orange-300"><strong>{streakLabel}</strong> saiu <strong>{analysis.streak}x seguidas</strong> — atenção ao momentum</span>
        </div>
      )}

      {/* 3 color cards */}
      <div className="grid grid-cols-3 gap-3">
        {analysis.all.map(({key,label,emoji,a,theo})=>(
          <ColorAnalysisCard key={key} label={label} emoji={emoji} analysis={a} theo={theo}/>
        ))}
      </div>

      {/* Reading guide */}
      <div className="bg-[#0d0f1a] border border-white/5 rounded-xl p-4">
        <div className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Como ler os gráficos de Z-score</div>
        <div className="grid grid-cols-2 gap-3 text-[10px] text-gray-500">
          <div>🔵 <strong className="text-blue-400">Barra à esquerda</strong> = abaixo do esperado ("devendo")</div>
          <div>🟠 <strong className="text-orange-400">Barra à direita</strong> = acima do esperado ("quente")</div>
          <div>📉 <strong className="text-blue-300">Dívida Aumentando</strong> = desvio se aprofundando nos 3 tempos</div>
          <div>📈 <strong className="text-yellow-300">Dívida Diminuindo</strong> = convergindo, possível entrada</div>
        </div>
      </div>
    </div>
  );
}
