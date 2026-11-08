# Colocar o Elo no ar

O GitHub Pages só serve arquivos; o Elo precisa de **um servidor Node com disco persistente** (SQLite + fotos). O mesmo servidor entrega o app (`public/`), a API e o painel `/admin/`, então é **uma URL só** e não precisa configurar `config.js`/CORS.

## Opção A — Fly.io (mais barato)
```bash
fly launch --no-deploy --copy-config      # use um nome único em fly.toml
fly volumes create elo_data --size 1 --region gru
fly secrets set MEDIA_SECRET=$(openssl rand -hex 32)
fly deploy
fly ssh console -C "npm run create-admin -- voce@email.com 'SenhaForte123'"
```
## Opção B — Render
New → Blueprint → este repositório (`render.yaml`; o disco exige plano pago). Depois, no *Shell* do serviço: `npm run create-admin -- voce@email.com 'SenhaForte123'`.

## Primeiros passos após subir
1. Abra `https://SEU-APP/` (app) e `https://SEU-APP/admin/` (entre com a conta criada).
2. Em produção as **fotos nascem "em análise"**: aprove em *Fotos* no painel. Para um teste fechado dá para usar `AUTO_APPROVE_PHOTOS=true`.
3. A confirmação de e-mail está **desligada** (`REQUIRE_EMAIL_VERIFICATION=false`) porque ainda não há provedor de e-mail. Ligue quando integrar um.
4. A compra de planos **não funciona** em produção até integrar o Google Play (`docs/ANDROID.md`); o simulador só existe em desenvolvimento.
5. Faça backup do volume `/data` (banco + fotos).

## Antes de abrir para pessoas reais
Termos e privacidade revisados por jurista (LGPD), canal de suporte, equipe/rotina de moderação e denúncias, e política de menores. O `legal.html` é só rascunho. Para um piloto, prefira convidar poucas pessoas conhecidas.
