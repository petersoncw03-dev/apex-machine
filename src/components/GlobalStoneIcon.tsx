export const GlobalStoneIcon = ({ n, size = "md" }: { n: number, size?: "sm" | "md" | "lg" | "ticker" }) => {
   let containerBg = 'bg-[#2C2F33]';
   let circleBorder = 'border-[1px] border-white/40';
   let textClass = 'text-white font-black';

   if (n === 0) {
     containerBg = 'bg-white';
     circleBorder = 'border-0';
     textClass = 'text-black font-black';
   } else if (n >= 1 && n <= 7) {
     containerBg = 'bg-[#E51E3E]';
     circleBorder = 'border-[1.5px] border-white/80';
   }

   const dims: any = {
     sm: { out: 'w-7 h-7', in: 'w-5 h-5', txt: 'text-[9px]' },
     md: { out: 'w-10 h-10', in: 'w-7 h-7', txt: 'text-[12px]' },
     lg: { out: 'w-12 h-12', in: 'w-8 h-8', txt: 'text-[14px]' },
     ticker: { out: 'w-[40px] h-[40px]', in: 'w-[30px] h-[30px]', txt: 'text-[12px]' }
   };

   const d = dims[size];

   return (
     <div className={`rounded flex items-center justify-center shrink-0 ${d.out} ${containerBg}`}>
       {n === 0 ? (
         <div className={`${d.in} flex items-center justify-center overflow-hidden`}>
           <img src="/blaze-white.png" alt="W" className="w-full h-full object-contain" />
         </div>
       ) : (
         <div className={`rounded-full flex items-center justify-center ${d.in} ${circleBorder}`}>
           <span className={`${textClass} ${d.txt}`}>{n}</span>
         </div>
       )}
     </div>
   );
};
