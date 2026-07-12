import { useMemo, useState, useEffect } from 'react';
import { calculateRadar } from './engine/engines/radarEngine';
import { calculateIA } from './engine/engines/iaEngine';

export interface RollData {
    id?: string;
    timestamp: string;
    color: string;
    roll: number;
}

export interface MestreState {
    status: 'standby' | 'active' | 'win' | 'loss';
    step: number;
    level: number;
    stones: number[];
}

export function useMestreConfluencia(globalData: RollData[]) {
    const [mestreState, setMestreState] = useState<MestreState>({
        status: 'standby',
        step: 0,
        level: 0,
        stones: [],
    });
    const [placarDiario, setPlacarDiario] = useState({ wins: 0, losses: 0, sa: 0, sm: 0, lastResetDate: new Date().getDate() });
    
    // Processa a pontuação da pedra atual
    const { levelPoints, engineState } = useMemo(() => {
        if (!globalData || globalData.length < 50) {
            return { levelPoints: 0, engineState: null };
        }
        
        // Em vez de recalcular tudo a cada render, o useMemo memoiza baseado na array de pedras.
        // Simulando o getPoints do motor.ts:
        const radarData = calculateRadar(globalData.slice(-1500) as any);
        const iaData3h = calculateIA(globalData.slice(-1500) as any, 3);
        const iaData1h = calculateIA(globalData.slice(-1500) as any, 1);

        const currentConfluences = iaData3h.currentIaScore;
        let iaPoints = 0;
        
        if (currentConfluences >= 1) {
            const stat1h = iaData1h.stats.find((s: any) => s.conf === currentConfluences);
            const stat3h = iaData3h.stats.find((s: any) => s.conf === currentConfluences);
            const wr1 = stat1h ? stat1h.winRate : 0;
            const wr3 = stat3h ? stat3h.winRate : 0;
            const maxWinrate = Math.max(wr1, wr3);
            
            if (maxWinrate > 60) iaPoints = 4;
            else if (maxWinrate > 45) iaPoints = 3;
            else if (maxWinrate > 38) iaPoints = 2;
            else if (maxWinrate > 33) iaPoints = 1;
        }
        
        const totalPoints = radarData.radarPoints + iaPoints;
        const isSinalMaster = (currentConfluences >= 3 && iaPoints >= 1);
        const finalApproved = isSinalMaster || totalPoints >= 3;

        return {
            levelPoints: finalApproved ? totalPoints : 0,
            engineState: { radarData, iaData: iaData3h }
        };
    }, [globalData]);

    // Máquina de estados baseada na mudança da última pedra do globalData
    useEffect(() => {
        if (!globalData || globalData.length < 50) return;
        const newRoll = globalData[globalData.length - 1];
        const isBranco = newRoll.color.toUpperCase() === 'BRANCO' || newRoll.color.toUpperCase() === 'B' || newRoll.color.toUpperCase() === 'WHITE' || Number(newRoll.roll) === 0;

        // Reset Diário de Placar
        const today = new Date().getDate();
        if (placarDiario.lastResetDate !== today) {
            setPlacarDiario({ wins: 0, losses: 0, sa: 0, sm: 0, lastResetDate: today });
        }

        setMestreState(prevState => {
            let nextState = { ...prevState };

            if (prevState.status === 'active') {
                // A pedra atual conta para as rodadas ativas
                nextState.stones = [...prevState.stones, newRoll.roll];
                
                if (isBranco) {
                    nextState.status = 'win';
                    setPlacarDiario(p => ({ ...p, wins: p.wins + 1, sa: 0 }));
                    
                    // Após 7s o componente deve voltar pro standby, simularemos com setTimeout fora do state reducer
                } else {
                    if (prevState.step < 6) {
                        nextState.step = prevState.step + 1;
                        if (levelPoints > prevState.level) {
                            nextState.level = levelPoints;
                            nextState.step = 1; // Upgrade reinicia a contagem
                            nextState.stones = []; // Reinicia as pedras do ciclo
                        }
                    } else {
                        nextState.status = 'loss';
                        setPlacarDiario(p => ({ ...p, losses: p.losses + 1, sa: p.sa + 1, sm: Math.max(p.sm, p.sa + 1) }));
                    }
                }
            } else {
                // Se estava WIN ou LOSS, o timeout externo vai resetar para standby.
                // Mas se engatilha um novo sinal, já podemos sobrescrever para active.
                if (levelPoints >= 3 && prevState.status === 'standby') {
                    nextState = {
                        status: 'active',
                        step: 1,
                        level: levelPoints,
                        stones: [],
                    };
                }
            }
            return nextState;
        });
    }, [globalData]);

    // Lida com o reset automático de WIN/LOSS para STANDBY após 7s (igual no backend)
    useEffect(() => {
        if (mestreState.status === 'win' || mestreState.status === 'loss') {
            const timer = setTimeout(() => {
                setMestreState({ status: 'standby', step: 0, level: 0, stones: [] });
            }, 7000);
            return () => clearTimeout(timer);
        }
    }, [mestreState.status]);

    return {
        mestreState,
        placarDiario,
        levelPoints,
        engineState
    };
}
