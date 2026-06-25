import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConditionalSidebar from "@/components/ConditionalSidebar";
import ClientLayout from "./ClientLayout";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Apex Machine",
  description: "Sistema de Análises Avançadas",
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

