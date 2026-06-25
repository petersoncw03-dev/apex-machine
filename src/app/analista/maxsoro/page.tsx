"use client";

import { useEffect, useState } from "react";
import MaxSoroMiner from "@/components/analista/MaxSoroMiner";
import { Pickaxe, ShieldAlert, BrainCircuit, Zap, Volume2, VolumeX, Bell } from "lucide-react";
import Link from "next/link";

export default function MaxSoroPage2() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodHours, setPeriodHours] = useState(168); // Padrão 7 dias para Soros

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/results/period?hours=${periodHours}`); 
      if (!res.ok) return;
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        const mappedData = json.data.map((r: any) => ({ 
          ...r, 
          color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(), 
          roll: r.roll?.toString() 
        }));
        setData(prevData => {
          const merged = [...prevData];
          mappedData.forEach((row: any) => {
            if (!merged.some(r => r.id === row.id)) {
              merged.push(row);
            }
          });
          return merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const eventSource = new EventSource('/api/events');
    
    eventSource.onmessage = (event) => {
      try {
        const newRoll = JSON.parse(event.data);
        const mappedRoll = {
          ...newRoll,
          color: newRoll.color?.toString().charAt(0).toUpperCase() + newRoll.color?.toString().slice(1).toLowerCase(),
          roll: newRoll.roll?.toString()
        };
        
        setData(prevData => {
          if (prevData.some(r => r.id === mappedRoll.id)) return prevData;
          const updated = [...prevData, mappedRoll];
          return updated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        });
      } catch (e) {
        console.error("Erro ao processar pedra em tempo real", e);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error("Conexão SSE caiu na Max Soro, tentando reconectar...", err);
    };

    return () => {
      eventSource.close();
    };
  }, [periodHours]);

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col relative">
      <div className="bg-[#0a0a0f] border-b border-white/5 p-4 flex items-center justify-between shadow-2xl z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 border-r border-white/10 pr-6">
            <Link href="/analista2" className="text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
              IA ANALISTA
            </Link>
            <Link href="/analista2/grafico" className="text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
              IA GRÁFICO
            </Link>
            <Link href="/analista2/maxsoro" className="text-xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 flex items-center gap-2 hover:scale-105 transition-transform">
              <Pickaxe className="text-amber-500" />
              IA MAXSORO
            </Link>
          </div>
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest px-3 py-1 bg-white/5 rounded-full border border-white/10">
            {loading ? "Carregando Histórico..." : `${data.length} Giros Carregados`}
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {!loading && data.length === 0 && (
          <div className="flex flex-col items-center justify-center w-full h-full text-gray-500 gap-4">
            <ShieldAlert size={48} className="text-red-500/50" />
            <p>Nenhum dado encontrado. Verifique a conexão com a API.</p>
          </div>
        )}
        
        {data.length > 0 && (
           <MaxSoroMiner data={data} periodHours={periodHours} setPeriodHours={setPeriodHours} />
        )}
      </div>
    </div>
  );
}
