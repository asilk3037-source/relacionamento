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
