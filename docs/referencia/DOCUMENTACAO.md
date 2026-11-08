# ELO — Documentação de produto e implementação

## 1. Visão do produto

**Elo** é o nome provisório de um aplicativo Android de relacionamento para maiores de 18 anos, público geral, com preferências recíprocas, descoberta por proximidade e possíveis caminhos cruzados. Conceito: *Talvez o próximo encontro já tenha passado por você.*



Documento de produto v1.0 · 06/11/2026 · preparado para Line. Nome, identidade, limites, métricas e arquitetura são propostas para validação. Não há pesquisa de marca, domínio ou disponibilidade na loja concluída.



### Problema e posicionamento



Facilitar o primeiro contato entre pessoas compatíveis que circulam pela mesma cidade, sem transformar localização em rastreamento. Diferenciação proposta: intenção visível, controle de descoberta e convites simples após o match. Não copiar identidade ou ativos de Tinder/happn.



### Público e hipótese



Adultos de diferentes gêneros e orientações, inicialmente em BH. Hipótese: contexto local ajuda a iniciar conversas. Validar por entrevistas, testes de uso e piloto com densidade suficiente; não presumir interesse ou receita.

## 2. Escopo e prioridades

| Fase | Entregas | Condição de saída |
| --- | --- | --- |
| P0 · MVP | Cadastro 18+, perfil, preferências, descoberta, curtida, match, chat textual, bloqueio, denúncia, exclusão e painel de moderação. Localização apenas durante o uso, com alternativa de cidade. | Fluxos críticos e controles de acesso testados; operação de denúncias ativa. |
| P1 · Diferencial | Caminhos cruzados opcionais, consentimento específico, retenção curta, pausas, proteção de áreas e avaliação de localização em segundo plano. | Validação técnica de bateria e falsos positivos; revisão de privacidade e aprovação de permissões aplicáveis. |
| P2 · Expansão | Bora?, assinatura, verificação de perfil, ferramentas antifraude aprimoradas e expansão regional. | Retenção e capacidade de moderação sustentáveis. |



Fora do MVP: chamadas de vídeo, mídia no chat, transmissão ao vivo, mapa de pessoas em tempo real, rastreamento de rotas e IA que converse no lugar do usuário.

## 3. Jornadas e telas

- **Entrada:** proposta → checagem de idade → autenticação → aceite de termos → perfil → preferências → explicação de localização → pedido de permissão.

- **Descoberta:** filtros → perfil → passar/curtir → reciprocidade → match → conversa.

- **Cruzamentos:** explicação separada → ativação voluntária → processamento aproximado → lista → perfil → curtida comum.

- **Encontro:** match ativo → proposta Bora? → aceitar, recusar ou cancelar. Nunca publicar o encontro para outros usuários.

- **Proteção:** menu de perfil/chat → bloquear ou denunciar → remoção imediata da visibilidade → protocolo de denúncia.

- **Saída:** configurações → exportar dados ou excluir conta → confirmação → esconder perfil e revogar sessões → limpeza rastreável.


Inventário: boas-vindas, idade, autenticação, editor de perfil, preferências, consentimentos, descoberta, detalhe, cruzamentos, match, conversas, chat, convite, configurações, assinatura, ajuda e administração.

## 4. Regras funcionais

| ID | Regra | Aceite |
| --- | --- | --- |
| RF01 | Apenas maiores de 18 anos; data de nascimento não pública. | Menor não acessa descoberta nem chat; suspeitas geram revisão. |
| RF02 | Perfil com nome de exibição, idade, bio, intenção e fotos moderadas; informações opcionais não inferidas. | Perfil incompleto não é distribuído. Bio limitada a 500 caracteres. |
| RF03 | Idade e gêneros de interesse devem ser compatíveis nos dois sentidos. | Conta bloqueada, excluída, suspensa ou fora dos filtros nunca aparece. |
| RF04 | Curtidas privadas, únicas por par; passar remove do ciclo atual. | Repetir requisição não duplica ação. Uma curtida isolada não abre chat. |
| RF05 | Match criado atomicamente após reciprocidade. | Requisições simultâneas geram apenas um match e uma conversa. |
| RF06 | Chat só para participantes de match ativo; até 2.000 caracteres por mensagem. | Bloqueio/desmatch revoga envio e leitura conforme política, inclusive por API direta. |
| RF07 | Denúncia pode incluir categoria e relato; bloquear não exige denunciar. | Registro com protocolo, fila interna e evidências acessíveis só à equipe autorizada. |
| RF08 | Sem resultados: explicar filtros e oferecer ampliar busca. | Nunca ampliar distância ou preferências silenciosamente. |

## 5. Proximidade e caminhos cruzados

**Descoberta não é cruzamento.** Descoberta usa localização recente para procurar na região. Cruzamento exige sinais de ambos próximos no espaço e no tempo; é uma estimativa, nunca prova de encontro.



### Proposta de algoritmo para piloto


- Coletar apenas com consentimento e permissão válidos; registrar precisão e horário do sinal no servidor.

- Descartar sinais antigos, inconsistentes ou com precisão insuficiente; parâmetros iniciais experimentais: precisão até 100 m, proximidade até 200 m e diferença de até 15 minutos.

- Comparar células geográficas vizinhas e distância no servidor; exigir preferências recíprocas e ausência de bloqueios.

- Suprimir áreas protegidas e situações de baixa densidade; não listar cruzamentos quando a inferência puder individualizar residência ou rotina.

- Agrupar por par e dia. Publicar com atraso mínimo proposto de 60 minutos, sem hora exata, contagem recorrente ou ponto no mapa.

- Entregar somente ID opaco, perfil permitido e texto “Vocês podem ter cruzado caminhos recentemente”.


Valores acima são hipóteses de engenharia a calibrar em campo. Edifícios, GPS impreciso e sistema operacional podem causar falsos positivos ou perda de eventos. Sem sinal suficiente, não gerar cruzamento.



### Permissões e alternativas



No MVP, localização durante o uso; negar permite escolher cidade, sem alegar distância precisa. Segundo plano somente em fase posterior, se necessário e aprovado, com explicação destacada antes do pedido. Pausar impede novos sinais e sugestões. Revogar consentimento remove histórico derivado. Áreas protegidas devem ser configuráveis e não públicas.



Não retornar coordenadas de terceiros nem distância numérica exata. Faixas de distância estáveis, limite de consultas e atraso reduzem inferência por triangulação, mas exigem testes específicos.

## 6. Privacidade e retenção

Plano proposto para revisão antes de produção; não é uma política jurídica final. Mapear bases legais, fornecedores, transferências internacionais e direitos aplicáveis com responsável especializado. Não vender localização, preferências ou conteúdo de conversas.



| Dado | Finalidade | Retenção proposta |
| --- | --- | --- |
| Sinal de localização | Calcular proximidade/cruzamento | Máximo 24 h; apagar após processamento quando possível |
| Cruzamento derivado | Exibir sugestão aproximada | 7 dias ou revogação, o que ocorrer primeiro |
| Perfil/fotos/preferências | Relacionamento e descoberta | Enquanto conta ativa; limpeza em até 30 dias após exclusão |
| Mensagens | Conversa e tratamento de abuso | Enquanto conversa ativa; política de exclusão definida para os dois participantes |
| Denúncias e evidências | Segurança e investigação | Prazo restrito a definir por finalidade; exceções documentadas |
| Backups | Recuperação | Rotação proposta de 30 dias; aplicar tombstones ao restaurar |



Exclusão deve ocultar conta imediatamente, revogar tokens, apagar mídias e derivados, cancelar futuras coletas e informar exceções justificadas. Cancelar assinatura é fluxo separado, explicitado ao usuário. Exportação exige reautenticação e não inclui localização ou dados privados de terceiros.



Notificações discretas por padrão. Eventos analíticos sem texto de chat, coordenadas, orientação ou preferência sexual. Logs devem ser minimizados e ter acesso auditado.

## 7. Confiança e moderação

18+ não elimina a necessidade de proteção de menores. Prever checagem neutra de idade, restrição da loja, denúncias de menor de idade e encaminhamento de casos. Verificação de foto não deve ser descrita como garantia de identidade ou segurança.


- Regras públicas: proibir exploração sexual infantil, assédio, ameaça, golpe, discriminação, conteúdo íntimo sem consentimento e impersonação.

- Moderação de fotos antes de publicação; remoção de metadados EXIF, validação de tipo real, limite de tamanho e URLs assinadas.

- Denúncias priorizadas por gravidade; suspeitas graves podem suspender exposição enquanto são revisadas.

- Painel com fila, categoria, evidências, responsável, decisão, recurso e trilha de auditoria. Separar suporte de funções privilegiadas.

- Bloqueio bilateral imediato; não notificar o bloqueado sobre quem denunciou.

- Responsável por segurança infantil, processo de resposta e comunicação às autoridades competentes quando aplicável.


Metas operacionais internas sugeridas: triagem de risco urgente em até 1 hora e denúncias comuns em até 24 horas, somente se houver equipe capaz de cumprir. Não anunciar cobertura 24/7 antes de estabelecê-la.

## 8. Design system e conteúdo

Direção: editorial urbano, azul, azul-marinho e interface limpa. Marca provisória Elo; símbolo de elos cruzados em SVG original. Arte conceitual gerada por IA e avatares ilustrados representam adultos fictícios; não são usuários ou depoimentos reais.



| Token | Valor | Uso |
| --- | --- | --- |
| Ink | #252823 | Texto e botões escuros |
| Paper | #F7FAFF | Fundo principal |
| Ember | #2563EB | Ação primária e destaques |
| Sage | #E2EDFF | Superfícies tranquilas |
| Tipografia | Arial/system sans + Georgia editorial | Sem dependência externa |
| Espaçamento | 4, 8, 12, 16, 24, 32, 48 px | Ritmo responsivo |



Botões com pelo menos 44×44 px, foco visível, labels textuais e navegação por teclado. Usar reduced-motion; cor não deve ser o único indicador. Animações propostas de 180–240 ms e comemoração de match discreta. Validar contraste e leitura com TalkBack em dispositivos reais.



Microcopy: “Conheça no seu ritmo”; “Sua localização exata não aparece”; “Não encontramos novos perfis com estes filtros”; “Você está no controle de quem pode te encontrar”. Nunca pressionar com contagem falsa de interessados.

## 9. Arquitetura proposta

Proposta de implementação, sem código de servidor entregue: React Native com TypeScript para Android; API TypeScript; PostgreSQL com PostGIS; fila para cruzamentos/moderação; armazenamento privado de mídia; canal em tempo real para chat e notificações push. Versões e fornecedores serão fixados no início do desenvolvimento após verificar compatibilidade e custos.



App → API autenticada → serviços de perfil/descoberta/matches/chat → banco. Upload por URL temporária → validação/moderação → publicação. Eventos de localização → fila isolada → detecção aproximada → limpeza automática. Administração separada com MFA.


- Servidor é autoridade para idade, bloqueios, match, consentimento, limites e pagamentos.

- Autorização por objeto em toda leitura/escrita; nenhum cliente consulta coordenadas diretamente.

- Criptografia em trânsito e em repouso; gestão de segredos; tokens curtos e revogáveis.

- Rate limits por conta/dispositivo/IP, detecção de abuso e idempotência nas mutações.

- Sem alegar criptografia ponta a ponta: o MVP exige decisão arquitetural específica se ela for desejada.

- Backups, restore testado, monitoramento e alertas de falhas de exclusão/retenção.

## 10. Modelo de dados e API

| Entidade | Campos principais / restrições |
| --- | --- |
| User / Profile | id, auth_id, birth_date privada, status; nome, bio, intenção, media_status |
| Preferences / Consent | user_id, idades, gêneros, raio; purpose, policy_version, granted_at, revoked_at |
| LocationSignal / Crossing | user_id, posição privada, accuracy, observed_at, expires_at; par ordenado, dia, expiry |
| Reaction / Match | actor, target, type; unique(actor,target); match com unique(par ordenado) |
| Message | id, match_id, sender_id, body, created_at, client_id único por remetente |
| Block / Report | actor, target; categoria, evidência restrita, estado, decisão, auditoria |
| Invitation / Subscription | match, proposta, estado; entitlement, token externo protegido, expiry |



| Contrato sugerido | Comportamento |
| --- | --- |
| GET /discovery?cursor | Perfis permitidos, faixa aproximada; paginação opaca |
| POST /reactions | target_id e like/pass; idempotency-key; match opcional na resposta |
| POST /location-signals | Consente e valida precisão; sem retorno de sinais de terceiros |
| GET /crossings | Somente derivados não expirados e permitidos |
| POST /matches/:id/messages | Participante ativo; client_id; limite e deduplicação |
| POST /blocks · POST /reports | Revogação imediata e protocolo separado |
| DELETE /me · POST /me/export | Reautenticação e job auditado |



Erros: 401 sessão inválida, 403 sem permissão, 404 objeto indisponível sem revelar existência, 409 conflito, 422 entrada inválida, 429 limite com Retry-After. Nunca serializar dados privados por padrão.

## 11. Monetização e métricas

## Planos e monetização — proposta v2 · 07/11/2026

Preços de hipótese para testes de interesse e disposição a pagar. Não são resultado de estudo de mercado ou promessa de receita.

| Plano | Mensal | Anual, cobrança única | Benefícios |
| --- | --- | --- | --- |
| Elo Free | R$ 0 | R$ 0 | Descoberta, curtidas, match, chat, caminhos e segurança |
| Elo Plus | R$ 19,90 | R$ 179,90 | Free + ver quem curtiu e desfazer o último perfil dispensado |
| Elo Premium | R$ 34,90 | R$ 299,90 | Plus + modo discreto e 1 destaque de 30 minutos por semana |

O equivalente mensal anual é R$ 14,99 no Plus e R$ 24,99 no Premium (arredondamento informativo, não parcelamento). Sempre exibir o total anual antes de confirmar. Preço do catálogo da loja deverá prevalecer em produção.

### Fluxos implementados no HTML

- Botão Planos no cabeçalho; comparação mensal/anual e tabela de benefícios.
- Resumo antes da ativação, com preço, período e explicação de renovação proposta.
- Ativação somente simulada; perfil informa plano ativo e oferece gerenciamento.
- Encerrar simulação devolve imediatamente ao Free. Em produção, cancelamento da renovação mantém benefícios até a expiração contratada, salvo reembolso/revogação.
- Ver curtidas e desfazer abrem oferta no Free. Plus/Premium permitem acesso local aos perfis fictícios e à última dispensa.
- Premium permite alternar modo discreto simulado e consumir um destaque fictício por sessão. Não existe servidor ou aumento real de exposição.
- Recusar oferta não impede continuar usando o Free. Segurança e controles de localização não são pagos.

### Regras a implementar no produto

O servidor deverá validar compras e direitos de acesso; nunca confiar em variáveis do cliente. Modelar compra pendente, ativa, renovação cancelada, período de tolerância, expirada, reembolsada e revogada. Reconciliar restauração, troca de conta/dispositivo e notificações de cobrança de forma idempotente. Troca de plano não pode causar cobrança dupla; a modalidade de ajuste será definida com o provedor.

O destaque deverá ter quota por semana de sete dias, ativação explícita, duração de 30 minutos, registro no servidor e tratamento de falha. Não pode ignorar filtros, bloqueios ou modo discreto; não garante matches. O modo discreto limita descoberta a quem recebeu curtida e preserva matches ativos, sem expor caminhos a outros perfis. Estes comportamentos dependem de backend e não estão operacionais no HTML.

Antes do lançamento: validar custos, tributos/taxas aplicáveis, operação de moderação, preço, políticas vigentes de cobrança da loja e termos locais. Medir visualização de oferta, início/ conclusão de compra, retenção, cancelamento, reembolso e uso dos benefícios, sem incluir conversas ou localização na análise comercial.

### Identidade visual atual

Azul principal #2563EB; azul-marinho #192B48; fundo #F7FAFF; superfícies #E2EDFF. Os tons substituem a direção terracota anterior. Assets antigos de conceito são referências históricas, não a paleta da interface atual.

### Limitações

Protótipo HTML, não APK. Não cobra, não acessa loja/GPS e não modifica exposição real. Planos e conversas ficam na memória da página e reiniciam ao recarregar. Preços não indicam viabilidade financeira comprovada.


## 12. Plano de QA e aceite

| Teste | Resultado obrigatório |
| --- | --- |
| Idade abaixo de 18 e conta suspeita | Sem acesso à experiência de relacionamento; revisão disponível |
| Permissão negada/revogada | Sem coleta; alternativa por cidade; cruzamentos desligados |
| Localização desatualizada/imprecisa | Não criar cruzamento e não afirmar distância atual |
| Curtidas simultâneas e retry | Um único match; nenhuma duplicação |
| API com ID de outro usuário | Negação sem revelar dados privados |
| Bloqueio com chat aberto | Envio e descoberta interrompidos imediatamente |
| Mensagem maliciosa | Texto escapado; sem execução de HTML/script |
| Exclusão e restauração de backup | Dados não reaparecem; mídia e derivados removidos |
| Sem rede / rede intermitente | Erro e retry explícitos; sem mensagem falsamente entregue |
| TalkBack / fonte ampliada / 320 px | Controles identificáveis; sem sobreposição ou corte |
| Assinatura cancelada/expirada | Direitos reconciliados no servidor |
| Abuso de consultas geográficas | Rate limiting e nenhuma exposição de coordenada exata |



Metas técnicas propostas: sessões sem crash ≥99,5%; descoberta p95 até 1,5 s em carga definida; ensaio inicial com 100 sessões simultâneas. São critérios futuros, não resultados medidos. Medir consumo de bateria antes de ativar segundo plano.

## 13. Lançamento na Play Store

Checklist consultado em 06/11/2026; revalidar as políticas na submissão. A aprovação não é garantida.


- Conta de desenvolvedor, identidade e requisitos de teste aplicáveis à conta.

- Nome e marca disponíveis, ícone, imagens reais do app final, descrição e classificação de conteúdo.

- Restringir acesso de menores pelas opções aplicáveis da Play Console e pelo produto.

- Política de privacidade pública, formulário Data safety consistente com app e SDKs; exclusão dentro do app e recurso web.

- Normas públicas contra exploração sexual infantil, canal de denúncia e contato responsável.

- Justificar localização; para segundo plano, preparar declaração, demonstração e consentimento destacado.

- Disponibilizar conta de revisão, credenciais e instruções sem expor usuários reais.

- Build Android assinado, target API e dependências conformes às exigências vigentes na data de envio.


Fontes oficiais: [Políticas do programa](https://support.google.com/googleplay/android-developer/answer/18265346); [Dados do usuário e exclusão](https://support.google.com/googleplay/android-developer/answer/10144311); [Restrições de idade](https://support.google.com/googleplay/android-developer/answer/16838200); [Localização em segundo plano](https://android-developers.googleblog.com/2020/11/tips-for-getting-your-app-approved-for-background-location-access.html). As fontes não aprovam este projeto; orientam os itens a verificar.

## 14. Roadmap e decisões pendentes

- **Descoberta:** entrevistar potenciais usuários de perfis diversos; validar confiança, interesse e limites de localização.

- **Design:** testar este protótipo; consolidar onboarding, estados vazios e ferramentas de proteção.

- **Fundação:** autenticação, banco, autorização, mídia e operação administrativa.

- **MVP:** descoberta por região, match, chat e exclusão; testes internos e fechados.

- **Piloto BH:** recrutamento concentrado, acompanhamento da qualidade das conversas e capacidade de suporte.

- **Cruzamentos:** experimento controlado antes de generalizar ou pedir localização em segundo plano.

- **Receita:** testar oferta premium após sinal de uso recorrente.


Pendências: nome final e registro, orçamento e equipe, stack definitiva, fornecedor de autenticação/moderação, público inicial de aquisição, critérios de idade, política de retenção, preço e suporte. Sequência não representa orçamento ou prazo contratado.

## 15. Guia do protótipo e entrega

Abra **index.html** em navegador atualizado. O arquivo é autocontido e funciona sem internet; a arte também acompanha a pasta assets. A documentação está separada em documentacao.html, com botão de impressão. O arquivo DOCUMENTACAO.md contém o conteúdo editável.



**Interações reais da demonstração:** navegar entre áreas; filtrar perfis fictícios; passar/curtir; simular match com perfil previamente interessado; enviar mensagem local; alternar cruzamentos; bloquear perfil; registrar denúncia local; editar nome; limpar dados da demonstração.



**Simulações:** localização, cruzamentos, reciprocidade pré-definida, mensagens, denúncia e configurações. Nenhuma localização real é coletada, nenhuma mensagem é enviada a terceiros, nenhum pagamento é cobrado. Estado fica somente na memória da página e reinicia ao recarregar. Não é APK nem backend pronto.



Imagens: ilustração conceitual gerada por IA; avatares SVG originais de adultos fictícios; não usar como prova de usuários ou verificação. Protótipo para validar produto e orientar implementação, sem hospedagem pública solicitada.

## Revisão mobile

Interface refeita como aplicativo: tela única, barra inferior persistente, rolagem interna, chat compacto e gesto horizontal nos cartões. Sem landing page ou documentação dentro da navegação do usuário.


## Perfis, curtidas e popularidade — revisão 3

### Limites diários propostos

| Plano | Curtidas por dia |
| --- | ---: |
| Free | 20 |
| Plus | 100 |
| Premium | 200 |

O saldo renova à meia-noite no fuso America/Sao_Paulo (Brasília). Cada destinatário distinto consome uma curtida por dia. Passar perfis não consome saldo. Atingir o limite não bloqueia conversas ou matches existentes. Trocar de plano mantém o consumo do dia; o novo limite define o saldo restante, nunca negativo. Curtidas não acumulam entre dias. Desfazer uma dispensa não restitui curtidas.

No HTML, contador, edição e planos duram apenas a sessão; recarregar reinicia os dados. Produção: validar quota e assinatura no servidor, com incremento atômico, chave de idempotência, data do servidor e proteção contra concorrência e múltiplos dispositivos. O contador visual deve sincronizar com a resposta do servidor. Não confiar no relógio ou no saldo do cliente.

### Orientação de dois dias

Texto: “Sugerimos manter o app instalado por pelo menos dois dias e voltar para explorar novos perfis. As pessoas entram em horários diferentes.” É uma sugestão, sem espera obrigatória ou garantia de curtidas, matches ou melhora do algoritmo. Não é preciso deixar o aplicativo aberto. Aviso acessível em Descobrir.

### Perfil completo

Idade de adulto (18–100 no formulário demonstrativo), gênero, intenção, descrição de até 500 caracteres, até oito interesses, fumo, filhos, bebidas alcoólicas, altura opcional de 100–250 cm, profissão, escolaridade e pets. Campos de hábitos permitem “Prefiro não informar”. Não solicitar nomes, idades ou fotos dos filhos. Nome de exibição continua editável separadamente. O perfil aberto de outras pessoas mostra descrição, interesses e detalhes de estilo de vida.

Produção: calcular idade a partir da data de nascimento privada, aplicar validação de maioridade, permitir correção controlada e moderar fotos e texto. Fotos reais, upload, verificação e persistência dependem do aplicativo e backend; a demonstração usa ilustrações fictícias.

### Minha popularidade

Painel privado e gratuito com visitas, curtidas recebidas e matches, com janela proposta de sete dias. Não é ranking público de beleza. No HTML os dados são fictícios, visitas não são coletadas e não há histórico real de sete dias. Sem histórico suficiente, exibir estado inicial em vez de uma classificação. Assinatura não altera artificialmente as métricas.

Produção: definir eventos de visita elegível, curtida e match, deduplicar por conta e período, excluir bots/autovisitas, respeitar bloqueios e apresentar contagens agregadas. Não revelar a identidade dos visitantes nesse painel. A regra de ver quem curtiu permanece no Plus/Premium. A classificação futura exige critérios documentados e validação de produto; não foi implementada.

### Aceitação

Contador inicia no limite do plano, reduz após curtida aceita e impede nova curtida quando esgotado. Formulário recusa idade fora da faixa; salvar atualiza o próprio perfil na sessão. Modal de perfil exibe hábitos e interesses. O aviso não impede o uso. Popularidade informa seu caráter privado e demonstrativo. Reinício do dia, troca de plano, requisições simultâneas e persistência entre dispositivos requerem testes de integração no backend antes de lançamento.
