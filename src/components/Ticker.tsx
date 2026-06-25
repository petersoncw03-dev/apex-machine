import { motion } from 'framer-motion';
import { GlobalStoneIcon } from './GlobalStoneIcon';

export interface TickerData {
  id?: string;
  color: string;
  roll: string | number;
  timestamp: string;
}

interface TickerProps {
  data: TickerData[];
}

export default function Ticker({ data }: TickerProps) {
  return (
    <div className="w-full bg-[#0a0a0f]/80 p-3 flex gap-2 items-center overflow-x-auto rounded-lg border border-white/5 custom-scrollbar">
      <div className="text-white/50 text-xs font-bold mr-2 uppercase tracking-widest flex-none self-center mb-4">
        Últimos Resultados:
      </div>
      {data.map((item, index) => {
        let time = '--:--';
        try {
           const ts = item.timestamp ? new Date(item.timestamp).getTime() : Date.now();
           const dt = new Date(ts);
           time = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        } catch(e) {}

        return (
          <motion.div
            key={item.id || index}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.02 }}
            className="flex-none flex flex-col items-center justify-center gap-1.5 shrink-0"
          >
            <GlobalStoneIcon n={Number(item.roll)} size="ticker" />
            <div className="text-[10px] font-bold text-slate-500 leading-none">{time}</div>
          </motion.div>
        );
      })}
    </div>
  );
}
