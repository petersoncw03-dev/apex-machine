import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConditionalSidebar from "@/components/ConditionalSidebar";
import ClientLayout from "./ClientLayout";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Apex Machine — Painel de Análises para Blaze Double",
  description:
    "O terminal analítico definitivo para validar sinais, analisar padrões e detectar confluências na Blaze Double em tempo real. Backtester, Minutos da IA e Radar ao Vivo.",
  keywords: ["blaze double", "sinais blaze", "análise blaze", "painel blaze", "apex machine", "minutos da ia"],
  openGraph: {
    title: "Apex Machine — Painel de Análises para Blaze Double",
    description:
      "Valide seus sinais antes de apostar. Radar ao Vivo, Backtester de 43 mil rodadas e Inteligência Artificial para Blaze Double.",
    url: "https://apexmachine.com.br",
    siteName: "Apex Machine",
    images: [
      {
        url: "https://apexmachine.com.br/apex-logo.jpeg",
        width: 1200,
        height: 630,
        alt: "Apex Machine — Terminal de Análises Blaze",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Apex Machine — Painel de Análises para Blaze Double",
    description: "Valide seus sinais antes de apostar. Radar ao Vivo, Backtester e IA.",
    images: ["https://apexmachine.com.br/apex-logo.jpeg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full flex bg-[#050507] text-white">
        <ClientLayout>
          <ConditionalSidebar />
          <main className="flex-1 min-h-screen overflow-auto">
            {children}
          </main>
        </ClientLayout>
      </body>
    </html>
  );
}

