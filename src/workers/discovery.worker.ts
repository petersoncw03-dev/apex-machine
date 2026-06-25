export interface Roll { id?: string; color: string; roll: string | number; timestamp: string; }
export interface PatternElement { t: 'c' | 'n'; v: string | number; }
export interface DiscoveredPattern { id: string; lossMode: string; entries: number; type: string; elements: PatternElement[]; winRate: string; count: number; triggers: number; sa: number; sm: number; pa: number; pm: number; activeNow: boolean; target?: string; currentStep?: number; }

const getCol = (r: Roll) => {
  if (!r) return 'B';
  const n = parseInt(r.roll as string);
  if (r.color.includes('Vermelho') || (n >= 1 && n <= 7)) return 'V';
  if (r.color.includes('Preto') || (n >= 8 && n <= 14)) return 'P';
  return 'B';
};

const isColorMatch = (rollCol: string, elVal: string) => {
    if (elVal === 'TRI') return true;
    if (elVal === 'DUAL') return rollCol === 'V' || rollCol === 'P';
    return rollCol === elVal;
};

const globalVariationsCache: Record<string, { keyFragment: string, vars: PatternElement[] }[]> = {};

const generateWildcardVariations = (baseElements: PatternElement[], useWildcards: boolean = true, maxWildcards: number = 1) => {
   if (!useWildcards) return [baseElements];
   const results: PatternElement[][] = [];
   const generate = (current: PatternElement[], index: number, currentWildcards: number) => {
       if (index === baseElements.length) {
           results.push([...current]);
           return;
       }
       const el = baseElements[index];
       if (el.t === 'n') {
           current.push(el);
           generate(current, index + 1, currentWildcards);
           current.pop();
       } else {
           current.push(el);
           generate(current, index + 1, currentWildcards);
           current.pop();
           
           if (currentWildcards < maxWildcards) {
               if (el.v === 'V' || el.v === 'P') {
                   // DUAL allowed, but if it's the first element, we restrict it to 1 max wildcards total for this branch (effectively) or just allow it.
                   // User requested: "dual até pode ser, mas somente 1, limitado a 1 no inicio"
                   // This is naturally handled by maxWildcards, but we can explicitly allow DUAL anywhere.
                   current.push({ t: 'c', v: 'DUAL' });
                   generate(current, index + 1, currentWildcards + 1);
                   current.pop();
               }
               
               // TRI is NOT allowed at the first or last position
               if (index > 0 && index < baseElements.length - 1) {
                   current.push({ t: 'c', v: 'TRI' });
                   generate(current, index + 1, currentWildcards + 1);
                   current.pop();
               }
           }
       }
   };
   generate([], 0, 0);
   return results;
};

const evaluateHit = (roll: Roll, target: string, coverWhite: boolean = true) => {
  if (!roll) return false;
  const t = target.toUpperCase();
  if (t === 'BCO' || t === 'BRANCO') return getCol(roll) === 'B';
  if (t === 'V' || t === 'VERMELHO') return getCol(roll) === 'V' || (coverWhite && getCol(roll) === 'B');
  if (t === 'P' || t === 'PRETO') return getCol(roll) === 'P' || (coverWhite && getCol(roll) === 'B');
  return false;
};
  const runFullDiscoveryCiclo = (config: any, currentData: Roll[], isAuto: boolean, oldActiveIds: Set<string> = new Set()) => {
    if (!currentData || currentData.length < 10) return;
    
    
    const execute = () => {
      const { periodHours, patternType, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, sizeRange } = config;
      const [minEntries, maxEntries] = entriesRange || [1, 5];
      const history = currentData.slice(-periodHours * 120);
      const patternState: Record<string, any> = {};
      const typesToTest = patternType === 'TODOS' ? ['ONLY_COLORS', 'ONLY_NUMBERS', 'COLORS_1_NUM', 'COLORS_2_NUM', '1_NUM_COLORS', '2_NUM_COLORS'] : [patternType];
      const discoveryTargets = targetFocus === 'Ambos' ? ['Vermelho', 'Preto'] : [targetFocus];

      for (const target of discoveryTargets) {
        for (const type of typesToTest) {
          let sizes: number[] = [];
          if (sizeRange && sizeRange.length === 2) {
             for (let s = sizeRange[0]; s <= sizeRange[1]; s++) sizes.push(s);
          } else {
             sizes = [3];
          }

          for (const totalLen of sizes) {
            for (let i = 0; i <= history.length - totalLen; i++) {
              const elements: PatternElement[] = [];
              if (type === 'ONLY_COLORS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              } else if (type === 'ONLY_NUMBERS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'n', v: history[i+p].roll});
              } else if (type === 'COLORS_1_NUM') {
                for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(history[i+p])});
                elements.push({t:'n', v: history[i+totalLen-1].roll});
              } else if (type === 'COLORS_2_NUM') {
                for(let p=0; p<totalLen-2; p++) elements.push({t:'c', v: getCol(history[i+p])});
                elements.push({t:'n', v: history[i+totalLen-2].roll});
                elements.push({t:'n', v: history[i+totalLen-1].roll});
              } else if (type === '1_NUM_COLORS') {
                elements.push({t:'n', v: history[i].roll});
                for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              } else if (type === '2_NUM_COLORS') {
                elements.push({t:'n', v: history[i].roll});
                elements.push({t:'n', v: history[i+1].roll});
                for(let p=2; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              }

              if (elements.length === 0) continue;
              if (patternType !== 'ONLY_NUMBERS' && elements.some(e => e.t === 'n' && e.v === '0')) continue;

              const exactKeyFragment = elements.map(e => e.t + e.v).join('|');
              const cacheKey = config.useWildcards + ':' + (config.maxWildcards || 1) + ':' + exactKeyFragment;
              if (!globalVariationsCache[cacheKey]) {
                  const varsList = generateWildcardVariations(elements, config.useWildcards, config.maxWildcards || 1);
                  globalVariationsCache[cacheKey] = varsList.map(v => ({
                      keyFragment: v.map(e => e.t + e.v).join('|'),
                      vars: v
                  }));
              }
              for (const item of globalVariationsCache[cacheKey]) {
                 const vars = item.vars;
                 const key = target + ':' + item.keyFragment;
                 if (!patternState[key]) {
                     patternState[key] = { elements: vars, type, target, entriesData: {} };
                     for (let e = minEntries; e <= maxEntries; e++) {
                         patternState[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, maxSa: 0, currentPa: 0, maxPa: 0 };
                     }
                 }
                 
                 for (let e = minEntries; e <= maxEntries; e++) {
                     const keyE = key + '_' + e;
                     if (i < (patternState[key].entriesData[e].nextValidIndex || 0)) continue;
                     patternState[key].entriesData[e].triggers++;
                     
                     let hit = false;
                     let incomplete = false;
                     let stepsTaken = 0;
                     for (let w = 1; w <= e; w++) {
                       stepsTaken++;
                       const nxt = history[i + totalLen - 1 + w];
                       if (!nxt) { incomplete = true; break; }
                       if (evaluateHit(nxt, target, config.coverWhite !== false)) { 
                           hit = true; 
                           patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                           break; 
                       }
                     }
                     
                     if (incomplete && !hit) {
                       // Está pendente/ativo, não conta como loss ainda
                     } else if (hit) {
                       patternState[key].entriesData[e].wins++; patternState[key].entriesData[e].currentSa = 0; patternState[key].entriesData[e].currentPa++; if (patternState[key].entriesData[e].currentPa > patternState[key].entriesData[e].maxPa) patternState[key].entriesData[e].maxPa = patternState[key].entriesData[e].currentPa;
                     } else {
                       patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                       patternState[key].entriesData[e].currentSa++; patternState[key].entriesData[e].currentPa = 0;
                       if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) {
                           patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                       }
                     }
                 }
              }
            }
          }
        }
      }
      
      const results: DiscoveredPattern[] = [];
      Object.entries(patternState).forEach(([k, v]) => {
         for (let e = minEntries; e <= maxEntries; e++) {
             const eState = v.entriesData[e];
             const wr = ((eState.wins / (eState.triggers || 1)) * 100).toFixed(1);
             if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.maxSa <= maxSa && eState.currentSa >= minSaFilter && eState.currentPa >= (config.minPaFilter || 0)) {
                results.push({
                   id: k + '|ENT_' + e, lossMode: 'CICLO', entries: e,
                   type: v.type, elements: v.elements, winRate: wr, count: eState.wins,
                   triggers: eState.triggers, sa: eState.currentSa, sm: eState.maxSa, pa: eState.currentPa, pm: eState.maxPa, activeNow: false, target: v.target
                });
             }
         }
      });
      
      let anyNewTrigger = false;
      let finalResults = results.map(pat => {
         let currentStep = 0;
         let activeNow = false;
         for (let step = 0; step < (pat.entries || maxEntries); step++) {
           const triggerIdx = currentData.length - 1 - step;
           const patternStartIdx = triggerIdx - pat.elements.length + 1;
           if (patternStartIdx < 0) continue;
           let isMatch = true;
           for (let p = 0; p < pat.elements.length; p++) {
             const r = currentData[patternStartIdx + p];
             const el = pat.elements[p];
             if (el.t === 'c') { if (!isColorMatch(getCol(r), el.v as string)) { isMatch = false; break; } } 
             else { if (r.roll.toString() !== el.v.toString()) { isMatch = false; break; } }
           }
           if (isMatch) {
             let alreadyHit = false;
             for (let check = 1; check <= step; check++) {
               if (evaluateHit(currentData[patternStartIdx + pat.elements.length - 1 + check], pat.target || targetFocus, config.coverWhite !== false)) {
                 alreadyHit = true; break;
               }
             }
             if (!alreadyHit) {
               activeNow = true;
               currentStep = step;
               if (!oldActiveIds.has(pat.id as string)) anyNewTrigger = true;
               break; 
             }
           }
         }
         return { ...pat, activeNow, currentStep };
      });
      
      finalResults.sort((a, b) => {
          if (a.activeNow && !b.activeNow) return -1;
          if (!a.activeNow && b.activeNow) return 1;
          if (config.sortBy === 'SA') {
            if (b.sa !== a.sa) return b.sa - a.sa;
            return parseFloat(b.winRate) - parseFloat(a.winRate);
          }
          return parseFloat(b.winRate) - parseFloat(a.winRate);
        });
      
      
        
        self.postMessage({ results: finalResults.slice(0, 100), anyNewTrigger: typeof anyNewTrigger !== "undefined" ? anyNewTrigger : false });

      };

    execute();
  };


const runFullDiscoveryEntrada = (config: any, currentData: Roll[], isAuto: boolean, oldActiveIds: Set<string> = new Set()) => {
    if (!currentData || currentData.length < 10) return;
    
    
    const execute = () => {
      const { periodHours, patternType, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, sizeRange } = config;
      const [minEntries, maxEntries] = entriesRange || [1, 5];
      const history = currentData.slice(-periodHours * 120);
      const patternState: Record<string, any> = {};
      const typesToTest = patternType === 'TODOS' ? ['ONLY_COLORS', 'ONLY_NUMBERS', 'COLORS_1_NUM', 'COLORS_2_NUM', '1_NUM_COLORS', '2_NUM_COLORS'] : [patternType];
      const discoveryTargets = targetFocus === 'Ambos' ? ['Vermelho', 'Preto'] : [targetFocus];

      for (const target of discoveryTargets) {
        for (const type of typesToTest) {
          let sizes: number[] = [];
          if (sizeRange && sizeRange.length === 2) {
             for (let s = sizeRange[0]; s <= sizeRange[1]; s++) sizes.push(s);
          } else {
             sizes = [3];
          }

          for (const totalLen of sizes) {
            for (let i = 0; i <= history.length - totalLen; i++) {
              const elements: PatternElement[] = [];
              if (type === 'ONLY_COLORS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              } else if (type === 'ONLY_NUMBERS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'n', v: history[i+p].roll});
              } else if (type === 'COLORS_1_NUM') {
                for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(history[i+p])});
                elements.push({t:'n', v: history[i+totalLen-1].roll});
              } else if (type === 'COLORS_2_NUM') {
                for(let p=0; p<totalLen-2; p++) elements.push({t:'c', v: getCol(history[i+p])});
                elements.push({t:'n', v: history[i+totalLen-2].roll});
                elements.push({t:'n', v: history[i+totalLen-1].roll});
              } else if (type === '1_NUM_COLORS') {
                elements.push({t:'n', v: history[i].roll});
                for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              } else if (type === '2_NUM_COLORS') {
                elements.push({t:'n', v: history[i].roll});
                elements.push({t:'n', v: history[i+1].roll});
                for(let p=2; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              }

              if (elements.length === 0) continue;
              if (patternType !== 'ONLY_NUMBERS' && elements.some(e => e.t === 'n' && e.v === '0')) continue;

              const exactKeyFragment = elements.map(e => e.t + e.v).join('|');
              const cacheKey = config.useWildcards + ':' + (config.maxWildcards || 1) + ':' + exactKeyFragment;
              if (!globalVariationsCache[cacheKey]) {
                  const varsList = generateWildcardVariations(elements, config.useWildcards, config.maxWildcards || 1);
                  globalVariationsCache[cacheKey] = varsList.map(v => ({
                      keyFragment: v.map(e => e.t + e.v).join('|'),
                      vars: v
                  }));
              }
              for (const item of globalVariationsCache[cacheKey]) {
                 const vars = item.vars;
                 const key = target + ':' + item.keyFragment;
                 if (!patternState[key]) {
                     patternState[key] = { elements: vars, type, target, entriesData: {} };
                     for (let e = minEntries; e <= maxEntries; e++) {
                         patternState[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, maxSa: 0, currentPa: 0, maxPa: 0 };
                     }
                 }
              
              for (let e = minEntries; e <= maxEntries; e++) {
                  const keyE = key + '_' + e;
                  if (i < (patternState[key].entriesData[e].nextValidIndex || 0)) continue;
                  patternState[key].entriesData[e].triggers++;
                  
                  let hit = false;
                  let aborted = false;
                  let incomplete = false;
                  let stepsTaken = 0;
                  for (let w = 1; w <= e; w++) {
                    stepsTaken++;
                    
                    const nxt = history[i + totalLen - 1 + w];
                    if (!nxt) { incomplete = true; break; }
                    if (evaluateHit(nxt, target, config.coverWhite !== false)) { 
                        hit = true; 
                        break; 
                    }

                    let isRetrigger = true;
                    for (let j = 0; j < totalLen; j++) {
                        const el = vars[j];
                        const roll = history[i + w + j];
                        if (!roll) { isRetrigger = false; break; }
                        const rollCol = getCol(roll);
                        const rollNum = roll.roll.toString();
                        if (el.t === 'c' && !isColorMatch(rollCol, el.v as string)) { isRetrigger = false; break; }
                        if (el.t === 'n' && rollNum !== el.v) { isRetrigger = false; break; }
                    }

                    if (isRetrigger) {
                        aborted = true;
                        break;
                    }
                  }
                  
                  if (incomplete && !hit && !aborted) {
                    // Ativo agora, pendente
                  } else if (aborted) {
                    patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                    patternState[key].entriesData[e].currentSa += stepsTaken; patternState[key].entriesData[e].currentPa = 0;
                    if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) {
                        patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                    }
                  } else if (hit) {
                    patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                    patternState[key].entriesData[e].wins++;
                    patternState[key].entriesData[e].currentSa += (stepsTaken - 1); 
                    if (stepsTaken > 1) patternState[key].entriesData[e].currentPa = 0;
                    patternState[key].entriesData[e].currentPa++; 
                    if (patternState[key].entriesData[e].currentPa > patternState[key].entriesData[e].maxPa) patternState[key].entriesData[e].maxPa = patternState[key].entriesData[e].currentPa;
                    if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) {
                        patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                    }
                    patternState[key].entriesData[e].currentSa = 0;
                  } else {
                    patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                    patternState[key].entriesData[e].currentSa += stepsTaken; patternState[key].entriesData[e].currentPa = 0;
                    if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) {
                        patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                    }
                  }
              }
              }
            }
          }
        }
      }
      
      const results: DiscoveredPattern[] = [];
      Object.entries(patternState).forEach(([k, v]) => {
         for (let e = minEntries; e <= maxEntries; e++) {
             const eState = v.entriesData[e];
             const wr = ((eState.wins / (eState.triggers || 1)) * 100).toFixed(1);
             if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.maxSa <= maxSa && eState.currentSa >= minSaFilter && eState.currentPa >= (config.minPaFilter || 0)) {
                results.push({
                   id: k + '|ENT_' + e, lossMode: 'ENTRADA', entries: e,
                   type: v.type, elements: v.elements, winRate: wr, count: eState.wins,
                   triggers: eState.triggers, sa: eState.currentSa, sm: eState.maxSa, pa: eState.currentPa, pm: eState.maxPa, activeNow: false, target: v.target
                });
             }
         }
      });
      
      let anyNewTrigger = false;
      let finalResults = results.map(pat => {
         let currentStep = 0;
         let activeNow = false;
         for (let step = 0; step < (pat.entries || maxEntries); step++) {
           const triggerIdx = currentData.length - 1 - step;
           const patternStartIdx = triggerIdx - pat.elements.length + 1;
           if (patternStartIdx < 0) continue;
           let isMatch = true;
           for (let p = 0; p < pat.elements.length; p++) {
             const r = currentData[patternStartIdx + p];
             const el = pat.elements[p];
             if (el.t === 'c') { if (!isColorMatch(getCol(r), el.v as string)) { isMatch = false; break; } } 
             else { if (r.roll.toString() !== el.v.toString()) { isMatch = false; break; } }
           }
           if (isMatch) {
             let alreadyHit = false;
             for (let check = 1; check <= step; check++) {
               if (evaluateHit(currentData[patternStartIdx + pat.elements.length - 1 + check], pat.target || targetFocus, config.coverWhite !== false)) {
                 alreadyHit = true; break;
               }
             }
             if (!alreadyHit) {
               activeNow = true;
               currentStep = step;
               if (!oldActiveIds.has(pat.id as string)) anyNewTrigger = true;
               break; 
             }
           }
         }
         return { ...pat, activeNow, currentStep };
      });
      
      finalResults.sort((a, b) => {
          if (a.activeNow && !b.activeNow) return -1;
          if (!a.activeNow && b.activeNow) return 1;
          if (config.sortBy === 'SA') {
            if (b.sa !== a.sa) return b.sa - a.sa;
            return parseFloat(b.winRate) - parseFloat(a.winRate);
          }
          return parseFloat(b.winRate) - parseFloat(a.winRate);
        });
      
      
        
        self.postMessage({ results: finalResults.slice(0, 100), anyNewTrigger: typeof anyNewTrigger !== "undefined" ? anyNewTrigger : false });

      };

    execute();
  };

const runMixedDiscoveryEntrada = (config: any, currentData: Roll[], isAuto: boolean, oldActiveIds: Set<string> = new Set()) => {
    if (!currentData || currentData.length < 10) return;
    
    
    const { periodHours, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, patternType } = config;
    const [minEntries, maxEntries] = entriesRange || [1, 5];
    const history = currentData.slice(-periodHours * 120);
    const patternState: Record<string, any> = {};
    const discoveryTargets = targetFocus === 'Ambos' ? ['Vermelho', 'Preto'] : [targetFocus];
    const { sizeRange } = config;
    let sizes: number[] = [];
    if (sizeRange && sizeRange.length === 2) {
        for (let s = sizeRange[0]; s <= sizeRange[1]; s++) sizes.push(s);
    } else {
        sizes = [1, 2, 3, 4, 5, 6, 7];
    }
    
    

    let currentIndex = 0;
    const chunkSize = 1500;

    const processChunk = () => {
      const end = Math.min(currentIndex + chunkSize, history.length);
      
      for (let i = currentIndex; i < end; i++) {
        for (const target of discoveryTargets) {
          for (const totalLen of sizes) {
            if (i < 0 || i > history.length - totalLen) continue;
            
            if (totalLen <= 5) {
              const numVariations = 1 << totalLen;
              for (let mask = 0; mask < numVariations; mask++) {
                const elements: PatternElement[] = [];
                let hasZeroAsNum = false;
                for (let p = 0; p < totalLen; p++) {
                  const rollObj = history[i + p];
                  if ((mask & (1 << p)) === 0) {
                    elements.push({ t: 'c', v: getCol(rollObj) });
                  } else {
                    if (rollObj.roll === '0') hasZeroAsNum = true;
                    elements.push({ t: 'n', v: rollObj.roll });
                  }
                }
                
                if (hasZeroAsNum && patternType !== 'ONLY_NUMBERS') continue;
                
                const exactKeyFragment = elements.map(e => e.t + e.v).join('|');
                const cacheKey = config.useWildcards + ':' + (config.maxWildcards || 1) + ':' + exactKeyFragment;
                if (!globalVariationsCache[cacheKey]) {
                    const varsList = generateWildcardVariations(elements, config.useWildcards, config.maxWildcards || 1);
                    globalVariationsCache[cacheKey] = varsList.map(v => ({
                        keyFragment: v.map(e => e.t + e.v).join('|'),
                        vars: v
                    }));
                }
                for (const item of globalVariationsCache[cacheKey]) {
                   const vars = item.vars;
                   const key = target + ':MIXED:' + item.keyFragment;
                   if (!patternState[key]) {
                     patternState[key] = { type: 'MIXED', target, elements: vars, entriesData: {} };
                     for (let e = minEntries; e <= maxEntries; e++) {
                         patternState[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, maxSa: 0, currentPa: 0, maxPa: 0 };
                     }
                   }
                
                for (let e = minEntries; e <= maxEntries; e++) {
                    const keyE = key + '_' + e;
                    if (i < (patternState[key].entriesData[e].nextValidIndex || 0)) continue;
                    patternState[key].entriesData[e].triggers++;
                    let hit = false;
                    let aborted = false;
                    let incomplete = false;
                    let stepsTaken = 0;
                    for (let w = 1; w <= e; w++) {
                      stepsTaken++;
                      
                      const nxt = history[i + totalLen - 1 + w];
                      if (!nxt) { incomplete = true; break; }
                      
                      if (evaluateHit(nxt, target, config.coverWhite !== false)) {
                          hit = true;
                          break;
                      }

                      let isRetrigger = true;
                      for (let j = 0; j < totalLen; j++) {
                          const el = vars[j];
                          const roll = history[i + w + j];
                          if (!roll) { isRetrigger = false; break; }
                          const rollCol = getCol(roll);
                          const rollNum = roll.roll.toString();
                          if (el.t === 'c' && !isColorMatch(rollCol, el.v as string)) { isRetrigger = false; break; }
                          if (el.t === 'n' && rollNum !== el.v) { isRetrigger = false; break; }
                      }

                      if (isRetrigger) {
                          aborted = true;
                          break;
                      }
                    }
                    if (config.lossMode === 'ENTRADA') {
                        if (incomplete && !hit && !aborted) {
                            // Do nothing, it's pending
                        } else if (aborted) {
                            patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                            patternState[key].entriesData[e].currentSa += stepsTaken; patternState[key].entriesData[e].currentPa = 0;
                            if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                        } else if (hit) {
                            patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                            patternState[key].entriesData[e].wins++;
                            patternState[key].entriesData[e].currentSa += (stepsTaken - 1); 
                            if (stepsTaken > 1) patternState[key].entriesData[e].currentPa = 0;
                            patternState[key].entriesData[e].currentPa++; 
                            if (patternState[key].entriesData[e].currentPa > patternState[key].entriesData[e].maxPa) patternState[key].entriesData[e].maxPa = patternState[key].entriesData[e].currentPa;
                            if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                            patternState[key].entriesData[e].currentSa = 0;
                        } else {
                            patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                            patternState[key].entriesData[e].currentSa += stepsTaken; patternState[key].entriesData[e].currentPa = 0;
                            if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                        }
                    } else {
                        if (incomplete && !hit && !aborted) {
                            // Do nothing, pending
                        } else if (aborted) {
                            patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                            patternState[key].entriesData[e].currentSa++; patternState[key].entriesData[e].currentPa = 0;
                            if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                        } else if (hit) {
                            patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                            patternState[key].entriesData[e].wins++; patternState[key].entriesData[e].currentSa = 0; patternState[key].entriesData[e].currentPa++; if (patternState[key].entriesData[e].currentPa > patternState[key].entriesData[e].maxPa) patternState[key].entriesData[e].maxPa = patternState[key].entriesData[e].currentPa;
                        } else {
                            patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                            patternState[key].entriesData[e].currentSa++; patternState[key].entriesData[e].currentPa = 0;
                            if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                        }
                    }
                }
                }
              }
            } else {
              const typesToTest = patternType === 'TODOS' ? ['ONLY_COLORS', 'COLORS_1_NUM', '1_NUM_COLORS'] : [patternType];
              for (const type of typesToTest) {
                const elements: PatternElement[] = [];
                if (type === 'ONLY_COLORS') {
                  for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
                } else if (type === 'ONLY_NUMBERS') {
                  for(let p=0; p<totalLen; p++) elements.push({t:'n', v: history[i+p].roll});
                } else if (type === 'COLORS_1_NUM') {
                  for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(history[i+p])});
                  elements.push({t:'n', v: history[i+totalLen-1].roll});
                } else if (type === 'COLORS_2_NUM') {
                  if (totalLen < 4) continue;
                  for(let p=0; p<totalLen-2; p++) elements.push({t:'c', v: getCol(history[i+p])});
                  elements.push({t:'n', v: history[i+totalLen-2].roll});
                  elements.push({t:'n', v: history[i+totalLen-1].roll});
                } else if (type === '1_NUM_COLORS') {
                  elements.push({t:'n', v: history[i].roll});
                  for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
                } else if (type === '2_NUM_COLORS') {
                  if (totalLen < 4) continue;
                  elements.push({t:'n', v: history[i].roll});
                  elements.push({t:'n', v: history[i+1].roll});
                  for(let p=2; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
                }

                if (elements.length === 0) continue;
                if (patternType !== 'ONLY_NUMBERS' && elements.some(e => e.t === 'n' && e.v === '0')) continue;

                const exactKeyFragment = elements.map(e => e.t + e.v).join('|');
              const cacheKey = config.useWildcards + ':' + (config.maxWildcards || 1) + ':' + exactKeyFragment;
              if (!globalVariationsCache[cacheKey]) {
                  const varsList = generateWildcardVariations(elements, config.useWildcards, config.maxWildcards || 1);
                  globalVariationsCache[cacheKey] = varsList.map(v => ({
                      keyFragment: v.map(e => e.t + e.v).join('|'),
                      vars: v
                  }));
              }
              for (const item of globalVariationsCache[cacheKey]) {
                 const vars = item.vars;
                 const key = target + ':' + item.keyFragment;
                   if (!patternState[key]) {
                     patternState[key] = { type, target, elements: vars, entriesData: {} };
                     for (let e = minEntries; e <= maxEntries; e++) {
                         patternState[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, maxSa: 0, currentPa: 0, maxPa: 0 };
                     }
                   }

                for (let e = minEntries; e <= maxEntries; e++) {
                    const keyE = key + '_' + e;
                    if (i < (patternState[key].entriesData[e].nextValidIndex || 0)) continue;
                    patternState[key].entriesData[e].triggers++;
                    let hit = false;
                    let aborted = false;
                    let incomplete = false;
                    let stepsTaken = 0;
                    for (let w = 1; w <= e; w++) {
                      stepsTaken++;
                      
                      const nxt = history[i + totalLen - 1 + w];
                      if (!nxt) { incomplete = true; break; }
                      if (evaluateHit(nxt, target, config.coverWhite !== false)) {
                          hit = true;
                          break;
                      }

                      let isRetrigger = true;
                      for (let j = 0; j < totalLen; j++) {
                          const el = vars[j];
                          const roll = history[i + w + j];
                          if (!roll) { isRetrigger = false; break; }
                          const rollCol = getCol(roll);
                          const rollNum = roll.roll.toString();
                          if (el.t === 'c' && !isColorMatch(rollCol, el.v as string)) { isRetrigger = false; break; }
                          if (el.t === 'n' && rollNum !== el.v) { isRetrigger = false; break; }
                      }

                      if (isRetrigger) {
                          aborted = true;
                          break;
                      }
                    }
                    if (config.lossMode === 'ENTRADA') {
                        if (incomplete && !hit && !aborted) {
                            // Ativo pendente
                        } else if (aborted) {
                            patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                            patternState[key].entriesData[e].currentSa += stepsTaken; patternState[key].entriesData[e].currentPa = 0;
                            if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                        } else if (hit) {
                            patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                            patternState[key].entriesData[e].wins++;
                            patternState[key].entriesData[e].currentSa += (stepsTaken - 1); 
                            if (stepsTaken > 1) patternState[key].entriesData[e].currentPa = 0;
                            patternState[key].entriesData[e].currentPa++; 
                            if (patternState[key].entriesData[e].currentPa > patternState[key].entriesData[e].maxPa) patternState[key].entriesData[e].maxPa = patternState[key].entriesData[e].currentPa;
                            if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                            patternState[key].entriesData[e].currentSa = 0;
                        } else {
                            patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                            patternState[key].entriesData[e].currentSa += stepsTaken; patternState[key].entriesData[e].currentPa = 0;
                            if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                        }
                    } else {
                        if (incomplete && !hit && !aborted) {
                            // Ativo pendente
                        } else if (aborted) {
                            patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                            patternState[key].entriesData[e].currentSa++; patternState[key].entriesData[e].currentPa = 0;
                            if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                        } else if (hit) {
                            patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                            patternState[key].entriesData[e].wins++; patternState[key].entriesData[e].currentSa = 0; patternState[key].entriesData[e].currentPa++; if (patternState[key].entriesData[e].currentPa > patternState[key].entriesData[e].maxPa) patternState[key].entriesData[e].maxPa = patternState[key].entriesData[e].currentPa;
                        } else {
                            patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                            patternState[key].entriesData[e].currentSa++; patternState[key].entriesData[e].currentPa = 0;
                            if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                        }
                    }
                }
                }
              }
            }
          }
        }
      }

      currentIndex = end;
      
      if (currentIndex < history.length) {
        setTimeout(processChunk, 0);
      } else {
        const results: DiscoveredPattern[] = [];
        Object.entries(patternState).forEach(([k, v]) => {
           for (let e = minEntries; e <= maxEntries; e++) {
               const eState = v.entriesData[e];
               const wr = ((eState.wins / (eState.triggers || 1)) * 100).toFixed(1);
               if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.maxSa <= maxSa && eState.currentSa >= minSaFilter && eState.currentPa >= (config.minPaFilter || 0)) {
                  results.push({
                     id: k + '|ENT_' + e, lossMode: config.lossMode || 'CICLO', entries: e,
                     type: v.type, elements: v.elements, winRate: wr, count: eState.wins,
                     triggers: eState.triggers, sa: eState.currentSa, sm: eState.maxSa, pa: eState.currentPa, pm: eState.maxPa, activeNow: false, target: v.target
                  });
               }
           }
        });

        let anyNewTrigger = false;
        let finalResults = results.map(pat => {
           let currentStep = 0;
           let activeNow = false;
           for (let step = 0; step < (pat.entries || maxEntries); step++) {
             const triggerIdx = currentData.length - 1 - step;
             const patternStartIdx = triggerIdx - pat.elements.length + 1;
             if (patternStartIdx < 0) continue;
             let isMatch = true;
             for (let p = 0; p < pat.elements.length; p++) {
               const r = currentData[patternStartIdx + p];
               const el = pat.elements[p];
               if (el.t === 'c') { if (!isColorMatch(getCol(r), el.v as string)) { isMatch = false; break; } } 
               else { if (r.roll !== el.v) { isMatch = false; break; } }
             }
             if (isMatch) {
               let alreadyHit = false;
               for (let check = 1; check <= step; check++) {
                 if (evaluateHit(currentData[patternStartIdx + pat.elements.length - 1 + check], pat.target || targetFocus, config.coverWhite !== false)) {
                   alreadyHit = true; break;
                 }
               }
               if (!alreadyHit) {
                 activeNow = true;
                 currentStep = step;
                 if (!oldActiveIds.has(pat.id as string)) anyNewTrigger = true;
                 break; 
               }
             }
           }
           return { ...pat, activeNow, currentStep };
        });

        finalResults.sort((a, b) => {
          if (a.activeNow && !b.activeNow) return -1;
          if (!a.activeNow && b.activeNow) return 1;
          if (config.sortBy === 'SA') {
            if (b.sa !== a.sa) return b.sa - a.sa;
            return parseFloat(b.winRate) - parseFloat(a.winRate);
          }
          return parseFloat(b.winRate) - parseFloat(a.winRate);
        });

        
        
        self.postMessage({ results: finalResults.slice(0, 100), anyNewTrigger: typeof anyNewTrigger !== "undefined" ? anyNewTrigger : false });

        
        }
    };

    processChunk();
  };



const runFullDiscovery = (config: any, currentData: Roll[], isAuto: boolean, oldActiveIds: Set<string> = new Set()) => {
      if (config.lossMode === 'ENTRADA') {
          runFullDiscoveryEntrada(config, currentData, isAuto, oldActiveIds);
      } else {
          runFullDiscoveryCiclo(config, currentData, isAuto, oldActiveIds);
      }
  };

  const runMixedDiscoveryCiclo = (c: any, d: Roll[], a: boolean, o: Set<string> = new Set()) => runMixedDiscoveryEntrada({...c, lossMode: 'CICLO'}, d, a, o);
  const runMixedDiscovery = (c: any, d: Roll[], a: boolean, o: Set<string> = new Set()) => {
      runMixedDiscoveryEntrada(c, d, a, o);
  };



const runUpdateActive = (config: any, currentData: Roll[], activePatterns: DiscoveredPattern[], oldActiveIds: Set<string> = new Set()) => {
    const { periodHours, targetFocus, minWinRate, minSaFilter } = config;
    const history = currentData.slice(-periodHours * 120);
    
    let anyNewTrigger = false;
    const results: DiscoveredPattern[] = [];

    for (const pat of activePatterns) {
        const totalLen = pat.elements.length;
        const e = pat.entries;
        const target = pat.target || targetFocus;
        let nextValidIndex = 0;
        
        let triggers = 0;
        let wins = 0;
        let currentSa = 0;
        let maxSa = 0;
        let currentPa = 0;
        let maxPa = 0;

        for (let i = 0; i <= history.length - totalLen; i++) {
            if (i < nextValidIndex) continue;
            
            let isMatch = true;
            for (let p = 0; p < totalLen; p++) {
                const el = pat.elements[p];
                const r = history[i + p];
                if (el.t === 'c') {
                    if (!isColorMatch(getCol(r), el.v as string)) { isMatch = false; break; }
                } else {
                    if (r.roll.toString() !== el.v.toString()) { isMatch = false; break; }
                }
            }

            if (!isMatch) continue;

            triggers++;
            let hit = false;
            let aborted = false;
            let incomplete = false;
            let stepsTaken = 0;

            for (let w = 1; w <= e; w++) {
                stepsTaken++;
                const nxt = history[i + totalLen - 1 + w];
                if (!nxt) { incomplete = true; break; }
                if (evaluateHit(nxt, target, config.coverWhite !== false)) {
                    hit = true; break;
                }

                if (config.lossMode === 'ENTRADA') {
                    let isRetrigger = true;
                    for (let j = 0; j < totalLen; j++) {
                        const el = pat.elements[j];
                        const roll = history[i + w + j];
                        if (!roll) { isRetrigger = false; break; }
                        const rollCol = getCol(roll);
                        const rollNum = roll.roll.toString();
                        if (el.t === 'c' && !isColorMatch(rollCol, el.v as string)) { isRetrigger = false; break; }
                        if (el.t === 'n' && rollNum !== el.v.toString()) { isRetrigger = false; break; }
                    }
                    if (isRetrigger) { aborted = true; break; }
                }
            }

            if (config.lossMode === 'ENTRADA') {
                if (incomplete && !hit && !aborted) {
                    // Ativo
                } else if (aborted) {
                    nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                    currentSa += stepsTaken; currentPa = 0;
                    if (currentSa > maxSa) maxSa = currentSa;
                } else if (hit) {
                    nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                    wins++;
                    currentSa += (stepsTaken - 1);
                    if (stepsTaken > 1) currentPa = 0;
                    currentPa++;
                    if (currentPa > maxPa) maxPa = currentPa;
                    if (currentSa > maxSa) maxSa = currentSa;
                    currentSa = 0;
                } else {
                    nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                    currentSa += stepsTaken; currentPa = 0;
                    if (currentSa > maxSa) maxSa = currentSa;
                }
            } else {
                if (incomplete && !hit) {
                    // Ativo
                } else if (hit) {
                    // In CICLO, nextValidIndex is NOT updated on hit
                    wins++; currentSa = 0; currentPa++;
                    if (currentPa > maxPa) maxPa = currentPa;
                } else {
                    nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                    currentSa++; currentPa = 0;
                    if (currentSa > maxSa) maxSa = currentSa;
                }
            }
        }

        const wr = ((wins / (triggers || 1)) * 100).toFixed(1);
        
        let activeNow = false;
        let currentStep = 0;
        for (let step = 0; step < e; step++) {
           const triggerIdx = currentData.length - 1 - step;
           const patternStartIdx = triggerIdx - pat.elements.length + 1;
           if (patternStartIdx < 0) continue;
           let isMatch = true;
           for (let p = 0; p < pat.elements.length; p++) {
             const r = currentData[patternStartIdx + p];
             const el = pat.elements[p];
             if (el.t === 'c') { if (!isColorMatch(getCol(r), el.v as string)) { isMatch = false; break; } } 
             else { if (r.roll.toString() !== el.v.toString()) { isMatch = false; break; } }
           }
           if (isMatch) {
             let alreadyHit = false;
             for (let check = 1; check <= step; check++) {
               if (evaluateHit(currentData[patternStartIdx + pat.elements.length - 1 + check], target, config.coverWhite !== false)) {
                 alreadyHit = true; break;
               }
             }
             if (!alreadyHit) {
               activeNow = true;
               currentStep = step;
               if (!oldActiveIds.has(pat.id as string)) anyNewTrigger = true;
               break; 
             }
           }
        }

        if (triggers >= (config.minTriggers || 1) && parseFloat(wr) >= minWinRate && maxSa <= config.maxSa && currentSa >= minSaFilter && currentPa >= (config.minPaFilter || 0)) {
            results.push({
                ...pat,
                winRate: wr,
                count: wins,
                triggers,
                sa: currentSa,
                sm: maxSa,
                pa: currentPa,
                pm: maxPa,
                activeNow,
                currentStep
            });
        }
    }

    results.sort((a, b) => {
          if (a.activeNow && !b.activeNow) return -1;
          if (!a.activeNow && b.activeNow) return 1;
          if (config.sortBy === 'SA') {
            if (b.sa !== a.sa) return b.sa - a.sa;
            return parseFloat(b.winRate) - parseFloat(a.winRate);
          }
          return parseFloat(b.winRate) - parseFloat(a.winRate);
        });

    self.postMessage({ results: results.slice(0, 300), anyNewTrigger });
};

self.onmessage = (e: MessageEvent) => {
  const { action, config, currentData, isAuto, liveMode } = e.data;
  const oldActiveIds = new Set<string>(e.data.oldActiveIdsArray || []);

  if (action === 'runFullDiscoveryCiclo') runFullDiscoveryCiclo(config, currentData, isAuto, oldActiveIds);
  if (action === 'runFullDiscoveryEntrada') runFullDiscoveryEntrada(config, currentData, isAuto, oldActiveIds);
  if (action === 'runMixedDiscoveryCiclo') runMixedDiscoveryCiclo(config, currentData, isAuto, oldActiveIds);
  if (action === 'runMixedDiscoveryEntrada') runMixedDiscoveryEntrada(config, currentData, isAuto, oldActiveIds);
  if (action === 'runUpdateActive') runUpdateActive(config, currentData, e.data.activePatterns || [], oldActiveIds);
};