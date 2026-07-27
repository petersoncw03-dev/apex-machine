# Microserviço Independente de SSE — VPS (Apex Machine)

Este microserviço foi desacoplado do Vercel para rodar 100% de forma independente no seu servidor **Ubuntu / Easypanel** no IP `151.242.25.148`.

---

## 🎯 Por que usar este microserviço?
Na Vercel, conexões SSE contínuas mantêm instâncias Serverless Functions ativas 24h por dia, estourando rapidamente os limites de **Fluid Provisioned Memory** e **Active CPU**.

Rodando este microserviço na VPS:
- **Consumo RAM na VPS:** < 40 MB total (suporta centenas de conexões simultâneas a custo zero).
- **Vercel Serverless:** Consumo 0 MB-Hrs por escuta de eventos.

---

## 🚀 Como subir no Easypanel (Passo a Passo)

1. Acesse seu painel do **Easypanel** no servidor Ubuntu.
2. Crie um novo projeto (ou selecione um existente).
3. Adicione um novo **App** do tipo **Docker / Git Repo** ou **Source Code**.
4. Aponte para a pasta `vps-events-service` (ou suba os arquivos desta pasta).
5. Configure as Variáveis de Ambiente no Easypanel:
   ```env
   PORT=4000
   DB_HOST=151.242.25.148
   DB_PORT=15721
   DB_USER=postgresmachine
   DB_PASS=125320pepe
   DB_NAME=apexmachine
   ```
6. Exponha a porta `4000` ou configure o domínio no Easypanel (ex: `https://events.seu-dominio.com` ou `http://151.242.25.148:4000`).

---

## 🔗 Como Vincular ao Projeto Principal (Next.js na Vercel)

No arquivo `.env.local` (ou nas Environment Variables da Vercel no projeto principal):

```env
NEXT_PUBLIC_VPS_URL=http://151.242.25.148:4000
```

Pronto! O frontend se conectará automaticamente ao microserviço da VPS para escutar os eventos em tempo real, enquanto a Vercel servirá apenas as páginas e APIs com cache otimizado Edge.
