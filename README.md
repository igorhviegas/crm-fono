# CRM · Bárbara Rabelo Fonoaudiologia

React + TypeScript + Vite + Tailwind · Firebase (Auth Google + Firestore) · Vercel.
Projeto independente (nenhum código/credencial de outros projetos).

## Rodar local (sem conta Firebase, dados fictícios)
```bash
npm install
npm run emulators      # terminal 1 (precisa de Java)
npm run dev            # terminal 2 -> http://localhost:5173
```
Para liberar um e-mail no emulador, crie o documento `membros/<email>` (REST com `Authorization: Bearer owner`).

## Testes
```bash
npm test               # regras de negócio (aniversários, telefone, mensagem, wa.me)
npm run test:rules     # regras do Firestore no emulador (acesso direto, sem passar pela tela)
npm run build          # checagem de tipos + build
```

## Colocar no ar (desenvolvimento)
1. **Firebase** (console.firebase.google.com): criar projeto, sem Analytics → Authentication → ativar **Google** → Firestore (modo produção) → Project settings → app Web (copiar config).
2. `firebase deploy --only firestore:rules` (publica `firestore.rules`).
3. **Quem pode entrar:** no console, Firestore → coleção `membros` → documento com ID = **e-mail Google exato** (ex.: `barbara@gmail.com`) e um campo `papel` = `admin`. Sem esse documento a conta entra no Google mas não vê nada.
4. **Vercel**: importar o repositório; em Environment Variables colocar `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` e `VITE_USE_EMULATOR=false`.
5. Firebase → Authentication → Settings → **Authorized domains**: adicionar o domínio da Vercel.

## Identidade visual
Branco, preto e dourado (`#B08D4F`), inspirada no logo da Bárbara. Para o logo aparecer na arte de aniversário, salve o arquivo (PNG com fundo transparente) em `public/logo.png`. Referência usada: `docs/brand/ref-perfil.jpg` (150px, baixa resolução).

## Fora desta versão
Importação: fichas em Word (.docx) — lê só nome, DN, datas de atendimento, serviço e responsável; nada clínico. PDFs/anexos (exigem Firebase Storage/plano Blaze) e agenda ficam para depois. Dados reais de pacientes só depois de revisar `docs/privacidade-e-lgpd.md` (a escrever).
