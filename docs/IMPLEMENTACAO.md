# Implementação — mapa da documentação para o código

Legenda: ✅ implementado e testado · 🟡 implementado parcialmente / com limitação · ⛔ depende de decisão ou serviço externo (não implementado).

## 1. Experiência e identidade visual
| Requisito | Estado | Onde |
|---|---|---|
| Modo claro (branco/azul `#2865EB`), escuro (grafite/laranja `#FF672E`), opção "sistema" | ✅ | `public/css/app.css` (tokens), Configurações → Aparência |
| Barra inferior flutuante translúcida: Descobrir, Caminhos, Matches, Conversas, Meu perfil | ✅ | `core.js#renderNav` |
| "Quem curtiu você" dentro de Matches | ✅ | aba em `/matches` |
| Curtir/passar por botão **e** gesto; alvos ≥ 48 px; foco visível; `prefers-reduced-motion`; rótulos para leitor de tela | ✅ (sem validação em TalkBack real) | `discover.js`, `app.css` |
| Cartões ou grade | ✅ | botão de alternar em Descobrir |

## 2. Cadastro, conta e configurações
| Requisito | Estado | Onde |
|---|---|---|
| Cadastro e-mail+senha (scrypt), login, logout, recuperação sem confirmar e-mail, revogação de dispositivos | ✅ | `services/accounts.js` |
| Maioridade no servidor; nascimento privado; idade calculada; tentativa de contornar trocando a data é barrada; alteração só por admin com justificativa | ✅ QA01 | `accounts.register`, `admin.changeBirthDate` |
| Verificação de e-mail (exigida em produção) | ✅ | `REQUIRE_EMAIL_VERIFICATION` |
| Pausar descoberta/caminhos, notificações por categoria, tema, exportar (com senha) e excluir conta (oculta na hora, sessões revogadas, limpeza em 30 dias) | ✅ QA10 | `services/privacy.js`, `me.js` |
| Login Google, provedor de e-mail transacional real | ⛔ | e-mails vão para uma tabela `outbox` de desenvolvimento |

## 3. Perfil e galeria
✅ Todos os campos da tabela (nome ≤ 40, descrição ≤ 500, até 8 interesses normalizados, fumo/filhos/bebidas/pets com "prefiro não informar", altura 100–250, profissão, escolaridade). Fotos: 1–6, ordenação, remoção; **remoção de EXIF/GPS no servidor** (JPEG/PNG/WebP, magic bytes, SVG recusado); moderação (nasce pendente em produção); foto nova **não substitui** a aprovada. Mídia servida por URL assinada que revalida bloqueio/status. Verificação de foto (selfie) ⛔ (fase 4).

## 4. Descoberta, curtidas e match
| Requisito | Estado | Teste |
|---|---|---|
| Filtros idade/distância/gênero/intenção + compatibilidade **recíproca**, bloqueios, conta ativa, modo discreto, pausa — no servidor | ✅ | QA02 |
| Cota diária 20/100/200, renova à meia-noite de `America/Sao_Paulo` (relógio do servidor), não acumula, passar não consome, trocar de plano mantém consumo | ✅ | QA03 |
| Consumo atômico (transação `BEGIN IMMEDIATE`) — dois dispositivos não gastam a mesma última unidade | ✅ | QA04 |
| Idempotência: repetir curtida não duplica consumo/curtida/match (par único + `UNIQUE` no match) | ✅ | QA05 |
| Free não recebe nome/foto/id de quem curtiu (API, notificação genérica); contagem agregada é grátis | ✅ | QA06 |
| Match libera chat; bloqueio/desmatch encerram, inclusive por API | ✅ | QA07 |
| Orientação de dois dias | ✅ | banner em Descobrir |

## 5. Proximidade e Caminhos cruzados
✅ Consentimento separado e versionado; pausar; revogar apaga sinais e cruzamentos (QA09); precisão ≤ 100 m, distância ≤ 200 m, janela ≤ 15 min, atraso mínimo 60 min, retenção 24 h (bruto) / 7 dias (cruzamento) — **todos configuráveis** (`PATHS_*`); densidade mínima (supressão de baixa densidade); zonas sensíveis; bloqueio nos dois sentidos; discreto suprime; API **nunca** devolve coordenadas, horário exato ou distância (só região, dia e período); limite de consultas. Coleta em **primeiro plano** apenas.
🟡 O processamento usa varredura por grade em memória (suficiente para o piloto); em escala trocar por PostGIS/índice espacial. ⛔ Segundo plano e calibração de precisão/bateria exigem teste em aparelhos reais.

## 6. Conversas, encontros e popularidade
✅ Chat de texto (≤ 2.000 caracteres, confirmação do servidor, `clientId` idempotente, estado pendente/falha com "tentar de novo" sem duplicar), não lidas, convite estruturado "Bora tomar um café?" (local público, data, aceitar/recusar/cancelar), popularidade privada em janela de 7 dias com visitas únicas por pessoa/dia, sem identificar visitantes e sem classificação. 🟡 Tempo real por *polling* (4 s); trocar por WebSocket/FCM depois. ⛔ Mídia no chat, chamadas.

## 7. Planos e cobrança
✅ Catálogo (R$ 19,90/179,90 · 34,90/299,90), direito efetivo calculado no servidor; estados pendente/ativa/renovação cancelada/tolerância/expirada/reembolsada/revogada; **pendente não libera**; cancelar mantém até o fim do período; desfazer dispensa (Plus+), modo discreto e destaque 30 min/semana (Premium, janela móvel de 7 dias); webhook idempotente por `event_id`; compra simulada **somente fora de produção**. ⛔ Verificação real no Google Play (interface `ctx.googleVerifier` pronta; veja `docs/ANDROID.md`).

## 8. Proteção, privacidade e moderação
✅ Bloquear (sem avisar, sem exigir denúncia), denunciar com categoria, protocolo, evidências (últimas 20 mensagens) e fila por gravidade; restrição preventiva automática após 2 denúncias de menor; recurso do usuário; retenções documentadas; exportação sem dados de terceiros; limpeza programada (arquivos, perfil, derivados). Texto de termos/privacidade em `legal.html` é **rascunho** — requer revisão jurídica.

## 9. Administração
✅ Painel `/admin/`: papéis suporte/moderador/administrador com permissões distintas; busca de contas (dados mínimos), fotos, denúncias, sanções, recursos, exclusões, parâmetros (curtidas/dia), métricas agregadas; **justificativa obrigatória + reconfirmação de senha** em ações sensíveis; **trilha de auditoria**; sessões de equipe de 8 h. 🟡 2FA/TOTP para a equipe fica pendente.

## 10. Qualidade (QA01–QA12)
33 testes automatizados cobrem QA01–QA10 no servidor. QA11 (fonte ampliada/leitor de tela/contraste) e QA12 (estados sem rede, permissão negada, cota esgotada, lista vazia) têm estados implementados e foram percorridos no Chromium, mas **não** em Android físico/TalkBack.

## Decisões assumidas (a confirmar — "pendente" no documento)
| Tema | Decisão aplicada | Onde mudar |
|---|---|---|
| Reapresentação de perfis dispensados | Reaparecem após 30 dias; perfis curtidos/desfeitos nunca voltam | `RESURFACE_PASSED_DAYS` |
| Mensagens após exclusão/desmatch | Conversa encerrada fica inacessível aos dois; na limpeza da conta, as conversas são apagadas | `privacy.purgeDeleted` |
| Janela do destaque | Janela móvel de 7 dias sem acúmulo | `config.boost` |
| Limite de fotos | 1 a 6 | `config.limits` |
| Retenção de denúncias | Mantidas após exclusão do alvo (sem prazo definido) | a definir com jurídico |
| Nome e marca "Elo", lançamento em BH | Não validados; seed usa BH apenas como exemplo | — |
| App Android | Capacitor sobre a PWA (stack não estava definida no documento) | `docs/ANDROID.md` |

## Limitações conhecidas
- SQLite em arquivo único: serve ao piloto; para produção multi-instância migrar para PostgreSQL (+PostGIS) e fila/Redis (limitadores de taxa hoje são em memória).
- Notificações são in-app; push (FCM) não implementado.
- O protótipo usava retratos fictícios por IA; aqui os perfis demo são claramente rotulados e só existem no `seed`.
