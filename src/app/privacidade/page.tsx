import Link from 'next/link';

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white p-8 md:p-16 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-black/40 backdrop-blur-md border border-white/5 p-8 md:p-12 rounded-2xl shadow-2xl">
        <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-4">
          <Link href="/" className="text-[#00ff41] hover:underline font-mono text-xs uppercase tracking-widest">&lt; VOLTAR</Link>
          <h1 className="text-2xl font-mono text-white/90 uppercase tracking-widest">Política de Privacidade</h1>
        </div>

        <div className="flex flex-col gap-6 text-gray-400 text-sm leading-relaxed font-sans">
          <section>
            <h2 className="text-[#00ff41] font-mono text-lg mb-2">1. Coleta de Dados (LGPD)</h2>
            <p>Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), informamos que o Apex Machine coleta e armazena apenas os dados estritamente necessários para a prestação do serviço, como: Nome de Usuário, Endereço de E-mail (quando fornecido) e logs técnicos de segurança (Endereço de IP e dados de sessão).</p>
          </section>

          <section>
            <h2 className="text-[#00ff41] font-mono text-lg mb-2">2. Uso das Informações</h2>
            <p>Os dados coletados são utilizados única e exclusivamente para:</p>
            <ul className="list-disc ml-6 mt-2 flex flex-col gap-1">
              <li>Autenticação segura no sistema (Login).</li>
              <li>Prevenção contra fraudes e compartilhamento indevido de contas.</li>
              <li>Aperfeiçoamento da experiência do usuário e métricas de uso da plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#00ff41] font-mono text-lg mb-2">3. Compartilhamento de Dados</h2>
            <p>Nós **não vendemos, alugamos ou comercializamos** seus dados pessoais para terceiros sob nenhuma circunstância. Suas informações são protegidas e criptografadas em nossos servidores privados (VPS) utilizando protocolos de segurança cibernética avançados.</p>
          </section>

          <section>
            <h2 className="text-[#00ff41] font-mono text-lg mb-2">4. Cookies e Rastreamento</h2>
            <p>O sistema utiliza "cookies" de sessão apenas para manter você logado de forma segura e salvar as suas estratégias (como no Simulador e Radar). Esses cookies são armazenados localmente no seu dispositivo e não rastreiam sua navegação fora do Apex Machine.</p>
          </section>

          <section>
            <h2 className="text-[#00ff41] font-mono text-lg mb-2">5. Direitos do Usuário</h2>
            <p>Você tem o direito de solicitar, a qualquer momento, a alteração, anonimização ou exclusão completa e permanente dos seus dados e credenciais de nossos servidores. Para isso, basta contatar nosso suporte técnico.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
