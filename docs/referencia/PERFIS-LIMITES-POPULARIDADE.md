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
