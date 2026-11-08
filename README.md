# Elo

Aplicativo de relacionamento para maiores de 18 anos (Android primeiro), implementado a partir da *Documentação completa do aplicativo Elo* e do protótipo HTML (revisão 4). Todas as regras de negócio vivem **no servidor**; o app é só interface.

| Parte | Tecnologia | Pasta |
|---|---|---|
| API | Node.js 22 + Express + SQLite (`node:sqlite`) | `server/` |
| App | PWA em JavaScript puro (ES modules, sem build) — empacotável para Android com Capacitor | `public/` |
| Painel de operação | Página web (suporte, moderador, administrador) | `public/admin/` |
| Arte e prompts de IA | Placeholders SVG + guia de prompts | `public/assets/art/`, **`docs/ARTE-PROMPTS.md`** |

## Rodar localmente
```bash
npm install
npm run seed      # perfis de DEMONSTRAÇÃO + contas de teste (apenas desenvolvimento)
npm start         # http://localhost:3000   (painel: /admin/)
npm test          # testes de regras (QA01–QA12) — 33 testes
```
Contas do seed: `teste@elo.test / elo12345` · admin `admin@elo.test / elo-admin-123` · moderador `moderador@elo.test / elo-mod-12345` · suporte `suporte@elo.test / elo-sup-12345`.
Em desenvolvimento: fotos são aprovadas automaticamente, a compra de plano é **simulada** e os e-mails (confirmação, recuperação) aparecem em `GET /api/dev/outbox`.

Variáveis de ambiente (produção): `NODE_ENV=production`, `MEDIA_SECRET` (obrigatório), `DB_PATH`, `UPLOAD_DIR`, `PORT`, `CORS_ORIGINS`, `GOOGLE_PLAY_PACKAGE`, `GOOGLE_PLAY_WEBHOOK_SECRET`, `PATHS_*` (parâmetros do piloto dos Caminhos). Em produção as fotos nascem **pendentes** (moderação) e a confirmação de e-mail é exigida.

## Documentos
- **`docs/ARTE-PROMPTS.md`** — toda a arte necessária, com nome de arquivo, tamanho e prompt para gerar em IA.
- `docs/IMPLEMENTACAO.md` — o que foi implementado, como cada regra foi aplicada, decisões assumidas e pendências.
- `docs/ANDROID.md` — empacotar como app Android, permissões, cobrança e push.
- `docs/referencia/` — documentação original e protótipo de referência.

## Verificações
`npm test` roda os testes de integração (API real em memória). `scripts/e2e-smoke.js` e `scripts/e2e-flows.js` percorrem o app no Chromium (Playwright) — exigem o servidor rodando.
