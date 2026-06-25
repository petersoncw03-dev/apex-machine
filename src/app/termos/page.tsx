import Link from 'next/link';

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white p-8 md:p-16 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-black/40 backdrop-blur-md border border-white/5 p-8 md:p-12 rounded-2xl shadow-2xl">
        <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-4">
          <Link href="/" className="text-[#00ff41] hover:underline font-mono text-xs uppercase tracking-widest">&lt; VOLTAR</Link>
          <h1 className="text-2xl font-mono text-white/90 uppercase tracking-widest">Termos de Uso</h1>
        </div>

        <div className="flex flex-col gap-6 text-gray-400 text-sm leading-relaxed font-sans">
          <section>
            <h2 className="text-[#00ff41] font-mono text-lg mb-2">1. Aceitação dos Termos</h2>
            <p>Ao acessar e utilizar o sistema Apex Machine, você concorda integralmente com os presentes Termos de Uso. Caso não concorde com qualquer parte destes termos, o uso da plataforma é expressamente proibido.</p>
          </section>

          <section>
            <h2 className="text-[#00ff41] font-mono text-lg mb-2">2. Natureza do Serviço</h2>
            <p>O Apex Machine é uma ferramenta tecnológica projetada exclusivamente para **análise de dados probabilísticos e estatísticos**. Nosso sistema efetua cálculos baseados em resultados anteriores de jogos online.</p>
            <p className="mt-2 font-bold text-white/80">O Apex Machine NÃO é uma plataforma de apostas, NÃO realiza transações financeiras de jogos de azar e NÃO presta consultoria financeira.</p>
          </section>

          <section>
            <h2 className="text-[#00ff41] font-mono text-lg mb-2">3. Isenção de Responsabilidade (Riscos)</h2>
            <p>Os sinais e padrões indicados pelo sistema não configuram "dicas infalíveis" ou garantias de ganho. **O mercado de jogos de azar é altamente volátil e envolve alto risco de perda de capital.**</p>
            <p className="mt-2 text-[#e51e3e]">Ao utilizar o sistema, o usuário isenta totalmente os criadores do Apex Machine de qualquer responsabilidade por perdas financeiras, bloqueios de contas em plataformas terceiras, ou danos morais e materiais decorrentes do uso das estratégias sugeridas.</p>
          </section>

          <section>
            <h2 className="text-[#00ff41] font-mono text-lg mb-2">4. Restrição de Idade</h2>
            <p>Para a criação de conta e uso das ferramentas analíticas, é obrigatório que o usuário tenha **18 (dezoito) anos completos ou mais**, sob pena de banimento imediato e sem direito a reembolso.</p>
          </section>

          <section>
            <h2 className="text-[#00ff41] font-mono text-lg mb-2">5. Modificações</h2>
            <p>Reservamo-nos o direito de modificar, suspender ou encerrar o serviço (ou qualquer parte dele) a qualquer momento, bem como alterar estes termos, com ou sem aviso prévio.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
